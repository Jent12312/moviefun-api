import { VercelRequest, VercelResponse } from '@vercel/node';

const TMDB_API_KEY = process.env.TMDB_API_KEY;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.status(204).end();
    return;
  }

  if (req.method !== 'GET') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(405).json({
      success: false,
      error: { code: 'METHOD_NOT_ALLOWED', message: 'Only GET method is allowed' },
    });
    return;
  }

  const { id, season } = req.query;

  if (!id || typeof id !== 'string' || !/^\d+$/.test(id)) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_ID', message: 'Valid TV ID is required' },
    });
    return;
  }

  if (!season || typeof season !== 'string' || !/^\d+$/.test(season)) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_SEASON', message: 'Valid season number is required' },
    });
    return;
  }

  if (!TMDB_API_KEY) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(500).json({
      success: false,
      error: { code: 'CONFIG_ERROR', message: 'TMDB API key not configured' },
    });
    return;
  }

  try {
    const tmdbUrl = `https://api.themoviedb.org/3/tv/${id}/season/${season}?language=ru-RU`;
    const tmdbRes = await fetch(tmdbUrl, {
      headers: { Authorization: `Bearer ${TMDB_API_KEY}` },
    });

    if (!tmdbRes.ok) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Season not found in TMDB' },
      });
      return;
    }

    const data = await tmdbRes.json();

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
    res.status(200).json({
      success: true,
      data: {
        id: data.id,
        tv_id: data.show_id || id,
        season_number: data.season_number,
        name: data.name || `Сезон ${season}`,
        overview: data.overview,
        poster_path: data.poster_path || null,
        air_date: data.air_date || '',
        episodes: (data.episodes || []).map((ep: any) => ({
          id: ep.id,
          episode_number: ep.episode_number,
          name: ep.name,
          overview: ep.overview,
          still_path: ep.still_path || null,
          air_date: ep.air_date || '',
          vote_average: ep.vote_average || 0,
          runtime: ep.runtime || 0,
          overview: ep.overview,
        })),
      },
    });
  } catch (error) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'Internal server error' },
    });
  }
}