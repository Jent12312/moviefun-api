import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { ACHIEVEMENTS } from '../types/index.js';

const router = Router();
router.use(requireAuth);

router.get('/profile', async (req: Request, res: Response) => {
  const user = await req.prisma.user.findUnique({
    where: { id: req.userId! },
    select: { id: true, username: true, displayName: true, avatarUrl: true, createdAt: true }
  });
  res.json({ success: true, data: user });
});

router.patch('/profile', async (req: Request, res: Response) => {
  const { displayName, avatarUrl } = req.body;
  await req.prisma.user.update({
    where: { id: req.userId! },
    data: { displayName, avatarUrl }
  });
  res.json({ success: true });
});

router.get('/stats', async (req: Request, res: Response) => {
  const movieWatched = await req.prisma.userMovieInteraction.count({
    where: { userId: req.userId!, status: 'watched' }
  });
  const movieWatching = await req.prisma.userMovieInteraction.count({
    where: { userId: req.userId!, status: 'watching' }
  });
  const movieWantToWatch = await req.prisma.userMovieInteraction.count({
    where: { userId: req.userId!, status: 'want_to_watch' }
  });
  const seriesWatched = await req.prisma.userTvInteraction.count({
    where: { userId: req.userId!, status: 'watched' }
  });
  const seriesWatching = await req.prisma.userTvInteraction.count({
    where: { userId: req.userId!, status: 'watching' }
  });
  const seriesWantToWatch = await req.prisma.userTvInteraction.count({
    where: { userId: req.userId!, status: 'want_to_watch' }
  });
  const rated = await req.prisma.userMovieInteraction.findMany({
    where: { userId: req.userId!, status: 'watched', rating: { not: null } },
    select: { rating: true }
  });

  const watchedCount = movieWatched + seriesWatched;
  const watchingCount = movieWatching + seriesWatching;
  const wantToWatchCount = movieWantToWatch + seriesWantToWatch;

  const totalRating = rated.reduce((sum, r) => sum + (r.rating ? Number(r.rating) : 0), 0);
  const averageRating = rated.length > 0 ? totalRating / rated.length : 0;

  res.json({
    success: true,
    data: {
      watched_count: watchedCount,
      watching_count: watchingCount,
      want_to_watch_count: wantToWatchCount,
      average_rating: Math.round(averageRating * 10) / 10,
      total_movies: watchedCount + watchingCount + wantToWatchCount,
    }
  });
});

router.get('/interactions', async (req: Request, res: Response) => {
  const { status, limit = 20, offset = 0, movie_id, type } = req.query;
  const limitNum = Math.min(parseInt(limit as string), 50);
  const offsetNum = parseInt(offset as string);
  const contentType = (type as string) || 'movies';

  if (movie_id) {
    const movie = await req.prisma.movie.findUnique({ where: { tmdbId: parseInt(movie_id as string) } });
    if (!movie) return res.json({ success: true, data: [] });
    
    const interaction = await req.prisma.userMovieInteraction.findFirst({
      where: { userId: req.userId!, movieId: movie.id },
      include: { movie: { select: { tmdbId: true, title: true } } }
    });
    
    if (!interaction) return res.json({ success: true, data: [] });
    return res.json({
      success: true,
      data: [{
        tmdb_id: interaction.movie.tmdbId,
        title: interaction.movie.title,
        status: interaction.status,
        rating: interaction.rating ? Number(interaction.rating) : null,
        is_favorite: interaction.isFavorite
      }]
    });
  }

  let items: any[] = [];

  if (contentType === 'all' || contentType === 'movies') {
    const where: any = { userId: req.userId! };
    if (status && status !== 'all') where.status = status;
    
    const movies = await req.prisma.userMovieInteraction.findMany({
      where,
      include: { movie: { select: { tmdbId: true, title: true, overview: true, posterPath: true, releaseDate: true } } },
      orderBy: { updatedAt: 'desc' },
      take: limitNum,
      skip: offsetNum
    });
    
    items = items.concat(movies.map(item => ({
      type: 'movie',
      tmdb_id: item.movie.tmdbId,
      title: item.movie.title,
      overview: item.movie.overview,
      poster_path: item.movie.posterPath,
      vote_average: item.rating ? Number(item.rating) : 0,
      release_date: item.movie.releaseDate,
      status: item.status,
      rating: item.rating ? Number(item.rating) : null,
      is_favorite: item.isFavorite,
      updated_at: item.updatedAt
    })));
  }

  if (contentType === 'all' || contentType === 'series') {
    const where: any = { userId: req.userId! };
    if (status && status !== 'all') where.status = status;
    
    const series = await req.prisma.userTvInteraction.findMany({
      where,
      include: { series: { select: { tmdbId: true, name: true, overview: true, posterPath: true } } },
      orderBy: { updatedAt: 'desc' },
      take: limitNum,
      skip: offsetNum
    });
    
    items = items.concat(series.map(item => ({
      type: 'series',
      tmdb_id: item.series.tmdbId,
      title: item.series.name,
      overview: item.series.overview,
      poster_path: item.series.posterPath,
      vote_average: item.rating ? Number(item.rating) : 0,
      status: item.status,
      rating: item.rating ? Number(item.rating) : null,
      current_season: item.currentSeason,
      current_episode: item.currentEpisode,
      updated_at: item.updatedAt
    })));
  }

  items.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

  res.json({ success: true, data: items, meta: { limit: limitNum, offset: offsetNum } });
});

