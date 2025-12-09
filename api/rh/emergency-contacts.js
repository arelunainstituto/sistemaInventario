const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { requirePermission } = require('../middleware/auth');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// GET /:employeeId - Listar contactos de emergência de um funcionário
router.get('/employee/:employeeId', async (req, res) => {
    try {
        const { employeeId } = req.params;
        const requestingUserId = req.user.id;
        const userRoles = req.user.roles || [];
        const isManager = userRoles.includes('Admin') || userRoles.includes('rh_manager');

        // Verificar permissão
        if (!isManager) {
            const { data: profile } = await supabase
                .from('rh_profiles')
                .select('employee_id')
                .eq('id', requestingUserId)
                .single();

            if (!profile || profile.employee_id !== employeeId) {
                return res.status(403).json({ error: 'Acesso negado' });
            }
        }

        const { data, error } = await supabase
            .from('rh_emergency_contacts')
            .select('*')
            .eq('employee_id', employeeId)
            .order('is_primary', { ascending: false });

        if (error) throw error;

        res.json(data);
    } catch (error) {
        console.error('Erro ao listar contactos de emergência:', error);
        res.status(500).json({ error: 'Erro interno' });
    }
});

// POST / - Criar contacto
router.post('/', async (req, res) => {
    try {
        const { employee_id, name, relationship, phone, alternative_phone, is_primary, medical_notes } = req.body;
        const requestingUserId = req.user.id;
        const userRoles = req.user.roles || [];
        const isManager = userRoles.includes('Admin') || userRoles.includes('rh_manager');

        // Verificar permissão
        if (!isManager) {
            const { data: profile } = await supabase
                .from('rh_profiles')
                .select('employee_id')
                .eq('id', requestingUserId)
                .single();

            if (!profile || profile.employee_id !== employee_id) {
                return res.status(403).json({ error: 'Acesso negado' });
            }
        }

        const { data, error } = await supabase
            .from('rh_emergency_contacts')
            .insert([{
                employee_id,
                name,
                relationship,
                phone,
                alternative_phone,
                is_primary: is_primary || false,
                medical_notes
            }])
            .select()
            .single();

        if (error) throw error;

        res.status(201).json(data);
    } catch (error) {
        console.error('Erro ao criar contacto de emergência:', error);
        res.status(500).json({ error: 'Erro interno' });
    }
});

// PUT /:id - Atualizar contacto
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        const requestingUserId = req.user.id;
        const userRoles = req.user.roles || [];
        const isManager = userRoles.includes('Admin') || userRoles.includes('rh_manager');

        // Verificar permissão (precisamos saber de quem é o contacto primeiro)
        if (!isManager) {
            const { data: contact } = await supabase
                .from('rh_emergency_contacts')
                .select('employee_id')
                .eq('id', id)
                .single();

            if (!contact) return res.status(404).json({ error: 'Contacto não encontrado' });

            const { data: profile } = await supabase
                .from('rh_profiles')
                .select('employee_id')
                .eq('id', requestingUserId)
                .single();

            if (!profile || profile.employee_id !== contact.employee_id) {
                return res.status(403).json({ error: 'Acesso negado' });
            }
        }

        // Remover campos protegidos
        delete updates.id;
        delete updates.employee_id;
        delete updates.created_at;

        const { data, error } = await supabase
            .from('rh_emergency_contacts')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        res.json(data);
    } catch (error) {
        console.error('Erro ao atualizar contacto de emergência:', error);
        res.status(500).json({ error: 'Erro interno' });
    }
});

// DELETE /:id - Remover contacto
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const requestingUserId = req.user.id;
        const userRoles = req.user.roles || [];
        const isManager = userRoles.includes('Admin') || userRoles.includes('rh_manager');

        // Verificar permissão
        if (!isManager) {
            const { data: contact } = await supabase
                .from('rh_emergency_contacts')
                .select('employee_id')
                .eq('id', id)
                .single();

            if (!contact) return res.status(404).json({ error: 'Contacto não encontrado' });

            const { data: profile } = await supabase
                .from('rh_profiles')
                .select('employee_id')
                .eq('id', requestingUserId)
                .single();

            if (!profile || profile.employee_id !== contact.employee_id) {
                return res.status(403).json({ error: 'Acesso negado' });
            }
        }

        const { error } = await supabase
            .from('rh_emergency_contacts')
            .delete()
            .eq('id', id);

        if (error) throw error;

        res.json({ message: 'Contacto removido com sucesso' });
    } catch (error) {
        console.error('Erro ao remover contacto de emergência:', error);
        res.status(500).json({ error: 'Erro interno' });
    }
});

module.exports = router;
