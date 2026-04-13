import type { VercelRequest, VercelResponse } from '@vercel/node';
import { 
  fetchFromTMDB, 
  TMDBMovie, 
  TMDBPaginatedMovieResponse,
  setCORSHeaders,
  handleOPTIONS
} from '../utils/tmdb';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOPTIONS(req, res)) return;

  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: { code: 'METHOD_NOT_ALLOWED', message: 'Only GET is allowed' }
    });
  }

  try {
    const page = req.query.page || '1';

    const data = await fetchFromTMDB(`/movie/popular?language=ru-RU&page=${page}`) as TMDBPaginatedMovieResponse;

    setCORSHeaders(res);
    res.setHeader('Cache-Control', 'public, max-age=1800, s-maxage=3600');

    return res.status(200).json({
      success: true,
      data: data.results.map((movie: TMDBMovie) => ({
        id: movie.id,
        title: movie.title || movie.original_title,
        title_ru: movie.title,
        original_title: movie.original_title,
        overview: movie.overview,
        overview_ru: movie.overview,
        poster_path: movie.poster_path,
        backdrop_path: movie.backdrop_path,
        release_date: movie.release_date || '',
        vote_average: movie.vote_average || 0,
        vote_count: movie.vote_count || 0,
        popularity: movie.popularity || 0,
        adult: movie.adult || false,
        genre_ids: movie.genre_ids || []
      })),
      meta: {
        page: data.page,
        total_pages: data.total_pages,
        total_results: data.total_results
      }
    }));

  } catch (error: any) {
    console.error('Movies popular error:', error.message);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message }
    });
  }
}