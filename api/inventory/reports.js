const express = require('express');
const router = express.Router();
const { requirePermission } = require('../middleware/auth');
const { supabaseAdmin } = require('./_stock');
const { sendReport } = require('./_export');

// Helper: lê view com filtros e devolve no formato pedido
async function fetchView(viewName, filters = {}) {
    let q = supabaseAdmin.from(viewName).select('*');
    for (const [k, v] of Object.entries(filters)) {
        if (v !== undefined && v !== null && v !== '') q = q.eq(k, v);
    }
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
}

// 12.1 — Ponto de reposição
router.get('/reorder', requirePermission('inventory', 'reports'), async (req, res) => {
    try {
        const rows = (await fetchView('vw_inv_reorder_status'))
            .filter(r => ['rutura','abaixo_minimo','abaixo_reposicao'].includes(r.status));
        sendReport(res, req.query.format, {
            title: 'Relatório de Ponto de Reposição',
            subtitle: 'Itens abaixo do mínimo ou do ponto de reposição',
            columns: [
                { key: 'internal_code',           label: 'Código',         width: 60 },
                { key: 'name',                    label: 'Item',           width: 170 },
                { key: 'subcategory',             label: 'Subcategoria',   width: 90 },
                { key: 'current_stock',           label: 'Stock atual',    width: 60 },
                { key: 'avg_daily_consumption',   label: 'Consumo/dia',    width: 60 },
                { key: 'computed_reorder_point',  label: 'Reposição',      width: 60 },
                { key: 'min_stock',               label: 'Min',            width: 50 },
                { key: 'status',                  label: 'Estado',         width: 65 }
            ],
            rows
        });
    } catch (err) { console.error('GET /reports/reorder', err); res.status(500).json({ error: err.message }); }
});

// 12.2 — Abaixo do mínimo / acima do máximo
router.get('/stock-min-max', requirePermission('inventory', 'reports'), async (req, res) => {
    try {
        const rows = (await fetchView('vw_inv_reorder_status'))
            .filter(r => ['rutura','abaixo_minimo','acima_maximo'].includes(r.status));
        sendReport(res, req.query.format, {
            title: 'Itens abaixo do mínimo ou acima do máximo',
            subtitle: 'Identifica ruturas e excessos',
            columns: [
                { key: 'internal_code', label: 'Código',      width: 60 },
                { key: 'name',          label: 'Item',        width: 200 },
                { key: 'current_stock', label: 'Stock',       width: 60 },
                { key: 'min_stock',     label: 'Min',         width: 50 },
                { key: 'max_stock',     label: 'Max',         width: 50 },
                { key: 'status',        label: 'Estado',      width: 80 }
            ],
            rows
        });
    } catch (err) { console.error('GET /reports/stock-min-max', err); res.status(500).json({ error: err.message }); }
});

// 12.3 — Cobertura de stock
router.get('/coverage', requirePermission('inventory', 'reports'), async (req, res) => {
    try {
        const rows = (await fetchView('vw_inv_stock_coverage'))
            .sort((a, b) => (a.days_coverage ?? 99999) - (b.days_coverage ?? 99999));
        sendReport(res, req.query.format, {
            title: 'Cobertura de Stock (dias)',
            subtitle: 'Ordenado do menor para o maior',
            columns: [
                { key: 'internal_code',         label: 'Código',           width: 60 },
                { key: 'name',                  label: 'Item',             width: 210 },
                { key: 'current_stock',         label: 'Stock atual',      width: 70 },
                { key: 'avg_daily_consumption', label: 'Consumo médio',    width: 80 },
                { key: 'days_coverage',         label: 'Cobertura (dias)', width: 80 }
            ],
            rows
        });
    } catch (err) { console.error('GET /reports/coverage', err); res.status(500).json({ error: err.message }); }
});

