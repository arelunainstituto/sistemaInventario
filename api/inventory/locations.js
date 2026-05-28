const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { requirePermission } = require('../middleware/auth');

const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const VALID_TYPES = ['gabinete','area_operacional','armazem','laboratorio','dispensa','outro'];

// GET / — lista localizações (com join na unidade)
router.get('/', requirePermission('inventory', 'read'), async (req, res) => {
    try {
        const { unit_id, include_inactive } = req.query;
        let q = supabaseAdmin
            .from('inv_locations')
            .select('*, unit:inv_units(id, code, name)')
            .is('deleted_at', null)
            .order('name', { ascending: true });
        if (unit_id) q = q.eq('unit_id', unit_id);
        if (!include_inactive) q = q.eq('is_active', true);

        const { data, error } = await q;
        if (error) throw error;
        res.json({ success: true, data });
    } catch (err) {
        console.error('GET inv_locations error:', err);
        res.status(500).json({ error: err.message || 'Erro ao listar localizações' });
    }
});

router.post('/', requirePermission('inventory', 'create_item'), async (req, res) => {
    try {
        const { unit_id, name, type, can_receive = true, can_send = true, is_active = true } = req.body;
        if (!unit_id || !name || !type) return res.status(400).json({ error: 'unit_id, name e type são obrigatórios' });
        if (!VALID_TYPES.includes(type)) return res.status(400).json({ error: `type inválido (use: ${VALID_TYPES.join(', ')})` });

        const { data, error } = await supabaseAdmin
            .from('inv_locations')
            .insert({ unit_id, name: name.trim(), type, can_receive, can_send, is_active })
            .select('*, unit:inv_units(id, code, name)')
            .single();
        if (error) throw error;
        res.status(201).json({ success: true, data });
    } catch (err) {
        console.error('POST inv_locations error:', err);
        if (err.code === '23505') return res.status(409).json({ error: 'Já existe localização com esse nome na unidade' });
        res.status(500).json({ error: err.message || 'Erro ao criar localização' });
    }
});

router.put('/:id', requirePermission('inventory', 'update_item'), async (req, res) => {
    try {
        const { id } = req.params;
        const { name, type, can_receive, can_send, is_active } = req.body;
        const patch = {};
        if (name !== undefined) patch.name = name.trim();
        if (type !== undefined) {
            if (!VALID_TYPES.includes(type)) return res.status(400).json({ error: `type inválido` });
            patch.type = type;
        }
        if (can_receive !== undefined) patch.can_receive = !!can_receive;
        if (can_send !== undefined)    patch.can_send    = !!can_send;
        if (is_active !== undefined)   patch.is_active   = !!is_active;

        const { data, error } = await supabaseAdmin
            .from('inv_locations')
            .update(patch)
            .eq('id', id)
            .select('*, unit:inv_units(id, code, name)')
            .single();
        if (error) throw error;
        res.json({ success: true, data });
    } catch (err) {
        console.error('PUT inv_locations error:', err);
        res.status(500).json({ error: err.message || 'Erro ao atualizar localização' });
    }
});

router.delete('/:id', requirePermission('inventory', 'update_item'), async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabaseAdmin
            .from('inv_locations')
            .update({ deleted_at: new Date().toISOString(), is_active: false })
            .eq('id', id);
        if (error) throw error;
        res.json({ success: true });
    } catch (err) {
        console.error('DELETE inv_locations error:', err);
        res.status(500).json({ error: err.message || 'Erro ao remover localização' });
    }
});

module.exports = router;
