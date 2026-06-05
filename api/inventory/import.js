// Importador de planilha XLSX (Instituto Areluna v1.0).
// Apenas Admin. Fluxo em 2 etapas:
//   1) POST /preview  → parse + normalização + validação, sem persistir
//   2) POST /execute  → persiste com transação lógica
//
// Decisões de design:
//   • A coluna "SKU" da planilha é usada APENAS como chave de deduplicação
//     dentro do arquivo (alertar quando o mesmo código aparece 2x). Não é
//     persistida no banco. O Código de Registro Interno é gerado pelo
//     trigger fn_inv_items_before_insert (formato 1XXXXXX para consumo,
//     2XXXXXX para patrimônio).
//   • Todas as 5 categorias canonicalizadas são criadas como raízes
//     (parent_macro='consumo'). Match com normalização sem diacríticos.
//   • UoMs canonicalizadas correspondem à aba Tabelas_Aux.
//   • Fornecedores normalizados (UPPER + trim de espaços duplos). "–" ou "-"
//     são tratados como ausência.
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

// UoMs canônicas: chave normalizada → { code, name }
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
    const k = normKey(raw);
    return CATEGORY_CANONICAL[k] || 'Outros';
}

function canonUom(raw) {
    if (!raw) return null;
    return UOM_CANONICAL[normKey(raw)] || null;
}

function canonSupplier(raw) {
    if (!raw) return null;
    const s = String(raw).trim().replace(/\s+/g, ' ').toUpperCase();
    if (s === '–' || s === '-' || s === 'VARIAVEL' || !s) return null;
    return s;
}

// ---------- Parse da planilha ----------
function parseSheet(buffer) {
    const wb = xlsx.read(buffer);
    if (!wb.SheetNames.includes('Cadastro_Produtos')) {
        throw new Error('Aba "Cadastro_Produtos" não encontrada — verifique o formato da planilha');
    }
    const rows = xlsx.utils.sheet_to_json(wb.Sheets['Cadastro_Produtos'], {
        header: 1, raw: false, defval: ''
    });
    // Linhas 0-2 são título + subtítulo + cabeçalho da tabela
    return rows.slice(3).filter(r => r.some(c => c && String(c).trim()));
}

