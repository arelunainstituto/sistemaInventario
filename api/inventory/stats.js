const express = require('express');
const router = express.Router();
const { requirePermission } = require('../middleware/auth');
const { supabaseAdmin } = require('./_stock');

// GET /summary — números para os cards do dashboard
router.get('/summary', requirePermission('inventory', 'read'), async (req, res) => {
    try {
        // 1. Total e ativos
        const [itemsCount, activeCount] = await Promise.all([
            supabaseAdmin.from('inv_items').select('*', { count: 'exact', head: true }).is('deleted_at', null),
            supabaseAdmin.from('inv_items').select('*', { count: 'exact', head: true }).is('deleted_at', null).eq('is_active', true)
        ]);

        // 2. Status de reposição (view)
        const { data: reorder } = await supabaseAdmin
            .from('vw_inv_reorder_status')
            .select('item_id, internal_code, name, current_stock, min_stock, status');

        const belowMin = (reorder || []).filter(r => ['rutura','abaixo_minimo'].includes(r.status));
        const criticalItems = belowMin
            .map(r => ({
                id:            r.item_id,
                internal_code: r.internal_code,
                name:          r.name,
                stock:         parseFloat(r.current_stock || 0),
                min_stock:     parseFloat(r.min_stock || 0),
                status:        r.status
            }))
            .sort((a, b) => (a.stock / Math.max(a.min_stock, 1)) - (b.stock / Math.max(b.min_stock, 1)))
            .slice(0, 10);

        // 3. Valor total (soma da view de valorização)
        const { data: valuation } = await supabaseAdmin
            .from('vw_inv_valuation')
            .select('line_value');
        const totalValue = (valuation || []).reduce((acc, r) => acc + parseFloat(r.line_value || 0), 0);

        // 4. Cobertura média (em dias) — apenas itens com consumo médio > 0
        const { data: coverage } = await supabaseAdmin
            .from('vw_inv_stock_coverage')
            .select('days_coverage')
            .not('days_coverage', 'is', null);
        const cov = (coverage || []).map(r => parseFloat(r.days_coverage));
        const avgCoverage = cov.length ? cov.reduce((a, b) => a + b, 0) / cov.length : null;

        // 5. Lotes vencendo nos próximos 30 dias
        const { data: expiring } = await supabaseAdmin
            .from('inv_lots')
            .select('id, item_id, lot_number, expiry_date, item:inv_items!item_id(internal_code, name)')
            .gte('expiry_date', new Date().toISOString().slice(0, 10))
            .lte('expiry_date', new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10))
            .order('expiry_date', { ascending: true })
            .limit(20);

        res.json({
            success: true,
            data: {
                total_items:    itemsCount.count || 0,
                active_items:   activeCount.count || 0,
                below_min:      belowMin.length,
                total_value:    Math.round(totalValue * 100) / 100,
                avg_coverage:   avgCoverage !== null ? Math.round(avgCoverage * 10) / 10 : null,
                expiring_count: (expiring || []).length,
                critical_items: criticalItems,
                expiring_lots:  expiring || []
            }
        });
    } catch (err) {
        console.error('GET inventory/stats/summary error:', err);
        res.status(500).json({ error: err.message || 'Erro ao calcular estatísticas' });
    }
});

module.exports = router;