router.post('/interactions', async (req: Request, res: Response) => {
  const { movie_id, series_id, status, rating, title, overview, poster_path, season_number, episode_number } = req.body;

  if (series_id) {
    let series = await req.prisma.tvSeries.findUnique({ where: { tmdbId: parseInt(series_id) } });
    if (!series) {
      series = await req.prisma.tvSeries.create({
        data: { tmdbId: parseInt(series_id), name: title || `Series ${series_id}`, overview: overview || '', posterPath: poster_path }
      });
    }
    
    const existing = await req.prisma.userTvInteraction.findFirst({
      where: { userId: req.userId!, seriesId: series.id }
    });

    if (existing) {
      await req.prisma.userTvInteraction.update({
        where: { id: existing.id },
        data: {
          status: status || existing.status,
          rating: rating !== undefined ? rating : existing.rating,
          currentSeason: season_number || existing.currentSeason,
          currentEpisode: episode_number || existing.currentEpisode
        }
      });
    } else {
      await req.prisma.userTvInteraction.create({
        data: {
          userId: req.userId!,
          seriesId: series.id,
          status: status || 'none',
          rating: rating,
          currentSeason: season_number || 1,
          currentEpisode: episode_number || 1
        }
      });
    }
    return res.status(201).json({ success: true });
  }

  if (!movie_id) {
    return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'movie_id is required' } });
  }

  let movie = await req.prisma.movie.findUnique({ where: { tmdbId: parseInt(movie_id) } });
  if (!movie) {
    movie = await req.prisma.movie.create({
      data: { tmdbId: parseInt(movie_id), title: title || `Movie ${movie_id}`, overview: overview || '', posterPath: poster_path }
    });
  }
  
  const existing = await req.prisma.userMovieInteraction.findFirst({
    where: { userId: req.userId!, movieId: movie.id }
  });

  if (existing) {
    await req.prisma.userMovieInteraction.update({
      where: { id: existing.id },
      data: { status: status || existing.status, rating: rating !== undefined ? rating : existing.rating }
    });
  } else {
    await req.prisma.userMovieInteraction.create({
      data: {
        userId: req.userId!,
        movieId: movie.id,
        status: status || 'want_to_watch',
        rating: rating
      }
    });
  }

  res.status(201).json({ success: true });
});

router.delete('/interactions', async (req: Request, res: Response) => {
  const { tmdb_id } = req.query;
  if (!tmdb_id) {
    return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'tmdb_id is required' } });
  }

  const movie = await req.prisma.movie.findUnique({ where: { tmdbId: parseInt(tmdb_id as string) } });
  if (!movie) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Movie not found' } });
  }

  await req.prisma.userMovieInteraction.deleteMany({
    where: { userId: req.userId!, movieId: movie.id }
  });

  res.json({ success: true });
});

