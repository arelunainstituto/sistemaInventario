// Importador de planilha XLSX (Instituto Areluna v1.2).
// Apenas Admin. Fluxo em 2 etapas:
//   1) POST /preview  → parse + normalização + validação, sem persistir
//   2) POST /execute  → persiste com transação lógica
//
// Decisões de design:
//   • Fornecedores vêm da aba "Cadastro de Fornecedores" (chave de dedup:
//     NIF/NIPC). Itens da aba "Cadastro_Produtos" referem-se ao
//     fornecedor pela coluna "Nome Fantasia" (informacional).
//   • A 1ª coluna ("ID") da aba de produtos é a chave de dedup do item
//     E o internal_code persistido. DEVE seguir o padrão ^[12]\d{6}$
//     (1XXXXXX para consumo, 2XXXXXX para patrimônio). IDs fora do
//     padrão bloqueiam o import — o operador precisa corrigir a planilha.
//   • Todas as 5 categorias canonicalizadas são criadas como raízes
//     (parent_macro='consumo').
//   • UoMs canonicalizadas correspondem à aba Tabelas_Aux.
//   • Itens são marcados macro=consumo e controls_lot=true (default por trigger).

const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const xlsx    = require('xlsx');
const { requireRole } = require('../middleware/auth');
const { supabaseAdmin } = require('./_stock');

const ADMIN_ROLES = ['Inventory_Admin', 'Admin', 'admin'];
const upload = multer({
    storage: multer.memoryStorage(),
    limits:  { fileSize: 10 * 1024 * 1024 }
});

// ---------- Normalização ----------
function normKey(s) {
    return String(s ?? '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

// Normaliza NIF: só dígitos, trim. Retorna null se vazio ou inválido.
function normNif(s) {
    if (!s) return null;
    const digits = String(s).replace(/\D/g, '');
    return digits.length >= 8 ? digits : null;
}

// Normaliza nome fantasia para matching (case-insensitive, sem
// espaços duplos). Retorna null se vazio.
function normNF(s) {
    if (!s) return null;
    const t = String(s).trim().replace(/\s+/g, ' ').toUpperCase();
    if (!t || t === '–' || t === '-' || t === 'VARIAVEL') return null;
    return t;
}

// Mapa de categorias da planilha → 5 canônicas (Tabelas_Aux)
const CATEGORY_CANONICAL = {
    'consumiveis clinicos':   'Consumíveis Clínicos',
    'consumiveis clinico':    'Consumíveis Clínicos',
    'consumiveis clinicas':   'Consumíveis Clínicos',
    'consumivel clinico':     'Consumíveis Clínicos',
    'material de laboratorio':'Material de Laboratório',
    'epi':                    'EPI',
    'higiene e limpeza':      'Higiene e Limpeza',
    'higiene limpeza':        'Higiene e Limpeza',
    'outros':                 'Outros'
};

const UOM_CANONICAL = {
    'un':     { code: 'un',     name: 'Unidade' },
    'unidade':{ code: 'un',     name: 'Unidade' },
    'cx':     { code: 'cx',     name: 'Caixa' },
    'caixa':  { code: 'cx',     name: 'Caixa' },
    'frasco': { code: 'frasco', name: 'Frasco' },
    'fraso':  { code: 'frasco', name: 'Frasco' },
    'pack':   { code: 'pack',   name: 'Pack' },
    'kg':     { code: 'kg',     name: 'Quilograma' },
    'lt':     { code: 'lt',     name: 'Litro' },
    'litro':  { code: 'lt',     name: 'Litro' },
    'rolo':   { code: 'rolo',   name: 'Rolo' }
};

function canonCategory(raw) {
    if (!raw) return null;
    return CATEGORY_CANONICAL[normKey(raw)] || 'Outros';
}

function canonUom(raw) {
    if (!raw) return null;
    return UOM_CANONICAL[normKey(raw)] || null;
}

const CONSUMO_PATTERN = /^1\d{6}$/;   // pool de Uso e Consumo (1XXXXXX) — o único que este importador cadastra

// Maior sufixo numérico entre os códigos de consumo (1XXXXXX) já no DB.
// DESC + limit 1 → uma linha só: imune ao teto de linhas do PostgREST e barato.
async function maxConsumoNum() {
    const { data } = await supabaseAdmin.from('inv_items')
        .select('internal_code')
        .gte('internal_code', '1000000').lte('internal_code', '1999999')
        .order('internal_code', { ascending: false }).limit(1);
    const m = /^1(\d{6})$/.exec((data && data[0] && data[0].internal_code) || '');
    return m ? parseInt(m[1], 10) : 0;
}

// ---------- Parse das abas ----------
function readSheet(wb, name) {
    if (!wb.SheetNames.includes(name)) return null;
    return xlsx.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: false, defval: '' });
}

