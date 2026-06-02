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

// Calcula avisos por localização quando o relatório está em visão global.
// Um item pode estar OK no agregado mas em rutura/abaixo do mínimo em uma
// localização específica (override). Esse helper retorna o breakdown para
// o frontend exibir um banner "Atenção: X localizações com itens críticos".
async function computeLocationWarnings(criticalStatuses) {
    const { data, error } = await supabaseAdmin
        .from('vw_inv_reorder_status_by_location')
        .select('location_id, location_name, unit_name, status');
    if (error) return [];
    const groups = new Map();
    for (const r of (data || [])) {
        if (!criticalStatuses.includes(r.status)) continue;
        const key = r.location_id;
        if (!groups.has(key)) {
            groups.set(key, {
                location_id:   r.location_id,
                location_name: r.location_name,
                unit_name:     r.unit_name,
                critical_count: 0
            });
        }
        groups.get(key).critical_count += 1;
    }
    return Array.from(groups.values())
        .sort((a, b) => b.critical_count - a.critical_count);
}

// Soma colunas numéricas das linhas. Aceita strings com prefixo monetário
// (ex: "€ 12.34") e numéricos puros. Retorna { key: number }.
function sumColumns(rows, keys) {
    const out = {};
    for (const k of keys) {
        out[k] = rows.reduce((acc, r) => {
            const raw = r[k];
            if (raw === null || raw === undefined) return acc;
            const cleaned = String(raw).replace(/[^\d.,-]/g, '').replace(',', '.');
            const n = parseFloat(cleaned);
            return isNaN(n) ? acc : acc + n;
        }, 0);
    }
    return out;
}

// Formata os totals como strings prontas para exibição, mantendo o estilo
// usado nas linhas (€ prefix, fixed decimals, etc.).
function formatTotals(totals, formats) {
    const out = {};
    for (const [k, v] of Object.entries(totals)) {
        const f = formats[k];
        if (!f)              { out[k] = String(v); continue; }
        if (f === 'int')     { out[k] = Math.round(v).toString(); continue; }
        if (f === 'num2')    { out[k] = v.toFixed(2); continue; }
        if (f === 'num4')    { out[k] = v.toFixed(4); continue; }
        if (f === 'eur2')    { out[k] = `€ ${v.toFixed(2)}`; continue; }
        if (typeof f === 'function') { out[k] = f(v); continue; }
        out[k] = String(v);
    }
    return out;
}

// Normaliza linhas da view *_by_location para o mesmo formato das views
// agregadas — assim o frontend não precisa diferenciar.
function normalizeByLocationRow(r) {
    return {
        ...r,
        // mapeamento de nomes diferentes entre as views by_location e agregadas
        name:                   r.item_name || r.name,
        avg_daily_consumption:  r.avg_daily ?? r.avg_daily_consumption,
        computed_reorder_point: r.reorder_point ?? r.computed_reorder_point,
        days_coverage:          r.coverage_days ?? r.days_coverage,
        subcategory:            r.subcategory ?? null,
        location_name:          r.location_name,
        location_id:            r.location_id
    };
}

// 12.1 — Ponto de reposição. Aceita ?location_id= opcional.
router.get('/reorder', requirePermission('inventory', 'reports'), async (req, res) => {
    try {
        const { location_id } = req.query;
        const critical = ['rutura','abaixo_minimo','abaixo_reposicao'];
        let rows;
        let location_warnings = null;
        if (location_id) {
            rows = (await fetchView('vw_inv_reorder_status_by_location', { location_id }))
                .filter(r => critical.includes(r.status))
                .map(normalizeByLocationRow);
        } else {
            rows = (await fetchView('vw_inv_reorder_status'))
                .filter(r => critical.includes(r.status));
            // Visão global pode mascarar problemas locais: um item OK no agregado
            // pode estar abaixo do mínimo em uma localização específica.
            location_warnings = await computeLocationWarnings(critical);
        }
        const totalKeys = ['current_stock','avg_daily_consumption','computed_reorder_point','min_stock'];
        const totals = formatTotals(sumColumns(rows, totalKeys), {
            current_stock: 'num2', avg_daily_consumption: 'num4',
            computed_reorder_point: 'num2', min_stock: 'num2'
        });
        sendReport(res, req.query.format, {
            title: 'Relatório de Ponto de Reposição',
            subtitle: location_id ? `Filtrado por localização` : 'Itens abaixo do mínimo ou do ponto de reposição',
            columns: [
                { key: 'internal_code',           label: 'Código',         width: 60 },
                { key: 'name',                    label: 'Item',           width: 150 },
                ...(location_id ? [] : [{ key: 'subcategory', label: 'Subcategoria', width: 80 }]),
                ...(location_id ? [{ key: 'location_name', label: 'Localização', width: 90 }] : []),
                { key: 'current_stock',           label: 'Stock atual',    width: 60 },
                { key: 'avg_daily_consumption',   label: 'Consumo/dia',    width: 60 },
                { key: 'computed_reorder_point',  label: 'Reposição',      width: 60 },
                { key: 'min_stock',               label: 'Min',            width: 50 },
                { key: 'status',                  label: 'Estado',         width: 65 }
            ],
            rows,
            totals,
            extras: location_warnings ? { location_warnings } : {}
        });
    } catch (err) { console.error('GET /reports/reorder', err); res.status(500).json({ error: err.message }); }
});

