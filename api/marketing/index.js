const express = require('express');
const router = express.Router();
const { authenticateToken, requirePermission, requireRole } = require('../middleware/auth');

// Import routes
const postsRoutes = require('./posts');

// Middleware for all marketing routes - authentication required
router.use(authenticateToken);

// Routes
router.use('/posts', postsRoutes);

module.exports = router;
