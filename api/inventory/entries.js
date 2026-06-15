const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { requirePermission } = require('../middleware/auth');

const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const VALID_DOC_TYPES = ['fatura','guia_remessa','nota_encomenda','outro'];

const ENTRY_SELECT = `
    *,
    supplier:inv_suppliers(id, name, tax_id),
    lines:inv_entry_lines(
        id, item_id, purchase_qty, conversion_factor, consumption_qty,
        unit_cost, total_cost, location_id, lot_number, manufacture_date,
        expiry_date, serial_number, created_at,
        item:inv_items(id, name, internal_code, macro_category),
        location:inv_locations(id, name)
    )
`;

// GET / — lista entradas
router.get('/', requirePermission('inventory', 'read'), async (req, res) => {
    try {
        const { supplier_id, document_type, limit = 50, page = 1 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        let q = supabaseAdmin
            .from('inv_entries')
            .select(ENTRY_SELECT, { count: 'exact' })
            .order('document_date', { ascending: false })
            .range(offset, offset + parseInt(limit) - 1);
        if (supplier_id)   q = q.eq('supplier_id', supplier_id);
        if (document_type) q = q.eq('document_type', document_type);

        const { data, error, count } = await q;
        if (error) throw error;
        res.json({
            success: true,
            data,
            pagination: { page: parseInt(page), limit: parseInt(limit), total: count, totalPages: Math.ceil((count || 0) / parseInt(limit)) }
        });
    } catch (err) {
        console.error('GET inv_entries error:', err);
        res.status(500).json({ error: err.message || 'Erro ao listar entradas' });
    }
});

// GET /:id — detalhe
router.get('/:id', requirePermission('inventory', 'read'), async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('inv_entries')
            .select(ENTRY_SELECT)
            .eq('id', req.params.id)
            .single();
        if (error || !data) return res.status(404).json({ error: 'Entrada não encontrada' });
        res.json({ success: true, data });
    } catch (err) {
        console.error('GET inv_entries/:id error:', err);
        res.status(500).json({ error: err.message || 'Erro ao obter entrada' });
    }
});

