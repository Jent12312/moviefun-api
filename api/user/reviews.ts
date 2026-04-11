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
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
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
            const { tmdb_id, limit, offset } = req.query;
            const limitNum = Math.min(parseInt(limit as string) || 20, 50);
            const offsetNum = parseInt(offset as string) || 0;

            let filter = `user_id=eq.${userId}`;
            if (tmdb_id) {
                filter += `&tmdb_id=eq.${tmdb_id}`;
            }

            const reviews = await supabaseQuery('GET', 
                `/user_reviews?${filter}&select=*,movies(tmdb_id,title,poster_path)&order(created_at,desc)&limit=${limitNum}&offset=${offsetNum}`);

            const items = Array.isArray(reviews) ? reviews.map((r: any) => ({
                id: r.id,
                tmdb_id: r.tmdb_id,
                title: r.movies?.title || '',
                poster_path: r.movies?.poster_path || '',
                content: r.content,
                rating: r.rating,
                likes_count: r.likes_count || 0,
                is_liked: false,
                created_at: r.created_at,
                updated_at: r.updated_at
            })) : [];

            return res.status(200).json({
                success: true,
                data: items,
                meta: { limit: limitNum, offset: offsetNum }
            });
        }

        if (req.method === 'POST') {
            const { tmdb_id, content, rating } = req.body;
            if (!tmdb_id || !content) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'BAD_REQUEST', message: 'tmdb_id and content are required' }
                });
            }

            if (rating && (rating < 0.5 || rating > 10)) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'BAD_REQUEST', message: 'Rating must be between 0.5 and 10' }
                });
            }

            const existing = await supabaseQuery('GET', 
                `/user_reviews?user_id=eq.${userId}&tmdb_id=eq.${tmdb_id}&select=id`);

            let result;
            if (Array.isArray(existing) && existing.length > 0) {
                result = await supabaseQuery('PATCH', 
                    `/user_reviews?id=eq.${existing[0].id}`, {
                        content: content,
                        rating: rating || null,
                        updated_at: new Date().toISOString()
                    });
            } else {
                result = await supabaseQuery('POST', '/user_reviews', {
                    user_id: userId,
                    tmdb_id: tmdb_id,
                    content: content,
                    rating: rating || null,
                    likes_count: 0,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                });
            }

            return res.status(201).json({ success: true, data: result });
        }

        const reviewId = req.query.id || req.query.review_id;
        if (!reviewId && (req.method === 'PUT' || req.method === 'DELETE')) {
            return res.status(400).json({
                success: false,
                error: { code: 'BAD_REQUEST', message: 'Review ID is required' }
            });
        }

        const existingReview = await supabaseQuery('GET',
            `/user_reviews?user_id=eq.${userId}&id=eq.${reviewId}&select=id`);
        if (!Array.isArray(existingReview) || existingReview.length === 0) {
            return res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Review not found' }
            });
        }

        if (req.method === 'PUT') {
            const { content, rating } = req.body;
            const updateData: Record<string, any> = { updated_at: new Date().toISOString() };
            if (content) updateData.content = content;
            if (rating !== undefined) updateData.rating = rating;

            const result = await supabaseQuery('PATCH',
                `/user_reviews?id=eq.${reviewId}`, updateData);

            return res.status(200).json({ success: true, data: result });
        }

        if (req.method === 'DELETE') {
            await supabaseQuery('DELETE', `/user_reviews?id=eq.${reviewId}`);
            return res.status(200).json({ success: true });
        }

        return res.status(405).json({
            success: false,
            error: { code: 'METHOD_NOT_ALLOWED', message: 'Only GET, POST, PUT, DELETE allowed' }
        });

    } catch (error: any) {
        return res.status(500).json({
            success: false,
            error: { code: 'INTERNAL_SERVER_ERROR', message: error.message }
        });
    }
}