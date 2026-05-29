// Middleware Express que regista mutações + leituras sensíveis em
// inv_access_log para auditoria (§17).
//
// O que regista:
//   • Todas as mutações: POST, PUT, PATCH, DELETE
//   • GETs sensíveis: /reports/*, /stats/*, /search, /access-log
//
// O que NÃO regista:
//   • GETs comuns (listagem de items, etc.) — evita inundar o log
//   • Pré-flight CORS (OPTIONS)
//
// Faz a gravação async (após response) para não bloquear o utilizador.

const { supabaseAdmin } = require('./_stock');

const SENSITIVE_GET_PATHS = [
    '/reports', '/stats', '/search', '/access-log', '/depreciation'
];

function shouldLog(req) {
    const m = req.method.toUpperCase();
    if (['POST','PUT','PATCH','DELETE'].includes(m)) return true;
    if (m === 'GET') {
        return SENSITIVE_GET_PATHS.some(p => req.path === p || req.path.startsWith(p + '/'));
    }
    return false;
}

// Tenta extrair entity_type e entity_id a partir do path.
// Ex.: POST /items/abc-123 → { entity_type: 'items', entity_id: 'abc-123' }
function parsePath(path) {
    const segments = path.split('/').filter(Boolean);
    const entity_type = segments[0] || null;
    let entity_id = null;
    if (segments.length >= 2) {
        const candidate = segments[1];
        // UUID v4 ou um ID curto razoável
        if (/^[0-9a-f-]{8,}$/i.test(candidate) || /^[A-Z]{3}\d+$/.test(candidate)) {
            entity_id = candidate;
        }
    }
    return { entity_type, entity_id };
}

function getClientIp(req) {
    const fwd = req.headers['x-forwarded-for'];
    if (fwd) return fwd.split(',')[0].trim();
    return req.ip || req.connection?.remoteAddress || null;
}

function accessLog(req, res, next) {
    if (!shouldLog(req)) return next();

    const start = Date.now();
    const originalEnd = res.end;

    res.end = function (...args) {
        const duration = Date.now() - start;
        const { entity_type, entity_id } = parsePath(req.path);
        const statusCode = res.statusCode;

        // Inserção async (não bloqueia a resposta)
        setImmediate(async () => {
            try {
                await supabaseAdmin.from('inv_access_log').insert({
                    user_id:     req.user?.id || null,
                    ip:          getClientIp(req),
                    user_agent:  (req.headers['user-agent'] || '').slice(0, 500),
                    method:      req.method.toUpperCase(),
                    path:        req.path.slice(0, 300),
                    entity_type,
                    entity_id,
                    status_code: statusCode,
                    duration_ms: duration
                });
            } catch (err) {
                // Falha silenciosa para não impactar requisição do utilizador
                console.error('[access-log] insert failed:', err.message);
            }
        });

        return originalEnd.apply(res, args);
    };

    next();
}

module.exports = { accessLog };
