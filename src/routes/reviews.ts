import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { createReviewSchema } from '../schemas/validation.js';
import { Prisma } from '@prisma/client';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  const { content_id, content_type = 'movie', page = 1, per_page = 20, sort = 'popular' } = req.query;
  const pageNum = parseInt(page as string);
  const perPageNum = Math.min(parseInt(per_page as string), 50);
  const offset = (pageNum - 1) * perPageNum;

  const orderBy = sort === 'popular'
    ? [{ likesCount: Prisma.SortOrder.desc }, { createdAt: Prisma.SortOrder.desc }]
    : [{ createdAt: Prisma.SortOrder.desc }];

  const reviews = await req.prisma.userReview.findMany({
    where: {
      tmdbId: parseInt(content_id as string),
      contentType: content_type as string
    },
    include: { user: { select: { id: true, username: true, displayName: true, avatarUrl: true } } },
    orderBy: orderBy as any,
    take: perPageNum,
    skip: offset
  });

  let likedReviewIds = new Set<string>();
  if (req.userId) {
    const userLikes = await req.prisma.reviewLike.findMany({
      where: { userId: req.userId, reviewId: { in: reviews.map(r => r.id) } }
    });
    userLikes.forEach(l => likedReviewIds.add(l.reviewId));
  }

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
    is_liked_by_me: likedReviewIds.has(r.id)
  }));

  res.json({ success: true, data: formatted, meta: { page: pageNum, per_page: perPageNum } });
});

router.post('/', requireAuth, async (req: Request, res: Response) => {
  const { movie_id, content_id, content, rating, contains_spoilers, title, content_type } = req.body;
  
  const finalId = movie_id || content_id;

  if (!finalId || !content) {
    return res.status(400).json({ 
      success: false, 
      error: { code: 'BAD_REQUEST', message: 'ID контента и текст рецензии обязательны' } 
    });
  }

  try {
    const result = await req.prisma.userReview.create({
      data: {
        userId: req.userId!,
        tmdbId: parseInt(finalId),
        contentType: content_type === 'tv' ? 'tv' : 'movie',
        title: title || '',
        content,
        rating: rating || 0,
        containsSpoilers: contains_spoilers || false
      }
    });

    res.status(201).json({ success: true, data: result });
  } catch (error: any) {
    console.error("Ошибка сохранения рецензии:", error);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
  }
});

export default router;