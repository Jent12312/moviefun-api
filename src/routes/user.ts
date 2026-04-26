import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { ACHIEVEMENTS } from '../types/index.js';
import { getMovie, getTVShow, getMovieRecommendations } from '../services/tmdb.js';

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
  const ratedMovies = await req.prisma.userMovieInteraction.findMany({
    where: { userId: req.userId!, rating: { not: null } },
    select: { rating: true }
  });
  const ratedSeries = await req.prisma.userTvInteraction.findMany({
    where: { userId: req.userId!, rating: { not: null } },
    select: { rating: true }
  });
  
  const allRated = [...ratedMovies, ...ratedSeries];
  const totalRating = allRated.reduce((sum, r) => sum + (r.rating ? parseFloat(r.rating.toString()) : 0), 0);
  const averageRating = allRated.length > 0 ? totalRating / allRated.length : 0;

  const watchedCount = movieWatched + seriesWatched;
  const watchingCount = movieWatching + seriesWatching;
  const wantToWatchCount = movieWantToWatch + seriesWantToWatch;

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
  const { status, limit = 20, offset = 0, movie_id, series_id, movie_ids, series_ids, type } = req.query;

  if (movie_id) {
    const movie = await req.prisma.movie.findUnique({ where: { tmdbId: parseInt(movie_id as string) } });
    if (!movie) return res.json({ success: true, data: [] });
    const interaction = await req.prisma.userMovieInteraction.findFirst({ where: { userId: req.userId!, movieId: movie.id } });
    if (!interaction) return res.json({ success: true, data: [] });
    return res.json({ success: true, data: [{ tmdb_id: movie.tmdbId, status: interaction.status, rating: interaction.rating ? Number(interaction.rating) : null }] });
  }

  if (series_id) {
    const series = await req.prisma.tvSeries.findUnique({ where: { tmdbId: parseInt(series_id as string) } });
    if (!series) return res.json({ success: true, data: [] });
    const interaction = await req.prisma.userTvInteraction.findFirst({ where: { userId: req.userId!, seriesId: series.id } });
    if (!interaction) return res.json({ success: true, data: [] });
    return res.json({ success: true, data: [{ tmdb_id: series.tmdbId, status: interaction.status, rating: interaction.rating ? Number(interaction.rating) : null, current_season: interaction.currentSeason, current_episode: interaction.currentEpisode }] });
  }

  if (movie_ids) {
    const ids = (movie_ids as string).split(',').map(id => parseInt(id));
    const movies = await req.prisma.movie.findMany({ where: { tmdbId: { in: ids } } });
    const movieDbIds = movies.map(m => m.id);
    const interactions = await req.prisma.userMovieInteraction.findMany({ where: { userId: req.userId!, movieId: { in: movieDbIds } }, include: { movie: { select: { tmdbId: true } } } });
    return res.json({ success: true, data: interactions.map(i => ({ tmdb_id: i.movie.tmdbId, status: i.status, rating: i.rating ? Number(i.rating) : null })) });
  }

  // ДОБАВЛЕНО ДЛЯ ПИНОВ СЕРИАЛОВ НА ГЛАВНОЙ
  if (series_ids) {
    const ids = (series_ids as string).split(',').map(id => parseInt(id));
    const seriesList = await req.prisma.tvSeries.findMany({ where: { tmdbId: { in: ids } } });
    const seriesDbIds = seriesList.map(s => s.id);
    const interactions = await req.prisma.userTvInteraction.findMany({ where: { userId: req.userId!, seriesId: { in: seriesDbIds } }, include: { series: { select: { tmdbId: true } } } });
    return res.json({ success: true, data: interactions.map(i => ({ tmdb_id: i.series.tmdbId, status: i.status, rating: i.rating ? Number(i.rating) : null })) });
  }

  const limitNum = Math.min(parseInt(limit as string), 50);
  const offsetNum = parseInt(offset as string);
  const contentType = (type as string) || 'movies';
  let items: any[] = [];

  if (contentType === 'all' || contentType === 'movies') {
    const where: any = { userId: req.userId! };
    if (status && status !== 'all') where.status = status;
    const movies = await req.prisma.userMovieInteraction.findMany({ where, include: { movie: true }, orderBy: { updatedAt: 'desc' }, take: limitNum, skip: offsetNum });
    
    items = items.concat(movies.map(item => ({ 
      type: 'movie', 
      tmdb_id: item.movie.tmdbId, 
      title: item.movie.title, 
      poster_path: item.movie.posterPath, 
      vote_average: item.movie.voteAverage || 0, // УБЕДИЛИСЬ ЧТО ЭТО ИЗ MOVIE
      release_date: item.movie.releaseDate, 
      status: item.status, 
      rating: item.rating ? parseFloat(item.rating.toString()) : null, // ПРАВИЛЬНАЯ КОНВЕРТАЦИЯ DECIMAL
      is_favorite: item.isFavorite, 
      updated_at: item.updatedAt 
    })));
  }

  if (contentType === 'all' || contentType === 'series') {
    const where: any = { userId: req.userId! };
    if (status && status !== 'all') where.status = status;
    const series = await req.prisma.userTvInteraction.findMany({ where, include: { series: true }, orderBy: { updatedAt: 'desc' }, take: limitNum, skip: offsetNum });
    
    items = items.concat(series.map((item: any) => ({ 
      type: 'series', 
      tmdb_id: item.series.tmdbId, 
      title: item.series.name, 
      poster_path: item.series.posterPath, 
      vote_average: item.series.voteAverage || 0, // УБЕДИЛИСЬ ЧТО ЭТО ИЗ SERIES
      status: item.status, 
      rating: item.rating ? parseFloat(item.rating.toString()) : null, // ПРАВИЛЬНАЯ КОНВЕРТАЦИЯ DECIMAL
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
      // ИСПРАВЛЕНО: Тянем данные из TMDB, если их нет
      const tmdbData: any = await getTVShow(parseInt(series_id)).catch(() => ({}));
      series = await req.prisma.tvSeries.create({
        data: { 
          tmdbId: parseInt(series_id), 
          name: title || tmdbData.name || tmdbData.original_name || `Series ${series_id}`, 
          overview: overview || tmdbData.overview || '', 
          posterPath: poster_path || tmdbData.poster_path,
          backdropPath: tmdbData.backdrop_path,
          voteAverage: tmdbData.vote_average ? Number(tmdbData.vote_average) : 0
        }
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

  if (movie_id) {
    let movie = await req.prisma.movie.findUnique({ where: { tmdbId: parseInt(movie_id) } });
    if (!movie) {
      // ИСПРАВЛЕНО: Тянем данные из TMDB
      const tmdbData: any = await getMovie(parseInt(movie_id)).catch(() => ({}));
      movie = await req.prisma.movie.create({
        data: { 
          tmdbId: parseInt(movie_id), 
          title: title || tmdbData.title || tmdbData.original_title || `Movie ${movie_id}`, 
          overview: overview || tmdbData.overview || '', 
          posterPath: poster_path || tmdbData.poster_path,
          backdropPath: tmdbData.backdrop_path,
          voteAverage: tmdbData.vote_average ? Number(tmdbData.vote_average) : 0
        }
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
    return res.status(201).json({ success: true });
  }
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
    include: { user: { select: { id: true, username: true, displayName: true } } },
    orderBy: { createdAt: 'desc' }
  });
  res.json({ success: true, data: reviews });
});

router.post('/reviews/:id/like', async (req: Request, res: Response) => {
  const { id } = req.params;
  const reviewId = Array.isArray(id) ? id[0] : id;
  
  const existing = await req.prisma.reviewLike.findFirst({
    where: { userId: req.userId!, reviewId }
  });

  if (existing) {
    await req.prisma.reviewLike.delete({ where: { id: existing.id } });
    await req.prisma.userReview.update({
      where: { id: reviewId },
      data: { likesCount: { decrement: 1 } }
    });
    return res.json({ success: true, liked: false });
  } else {
    await req.prisma.reviewLike.create({ data: { userId: req.userId!, reviewId } });
    await req.prisma.userReview.update({
      where: { id: reviewId },
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

router.get('/personal-recommendations', async (req: Request, res: Response) => {
  const topRated = await req.prisma.userMovieInteraction.findMany({
    where: { userId: req.userId!, rating: { gte: 9 } },
    include: { movie: { select: { tmdbId: true, title: true } } },
    orderBy: { updatedAt: 'desc' },
    take: 3
  });

  if (topRated.length === 0) {
    return res.json({ success: true, data: [], message: 'No rated movies yet' });
  }

  const watchedMovies = await req.prisma.userMovieInteraction.findMany({
    where: { userId: req.userId!, status: 'watched' },
    include: { movie: { select: { tmdbId: true } } }
  });
  const watchedIds = new Set(watchedMovies.map((m: any) => m.movie.tmdbId));

  const allRecommendations: any[] = [];

  for (const interaction of topRated) {
    const tmdbId = interaction.movie.tmdbId;
    try {
      const data: any = await getMovieRecommendations(tmdbId);
      if (data.results && data.results.length > 0) {
        allRecommendations.push(...data.results);
      }
    } catch (err) {
      console.error(`Failed to get recommendations for movie ${tmdbId}:`, err);
    }
  }

  const uniqueById = new Map<number, any>();
  for (const movie of allRecommendations) {
    if (!watchedIds.has(movie.id) && !uniqueById.has(movie.id)) {
      uniqueById.set(movie.id, movie);
    }
  }

  const shuffled = Array.from(uniqueById.values()).sort(() => Math.random() - 0.5);
  const final = shuffled.slice(0, 20).map((m: any) => ({
    tmdb_id: m.id,
    title: m.title || m.name,
    overview: m.overview,
    // --- ИСПРАВЛЕНО ДОБАВЛЕНИЕ PROXY URL ---
    poster_path: m.poster_path ? `https://moviefun.jents.online/api/images/proxy?size=w500&path=${m.poster_path}` : null,
    backdrop_path: m.backdrop_path ? `https://moviefun.jents.online/api/images/proxy?size=w780&path=${m.backdrop_path}` : null,
    // ---------------------------------------
    vote_average: m.vote_average,
    release_date: m.release_date || m.first_air_date,
    media_type: m.media_type || 'movie'
  }));

  res.json({ success: true, data: final });
});

export default router;