import { Response } from 'express';
import * as tmdbService from './tmdb.js';

export function sendError(res: Response, status: number, code: string, message: string) {
  res.status(status).json({ success: false, error: { code, message } });
}

export interface TMDBPaginatedResponse {
  page: number;
  results: unknown[];
  total_pages: number;
  total_results: number;
}

export async function handlePaginatedAction(
  res: Response,
  actionPromise: Promise<unknown>,
  extraMeta: Record<string, unknown> = {}
) {
  const data = (await actionPromise) as TMDBPaginatedResponse;
  return res.json({
    success: true,
    data: data.results,
    meta: {
      page: data.page,
      total_pages: data.total_pages,
      total_results: data.total_results,
      ...extraMeta,
    },
  });
}

export async function handleVideos(
  res: Response,
  type: 'movie' | 'tv',
  id: number
) {
  try {
    let data: any = type === 'movie' 
      ? await tmdbService.getMovieVideos(id)
      : await tmdbService.getTVVideos(id);

    if (!data.results || data.results.length === 0) {
      const fallbackResponse = await fetch(`https://api.themoviedb.org/3/${type}/${id}/videos?language=en-US`, {
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
    return sendError(res, 500, 'INTERNAL_SERVER_ERROR', error.message || 'Unknown error');
  }
}
