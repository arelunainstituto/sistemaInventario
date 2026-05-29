const express = require('express');
const router = express.Router();
const { requirePermission, requireRole } = require('../middleware/auth');
const { supabaseAdmin } = require('./_stock');

router.get('/', requirePermission('inventory', 'read'), async (req, res) => {
    try {
        const { include_inactive } = req.query;
        let q = supabaseAdmin
            .from('inv_adjustment_reasons')
            .select('*')
            .order('label', { ascending: true });
        if (!include_inactive) q = q.eq('is_active', true);
        const { data, error } = await q;
        if (error) throw error;
        res.json({ success: true, data });
    } catch (err) {
        console.error('GET inv_adjustment_reasons error:', err);
        res.status(500).json({ error: err.message || 'Erro ao listar motivos' });
    }
});

router.post('/', requireRole(['Inventory_Admin', 'Admin', 'admin']), async (req, res) => {
    try {
        const { code, label, is_active = true } = req.body;
        if (!code || !label) return res.status(400).json({ error: 'code e label são obrigatórios' });
        const { data, error } = await supabaseAdmin
            .from('inv_adjustment_reasons')
            .insert({ code: code.trim().toLowerCase(), label: label.trim(), is_active })
            .select()
            .single();
        if (error) throw error;
        res.status(201).json({ success: true, data });
    } catch (err) {
        console.error('POST inv_adjustment_reasons error:', err);
        if (err.code === '23505') return res.status(409).json({ error: 'Já existe motivo com esse código' });
        res.status(500).json({ error: err.message || 'Erro ao criar motivo' });
    }
});

router.put('/:id', requireRole(['Inventory_Admin', 'Admin', 'admin']), async (req, res) => {
    try {
        const patch = {};
        if (req.body.label !== undefined)     patch.label = req.body.label.trim();
        if (req.body.is_active !== undefined) patch.is_active = !!req.body.is_active;
        const { data, error } = await supabaseAdmin
            .from('inv_adjustment_reasons')
            .update(patch)
            .eq('id', req.params.id)
            .select()
            .single();
        if (error) throw error;
        res.json({ success: true, data });
    } catch (err) {
        console.error('PUT inv_adjustment_reasons error:', err);
        res.status(500).json({ error: err.message || 'Erro ao atualizar motivo' });
    }
});

module.exports = router;
