// Fase 4.3 — CRUD de overrides de parâmetros por (item, localização).
// Montado em /api/inventory/items/:itemId/location-params (mergeParams).
//
// GET    /          → lista efetiva (1 linha por location ativa, com is_override e source_*)
// PUT    /:locationId → upsert override (campos nullable = "herda")
// DELETE /:locationId → remove override (soft delete)
//
// Apenas itens consumo aceitam overrides — garantido por trigger no DB
// (fn_inv_ilp_check_macro) que devolve SQLSTATE 22023.

const express = require('express');
const router  = express.Router({ mergeParams: true });
const { requirePermission } = require('../middleware/auth');
const { supabaseAdmin }     = require('./_stock');

// Campos editáveis no override. Cliente pode mandar null em qualquer um para
// remover o override desse campo (volta a herdar do item ou category).
const OVERRIDE_FIELDS = ['min_stock','max_stock','lead_time_days','reorder_point','consumption_window_days','notes'];

// GET / — devolve params efetivos por localização ativa
router.get('/', requirePermission('inventory', 'read'), async (req, res) => {
    try {
        const { itemId } = req.params;

        // Confirma macro = consumo (para devolver lista vazia + mensagem clara em patrimoniais)
        const { data: item, error: itemErr } = await supabaseAdmin
            .from('inv_items')
            .select('id, macro_category, name, internal_code')
            .eq('id', itemId)
            .is('deleted_at', null)
            .single();
        if (itemErr) throw itemErr;
        if (!item) return res.status(404).json({ error: 'Item não encontrado' });

        if (item.macro_category !== 'consumo') {
            return res.json({
                success: true,
                data: [],
                message: 'Overrides de parâmetros por localização aplicam-se apenas a itens de consumo'
            });
        }

        const { data, error } = await supabaseAdmin
            .from('vw_inv_item_effective_params')
            .select('*')
            .eq('item_id', itemId)
            .order('location_name', { ascending: true });
        if (error) throw error;

        res.json({ success: true, data: data || [] });
    } catch (err) {
        console.error('GET item-location-params error:', err);
        res.status(500).json({ error: err.message });
    }
});

// PUT /:locationId — upsert override.
// Body: { min_stock?, max_stock?, lead_time_days?, reorder_point?, consumption_window_days?, notes? }
// Qualquer campo omitido OU explicitamente null = "herda".
router.put('/:locationId', requirePermission('inventory', 'update_item'), async (req, res) => {
    try {
        const { itemId, locationId } = req.params;

        // Filtra apenas campos aceitos do body (defesa contra mass-assignment)
        const payload = {};
        for (const f of OVERRIDE_FIELDS) {
            if (Object.prototype.hasOwnProperty.call(req.body, f)) payload[f] = req.body[f];
        }

        // Validação leve: window_days deve estar no enum permitido se fornecido
        if (payload.consumption_window_days !== undefined && payload.consumption_window_days !== null) {
            const allowed = [30, 60, 90, 180, 365];
            if (!allowed.includes(parseInt(payload.consumption_window_days))) {
                return res.status(400).json({ error: `consumption_window_days deve ser ${allowed.join('|')}` });
            }
        }

        // Verifica existência antes para diferenciar INSERT/UPDATE
        const { data: existing } = await supabaseAdmin
            .from('inv_item_location_params')
            .select('id')
            .eq('item_id',     itemId)
            .eq('location_id', locationId)
            .is('deleted_at', null)
            .maybeSingle();

        let resultRow, opError;
        if (existing) {
            const { data, error } = await supabaseAdmin
                .from('inv_item_location_params')
                .update({ ...payload, updated_by: req.user?.id || null })
                .eq('id', existing.id)
                .select()
                .single();
            resultRow = data; opError = error;
        } else {
            const { data, error } = await supabaseAdmin
                .from('inv_item_location_params')
                .insert({
                    item_id:     itemId,
                    location_id: locationId,
                    ...payload,
                    created_by:  req.user?.id || null,
                    updated_by:  req.user?.id || null
                })
                .select()
                .single();
            resultRow = data; opError = error;
        }

        if (opError) {
            // Trigger fn_inv_ilp_check_macro devolve 22023 para patrimoniais
            if (opError.code === '22023') {
                return res.status(400).json({ error: opError.message });
            }
            // CHECK constraint chk_ilp_max_gte_min
            if (opError.code === '23514') {
                return res.status(400).json({ error: 'max_stock deve ser >= min_stock' });
            }
            throw opError;
        }

        res.json({ success: true, data: resultRow });
    } catch (err) {
        console.error('PUT item-location-params error:', err);
        res.status(500).json({ error: err.message });
    }
});

// DELETE /:locationId — remove o override (soft delete) → params voltam a herdar
router.delete('/:locationId', requirePermission('inventory', 'update_item'), async (req, res) => {
    try {
        const { itemId, locationId } = req.params;

        const { data, error } = await supabaseAdmin
            .from('inv_item_location_params')
            .update({ deleted_at: new Date().toISOString(), updated_by: req.user?.id || null })
            .eq('item_id',     itemId)
            .eq('location_id', locationId)
            .is('deleted_at', null)
            .select()
            .maybeSingle();
        if (error) throw error;

        if (!data) return res.status(404).json({ error: 'Override não encontrado para esta (item, localização)' });
        res.json({ success: true });
    } catch (err) {
        console.error('DELETE item-location-params error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
