const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { requirePermission } = require('../middleware/auth');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// GET /employee/:employeeId - Obter dados de folha de pagamento
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
            .from('rh_payroll_data')
            .select('*')
            .eq('employee_id', employeeId)
            .single();

        if (error && error.code !== 'PGRST116') throw error; // Ignorar erro de não encontrado

        res.json(data || {});
    } catch (error) {
        console.error('Erro ao buscar dados de folha de pagamento:', error);
        res.status(500).json({ error: 'Erro interno' });
    }
});

// PUT /employee/:employeeId - Atualizar dados de folha de pagamento
router.put('/employee/:employeeId', requirePermission('HR', 'update'), async (req, res) => {
    try {
        const { employeeId } = req.params;
        const updates = req.body;

        // Remover campos protegidos
        delete updates.id;
        delete updates.employee_id;
        delete updates.created_at;
        delete updates.updated_at;

        // Upsert
        const { data, error } = await supabase
            .from('rh_payroll_data')
            .upsert({
                employee_id: employeeId,
                ...updates
            }, { onConflict: 'employee_id' })
            .select()
            .single();

        if (error) throw error;

        // Sincronizar salário base com rh_employees se necessário
        if (updates.base_salary) {
            await supabase
                .from('rh_employees')
                .update({ salary_base: updates.base_salary })
                .eq('id', employeeId);
        }

        res.json(data);
    } catch (error) {
        console.error('Erro ao atualizar dados de folha de pagamento:', error);
        res.status(500).json({ error: 'Erro interno' });
    }
});

module.exports = router;
