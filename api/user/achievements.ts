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

const ACHIEVEMENTS_DEFINITIONS = [
    { code: 'first_step', title: 'Первый шаг', description: 'Посмотреть первый фильм', icon: '🎬', category: 'watching', points: 10 },
    { code: 'marathon', title: 'Марафонец', description: 'Посмотреть 10 фильмов за неделю', icon: '🏃', category: 'watching', points: 50 },
    { code: 'cinephile', title: 'Киноман', description: 'Посмотреть 100 фильмов', icon: '🎥', category: 'watching', points: 100 },
    { code: 'critic', title: 'Критик', description: 'Оценить 50 фильмов', icon: '⭐', category: 'watching', points: 75 },
    { code: 'first_friend', title: 'Первый друг', description: 'Добавить друга', icon: '🤝', category: 'social', points: 10 },
    { code: 'influencer', title: 'Влиятелен', description: 'Получить 50 лайков', icon: '💫', category: 'social', points: 100 },
    { code: 'cosmopolitan', title: 'Космополит', description: 'Фильмы из 10 стран', icon: '🌍', category: 'exploration', points: 75 },
    { code: 'time_traveler', title: 'Путешественник', description: 'Фильмы каждого десятилетия', icon: '⏰', category: 'exploration', points: 100 },
    { code: 'curator', title: 'Куратор', description: 'Создать подборку 20+', icon: '📚', category: 'collector', points: 50 },
    { code: 'archivist', title: 'Архивист', description: 'Заполнить профиль', icon: '📋', category: 'collector', points: 25 },
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
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
            const userAchievements = await supabaseQuery('GET', 
                `/user_achievements?user_id=eq.${userId}&select=*`);

            const earnedCodes = new Set(Array.isArray(userAchievements) 
                ? userAchievements.map((a: any) => a.achievement_code) 
                : []);

            const achievements = ACHIEVEMENTS_DEFINITIONS.map(def => ({
                ...def,
                isEarned: earnedCodes.has(def.code),
                earnedAt: '',
                progress: 0
            }));

            let totalPoints = 0;
            let earnedCount = 0;
            for (const ach of achievements) {
                if (ach.isEarned) {
                    totalPoints += ach.points;
                    earnedCount++;
                }
            }

            return res.status(200).json({
                success: true,
                data: achievements,
                meta: { earnedCount, totalCount: achievements.length, totalPoints }
            });
        }

        if (req.method === 'POST') {
            const { achievement_code } = req.body;
            if (!achievement_code) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'BAD_REQUEST', message: 'achievement_code is required' }
                });
            }

            const existing = await supabaseQuery('GET', 
                `/user_achievements?user_id=eq.${userId}&achievement_code=eq.${achievement_code}&select=id`);

            if (Array.isArray(existing) && existing.length > 0) {
                return res.status(200).json({ success: true, message: 'Already earned' });
            }

            await supabaseQuery('POST', '/user_achievements', {
                user_id: userId,
                achievement_code: achievement_code,
                earned_at: new Date().toISOString()
            });

            return res.status(201).json({ success: true });
        }

        return res.status(405).json({
            success: false,
            error: { code: 'METHOD_NOT_ALLOWED', message: 'Only GET, POST allowed' }
        });

    } catch (error: any) {
        return res.status(500).json({
            success: false,
            error: { code: 'INTERNAL_SERVER_ERROR', message: error.message }
        });
    }
}