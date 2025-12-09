const express = require('express');
const router = express.Router();
const { authenticateToken, requirePermission } = require('../middleware/auth');

// Importar sub-rotas
const employeesRoutes = require('./employees');
const payrollRoutes = require('./payroll');
const documentsRoutes = require('./documents');
const absencesRoutes = require('./absences');
const performanceRoutes = require('./performance');
const dashboardRoutes = require('./dashboard');
const reportsRoutes = require('./reports');

// Middleware de autenticação para todas as rotas de RH
router.use(authenticateToken);

// Registrar sub-rotas
router.use('/employees', employeesRoutes);
router.use('/payroll', payrollRoutes);
router.use('/documents', documentsRoutes);
router.use('/absences', absencesRoutes);
router.use('/performance', performanceRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/reports', reportsRoutes);
router.use('/emergency-contacts', require('./emergency-contacts'));
router.use('/payroll-data', require('./payroll-data'));

module.exports = router;
