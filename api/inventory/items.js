const express = require('express');
const router = express.Router();
const multer = require('multer');
const QRCode = require('qrcode');
const { createClient } = require('@supabase/supabase-js');
const { requirePermission } = require('../middleware/auth');

const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 8 * 1024 * 1024 }
});

// Hint explícito de FK é necessário porque inv_items tem 3 FKs para
// inv_units_of_measure (base/purchase/consumption). Sem o "!fk_column"
// o PostgREST falha ao tentar resolver a relação.
const ITEM_SELECT = `
    *,
    subcategory:inv_categories!subcategory_id(id, parent_macro, name),
    base_uom:inv_units_of_measure!base_uom_id(id, code, name),
    purchase_uom:inv_units_of_measure!purchase_uom_id(id, code, name),
    consumption_uom:inv_units_of_measure!consumption_uom_id(id, code, name)
`;

// Validação de payload por macro_category
function validateItemPayload(body, isUpdate = false) {
    const errors = [];
    if (!isUpdate) {
        if (!body.macro_category) errors.push('macro_category é obrigatório');
        else if (!['consumo','patrimonial'].includes(body.macro_category)) errors.push('macro_category inválido');
        if (!body.name)        errors.push('name é obrigatório');
        if (!body.base_uom_id) errors.push('base_uom_id é obrigatório');
    }
    if (body.macro_category === 'consumo') {
        const forbidden = ['patrimony_number','acquisition_date','acquisition_value','depreciation_rate','asset_status'];
        for (const f of forbidden) {
            if (body[f] !== undefined && body[f] !== null && body[f] !== '') {
                errors.push(`Campo ${f} não é permitido para itens de consumo`);
            }
        }
    }
    return errors;
}

// Helper de upload para Supabase Storage (reaproveita bucket item-images)
async function uploadFile(file, folder) {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const path = `${folder}/${Date.now()}-${safeName}`;
    const bucket = folder === 'pdfs' ? 'item-pdfs' : 'item-images';
    const { error } = await supabaseAdmin.storage
        .from(bucket)
        .upload(path, file.buffer, { contentType: file.mimetype, upsert: true });
    if (error) throw error;
    const { data } = supabaseAdmin.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
}

// GET /  — lista itens com filtros
router.get('/', requirePermission('inventory', 'read'), async (req, res) => {
    try {
        const { macro_category, subcategory_id, search, include_inactive, limit = 100, page = 1 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        let q = supabaseAdmin
            .from('inv_items')
            .select(ITEM_SELECT, { count: 'exact' })
            .is('deleted_at', null)
            .order('name', { ascending: true })
            .range(offset, offset + parseInt(limit) - 1);

        if (!include_inactive)       q = q.eq('is_active', true);
        if (macro_category)          q = q.eq('macro_category', macro_category);
        if (subcategory_id)          q = q.eq('subcategory_id', subcategory_id);
        if (search) {
            q = q.or(`name.ilike.%${search}%,internal_code.ilike.%${search}%,manufacturer_ref.ilike.%${search}%,barcode.ilike.%${search}%`);
        }

        const { data, error, count } = await q;
        if (error) throw error;
        res.json({
            success: true,
            data,
            pagination: { page: parseInt(page), limit: parseInt(limit), total: count, totalPages: Math.ceil((count || 0) / parseInt(limit)) }
        });
    } catch (err) {
        console.error('GET inv_items error:', err);
        res.status(500).json({ error: err.message || 'Erro ao listar itens' });
    }
});

// GET /:id — detalhe + stock por localização
router.get('/:id', requirePermission('inventory', 'read'), async (req, res) => {
    try {
        const { id } = req.params;
        const { data: item, error } = await supabaseAdmin
            .from('inv_items')
            .select(ITEM_SELECT)
            .eq('id', id)
            .is('deleted_at', null)
            .single();
        if (error) throw error;
        if (!item) return res.status(404).json({ error: 'Item não encontrado' });

        // Stock agregado por localização (com lote)
        const { data: stock } = await supabaseAdmin
            .from('inv_stock')
            .select('quantity, lot:inv_lots(id, lot_number, expiry_date), location:inv_locations(id, name, unit:inv_units(id, name))')
            .eq('item_id', id);

        res.json({ success: true, data: { ...item, stock: stock || [] } });
    } catch (err) {
        console.error('GET inv_items/:id error:', err);
        res.status(500).json({ error: err.message || 'Erro ao obter item' });
    }
});

// POST / — cria item
router.post('/', requirePermission('inventory', 'create_item'), async (req, res) => {
    try {
        const errors = validateItemPayload(req.body, false);
        if (errors.length) return res.status(400).json({ error: errors.join('; ') });

        // Não confiar em controls_lot/uses_serial do cliente — trigger define
        const { controls_lot, uses_serial, internal_code, qr_code, patrimony_number, ...rest } = req.body;

        const payload = {
            ...rest,
            controls_lot: req.body.macro_category === 'consumo',
            uses_serial:  req.body.macro_category === 'patrimonial',
            created_by:   req.user?.id || null,
            updated_by:   req.user?.id || null
        };

        const { data, error } = await supabaseAdmin
            .from('inv_items')
            .insert(payload)
            .select(ITEM_SELECT)
            .single();
        if (error) throw error;
        res.status(201).json({ success: true, data });
    } catch (err) {
        console.error('POST inv_items error:', err);
        if (err.code === '23505') return res.status(409).json({ error: 'Conflito de unicidade (código interno ou QR)' });
        res.status(500).json({ error: err.message || 'Erro ao criar item' });
    }
});

// PUT /:id — edita
router.put('/:id', requirePermission('inventory', 'update_item'), async (req, res) => {
    try {
        const { id } = req.params;
        const errors = validateItemPayload(req.body, true);
        if (errors.length) return res.status(400).json({ error: errors.join('; ') });

        // Campos imutáveis após criação
        const immutable = ['internal_code','qr_code','macro_category','controls_lot','uses_serial','patrimony_number'];
        const patch = { updated_by: req.user?.id || null };
        for (const [k, v] of Object.entries(req.body)) {
            if (immutable.includes(k)) continue;
            patch[k] = v;
        }

        const { data, error } = await supabaseAdmin
            .from('inv_items')
            .update(patch)
            .eq('id', id)
            .select(ITEM_SELECT)
            .single();
        if (error) throw error;
        res.json({ success: true, data });
    } catch (err) {
        console.error('PUT inv_items error:', err);
        res.status(500).json({ error: err.message || 'Erro ao atualizar item' });
    }
});

// DELETE /:id — soft delete
router.delete('/:id', requirePermission('inventory', 'update_item'), async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabaseAdmin
            .from('inv_items')
            .update({ deleted_at: new Date().toISOString(), is_active: false, updated_by: req.user?.id || null })
            .eq('id', id);
        if (error) throw error;
        res.json({ success: true });
    } catch (err) {
        console.error('DELETE inv_items error:', err);
        res.status(500).json({ error: err.message || 'Erro ao remover item' });
    }
});

