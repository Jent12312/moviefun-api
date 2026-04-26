import { Router, Request, Response } from 'express';
import * as tmdbService from '../services/tmdb.js';

const router = Router();

interface TMDBPaginatedResponse {
  page: number;
  results: unknown[];
  total_pages: number;
  total_results: number;
}

function sendError(res: Response, status: number, code: string, message: string) {
  res.status(status).json({ success: false, error: { code, message } });
}

router.get('/', async (req: Request, res: Response) => {
  const { action, id, season, page } = req.query;
  const pageNum = parseInt(page as string) || 1;

  try {
    if (action === 'popular') {
      const data = await tmdbService.getPopularTV(pageNum) as TMDBPaginatedResponse;
      return res.json({ success: true, data: data.results, meta: { page: data.page, total_pages: data.total_pages, total_results: data.total_results } });
    }

    if (action === 'top-rated') {
      const data = await tmdbService.getTopRatedTV(pageNum) as TMDBPaginatedResponse;
      return res.json({ success: true, data: data.results, meta: { page: data.page, total_pages: data.total_pages, total_results: data.total_results } });
    }

    if (action === 'trending') {
      const data = await tmdbService.getTrendingTV(pageNum) as TMDBPaginatedResponse;
      return res.json({ success: true, data: data.results, meta: { page: data.page, total_pages: data.total_pages, total_results: data.total_results } });
    }

    if (action === 'search') {
      const query = req.query.query as string;
      if (!query || query.trim().length < 2) {
        return sendError(res, 400, 'INVALID_QUERY', 'Search query must be at least 2 characters');
      }
      const data = await tmdbService.searchTV(query, pageNum) as TMDBPaginatedResponse;
      return res.json({ success: true, data: data.results, meta: { page: data.page, total_pages: data.total_pages, total_results: data.total_results, query } });
    }
    
    if (action === 'discover') {
      const genreId = req.query.with_genres ? parseInt(req.query.with_genres as string) : undefined;
      const year = req.query.first_air_date_year ? parseInt(req.query.first_air_date_year as string) : undefined;
      const minRating = req.query['vote_average.gte'] ? parseFloat(req.query['vote_average.gte'] as string) : undefined;
      const sortBy = req.query.sort_by as string || 'popularity.desc';

      const data = await tmdbService.discoverTV({
        genre_id: genreId,
        year: year,
        min_rating: minRating,
        sort_by: sortBy
      }, pageNum) as TMDBPaginatedResponse;

      return res.json({
        success: true,
        data: data.results,
        meta: { page: data.page, total_pages: data.total_pages, total_results: data.total_results }
      });
    }

    if (action === 'similar' && id) {
      if (!/^\d+$/.test(id as string)) {
        return sendError(res, 400, 'INVALID_ID', 'Valid TV ID is required');
      }
      const data = await tmdbService.getSimilarTV(parseInt(id as string)) as TMDBPaginatedResponse;
      return res.json({ success: true, data: data.results, meta: { page: data.page, total_pages: data.total_pages, total_results: data.total_results } });
    }

    if (action === 'credits' && id) {
      if (!/^\d+$/.test(id as string)) {
        return sendError(res, 400, 'INVALID_ID', 'Valid TV ID is required');
      }
      const data = await tmdbService.getTVCredits(parseInt(id as string));
      return res.json({ success: true, data });
    }

    if (action === 'season' && id && season) {
      if (!/^\d+$/.test(id as string) || !/^\d+$/.test(season as string)) {
        return sendError(res, 400, 'INVALID_PARAMS', 'Valid TV ID and season number required');
      }
      const data = await tmdbService.getTVSeason(parseInt(id as string), parseInt(season as string));
      res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
      return res.json({
        success: true,
        data: {
          id: data.id,
          tv_id: data.id,
          season_number: data.season_number,
          name: data.name,
          overview: data.overview,
          poster_path: data.poster_path,
          air_date: data.air_date,
          episodes: (data.episodes || []).map((ep) => ({
            id: ep.id,
            episode_number: ep.episode_number,
            name: ep.name,
            overview: ep.overview,
            still_path: ep.still_path,
            air_date: ep.air_date,
            vote_average: ep.vote_average,
            runtime: ep.runtime,
          })),
        }
      });
    }

    if (!action && id) {
      if (!/^\d+$/.test(id as string)) {
        return sendError(res, 400, 'INVALID_ID', 'Valid TV ID is required');
      }
      const show = await tmdbService.getTVShow(parseInt(id as string));

      const ratingStats = await req.prisma.userTvInteraction.aggregate({
        where: {
          series: { tmdbId: parseInt(id as string) },
          rating: { not: null }
        },
        _avg: { rating: true },
        _count: { rating: true }
      });

      const communityRating = ratingStats._avg.rating ? parseFloat(ratingStats._avg.rating.toFixed(1)) : null;
      const communityVotes = ratingStats._count.rating || 0;

      res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
      return res.json({
        success: true,
        data: {
          id: show.id,
          name: show.name || show.original_name,
          name_ru: show.name,
          original_name: show.original_name,
          overview: show.overview,
          poster_path: show.poster_path,
          backdrop_path: show.backdrop_path,
          first_air_date: show.first_air_date,
          last_air_date: show.last_air_date,
          episode_run_time: show.episode_run_time,
          number_of_seasons: show.number_of_seasons,
          number_of_episodes: show.number_of_episodes,
          vote_average: show.vote_average,
          vote_count: show.vote_count,
          community_rating: communityRating,
          community_votes: communityVotes,
          genres: show.genres,
          original_language: show.original_language,
          status: show.status,
          type: show.type,
          tagline: show.tagline,
          in_production: show.in_production,
          networks: show.networks?.map((n) => ({ id: n.id, name: n.name })),
          created_by: show.created_by?.map((c) => ({ id: c.id, name: c.name })),
          episode_run_time_avg: show.episode_run_time?.length
            ? show.episode_run_time.reduce((a, b) => a + b, 0) / show.episode_run_time.length
            : 0,
        }
      });
    }

    return sendError(res, 400, 'INVALID_ACTION', 'Valid action or id parameter is required');
  } catch (error: any) {
    return sendError(res, 500, 'INTERNAL_SERVER_ERROR', error.message || 'Unknown error');
  }
});

router.get('/:id/videos', async (req: Request, res: Response) => {
  const idParam = req.params.id;
  const id = Array.isArray(idParam) ? idParam[0] : idParam;

  if (!id || !/^\d+$/.test(id)) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_ID', message: 'Valid TV ID is required' } });
  }

  try {
    // Получаем видео на русском (функции из tmdbService)
    let data: any = await tmdbService.getTVVideos(parseInt(id));

    // ИСПРАВЛЕНО: Фолбэк на английский язык, если на русском трейлеров нет
    if (!data.results || data.results.length === 0) {
      const fallbackResponse = await fetch(`https://api.themoviedb.org/3/tv/${id}/videos?language=en-US`, {
        headers: { 'Authorization': `Bearer ${process.env.TMDB_API_KEY}` }
      });
      data = await fallbackResponse.json();
    }

    const videos = (data.results || []).map((v: any) => {
      let videoUrl = v.key;
      if (v.site === 'YouTube' && v.type === 'Trailer') {
        videoUrl = `https://www.youtube.com/embed/${v.key}?autoplay=1`;
      }
      return { id: v.id, name: v.name, key: v.key, site: v.site, type: v.type, official: v.official, videoUrl };
    });
    return res.json({ success: true, data: videos });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: error.message || 'Unknown error' } });
  }
});

export default router;