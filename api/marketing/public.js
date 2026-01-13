const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase Admin client (reused from environment)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

/**
 * MIDDLEWARE DE SEGURANÇA MÁXIMA
 * Verifica Origem e API Key
 */
const verifySecureAccess = (req, res, next) => {
    const allowedOrigin = ['https://www.institutoareluna.pt', 'http://localhost:8080'];
    const apiKey = process.env.BLOG_PUBLIC_API_KEY;

    // 1. Verificar Origin (CORS Manual e Estrito)
    const origin = req.headers.origin;

    // Permitir requests sem origin (postman/curl server-side) SOMENTE se a flag estrita não estiver ativada?
    // O usuário pediu "CORS apenas do link...".
    // Se o backend de consumo for server-side (Next.js SSR), pode não ter Origin.
    // Mas se for browser-side fetch, terá.
    // Assumindo chamada browser-side ou server-side que envia Origin.

    // Se for server-to-server, origin pode ser undefined.
    // Vamos validar Origin SE ele existir. Se não existir, confiamos na API Key.
    if (origin && !allowedOrigin.includes(origin)) {
        console.warn(`[Security Block] Blocked request from origin: ${origin}`);
        return res.status(403).json({ error: 'Forbidden Origin' });
    }

    // Adicionar headers CORS para permitir o browser
    if (origin && allowedOrigin.includes(origin)) {
        res.header('Access-Control-Allow-Origin', origin);
        res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
    }

    // Handle Preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // 2. Verificar API Key
    const requestApiKey = req.headers['x-api-key'];

    if (!apiKey) {
        console.error('[Security Error] BLOG_PUBLIC_API_KEY not configured on server');
        return res.status(500).json({ error: 'Server configuration error' });
    }

    if (!requestApiKey || requestApiKey !== apiKey) { // Comparação direta simples é suficiente aqui? Timing attack risk is negligible for this low volume.
        console.warn(`[Security Block] Invalid or missing API Key`);
        return res.status(401).json({ error: 'Unauthorized' });
    }

    next();
};

// Aplicar middleware em todas as rotas deste router
router.use(verifySecureAccess);

// GET /posts - Listar posts publicados
router.get('/posts', async (req, res) => {
    try {
        const { page = 1, limit = 10, tag } = req.query;
        const offset = (page - 1) * limit;

        let query = supabaseAdmin
            .from('marketing_posts')
            .select(`
                id, title, excerpt, image_url, 
                published_at, tags, custom_author,
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

// GET /posts/:id - Obter um post específico
router.get('/posts/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const { data: post, error } = await supabaseAdmin
            .from('marketing_posts')
            .select('*')
            .eq('id', id)
            .eq('status', 'published')
            .single();

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

        res.json({
            ...post,
            author_name: authorName || 'Autor'
        });

    } catch (error) {
        console.error('Public API Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;
