"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_js_1 = require("../middleware/auth.js");
const validation_js_1 = require("../schemas/validation.js");
const router = (0, express_1.Router)();
router.get('/', async (req, res) => {
    const { content_id, content_type = 'movie', page = 1, per_page = 20 } = req.query;
    const pageNum = parseInt(page);
    const perPageNum = Math.min(parseInt(per_page), 50);
    const offset = (pageNum - 1) * perPageNum;
    const reviews = await req.prisma.userReview.findMany({
        where: {
            tmdbId: parseInt(content_id),
            contentType: content_type
        },
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
    const parsed = validation_js_1.createReviewSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({
            success: false,
            error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message }
        });
    }
    const { content_id, content_type, content, rating, contains_spoilers, title } = parsed.data;
    const parsedTmdbId = parseInt(content_id);
    const parsedContentType = content_type;
    const existing = await req.prisma.userReview.findFirst({
        where: { userId: req.userId, tmdbId: parsedTmdbId, contentType: parsedContentType }
    });
    if (existing) {
        return res.status(409).json({ success: false, error: { code: 'DUPLICATE_REVIEW', message: 'Вы уже оставляли рецензию на этот контент' } });
    }
    const result = await req.prisma.userReview.create({
        data: {
            userId: req.userId,
            tmdbId: parsedTmdbId,
            contentType: parsedContentType,
            title: title || '',
            content,
            rating,
            containsSpoilers: contains_spoilers || false
        }
    });
    res.status(201).json({ success: true, data: result });
});
exports.default = router;
