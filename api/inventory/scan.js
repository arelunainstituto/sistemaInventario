const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { requirePermission } = require('../middleware/auth');

const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Campos do item que o PDV/telas precisam para resolver uma saída/baixa.
const ITEM_FIELDS = 'id, internal_code, name, macro_category, controls_lot, base_uom_id, consumption_uom_id, cmp, image_url';

// GET /:qrCode — resolve um QR (UUID) para item, LOTE ou número de SÉRIE.
//
// É o CONTRATO lido pela ficha (item-view) e, futuramente, pelo PDV para dar
// baixa: devolve o tipo + o item + o lote/série. Busca sequencial
// item → lote → série (espaço de UUID é disjunto; o caminho legado de item —
// etiquetas já impressas — bate na 1ª query). Resposta:
//   { success, data: { type: 'item'|'lot'|'serial',
//                      item: {...}, lot: null|{...}, serial: null|{...} } }
router.get('/:qrCode', requirePermission('inventory', 'read'), async (req, res) => {
    try {
        const { qrCode } = req.params;
        if (!/^[0-9a-f-]{36}$/i.test(qrCode)) {
            return res.status(400).json({ error: 'QR Code inválido' });
        }

        // 1) Item (qr_code do próprio item — inclui o fallback de consumo sem lote
        //    e a compatibilidade com etiquetas de item já impressas).
        const { data: item } = await supabaseAdmin
            .from('inv_items')
            .select(ITEM_FIELDS)
            .eq('qr_code', qrCode)
            .is('deleted_at', null)
            .maybeSingle();
        if (item) {
            return res.json({ success: true, data: { type: 'item', item, lot: null, serial: null } });
        }

        // 2) Lote
        const { data: lotRow } = await supabaseAdmin
            .from('inv_lots')
            .select(`id, lot_number, expiry_date, item:inv_items!item_id(${ITEM_FIELDS})`)
            .eq('qr_code', qrCode)
            .maybeSingle();
        if (lotRow && lotRow.item) {
            const { item: lotItem, ...lot } = lotRow;
            return res.json({ success: true, data: { type: 'lot', item: lotItem, lot, serial: null } });
        }

        // 3) Número de série (patrimônio)
        const { data: serialRow } = await supabaseAdmin
            .from('inv_serial_units')
            .select(`id, serial_number, status, current_location_id, current_holder_id, item:inv_items!item_id(${ITEM_FIELDS})`)
            .eq('qr_code', qrCode)
            .is('deleted_at', null)
            .maybeSingle();
        if (serialRow && serialRow.item) {
            const { item: serialItem, ...serial } = serialRow;
            return res.json({ success: true, data: { type: 'serial', item: serialItem, lot: null, serial } });
        }

        return res.status(404).json({ error: 'QR Code não encontrado' });
    } catch (err) {
        console.error('GET inv_scan/:qrCode error:', err);
        res.status(500).json({ error: err.message || 'Erro ao resolver QR Code' });
    }
});

module.exports = router;
