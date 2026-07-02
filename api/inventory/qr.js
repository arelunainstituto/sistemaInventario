const express = require('express');
const router = express.Router();
const QRCode = require('qrcode');
const { requirePermission } = require('../middleware/auth');

// GET /:token — gera a IMAGEM do QR (data URL) para um token (UUID de item,
// lote ou série). Não toca no banco: o token JÁ É o payload — o QR codifica
// .../item-view.html?qr=<token>, resolvido pelo /scan (item/lote/série).
// Reutilizável por qualquer etiqueta. UUID-guard para não refletir input
// arbitrário na URL/imagem.
router.get('/:token', requirePermission('inventory', 'read'), async (req, res) => {
    try {
        const { token } = req.params;
        if (!/^[0-9a-f-]{36}$/i.test(token)) {
            return res.status(400).json({ error: 'Token inválido' });
        }
        const base = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`;
        const payload = `${base}/inventory/item-view.html?qr=${token}`;
        const dataUrl = await QRCode.toDataURL(payload, { width: 512, margin: 2 });

        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.json({ success: true, data: { token, payload, data_url: dataUrl } });
    } catch (err) {
        console.error('GET inv_qr/:token error:', err);
        res.status(500).json({ error: err.message || 'Erro ao gerar QR Code' });
    }
});

module.exports = router;
