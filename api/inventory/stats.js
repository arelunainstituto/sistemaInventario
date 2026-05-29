const express = require('express');
const router = express.Router();
const { requirePermission } = require('../middleware/auth');
const { supabaseAdmin } = require('./_stock');

// GET /summary — números para os cards do dashboard
router.get('/summary', requirePermission('inventory', 'read'), async (req, res) => {
    try {
        // Total de itens ativos
        const itemsCount = await supabaseAdmin
            .from('inv_items')
            .select('*', { count: 'exact', head: true })
            .is('deleted_at', null);

        const activeCount = await supabaseAdmin
            .from('inv_items')
            .select('*', { count: 'exact', head: true })
            .is('deleted_at', null)
            .eq('is_active', true);

        // Stock agregado para cálculos (valor + abaixo do mínimo)
        const { data: stockData } = await supabaseAdmin
            .from('inv_stock')
            .select('item_id, quantity');

        const stockByItem = {};
        for (const s of stockData || []) {
            stockByItem[s.item_id] = (stockByItem[s.item_id] || 0) + parseFloat(s.quantity || 0);
        }

        const { data: items } = await supabaseAdmin
            .from('inv_items')
            .select('id, name, internal_code, cmp, min_stock, max_stock')
            .is('deleted_at', null)
            .eq('is_active', true);

        let totalValue = 0;
        let belowMin = 0;
        const criticalItems = [];
        for (const it of items || []) {
            const stock = stockByItem[it.id] || 0;
            totalValue += stock * parseFloat(it.cmp || 0);
            if (parseFloat(it.min_stock) > 0 && stock < parseFloat(it.min_stock)) {
                belowMin++;
                criticalItems.push({
                    id: it.id, name: it.name, internal_code: it.internal_code,
                    stock, min_stock: parseFloat(it.min_stock)
                });
            }
        }
        criticalItems.sort((a, b) => (a.stock / a.min_stock) - (b.stock / b.min_stock));

        res.json({
            success: true,
            data: {
                total_items:  itemsCount.count || 0,
                active_items: activeCount.count || 0,
                below_min:    belowMin,
                total_value:  Math.round(totalValue * 100) / 100,
                critical_items: criticalItems.slice(0, 10)
            }
        });
    } catch (err) {
        console.error('GET inventory/stats/summary error:', err);
        res.status(500).json({ error: err.message || 'Erro ao calcular estatísticas' });
    }
});

module.exports = router;
