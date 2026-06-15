const express = require('express');
const router = express.Router();
const { requirePermission, requireRole } = require('../middleware/auth');
const { supabaseAdmin, getStockByItem, parsePgException, attachCancellationStatus } = require('./_stock');

// A partir da F5.4, saídas de operador só podem ser de tipo 'consumo'.
// Avarias/extravios/perdas/quebras viraram fluxo administrativo e são
// lançados pela tela de Ajustes (acesso restrito a Admin).
const VALID_SUBTYPES        = ['consumo'];
const ADMIN_SUBTYPES        = ['avaria','extravio','perda','quebra','depreciacao'];
const ALL_VALID_SUBTYPES    = [...VALID_SUBTYPES, ...ADMIN_SUBTYPES];
const ADMIN_ROLES           = ['Inventory_Admin','Admin','admin'];

const MOVEMENT_SELECT = `
    id, type, subtype, quantity, unit_cost, total_cost, cmp_at_moment,
    justification, occurred_at, created_at, reversal_of_movement_id,
    item:inv_items!item_id(id, name, internal_code, macro_category),
    lot:inv_lots!lot_id(id, lot_number, expiry_date),
    from_location:inv_locations!from_location_id(id, name, unit:inv_units!unit_id(id, name))
`;

// GET /stock-by-item/:itemId — usado pela UI para mostrar stock disponível
//
// Modo seeding (feature flag inv_system_settings.allow_negative_stock = true):
// quando o item não tem stock em parte alguma, retorna localizações sintéticas
// (quantity=0) para que a UI consiga oferecer um dropdown de origem. O
// backend só vai aceitar a saída se a regra de negócio do DB também permitir
// (fn_inv_consume respeita o mesmo flag — ver 100-allow-negative-stock-toggle.sql).
router.get('/stock-by-item/:itemId', requirePermission('inventory', 'read'), async (req, res) => {
    try {
        const data = await getStockByItem(req.params.itemId);

        if (!data.length) {
            // Checa o flag global; se ON, devolve todas as localizações ativas (sintéticas)
            const { data: flagRow } = await supabaseAdmin
                .from('inv_system_settings')
                .select('value')
                .eq('key', 'allow_negative_stock')
                .maybeSingle();
            const allowNeg = ['true', 't', '1', 'yes', 'on']
                .includes(String(flagRow?.value || '').trim().toLowerCase());

            if (allowNeg) {
                const { data: locs } = await supabaseAdmin
                    .from('inv_locations')
                    .select('id, name, can_send, unit:inv_units!unit_id(id, name)')
                    .eq('is_active', true)
                    .is('deleted_at', null);
                const synthetic = (locs || [])
                    .filter(l => l.can_send !== false)
                    .map(l => ({
                        quantity:    0,
                        location_id: l.id,
                        lot_id:      null,
                        location:    l,
                        lot:         null
                    }));
                return res.json({ success: true, data: synthetic, seeding_mode: true });
            }
        }

        res.json({ success: true, data });
    } catch (err) {
        console.error('GET stock-by-item error:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET / — lista saídas (movements type='saida')
router.get('/', requirePermission('inventory', 'read'), async (req, res) => {
    try {
        const { item_id, location_id, subtype, from_date, to_date, limit = 50, page = 1 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        let q = supabaseAdmin
            .from('inv_movements')
            .select(MOVEMENT_SELECT, { count: 'exact' })
            .eq('type', 'saida')
            .order('occurred_at', { ascending: false })
            .range(offset, offset + parseInt(limit) - 1);
        if (item_id)     q = q.eq('item_id', item_id);
        if (location_id) q = q.eq('from_location_id', location_id);
        if (subtype)     q = q.eq('subtype', subtype);
        if (from_date)   q = q.gte('occurred_at', from_date);
        if (to_date)     q = q.lte('occurred_at', to_date);

        const { data, error, count } = await q;
        if (error) throw error;
        const enriched = await attachCancellationStatus(data || []);
        res.json({
            success: true,
            data: enriched,
            pagination: { page: parseInt(page), limit: parseInt(limit), total: count, totalPages: Math.ceil((count || 0) / parseInt(limit)) }
        });
    } catch (err) {
        console.error('GET exits error:', err);
        res.status(500).json({ error: err.message || 'Erro ao listar saídas' });
    }
});

// POST / — lançar saída
router.post('/', requirePermission('inventory', 'exit'), async (req, res) => {
    try {
        const { item_id, location_id, quantity, lot_id, subtype, justification, confirmed_low_stock } = req.body;

        if (!item_id)     return res.status(400).json({ error: 'item_id é obrigatório' });
        if (!location_id) return res.status(400).json({ error: 'location_id é obrigatório' });
        if (!(quantity > 0)) return res.status(400).json({ error: 'quantity deve ser > 0' });
        if (!subtype) return res.status(400).json({ error: 'subtype é obrigatório' });
        if (!ALL_VALID_SUBTYPES.includes(subtype))
            return res.status(400).json({ error: `subtype deve ser um de: ${ALL_VALID_SUBTYPES.join(', ')}` });
        // F5.4: subtype não-consumo é fluxo administrativo (avaria/extravio/perda/
        // quebra/depreciacao). Só Admin pode lançar via este endpoint —
        // operador comum cai no fluxo de Ajustes.
        const userRoles = Array.isArray(req.user?.roles) ? req.user.roles : [];
        const isAdmin   = userRoles.some(r => ADMIN_ROLES.includes(r));
        if (ADMIN_SUBTYPES.includes(subtype) && !isAdmin) {
            return res.status(403).json({
                error: `Tipo "${subtype}" é restrito a Inventory_Admin. Use a tela de Ajustes.`
            });
        }

        // Fronteira de macro: saída de CONSUMO. Item patrimonial recebe baixa
        // pelo módulo Patrimônio › Saída — bloqueia aqui mesmo via API direta.
        const { data: itemMeta } = await supabaseAdmin
            .from('inv_items').select('name, macro_category').eq('id', item_id).single();
        if (!itemMeta) return res.status(400).json({ error: 'Item não encontrado' });
        if (itemMeta.macro_category !== 'consumo')
            return res.status(400).json({ error: `"${itemMeta.name}" é patrimonial — use Patrimônio › Saída` });

        const { data, error } = await supabaseAdmin.rpc('fn_inv_consume', {
            p_item: item_id,
            p_location: location_id,
            p_qty: quantity,
            p_lot: lot_id || null,
            p_subtype: subtype,
            p_justification: justification || null,
            p_user: req.user?.id || null,
            p_confirmed_low_stock: !!confirmed_low_stock,
            p_movement_type: 'saida'
        });

        if (error) {
            const pg = parsePgException(error.message);
            if (pg && pg.code === 'LOW_STOCK_CONFIRMATION_REQUIRED') {
                return res.status(409).json({
                    error: 'Stock ficará abaixo do mínimo após esta saída',
                    code: 'LOW_STOCK_CONFIRMATION_REQUIRED',
                    details: pg.fields
                });
            }
            if (error.code === 'P0002') return res.status(400).json({ error: error.message, code: 'INSUFFICIENT_STOCK' });
            if (error.code === 'P0001') return res.status(400).json({ error: error.message });
            throw error;
        }

        res.status(201).json({ success: true, data: { movement_id: data } });
    } catch (err) {
        console.error('POST exits error:', err);
        res.status(500).json({ error: err.message || 'Erro ao lançar saída' });
    }
});

module.exports = router;
