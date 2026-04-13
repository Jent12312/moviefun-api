import type { VercelRequest, VercelResponse } from '@vercel/node';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

function base64UrlDecode(str: string): string {
    let output = str.replace(/-/g, '+').replace(/_/g, '/');
    switch (output.length % 4) {
        case 0: break;
        case 2: output += '==';
        case 3: output += '=';
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

async function supabaseQuery(method: string, path: string, body?: object) {
    const url = `${SUPABASE_URL}/rest/v1${path}`;
    const headers: Record<string, string> = {
        'apikey': SUPABASE_SERVICE_KEY || '',
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
    };
    if (method === 'POST' || method === 'PATCH') {
        headers['Prefer'] = 'return=representation';
    }

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

    const listId = req.query.list_id as string;
    if (!listId) {
        return res.status(400).json({
            success: false,
            error: { code: 'BAD_REQUEST', message: 'list_id is required' }
        });
    }

    const listCheck = await supabaseQuery('GET',
        `/user_lists?id=eq.${listId}&user_id=eq.${userId}&select=id`);
    if (!Array.isArray(listCheck) || listCheck.length === 0) {
        return res.status(403).json({
            success: false,
            error: { code: 'FORBIDDEN', message: 'List not found or access denied' }
        });
    }

    try {
        if (req.method === 'GET') {
            const data = await supabaseQuery('GET',
                `/user_list_items?list_id=eq.${listId}&select=*,movies(tmdb_id,title,poster_path)`);

            const items = Array.isArray(data) ? data.map((item: any) => ({
                id: item.id,
                movie_id: item.movie_id,
                tmdb_id: item.movies?.tmdb_id,
                title: item.movies?.title,
                poster_path: item.movies?.poster_path,
                added_at: item.added_at
            })) : [];

            return res.status(200).json({ success: true, data: items });
        }

        if (req.method === 'POST') {
            const { movie_id, tmdb_id } = req.body;
            
            if (!movie_id && !tmdb_id) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'BAD_REQUEST', message: 'movie_id or tmdb_id is required' }
                });
            }

            let movieUuid = movie_id;
            if (!movieUuid && tmdb_id) {
                const movieData = await supabaseQuery('GET',
                    `/movies?tmdb_id=eq.${tmdb_id}&select=id`);
                if (!Array.isArray(movieData) || movieData.length === 0) {
                    return res.status(404).json({
                        success: false,
                        error: { code: 'NOT_FOUND', message: 'Movie not found in catalog' }
                    });
                }
                movieUuid = movieData[0].id;
            }

            const result = await supabaseQuery('POST', '/user_list_items', {
                list_id: listId,
                movie_id: movieUuid,
                added_at: new Date().toISOString()
            });

            return res.status(201).json({ success: true, data: result });
        }

        if (req.method === 'DELETE') {
            const { movie_id } = req.query;
            if (!movie_id) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'BAD_REQUEST', message: 'movie_id is required' }
                });
            }

            await supabaseQuery('DELETE',
                `?list_id=eq.${listId}&movie_id=eq.${movie_id}`);

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