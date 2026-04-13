import type { VercelRequest } from '@vercel/node';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

export function base64UrlDecode(str: string): string {
    let output = str.replace(/-/g, '+').replace(/_/g, '/');
    switch (output.length % 4) {
        case 0: break;
        case 2: output += '==';
        case 3: output += '=';
        default: throw new Error('Illegal base64url string!');
    }
    return Buffer.from(output, 'base64').toString('utf-8');
}

export function verifyJWT(token: string): { sub: string; email: string; exp: number } | null {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        
        const payload = JSON.parse(base64UrlDecode(parts[1]));
        
        if (payload.exp * 1000 < Date.now()) return null;
        
        return { sub: payload.sub, email: payload.email, exp: payload.exp };
    } catch {
        return null;
    }
}

export function verifyJWTWithRole(token: string): { sub: string; email: string; exp: number } | null {
    const result = verifyJWT(token);
    if (!result) return null;
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return null;
    
    return result;
}

export function getAuthUserId(req: VercelRequest): string | null {
    const authHeader = req.headers.authorization as string;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    
    const payload = verifyJWT(authHeader.substring(7));
    return payload ? payload.sub : null;
}

export async function supabaseQuery(method: string, path: string, body?: object) {
    const url = `${SUPABASE_URL}/rest/v1${path}`;
    const headers: Record<string, string> = {
        'apikey': SUPABASE_SERVICE_KEY || '',
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': method === 'POST' || method === 'PATCH' ? 'return=representation' : 'count=exact',
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