// 12.2 — Abaixo do mínimo / acima do máximo. Aceita ?location_id= opcional.
router.get('/stock-min-max', requirePermission('inventory', 'reports'), async (req, res) => {
    try {
        const { location_id } = req.query;
        const critical = ['rutura','abaixo_minimo','acima_maximo'];
        const view = location_id ? 'vw_inv_reorder_status_by_location' : 'vw_inv_reorder_status';
        const filters = location_id ? { location_id } : {};
        let rows = (await fetchView(view, filters))
            .filter(r => critical.includes(r.status));
        if (location_id) rows = rows.map(normalizeByLocationRow);
        const location_warnings = location_id ? null : await computeLocationWarnings(critical);
        const totals = formatTotals(
            sumColumns(rows, ['current_stock','min_stock','max_stock']),
            { current_stock: 'num2', min_stock: 'num2', max_stock: 'num2' }
        );
        sendReport(res, req.query.format, {
            title: 'Itens abaixo do mínimo ou acima do máximo',
            subtitle: location_id ? 'Filtrado por localização' : 'Identifica ruturas e excessos',
            columns: [
                { key: 'internal_code', label: 'Código',      width: 60 },
                { key: 'name',          label: 'Item',        width: 180 },
                ...(location_id ? [{ key: 'location_name', label: 'Localização', width: 90 }] : []),
                { key: 'current_stock', label: 'Stock',       width: 60 },
                { key: 'min_stock',     label: 'Min',         width: 50 },
                { key: 'max_stock',     label: 'Max',         width: 50 },
                { key: 'status',        label: 'Estado',      width: 80 }
            ],
            rows,
            totals,
            extras: location_warnings ? { location_warnings } : {}
        });
    } catch (err) { console.error('GET /reports/stock-min-max', err); res.status(500).json({ error: err.message }); }
});

// 12.3 — Cobertura de stock. Aceita ?location_id= opcional.
router.get('/coverage', requirePermission('inventory', 'reports'), async (req, res) => {
    try {
        const { location_id } = req.query;
        let rows;
        if (location_id) {
            rows = (await fetchView('vw_inv_stock_coverage_by_location', { location_id }))
                .map(normalizeByLocationRow);
        } else {
            rows = await fetchView('vw_inv_stock_coverage');
        }
        rows = rows.sort((a, b) => (a.days_coverage ?? 99999) - (b.days_coverage ?? 99999));
        // Para cobertura, "total" não faz sentido — usar média (apenas itens com avg > 0)
        const sums = sumColumns(rows, ['current_stock','avg_daily_consumption']);
        const coverageVals = rows.map(r => parseFloat(r.days_coverage)).filter(v => !isNaN(v));
        const avgCoverage = coverageVals.length
            ? coverageVals.reduce((a, b) => a + b, 0) / coverageVals.length
            : null;
        const totals = formatTotals(sums, { current_stock: 'num2', avg_daily_consumption: 'num4' });
        if (avgCoverage !== null) totals.days_coverage = `~${avgCoverage.toFixed(1)} (média)`;
        sendReport(res, req.query.format, {
            title: 'Cobertura de Stock (dias)',
            subtitle: location_id ? 'Filtrado por localização' : 'Ordenado do menor para o maior',
            columns: [
                { key: 'internal_code',         label: 'Código',           width: 60 },
                { key: 'name',                  label: 'Item',             width: 190 },
                ...(location_id ? [{ key: 'location_name', label: 'Localização', width: 90 }] : []),
                { key: 'current_stock',         label: 'Stock atual',      width: 70 },
                { key: 'avg_daily_consumption', label: 'Consumo médio',    width: 80 },
                { key: 'days_coverage',         label: 'Cobertura (dias)', width: 80 }
            ],
            rows,
            totals
        });
    } catch (err) { console.error('GET /reports/coverage', err); res.status(500).json({ error: err.message }); }
});

