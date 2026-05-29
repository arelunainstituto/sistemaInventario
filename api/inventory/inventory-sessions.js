const express = require('express');
const router = express.Router();
const { requirePermission } = require('../middleware/auth');
const { supabaseAdmin } = require('./_stock');

const SESSION_SELECT = `
    *,
    location:inv_locations!location_id(id, name, unit:inv_units!unit_id(id, name))
`;

const COUNT_SELECT = `
    *,
    item:inv_items!item_id(id, internal_code, name, controls_lot, macro_category),
    lot:inv_lots!lot_id(id, lot_number, expiry_date)
`;

// GET / — lista sessões
router.get('/', requirePermission('inventory', 'read'), async (req, res) => {
    try {
        const { status, location_id, limit = 50 } = req.query;
        let q = supabaseAdmin
            .from('inv_inventory_sessions')
            .select(SESSION_SELECT)
            .order('opened_at', { ascending: false })
            .limit(parseInt(limit));
        if (status)      q = q.eq('status', status);
        if (location_id) q = q.eq('location_id', location_id);
        const { data, error } = await q;
        if (error) throw error;
        res.json({ success: true, data });
    } catch (err) {
        console.error('GET inventory-sessions error:', err);
        res.status(500).json({ error: err.message || 'Erro ao listar sessões' });
    }
});

// GET /:id — detalhe + contagens
router.get('/:id', requirePermission('inventory', 'read'), async (req, res) => {
    try {
        const { data: session, error } = await supabaseAdmin
            .from('inv_inventory_sessions')
            .select(SESSION_SELECT)
            .eq('id', req.params.id)
            .single();
        if (error || !session) return res.status(404).json({ error: 'Sessão não encontrada' });

        const { data: counts } = await supabaseAdmin
            .from('inv_inventory_counts')
            .select(COUNT_SELECT)
            .eq('session_id', req.params.id)
            .order('item_id');

        res.json({ success: true, data: { ...session, counts: counts || [] } });
    } catch (err) {
        console.error('GET inventory-session/:id error:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST / — abrir nova sessão
router.post('/', requirePermission('inventory', 'inventory_session'), async (req, res) => {
    try {
        const { location_id, notes } = req.body;
        if (!location_id) return res.status(400).json({ error: 'location_id é obrigatório' });

        const { data: session_id, error } = await supabaseAdmin.rpc('fn_inv_open_session', {
            p_location: location_id,
            p_user:     req.user?.id || null,
            p_notes:    notes || null
        });
        if (error) {
            if (error.code === '23505') return res.status(409).json({ error: 'Já existe sessão aberta para esta localização' });
            throw error;
        }
        res.status(201).json({ success: true, data: { session_id } });
    } catch (err) {
        console.error('POST inventory-sessions error:', err);
        res.status(500).json({ error: err.message || 'Erro ao abrir sessão' });
    }
});

// PATCH /:id/counts — atualizar contagens em lote
// body: { counts: [{ count_id, counted_qty, notes? }, ...] }
router.patch('/:id/counts', requirePermission('inventory', 'inventory_session'), async (req, res) => {
    try {
        const { counts } = req.body;
        if (!Array.isArray(counts) || counts.length === 0)
            return res.status(400).json({ error: 'Envie counts: [{ count_id, counted_qty, notes? }]' });

        const errors = [];
        for (const c of counts) {
            if (!c.count_id || c.counted_qty === undefined || c.counted_qty === null) {
                errors.push({ count_id: c.count_id, error: 'count_id e counted_qty são obrigatórios' });
                continue;
            }
            const { error } = await supabaseAdmin.rpc('fn_inv_update_count', {
                p_count_id: c.count_id,
                p_counted:  c.counted_qty,
                p_notes:    c.notes || null,
                p_user:     req.user?.id || null
            });
            if (error) errors.push({ count_id: c.count_id, error: error.message });
        }
        res.json({ success: errors.length === 0, updated: counts.length - errors.length, errors });
    } catch (err) {
        console.error('PATCH counts error:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /:id/counts — adicionar linha de contagem (item que apareceu fora do snapshot)
router.post('/:id/counts', requirePermission('inventory', 'inventory_session'), async (req, res) => {
    try {
        const { item_id, lot_id, counted_qty } = req.body;
        if (!item_id || counted_qty === undefined)
            return res.status(400).json({ error: 'item_id e counted_qty são obrigatórios' });

        const { data, error } = await supabaseAdmin.rpc('fn_inv_add_count_line', {
            p_session_id: req.params.id,
            p_item_id:    item_id,
            p_lot_id:     lot_id || null,
            p_counted:    counted_qty,
            p_user:       req.user?.id || null
        });
        if (error) throw error;
        res.status(201).json({ success: true, data: { count_id: data } });
    } catch (err) {
        console.error('POST count line error:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /:id/validate — encerrar e gerar ajustes
router.post('/:id/validate', requirePermission('inventory', 'inventory_session'), async (req, res) => {
    try {
        const { data: movements, error } = await supabaseAdmin.rpc('fn_inv_close_session', {
            p_session_id: req.params.id,
            p_user:       req.user?.id || null
        });
        if (error) {
            if (error.code === '22023') return res.status(400).json({ error: error.message });
            throw error;
        }
        res.json({ success: true, data: { adjustments_generated: movements } });
    } catch (err) {
        console.error('POST validate session error:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /:id/cancel — cancelar sessão sem gerar ajustes
router.post('/:id/cancel', requirePermission('inventory', 'inventory_session'), async (req, res) => {
    try {
        const { error } = await supabaseAdmin.rpc('fn_inv_cancel_session', {
            p_session_id: req.params.id,
            p_user:       req.user?.id || null
        });
        if (error) {
            if (error.code === '22023') return res.status(400).json({ error: error.message });
            throw error;
        }
        res.json({ success: true });
    } catch (err) {
        console.error('POST cancel session error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
