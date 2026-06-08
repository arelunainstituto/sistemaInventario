// Settings públicos do módulo Inventário (feature flags consumidos pela UI).
// Todas as rotas são read-only e exigem apenas inventory:read.

const express = require('express');
const router  = express.Router();
const { requirePermission } = require('../middleware/auth');
const { supabaseAdmin }     = require('./_stock');

const TRUTHY = new Set(['true', 't', '1', 'yes', 'on']);
function parseBool(v) {
    return TRUTHY.has(String(v ?? '').trim().toLowerCase());
}

// Conjunto de keys expostas como feature flag (booleanos).
// Manter pequeno e curado — adicione novos conforme necessário.
const FLAG_KEYS = ['allow_negative_stock'];

/**
 * GET /feature-flags
 * Retorna { allow_negative_stock: bool, ... } com base em inv_system_settings.
 * Keys ausentes assumem false.
 */
router.get('/feature-flags', requirePermission('inventory', 'read'), async (req, res) => {
    try {
        const { data } = await supabaseAdmin
            .from('inv_system_settings')
            .select('key, value')
            .in('key', FLAG_KEYS);

        const flags = Object.fromEntries(FLAG_KEYS.map(k => [k, false]));
        for (const row of (data || [])) {
            flags[row.key] = parseBool(row.value);
        }
        res.json(flags);
    } catch (err) {
        console.error('GET feature-flags error:', err);
        res.status(500).json({ error: 'Erro ao obter feature flags' });
    }
});

module.exports = router;
