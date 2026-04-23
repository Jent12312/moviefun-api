"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const router = (0, express_1.Router)();
router.get('/proxy', async (req, res) => {
    const { path, size = 'w500' } = req.query;
    if (!path) {
        return res.status(400).json({ success: false, error: 'Image path is required' });
    }
    const tmdbImageUrl = `https://image.tmdb.org/t/p/${size}${path}`;
    try {
        const response = await fetch(tmdbImageUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch image from TMDB: ${response.status}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const contentType = response.headers.get('content-type') || 'image/jpeg';
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=2592000');
        return res.send(buffer);
    }
    catch (error) {
        console.error('Image proxy error:', error);
        return res.status(500).json({
            success: false,
            error: { code: 'IMAGE_PROXY_ERROR', message: error.message }
        });
    }
});
exports.default = router;