// 12.4 — Valorização de stock
router.get('/valuation', requirePermission('inventory', 'financial'), async (req, res) => {
    try {
        const rows = await fetchView('vw_inv_valuation');
        const totalValue = rows.reduce((acc, r) => acc + parseFloat(r.line_value || 0), 0);
        sendReport(res, req.query.format, {
            title: 'Valorização de Stock',
            subtitle: `Total: € ${totalValue.toFixed(2)}`,
            columns: [
                { key: 'internal_code',  label: 'Código',         width: 60 },
                { key: 'name',           label: 'Item',           width: 180 },
                { key: 'subcategory',    label: 'Subcategoria',   width: 80 },
                { key: 'unit_name',      label: 'Unidade',        width: 70 },
                { key: 'location_name',  label: 'Localização',    width: 80 },
                { key: 'quantity',       label: 'Qtd',            width: 50 },
                { key: 'cmp',            label: 'CMP €',          width: 50 },
                { key: 'line_value',     label: 'Total €',        width: 70 }
            ],
            rows
        });
    } catch (err) { console.error('GET /reports/valuation', err); res.status(500).json({ error: err.message }); }
});

// 12.5 — Relatório de inventário (última sessão por localização)
router.get('/inventory-sessions', requirePermission('inventory', 'reports'), async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('inv_inventory_sessions')
            .select('*, location:inv_locations!location_id(name, unit:inv_units!unit_id(name)), counts:inv_inventory_counts(item:inv_items!item_id(internal_code, name), expected_qty, counted_qty, difference)')
            .order('opened_at', { ascending: false })
            .limit(50);
        if (error) throw error;

        // Achata para tabela de relatório
        const rows = [];
        for (const s of data) {
            const status = s.status;
            for (const c of (s.counts || [])) {
                if (Math.abs(parseFloat(c.difference || 0)) === 0) continue;
                rows.push({
                    session_id:   s.id.slice(0, 8),
                    opened_at:    new Date(s.opened_at).toLocaleDateString('pt-PT'),
                    location:     `${s.location?.unit?.name || ''} · ${s.location?.name || ''}`,
                    status,
                    item_code:    c.item?.internal_code,
                    item_name:    c.item?.name,
                    expected_qty: c.expected_qty,
                    counted_qty:  c.counted_qty,
                    difference:   c.difference
                });
            }
        }

        sendReport(res, req.query.format, {
            title: 'Relatório de Inventário (Contagem)',
            subtitle: 'Diferenças apuradas em sessões de contagem',
            columns: [
                { key: 'session_id',   label: 'Sessão',       width: 50 },
                { key: 'opened_at',    label: 'Data',         width: 70 },
                { key: 'location',     label: 'Localização',  width: 130 },
                { key: 'status',       label: 'Estado',       width: 65 },
                { key: 'item_code',    label: 'Código',       width: 55 },
                { key: 'item_name',    label: 'Item',         width: 130 },
                { key: 'expected_qty', label: 'Esperado',     width: 50 },
                { key: 'counted_qty',  label: 'Contado',      width: 50 },
                { key: 'difference',   label: 'Δ',            width: 35 }
            ],
            rows
        });
    } catch (err) { console.error('GET /reports/inventory-sessions', err); res.status(500).json({ error: err.message }); }
});

