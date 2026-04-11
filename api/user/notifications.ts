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
            const { limit, offset, unread_only } = req.query;
            const limitNum = Math.min(parseInt(limit as string) || 20, 50);
            const offsetNum = parseInt(offset as string) || 0;

            let filter = `user_id=eq.${userId}`;
            if (unread_only === 'true') {
                filter += `&is_read=eq.false`;
            }

            const notifications = await supabaseQuery('GET', 
                `/notifications?${filter}&select=*&order(created_at,desc)&limit=${limitNum}&offset=${offsetNum}`);

            const items = Array.isArray(notifications) ? notifications.map((n: any) => ({
                id: n.id,
                type: n.type,
                title: n.title,
                message: n.message,
                data: n.data,
                is_read: n.is_read,
                created_at: n.created_at
            })) : [];

            const unreadCount = await supabaseQuery('GET', 
                `/notifications?user_id=eq.${userId}&is_read=eq.false&select=id`);

            const unread = Array.isArray(unreadCount) ? unreadCount.length : 0;

            return res.status(200).json({
                success: true,
                data: items,
                meta: { 
                    limit: limitNum, 
                    offset: offsetNum,
                    unread_count: unread
                }
            });
        }

        if (req.method === 'POST') {
            const { type, title, message, data } = req.body;
            if (!type || !title) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'BAD_REQUEST', message: 'type and title are required' }
                });
            }

            const result = await supabaseQuery('POST', '/notifications', {
                user_id: userId,
                type: type,
                title: title,
                message: message || '',
                data: data || {},
                is_read: false,
                created_at: new Date().toISOString()
            });

            return res.status(201).json({ success: true, data: result });
        }

        const notificationId = req.query.id || req.query.notification_id;
        if (!notificationId && (req.method === 'PUT' || req.method === 'DELETE')) {
            return res.status(400).json({
                success: false,
                error: { code: 'BAD_REQUEST', message: 'Notification ID is required' }
            });
        }

        if (req.method === 'PUT') {
            await supabaseQuery('PATCH', 
                `/notifications?user_id=eq.${userId}&id=eq.${notificationId}`, {
                    is_read: true,
                    created_at: new Date().toISOString()
                });
            return res.status(200).json({ success: true });
        }

        if (req.method === 'DELETE') {
            await supabaseQuery('DELETE', 
                `/notifications?user_id=eq.${userId}&id=eq.${notificationId}`);
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