// 12.4 — Valorização de stock
router.get('/valuation', requirePermission('inventory', 'financial'), async (req, res) => {
    try {
        const rows = await fetchView('vw_inv_valuation');
        const totals = formatTotals(
            sumColumns(rows, ['quantity','line_value']),
            { quantity: 'num2', line_value: 'eur2' }
        );
        sendReport(res, req.query.format, {
            title: 'Valorização de Stock',
            subtitle: `Total: ${totals.line_value || '€ 0.00'}`,
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
            rows,
            totals
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

        const totals = formatTotals(
            sumColumns(rows, ['expected_qty','counted_qty','difference']),
            { expected_qty: 'num2', counted_qty: 'num2', difference: 'num2' }
        );
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
            rows,
            totals
        });
    } catch (err) { console.error('GET /reports/inventory-sessions', err); res.status(500).json({ error: err.message }); }
});

// 12.6 — Kardex por item. Aceita ?location_id= (usa vw_inv_kardex_by_location
// com running_balance particionado por localização), ?from= e ?to= (datas ISO).
router.get('/kardex/:itemId', requirePermission('inventory', 'reports'), async (req, res) => {
    try {
        const { itemId } = req.params;
        const { location_id, from, to } = req.query;

        const viewName = location_id ? 'vw_inv_kardex_by_location' : 'vw_inv_kardex';
        let q = supabaseAdmin.from(viewName).select('*').eq('item_id', itemId);
        if (location_id) q = q.eq('location_id', location_id);
        if (from) q = q.gte('occurred_at', from);
        if (to)   q = q.lte('occurred_at', to);
        const { data, error } = await q.order('occurred_at', { ascending: true });
        if (error) throw error;

        // Localização que sofreu o efeito do movimento (mesma lógica da view by_location)
        const locationFor = (r) => {
            switch (r.type) {
                case 'entrada':
                case 'transferencia_entrada':
                    return r.to_location || r.from_location || '—';
                case 'saida':
                case 'transferencia_saida':
                case 'depreciacao':
                    return r.from_location || r.to_location || '—';
                case 'ajuste':
                case 'inventario':
                    return r.to_location || r.from_location || '—';
                default:
                    return r.from_location || r.to_location || '—';
            }
        };

        const rows = (data || []).map(r => ({
            occurred_at:     new Date(r.occurred_at).toLocaleString('pt-PT'),
            type:            r.type,
            subtype:         r.subtype,
            location:        locationFor(r),
            lot:             r.lot_number || '—',
            quantity:        parseFloat(r.quantity).toFixed(2),
            unit_cost:       r.unit_cost ? `€ ${parseFloat(r.unit_cost).toFixed(2)}` : '—',
            running_balance: parseFloat(location_id ? r.running_balance_at_location : r.running_balance).toFixed(2)
        }));

        const subtitleParts = ['Movimentos cronológicos'];
        if (location_id) subtitleParts.push('saldo por localização');
        if (from || to) subtitleParts.push(`de ${from || '—'} a ${to || 'hoje'}`);

        sendReport(res, req.query.format, {
            title: `Kardex — ${data?.[0]?.internal_code || 'item'}`,
            subtitle: subtitleParts.join(' · '),
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

// 12.7 — Tendência de consumo. Aceita ?item_id= e ?location_id= opcionais.
router.get('/consumption-trend', requirePermission('inventory', 'reports'), async (req, res) => {
    try {
        const { item_id, location_id } = req.query;

        const viewName = location_id ? 'mvw_inv_consumption_trend_by_location' : 'mvw_inv_consumption_trend';
        const orderCol = location_id ? 'month_start' : 'month';
        let q = supabaseAdmin.from(viewName).select('*');
        if (item_id)     q = q.eq('item_id', item_id);
        if (location_id) q = q.eq('location_id', location_id);
        const { data, error } = await q.order(orderCol, { ascending: true });
        if (error) throw error;

        const rows = (data || []).map(r => ({
            internal_code: r.internal_code,
            name:          r.item_name || r.name,
            location:      r.location_name || '—',
            month:         r.month_start || r.month,
            qty:           parseFloat(r.total_qty ?? r.qty ?? 0).toFixed(2)
        }));

        const totals = formatTotals(sumColumns(rows, ['qty']), { qty: 'num2' });
        sendReport(res, req.query.format, {
            title: 'Tendência de Consumo Mensal',
            subtitle: location_id ? 'Últimos 16 meses por localização' : 'Últimos 16 meses (4 correntes + 12 base para comparativo anual)',
            columns: [
                { key: 'internal_code', label: 'Código', width: 60 },
                { key: 'name',          label: 'Item',   width: 180 },
                ...(location_id ? [{ key: 'location', label: 'Localização', width: 100 }] : []),
                { key: 'month',         label: 'Mês',    width: 80 },
                { key: 'qty',           label: 'Consumo', width: 70 }
            ],
            rows,
            totals
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

        const totals = formatTotals(
            sumColumns(rows, ['movement_count','total_qty','total_value']),
            { movement_count: 'int', total_qty: 'num2', total_value: 'eur2' }
        );
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
            rows,
            totals
        });
    } catch (err) { console.error('GET /reports/user-activity', err); res.status(500).json({ error: err.message }); }
});

module.exports = router;
