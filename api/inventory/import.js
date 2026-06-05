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

const ITEM_CODE_PATTERN = /^[12]\d{6}$/;

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
        const items = [];
        const itemIdSetInFile = new Set();
        const categoriesSet   = new Set();
        const uomsSet         = new Set();
        const referencedSupplierNFs = new Set();

        for (const [idx, row] of productRows.entries()) {
            const line = idx + 4; // 1-based, 3 linhas de cabeçalho
            const [id, descricao, categoria, unidade, referencia, fornecedor,
                   _custo, stockMin, stockMax, _prateleira, observacoes, estado] =
                row.map(c => (c ?? '').toString().trim());

            if (!id && !descricao) continue;
            if (!id) {
                errors.push({ line, msg: 'ID (1ª coluna) vazio — linha ignorada' });
                continue;
            }
            if (itemIdSetInFile.has(id)) {
                warnings.push({ line, source_code: id, msg: `ID "${id}" duplicado na planilha — segunda ocorrência será ignorada` });
                continue;
            }
            itemIdSetInFile.add(id);

            if (!descricao) warnings.push({ line, source_code: id, msg: 'Descrição vazia' });
            if (!categoria) warnings.push({ line, source_code: id, msg: 'Categoria vazia — será "Outros"' });
            if (!unidade)   warnings.push({ line, source_code: id, msg: 'Unidade vazia — item ficará sem UM' });

            const cat = canonCategory(categoria);
            const uom = canonUom(unidade);
            const nfRef = normNF(fornecedor);

            if (cat)   categoriesSet.add(cat);
            if (uom)   uomsSet.add(uom.code);
            if (nfRef) referencedSupplierNFs.add(nfRef);

            if (unidade && !uom) {
                warnings.push({ line, source_code: id, msg: `Unidade "${unidade}" não reconhecida — item ficará sem UM` });
            }

            const minStock = stockMin ? parseFloat(stockMin.replace(',', '.')) : 0;
            const maxStock = stockMax ? parseFloat(stockMax.replace(',', '.')) : null;

            // ID da planilha É o internal_code. Padrão obrigatório.
            if (!ITEM_CODE_PATTERN.test(id)) {
                errors.push({
                    line, source_codes: [id],
                    msg: `ID "${id}" fora do padrão 1XXXXXX/2XXXXXX — corrija a linha na planilha`
                });
                continue;
            }

            items.push({
                line,
                source_code:      id,
                internal_code:    id,
                name:             descricao || `Item ${id}`,
                manufacturer_ref: referencia || null,
                description:      observacoes || null,
                _category_name:   cat,
                _uom_code:        uom?.code || null,
                _supplier_nf:     nfRef,
                min_stock:        isFinite(minStock) ? minStock : 0,
                max_stock:        isFinite(maxStock) ? maxStock : null,
                is_active:        !estado || /^acti?v|ativ/i.test(estado.toLowerCase())
            });
        }

        // Verifica conflito de internal_code com DB
        const codesToCheck = items.map(i => i.internal_code);
        if (codesToCheck.length) {
            const { data: existingItems } = await supabaseAdmin
                .from('inv_items').select('internal_code')
                .in('internal_code', codesToCheck);
            const conflict = (existingItems || []).map(i => i.internal_code);
            if (conflict.length) {
                errors.push({
                    msg: `${conflict.length} ID(s) de produto já existem no sistema. Rode 55-clean-test-data.sql para limpar antes da importação.`,
                    source_codes: conflict.slice(0, 10)
                });
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

        let linkedItems = 0;
        for (const it of items) {
            if (!it._supplier_nf) continue;
            const nifs = nfToNifs.get(it._supplier_nf) || [];
            if (nifs.length === 1) {
                it._supplier_nif = nifs[0]; // resolvido para um NIF único
                linkedItems++;
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

        res.json({
            success: true,
            data: {
                // Fornecedores
                suppliers_count:          suppliers.length,
                new_suppliers_count:      newSuppliers.length,
                existing_suppliers_count: existingSuppliers.length,
                suppliers_preview:        suppliers.slice(0, 10),
                // Produtos
                items_count:           items.length,
                items_with_supplier:   linkedItems,
                items_without_supplier: items.length - linkedItems,
                items_preview:         items.slice(0, 10),
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

        if (!Array.isArray(items) || !items.length) {
            return res.status(400).json({ error: 'Lista de itens vazia' });
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

        // 5) Items — inserir em batches. internal_code = ID da planilha
        //    (já validado no preview contra o padrão ^[12]\d{6}$).
        //    default_supplier_id resolvido pelo NIF do match único.
        const itemsToInsert = items.map(it => ({
            internal_code:       it.internal_code,
            name:                it.name,
            description:         it.description,
            macro_category:      'consumo',
            controls_lot:        true,
            uses_serial:         false,
            subcategory_id:      it._category_name ? (catByName.get(it._category_name) || null) : null,
            base_uom_id:         it._uom_code ? (uomByCode.get(it._uom_code) || null) : null,
            consumption_uom_id:  it._uom_code ? (uomByCode.get(it._uom_code) || null) : null,
            purchase_uom_id:     it._uom_code ? (uomByCode.get(it._uom_code) || null) : null,
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
        }));

        let createdItems = 0;
        let maxConsumoCode = 0;
        for (let i = 0; i < itemsToInsert.length; i += 100) {
            const batch = itemsToInsert.slice(i, i + 100);
            const { data, error } = await supabaseAdmin
                .from('inv_items').insert(batch).select('id, internal_code');
            if (error) throw error;
            createdItems += (data || []).length;
            for (const row of (data || [])) {
                const m = (row.internal_code || '').match(/^1(\d{6})$/);
                if (m) maxConsumoCode = Math.max(maxConsumoCode, parseInt(m[1], 10));
            }
        }

        // 6) Avança a sequence de consumo para max(internal_code provido) + 1
        //    Garante que cadastros manuais futuros não colidam com IDs já
        //    importados da planilha. Patrimônio fica intacto.
        if (maxConsumoCode > 0) {
            await supabaseAdmin.rpc('fn_inv_set_code_sequences', {
                p_consumo: maxConsumoCode,
                p_patrimonio: null
            }).catch(err => console.warn('Sequence advance falhou (não crítico):', err.message));
        }

        const itemsWithSupplier = itemsToInsert.filter(i => i.default_supplier_id).length;

        res.json({
            success: true,
            data: {
                created_items:          createdItems,
                items_with_supplier:    itemsWithSupplier,
                items_without_supplier: createdItems - itemsWithSupplier,
                created_categories:     new_categories.length,
                created_uoms:           new_uoms.length,
                created_suppliers:      createdSuppliers,
                skipped_suppliers:      skippedSuppliers,
                next_consumo_code:      maxConsumoCode > 0 ? '1' + String(maxConsumoCode + 1).padStart(6, '0') : null
            }
        });
    } catch (err) {
        console.error('POST import/execute error:', err);
        res.status(500).json({ error: err.message || 'Erro ao importar' });
    }
});

module.exports = router;
