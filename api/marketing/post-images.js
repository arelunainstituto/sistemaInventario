// CRUD da galeria de imagens por post (marketing_post_images).
// Cada imagem fica vinculada a um post_id e é usada no <figure> do content.
// O hero (imagem principal) continua em marketing_posts.image_url — esta
// galeria é só para imagens INLINE no corpo.

const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const { createClient } = require('@supabase/supabase-js');
const { requireRole } = require('../middleware/auth');

const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const WRITE_ROLES = ['Marketing', 'Admin', 'admin', 'employee'];

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) cb(null, true);
        else cb(new Error('Apenas imagens são permitidas'), false);
    }
});

async function uploadImage(file) {
    const safe = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const path = `marketing/gallery/${Date.now()}-${safe}`;
    const { error } = await supabaseAdmin.storage
        .from('item-images')
        .upload(path, file.buffer, { contentType: file.mimetype, upsert: true });
    if (error) throw error;
    const { data } = supabaseAdmin.storage.from('item-images').getPublicUrl(path);
    return data.publicUrl;
}

// GET /:postId — lista imagens da galeria de um post
router.get('/:postId', requireRole(WRITE_ROLES), async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('marketing_post_images')
            .select('*')
            .eq('post_id', req.params.postId)
            .order('sort_order', { ascending: true })
            .order('created_at', { ascending: true });
        if (error) throw error;
        res.json({ success: true, data: data || [] });
    } catch (err) {
        console.error('GET post-images error:', err);
        res.status(500).json({ error: err.message || 'Erro ao listar galeria' });
    }
});

// POST /:postId — upload de imagem para a galeria do post
router.post('/:postId', requireRole(WRITE_ROLES), upload.single('image'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'Arquivo obrigatório (campo "image")' });

        const url = await uploadImage(req.file);
        const { alt = null, caption = null } = req.body || {};

        const { data, error } = await supabaseAdmin
            .from('marketing_post_images')
            .insert([{
                post_id:    req.params.postId,
                url,
                alt:        alt || null,
                caption:    caption || null,
                sort_order: 0,
                created_by: req.user?.id || null
            }])
            .select()
            .single();
        if (error) throw error;
        res.status(201).json({ success: true, data });
    } catch (err) {
        console.error('POST post-images error:', err);
        res.status(500).json({ error: err.message || 'Erro ao subir imagem' });
    }
});

// PUT /:postId/:imageId — atualizar alt/caption/ordem
router.put('/:postId/:imageId', requireRole(WRITE_ROLES), async (req, res) => {
    try {
        const { alt, caption, sort_order } = req.body || {};
        const patch = {};
        if (alt !== undefined)        patch.alt = alt || null;
        if (caption !== undefined)    patch.caption = caption || null;
        if (sort_order !== undefined) patch.sort_order = Number(sort_order) || 0;

        const { data, error } = await supabaseAdmin
            .from('marketing_post_images')
            .update(patch)
            .eq('id', req.params.imageId)
            .eq('post_id', req.params.postId)
            .select()
            .single();
        if (error) throw error;
        res.json({ success: true, data });
    } catch (err) {
        console.error('PUT post-images error:', err);
        res.status(500).json({ error: err.message || 'Erro ao atualizar imagem' });
    }
});

// DELETE /:postId/:imageId
router.delete('/:postId/:imageId', requireRole(WRITE_ROLES), async (req, res) => {
    try {
        const { error } = await supabaseAdmin
            .from('marketing_post_images')
            .delete()
            .eq('id', req.params.imageId)
            .eq('post_id', req.params.postId);
        if (error) throw error;
        res.json({ success: true });
    } catch (err) {
        console.error('DELETE post-images error:', err);
        res.status(500).json({ error: err.message || 'Erro ao excluir imagem' });
    }
});

module.exports = router;
