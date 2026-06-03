const express = require('express');
const router = express.Router();
const { requirePermission } = require('../middleware/auth');
const { supabaseAdmin, attachCancellationStatus } = require('./_stock');
const { sendReport } = require('./_export');

const MOVEMENT_SELECT = `
    id, type, subtype, quantity, unit_cost, total_cost, cmp_at_moment,
    document_type, document_number, justification, occurred_at, user_id,
    reversal_of_movement_id,
    item:inv_items!item_id(id, internal_code, name, macro_category),
    lot:inv_lots!lot_id(id, lot_number, expiry_date),
    from_location:inv_locations!from_location_id(id, name, unit:inv_units!unit_id(id, name)),
    to_location:inv_locations!to_location_id(id, name, unit:inv_units!unit_id(id, name)),
    supplier:inv_suppliers!supplier_id(id, name)
`;

const VALID_TYPES = ['entrada','saida','transferencia_saida','transferencia_entrada','ajuste','inventario','depreciacao'];

// Constrói a query base com os filtros (compartilhada por list e export)
function buildQuery(req, withCount = false) {
    const opts = withCount ? { count: 'exact' } : undefined;
    let q = supabaseAdmin
        .from('inv_movements')
        .select(MOVEMENT_SELECT, opts)
        .order('occurred_at', { ascending: false });

    const { item_id, location_id, user_id, type, subtype, from_date, to_date } = req.query;
    if (item_id)   q = q.eq('item_id', item_id);
    if (user_id)   q = q.eq('user_id', user_id);
    if (subtype)   q = q.eq('subtype', subtype);
    if (from_date) q = q.gte('occurred_at', from_date);
    if (to_date)   q = q.lte('occurred_at', to_date);

    // location_id: bate em from_location_id OU to_location_id
    if (location_id) {
        q = q.or(`from_location_id.eq.${location_id},to_location_id.eq.${location_id}`);
    }
    // type pode ser CSV
    if (type) {
        const types = type.split(',').map(t => t.trim()).filter(t => VALID_TYPES.includes(t));
        if (types.length) q = q.in('type', types);
    }
    return q;
}

// GET / — listagem paginada
router.get('/', requirePermission('inventory', 'read'), async (req, res) => {
    try {
        const { limit = 100, page = 1, format } = req.query;

        // Quando há format de export, devolvemos TODOS os registos do filtro (sem paginação)
        if (format && format !== 'json') {
            const { data, error } = await buildQuery(req).limit(5000);
            if (error) throw error;
            const rows = (data || []).map(m => ({
                occurred_at:     new Date(m.occurred_at).toLocaleString('pt-PT'),
                type:            m.type,
                subtype:         m.subtype || '—',
                item_code:       m.item?.internal_code,
                item_name:       m.item?.name,
                quantity:        parseFloat(m.quantity).toFixed(4),
                from_location:   m.from_location ? `${m.from_location.unit?.name || ''} · ${m.from_location.name}` : '—',
                to_location:     m.to_location   ? `${m.to_location.unit?.name   || ''} · ${m.to_location.name}`   : '—',
                lot:             m.lot?.lot_number || '—',
                cmp_at_moment:   m.cmp_at_moment ? `€ ${parseFloat(m.cmp_at_moment).toFixed(2)}` : '—',
                document:        m.document_number || '—',
                supplier:        m.supplier?.name || '—',
                justification:   m.justification || ''
            }));
            return sendReport(res, format, {
                title: 'Histórico de Movimentos',
                subtitle: 'Listagem completa com filtros aplicados',
                columns: [
                    { key: 'occurred_at',   label: 'Data/hora',     width: 110 },
                    { key: 'type',          label: 'Tipo',          width: 80  },
                    { key: 'subtype',       label: 'Subtipo',       width: 80  },
                    { key: 'item_code',     label: 'Código',        width: 55  },
                    { key: 'item_name',     label: 'Item',          width: 140 },
                    { key: 'quantity',      label: 'Qtd',           width: 50  },
                    { key: 'from_location', label: 'Origem',        width: 100 },
                    { key: 'to_location',   label: 'Destino',       width: 100 },
                    { key: 'lot',           label: 'Lote',          width: 50  },
                    { key: 'cmp_at_moment', label: 'CMP €',         width: 55  },
                    { key: 'justification', label: 'Justificação',  width: 130 }
                ],
                rows
            });
        }

        // Paginação normal
        const offset = (parseInt(page) - 1) * parseInt(limit);
        const { data, error, count } = await buildQuery(req, true)
            .range(offset, offset + parseInt(limit) - 1);
        if (error) throw error;
        const enriched = await attachCancellationStatus(data || []);
        res.json({
            success: true,
            data: enriched,
            pagination: { page: parseInt(page), limit: parseInt(limit), total: count, totalPages: Math.ceil((count || 0) / parseInt(limit)) }
        });
    } catch (err) {
        console.error('GET movements error:', err);
        res.status(500).json({ error: err.message || 'Erro ao listar movimentos' });
    }
});

// GET /:id — detalhe de um movimento (usado pelo comprovante de impressão)
router.get('/:id', requirePermission('inventory', 'read'), async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('vw_inv_movements_with_status')
            .select(`*,
                item:inv_items!item_id(id, internal_code, name, macro_category),
                lot:inv_lots!lot_id(id, lot_number, expiry_date),
                from_location:inv_locations!from_location_id(id, name, unit:inv_units!unit_id(id, name)),
                to_location:inv_locations!to_location_id(id, name, unit:inv_units!unit_id(id, name)),
                supplier:inv_suppliers!supplier_id(id, name)`)
            .eq('id', req.params.id)
            .single();
        if (error) throw error;
        if (!data) return res.status(404).json({ error: 'Movimento não encontrado' });
        res.json({ success: true, data });
    } catch (err) {
        console.error('GET movement/:id error:', err);
        res.status(500).json({ error: err.message || 'Erro ao obter movimento' });
    }
});

// POST /:id/cancel — inativa o movimento gerando um estorno espelho (Admin only).
// Body: { reason: string (>= 5 chars) }
// Para transferências, cancela atomicamente o par (saida + entrada).
const { requireRole } = require('../middleware/auth');
const ADMIN_ROLES = ['Inventory_Admin', 'Admin', 'admin'];

router.post('/:id/cancel', requireRole(ADMIN_ROLES), async (req, res) => {
    try {
        const { reason } = req.body || {};
        if (!reason || String(reason).trim().length < 5) {
            return res.status(400).json({ error: 'Motivo é obrigatório (mínimo 5 caracteres)' });
        }
        const { data, error } = await supabaseAdmin.rpc('fn_inv_cancel_movement', {
            p_movement_id: req.params.id,
            p_user_id:     req.user?.id || null,
            p_reason:      reason
        });
        if (error) {
            if (error.code === '22023') return res.status(400).json({ error: error.message });
            if (error.code === '02000') return res.status(404).json({ error: error.message });
            if (error.code === 'P0001') return res.status(400).json({ error: error.message });
            if (error.code === 'P0002') return res.status(409).json({ error: error.message });
            throw error;
        }
        res.json({ success: true, data: { reversal_id: data } });
    } catch (err) {
        console.error('POST movement/:id/cancel error:', err);
        res.status(500).json({ error: err.message || 'Erro ao cancelar movimento' });
    }
});

module.exports = router;