function parseProductSheet(buffer) {
    const wb = xlsx.read(buffer);
    if (!wb.SheetNames.includes('Cadastro_Produtos')) {
        throw new Error('Aba "Cadastro_Produtos" não encontrada — verifique o formato da planilha');
    }
    // Linhas 0-2 são título + subtítulo + cabeçalho
    const rows = xlsx.utils.sheet_to_json(wb.Sheets['Cadastro_Produtos'], {
        header: 1, raw: false, defval: ''
    });
    return {
        wb,
        productRows: rows.slice(3).filter(r => r.some(c => c && String(c).trim()))
    };
}

function parseSupplierSheet(wb) {
    const rows = readSheet(wb, 'Cadastro de Fornecedores');
    if (!rows) return null; // sheet ausente — backward compat
    // Linha 0 é cabeçalho. Dados começam na linha 1.
    return rows.slice(1).filter(r => r.some(c => c && String(c).trim()));
}

// ---------- POST /preview ----------
router.post('/preview', requireRole(ADMIN_ROLES), upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'Arquivo XLSX é obrigatório (campo "file")' });
        if (!/\.xlsx?$/i.test(req.file.originalname)) {
            return res.status(400).json({ error: 'Formato deve ser .xlsx ou .xls' });
        }

        const { wb, productRows } = parseProductSheet(req.file.buffer);
        const supplierRows = parseSupplierSheet(wb);

        const errors   = [];
        const warnings = [];

        // ---------- A. Fornecedores ----------
        const suppliers = [];          // [{ line, ... }]
        const nifSetInFile = new Set();
        const nfToFileIdx  = new Map(); // Nome Fantasia normalizado → [indices em suppliers[]]

        if (supplierRows) {
            for (const [idx, row] of supplierRows.entries()) {
                const line = idx + 2; // 1-based, 1 linha de cabeçalho
                const [_id, tipo, nomeFantasia, razaoSocial, nif, sede,
                       caeCirs, email, telefone, site, vendNome, vendTel,
                       iban, regimeIva] = row.map(c => (c ?? '').toString().trim());

                if (!nomeFantasia && !razaoSocial && !nif) continue; // linha vazia
                const nifNorm = normNif(nif);
                const nfNorm  = normNF(nomeFantasia);

                if (!nifNorm) {
                    errors.push({ line, msg: `Fornecedor sem NIF/NIPC válido (linha ${line}) — obrigatório para deduplicação` });
                    continue;
                }
                if (!nfNorm) {
                    errors.push({ line, msg: `Fornecedor sem Nome Fantasia (linha ${line})` });
                    continue;
                }
                if (nifSetInFile.has(nifNorm)) {
                    warnings.push({ line, source_code: nifNorm, msg: `NIF ${nifNorm} duplicado na aba de fornecedores — segunda ocorrência será ignorada` });
                    continue;
                }
                nifSetInFile.add(nifNorm);

                const supplier = {
                    line,
                    entity_type:     tipo || null,
                    name:            nfNorm,
                    legal_name:      razaoSocial || null,
                    tax_id:          nifNorm,
                    address:         sede || null,
                    cae_code:        caeCirs || null,
                    email:           email || null,
                    phone:           telefone || null,
                    website:         site || null,
                    sales_rep_name:  vendNome || null,
                    sales_rep_phone: vendTel || null,
                    iban:            iban || null,
                    vat_regime:      regimeIva || null,
                };
                suppliers.push(supplier);
                if (!nfToFileIdx.has(nfNorm)) nfToFileIdx.set(nfNorm, []);
                nfToFileIdx.get(nfNorm).push(suppliers.length - 1);
            }
        }

        // Compara fornecedores com DB (por NIF)
        const fileNifs = [...nifSetInFile];
        let existingByNif = new Map();
        if (fileNifs.length) {
            const { data } = await supabaseAdmin.from('inv_suppliers')
                .select('id, name, tax_id').in('tax_id', fileNifs).is('deleted_at', null);
            existingByNif = new Map((data || []).map(s => [s.tax_id, s]));
        }
        // Marca cada fornecedor com seu status (para o preview da UI)
        for (const s of suppliers) {
            s._exists_in_db = existingByNif.has(s.tax_id);
        }
        const newSuppliers      = suppliers.filter(s => !s._exists_in_db);
        const existingSuppliers = suppliers.filter(s =>  s._exists_in_db);

        // ---------- B. Produtos ----------
        // Cada linha vira um item com um _op decidido após consultar o DB:
        //   • insert → ID novo (fornecido na planilha OU auto-atribuído)
        //   • update → ID já cadastrado (atualiza o item existente)
        // Itens com ID em branco recebem o próximo código de Uso e Consumo
        // (1XXXXXX) disponível. Duplicatas dentro da planilha continuam
        // barradas: a 2ª ocorrência é avisada e ignorada.
        const items = [];
        const itemIdSetInFile = new Set();
        const categoriesSet   = new Set();
        const uomsSet         = new Set();
        const providedConsumoNums = []; // sufixos de IDs 1XXXXXX já presentes na planilha

        for (const [idx, row] of productRows.entries()) {
            const line = idx + 4; // 1-based, 3 linhas de cabeçalho
            const [id, descricao, categoria, unidade, referencia, fornecedor,
                   _custo, stockMin, stockMax, _prateleira, observacoes, estado] =
                row.map(c => (c ?? '').toString().trim());

            if (!id && !descricao) continue; // linha em branco

            const hasId = !!id;
            if (hasId) {
                if (itemIdSetInFile.has(id)) {
                    warnings.push({ line, source_code: id, msg: `ID "${id}" duplicado na planilha — segunda ocorrência será ignorada` });
                    continue;
                }
                itemIdSetInFile.add(id);
                // Importador é só de Uso e Consumo → ID fornecido deve ser 1XXXXXX.
                // (2XXXXXX é Patrimônio, que este fluxo não cadastra; bloqueia para
                // não gravar um item patrimonial como consumo.)
                if (!CONSUMO_PATTERN.test(id)) {
                    errors.push({
                        line, source_codes: [id],
                        msg: `ID "${id}" inválido — este importador só aceita códigos de Uso e Consumo (1XXXXXX). Corrija a linha na planilha.`
                    });
                    continue;
                }
                providedConsumoNums.push(parseInt(id.slice(1), 10));
            }

            // Sem ID ainda não há código a exibir nos avisos da linha (atribuído em B.2).
            const label = id || '';
            if (!descricao) warnings.push({ line, source_code: label, msg: 'Descrição vazia' });
            if (!categoria) warnings.push({ line, source_code: label, msg: 'Categoria vazia — será "Outros"' });
            if (!unidade)   warnings.push({ line, source_code: label, msg: 'Unidade vazia — item ficará sem UM' });

            const cat   = canonCategory(categoria);
            const uom   = canonUom(unidade);
            const nfRef = normNF(fornecedor);
            if (cat) categoriesSet.add(cat);
            if (uom) uomsSet.add(uom.code);
            if (unidade && !uom) {
                warnings.push({ line, source_code: label, msg: `Unidade "${unidade}" não reconhecida — item ficará sem UM` });
            }

            // A presença da célula controla o que um UPDATE sobrescreve:
            // célula em branco nunca apaga um valor já gravado no item.
            const minProvided = stockMin !== '';
            const maxProvided = stockMax !== '';
            const minStock = minProvided ? parseFloat(stockMin.replace(',', '.')) : null;
            const maxStock = maxProvided ? parseFloat(stockMax.replace(',', '.')) : null;

            items.push({
                line,
                source_code:      id || '',
                internal_code:    hasId ? id : null, // null → auto-atribuído na etapa B.2
                _needs_code:      !hasId,
                name:             descricao || null,
                manufacturer_ref: referencia || null,
                description:      observacoes || null,
                _category_name:   cat,
                _uom_code:        uom?.code || null,
                _supplier_nf:     nfRef,
                min_stock:        (minProvided && isFinite(minStock)) ? minStock : null,
                max_stock:        (maxProvided && isFinite(maxStock)) ? maxStock : null,
                // Ativo por padrão; só inativa se o "estado" indicar claramente
                // negação. (O regex antigo /ativ/ marcava "Inativo" como ativo,
                // pois "inativo" contém "ativ".)
                is_active:        estado ? !/^(in[ai]tiv|inactiv|desativ|desactiv|n[ãa]o|no|false|0)/i.test(estado) : true,
                _estado_provided: !!estado
            });
        }

        // B.1) IDs fornecidos que já existem no DB → UPDATE. Sem filtro de
        //      deleted_at: o UNIQUE de internal_code é global, então um ID
        //      que bate com item removido também é update (e o reativa).
        const providedCodes = items.filter(i => !i._needs_code).map(i => i.internal_code);
        const existingByCode = new Map();
        // Lotes de 500 para não esbarrar no teto de linhas do PostgREST quando
        // a planilha traz muitos IDs já cadastrados.
        for (let i = 0; i < providedCodes.length; i += 500) {
            const chunk = providedCodes.slice(i, i + 500);
            const { data: ex } = await supabaseAdmin.from('inv_items')
                .select('id, internal_code, name, deleted_at, min_stock, max_stock, default_supplier_id')
                .in('internal_code', chunk);
            for (const r of (ex || [])) existingByCode.set(r.internal_code, r);
        }
        for (const it of items) {
            if (it._needs_code) continue;
            const ex = existingByCode.get(it.internal_code);
            if (ex) {
                it._op = 'update';
                it._existing_id       = ex.id;
                it._existing_name     = ex.name;
                it._was_deleted       = !!ex.deleted_at;
                it._existing_min      = ex.min_stock;
                it._existing_max      = ex.max_stock;
                it._existing_supplier = ex.default_supplier_id;
            } else {
                it._op = 'insert';
            }
        }

        // B.2) Sugere códigos de consumo (1XXXXXX) para os itens sem ID, só para
        //      exibição no preview. Começa acima do maior código existente e dos
        //      IDs 1XXXXXX já fornecidos. O /execute RE-DERIVA esses códigos no
        //      momento da gravação (a sugestão pode envelhecer entre as etapas).
        const needsCode = items.filter(i => i._needs_code);
        if (needsCode.length) {
            let maxNum = await maxConsumoNum();
            for (const n of providedConsumoNums) maxNum = Math.max(maxNum, n);

            let nextNum = maxNum;
            for (const it of needsCode) {
                nextNum++;
                it.internal_code  = '1' + String(nextNum).padStart(6, '0');
                it._op            = 'insert';
                it._auto_assigned = true;
            }
            if (nextNum > 999999) {
                errors.push({ msg: `Pool de códigos de Uso e Consumo (1XXXXXX) esgotado ao auto-atribuir ${needsCode.length} item(ns).` });
            }
        }

        // B.3) Coerência de stock (CHECK max_stock >= min_stock no DB). Considera
        //      o que a planilha fornece + (em updates) o valor já gravado para o
        //      lado deixado em branco. Bloqueia antes de o UPDATE/INSERT falhar.
        for (const it of items) {
            const isUpd = it._op === 'update';
            const effMin = it.min_stock != null ? it.min_stock
                         : (isUpd && it._existing_min != null ? Number(it._existing_min) : 0);
            const effMax = it.max_stock != null ? it.max_stock
                         : (isUpd && it._existing_max != null ? Number(it._existing_max) : null);
            const srcCode = [it.internal_code || `linha ${it.line}`];
            // Os CHECKs do DB são dois: min >= 0 e (max IS NULL OR max >= min).
            if (effMin < 0 || (effMax != null && effMax < 0)) {
                errors.push({ line: it.line, source_codes: srcCode,
                    msg: `Stock mínimo/máximo não pode ser negativo — corrija a linha` });
            } else if (effMax != null && effMax < effMin) {
                errors.push({ line: it.line, source_codes: srcCode,
                    msg: `Stock máximo (${effMax}) menor que o mínimo (${effMin}) — corrija a linha` });
            }
        }

        // Vínculo automático produto → fornecedor (default_supplier_id).
        // Constrói índice de Nome Fantasia → lista de NIFs (a partir
        // dos suppliers do arquivo + existentes no DB). Regra de match
        // alinhada com decisão da equipe:
        //   • Exatamente 1 fornecedor com aquele Nome Fantasia → vincula
        //   • 0 (Nome Fantasia ausente / typo) → deixa em branco, sem warning
        //   • >1 (ambíguo, ex.: AMAZON) → deixa em branco, sem warning
        // O usuário vincula manualmente depois.
        const nfToNifs = new Map();
        for (const s of suppliers) {
            if (!nfToNifs.has(s.name)) nfToNifs.set(s.name, []);
            nfToNifs.get(s.name).push(s.tax_id);
        }
        for (const s of existingByNif.values()) {
            const nfn = normNF(s.name);
            if (!nfn) continue;
            if (!nfToNifs.has(nfn)) nfToNifs.set(nfn, []);
            // Evita duplicar NIFs já incluídos via aba de fornecedores
            if (!nfToNifs.get(nfn).includes(s.tax_id)) {
                nfToNifs.get(nfn).push(s.tax_id);
            }
        }

        // O _supplier_nif é resolvido para TODOS os itens (inserts e updates) —
        // updates usam-no para preencher fornecedor só se estiver vazio (no
        // /execute). Mas o contador exibido conta só inserts, para casar com o
        // que o /execute reporta na tela de conclusão.
        let linkedItems = 0;
        for (const it of items) {
            if (!it._supplier_nf) continue;
            const nifs = nfToNifs.get(it._supplier_nf) || [];
            if (nifs.length === 1) {
                it._supplier_nif = nifs[0]; // resolvido para um NIF único
                if (it._op === 'insert') linkedItems++;
            }
            // 0 ou >1: it._supplier_nif permanece undefined → fica em branco
        }

        // Comparar categorias / UMs com DB
        const [existCats, existUoms] = await Promise.all([
            supabaseAdmin.from('inv_categories').select('id, name, parent_macro').is('deleted_at', null),
            supabaseAdmin.from('inv_units_of_measure').select('id, code, name').is('deleted_at', null),
        ]);
        const existCatNames = new Set((existCats.data || []).map(c => c.name));
        const existUomCodes = new Set((existUoms.data || []).map(u => u.code));
        const newCategories = [...categoriesSet].filter(n => !existCatNames.has(n));
        const newUoms       = [...uomsSet].filter(c => !existUomCodes.has(c))
                                          .map(c => Object.values(UOM_CANONICAL).find(u => u.code === c))
                                          .filter(Boolean);

        const insertItems = items.filter(i => i._op === 'insert');
        const updateItems = items.filter(i => i._op === 'update');
        const autoItems   = items.filter(i => i._auto_assigned);

        res.json({
            success: true,
            data: {
                // Fornecedores
                suppliers_count:          suppliers.length,
                new_suppliers_count:      newSuppliers.length,
                existing_suppliers_count: existingSuppliers.length,
                suppliers_preview:        suppliers.slice(0, 10),
                // Produtos
                items_count:              items.length,
                items_insert_count:       insertItems.length,
                items_update_count:       updateItems.length,
                items_autoassigned_count: autoItems.length,
                items_with_supplier:      linkedItems,
                items_without_supplier:   insertItems.length - linkedItems,
                items_preview:            items.slice(0, 10).map(it => ({
                    line:           it.line,
                    source_code:    it.source_code,
                    internal_code:  it.internal_code,
                    name:           it.name,
                    _op:            it._op,
                    _auto_assigned: !!it._auto_assigned,
                    _category_name: it._category_name,
                    _uom_code:      it._uom_code
                })),
                // Lista completa dos updates — cada um desmarcável na UI
                items_to_update:          updateItems.map(it => ({
                    line:          it.line,
                    internal_code: it.internal_code,
                    name:          it.name,
                    existing_name: it._existing_name,
                    was_deleted:   !!it._was_deleted
                })),
                new_categories:        newCategories,
                new_uoms:              newUoms,
                // Comum
                warnings,
                errors,
                _payload: {
                    suppliers, items,
                    new_categories: newCategories, new_uoms: newUoms
                }
            }
        });
    } catch (err) {
        console.error('POST import/preview error:', err);
        res.status(500).json({ error: err.message || 'Erro ao processar planilha' });
    }
});

