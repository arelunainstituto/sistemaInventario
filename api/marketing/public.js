const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase Admin client (reused from environment)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Middleware de acesso público.
 *
 * CORS é ABERTO (Allow-Origin: *) — necessário para:
 *   • prerender estático no build (Vercel/Linux roda a partir de
 *     127.0.0.1:porta-aleatória; allowlist não cobre)
 *   • SSR de qualquer cliente que consuma a API server-side
 *   • crawlers e ferramentas de fetch
 *
 * O real perímetro de segurança é o x-api-key, não o CORS:
 *   • endpoints são GET + read-only
 *   • só servem posts com status='published'
 *   • content é o mesmo que aparece no HTML público do site
 *
 * Sem credentials (sem cookies), Allow-Origin: * é seguro e permitido
 * pela spec do CORS.
 */
const verifySecureAccess = (req, res, next) => {
    // CORS — abrir para qualquer origin
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
    res.header('Access-Control-Max-Age', '86400'); // 24h — reduz volume de preflights

    // Preflight
    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }

    // API Key — único gating real
    const apiKey = process.env.BLOG_PUBLIC_API_KEY;
    if (!apiKey) {
        console.error('[Security Error] BLOG_PUBLIC_API_KEY not configured on server');
        return res.status(500).json({ error: 'Server configuration error' });
    }

    const requestApiKey = req.headers['x-api-key'];
    if (!requestApiKey || requestApiKey !== apiKey) {
        console.warn('[Security Block] Invalid or missing API Key');
        return res.status(401).json({ error: 'Unauthorized' });
    }

    next();
};

// Aplicar middleware em todas as rotas deste router
router.use(verifySecureAccess);

// GET /posts - Listar posts publicados (sem content para poupar payload)
router.get('/posts', async (req, res) => {
    try {
        const { page = 1, limit = 10, tag } = req.query;
        const offset = (page - 1) * limit;

        let query = supabaseAdmin
            .from('marketing_posts')
            .select(`
                id, title, slug, subtitle, excerpt,
                image_url, image_caption, image_object_position,
                published_at, updated_at, tags, custom_author,
                author_id
            `, { count: 'exact' })
            .eq('status', 'published')
            .order('published_at', { ascending: false })
            .range(offset, offset + parseInt(limit) - 1);

        if (tag) {
            query = query.contains('tags', [tag]);
        }

        const { data, error, count } = await query;

        if (error) throw error;

        // Transformar dados se necessário (ex: author name)
        // Para performance, talvez não busquemos o nome do usuário aqui se custom_author não estiver setado,
        // mas idealmente deveríamos.
        // Vamos fazer um fetch de autores se necessário ou usar o custom_author.

        // Simplesmente retornamos o que temos. O front externo deve lidar.
        // Se precisarmos do nome do autor do sistema, teríamos que fazer join ou lookup.
        // Como 'marketing_posts' tem 'custom_author', vamos priorizar isso.

        // Optimização: carregar nomes de autores apenas se necessário
        const authorIds = [...new Set(data.map(p => p.author_id).filter(id => id))];
        let authorsMap = {};

        if (authorIds.length > 0) {
            const { data: authors } = await supabaseAdmin
                .from('user_profiles')
                .select('user_id, first_name, last_name, display_name')
                .in('user_id', authorIds);

            if (authors) {
                authors.forEach(a => {
                    authorsMap[a.user_id] = a.display_name || ((a.first_name || '') + ' ' + (a.last_name || '')).trim();
                });
            }
        }

        const formatted = data.map(post => ({
            ...post,
            author_name: post.custom_author || authorsMap[post.author_id] || 'Autor'
        }));

        res.json({
            data: formatted,
            meta: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: count,
                totalPages: Math.ceil(count / limit)
            }
        });

    } catch (error) {
        console.error('Public API Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// GET /posts/:idOrSlug - Obter um post específico (aceita UUID ou slug)
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

router.get('/posts/:idOrSlug', async (req, res) => {
    try {
        const { idOrSlug } = req.params;
        const isUuid = UUID_RE.test(idOrSlug);

        let q = supabaseAdmin
            .from('marketing_posts')
            .select('*')
            .eq('status', 'published');
        q = isUuid ? q.eq('id', idOrSlug) : q.eq('slug', idOrSlug);

        const { data: post, error } = await q.maybeSingle();

        if (error || !post) {
            return res.status(404).json({ error: 'Post not found' });
        }

        // Resolver autor
        let authorName = post.custom_author;
        if (!authorName && post.author_id) {
            const { data: author } = await supabaseAdmin
                .from('user_profiles')
                .select('display_name, first_name, last_name')
                .eq('user_id', post.author_id)
                .single();

            if (author) {
                authorName = author.display_name || ((author.first_name || '') + ' ' + (author.last_name || '')).trim();
            }
        }

        // Resolver "Leia também"
        // 1. Se related_post_ids tiver itens → carrega esses IDs nessa ordem
        // 2. Senão → carrega os 3 mais recentes publicados, excluindo o próprio
        const REL_FIELDS = 'id, title, slug, excerpt, image_url, published_at';
        let related = [];
        const ids = Array.isArray(post.related_post_ids) ? post.related_post_ids.filter(Boolean) : [];
        if (ids.length) {
            const { data: rels } = await supabaseAdmin
                .from('marketing_posts')
                .select(REL_FIELDS)
                .in('id', ids)
                .eq('status', 'published')
                .neq('id', post.id);
            // Preservar a ordem original do array
            const map = new Map((rels || []).map(r => [r.id, r]));
            related = ids.map(id => map.get(id)).filter(Boolean);
        }
        if (!related.length) {
            const { data: latest } = await supabaseAdmin
                .from('marketing_posts')
                .select(REL_FIELDS)
                .eq('status', 'published')
                .neq('id', post.id)
                .order('published_at', { ascending: false })
                .limit(3);
            related = latest || [];
        }

        // Galeria do post (uso opcional pelo frontend)
        const { data: gallery } = await supabaseAdmin
            .from('marketing_post_images')
            .select('id, url, alt, caption, sort_order')
            .eq('post_id', post.id)
            .order('sort_order', { ascending: true })
            .order('created_at', { ascending: true });

        res.json({
            ...post,
            author_name:   authorName || 'Autor',
            related_posts: related,
            gallery:       gallery || []
        });

    } catch (error) {
        console.error('Public API Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;
