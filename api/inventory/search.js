const express = require('express');
const router = express.Router();
const { requirePermission } = require('../middleware/auth');
const { supabaseAdmin } = require('./_stock');

// GET / — busca cross-entity (itens, lotes, fornecedores)
// query: ?q=<termo>&limit=10
router.get('/', requirePermission('inventory', 'read'), async (req, res) => {
    try {
        const q = (req.query.q || '').trim();
        const limit = Math.min(parseInt(req.query.limit) || 10, 25);
        if (q.length < 2) return res.json({ success: true, data: { items: [], lots: [], suppliers: [] } });

        const pattern = `%${q}%`;

        // 3 queries em paralelo
        const [itemsRes, lotsRes, suppliersRes] = await Promise.all([
            supabaseAdmin
                .from('inv_items')
                .select('id, internal_code, name, macro_category, image_url, is_active')
                .is('deleted_at', null)
                .or(`name.ilike.${pattern},internal_code.ilike.${pattern},manufacturer_ref.ilike.${pattern},barcode.ilike.${pattern}`)
                .limit(limit),
            supabaseAdmin
                .from('inv_lots')
                .select('id, lot_number, expiry_date, item:inv_items!item_id(id, internal_code, name)')
                .ilike('lot_number', pattern)
                .eq('is_active', true)
                .limit(limit),
            supabaseAdmin
                .from('inv_suppliers')
                .select('id, name, tax_id, email, is_active')
                .is('deleted_at', null)
                .or(`name.ilike.${pattern},tax_id.ilike.${pattern}`)
                .limit(limit)
        ]);

        if (itemsRes.error)     throw itemsRes.error;
        if (lotsRes.error)      throw lotsRes.error;
        if (suppliersRes.error) throw suppliersRes.error;

        res.json({
            success: true,
            data: {
                items:     itemsRes.data     || [],
                lots:      lotsRes.data      || [],
                suppliers: suppliersRes.data || []
            }
        });
    } catch (err) {
        console.error('GET inventory/search error:', err);
        res.status(500).json({ error: err.message || 'Erro na busca' });
    }
});

module.exports = router;
