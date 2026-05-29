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

module.exports = router;
