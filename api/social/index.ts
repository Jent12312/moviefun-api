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
  if (!userId) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
    });
  }

  const action = Array.isArray(req.query.action) ? req.query.action[0] : req.query.action;
  const id = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;

  try {
    // ===== FRIEND REQUESTS =====
    if (action === 'friend-requests') {
      return handleFriendRequests(req, res, userId, id);
    }

    // ===== FRIENDS =====
    if (action === 'friends') {
      return handleFriends(req, res, userId);
    }

    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_ACTION', message: 'Valid action parameter required' }
    });

  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: error.message }
    });
  }
}

// ===== FRIEND REQUESTS HANDLER =====
async function handleFriendRequests(req: VercelRequest, res: VercelResponse, userId: string, id?: string) {
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');

  // POST /api/social?action=friend-requests - отправить запрос в друзья
  if (req.method === 'POST' && !id) {
    const { user_id } = req.body;
    if (!user_id) {
      return res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'user_id is required' }
      });
    }

    // Проверяем, нет ли уже запроса
    const existing = await supabaseQuery('GET',
      `/friend_requests?sender_id=eq.${userId}&receiver_id=eq.${user_id}&select=id`);

    if (Array.isArray(existing) && existing.length > 0) {
      return res.status(409).json({
        success: false,
        error: { code: 'CONFLICT', message: 'Friend request already sent' }
      });
    }

    await supabaseQuery('POST', '/friend_requests', {
      sender_id: userId,
      receiver_id: user_id,
      status: 'pending',
      created_at: new Date().toISOString()
    });

    return res.status(201).json({ success: true });
  }

  // GET /api/social?action=friend-requests - получить входящие запросы
  if (req.method === 'GET' && !id) {
    const requests = await supabaseQuery('GET',
      `/friend_requests?receiver_id=eq.${userId}&status=eq.pending&select=*,users!sender_id(id,username,display_name,avatar_url)`);

    const formatted = Array.isArray(requests) ? requests.map((r: any) => ({
      id: r.id,
      user: r.users,
      created_at: r.created_at
    })) : [];

    return res.status(200).json({ success: true, data: formatted });
  }

  // POST /api/social?action=friend-requests&id=123 - принять/отклонить запрос
  if (req.method === 'POST' && id) {
    const { accept } = req.body;

    if (accept) {
      // Принимаем запрос
      await supabaseQuery('PATCH', `/friend_requests?id=eq.${id}`, {
        status: 'accepted',
        updated_at: new Date().toISOString()
      });

      // Создаём запись в friends
      const fr = await supabaseQuery('GET', `/friend_requests?id=eq.${id}&select=*`);
      if (Array.isArray(fr) && fr.length > 0) {
        const request = fr[0];
        await supabaseQuery('POST', '/friends', {
          user_id: request.receiver_id,
          friend_id: request.sender_id,
          created_at: new Date().toISOString()
        });
        await supabaseQuery('POST', '/friends', {
          user_id: request.sender_id,
          friend_id: request.receiver_id,
          created_at: new Date().toISOString()
        });
      }
    } else {
      // Отклоняем запрос
      await supabaseQuery('DELETE', `/friend_requests?id=eq.${id}`);
    }

    return res.status(200).json({ success: true });
  }

  // DELETE /api/social?action=friend-requests&id=123 - отменить запрос
  if (req.method === 'DELETE' && id) {
    await supabaseQuery('DELETE', `/friend_requests?id=eq.${id}`);
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({
    success: false,
    error: { code: 'METHOD_NOT_ALLOWED', message: 'Only GET, POST, DELETE allowed' }
  });
}

// ===== FRIENDS HANDLER =====
async function handleFriends(req: VercelRequest, res: VercelResponse, userId: string) {
  res.setHeader('Access-Control-Allow-Methods', 'GET, DELETE, OPTIONS');

  // GET /api/social?action=friends - получить список друзей
  if (req.method === 'GET') {
    const friends = await supabaseQuery('GET',
      `/friends?user_id=eq.${userId}&select=*,users!friend_id(id,username,display_name,avatar_url)`);

    const formatted = Array.isArray(friends) ? friends.map((f: any) => ({
      id: f.users?.id,
      username: f.users?.username,
      display_name: f.users?.display_name,
      avatar_url: f.users?.avatar_url
    })) : [];

    return res.status(200).json({ success: true, data: formatted });
  }

  // DELETE /api/social?action=friends&id=123 - удалить друга
  if (req.method === 'DELETE') {
    const friendId = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
    if (!friendId) {
      return res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'friend id is required' }
      });
    }

    await supabaseQuery('DELETE', `/friends?user_id=eq.${userId}&friend_id=eq.${friendId}`);
    await supabaseQuery('DELETE', `/friends?user_id=eq.${friendId}&friend_id=eq.${userId}`);

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({
    success: false,
    error: { code: 'METHOD_NOT_ALLOWED', message: 'Only GET, DELETE allowed' }
  });
}
