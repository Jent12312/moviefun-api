import { Router, Request, Response } from 'express';
import * as tmdbService from '../services/tmdb.js';

const router = Router();

interface TMDBPaginatedResponse {
  page: number;
  results: unknown[];
  total_pages: number;
  total_results: number;
}

interface TMDBMultiResultItem {
  id: number;
  media_type: 'movie' | 'tv' | 'person';
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  vote_count?: number;
  popularity?: number;
  genre_ids?: number[];
  adult?: boolean;
}

function sendError(res: Response, status: number, code: string, message: string) {
  res.status(status).json({ success: false, error: { code, message } });
}

router.get('/', async (req: Request, res: Response) => {
  const { query, page } = req.query;
  const pageNum = parseInt(page as string) || 1;

  if (!query || (query as string).trim().length < 2) {
    return sendError(res, 400, 'INVALID_QUERY', 'Search query must be at least 2 characters');
  }

  try {
    const data = await tmdbService.searchMulti(query as string, pageNum) as TMDBPaginatedResponse;

    const results: TMDBMultiResultItem[] = data.results as TMDBMultiResultItem[];

    const movies = results
      .filter(item => item.media_type === 'movie')
      .map(item => ({
        tmdbId: item.id,
        title: item.title || item.original_title,
        overview: item.overview,
        posterPath: item.poster_path,
        releaseDate: item.release_date,
        voteAverage: item.vote_average,
        mediaType: 'movie',
      }));

    const series = results
      .filter(item => item.media_type === 'tv')
      .map(item => ({
        tmdbId: item.id,
        title: item.name || item.original_name,
        overview: item.overview,
        posterPath: item.poster_path,
        releaseDate: item.first_air_date,
        voteAverage: item.vote_average,
        mediaType: 'tv',
      }));

    return res.json({
      success: true,
      data: {
        movies,
        series,
        all: [...movies, ...series],
      },
      meta: {
        page: data.page,
        total_pages: data.total_pages,
        total_results: data.total_results,
        query,
        moviesCount: movies.length,
        seriesCount: series.length,
      },
    });
  } catch (error: any) {
    return sendError(res, 500, 'INTERNAL_SERVER_ERROR', error.message || 'Unknown error');
  }
});

export default router;