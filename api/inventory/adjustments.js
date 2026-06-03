const express = require('express');
const router = express.Router();
const { requirePermission, requireRole } = require('../middleware/auth');
const { supabaseAdmin, parsePgException } = require('./_stock');

// F5.4: tela e endpoint de Ajustes restritos a Inventory_Admin/Admin
// para evitar mau uso e desvio de estoque por operadores.
const ADMIN_ROLES = ['Inventory_Admin','Admin','admin'];

const MOVEMENT_SELECT = `
    id, type, subtype, quantity, cmp_at_moment, justification, occurred_at,
    item:inv_items!item_id(id, name, internal_code, macro_category),
    lot:inv_lots!lot_id(id, lot_number, expiry_date),
    from_location:inv_locations!from_location_id(id, name, unit:inv_units!unit_id(id, name)),
    to_location:inv_locations!to_location_id(id, name, unit:inv_units!unit_id(id, name))
`;

router.get('/', requireRole(ADMIN_ROLES), async (req, res) => {
    try {
        const { item_id, limit = 50, page = 1 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        let q = supabaseAdmin
            .from('inv_movements')
            .select(MOVEMENT_SELECT, { count: 'exact' })
            .eq('type', 'ajuste')
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
        console.error('GET adjustments error:', err);
        res.status(500).json({ error: err.message || 'Erro ao listar ajustes' });
    }
});

router.post('/', requireRole(ADMIN_ROLES), async (req, res) => {
    try {
        const { item_id, location_id, lot_id, delta, reason_code, justification, force_negative } = req.body;

        if (!item_id)     return res.status(400).json({ error: 'item_id é obrigatório' });
        if (!location_id) return res.status(400).json({ error: 'location_id é obrigatório' });
        if (delta === undefined || delta === null || delta === 0)
            return res.status(400).json({ error: 'delta deve ser positivo ou negativo (não zero)' });
        if (!reason_code) return res.status(400).json({ error: 'reason_code é obrigatório' });
        if (!justification || !justification.trim())
            return res.status(400).json({ error: 'justification é obrigatório' });

        // req.user.roles vem do middleware authenticateToken como string[]
        const userRoles = Array.isArray(req.user?.roles) ? req.user.roles : [];

        const { data, error } = await supabaseAdmin.rpc('fn_inv_adjust', {
            p_item: item_id,
            p_location: location_id,
            p_lot: lot_id || null,
            p_delta: delta,
            p_reason_code: reason_code,
            p_justification: justification,
            p_user: req.user?.id || null,
            p_user_roles: userRoles,
            p_force_negative: !!force_negative
        });

        if (error) {
            const pg = parsePgException(error.message);
            if (pg && pg.code === 'NEGATIVE_STOCK_CONFIRMATION_REQUIRED') {
                return res.status(409).json({
                    error: 'Ajuste resultará em stock negativo — confirmação dupla necessária',
                    code: 'NEGATIVE_STOCK_CONFIRMATION_REQUIRED',
                    details: pg.fields
                });
            }
            if (error.code === '42501') return res.status(403).json({ error: error.message });
            if (error.code === '22023') return res.status(400).json({ error: error.message });
            throw error;
        }

        res.status(201).json({ success: true, data: { movement_id: data } });
    } catch (err) {
        console.error('POST adjustments error:', err);
        res.status(500).json({ error: err.message || 'Erro ao executar ajuste' });
    }
});

module.exports = router;
