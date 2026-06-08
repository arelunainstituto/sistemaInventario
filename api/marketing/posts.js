const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { requirePermission, requireRole } = require('../middleware/auth');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
const multer = require('multer');

// Configure multer
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Apenas imagens são permitidas'), false);
        }
    }
});

// Helper: slugify (espelha slugify_pt do SQL — manter os dois em sync)
function slugifyPt(input) {
    if (!input) return null;
    const map = {
        'á':'a','à':'a','â':'a','ã':'a','ä':'a',
        'é':'e','è':'e','ê':'e','ë':'e',
        'í':'i','ì':'i','î':'i','ï':'i',
        'ó':'o','ò':'o','ô':'o','õ':'o','ö':'o',
        'ú':'u','ù':'u','û':'u','ü':'u',
        'ç':'c','ñ':'n'
    };
    let s = String(input).toLowerCase();
    s = s.replace(/[áàâãäéèêëíìîïóòôõöúùûüçñ]/g, ch => map[ch] || ch);
    s = s.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    if (s.length > 80) s = s.slice(0, 80).replace(/-+$/, '');
    return s || null;
}

// Helper to upload image to Supabase Storage
async function uploadImageToStorage(file) {
    const fileName = `marketing/${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const { error } = await supabaseAdmin.storage
        .from('item-images') // Reusing existing bucket
        .upload(fileName, file.buffer, {
            contentType: file.mimetype,
            upsert: true
        });

    if (error) throw error;

    const { data } = supabaseAdmin.storage
        .from('item-images')
        .getPublicUrl(fileName);

    return data.publicUrl;
}

// GET / - List all posts
router.get('/', requireRole(['Marketing', 'Admin', 'admin', 'employee']), async (req, res) => {
    try {
        const { status, limit = 50, page = 1 } = req.query;
        const offset = (page - 1) * limit;

        let query = supabaseAdmin
            .from('marketing_posts')
            .select('*', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (status) {
            query = query.eq('status', status);
        }

        const { data, error, count } = await query;

        if (error) throw error;

        // Fetch author details manually to avoid cross-schema join issues
        const authorIds = [...new Set(data.map(post => post.author_id).filter(id => id))];
        const authorsMap = {};

        if (authorIds.length > 0) {
            // Using logic similar to auth middleware to get user profiles or fallback
            // Trying to get from user_profiles first if exists, else we might not be able to get emails easily without admin rights on auth.users
            // But we DO have supabaseAdmin here.

            // Note: retrieving users from auth.users via admin API is best if we need emails/metadata
            // However, listUsersByIds or similar might not exist, we have to iterate or use specific call?
            // Actually supabaseAdmin.auth.admin.listUsers() returns list, might not filter by list of IDs easily.
            // But we can just use the user_profiles table if it exists as established in middleware.

            // Let's try fetching from user_profiles as we saw in auth.js
            const { data: profiles } = await supabaseAdmin
                .from('user_profiles')
                .select('user_id, display_name, first_name, last_name, email')
                .in('user_id', authorIds);

            if (profiles) {
                profiles.forEach(p => {
                    authorsMap[p.user_id] = {
                        name: p.display_name || ((p.first_name || '') + ' ' + (p.last_name || '')).trim() || p.email,
                        email: p.email
                    };
                });
            }

            // For any missing authors (or if user_profiles is empty/missing), try to get from auth.users via admin
            // This acts as a fallback or primary way if user_profiles is not comprehensive
            const missingIds = authorIds.filter(id => !authorsMap[id]);
            if (missingIds.length > 0) {
                // Creating promises to fetch user data individually is inefficient but safe for small batches.
                // Better: Use Promise.all
                await Promise.all(missingIds.map(async (uid) => {
                    const { data: { user }, error: uErr } = await supabaseAdmin.auth.admin.getUserById(uid);
                    if (user && !uErr) {
                        authorsMap[uid] = {
                            name: user.user_metadata?.full_name || user.email,
                            email: user.email
                        };
                    }
                }));
            }
        }

        // Simplify author data
        const formattedData = data.map(post => ({
            ...post,
            author_name: post.custom_author || authorsMap[post.author_id]?.name || 'Desconhecido',
            author: {
                email: authorsMap[post.author_id]?.email
            }
        }));

        res.json({
            success: true,
            data: formattedData,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: count,
                totalPages: Math.ceil(count / limit)
            }
        });
    } catch (error) {
        console.error('Error fetching marketing posts:', error);
        res.status(500).json({ error: 'Erro ao buscar posts' });
    }
});

// GET /:id - Get single post
router.get('/:id', requireRole(['Marketing', 'Admin', 'admin', 'employee']), async (req, res) => {
    try {
        const { id } = req.params;

        const { data, error } = await supabaseAdmin
            .from('marketing_posts')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;

        // Fetch author details
        let authorData = { name: 'Desconhecido', email: '' };
        if (data.author_id) {
            // Try user_profiles first
            const { data: profile } = await supabaseAdmin
                .from('user_profiles')
                .select('display_name, first_name, last_name, email')
                .eq('user_id', data.author_id)
                .single();

            if (profile) {
                authorData = {
                    name: profile.display_name || ((profile.first_name || '') + ' ' + (profile.last_name || '')).trim() || profile.email,
                    email: profile.email
                };
            } else {
                // Fallback to auth.users
                const { data: { user }, error: uErr } = await supabaseAdmin.auth.admin.getUserById(data.author_id);
                if (user && !uErr) {
                    authorData = {
                        name: user.user_metadata?.full_name || user.email,
                        email: user.email
                    };
                }
            }
        }

        const formattedData = {
            ...data,
            author_name: data.custom_author || authorData.name,
            author: { email: authorData.email }
        };

        res.json({ success: true, data: formattedData });
    } catch (error) {
        console.error('Error fetching marketing post:', error);
        res.status(500).json({ error: 'Erro ao buscar post' });
    }
});

// POST / - Create post
router.post('/', requireRole(['Marketing', 'Admin', 'admin', 'employee']), upload.single('image'), async (req, res) => {
    try {
        let {
            title, content, excerpt, status = 'draft', tags = '[]',
            image_url, author_id, custom_author,
            // Campos do blog público (v2)
            slug, subtitle, image_caption, image_object_position,
            // Posts relacionados (v1.8: bloco "Leia também")
            related_post_ids
        } = req.body;

        // FormData pode enviar related_post_ids como string JSON
        if (typeof related_post_ids === 'string') {
            try { related_post_ids = JSON.parse(related_post_ids); }
            catch (_) { related_post_ids = null; }
        }
        if (!Array.isArray(related_post_ids)) related_post_ids = null;

        // Only Admins can set a different author
        const isAdmin = req.user.roles?.some(r => r.toLowerCase().includes('admin'));
        if (!isAdmin || !author_id) {
            author_id = req.user.id;
        }

        // Parse tags if sent as JSON string (common with FormData)
        if (typeof tags === 'string') {
            try {
                tags = JSON.parse(tags);
            } catch (e) {
                tags = [];
            }
        }

        // Handle File Upload
        if (req.file) {
            try {
                image_url = await uploadImageToStorage(req.file);
            } catch (e) {
                console.error('Upload error:', e);
                return res.status(500).json({ error: 'Erro ao fazer upload da imagem' });
            }
        }

        if (!title) {
            return res.status(400).json({ error: 'Título é obrigatório' });
        }

        // Auto-slug se não vier preenchido. Se vier do form, normaliza (pode chegar com acentos do usuário).
        const finalSlug = slugifyPt(slug && slug.trim() ? slug : title);

        const { data, error } = await supabaseAdmin
            .from('marketing_posts')
            .insert([{
                title,
                slug:                  finalSlug,
                subtitle:              subtitle || null,
                content,
                excerpt,
                status,
                tags,
                image_url,
                image_caption:         image_caption || null,
                image_object_position: image_object_position || null,
                related_post_ids:      related_post_ids || [],
                author_id,
                custom_author: isAdmin && custom_author ? custom_author : null,
                published_at: status === 'published' ? new Date() : null
            }])
            .select()
            .single();

        if (error) {
            if (error.code === '23505' && error.message?.includes('slug')) {
                return res.status(409).json({ error: 'Slug já existe — escolha outro ou deixe em branco para gerar automaticamente.' });
            }
            throw error;
        }

        res.json({ success: true, data });
    } catch (error) {
        console.error('Error creating marketing post:', error);
        res.status(500).json({ error: 'Erro ao criar post' });
    }
});

// PUT /:id - Update post
router.put('/:id', requireRole(['Marketing', 'Admin', 'admin', 'employee']), upload.single('image'), async (req, res) => {
    try {
        const { id } = req.params;
        let {
            title, content, excerpt, status, tags, image_url, author_id, custom_author,
            // Campos do blog público (v2)
            slug, subtitle, image_caption, image_object_position,
            // Posts relacionados (v1.8: bloco "Leia também")
            related_post_ids
        } = req.body;

        if (typeof related_post_ids === 'string') {
            try { related_post_ids = JSON.parse(related_post_ids); }
            catch (_) { related_post_ids = undefined; }
        }

        // Check for admin
        const isAdmin = req.user.roles?.some(r => r.toLowerCase().includes('admin'));

        // Parse tags if sent as JSON string
        if (typeof tags === 'string') {
            try {
                tags = JSON.parse(tags);
            } catch (e) {
                // If it fails, maybe it's not meant to be updated or is invalid format
                // but checking strict typeof avoids crash.
                // If undefined, it will be skipped in updates below.
            }
        }

        // Handle File Upload
        if (req.file) {
            try {
                image_url = await uploadImageToStorage(req.file);
            } catch (e) {
                console.error('Upload error:', e);
                return res.status(500).json({ error: 'Erro ao fazer upload da imagem' });
            }
        }

        const updates = {
            updated_at: new Date()
        };

        if (title !== undefined) updates.title = title;
        if (content !== undefined) updates.content = content;
        if (excerpt !== undefined) updates.excerpt = excerpt;
        if (tags !== undefined) updates.tags = tags;
        if (image_url !== undefined) updates.image_url = image_url;
        // Blog v2: normalize empty strings to null para não estourar UNIQUE em slug
        if (slug !== undefined) updates.slug = slug && slug.trim() ? slugifyPt(slug) : null;
        if (subtitle !== undefined) updates.subtitle = subtitle || null;
        if (image_caption !== undefined) updates.image_caption = image_caption || null;
        if (image_object_position !== undefined) updates.image_object_position = image_object_position || null;
        if (related_post_ids !== undefined) updates.related_post_ids = Array.isArray(related_post_ids) ? related_post_ids : [];

        // Update author if admin and provided
        if (isAdmin) {
            if (author_id) updates.author_id = author_id;
            if (custom_author !== undefined) updates.custom_author = custom_author;
        }

        if (status !== undefined) {
            updates.status = status;
            if (status === 'published') {
                // If changing to published, set date if not already set (or always update? usually set once)
                // Let's check current status first or just update published_at if it was null?
                // Simple logic: if status is published, update published_at
                updates.published_at = new Date();
            }
        }

        const { data, error } = await supabaseAdmin
            .from('marketing_posts')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            if (error.code === '23505' && error.message?.includes('slug')) {
                return res.status(409).json({ error: 'Slug já existe — escolha outro.' });
            }
            throw error;
        }

        res.json({ success: true, data });
    } catch (error) {
        console.error('Error updating marketing post:', error);
        res.status(500).json({ error: 'Erro ao atualizar post' });
    }
});

// DELETE /:id - Delete post
router.delete('/:id', requireRole(['Marketing', 'Admin', 'admin', 'employee']), async (req, res) => {
    try {
        const { id } = req.params;

        const { error } = await supabaseAdmin
            .from('marketing_posts')
            .delete()
            .eq('id', id);

        if (error) throw error;

        res.json({ success: true, message: 'Post removido com sucesso' });
    } catch (error) {
        console.error('Error deleting marketing post:', error);
        res.status(500).json({ error: 'Erro ao remover post' });
    }
});

module.exports = router;
