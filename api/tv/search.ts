import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ 
            success: false, 
            error: { code: 'METHOD_NOT_ALLOWED', message: 'Only GET is allowed' } 
        });
    }

    try {
        const query = req.query.query as string;
        const page = req.query.page || '1';

        if (!query || query.trim().length < 2) {
            return res.status(400).json({
                success: false,
                error: { code: 'INVALID_QUERY', message: 'Search query must be at least 2 characters' }
            });
        }

        const tmdbKey = process.env.TMDB_API_KEY;
        if (!tmdbKey) {
            throw new Error("TMDB API Key is missing on the server");
        }

        const response = await fetch(
            `https://api.themoviedb.org/3/search/tv?query=${encodeURIComponent(query)}&language=ru-RU&page=${page}`,
            {
                headers: {
                    'Authorization': `Bearer ${tmdbKey}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (!response.ok) {
            throw new Error(`TMDB responded with status: ${response.status}`);
        }

        const data = await response.json();

        return res.status(200).json({
            success: true,
            data: data.results,
            meta: {
                page: data.page,
                total_pages: data.total_pages,
                total_results: data.total_results,
                query: query
            }
        });

    } catch (error: any) {
        return res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: error.message || 'Unknown error occurred'
            }
        });
    }
}