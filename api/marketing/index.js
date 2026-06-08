const express = require('express');
const router = express.Router();
const { authenticateToken, requirePermission, requireRole } = require('../middleware/auth');

// Import routes
const postsRoutes      = require('./posts');
const postImagesRoutes = require('./post-images');

// Middleware for all marketing routes - authentication required
router.use(authenticateToken);

// Routes
router.use('/posts',       postsRoutes);
router.use('/post-images', postImagesRoutes);

module.exports = router;
