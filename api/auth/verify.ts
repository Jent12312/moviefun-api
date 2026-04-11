import type { VercelRequest, VercelResponse } from '@vercel/node';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

interface JWTPayload {
    sub: string;
    email: string;
    email_confirmed_at?: string;
    aud: string;
    role: string;
    iat: number;
    exp: number;
}

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

function verifyJWT(token: string): JWTPayload | null {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;

        const payload = JSON.parse(base64UrlDecode(parts[1]));
        if (payload.exp * 1000 < Date.now()) return null;

        return payload;
    } catch {
        return null;
    }
}

async function getUserFromSupabase(userId: string): Promise<any> {
    const url = `${SUPABASE_URL}/rest/v1/users?select=*&id=eq.${userId}`;
    const res = await fetch(url, {
        headers: {
            'apikey': SUPABASE_SERVICE_KEY || '',
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json'
        }
    });

    if (!res.ok) return null;
    const users = await res.json();
    return users.length > 0 ? users[0] : null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({
            success: false,
            error: { code: 'METHOD_NOT_ALLOWED', message: 'Only GET or POST allowed' }
        });
    }

    try {
        const authHeader = req.headers.authorization as string;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                error: { code: 'UNAUTHORIZED', message: 'Missing or invalid Authorization header' }
            });
        }

        const token = authHeader.substring(7);
        const payload = verifyJWT(token);

        if (!payload) {
            return res.status(401).json({
                success: false,
                error: { code: 'INVALID_TOKEN', message: 'Invalid or expired token' }
            });
        }

        const user = await getUserFromSupabase(payload.sub);

        return res.status(200).json({
            success: true,
            data: {
                id: payload.sub,
                email: payload.email,
                role: payload.role,
                email_confirmed_at: payload.email_confirmed_at,
                created_at: user?.created_at || null
            }
        });

    } catch (error: any) {
        return res.status(500).json({
            success: false,
            error: { code: 'INTERNAL_SERVER_ERROR', message: error.message }
        });
    }
}