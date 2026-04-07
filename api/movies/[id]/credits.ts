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
        const { id } = req.query;

        if (!id || typeof id !== 'string' || !/^\d+$/.test(id)) {
            return res.status(400).json({
                success: false,
                error: { code: 'INVALID_ID', message: 'Valid movie ID is required' }
            });
        }

        const tmdbKey = process.env.TMDB_API_KEY;
        if (!tmdbKey) {
            throw new Error("TMDB API Key is missing");
        }

        const response = await fetch(
            `https://api.themoviedb.org/3/movie/${id}/credits?language=ru-RU`,
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
            data: {
                cast: (data.cast || []).map((c: any) => ({
                    id: c.id,
                    name: c.name,
                    name_ru: c.name,
                    profile_path: c.profile_path || null,
                    character: c.character || '',
                    known_for_department: c.known_for_department || '',
                    gender: c.gender || 0,
                    order: c.order || 0,
                })),
                crew: (data.crew || []).map((c: any) => ({
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
