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

async function supabaseQuery(method: string, path: string) {
    const url = `${SUPABASE_URL}/rest/v1${path}`;
    const headers: Record<string, string> = {
        'apikey': SUPABASE_SERVICE_KEY || '',
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
    };

    const res = await fetch(url, { method, headers });
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Supabase error ${res.status}: ${err}`);
    }
    if (res.status === 204) return null;
    return res.json();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
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
        const watchedData = await supabaseQuery('GET', 
            `/movie_interactions?user_id=eq.${userId}&status=eq.watched&select=id,rating`);

        watchingData = await supabaseQuery('GET', 
            `/movie_interactions?user_id=eq.${userId}&status=eq.watching&select=id`);
            
        const wantToWatchData = await supabaseQuery('GET', 
            `/movie_interactions?user_id=eq.${userId}&status=eq.want_to_watch&select=id`);

        const watched = Array.isArray(watchedData) ? watchedData : [];
        const watching = (Array.isArray(watchingData) ? watchingData : []) as any[];
        const wantToWatch = Array.isArray(wantToWatchData) ? wantToWatchData : [] as any[];

        const watchedCount = watched.length;
        const watchingCount = watching.length;
        const wantToWatchCount = wantToWatch.length;

        let totalRating = 0;
        let ratedCount = 0;
        for (const item of watched) {
            if (item.rating !== null && item.rating !== undefined) {
                totalRating += item.rating;
                ratedCount++;
            }
        }

        const averageRating = ratedCount > 0 ? totalRating / ratedCount : 0;

        return res.status(200).json({
            success: true,
            data: {
                watched_count: watchedCount,
                watching_count: watchingCount,
                want_to_watch_count: wantToWatchCount,
                average_rating: Math.round(averageRating * 10) / 10,
                total_movies: watchedCount + watchingCount + wantToWatchCount
            }
        });

    } catch (error: any) {
        return res.status(500).json({
            success: false,
            error: { code: 'INTERNAL_SERVER_ERROR', message: error.message }
        });
    }
}