// POST /:id/image — upload imagem
router.post('/:id/image', requirePermission('inventory', 'update_item'), upload.single('image'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'Arquivo image ausente' });
        if (!req.file.mimetype.startsWith('image/')) return res.status(400).json({ error: 'Apenas imagens são permitidas' });
        const url = await uploadFile(req.file, 'inventory/items');
        const { error } = await supabaseAdmin.from('inv_items').update({ image_url: url }).eq('id', req.params.id);
        if (error) throw error;
        res.json({ success: true, image_url: url });
    } catch (err) {
        console.error('POST inv_items/:id/image error:', err);
        res.status(500).json({ error: err.message || 'Erro ao fazer upload de imagem' });
    }
});

// POST /:id/pdf — upload PDF (manual/ficha técnica)
router.post('/:id/pdf', requirePermission('inventory', 'update_item'), upload.single('pdf'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'Arquivo pdf ausente' });
        if (req.file.mimetype !== 'application/pdf') return res.status(400).json({ error: 'Apenas PDF é permitido' });
        const url = await uploadFile(req.file, 'pdfs');
        const { error } = await supabaseAdmin.from('inv_items').update({ pdf_url: url }).eq('id', req.params.id);
        if (error) throw error;
        res.json({ success: true, pdf_url: url });
    } catch (err) {
        console.error('POST inv_items/:id/pdf error:', err);
        res.status(500).json({ error: err.message || 'Erro ao fazer upload de PDF' });
    }
});

// GET /:id/qr.png — PNG do QR Code para etiqueta imprimível
router.get('/:id/qr.png', requirePermission('inventory', 'read'), async (req, res) => {
    try {
        const { id } = req.params;
        const { data: item, error } = await supabaseAdmin
            .from('inv_items')
            .select('qr_code, name')
            .eq('id', id)
            .single();
        if (error) throw error;
        if (!item) return res.status(404).end();

        // O payload do QR é a URL pública da página de scan — o celular abre direto
        const base = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`;
        const payload = `${base}/inventory/scan.html?code=${item.qr_code}`;
        const png = await QRCode.toBuffer(payload, { type: 'png', width: 512, margin: 2 });
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.send(png);
    } catch (err) {
        console.error('GET inv_items/:id/qr.png error:', err);
        res.status(500).json({ error: err.message || 'Erro ao gerar QR Code' });
    }
});

module.exports = router;
