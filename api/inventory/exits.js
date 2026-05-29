const express = require('express');
const router = express.Router();
const { requirePermission } = require('../middleware/auth');
const { supabaseAdmin, getStockByItem, parsePgException } = require('./_stock');

const VALID_SUBTYPES = ['consumo','avaria','extravio','perda','quebra','depreciacao'];

const MOVEMENT_SELECT = `
    id, type, subtype, quantity, unit_cost, total_cost, cmp_at_moment,
    justification, occurred_at, created_at,
    item:inv_items!item_id(id, name, internal_code, macro_category),
    lot:inv_lots!lot_id(id, lot_number, expiry_date),
    from_location:inv_locations!from_location_id(id, name, unit:inv_units!unit_id(id, name))
`;

// GET /stock-by-item/:itemId — usado pela UI para mostrar stock disponível
router.get('/stock-by-item/:itemId', requirePermission('inventory', 'read'), async (req, res) => {
    try {
        const data = await getStockByItem(req.params.itemId);
        res.json({ success: true, data });
    } catch (err) {
        console.error('GET stock-by-item error:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET / — lista saídas (movements type='saida')
router.get('/', requirePermission('inventory', 'read'), async (req, res) => {
    try {
        const { item_id, location_id, subtype, from_date, to_date, limit = 50, page = 1 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        let q = supabaseAdmin
            .from('inv_movements')
            .select(MOVEMENT_SELECT, { count: 'exact' })
            .eq('type', 'saida')
            .order('occurred_at', { ascending: false })
            .range(offset, offset + parseInt(limit) - 1);
        if (item_id)     q = q.eq('item_id', item_id);
        if (location_id) q = q.eq('from_location_id', location_id);
        if (subtype)     q = q.eq('subtype', subtype);
        if (from_date)   q = q.gte('occurred_at', from_date);
        if (to_date)     q = q.lte('occurred_at', to_date);

        const { data, error, count } = await q;
        if (error) throw error;
        res.json({
            success: true,
            data,
            pagination: { page: parseInt(page), limit: parseInt(limit), total: count, totalPages: Math.ceil((count || 0) / parseInt(limit)) }
        });
    } catch (err) {
        console.error('GET exits error:', err);
        res.status(500).json({ error: err.message || 'Erro ao listar saídas' });
    }
});

// POST / — lançar saída
router.post('/', requirePermission('inventory', 'exit'), async (req, res) => {
    try {
        const { item_id, location_id, quantity, lot_id, subtype, justification, confirmed_low_stock } = req.body;

        if (!item_id)     return res.status(400).json({ error: 'item_id é obrigatório' });
        if (!location_id) return res.status(400).json({ error: 'location_id é obrigatório' });
        if (!(quantity > 0)) return res.status(400).json({ error: 'quantity deve ser > 0' });
        if (!subtype || !VALID_SUBTYPES.includes(subtype))
            return res.status(400).json({ error: `subtype deve ser um de: ${VALID_SUBTYPES.join(', ')}` });

        const { data, error } = await supabaseAdmin.rpc('fn_inv_consume', {
            p_item: item_id,
            p_location: location_id,
            p_qty: quantity,
            p_lot: lot_id || null,
            p_subtype: subtype,
            p_justification: justification || null,
            p_user: req.user?.id || null,
            p_confirmed_low_stock: !!confirmed_low_stock,
            p_movement_type: 'saida'
        });

        if (error) {
            const pg = parsePgException(error.message);
            if (pg && pg.code === 'LOW_STOCK_CONFIRMATION_REQUIRED') {
                return res.status(409).json({
                    error: 'Stock ficará abaixo do mínimo após esta saída',
                    code: 'LOW_STOCK_CONFIRMATION_REQUIRED',
                    details: pg.fields
                });
            }
            if (error.code === 'P0002') return res.status(400).json({ error: error.message, code: 'INSUFFICIENT_STOCK' });
            if (error.code === 'P0001') return res.status(400).json({ error: error.message });
            throw error;
        }

        res.status(201).json({ success: true, data: { movement_id: data } });
    } catch (err) {
        console.error('POST exits error:', err);
        res.status(500).json({ error: err.message || 'Erro ao lançar saída' });
    }
});

module.exports = router;