// POST / — cria entrada com linhas
// Body: { document_type, document_number, document_date, supplier_id, notes, lines: [{ item_id, purchase_qty, conversion_factor, unit_cost, location_id, lot_number?, expiry_date?, ... }] }
router.post('/', requirePermission('inventory', 'entry'), async (req, res) => {
    try {
        const { document_type, document_number, document_date, supplier_id, notes, lines } = req.body;

        if (!document_type || !VALID_DOC_TYPES.includes(document_type))
            return res.status(400).json({ error: `document_type deve ser um de: ${VALID_DOC_TYPES.join(', ')}` });
        if (!document_number) return res.status(400).json({ error: 'document_number é obrigatório' });
        if (!document_date)   return res.status(400).json({ error: 'document_date é obrigatório' });
        if (!supplier_id)     return res.status(400).json({ error: 'supplier_id é obrigatório' });
        if (!Array.isArray(lines) || lines.length === 0)
            return res.status(400).json({ error: 'Pelo menos uma linha é obrigatória' });

        // Validação básica das linhas
        for (const [idx, l] of lines.entries()) {
            if (!l.item_id)        return res.status(400).json({ error: `Linha ${idx + 1}: item_id é obrigatório` });
            if (!l.location_id)    return res.status(400).json({ error: `Linha ${idx + 1}: location_id é obrigatório` });
            if (!(l.purchase_qty > 0))
                return res.status(400).json({ error: `Linha ${idx + 1}: purchase_qty deve ser > 0` });
            if (!(l.unit_cost >= 0))
                return res.status(400).json({ error: `Linha ${idx + 1}: unit_cost deve ser >= 0` });
        }

        // Fronteira de macro: esta entrada é só de CONSUMO. Bloqueia itens
        // patrimoniais mesmo que a chamada venha direto à API — a tela é só UX,
        // o controle é aqui. (Patrimônio entra por Patrimônio › Entrada.)
        const itemIds = [...new Set(lines.map(l => l.item_id))];
        const { data: itemsMeta, error: metaErr } = await supabaseAdmin
            .from('inv_items').select('id, name, macro_category').in('id', itemIds);
        if (metaErr) throw metaErr;
        const metaById = new Map((itemsMeta || []).map(i => [i.id, i]));
        for (const [idx, l] of lines.entries()) {
            const m = metaById.get(l.item_id);
            if (!m) return res.status(400).json({ error: `Linha ${idx + 1}: item não encontrado` });
            if (m.macro_category !== 'consumo')
                return res.status(400).json({ error: `Linha ${idx + 1}: "${m.name}" é patrimonial — use Patrimônio › Entrada` });
        }

        // 1) Cria cabeçalho
        const { data: entry, error: entryErr } = await supabaseAdmin
            .from('inv_entries')
            .insert({
                document_type, document_number: document_number.trim(),
                document_date, supplier_id, notes: notes || null,
                user_id: req.user?.id || null
            })
            .select()
            .single();

        if (entryErr) {
            if (entryErr.code === '23505') return res.status(409).json({ error: 'Documento já registado para este fornecedor' });
            throw entryErr;
        }

        // 2) Insere linhas — triggers recalculam CMP, geram movimentos, atualizam stock
        const linesPayload = lines.map(l => ({
            entry_id:           entry.id,
            item_id:            l.item_id,
            purchase_qty:       l.purchase_qty,
            conversion_factor:  l.conversion_factor || 1,
            unit_cost:          l.unit_cost,
            location_id:        l.location_id,
            lot_number:         l.lot_number || null,
            manufacture_date:   l.manufacture_date || null,
            expiry_date:        l.expiry_date || null,
            serial_number:      l.serial_number || null
        }));

        const { error: linesErr } = await supabaseAdmin
            .from('inv_entry_lines')
            .insert(linesPayload);

        if (linesErr) {
            // Compensação manual: remove cabeçalho órfão
            await supabaseAdmin.from('inv_entries').delete().eq('id', entry.id);
            // Mensagens dos triggers de RN
            if (linesErr.message && /controla lote/i.test(linesErr.message))
                return res.status(400).json({ error: linesErr.message });
            throw linesErr;
        }

        // 3) Retorna entrada completa
        const { data: full } = await supabaseAdmin
            .from('inv_entries')
            .select(ENTRY_SELECT)
            .eq('id', entry.id)
            .single();

        res.status(201).json({ success: true, data: full });
    } catch (err) {
        console.error('POST inv_entries error:', err);
        res.status(500).json({ error: err.message || 'Erro ao registar entrada' });
    }
});

// POST /:id/cancel — inativa uma entrada inteira (cancela todos os movimentos
// type=entrada derivados dela). Admin only. Body: { reason: string >= 5 chars }
const { requireRole } = require('../middleware/auth');
const ADMIN_ROLES = ['Inventory_Admin', 'Admin', 'admin'];

router.post('/:id/cancel', requireRole(ADMIN_ROLES), async (req, res) => {
    try {
        const { reason } = req.body || {};
        if (!reason || String(reason).trim().length < 5) {
            return res.status(400).json({ error: 'Motivo é obrigatório (mínimo 5 caracteres)' });
        }
        const { data, error } = await supabaseAdmin.rpc('fn_inv_cancel_entry', {
            p_entry_id: req.params.id,
            p_user_id:  req.user?.id || null,
            p_reason:   reason
        });
        if (error) {
            if (error.code === '22023') return res.status(400).json({ error: error.message });
            if (error.code === '02000') return res.status(404).json({ error: error.message });
            if (error.code === 'P0001') return res.status(400).json({ error: error.message });
            if (error.code === 'P0002') return res.status(409).json({ error: error.message });
            throw error;
        }
        res.json({ success: true, data: { cancelled_count: data } });
    } catch (err) {
        console.error('POST inv_entries/:id/cancel error:', err);
        res.status(500).json({ error: err.message || 'Erro ao cancelar entrada' });
    }
});

module.exports = router;
