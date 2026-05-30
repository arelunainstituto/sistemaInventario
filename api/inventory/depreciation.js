const express = require('express');
const router = express.Router();
const { requireRole, requirePermission } = require('../middleware/auth');
const { supabaseAdmin } = require('./_stock');

// GET /runs — histórico de execuções
// Reports + financial: any inventory user with reports can list; financial breakdown apenas no detalhe.
router.get('/runs', requirePermission('inventory', 'reports'), async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('inv_depreciation_runs')
            .select('*')
            .order('year', { ascending: false });
        if (error) throw error;
        res.json({ success: true, data });
    } catch (err) {
        console.error('GET depreciation runs error:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /run — executar depreciação para um ano (Admin)
router.post('/run', requireRole(['Inventory_Admin', 'Admin', 'admin']), async (req, res) => {
    try {
        const { year } = req.body;
        if (!year || isNaN(parseInt(year)))
            return res.status(400).json({ error: 'year é obrigatório (ex.: 2026)' });

        const { data, error } = await supabaseAdmin.rpc('fn_inv_run_depreciation', {
            p_year:         parseInt(year),
            p_user:         req.user?.id || null,
            p_triggered_by: 'manual'
        });
        if (error) {
            if (error.code === '23505')
                return res.status(409).json({ error: `Depreciação para ${year} já foi executada (apenas uma vez por ano)` });
            throw error;
        }
        res.json({ success: true, data: { run_id: data } });
    } catch (err) {
        console.error('POST depreciation run error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
