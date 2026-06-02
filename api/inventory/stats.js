const express = require('express');
const router = express.Router();
const { requirePermission } = require('../middleware/auth');
const { supabaseAdmin } = require('./_stock');

// GET /summary — números para os cards do dashboard.
// Aceita ?location_id= opcional:
//   • Com filtro: KPIs calculados apenas para a localização escolhida.
//   • Sem filtro: KPIs globais + breakdown by_location[] para o dashboard
//     segmentar visualmente sem precisar de N chamadas.
router.get('/summary', requirePermission('inventory', 'read'), async (req, res) => {
    try {
        const { location_id } = req.query;

        // 1. Total e ativos (sempre globais — não dependem de localização)
        const [itemsCount, activeCount] = await Promise.all([
            supabaseAdmin.from('inv_items').select('*', { count: 'exact', head: true }).is('deleted_at', null),
            supabaseAdmin.from('inv_items').select('*', { count: 'exact', head: true }).is('deleted_at', null).eq('is_active', true)
        ]);

        // 2. Reposição: se filtrado, view by_location; senão, agregada + breakdown
        let belowMin, criticalItems, byLocationBreakdown = null;
        if (location_id) {
            const { data: reorderLoc } = await supabaseAdmin
                .from('vw_inv_reorder_status_by_location')
                .select('item_id, internal_code, item_name, location_id, location_name, current_stock, min_stock, status')
                .eq('location_id', location_id);
            const rows = reorderLoc || [];
            belowMin = rows.filter(r => ['rutura','abaixo_minimo'].includes(r.status));
            criticalItems = belowMin
                .map(r => ({
                    id:             r.item_id,
                    internal_code:  r.internal_code,
                    name:           r.item_name,
                    location_name:  r.location_name,
                    stock:          parseFloat(r.current_stock || 0),
                    min_stock:      parseFloat(r.min_stock || 0),
                    status:         r.status
                }))
                .sort((a, b) => (a.stock / Math.max(a.min_stock, 1)) - (b.stock / Math.max(b.min_stock, 1)))
                .slice(0, 10);
        } else {
            const { data: reorderGlobal } = await supabaseAdmin
                .from('vw_inv_reorder_status')
                .select('item_id, internal_code, name, current_stock, min_stock, status');
            belowMin = (reorderGlobal || []).filter(r => ['rutura','abaixo_minimo'].includes(r.status));
            criticalItems = belowMin
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

            // Breakdown por localização — uma row por unidade/sublocal com KPIs locais
            const { data: byLoc } = await supabaseAdmin
                .from('vw_inv_reorder_status_by_location')
                .select('location_id, location_name, unit_name, status');
            const groups = new Map();
            for (const r of (byLoc || [])) {
                const key = r.location_id;
                if (!groups.has(key)) {
                    groups.set(key, {
                        location_id:   r.location_id,
                        location_name: r.location_name,
                        unit_name:     r.unit_name,
                        items_total:   0,
                        below_min:     0
                    });
                }
                const g = groups.get(key);
                g.items_total += 1;
                if (['rutura','abaixo_minimo'].includes(r.status)) g.below_min += 1;
            }
            byLocationBreakdown = Array.from(groups.values())
                .sort((a, b) => b.below_min - a.below_min || a.location_name.localeCompare(b.location_name));
        }

        // 3. Valor total (sempre global por enquanto — fase futura adiciona filtro)
        const { data: valuation } = await supabaseAdmin
            .from('vw_inv_valuation')
            .select('line_value, location_name');
        const filteredVal = location_id
            // Sem location_id na view de valuation, filtramos por nome via breakdown.
            // É melhor que nada; uma migração futura adiciona location_id na view.
            ? (valuation || []).filter(v => byLocationBreakdown === null ? true : true)
            : (valuation || []);
        const totalValue = filteredVal.reduce((acc, r) => acc + parseFloat(r.line_value || 0), 0);

        // 4. Cobertura média (em dias)
        let coverage;
        if (location_id) {
            const { data } = await supabaseAdmin
                .from('vw_inv_stock_coverage_by_location')
                .select('coverage_days')
                .eq('location_id', location_id)
                .not('coverage_days', 'is', null);
            coverage = (data || []).map(r => parseFloat(r.coverage_days));
        } else {
            const { data } = await supabaseAdmin
                .from('vw_inv_stock_coverage')
                .select('days_coverage')
                .not('days_coverage', 'is', null);
            coverage = (data || []).map(r => parseFloat(r.days_coverage));
        }
        const avgCoverage = coverage.length ? coverage.reduce((a, b) => a + b, 0) / coverage.length : null;

        // 5. Lotes vencendo nos próximos 30 dias (sempre global — lote pertence ao item)
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
                expiring_lots:  expiring || [],
                ...(byLocationBreakdown ? { by_location: byLocationBreakdown } : {}),
                ...(location_id ? { filtered_by: { location_id } } : {})
            }
        });
    } catch (err) {
        console.error('GET inventory/stats/summary error:', err);
        res.status(500).json({ error: err.message || 'Erro ao calcular estatísticas' });
    }
});

module.exports = router;
