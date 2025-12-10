const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { requirePermission } = require('../middleware/auth');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// GET / - Listar folhas de pagamento
router.get('/', requirePermission('HR', 'read_own'), async (req, res) => {
    try {
        const { page = 1, limit = 50, month, year, employee_id } = req.query;
        const offset = (page - 1) * limit;
        const requestingUserId = req.user.id;
        const userRoles = req.user.roles || [];
        const isManager = userRoles.includes('Admin') || userRoles.includes('rh_manager');

        let query = supabase
            .from('rh_payrolls')
            .select('*, rh_employees(name, department, role)', { count: 'exact' });

        // Se não for gerente, filtrar apenas próprios
        if (!isManager) {
            const { data: profile } = await supabase
                .from('rh_profiles')
                .select('employee_id')
                .eq('id', requestingUserId)
                .single();

            if (!profile) return res.status(403).json({ error: 'Perfil de funcionário não encontrado' });
            query = query.eq('employee_id', profile.employee_id);
        } else if (employee_id) {
            query = query.eq('employee_id', employee_id);
        }

        if (month) query = query.eq('period_month', month);
        if (year) query = query.eq('period_year', year);

        query = query
            .order('period_year', { ascending: false })
            .order('period_month', { ascending: false })
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
        console.error('Erro ao listar folhas de pagamento:', error);
        res.status(500).json({ error: 'Erro interno' });
    }
});

// POST / - Criar/Calcular folha
router.post('/', requirePermission('HR', 'payroll_process'), async (req, res) => {
    try {
        const { employee_id, period_month, period_year, base_salary, overtime_hours, overtime_value, bonus, other_discounts, inss_discount, irrf_discount, currency } = req.body;

        const gross_salary = parseFloat(base_salary) + parseFloat(overtime_value || 0) + parseFloat(bonus || 0);

        // Use provided tax values or calculate estimates
        const inss = inss_discount !== undefined ? parseFloat(inss_discount) : (gross_salary * 0.11);
        const irrf = irrf_discount !== undefined ? parseFloat(irrf_discount) : ((gross_salary - inss) * 0.075);

        const total_discounts = inss + irrf + parseFloat(other_discounts || 0);
        const net_salary = gross_salary - total_discounts;

        const { data, error } = await supabase
            .from('rh_payrolls')
            .insert([{
                employee_id,
                period_month,
                period_year,
                base_salary,
                overtime_hours: overtime_hours || 0,
                overtime_value: overtime_value || 0,
                bonus: bonus || 0,
                inss_discount: inss,
                irrf_discount: irrf,
                other_discounts: other_discounts || 0,
                net_salary,
                currency: currency || 'EUR',
                status: 'DRAFT',
                created_by: req.user.id
            }])
            .select()
            .single();

        if (error) throw error;

        res.status(201).json(data);
    } catch (error) {
        console.error('Erro ao criar folha:', error);
        res.status(500).json({ error: 'Erro interno ao criar folha' });
    }
});

// PUT /:id - Atualizar folha (apenas Rascunho)
router.put('/:id', requirePermission('HR', 'payroll_process'), async (req, res) => {
    try {
        const { id } = req.params;
        const { base_salary, overtime_hours, overtime_value, bonus, other_discounts, inss_discount, irrf_discount, currency } = req.body;

        // Verificar se está em rascunho
        const { data: current } = await supabase.from('rh_payrolls').select('status').eq('id', id).single();
        if (current.status !== 'DRAFT') {
            return res.status(400).json({ error: 'Apenas folhas em rascunho podem ser editadas' });
        }

        const gross_salary = parseFloat(base_salary) + parseFloat(overtime_value || 0) + parseFloat(bonus || 0);
        const inss = parseFloat(inss_discount || 0);
        const irrf = parseFloat(irrf_discount || 0);
        const total_discounts = inss + irrf + parseFloat(other_discounts || 0);
        const net_salary = gross_salary - total_discounts;

        const { data, error } = await supabase
            .from('rh_payrolls')
            .update({
                base_salary,
                overtime_hours: overtime_hours || 0,
                overtime_value: overtime_value || 0,
                bonus: bonus || 0,
                inss_discount: inss,
                irrf_discount: irrf,
                other_discounts: other_discounts || 0,
                net_salary,
                currency: currency || 'EUR',
                updated_at: new Date()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        res.json(data);
    } catch (error) {
        console.error('Erro ao atualizar folha:', error);
        res.status(500).json({ error: 'Erro interno' });
    }
});

// DELETE /:id - Excluir folha (apenas Rascunho)
router.delete('/:id', requirePermission('HR', 'payroll_process'), async (req, res) => {
    try {
        const { id } = req.params;

        // Verificar se está em rascunho
        const { data: current } = await supabase.from('rh_payrolls').select('status').eq('id', id).single();
        if (!current) return res.status(404).json({ error: 'Folha não encontrada' });

        if (current.status !== 'DRAFT') {
            return res.status(400).json({ error: 'Apenas folhas em rascunho podem ser excluídas' });
        }

        const { error } = await supabase
            .from('rh_payrolls')
            .delete()
            .eq('id', id);

        if (error) throw error;

        res.json({ message: 'Folha excluída com sucesso' });
    } catch (error) {
        console.error('Erro ao excluir folha:', error);
        res.status(500).json({ error: 'Erro interno' });
    }
});

// POST /:id/finalize - Finalizar folha
router.post('/:id/finalize', requirePermission('HR', 'payroll_process'), async (req, res) => {
    try {
        const { id } = req.params;

        const { data, error } = await supabase
            .from('rh_payrolls')
            .update({
                status: 'FINALIZED',
                finalized_at: new Date()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        res.json(data);
    } catch (error) {
        console.error('Erro ao finalizar folha:', error);
        res.status(500).json({ error: 'Erro interno' });
    }
});

module.exports = router;
