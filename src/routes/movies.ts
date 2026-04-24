import { Router, Request, Response } from 'express';
import * as tmdbService from '../services/tmdb.js';

const router = Router();

interface TMDBPaginatedResponse {
  page: number;
  results: unknown[];
  total_pages: number;
  total_results: number;
}

interface TMDBVideosResponse {
  id: number;
  results: Array<{
    id: string;
    iso_639_1: string;
    iso_3166_1: string;
    name: string;
    key: string;
    site: string;
    type: string;
    official: boolean;
  }>;
}

function sendError(res: Response, status: number, code: string, message: string) {
  res.status(status).json({ success: false, error: { code, message } });
}

router.get('/', async (req: Request, res: Response) => {
  const { action, id, page } = req.query;
  const pageNum = parseInt(page as string) || 1;

  try {
    if (action === 'popular') {
      const data = await tmdbService.getPopularMovies(pageNum) as TMDBPaginatedResponse;
      return res.json({
        success: true,
        data: data.results,
        meta: { page: data.page, total_pages: data.total_pages, total_results: data.total_results }
      });
    }

    if (action === 'top-rated') {
      const data = await tmdbService.getTopRatedMovies(pageNum) as TMDBPaginatedResponse;
      return res.json({
        success: true,
        data: data.results,
        meta: { page: data.page, total_pages: data.total_pages, total_results: data.total_results }
      });
    }

    if (action === 'trending') {
      const data = await tmdbService.getTrendingMovies(pageNum) as TMDBPaginatedResponse;
      return res.json({
        success: true,
        data: data.results,
        meta: { page: data.page, total_pages: data.total_pages, total_results: data.total_results }
      });
    }

    if (action === 'upcoming') {
      const data = await tmdbService.getUpcomingMovies(pageNum) as TMDBPaginatedResponse;
      return res.json({
        success: true,
        data: data.results,
        meta: { page: data.page, total_pages: data.total_pages, total_results: data.total_results }
      });
    }

    if (action === 'search') {
      const query = req.query.query as string;
      if (!query || query.trim().length < 2) {
        return sendError(res, 400, 'INVALID_QUERY', 'Search query must be at least 2 characters');
      }
      const data = await tmdbService.searchMovies(query, pageNum) as TMDBPaginatedResponse;
      return res.json({
        success: true,
        data: data.results,
        meta: { page: data.page, total_pages: data.total_pages, total_results: data.total_results, query }
      });
    }

    if (action === 'similar' && id) {
      if (!/^\d+$/.test(id as string)) {
        return sendError(res, 400, 'INVALID_ID', 'Valid movie ID is required');
      }
      const data = await tmdbService.getSimilarMovies(parseInt(id as string)) as TMDBPaginatedResponse;
      return res.json({ success: true, data: data.results, meta: { page: data.page, total_pages: data.total_pages, total_results: data.total_results } });
    }

    if (action === 'credits' && id) {
      if (!/^\d+$/.test(id as string)) {
        return sendError(res, 400, 'INVALID_ID', 'Valid movie ID is required');
      }
      const data = await tmdbService.getMovieCredits(parseInt(id as string));
      return res.json({ success: true, data });
    }

    if (!action && id) {
      if (!/^\d+$/.test(id as string)) {
        return sendError(res, 400, 'INVALID_ID', 'Valid movie ID is required');
      }
      const movie = await tmdbService.getMovie(parseInt(id as string));
      res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
      return res.json({
        success: true,
        data: {
          id: movie.id,
          title: movie.title || movie.original_title,
          title_ru: movie.title,
          original_title: movie.original_title,
          overview: movie.overview,
          poster_path: movie.poster_path,
          backdrop_path: movie.backdrop_path,
          release_date: movie.release_date,
          runtime: movie.runtime,
          vote_average: movie.vote_average,
          vote_count: movie.vote_count,
          genres: movie.genres,
          original_language: movie.original_language,
          status: movie.status,
          tagline: movie.tagline,
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
    return sendError(res, 400, 'INVALID_ID', 'Valid movie ID is required');
  }

  try {
    const data = await tmdbService.getMovieVideos(parseInt(id)) as TMDBVideosResponse;
    const videos = data.results.map((v: any) => ({
      id: v.id,
      name: v.name,
      key: v.key,
      site: v.site,
      type: v.type,
      official: v.official
    }));
    return res.json({ success: true, data: videos });
  } catch (error: any) {
    return sendError(res, 500, 'INTERNAL_SERVER_ERROR', error.message || 'Unknown error');
  }
});

export default router;