// ---------- POST /preview ----------
router.post('/preview', requireRole(ADMIN_ROLES), upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'Arquivo XLSX é obrigatório (campo "file")' });
        if (!/\.xlsx?$/i.test(req.file.originalname)) {
            return res.status(400).json({ error: 'Formato deve ser .xlsx ou .xls' });
        }

        const dataRows = parseSheet(req.file.buffer);

        const items = [];
        const warnings = [];
        const errors   = [];
        // Dedup pela 1ª coluna da planilha (a equipa chamava de "SKU",
        // mas para nós é apenas referência de origem — não é persistida).
        const sourceCodeSet = new Set();
        const categoriesSet = new Set();
        const uomsSet       = new Set();
        const suppliersSet  = new Set();

        for (const [idx, row] of dataRows.entries()) {
            const line = idx + 4; // 1-based contando cabeçalhos
            const [sourceCode, descricao, categoria, unidade, referencia, fornecedor,
                   _custo, stockMin, stockMax, _prateleira, observacoes, estado] =
                row.map(c => (c ?? '').toString().trim());

            if (!sourceCode && !descricao) {
                // Linha totalmente em branco — ignorar silenciosamente
                continue;
            }
            if (!sourceCode) {
                errors.push({ line, msg: 'Código de origem (1ª coluna) vazio — linha ignorada' });
                continue;
            }
            if (sourceCodeSet.has(sourceCode)) {
                warnings.push({ line, source_code: sourceCode, msg: `Código "${sourceCode}" duplicado na planilha — segunda ocorrência será ignorada` });
                continue;
            }
            sourceCodeSet.add(sourceCode);

            if (!descricao) warnings.push({ line, source_code: sourceCode, msg: 'Descrição vazia' });
            if (!categoria) warnings.push({ line, source_code: sourceCode, msg: 'Categoria vazia — será "Outros"' });
            if (!unidade)   warnings.push({ line, source_code: sourceCode, msg: 'Unidade vazia — item ficará sem UM' });

            const cat = canonCategory(categoria);
            const uom = canonUom(unidade);
            const sup = canonSupplier(fornecedor);

            if (cat) categoriesSet.add(cat);
            if (uom) uomsSet.add(uom.code);
            if (sup) suppliersSet.add(sup);

            if (unidade && !uom) {
                warnings.push({ line, source_code: sourceCode, msg: `Unidade "${unidade}" não reconhecida — item ficará sem UM` });
            }

            const minStock = stockMin ? parseFloat(stockMin.replace(',', '.')) : 0;
            const maxStock = stockMax ? parseFloat(stockMax.replace(',', '.')) : null;

            items.push({
                line,
                source_code:      sourceCode,
                name:             descricao || `Item ${sourceCode}`,
                manufacturer_ref: referencia || null,
                description:      observacoes || null,
                _category_name:   cat,
                _uom_code:        uom?.code || null,
                _supplier_name:   sup,
                min_stock:        isFinite(minStock) ? minStock : 0,
                max_stock:        isFinite(maxStock) ? maxStock : null,
                is_active:        !estado || /^acti?v|ativ/i.test(estado.toLowerCase())
            });
        }

        // Compara com o que já existe no DB
        const [existCats, existUoms, existSups] = await Promise.all([
            supabaseAdmin.from('inv_categories').select('id, name, parent_macro').is('deleted_at', null),
            supabaseAdmin.from('inv_units_of_measure').select('id, code, name').is('deleted_at', null),
            supabaseAdmin.from('inv_suppliers').select('id, name').is('deleted_at', null)
        ]);
        const existCatNames = new Set((existCats.data || []).map(c => c.name));
        const existUomCodes = new Set((existUoms.data || []).map(u => u.code));
        const existSupNames = new Set((existSups.data || []).map(s => s.name));

        const newCategories = [...categoriesSet].filter(n => !existCatNames.has(n));
        const newUoms       = [...uomsSet].filter(c => !existUomCodes.has(c))
                                          .map(c => Object.values(UOM_CANONICAL).find(u => u.code === c))
                                          .filter(Boolean);
        const newSuppliers  = [...suppliersSet].filter(n => !existSupNames.has(n));

        res.json({
            success: true,
            data: {
                items_count:        items.length,
                items_preview:      items.slice(0, 10),
                new_categories:     newCategories,
                new_uoms:           newUoms,
                new_suppliers:      newSuppliers,
                existing_categories: existCatNames.size,
                warnings,
                errors,
                _payload: { items, new_categories: newCategories, new_uoms: newUoms, new_suppliers: newSuppliers }
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
        const { items, new_categories = [], new_uoms = [], new_suppliers = [] } = req.body || {};
        if (!Array.isArray(items) || !items.length) {
            return res.status(400).json({ error: 'Lista de itens vazia' });
        }

        // 1) Criar UoMs novas
        if (new_uoms.length) {
            const { error } = await supabaseAdmin.from('inv_units_of_measure')
                .insert(new_uoms.map(u => ({ code: u.code, name: u.name, is_active: true })));
            if (error && error.code !== '23505') throw error;
        }

        // 2) Criar categorias novas (raízes, consumo)
        if (new_categories.length) {
            const { error } = await supabaseAdmin.from('inv_categories')
                .insert(new_categories.map(name => ({
                    name, parent_macro: 'consumo', parent_id: null,
                    is_active: true, consumption_window_days: 30
                })));
            if (error && error.code !== '23505') throw error;
        }

        // 3) Criar fornecedores novos
        if (new_suppliers.length) {
            const { error } = await supabaseAdmin.from('inv_suppliers')
                .insert(new_suppliers.map(name => ({ name, is_active: true })));
            if (error && error.code !== '23505') throw error;
        }

        // 4) Buscar IDs (incluindo os recém-criados)
        const [cats, uoms, sups] = await Promise.all([
            supabaseAdmin.from('inv_categories').select('id, name').eq('parent_macro', 'consumo').is('parent_id', null).is('deleted_at', null),
            supabaseAdmin.from('inv_units_of_measure').select('id, code').is('deleted_at', null),
            supabaseAdmin.from('inv_suppliers').select('id, name').is('deleted_at', null)
        ]);
        const catByName = new Map((cats.data || []).map(c => [c.name, c.id]));
        const uomByCode = new Map((uoms.data || []).map(u => [u.code, u.id]));

        // 5) Itens — sem internal_code; o trigger fn_inv_items_before_insert
        //    gera o código de registro interno (1XXXXXX para consumo).
        const itemsToInsert = items.map(it => ({
            name:               it.name,
            description:        it.description,
            macro_category:     'consumo',
            controls_lot:       true,
            uses_serial:        false,
            subcategory_id:     it._category_name ? (catByName.get(it._category_name) || null) : null,
            base_uom_id:        it._uom_code ? (uomByCode.get(it._uom_code) || null) : null,
            consumption_uom_id: it._uom_code ? (uomByCode.get(it._uom_code) || null) : null,
            purchase_uom_id:    it._uom_code ? (uomByCode.get(it._uom_code) || null) : null,
            conversion_factor:  1,
            manufacturer_ref:   it.manufacturer_ref,
            min_stock:          it.min_stock || 0,
            max_stock:          it.max_stock,
            reorder_point:      it.min_stock || 0,
            lead_time_days:     0,
            is_active:          it.is_active !== false,
            created_by:         req.user?.id || null,
            updated_by:         req.user?.id || null
        }));

        let totalCreated = 0;
        let maxConsumoCode = 0;
        for (let i = 0; i < itemsToInsert.length; i += 100) {
            const batch = itemsToInsert.slice(i, i + 100);
            const { data, error } = await supabaseAdmin
                .from('inv_items').insert(batch).select('id, internal_code');
            if (error) throw error;
            totalCreated += (data || []).length;
            for (const row of (data || [])) {
                const m = (row.internal_code || '').match(/^1(\d{6})$/);
                if (m) maxConsumoCode = Math.max(maxConsumoCode, parseInt(m[1], 10));
            }
        }

        res.json({
            success: true,
            data: {
                created_items:        totalCreated,
                created_categories:   new_categories.length,
                created_uoms:         new_uoms.length,
                created_suppliers:    new_suppliers.length,
                next_consumo_code:    maxConsumoCode > 0 ? '1' + String(maxConsumoCode + 1).padStart(6, '0') : null
            }
        });
    } catch (err) {
        console.error('POST import/execute error:', err);
        res.status(500).json({ error: err.message || 'Erro ao importar' });
    }
});

module.exports = router;
