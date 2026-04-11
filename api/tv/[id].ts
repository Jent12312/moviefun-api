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

  const { id } = req.query;

  if (!id || typeof id !== 'string' || !/^\d+$/.test(id)) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_ID', message: 'Valid TV series ID is required as a numeric string' },
    });
    return;
  }

  if (!TMDB_API_KEY) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(500).json({
      success: false,
      error: { code: 'CONFIGURATION_ERROR', message: 'TMDB API key is not configured' },
    });
    return;
  }

  try {
    const tmdbUrl = `https://api.themoviedb.org/3/tv/${id}?language=ru-RU`;
    const tmdbRes = await fetch(tmdbUrl, {
      headers: { Authorization: `Bearer ${TMDB_API_KEY}` },
    });

    if (!tmdbRes.ok) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      if (tmdbRes.status === 404) {
        res.status(404).json({
          success: false,
          error: { code: 'TV_NOT_FOUND', message: 'TV series not found in TMDB' },
        });
      } else {
        res.status(tmdbRes.status).json({
          success: false,
          error: { code: 'TMDB_ERROR', message: 'Failed to fetch TV series from TMDB' },
        });
      }
      return;
    }

    const data = await tmdbRes.json();

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
    res.status(200).json({
      success: true,
      data: {
        id: data.id,
        name: data.name || data.original_name,
        name_ru: data.name,
        original_name: data.original_name,
        overview: data.overview,
        overview_ru: data.overview,
        poster_path: data.poster_path || null,
        backdrop_path: data.backdrop_path || null,
        first_air_date: data.first_air_date || '',
        last_air_date: data.last_air_date || '',
        episode_run_time: data.episode_run_time || [],
        number_of_seasons: data.number_of_seasons || 0,
        number_of_episodes: data.number_of_episodes || 0,
        vote_average: data.vote_average || 0,
        vote_count: data.vote_count || 0,
        popularity: data.popularity || 0,
        internal_rating: 0,
        internal_vote_count: 0,
        genres: (data.genres || []).map((g: any) => ({ id: g.id, name: g.name })),
        original_language: data.original_language,
        status: data.status,
        type: data.type,
        tagline: data.tagline,
        in_production: data.in_production || false,
        networks: (data.networks || []).map((n: any) => ({ id: n.id, name: n.name })),
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