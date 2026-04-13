import type { VercelRequest, VercelResponse } from '@vercel/node';

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
        return res.status(405).json({
            success: false,
            error: { code: 'METHOD_NOT_ALLOWED', message: 'Only GET allowed' }
        });
    }

    if (!TMDB_API_KEY) {
        return res.status(500).json({
            success: false,
            error: { code: 'CONFIG_ERROR', message: 'TMDB API key not configured' }
        });
    }

    try {
        const page = req.query.page ? parseInt(req.query.page as string) : 1;
        const tmdbUrl = `https://api.themoviedb.org/3/trending/tv/week?language=ru-RU&page=${page}`;
        const tmdbRes = await fetch(tmdbUrl, {
            headers: { Authorization: `Bearer ${TMDB_API_KEY}` }
        });

        if (!tmdbRes.ok) {
            return res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Could not fetch trending TV shows' }
            });
        }

        const data = await tmdbRes.json();

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
        res.status(200).json({
            success: true,
            data: {
                page: data.page || 1,
                total_pages: data.total_pages || 1,
                total_results: data.total_results || 0,
                results: (data.results || []).map((item: any) => ({
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
    } catch (error) {
        res.status(500).json({
            success: false,
            error: { code: 'INTERNAL_SERVER_ERROR', message: 'Internal server error' }
        });
    }
}