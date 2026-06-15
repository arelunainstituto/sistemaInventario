const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { accessLog } = require('./_access-log');

// Authentication required on all inventory routes
router.use(authenticateToken);

// Auditoria §17: regista mutações + leituras sensíveis em inv_access_log
router.use(accessLog);

// Fase 1 — Cadastros + Entradas
router.use('/units',      require('./units'));
router.use('/locations',  require('./locations'));
router.use('/categories', require('./categories'));
router.use('/suppliers',  require('./suppliers'));
router.use('/uoms',       require('./uoms'));
// Fase 4.3: overrides de parâmetros por localização. Montado como sub-rota
// de /items/:itemId/ para o mergeParams pegar o itemId no router child.
router.use('/items/:itemId/location-params', require('./item-location-params'));
router.use('/items',      require('./items'));
router.use('/entries',    require('./entries'));
router.use('/scan',       require('./scan'));

// Épico Patrimônio — unidades por número de série, colaboradores (RH) e
// operações patrimoniais (entrada/movimentação/baixa).
router.use('/serial-units', require('./serial-units'));
router.use('/employees',    require('./employees'));
router.use('/patrimony',    require('./patrimony'));

// Fase 2 — Saídas + Movimentações + Ajustes
router.use('/exits',              require('./exits'));
router.use('/transfers',          require('./transfers'));
router.use('/adjustments',        require('./adjustments'));
router.use('/adjustment-reasons', require('./adjustment-reasons'));
router.use('/stats',              require('./stats'));

// Fase 3 — Inventário Físico + Relatórios + Depreciação
router.use('/inventory-sessions', require('./inventory-sessions'));
router.use('/reports',            require('./reports'));
router.use('/depreciation',       require('./depreciation'));

// Sprint 4B — Busca global + histórico unificado
router.use('/search',             require('./search'));
router.use('/movements',          require('./movements'));

// Sprint 4C — Log de acesso (§17)
router.use('/access-log',         require('./access-log'));

// Importador de planilha XLSX — admin only
router.use('/import',             require('./import'));

// Feature flags públicos do módulo (read-only, qualquer authenticated)
router.use('/settings',           require('./settings'));

// Healthcheck do módulo (útil para verificar montagem do router)
router.get('/_health', (_req, res) => {
    res.json({ ok: true, module: 'inventory', stage: 'fase-0' });
});

module.exports = router;
