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

        // 3. Valor total. Quando filtrado, soma direto de inv_stock × cmp do item
        // (vw_inv_valuation não expõe location_id; uma migração futura pode
        // adicioná-la para evitar este join no servidor).
        let totalValue;
        if (location_id) {
            const { data: stockRows } = await supabaseAdmin
                .from('inv_stock')
                .select('quantity, item:inv_items!item_id(cmp)')
                .eq('location_id', location_id)
                .gt('quantity', 0);
            totalValue = (stockRows || []).reduce(
                (acc, r) => acc + (parseFloat(r.quantity) * parseFloat(r.item?.cmp || 0)),
                0
            );
        } else {
            const { data: valuation } = await supabaseAdmin
                .from('vw_inv_valuation')
                .select('line_value');
            totalValue = (valuation || []).reduce((acc, r) => acc + parseFloat(r.line_value || 0), 0);
        }

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

        // 5. Lotes vencendo nos próximos 30 dias. Quando filtrado, restringe
        // aos lotes que têm stock > 0 na localização escolhida (um lote pode
        // estar zerado lá mas continuar existindo em outra localização).
        let expiring;
        const today        = new Date().toISOString().slice(0, 10);
        const in30Days     = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
        if (location_id) {
            const { data: stockedLots } = await supabaseAdmin
                .from('inv_stock')
                .select(`
                    lot_id,
                    lot:inv_lots!lot_id(id, item_id, lot_number, expiry_date, item:inv_items!item_id(internal_code, name))
                `)
                .eq('location_id', location_id)
                .gt('quantity', 0)
                .not('lot_id', 'is', null);
            expiring = (stockedLots || [])
                .map(s => s.lot)
                .filter(l => l && l.expiry_date >= today && l.expiry_date <= in30Days)
                .sort((a, b) => a.expiry_date.localeCompare(b.expiry_date))
                .slice(0, 20);
        } else {
            const { data } = await supabaseAdmin
                .from('inv_lots')
                .select('id, item_id, lot_number, expiry_date, item:inv_items!item_id(internal_code, name)')
                .gte('expiry_date', today)
                .lte('expiry_date', in30Days)
                .order('expiry_date', { ascending: true })
                .limit(20);
            expiring = data || [];
        }

        res.json({
            success: true,
            data: {
                total_items:    itemsCount.count || 0,
                active_items:   activeCount.count || 0,
                below_min:      belowMin.length,
                total_value:    Math.round(totalValue * 100) / 100,
                avg_coverage:   avgCoverage !== null ? Math.round(avgCoverage * 10) / 10 : null,
                expiring_count: expiring.length,
                critical_items: criticalItems,
                expiring_lots:  expiring,
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
