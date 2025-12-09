const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { requirePermission } = require('../middleware/auth');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// GET /employees - Relatório de Funcionários
router.get('/employees', requirePermission('HR', 'view_reports'), async (req, res) => {
    try {
        const { status, department } = req.query;

        let query = supabase
            .from('rh_employees')
            .select('*')
            .order('name');

        if (status) query = query.eq('status', status);
        if (department) query = query.eq('department', department);

        const { data, error } = await query;

        if (error) throw error;

        res.json(data);
    } catch (error) {
        console.error('Erro no relatório de funcionários:', error);
        res.status(500).json({ error: 'Erro interno' });
    }
});

// GET /payroll - Relatório de Folha
router.get('/payroll', requirePermission('HR', 'view_reports'), async (req, res) => {
    try {
        const { month, year } = req.query;

        let query = supabase
            .from('rh_payrolls')
            .select('*, rh_employees(name, nif)')
            .order('period_year', { ascending: false })
            .order('period_month', { ascending: false });

        if (month) query = query.eq('period_month', month);
        if (year) query = query.eq('period_year', year);

        const { data, error } = await query;

        if (error) throw error;

        res.json(data);
    } catch (error) {
        console.error('Erro no relatório de folha:', error);
        res.status(500).json({ error: 'Erro interno' });
    }
});

module.exports = router;
