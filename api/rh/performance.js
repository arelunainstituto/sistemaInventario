const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { requirePermission } = require('../middleware/auth');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// GET / - Listar avaliações
router.get('/', requirePermission('HR', 'read_own'), async (req, res) => {
    try {
        const { page = 1, limit = 50, employee_id, status } = req.query;
        const offset = (page - 1) * limit;
        const requestingUserId = req.user.id;
        const userRoles = req.user.roles || [];
        const isManager = userRoles.includes('Admin') || userRoles.includes('rh_manager');

        let query = supabase
            .from('rh_performance_reviews')
            .select('*, rh_employees(name, department, role), reviewer:reviewer_id(email)', { count: 'exact' });

        if (!isManager) {
            const { data: profile } = await supabase
                .from('rh_profiles')
                .select('employee_id')
                .eq('id', requestingUserId)
                .single();

            if (!profile) return res.status(403).json({ error: 'Acesso negado' });
            query = query.eq('employee_id', profile.employee_id).eq('status', 'COMPLETED'); // Funcionário só vê finalizadas
        } else if (employee_id) {
            query = query.eq('employee_id', employee_id);
        }

        if (status) query = query.eq('status', status);

        query = query
            .order('review_period_end', { ascending: false })
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
        console.error('Erro ao listar avaliações:', error);
        res.status(500).json({ error: 'Erro interno' });
    }
});

// POST / - Criar avaliação
router.post('/', requirePermission('HR', 'manage_reviews'), async (req, res) => {
    try {
        const {
            employee_id,
            review_type,
            review_period_start,
            review_period_end,
            productivity_score,
            quality_score,
            teamwork_score,
            punctuality_score,
            initiative_score,
            communication_score,
            strengths,
            areas_for_improvement,
            goals,
            comments,
            status
        } = req.body;

        // Calcular média
        const scores = [productivity_score, quality_score, teamwork_score, punctuality_score, initiative_score, communication_score].filter(s => s !== undefined && s !== null);
        const overall_score = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

        const { data, error } = await supabase
            .from('rh_performance_reviews')
            .insert([{
                employee_id,
                reviewer_id: req.user.id,
                review_type,
                review_period_start,
                review_period_end,
                productivity_score,
                quality_score,
                teamwork_score,
                punctuality_score,
                initiative_score,
                communication_score,
                overall_score,
                strengths,
                areas_for_improvement,
                goals,
                comments,
                status: status || 'DRAFT'
            }])
            .select()
            .single();

        if (error) throw error;

        res.status(201).json(data);
    } catch (error) {
        console.error('Erro ao criar avaliação:', error);
        res.status(500).json({ error: 'Erro interno' });
    }
});

// PUT /:id - Atualizar avaliação
router.put('/:id', requirePermission('HR', 'manage_reviews'), async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        // Recalcular média se necessário
        if (updates.productivity_score || updates.quality_score) {
            // Lógica simplificada, idealmente buscaria os valores atuais se parciais
            // Aqui assumimos que o frontend envia tudo ou recalculamos no front
        }

        const { data, error } = await supabase
            .from('rh_performance_reviews')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        res.json(data);
    } catch (error) {
        console.error('Erro ao atualizar avaliação:', error);
        res.status(500).json({ error: 'Erro interno' });
    }
});

module.exports = router;
