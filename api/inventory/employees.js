// Lista enxuta de colaboradores para seletores do inventário (ex.: vincular
// uma unidade patrimonial a um funcionário). Fonte ÚNICA: rh_employees (módulo
// RH). Exposto sob a permissão de inventário para não exigir permissão de RH
// do operador, devolvendo apenas campos não-sensíveis.

const express = require('express');
const router  = express.Router();
const { requirePermission } = require('../middleware/auth');
const { supabaseAdmin } = require('./_stock');

// GET / — colaboradores. Por padrão só ACTIVE; include_inactive=1 traz todos.
router.get('/', requirePermission('inventory', 'read'), async (req, res) => {
    try {
        const { search, include_inactive } = req.query;
        let q = supabaseAdmin
            .from('rh_employees')
            .select('id, name, department, status')
            .is('deleted_at', null)
            .order('name', { ascending: true });
        if (!include_inactive) q = q.eq('status', 'ACTIVE');
        if (search)            q = q.ilike('name', `%${search}%`);

        const { data, error } = await q;
        if (error) throw error;
        res.json({ success: true, data });
    } catch (err) {
        console.error('GET inventory/employees error:', err);
        res.status(500).json({ error: err.message || 'Erro ao listar colaboradores' });
    }
});

module.exports = router;
