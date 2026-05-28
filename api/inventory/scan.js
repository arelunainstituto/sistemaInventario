const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { requirePermission } = require('../middleware/auth');

const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// GET /:qrCode — resolve QR → item (usado pela tela scan.html)
router.get('/:qrCode', requirePermission('inventory', 'read'), async (req, res) => {
    try {
        const { qrCode } = req.params;
        // qrCode é UUID v4 (gerado em inv_items.qr_code default gen_random_uuid)
        if (!/^[0-9a-f-]{36}$/i.test(qrCode)) {
            return res.status(400).json({ error: 'QR Code inválido' });
        }
        const { data, error } = await supabaseAdmin
            .from('inv_items')
            .select('id, name, internal_code, macro_category, qr_code, image_url, cmp, is_active')
            .eq('qr_code', qrCode)
            .is('deleted_at', null)
            .single();
        if (error || !data) return res.status(404).json({ error: 'Item não encontrado' });
        res.json({ success: true, data });
    } catch (err) {
        console.error('GET inv_scan/:qrCode error:', err);
        res.status(500).json({ error: err.message || 'Erro ao resolver QR Code' });
    }
});

module.exports = router;
