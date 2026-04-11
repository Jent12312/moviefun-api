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
            const data = await supabaseQuery('GET', 
                `/user_lists?user_id=eq.${userId}&select=*,user_list_items(*)&order(created_at,desc)`);

            const lists = Array.isArray(data) ? data.map((list: any) => ({
                id: list.id,
                name: list.name,
                description: list.description,
                is_public: list.is_public,
                item_count: list.user_list_items?.length || 0,
                created_at: list.created_at,
                updated_at: list.updated_at
            })) : [];

            return res.status(200).json({ success: true, data: lists });
        }

        if (req.method === 'POST') {
            const { name, description, is_public } = req.body;
            if (!name) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'BAD_REQUEST', message: 'name is required' }
                });
            }

            const result = await supabaseQuery('POST', '/user_lists', {
                user_id: userId,
                name: name,
                description: description || '',
                is_public: is_public !== undefined ? is_public : false,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });

            return res.status(201).json({ success: true, data: result });
        }

        const listId = req.query.id || req.query.list_id;
        if (!listId) {
            return res.status(400).json({
                success: false,
                error: { code: 'BAD_REQUEST', message: 'list ID is required' }
            });
        }

        const existingList = await supabaseQuery('GET',
            `/user_lists?user_id=eq.${userId}&id=eq.${listId}&select=id`);
        if (!Array.isArray(existingList) || existingList.length === 0) {
            return res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'List not found' }
            });
        }

        if (req.method === 'PUT') {
            const { name, description, is_public } = req.body;
            const updateData: Record<string, any> = { updated_at: new Date().toISOString() };
            if (name) updateData.name = name;
            if (description !== undefined) updateData.description = description;
            if (is_public !== undefined) updateData.is_public = is_public;

            const result = await supabaseQuery('PATCH',
                `/user_lists?id=eq.${listId}`, updateData);

            return res.status(200).json({ success: true, data: result });
        }

        if (req.method === 'DELETE') {
            await supabaseQuery('DELETE', `/user_list_items?list_id=eq.${listId}`);
            await supabaseQuery('DELETE', `/user_lists?id=eq.${listId}`);

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