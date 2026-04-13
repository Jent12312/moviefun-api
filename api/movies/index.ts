import type { VercelRequest, VercelResponse } from '@vercel/node';
import { 
  fetchFromTMDB, 
  TMDBMovie, 
  TMDBCredits, 
  setCORSHeaders, 
  sendError,
  handleOPTIONS 
} from '../utils/tmdb';

interface TMDBPaginatedMovieResponse {
  page: number;
  results: TMDBMovie[];
  total_pages: number;
  total_results: number;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOPTIONS(req, res)) return;

  if (req.method !== 'GET') {
    sendError(res, 405, 'METHOD_NOT_ALLOWED', 'Only GET is allowed');
    return;
  }

  try {
    const { action, id } = req.query;
    const page = req.query.page || '1';

    let data: unknown;

    // Роутинг внутри одного файла
    if (action === 'popular') {
      data = await fetchFromTMDB(`/movie/popular?language=ru-RU&page=${page}`) as TMDBPaginatedMovieResponse;
      return res.status(200).json({
        success: true,
        data: (data as TMDBPaginatedMovieResponse).results,
        meta: {
          page: (data as TMDBPaginatedMovieResponse).page,
          total_pages: (data as TMDBPaginatedMovieResponse).total_pages,
          total_results: (data as TMDBPaginatedMovieResponse).total_results
        }
      });
    } else if (action === 'top-rated') {
      data = await fetchFromTMDB(`/movie/top_rated?language=ru-RU&page=${page}`) as TMDBPaginatedMovieResponse;
      return res.status(200).json({
        success: true,
        data: (data as TMDBPaginatedMovieResponse).results,
        meta: {
          page: (data as TMDBPaginatedMovieResponse).page,
          total_pages: (data as TMDBPaginatedMovieResponse).total_pages,
          total_results: (data as TMDBPaginatedMovieResponse).total_results
        }
      });
    } else if (action === 'trending') {
      data = await fetchFromTMDB(`/trending/movie/day?language=ru-RU&page=${page}`) as TMDBPaginatedMovieResponse;
      return res.status(200).json({
        success: true,
        data: (data as TMDBPaginatedMovieResponse).results,
        meta: {
          page: (data as TMDBPaginatedMovieResponse).page,
          total_pages: (data as TMDBPaginatedMovieResponse).total_pages,
          total_results: (data as TMDBPaginatedMovieResponse).total_results
        }
      });
    } else if (action === 'upcoming') {
      data = await fetchFromTMDB(`/movie/upcoming?language=ru-RU&page=${page}`) as TMDBPaginatedMovieResponse;
      return res.status(200).json({
        success: true,
        data: (data as TMDBPaginatedMovieResponse).results,
        meta: {
          page: (data as TMDBPaginatedMovieResponse).page,
          total_pages: (data as TMDBPaginatedMovieResponse).total_pages,
          total_results: (data as TMDBPaginatedMovieResponse).total_results
        }
      });
    } else if (action === 'search') {
      const query = req.query.query as string;
      if (!query || query.trim().length < 2) {
        return sendError(res, 400, 'INVALID_QUERY', 'Search query must be at least 2 characters');
      }
      data = await fetchFromTMDB(`/search/movie?query=${encodeURIComponent(query)}&language=ru-RU&page=${page}`) as TMDBPaginatedMovieResponse;
      return res.status(200).json({
        success: true,
        data: (data as TMDBPaginatedMovieResponse).results,
        meta: {
          page: (data as TMDBPaginatedMovieResponse).page,
          total_pages: (data as TMDBPaginatedMovieResponse).total_pages,
          total_results: (data as TMDBPaginatedMovieResponse).total_results,
          query: query
        }
      });
    } else if (action === 'similar' && id) {
      if (typeof id !== 'string' || !/^\d+$/.test(id)) {
        return sendError(res, 400, 'INVALID_ID', 'Valid movie ID is required');
      }
      data = await fetchFromTMDB(`/movie/${id}/similar?language=ru-RU`) as TMDBPaginatedMovieResponse;
      return res.status(200).json({
        success: true,
        data: (data as TMDBPaginatedMovieResponse).results,
        meta: {
          page: (data as TMDBPaginatedMovieResponse).page,
          total_pages: (data as TMDBPaginatedMovieResponse).total_pages,
          total_results: (data as TMDBPaginatedMovieResponse).total_results
        }
      });
    } else if (action === 'credits' && id) {
      if (typeof id !== 'string' || !/^\d+$/.test(id)) {
        return sendError(res, 400, 'INVALID_ID', 'Valid movie ID is required');
      }
      data = await fetchFromTMDB(`/movie/${id}/credits?language=ru-RU`) as TMDBCredits;
      return res.status(200).json({
        success: true,
        data: {
          cast: ((data as TMDBCredits).cast || []).map((c) => ({
            id: c.id,
            name: c.name,
            name_ru: c.name,
            profile_path: c.profile_path || null,
            character: c.character || '',
            known_for_department: c.known_for_department || '',
            gender: c.gender || 0,
            order: c.order || 0,
          })),
          crew: ((data as TMDBCredits).crew || []).map((c) => ({
            id: c.id,
            name: c.name,
            name_ru: c.name,
            profile_path: c.profile_path || null,
            department: c.department || '',
            job: c.job || '',
            known_for_department: c.known_for_department || '',
            gender: c.gender || 0,
          }))
        }
      });
    } else if (!action && id) {
      // GET /api/movies/123 - получение одного фильма
      if (typeof id !== 'string' || !/^\d+$/.test(id)) {
        return sendError(res, 400, 'INVALID_ID', 'Valid movie ID is required');
      }
      const movie = await fetchFromTMDB(`/movie/${id}?language=ru-RU`) as TMDBMovie;
      setCORSHeaders(res);
      res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
      return res.status(200).json({
        success: true,
        data: {
          id: movie.id,
          title: movie.title || movie.original_title,
          title_ru: movie.title,
          original_title: movie.original_title,
          overview: movie.overview,
          overview_ru: movie.overview,
          poster_path: movie.poster_path || null,
          backdrop_path: movie.backdrop_path || null,
          release_date: movie.release_date || '',
          runtime: movie.runtime || 0,
          vote_average: movie.vote_average || 0,
          vote_count: movie.vote_count || 0,
          popularity: movie.popularity || 0,
          internal_rating: 0,
          internal_vote_count: 0,
          genres: (movie.genres || []).map((g) => ({ id: g.id, name: g.name })),
          original_language: movie.original_language,
          status: movie.status,
          tagline: movie.tagline,
          adult: movie.adult,
          imdb_id: movie.imdb_id || '',
          budget: movie.budget || 0,
          revenue: movie.revenue || 0,
        },
      });
    } else {
      return sendError(res, 400, 'INVALID_ACTION', 'Valid action parameter is required');
    }
  } catch (error: any) {
    return sendError(res, 500, 'INTERNAL_SERVER_ERROR', error.message || 'Unknown error occurred');
  }
}
