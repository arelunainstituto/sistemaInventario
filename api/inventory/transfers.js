const express = require('express');
const router = express.Router();
const { requirePermission } = require('../middleware/auth');
const { supabaseAdmin, parsePgException } = require('./_stock');

const MOVEMENT_SELECT = `
    id, type, subtype, quantity, cmp_at_moment, justification, occurred_at,
    item:inv_items!item_id(id, name, internal_code, macro_category),
    lot:inv_lots!lot_id(id, lot_number, expiry_date),
    from_location:inv_locations!from_location_id(id, name, unit:inv_units!unit_id(id, name)),
    to_location:inv_locations!to_location_id(id, name, unit:inv_units!unit_id(id, name))
`;

// GET / — lista transferências (mostramos só transferencia_entrada, com from/to)
router.get('/', requirePermission('inventory', 'read'), async (req, res) => {
    try {
        const { item_id, limit = 50, page = 1 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        let q = supabaseAdmin
            .from('inv_movements')
            .select(MOVEMENT_SELECT, { count: 'exact' })
            // Patrimônio nunca usa transferencia_entrada (a movimentação grava um
            // único transferencia_saida), então este histórico já é só consumo.
            .eq('type', 'transferencia_entrada')
            .order('occurred_at', { ascending: false })
            .range(offset, offset + parseInt(limit) - 1);
        if (item_id) q = q.eq('item_id', item_id);

        const { data, error, count } = await q;
        if (error) throw error;
        res.json({
            success: true,
            data,
            pagination: { page: parseInt(page), limit: parseInt(limit), total: count, totalPages: Math.ceil((count || 0) / parseInt(limit)) }
        });
    } catch (err) {
        console.error('GET transfers error:', err);
        res.status(500).json({ error: err.message || 'Erro ao listar transferências' });
    }
});

// POST / — executar transferência
router.post('/', requirePermission('inventory', 'transfer'), async (req, res) => {
    try {
        const { item_id, from_location_id, to_location_id, quantity, lot_id, justification } = req.body;

        if (!item_id)          return res.status(400).json({ error: 'item_id é obrigatório' });
        if (!from_location_id) return res.status(400).json({ error: 'from_location_id é obrigatório' });
        if (!to_location_id)   return res.status(400).json({ error: 'to_location_id é obrigatório' });
        if (!(quantity > 0))   return res.status(400).json({ error: 'quantity deve ser > 0' });
        if (from_location_id === to_location_id)
            return res.status(400).json({ error: 'Localizações origem e destino não podem ser iguais' });

        // Fronteira de macro: transferência de stock de CONSUMO. Patrimônio é
        // movido pelo módulo Patrimônio › Movimentação — bloqueia aqui via API.
        const { data: itemMeta } = await supabaseAdmin
            .from('inv_items').select('name, macro_category').eq('id', item_id).single();
        if (!itemMeta) return res.status(400).json({ error: 'Item não encontrado' });
        if (itemMeta.macro_category !== 'consumo')
            return res.status(400).json({ error: `"${itemMeta.name}" é patrimonial — use Patrimônio › Movimentação` });

        const { data, error } = await supabaseAdmin.rpc('fn_inv_transfer', {
            p_item: item_id,
            p_from: from_location_id,
            p_to:   to_location_id,
            p_qty:  quantity,
            p_lot:  lot_id || null,
            p_justification: justification || null,
            p_user: req.user?.id || null
        });

        if (error) {
            if (error.code === 'P0002') return res.status(400).json({ error: error.message, code: 'INSUFFICIENT_STOCK' });
            if (error.code === 'P0001') return res.status(400).json({ error: error.message });
            throw error;
        }

        res.status(201).json({ success: true, data });
    } catch (err) {
        console.error('POST transfers error:', err);
        res.status(500).json({ error: err.message || 'Erro ao executar transferência' });
    }
});

// POST /batch — transferência de VÁRIOS itens, mesma origem/destino (atômico).
// Body: { from_location_id, to_location_id, justification?, lines: [{ item_id, quantity, lot_id? }] }
router.post('/batch', requirePermission('inventory', 'transfer'), async (req, res) => {
    try {
        const { from_location_id, to_location_id, justification, lines } = req.body || {};

        if (!from_location_id) return res.status(400).json({ error: 'from_location_id é obrigatório' });
        if (!to_location_id)   return res.status(400).json({ error: 'to_location_id é obrigatório' });
        if (from_location_id === to_location_id)
            return res.status(400).json({ error: 'Localizações origem e destino não podem ser iguais' });
        if (!Array.isArray(lines) || lines.length === 0)
            return res.status(400).json({ error: 'Pelo menos uma linha é obrigatória' });

        for (const [i, l] of lines.entries()) {
            if (!l.item_id)        return res.status(400).json({ error: `Linha ${i + 1}: item é obrigatório` });
            if (!(l.quantity > 0)) return res.status(400).json({ error: `Linha ${i + 1}: quantidade deve ser > 0` });
        }

        // Fronteira de macro: todas as linhas precisam ser de CONSUMO.
        const ids = [...new Set(lines.map(l => l.item_id))];
        const { data: metas } = await supabaseAdmin
            .from('inv_items').select('id, name, macro_category').in('id', ids);
        const byId = new Map((metas || []).map(m => [m.id, m]));
        for (const [i, l] of lines.entries()) {
            const m = byId.get(l.item_id);
            if (!m) return res.status(400).json({ error: `Linha ${i + 1}: item não encontrado` });
            if (m.macro_category !== 'consumo')
                return res.status(400).json({ error: `Linha ${i + 1}: "${m.name}" é patrimonial — use Patrimônio › Movimentação` });
        }

        const cleanLines = lines.map(l => ({
            item_id: l.item_id, quantity: l.quantity, lot_id: l.lot_id || null
        }));

        const { data, error } = await supabaseAdmin.rpc('fn_inv_transfer_batch', {
            p_from: from_location_id,
            p_to: to_location_id,
            p_lines: cleanLines,
            p_justification: justification || null,
            p_user: req.user?.id || null
        });

        if (error) {
            if (error.code === 'P0002') return res.status(400).json({ error: error.message, code: 'INSUFFICIENT_STOCK' });
            if (error.code === 'P0001') return res.status(400).json({ error: error.message });
            throw error;
        }

        res.status(201).json({ success: true, data: { count: Array.isArray(data) ? data.length : 0, results: data } });
    } catch (err) {
        console.error('POST transfers/batch error:', err);
        res.status(500).json({ error: err.message || 'Erro ao executar transferência' });
    }
});

module.exports = router;
