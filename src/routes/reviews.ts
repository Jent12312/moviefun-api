import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { createReviewSchema } from '../schemas/validation.js';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  const { content_id, content_type = 'movie', page = 1, per_page = 20 } = req.query;
  const pageNum = parseInt(page as string);
  const perPageNum = Math.min(parseInt(per_page as string), 50);
  const offset = (pageNum - 1) * perPageNum;

  const reviews = await req.prisma.userReview.findMany({
    where: {
      tmdbId: parseInt(content_id as string),
      contentType: content_type as string
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

router.post('/', requireAuth, async (req: Request, res: Response) => {
  console.log("Получены данные для рецензии:", req.body);

  const { movie_id, content, rating, contains_spoilers, title, content_type } = req.body;

  if (movie_id === undefined || movie_id === null || !content) {
    return res.status(400).json({
      success: false,
      error: { code: 'BAD_REQUEST', message: `Ошибка данных. Получен movie_id: ${movie_id}` }
    });
  }

  const type = content_type === 'tv' ? 'tv' : 'movie';

  try {
    const result = await req.prisma.userReview.create({
      data: {
        userId: req.userId!,
        tmdbId: parseInt(movie_id),
        contentType: type,
        title: title || '',
        content,
        rating,
        containsSpoilers: contains_spoilers || false
      }
    });

    res.status(201).json({ success: true, data: result });
  } catch (error: any) {
    console.error("Create Review Error:", error);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
  }
});

export default router;