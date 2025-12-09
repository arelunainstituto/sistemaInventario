const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { requirePermission } = require('../middleware/auth');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// GET / - Listar ausências
router.get('/', requirePermission('HR', 'read_own'), async (req, res) => {
    try {
        const { page = 1, limit = 50, status, type, employee_id } = req.query;
        const offset = (page - 1) * limit;
        const requestingUserId = req.user.id;
        const userRoles = req.user.roles || [];
        const isManager = userRoles.includes('Admin') || userRoles.includes('rh_manager');

        let query = supabase
            .from('rh_absences')
            .select('*, rh_employees(name, department)', { count: 'exact' });

        if (!isManager) {
            const { data: profile } = await supabase
                .from('rh_profiles')
                .select('employee_id')
                .eq('id', requestingUserId)
                .single();

            if (!profile) return res.status(403).json({ error: 'Perfil não encontrado' });
            query = query.eq('employee_id', profile.employee_id);
        } else if (employee_id) {
            query = query.eq('employee_id', employee_id);
        }

        if (status) query = query.eq('status', status);
        if (type) query = query.eq('type', type);

        query = query
            .order('start_date', { ascending: false })
            .range(offset, offset + limit - 1);

        const { data, error, count } = await query;

        if (error) throw error;

        res.json({
            data,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: count,
                totalPages: Math.ceil(count / limit)
            }
        });
    } catch (error) {
        console.error('Erro ao listar ausências:', error);
        res.status(500).json({ error: 'Erro interno' });
    }
});

// POST / - Solicitar ausência
router.post('/', requirePermission('HR', 'request_absence'), async (req, res) => {
    try {
        const { employee_id, type, start_date, end_date, reason } = req.body;

        // Calcular dias (simplificado)
        const start = new Date(start_date);
        const end = new Date(end_date);
        const diffTime = Math.abs(end - start);
        const days_count = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

        const { data, error } = await supabase
            .from('rh_absences')
            .insert([{
                employee_id,
                type,
                start_date,
                end_date,
                days_count,
                reason,
                status: 'PENDING',
                created_by: req.user.id
            }])
            .select()
            .single();

        if (error) throw error;

        res.status(201).json(data);
    } catch (error) {
        console.error('Erro ao solicitar ausência:', error);
        res.status(500).json({ error: 'Erro interno' });
    }
});

// PUT /:id/approve - Aprovar ausência
router.put('/:id/approve', requirePermission('HR', 'approve_absences'), async (req, res) => {
    try {
        const { id } = req.params;

        // 1. Buscar ausência
        const { data: absence, error: fetchError } = await supabase
            .from('rh_absences')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError) throw fetchError;

        // 2. Se for férias, verificar saldo (TODO: Implementar verificação real)
        if (absence.type === 'FERIAS') {
            // Verificar saldo na tabela rh_vacation_balance
        }

        // 3. Aprovar
        const { data, error } = await supabase
            .from('rh_absences')
            .update({
                status: 'APPROVED',
                approved_by: req.user.id,
                approved_at: new Date()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        res.json(data);
    } catch (error) {
        console.error('Erro ao aprovar ausência:', error);
        res.status(500).json({ error: 'Erro interno' });
    }
});

// PUT /:id/reject - Rejeitar ausência
router.put('/:id/reject', requirePermission('HR', 'approve_absences'), async (req, res) => {
    try {
        const { id } = req.params;
        const { rejection_reason } = req.body;

        const { data, error } = await supabase
            .from('rh_absences')
            .update({
                status: 'REJECTED',
                rejection_reason,
                approved_by: req.user.id, // Quem rejeitou
                approved_at: new Date()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        res.json(data);
    } catch (error) {
        console.error('Erro ao rejeitar ausência:', error);
        res.status(500).json({ error: 'Erro interno' });
    }
});

module.exports = router;
