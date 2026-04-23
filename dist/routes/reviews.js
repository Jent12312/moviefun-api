"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_js_1 = require("../middleware/auth.js");
const router = (0, express_1.Router)();
router.get('/', async (req, res) => {
    const { content_id, page = 1, per_page = 20 } = req.query;
    const pageNum = parseInt(page);
    const perPageNum = Math.min(parseInt(per_page), 50);
    const offset = (pageNum - 1) * perPageNum;
    const reviews = await req.prisma.userReview.findMany({
        where: { tmdbId: parseInt(content_id) },
        include: { user: { select: { id: true, username: true, displayName: true, avatarUrl: true } } },
        orderBy: { createdAt: 'desc' },
        take: perPageNum,
        skip: offset
    });
    const formatted = reviews.map(r => ({
        id: r.id,
        author_name: r.user.displayName || r.user.username || 'Аноним',
        author_avatar: r.user.avatarUrl || '',
        author_id: r.user.id,
        body: r.content,
        title: r.title,
        rating: r.rating,
        likes_count: r.likesCount,
        contains_spoilers: r.containsSpoilers,
        created_at: r.createdAt,
        is_liked_by_me: false
    }));
    res.json({ success: true, data: formatted, meta: { page: pageNum, per_page: perPageNum } });
});
router.post('/', auth_js_1.requireAuth, async (req, res) => {
    const { movie_id, content, rating, contains_spoilers, title } = req.body;
    if (!movie_id || !content) {
        return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'movie_id and content are required' } });
    }
    let movie = await req.prisma.movie.findUnique({ where: { tmdbId: parseInt(movie_id) } });
    if (!movie) {
        movie = await req.prisma.movie.create({
            data: { tmdbId: parseInt(movie_id), title: `Movie ${movie_id}` }
        });
    }
    const result = await req.prisma.userReview.create({
        data: {
            userId: req.userId,
            movieId: movie.id,
            tmdbId: parseInt(movie_id),
            title: title || '',
            content,
            rating,
            containsSpoilers: contains_spoilers || false
        }
    });
    res.status(201).json({ success: true, data: result });
});
exports.default = router;
