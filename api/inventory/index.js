const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

// Authentication required on all inventory routes
router.use(authenticateToken);

// Fase 1 — Cadastros + Entradas
router.use('/units',      require('./units'));
router.use('/locations',  require('./locations'));
router.use('/categories', require('./categories'));
router.use('/suppliers',  require('./suppliers'));
router.use('/uoms',       require('./uoms'));
router.use('/items',      require('./items'));
router.use('/entries',    require('./entries'));
router.use('/scan',       require('./scan'));

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

// Healthcheck do módulo (útil para verificar montagem do router)
router.get('/_health', (_req, res) => {
    res.json({ ok: true, module: 'inventory', stage: 'fase-0' });
});

module.exports = router;
