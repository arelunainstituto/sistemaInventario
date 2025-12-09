const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { requirePermission } = require('../middleware/auth');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// GET /kpis - Indicadores principais
router.get('/kpis', requirePermission('HR', 'view_reports'), async (req, res) => {
    try {
        // 1. Total de Funcionários
        const { count: totalEmployees } = await supabase
            .from('rh_employees')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'ACTIVE');

        // 2. Ausências Pendentes
        const { count: pendingAbsences } = await supabase
            .from('rh_absences')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'PENDING');

        // 3. Custo da Folha (Último mês fechado ou atual)
        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth() + 1;

        const { data: payrollData } = await supabase
            .from('rh_payrolls')
            .select('net_salary, inss_discount, irrf_discount')
            .eq('period_month', currentMonth)
            .eq('period_year', currentYear);

        const totalPayrollCost = (payrollData || []).reduce((acc, curr) => {
            return acc + (curr.net_salary || 0) + (curr.inss_discount || 0) + (curr.irrf_discount || 0);
        }, 0);

        // 4. Documentos Vencendo (próximos 30 dias)
        const today = new Date();
        const next30Days = new Date();
        next30Days.setDate(today.getDate() + 30);

        const { count: expiringDocuments } = await supabase
            .from('rh_documents')
            .select('*', { count: 'exact', head: true })
            .gte('expiry_date', today.toISOString())
            .lte('expiry_date', next30Days.toISOString());

        res.json({
            totalEmployees: totalEmployees || 0,
            pendingAbsences: pendingAbsences || 0,
            totalPayrollCost: totalPayrollCost || 0,
            expiringDocuments: expiringDocuments || 0
        });
    } catch (error) {
        console.error('Erro ao buscar KPIs:', error);
        res.status(500).json({ error: 'Erro interno' });
    }
});

// GET /charts - Dados para gráficos
router.get('/charts', requirePermission('HR', 'view_reports'), async (req, res) => {
    try {
        // 1. Distribuição por Departamento
        const { data: deptData } = await supabase
            .from('rh_employees')
            .select('department')
            .eq('status', 'ACTIVE');

        const departmentDistribution = (deptData || []).reduce((acc, curr) => {
            acc[curr.department] = (acc[curr.department] || 0) + 1;
            return acc;
        }, {});

        // 2. Evolução da Folha (últimos 6 meses)
        // Simplificado: buscar dados agregados
        // TODO: Implementar query real

        res.json({
            departmentDistribution
        });
    } catch (error) {
        console.error('Erro ao buscar dados de gráficos:', error);
        res.status(500).json({ error: 'Erro interno' });
    }
});

module.exports = router;
