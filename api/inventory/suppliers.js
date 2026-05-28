const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { requirePermission } = require('../middleware/auth');

const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

router.get('/', requirePermission('inventory', 'read'), async (req, res) => {
    try {
        const { search, include_inactive } = req.query;
        let q = supabaseAdmin
            .from('inv_suppliers')
            .select('*')
            .is('deleted_at', null)
            .order('name', { ascending: true });
        if (!include_inactive) q = q.eq('is_active', true);
        if (search) q = q.ilike('name', `%${search}%`);

        const { data, error } = await q;
        if (error) throw error;
        res.json({ success: true, data });
    } catch (err) {
        console.error('GET inv_suppliers error:', err);
        res.status(500).json({ error: err.message || 'Erro ao listar fornecedores' });
    }
});

router.post('/', requirePermission('inventory', 'create_item'), async (req, res) => {
    try {
        const { name, tax_id, email, phone, address, notes, is_active = true } = req.body;
        if (!name) return res.status(400).json({ error: 'name é obrigatório' });

        const { data, error } = await supabaseAdmin
            .from('inv_suppliers')
            .insert({
                name: name.trim(),
                tax_id: tax_id ? tax_id.trim() : null,
                email: email ? email.trim() : null,
                phone: phone ? phone.trim() : null,
                address: address || null,
                notes: notes || null,
                is_active
            })
            .select()
            .single();
        if (error) throw error;
        res.status(201).json({ success: true, data });
    } catch (err) {
        console.error('POST inv_suppliers error:', err);
        if (err.code === '23505') return res.status(409).json({ error: 'Já existe fornecedor com esse identificador fiscal' });
        res.status(500).json({ error: err.message || 'Erro ao criar fornecedor' });
    }
});

router.put('/:id', requirePermission('inventory', 'update_item'), async (req, res) => {
    try {
        const { id } = req.params;
        const allowed = ['name','tax_id','email','phone','address','notes','is_active'];
        const patch = {};
        for (const k of allowed) {
            if (req.body[k] !== undefined) patch[k] = typeof req.body[k] === 'string' ? req.body[k].trim() : req.body[k];
        }
        const { data, error } = await supabaseAdmin
            .from('inv_suppliers')
            .update(patch)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        res.json({ success: true, data });
    } catch (err) {
        console.error('PUT inv_suppliers error:', err);
        res.status(500).json({ error: err.message || 'Erro ao atualizar fornecedor' });
    }
});

router.delete('/:id', requirePermission('inventory', 'update_item'), async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabaseAdmin
            .from('inv_suppliers')
            .update({ deleted_at: new Date().toISOString(), is_active: false })
            .eq('id', id);
        if (error) throw error;
        res.json({ success: true });
    } catch (err) {
        console.error('DELETE inv_suppliers error:', err);
        res.status(500).json({ error: err.message || 'Erro ao remover fornecedor' });
    }
});

module.exports = router;
