const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { requirePermission } = require('../middleware/auth');

const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const VALID_MACROS = ['consumo','patrimonial'];
const VALID_WINDOWS = [30, 60, 90, 180, 365];

router.get('/', requirePermission('inventory', 'read'), async (req, res) => {
    try {
        const { parent_macro, include_inactive } = req.query;
        let q = supabaseAdmin
            .from('inv_categories')
            .select('*')
            .is('deleted_at', null)
            .order('parent_macro', { ascending: true })
            .order('name', { ascending: true });
        if (parent_macro) q = q.eq('parent_macro', parent_macro);
        if (!include_inactive) q = q.eq('is_active', true);

        const { data, error } = await q;
        if (error) throw error;
        res.json({ success: true, data });
    } catch (err) {
        console.error('GET inv_categories error:', err);
        res.status(500).json({ error: err.message || 'Erro ao listar categorias' });
    }
});

router.post('/', requirePermission('inventory', 'create_item'), async (req, res) => {
    try {
        const { parent_macro, name, is_active = true, consumption_window_days = 30 } = req.body;
        if (!parent_macro || !name) return res.status(400).json({ error: 'parent_macro e name são obrigatórios' });
        if (!VALID_MACROS.includes(parent_macro)) return res.status(400).json({ error: 'parent_macro inválido' });
        if (!VALID_WINDOWS.includes(parseInt(consumption_window_days)))
            return res.status(400).json({ error: `consumption_window_days deve ser um de: ${VALID_WINDOWS.join(', ')}` });

        const { data, error } = await supabaseAdmin
            .from('inv_categories')
            .insert({ parent_macro, name: name.trim(), is_active, consumption_window_days: parseInt(consumption_window_days) })
            .select()
            .single();
        if (error) throw error;
        res.status(201).json({ success: true, data });
    } catch (err) {
        console.error('POST inv_categories error:', err);
        if (err.code === '23505') return res.status(409).json({ error: 'Já existe subcategoria com esse nome' });
        res.status(500).json({ error: err.message || 'Erro ao criar categoria' });
    }
});

router.put('/:id', requirePermission('inventory', 'update_item'), async (req, res) => {
    try {
        const { id } = req.params;
        const { name, is_active, consumption_window_days } = req.body;
        const patch = {};
        if (name !== undefined) patch.name = name.trim();
        if (is_active !== undefined) patch.is_active = !!is_active;
        if (consumption_window_days !== undefined) {
            if (!VALID_WINDOWS.includes(parseInt(consumption_window_days)))
                return res.status(400).json({ error: `consumption_window_days deve ser um de: ${VALID_WINDOWS.join(', ')}` });
            patch.consumption_window_days = parseInt(consumption_window_days);
        }
        const { data, error } = await supabaseAdmin
            .from('inv_categories')
            .update(patch)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        res.json({ success: true, data });
    } catch (err) {
        console.error('PUT inv_categories error:', err);
        res.status(500).json({ error: err.message || 'Erro ao atualizar categoria' });
    }
});

router.delete('/:id', requirePermission('inventory', 'update_item'), async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabaseAdmin
            .from('inv_categories')
            .update({ deleted_at: new Date().toISOString(), is_active: false })
            .eq('id', id);
        if (error) throw error;
        res.json({ success: true });
    } catch (err) {
        console.error('DELETE inv_categories error:', err);
        res.status(500).json({ error: err.message || 'Erro ao remover categoria' });
    }
});

module.exports = router;
