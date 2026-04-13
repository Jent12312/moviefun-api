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

async function supabaseQuery(method: string, path: string, body?: unknown) {
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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const userId = getAuthUserId(req);
  const { content_type, content_id, page, per_page, review_id } = req.query;

  try {
    // GET /api/reviews?content_type=0&content_id=123&page=1&per_page=20
    if (req.method === 'GET') {
      const pageNum = parseInt(page as string) || 1;
      const perPageNum = Math.min(parseInt(per_page as string) || 20, 50);
      const offset = (pageNum - 1) * perPageNum;

      let filter = `content_id=eq.${content_id}`;
      if (content_type !== undefined) {
        filter += `&content_type=eq.${content_type}`;
      }

      const reviews = await supabaseQuery('GET',
        `/reviews?${filter}&select=*,users(username,display_name,avatar_url)&order(created_at,desc)&limit=${perPageNum}&offset=${offset}`);

      const formattedReviews = Array.isArray(reviews) ? reviews.map((r: any) => ({
        id: r.id,
        author_name: r.users?.display_name || r.users?.username || 'Аноним',
        author_avatar: r.users?.avatar_url || '',
        body: r.body,
        rating: r.rating,
        likes_count: r.likes_count || 0,
        created_at: r.created_at,
        is_liked_by_me: false // TODO: проверить через review_likes
      })) : [];

      return res.status(200).json({
        success: true,
        data: formattedReviews,
        meta: { page: pageNum, per_page: perPageNum }
      });
    }

    // POST /api/reviews - создать отзыв (только для авторизованных)
    if (req.method === 'POST') {
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
        });
      }

      const { movie_id, content, rating, contains_spoilers, title } = req.body;
      if (!movie_id || !content) {
        return res.status(400).json({
          success: false,
          error: { code: 'BAD_REQUEST', message: 'movie_id and content are required' }
        });
      }

      const result = await supabaseQuery('POST', '/reviews', {
        user_id: userId,
        content_id: movie_id,
        content_type: 0, // 0 = Movie
        title: title || '',
        body: content,
        rating: rating || null,
        contains_spoilers: contains_spoilers || false,
        likes_count: 0,
        created_at: new Date().toISOString()
      });

      return res.status(201).json({ success: true, data: result });
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