router.get('/reviews', async (req: Request, res: Response) => {
  const reviews = await req.prisma.userReview.findMany({
    where: { userId: req.userId! },
    include: { movie: { select: { tmdbId: true, title: true, posterPath: true } } },
    orderBy: { createdAt: 'desc' }
  });
  res.json({ success: true, data: reviews });
});

router.post('/reviews/:id/like', async (req: Request, res: Response) => {
  const { id } = req.params;
  
  const existing = await req.prisma.reviewLike.findFirst({
    where: { userId: req.userId!, reviewId: id }
  });

  if (existing) {
    await req.prisma.reviewLike.delete({ where: { id: existing.id } });
    await req.prisma.userReview.update({
      where: { id },
      data: { likesCount: { decrement: 1 } }
    });
    return res.json({ success: true, liked: false });
  } else {
    await req.prisma.reviewLike.create({ data: { userId: req.userId!, reviewId: id } });
    await req.prisma.userReview.update({
      where: { id },
      data: { likesCount: { increment: 1 } }
    });
    return res.json({ success: true, liked: true });
  }
});

router.get('/achievements', async (req: Request, res: Response) => {
  const userAchievements = await req.prisma.userAchievement.findMany({
    where: { userId: req.userId! }
  });

  const earnedCodes = new Set(userAchievements.map(a => a.achievementCode));

  const achievements = ACHIEVEMENTS.map(def => ({
    ...def,
    isEarned: earnedCodes.has(def.code),
    progress: earnedCodes.has(def.code) ? 100 : 0
  }));

  const totalPoints = achievements.filter(a => a.isEarned).reduce((sum, a) => sum + a.points, 0);

  res.json({
    success: true,
    data: achievements,
    meta: { earnedCount: earnedCodes.size, totalCount: achievements.length, totalPoints }
  });
});

router.post('/achievements', async (req: Request, res: Response) => {
  const { achievement_code } = req.body;
  if (!achievement_code) {
    return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'achievement_code is required' } });
  }

  const existing = await req.prisma.userAchievement.findFirst({
    where: { userId: req.userId!, achievementCode: achievement_code }
  });

  if (existing) {
    return res.json({ success: true, message: 'Already earned' });
  }

  await req.prisma.userAchievement.create({
    data: { userId: req.userId!, achievementCode: achievement_code }
  });

  res.status(201).json({ success: true });
});

router.get('/notifications', async (req: Request, res: Response) => {
  const { limit = 20, offset = 0, unread_only } = req.query;
  const limitNum = Math.min(parseInt(limit as string), 50);
  const offsetNum = parseInt(offset as string);

  const where: any = { userId: req.userId! };
  if (unread_only === 'true') where.isRead = false;

  const notifications = await req.prisma.notification.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limitNum,
    skip: offsetNum
  });

  const unreadCount = await req.prisma.notification.count({
    where: { userId: req.userId!, isRead: false }
  });

  res.json({
    success: true,
    data: notifications,
    meta: { limit: limitNum, offset: offsetNum, unread_count: unreadCount }
  });
});

router.post('/notifications', async (req: Request, res: Response) => {
  const { type, title, message, data } = req.body;
  if (!type || !title) {
    return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'type and title are required' } });
  }

  const result = await req.prisma.notification.create({
    data: { userId: req.userId!, type, title, message, data }
  });
  res.status(201).json({ success: true, data: result });
});

router.patch('/notifications/:id/read', async (req: Request, res: Response) => {
  const { id } = req.params;
  await req.prisma.notification.updateMany({
    where: { id, userId: req.userId! },
    data: { isRead: true }
  });
  res.json({ success: true });
});

router.delete('/notifications/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  await req.prisma.notification.deleteMany({ where: { id, userId: req.userId! } });
  res.json({ success: true });
});

export default router;