// ---------- POST /execute ----------
router.post('/execute', requireRole(ADMIN_ROLES), async (req, res) => {
    try {
        const {
            suppliers = [],
            items = [],
            new_categories = [],
            new_uoms = []
        } = req.body || {};

        if (!Array.isArray(items)) {
            return res.status(400).json({ error: 'Payload inválido (items)' });
        }
        // Permite import só de fornecedores (planilha sem itens, ou todos os
        // updates desmarcados na UI) — desde que haja algo a fazer.
        if (!items.length && !suppliers.length) {
            return res.status(400).json({ error: 'Nada para importar' });
        }

        // 1) UoMs novas
        if (new_uoms.length) {
            const { error } = await supabaseAdmin.from('inv_units_of_measure')
                .insert(new_uoms.map(u => ({ code: u.code, name: u.name, is_active: true })));
            if (error && error.code !== '23505') throw error;
        }

        // 2) Categorias novas (raízes, consumo)
        if (new_categories.length) {
            const { error } = await supabaseAdmin.from('inv_categories')
                .insert(new_categories.map(name => ({
                    name, parent_macro: 'consumo', parent_id: null,
                    is_active: true, consumption_window_days: 30
                })));
            if (error && error.code !== '23505') throw error;
        }

        // 3) Fornecedores — UPSERT por NIF (tax_id). O índice único
        //    uq_inv_suppliers_tax garante que duplicatas são merged.
        let createdSuppliers = 0;
        let skippedSuppliers = 0;
        if (suppliers.length) {
            const taxIds = suppliers.map(s => s.tax_id).filter(Boolean);
            const { data: alreadyIn } = await supabaseAdmin.from('inv_suppliers')
                .select('tax_id').in('tax_id', taxIds).is('deleted_at', null);
            const existingTaxIds = new Set((alreadyIn || []).map(s => s.tax_id));

            const toInsert = suppliers.filter(s => !existingTaxIds.has(s.tax_id));
            skippedSuppliers = suppliers.length - toInsert.length;

            if (toInsert.length) {
                const payload = toInsert.map(s => ({
                    name:            s.name,
                    tax_id:          s.tax_id,
                    legal_name:      s.legal_name,
                    entity_type:     s.entity_type,
                    address:         s.address,
                    cae_code:        s.cae_code,
                    email:           s.email,
                    phone:           s.phone,
                    website:         s.website,
                    sales_rep_name:  s.sales_rep_name,
                    sales_rep_phone: s.sales_rep_phone,
                    iban:            s.iban,
                    vat_regime:      s.vat_regime,
                    is_active:       true
                }));
                for (let i = 0; i < payload.length; i += 100) {
                    const batch = payload.slice(i, i + 100);
                    const { data, error } = await supabaseAdmin
                        .from('inv_suppliers').insert(batch).select('id');
                    if (error) throw error;
                    createdSuppliers += (data || []).length;
                }
            }
        }

        // 4) IDs de categorias / UoMs / fornecedores (por NIF)
        const allTaxIds = [...new Set(items.map(it => it._supplier_nif).filter(Boolean))];
        const [cats, uoms, sups] = await Promise.all([
            supabaseAdmin.from('inv_categories').select('id, name').eq('parent_macro', 'consumo').is('parent_id', null).is('deleted_at', null),
            supabaseAdmin.from('inv_units_of_measure').select('id, code').is('deleted_at', null),
            allTaxIds.length
                ? supabaseAdmin.from('inv_suppliers').select('id, tax_id').in('tax_id', allTaxIds).is('deleted_at', null)
                : Promise.resolve({ data: [] })
        ]);
        const catByName  = new Map((cats.data || []).map(c => [c.name, c.id]));
        const uomByCode  = new Map((uoms.data || []).map(u => [u.code, u.id]));
        const supByTaxId = new Map((sups.data || []).map(s => [s.tax_id, s.id]));

        // 5) Separa inserts de updates pela decisão do preview.
        //    Itens sem _op (compat retroativa) caem como insert.
        const insertSrc = items.filter(it => it._op !== 'update');
        const updateSrc = items.filter(it => it._op === 'update' && it._existing_id);
        const resolveUom = code => (code ? (uomByCode.get(code) || null) : null);

        // 5.0) RE-DERIVA agora os códigos auto-atribuídos — não confia nos que o
        //      preview gravou no payload. Assim, se algum item de consumo foi
        //      criado entre o preview e o execute (cadastro manual ou outro
        //      import), os novos códigos continuam acima do maior existente.
        //      Começa acima do max global (consulta DESC, imune a paginação) e
        //      acima dos códigos 1XXXXXX explicitamente fornecidos neste import.
        const autoSrc = insertSrc.filter(it => it._auto_assigned);
        if (autoSrc.length) {
            let base = await maxConsumoNum();
            for (const it of insertSrc) {
                if (it._auto_assigned) continue;
                const m = /^1(\d{6})$/.exec(it.internal_code || '');
                if (m) base = Math.max(base, parseInt(m[1], 10));
            }
            for (const it of autoSrc) {
                base++;
                it.internal_code = '1' + String(base).padStart(6, '0');
            }
        }

        // 5a) Inserts — internal_code já definido (fornecido ou re-derivado).
        //     default_supplier_id resolvido pelo NIF do match único.
        const itemsToInsert = insertSrc.map(it => {
            const uomId = resolveUom(it._uom_code);
            return {
                internal_code:       it.internal_code,
                name:                it.name || `Item ${it.internal_code}`,
                description:         it.description,
                macro_category:      'consumo',
                controls_lot:        true,
                uses_serial:         false,
                subcategory_id:      it._category_name ? (catByName.get(it._category_name) || null) : null,
                base_uom_id:         uomId,
                consumption_uom_id:  uomId,
                purchase_uom_id:     uomId,
                conversion_factor:   1,
                manufacturer_ref:    it.manufacturer_ref,
                min_stock:           it.min_stock || 0,
                max_stock:           it.max_stock,
                reorder_point:       it.min_stock || 0,
                lead_time_days:      0,
                default_supplier_id: it._supplier_nif ? (supByTaxId.get(it._supplier_nif) || null) : null,
                is_active:           it.is_active !== false,
                created_by:          req.user?.id || null,
                updated_by:          req.user?.id || null
            };
        });

        let createdItems = 0;
        for (let i = 0; i < itemsToInsert.length; i += 100) {
            const batch = itemsToInsert.slice(i, i + 100);
            const { data, error } = await supabaseAdmin
                .from('inv_items').insert(batch).select('id');
            if (error) throw error;
            createdItems += (data || []).length;
        }

        // 5b) Updates — só os campos presentes na planilha são tocados;
        //     célula em branco nunca apaga valor existente. Em lotes de 25.
        let updatedItems = 0;
        for (let i = 0; i < updateSrc.length; i += 25) {
            const batch = updateSrc.slice(i, i + 25);
            const results = await Promise.all(batch.map(it => {
                const patch = { updated_by: req.user?.id || null };
                if (it.name != null)             patch.name = it.name;
                if (it.description != null)      patch.description = it.description;
                if (it.manufacturer_ref != null) patch.manufacturer_ref = it.manufacturer_ref;
                const catId = it._category_name ? catByName.get(it._category_name) : null;
                if (catId)                       patch.subcategory_id = catId;
                const uomId = resolveUom(it._uom_code);
                if (uomId) { patch.base_uom_id = uomId; patch.consumption_uom_id = uomId; patch.purchase_uom_id = uomId; }
                if (it.min_stock != null)        patch.min_stock = it.min_stock;
                if (it.max_stock != null)        patch.max_stock = it.max_stock;
                const supId = it._supplier_nif ? supByTaxId.get(it._supplier_nif) : null;
                // Preenche fornecedor só se o item ainda não tem um — nunca
                // sobrescreve um vínculo já curado com o palpite da planilha.
                if (supId && !it._existing_supplier) patch.default_supplier_id = supId;
                if (it._estado_provided)         patch.is_active = it.is_active;
                if (it._was_deleted) {
                    patch.deleted_at = null;                       // reativa item antes removido
                    if (!it._estado_provided) patch.is_active = true; // sem coluna estado → volta ativo
                }
                return supabaseAdmin.from('inv_items')
                    .update(patch).eq('id', it._existing_id).select('id');
            }));
            for (const r of results) {
                if (r.error) throw r.error;
                updatedItems += (r.data || []).length;
            }
        }

        // 6) Alinha a sequence de consumo ao MAIOR código existente (global,
        //    incluindo os recém-inseridos). Crucial: passamos o max GLOBAL, não
        //    o max só deste import — fn_inv_set_code_sequences faz setval absoluto
        //    e moveria a sequence para TRÁS se recebesse um valor menor que o que
        //    já está no DB, fazendo cadastros manuais futuros (trigger nextval)
        //    colidirem com IDs existentes. Patrimônio fica intacto.
        //    supabaseAdmin.rpc(...) é um builder thenable, não Promise.
        let finalConsumoMax = 0;
        if (createdItems > 0) {
            finalConsumoMax = await maxConsumoNum();
            if (finalConsumoMax > 0) {
                try {
                    const { error: seqErr } = await supabaseAdmin.rpc('fn_inv_set_code_sequences', {
                        p_consumo:    finalConsumoMax,
                        p_patrimonio: null
                    });
                    if (seqErr) console.warn('Sequence advance falhou (não crítico):', seqErr.message);
                } catch (err) {
                    console.warn('Sequence advance lançou (não crítico):', err.message);
                }
            }
        }

        const itemsWithSupplier = itemsToInsert.filter(i => i.default_supplier_id).length;
        const autoAssigned      = insertSrc.filter(i => i._auto_assigned).length;

        res.json({
            success: true,
            data: {
                created_items:          createdItems,
                updated_items:          updatedItems,
                auto_assigned_items:    autoAssigned,
                items_with_supplier:    itemsWithSupplier,
                items_without_supplier: createdItems - itemsWithSupplier,
                created_categories:     new_categories.length,
                created_uoms:           new_uoms.length,
                created_suppliers:      createdSuppliers,
                skipped_suppliers:      skippedSuppliers,
                next_consumo_code:      finalConsumoMax > 0 ? '1' + String(finalConsumoMax + 1).padStart(6, '0') : null
            }
        });
    } catch (err) {
        console.error('POST import/execute error:', err);
        res.status(500).json({ error: err.message || 'Erro ao importar' });
    }
});

module.exports = router;
