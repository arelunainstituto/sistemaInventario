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

// GET / — lista paginada com filtros
router.get('/', requireRole(ADMIN_ROLES), async (req, res) => {
    try {
        const { user_id, method, entity_type, status_min, status_max,
                from_date, to_date, format, limit = 100, page = 1 } = req.query;

        let q = supabaseAdmin
            .from('inv_access_log')
            .select('*, user:user_profiles!user_id(id, display_name, email)', { count: 'exact' })
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
            const rows = (data || []).map(r => ({
                created_at:  new Date(r.created_at).toLocaleString('pt-PT'),
                user:        r.user?.display_name || r.user?.email || (r.user_id ? r.user_id.slice(0, 8) : '—'),
                ip:          r.ip || '—',
                method:      r.method,
                path:        r.path,
                entity_type: r.entity_type || '—',
                entity_id:   r.entity_id || '—',
                status:      r.status_code,
                duration_ms: r.duration_ms
            }));
            return sendReport(res, format, {
                title: 'Log de Acesso (§17)',
                subtitle: 'Auditoria de chamadas à API do inventário',
                columns: [
                    { key: 'created_at',  label: 'Data/hora',  width: 110 },
                    { key: 'user',        label: 'Utilizador', width: 110 },
                    { key: 'ip',          label: 'IP',         width: 80  },
                    { key: 'method',      label: 'Método',     width: 50  },
                    { key: 'path',        label: 'Path',       width: 180 },
                    { key: 'entity_type', label: 'Entidade',   width: 70  },
                    { key: 'status',      label: 'Status',     width: 45  },
                    { key: 'duration_ms', label: 'ms',         width: 45  }
                ],
                rows
            });
        }

        const offset = (parseInt(page) - 1) * parseInt(limit);
        const { data, error, count } = await q.range(offset, offset + parseInt(limit) - 1);
        if (error) throw error;
        res.json({
            success: true,
            data,
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
