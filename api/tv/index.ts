import type { VercelRequest, VercelResponse } from '@vercel/node';
import { 
  fetchFromTMDB, 
  TMDBTVShow, 
  TMDBSeason, 
  setCORSHeaders, 
  sendError,
  handleOPTIONS 
} from '../utils/tmdb';

interface TMDBPaginatedTVResponse {
  page: number;
  results: TMDBTVShow[];
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
    const { action, id, season } = req.query;
    const page = req.query.page || '1';

    let data: unknown;

    // Роутинг внутри одного файла
    if (action === 'popular') {
      data = await fetchFromTMDB(`/tv/popular?language=ru-RU&page=${page}`) as TMDBPaginatedTVResponse;
      return res.status(200).json({
        success: true,
        data: (data as TMDBPaginatedTVResponse).results,
        meta: {
          page: (data as TMDBPaginatedTVResponse).page,
          total_pages: (data as TMDBPaginatedTVResponse).total_pages,
          total_results: (data as TMDBPaginatedTVResponse).total_results
        }
      });
    } else if (action === 'top-rated') {
      data = await fetchFromTMDB(`/tv/top_rated?language=ru-RU&page=${page}`) as TMDBPaginatedTVResponse;
      return res.status(200).json({
        success: true,
        data: {
          page: (data as TMDBPaginatedTVResponse).page || 1,
          total_pages: (data as TMDBPaginatedTVResponse).total_pages || 1,
          total_results: (data as TMDBPaginatedTVResponse).total_results || 0,
          results: ((data as TMDBPaginatedTVResponse).results || []).map((item) => ({
            id: item.id,
            name: item.name,
            overview: item.overview,
            poster_path: item.poster_path,
            first_air_date: item.first_air_date,
            vote_average: item.vote_average || 0,
            vote_count: item.vote_count || 0,
          }))
        }
      });
    } else if (action === 'trending') {
      data = await fetchFromTMDB(`/trending/tv/week?language=ru-RU&page=${page}`) as TMDBPaginatedTVResponse;
      return res.status(200).json({
        success: true,
        data: {
          page: (data as TMDBPaginatedTVResponse).page || 1,
          total_pages: (data as TMDBPaginatedTVResponse).total_pages || 1,
          total_results: (data as TMDBPaginatedTVResponse).total_results || 0,
          results: ((data as TMDBPaginatedTVResponse).results || []).map((item) => ({
            id: item.id,
            name: item.name,
            overview: item.overview,
            poster_path: item.poster_path,
            first_air_date: item.first_air_date,
            vote_average: item.vote_average || 0,
            vote_count: item.vote_count || 0,
          }))
        }
      });
    } else if (action === 'search') {
      const query = req.query.query as string;
      if (!query || query.trim().length < 2) {
        return sendError(res, 400, 'INVALID_QUERY', 'Search query must be at least 2 characters');
      }
      data = await fetchFromTMDB(`/search/tv?query=${encodeURIComponent(query)}&language=ru-RU&page=${page}`) as TMDBPaginatedTVResponse;
      return res.status(200).json({
        success: true,
        data: (data as TMDBPaginatedTVResponse).results,
        meta: {
          page: (data as TMDBPaginatedTVResponse).page,
          total_pages: (data as TMDBPaginatedTVResponse).total_pages,
          total_results: (data as TMDBPaginatedTVResponse).total_results,
          query: query
        }
      });
    } else if (action === 'similar' && id) {
      if (typeof id !== 'string' || !/^\d+$/.test(id)) {
        return sendError(res, 400, 'INVALID_ID', 'Valid TV ID is required');
      }
      data = await fetchFromTMDB(`/tv/${id}/similar?language=ru-RU&page=1`) as TMDBPaginatedTVResponse;
      return res.status(200).json({
        success: true,
        data: {
          page: (data as TMDBPaginatedTVResponse).page || 1,
          total_pages: (data as TMDBPaginatedTVResponse).total_pages || 1,
          total_results: (data as TMDBPaginatedTVResponse).total_results || 0,
          results: ((data as TMDBPaginatedTVResponse).results || []).map((item) => ({
            id: item.id,
            name: item.name,
            overview: item.overview,
            poster_path: item.poster_path,
            first_air_date: item.first_air_date,
            vote_average: item.vote_average || 0,
            vote_count: item.vote_count || 0,
          }))
        }
      });
    } else if (action === 'season' && id && season) {
      if (typeof id !== 'string' || !/^\d+$/.test(id)) {
        return sendError(res, 400, 'INVALID_ID', 'Valid TV ID is required');
      }
      if (typeof season !== 'string' || !/^\d+$/.test(season)) {
        return sendError(res, 400, 'INVALID_SEASON', 'Valid season number is required');
      }
      data = await fetchFromTMDB(`/tv/${id}/season/${season}?language=ru-RU`) as TMDBSeason;
      setCORSHeaders(res);
      res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
      return res.status(200).json({
        success: true,
        data: {
          id: (data as TMDBSeason).id,
          tv_id: (data as TMDBSeason).id,
          season_number: (data as TMDBSeason).season_number,
          name: (data as TMDBSeason).name || `Сезон ${season}`,
          overview: (data as TMDBSeason).overview,
          poster_path: (data as TMDBSeason).poster_path || null,
          air_date: (data as TMDBSeason).air_date || '',
          episodes: ((data as TMDBSeason).episodes || []).map((ep) => ({
            id: ep.id,
            episode_number: ep.episode_number,
            name: ep.name,
            overview: ep.overview,
            still_path: ep.still_path || null,
            air_date: ep.air_date || '',
            vote_average: ep.vote_average || 0,
            runtime: ep.runtime || 0,
          })),
        },
      });
    } else if (!action && id) {
      // GET /api/tv/123 - получение одного сериала
      if (typeof id !== 'string' || !/^\d+$/.test(id)) {
        return sendError(res, 400, 'INVALID_ID', 'Valid TV series ID is required');
      }
      const show = await fetchFromTMDB(`/tv/${id}?language=ru-RU`) as TMDBTVShow;
      setCORSHeaders(res);
      res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
      return res.status(200).json({
        success: true,
        data: {
          id: show.id,
          name: show.name || show.original_name,
          name_ru: show.name,
          original_name: show.original_name,
          overview: show.overview,
          overview_ru: show.overview,
          poster_path: show.poster_path || null,
          backdrop_path: show.backdrop_path || null,
          first_air_date: show.first_air_date || '',
          last_air_date: show.last_air_date || '',
          episode_run_time: show.episode_run_time || [],
          number_of_seasons: show.number_of_seasons || 0,
          number_of_episodes: show.number_of_episodes || 0,
          vote_average: show.vote_average || 0,
          vote_count: show.vote_count || 0,
          popularity: show.popularity || 0,
          internal_rating: 0,
          internal_vote_count: 0,
          genres: (show.genres || []).map((g) => ({ id: g.id, name: g.name })),
          original_language: show.original_language,
          status: show.status,
          type: show.type,
          tagline: show.tagline,
          in_production: show.in_production || false,
          networks: (show.networks || []).map((n) => ({ id: n.id, name: n.name })),
        },
      });
    } else {
      return sendError(res, 400, 'INVALID_ACTION', 'Valid action parameter is required');
    }
  } catch (error: any) {
    return sendError(res, 500, 'INTERNAL_SERVER_ERROR', error.message || 'Unknown error occurred');
  }
}
