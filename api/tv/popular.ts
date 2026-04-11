import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

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
        const page = req.query.page || '1';
        const tmdbKey = process.env.TMDB_API_KEY;

        if (!tmdbKey) {
            throw new Error("TMDB API Key is missing on the server");
        }

        const response = await fetch(`https://api.themoviedb.org/3/tv/popular?language=ru-RU&page=${page}`, {
            headers: {
                'Authorization': `Bearer ${tmdbKey}`,
                'Content-Type': 'application/json'
            }
        });

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
                total_results: data.total_results
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