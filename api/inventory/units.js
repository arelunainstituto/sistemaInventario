const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { requirePermission } = require('../middleware/auth');

const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// GET / — lista unidades
router.get('/', requirePermission('inventory', 'read'), async (req, res) => {
    try {
        const { include_inactive } = req.query;
        let query = supabaseAdmin
            .from('inv_units')
            .select('*')
            .is('deleted_at', null)
            .order('name', { ascending: true });
        if (!include_inactive) query = query.eq('is_active', true);

        const { data, error } = await query;
        if (error) throw error;
        res.json({ success: true, data });
    } catch (err) {
        console.error('GET inv_units error:', err);
        res.status(500).json({ error: err.message || 'Erro ao listar unidades' });
    }
});

// POST / — cria unidade
router.post('/', requirePermission('inventory', 'create_item'), async (req, res) => {
    try {
        const { code, name, is_active = true } = req.body;
        if (!code || !name) return res.status(400).json({ error: 'Campos code e name são obrigatórios' });

        const { data, error } = await supabaseAdmin
            .from('inv_units')
            .insert({ code: code.trim().toUpperCase(), name: name.trim(), is_active })
            .select()
            .single();
        if (error) throw error;
        res.status(201).json({ success: true, data });
    } catch (err) {
        console.error('POST inv_units error:', err);
        if (err.code === '23505') return res.status(409).json({ error: 'Já existe unidade com esse código' });
        res.status(500).json({ error: err.message || 'Erro ao criar unidade' });
    }
});

// PUT /:id — edita
router.put('/:id', requirePermission('inventory', 'update_item'), async (req, res) => {
    try {
        const { id } = req.params;
        const { name, is_active } = req.body;
        const patch = {};
        if (name !== undefined)       patch.name = name.trim();
        if (is_active !== undefined)  patch.is_active = !!is_active;

        const { data, error } = await supabaseAdmin
            .from('inv_units')
            .update(patch)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        res.json({ success: true, data });
    } catch (err) {
        console.error('PUT inv_units error:', err);
        res.status(500).json({ error: err.message || 'Erro ao atualizar unidade' });
    }
});

// DELETE /:id — soft delete
router.delete('/:id', requirePermission('inventory', 'update_item'), async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabaseAdmin
            .from('inv_units')
            .update({ deleted_at: new Date().toISOString(), is_active: false })
            .eq('id', id);
        if (error) throw error;
        res.json({ success: true });
    } catch (err) {
        console.error('DELETE inv_units error:', err);
        res.status(500).json({ error: err.message || 'Erro ao remover unidade' });
    }
});

module.exports = router;
