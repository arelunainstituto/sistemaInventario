const express = require('express');
const router = express.Router();
const { requireRole } = require('../middleware/auth');
const { supabaseAdmin } = require('./_stock');
const { sendReport } = require('./_export');

// Apenas admins podem ler o log
const ADMIN_ROLES = ['Inventory_Admin', 'Admin', 'admin'];

// GET /settings — retorna retenção atual
router.get('/settings', requireRole(ADMIN_ROLES), async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('inv_system_settings')
            .select('*')
            .eq('key', 'access_log_retention_months')
            .single();
        if (error) throw error;
        res.json({ success: true, data });
    } catch (err) {
        console.error('GET access-log/settings error:', err);
        res.status(500).json({ error: err.message });
    }
});

// PUT /settings — alterar retenção
router.put('/settings', requireRole(ADMIN_ROLES), async (req, res) => {
    try {
        const { months } = req.body;
        if (!months || isNaN(parseInt(months)) || parseInt(months) < 1 || parseInt(months) > 120) {
            return res.status(400).json({ error: 'months deve ser entre 1 e 120' });
        }
        const { data, error } = await supabaseAdmin
            .from('inv_system_settings')
            .update({
                value:      String(parseInt(months)),
                updated_at: new Date().toISOString(),
                updated_by: req.user?.id || null
            })
            .eq('key', 'access_log_retention_months')
            .select()
            .single();
        if (error) throw error;
        res.json({ success: true, data });
    } catch (err) {
        console.error('PUT access-log/settings error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Helper: enriquece registos de log com display_name/email do user_profiles.
// Faz isso em 2 etapas porque inv_access_log.user_id aponta para auth.users,
// não diretamente para user_profiles (PostgREST não detecta a relação).
async function attachUserProfiles(rows) {
    const userIds = [...new Set(rows.map(r => r.user_id).filter(Boolean))];
    if (!userIds.length) return rows;
    const { data: profiles } = await supabaseAdmin
        .from('user_profiles')
        .select('id, display_name, email')
        .in('id', userIds);
    const byId = new Map((profiles || []).map(p => [p.id, p]));
    return rows.map(r => ({ ...r, user: r.user_id ? (byId.get(r.user_id) || null) : null }));
}

// Resolve entity_id (UUID nu) para uma label amigável por tipo de entidade.
// Faz lookup em batch agrupando por entity_type — N queries para N tipos
// distintos, não N queries por linha.
const ENTITY_RESOLVERS = {
    items:        { table: 'inv_items',              select: 'id, internal_code, name',  label: r => `${r.internal_code} · ${r.name}` },
    suppliers:    { table: 'inv_suppliers',          select: 'id, name',                  label: r => r.name },
    locations:    { table: 'inv_locations',          select: 'id, name',                  label: r => r.name },
    categories:   { table: 'inv_categories',         select: 'id, name, parent_macro',    label: r => `${r.parent_macro} · ${r.name}` },
    uoms:         { table: 'inv_units_of_measure',   select: 'id, code, name',            label: r => `${r.code} · ${r.name}` },
    units:        { table: 'inv_units',              select: 'id, code, name',            label: r => r.name },
    entries:      { table: 'inv_entries',            select: 'id, document_type, document_number', label: r => `${r.document_type} ${r.document_number}` },
    'inventory-sessions':  { table: 'inv_inventory_sessions', select: 'id', label: r => `sessão ${r.id.slice(0,8)}` },
    'adjustment-reasons':  { table: 'inv_adjustment_reasons', select: 'id, label', label: r => r.label }
};

// Sub-paths que não são UUIDs, são "actions" do endpoint (ex.: /stats/summary).
// Mostrar de forma legível em vez de tratar como entity_id.
function isActionSubpath(entity_id) {
    return /^[a-z][a-z_-]+$/i.test(entity_id || '');
}

async function attachEntityLabels(rows) {
    // Agrupa entity_ids reais (UUIDs) por entity_type
    const byType = {};
    for (const r of rows) {
        if (!r.entity_id || !r.entity_type) continue;
        if (!ENTITY_RESOLVERS[r.entity_type]) continue;
        if (isActionSubpath(r.entity_id)) continue;   // é "summary", "runs", etc.
        (byType[r.entity_type] = byType[r.entity_type] || new Set()).add(r.entity_id);
    }

    const labelsByTypeId = {};
    for (const [type, ids] of Object.entries(byType)) {
        const resolver = ENTITY_RESOLVERS[type];
        const { data } = await supabaseAdmin
            .from(resolver.table)
            .select(resolver.select)
            .in('id', [...ids]);
        labelsByTypeId[type] = new Map((data || []).map(d => [d.id, resolver.label(d)]));
    }

    return rows.map(r => {
        let entity_label = null;
        if (r.entity_id) {
            if (isActionSubpath(r.entity_id)) {
                entity_label = r.entity_id;  // já é legível ("summary", "runs"...)
            } else if (labelsByTypeId[r.entity_type]?.has(r.entity_id)) {
                entity_label = labelsByTypeId[r.entity_type].get(r.entity_id);
            } else if (r.entity_id.length === 36) {
                entity_label = r.entity_id.slice(0, 8) + '…';  // UUID não resolvido (item apagado?)
            } else {
                entity_label = r.entity_id;
            }
        }
        return { ...r, entity_label };
    });
}

// GET / — lista paginada com filtros
router.get('/', requireRole(ADMIN_ROLES), async (req, res) => {
    try {
        const { user_id, method, entity_type, status_min, status_max,
                from_date, to_date, format, limit = 100, page = 1 } = req.query;

        let q = supabaseAdmin
            .from('inv_access_log')
            .select('*', { count: 'exact' })
            .order('created_at', { ascending: false });

        if (user_id)     q = q.eq('user_id', user_id);
        if (method)      q = q.eq('method', method.toUpperCase());
        if (entity_type) q = q.eq('entity_type', entity_type);
        if (status_min)  q = q.gte('status_code', parseInt(status_min));
        if (status_max)  q = q.lte('status_code', parseInt(status_max));
        if (from_date)   q = q.gte('created_at', from_date);
        if (to_date)     q = q.lte('created_at', to_date);

        if (format && format !== 'json') {
            const { data, error } = await q.limit(10000);
            if (error) throw error;
            const withUsers = await attachUserProfiles(data || []);
            const enriched  = await attachEntityLabels(withUsers);
            const rows = enriched.map(r => ({
                created_at:   new Date(r.created_at).toLocaleString('pt-PT'),
                user:         r.user?.display_name || r.user?.email || (r.user_id ? r.user_id.slice(0, 8) : '—'),
                ip:           r.ip || '—',
                method:       r.method,
                path:         r.path,
                entity_type:  r.entity_type || '—',
                entity_label: r.entity_label || '—',
                status:       r.status_code,
                duration_ms:  r.duration_ms
            }));
            return sendReport(res, format, {
                title: 'Log de Acesso (§17)',
                subtitle: 'Auditoria de chamadas à API do inventário',
                columns: [
                    { key: 'created_at',   label: 'Data/hora',  width: 110 },
                    { key: 'user',         label: 'Utilizador', width: 100 },
                    { key: 'ip',           label: 'IP',         width: 80  },
                    { key: 'method',       label: 'Método',     width: 50  },
                    { key: 'path',         label: 'Path',       width: 150 },
                    { key: 'entity_type',  label: 'Tipo',       width: 60  },
                    { key: 'entity_label', label: 'Alvo',       width: 130 },
                    { key: 'status',       label: 'Status',     width: 45  },
                    { key: 'duration_ms',  label: 'ms',         width: 45  }
                ],
                rows
            });
        }

        const offset = (parseInt(page) - 1) * parseInt(limit);
        const { data, error, count } = await q.range(offset, offset + parseInt(limit) - 1);
        if (error) throw error;
        const enriched = await attachUserProfiles(data || []);
        res.json({
            success: true,
            data: enriched,
            pagination: { page: parseInt(page), limit: parseInt(limit), total: count, totalPages: Math.ceil((count || 0) / parseInt(limit)) }
        });
    } catch (err) {
        console.error('GET access-log error:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /purge — força a purga manual (utilitário)
router.post('/purge', requireRole(ADMIN_ROLES), async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin.rpc('fn_inv_purge_access_log');
        if (error) throw error;
        res.json({ success: true, data: { deleted: data } });
    } catch (err) {
        console.error('POST access-log/purge error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
