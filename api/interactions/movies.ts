import type { VercelRequest, VercelResponse } from '@vercel/node';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

async function supabaseQuery(method: string, path: string, body?: any) {
    const url = `${SUPABASE_URL}/rest/v1${path}`;
    const headers: Record<string, string> = {
        'apikey': SUPABASE_SERVICE_KEY || '',
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': method === 'POST' || method === 'PATCH' ? 'return=representation' : '',
    };

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
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        return res.status(500).json({
            success: false,
            error: { code: 'CONFIG_ERROR', message: 'Supabase not configured' }
        });
    }

    try {
        if (req.method === 'POST') {
            const { movie_id, status } = req.body;
            if (!movie_id) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'BAD_REQUEST', message: 'movie_id is required' }
                });
            }

            const result = await supabaseQuery('POST', '/movie_interactions', {
                movie_id,
                status: status || 'none',
            });

            return res.status(201).json({ success: true, data: result });
        }

        if (req.method === 'GET') {
            const { movie_id } = req.query;
            if (!movie_id) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'BAD_REQUEST', message: 'movie_id is required' }
                });
            }

            const result = await supabaseQuery('GET', `/movie_interactions?movie_id=eq.${movie_id}&select=*`);
            return res.status(200).json({ success: true, data: result });
        }

        if (req.method === 'DELETE') {
            const { id } = req.query;
            if (!id) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'BAD_REQUEST', message: 'id is required' }
                });
            }

            await supabaseQuery('DELETE', `/movie_interactions?id=eq.${id}`);
            return res.status(200).json({ success: true });
        }

        return res.status(405).json({
            success: false,
            error: { code: 'METHOD_NOT_ALLOWED', message: 'Only POST, GET, DELETE are allowed' }
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            error: { code: 'INTERNAL_SERVER_ERROR', message: error.message }
        });
    }
}