// 12.6 — Kardex por item (precisa item_id)
router.get('/kardex/:itemId', requirePermission('inventory', 'reports'), async (req, res) => {
    try {
        const { itemId } = req.params;
        const { data, error } = await supabaseAdmin
            .from('vw_inv_kardex')
            .select('*')
            .eq('item_id', itemId)
            .order('occurred_at', { ascending: true });
        if (error) throw error;

        const rows = (data || []).map(r => ({
            occurred_at:     new Date(r.occurred_at).toLocaleString('pt-PT'),
            type:            r.type,
            subtype:         r.subtype,
            location:        r.from_location || r.to_location || '—',
            lot:             r.lot_number || '—',
            quantity:        parseFloat(r.quantity).toFixed(2),
            unit_cost:       r.unit_cost ? `€ ${parseFloat(r.unit_cost).toFixed(2)}` : '—',
            running_balance: parseFloat(r.running_balance).toFixed(2)
        }));

        sendReport(res, req.query.format, {
            title: `Kardex — ${data?.[0]?.internal_code || 'item'}`,
            subtitle: 'Movimentos cronológicos com saldo acumulado',
            columns: [
                { key: 'occurred_at',     label: 'Data/hora',  width: 110 },
                { key: 'type',            label: 'Tipo',        width: 90 },
                { key: 'subtype',         label: 'Subtipo',     width: 80 },
                { key: 'location',        label: 'Localização', width: 100 },
                { key: 'lot',             label: 'Lote',        width: 60 },
                { key: 'quantity',        label: 'Qtd',         width: 50 },
                { key: 'unit_cost',       label: 'Custo €',     width: 60 },
                { key: 'running_balance', label: 'Saldo',       width: 55 }
            ],
            rows
        });
    } catch (err) { console.error('GET /reports/kardex', err); res.status(500).json({ error: err.message }); }
});

// 12.7 — Tendência de consumo (4 meses + YoY)
router.get('/consumption-trend', requirePermission('inventory', 'reports'), async (req, res) => {
    try {
        const { item_id } = req.query;
        let q = supabaseAdmin.from('mvw_inv_consumption_trend').select('*');
        if (item_id) q = q.eq('item_id', item_id);
        const { data, error } = await q.order('month', { ascending: true });
        if (error) throw error;

        const rows = (data || []).map(r => ({
            internal_code: r.internal_code,
            name:          r.name,
            month:         r.month,
            qty:           parseFloat(r.qty || 0).toFixed(2)
        }));

        sendReport(res, req.query.format, {
            title: 'Tendência de Consumo Mensal',
            subtitle: 'Últimos 16 meses (4 correntes + 12 base para comparativo anual)',
            columns: [
                { key: 'internal_code', label: 'Código', width: 60 },
                { key: 'name',          label: 'Item',   width: 200 },
                { key: 'month',         label: 'Mês',    width: 80 },
                { key: 'qty',           label: 'Consumo', width: 70 }
            ],
            rows
        });
    } catch (err) { console.error('GET /reports/consumption-trend', err); res.status(500).json({ error: err.message }); }
});

// 12.8 — Atividade por utilizador
router.get('/user-activity', requirePermission('inventory', 'reports'), async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('mvw_inv_user_activity')
            .select('*')
            .order('day', { ascending: false });
        if (error) throw error;

        const rows = (data || []).map(r => ({
            user:            r.display_name || (r.user_id ? r.user_id.slice(0, 8) : 'sistema'),
            day:             r.day,
            type:            r.type,
            subtype:         r.subtype || '—',
            movement_count:  r.movement_count,
            total_qty:       parseFloat(r.total_qty || 0).toFixed(2),
            total_value:     `€ ${parseFloat(r.total_value || 0).toFixed(2)}`
        }));

        sendReport(res, req.query.format, {
            title: 'Movimentos por Utilizador',
            subtitle: 'Últimos 12 meses (atualizado diariamente)',
            columns: [
                { key: 'user',           label: 'Utilizador',  width: 110 },
                { key: 'day',            label: 'Dia',         width: 70 },
                { key: 'type',           label: 'Tipo',        width: 90 },
                { key: 'subtype',        label: 'Subtipo',     width: 80 },
                { key: 'movement_count', label: 'Movs',        width: 50 },
                { key: 'total_qty',      label: 'Qtd total',   width: 70 },
                { key: 'total_value',    label: 'Valor total', width: 80 }
            ],
            rows
        });
    } catch (err) { console.error('GET /reports/user-activity', err); res.status(500).json({ error: err.message }); }
});

module.exports = router;
