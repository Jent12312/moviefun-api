import type { VercelRequest, VercelResponse } from '@vercel/node';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

function base64UrlDecode(str: string): string {
    let output = str.replace(/-/g, '+').replace(/_/g, '/');
    switch (output.length % 4) {
        case 0: break;
        case 2: output += '=='; break;
        case 3: output += '='; break;
        default: throw new Error('Illegal base64url string!');
    }
    return Buffer.from(output, 'base64').toString('utf-8');
}

function verifyJWT(token: string): { sub: string; email: string } | null {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        const payload = JSON.parse(base64UrlDecode(parts[1]));
        if (payload.exp * 1000 < Date.now()) return null;
        return { sub: payload.sub, email: payload.email };
    } catch {
        return null;
    }
}

function getAuthUserId(req: VercelRequest): string | null {
    const authHeader = req.headers.authorization as string;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    const payload = verifyJWT(authHeader.substring(7));
    return payload ? payload.sub : null;
}

async function supabaseQuery(method: string, path: string, body?: any) {
    const url = `${SUPABASE_URL}/rest/v1${path}`;
    const headers: Record<string, string> = {
        'apikey': SUPABASE_SERVICE_KEY || '',
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': method === 'POST' || method === 'PATCH' ? 'return=representation' : 'count=exact',
    };
    if (method === 'POST' || method === 'PATCH') headers['Prefer'] += ', return=representation';

    const opts: RequestInit = { method, headers };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(url, opts);
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Supabase error ${res.status}: ${err}`);
    }
    if (res.status === 204) return null;
    return res.json();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const userId = getAuthUserId(req);
    if (!userId) {
        return res.status(401).json({
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'Invalid or missing token' }
        });
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        return res.status(500).json({
            success: false,
            error: { code: 'CONFIG_ERROR', message: 'Supabase not configured' }
        });
    }

    try {
        if (req.method === 'GET') {
            const { status, limit, offset } = req.query;
            const limitNum = Math.min(parseInt(limit as string) || 20, 50);
            const offsetNum = parseInt(offset as string) || 0;

            let filter = `user_id=eq.${userId}`;
            if (status && status !== 'all') {
                filter += `&status=eq.${status}`;
            }

            const data = await supabaseQuery('GET', 
                `/movie_interactions?${filter}&select=*,movies(tmdb_id,title,overview,poster_path,vote_average,release_date)&order(updated_at,desc)&limit=${limitNum}&offset=${offsetNum}`);

            const items = Array.isArray(data) ? data.map((item: any) => ({
                tmdb_id: item.movies?.tmdb_id || item.movie_id,
                title: item.movies?.title || '',
                overview: item.movies?.overview || '',
                poster_path: item.movies?.poster_path || '',
                vote_average: item.movies?.vote_average || 0,
                release_date: item.movies?.release_date || '',
                status: item.status,
                rating: item.rating,
                updated_at: item.updated_at
            })) : [];

            return res.status(200).json({
                success: true,
                data: items,
                meta: { limit: limitNum, offset: offsetNum }
            });
        }

        if (req.method === 'POST') {
            const { movie_id, status, rating } = req.body;
            if (!movie_id) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'BAD_REQUEST', message: 'movie_id is required' }
                });
            }

            const existing = await supabaseQuery('GET', 
                `/movie_interactions?user_id=eq.${userId}&movie_id=eq.${movie_id}&select=id`);

            let result;
            if (Array.isArray(existing) && existing.length > 0) {
                const updateData: Record<string, any> = { updated_at: new Date().toISOString() };
                if (status) updateData.status = status;
                if (rating !== undefined) updateData.rating = rating;

                result = await supabaseQuery('PATCH', 
                    `/movie_interactions?id=eq.${existing[0].id}`, updateData);
            } else {
                result = await supabaseQuery('POST', '/movie_interactions', {
                    user_id: userId,
                    movie_id: movie_id,
                    status: status || 'none',
                    rating: rating || null,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                });
            }

            return res.status(201).json({ success: true, data: result });
        }

        if (req.method === 'DELETE') {
            const { tmdb_id } = req.query;
            if (!tmdb_id) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'BAD_REQUEST', message: 'tmdb_id is required' }
                });
            }

            await supabaseQuery('DELETE', 
                `?user_id=eq.${userId}&movie_id=eq.${tmdb_id}`);

            return res.status(200).json({ success: true });
        }

        return res.status(405).json({
            success: false,
            error: { code: 'METHOD_NOT_ALLOWED', message: 'Only GET, POST, DELETE allowed' }
        });

    } catch (error: any) {
        return res.status(500).json({
            success: false,
            error: { code: 'INTERNAL_SERVER_ERROR', message: error.message }
        });
    }
}