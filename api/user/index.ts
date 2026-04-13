import type { VercelRequest, VercelResponse } from '@vercel/node';
import { 
  getAuthUserId, 
  supabaseQuery, 
  checkSupabaseConfig,
  verifyJWT
} from '../utils/user';

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

  if (!checkSupabaseConfig()) {
    return res.status(500).json({
      success: false,
      error: { code: 'CONFIG_ERROR', message: 'Supabase not configured' }
    });
  }

  const { section, action, id } = req.query;

  try {
    // ===== PROFILE =====
    if (section === 'profile') {
      return handleProfile(req, res, userId);
    }
    
    // ===== STATS =====
    if (section === 'stats') {
      return handleStats(req, res, userId);
    }
    
    // ===== INTERACTIONS =====
    if (section === 'interactions') {
      return handleInteractions(req, res, userId, action);
    }
    
    // ===== LISTS =====
    if (section === 'lists') {
      return handleLists(req, res, userId, action, id);
    }
    
    // ===== REVIEWS =====
    if (section === 'reviews') {
      return handleReviews(req, res, userId, action, id);
    }
    
    // ===== ACHIEVEMENTS =====
    if (section === 'achievements') {
      return handleAchievements(req, res, userId, action);
    }
    
    // ===== NOTIFICATIONS =====
    if (section === 'notifications') {
      return handleNotifications(req, res, userId, action, id);
    }

    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_SECTION', message: 'Valid section parameter is required' }
    });

  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: error.message }
    });
  }
}

// ===== PROFILE HANDLER =====
async function handleProfile(req: VercelRequest, res: VercelResponse, userId: string) {
  res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, OPTIONS');

  if (req.method === 'GET') {
    const user = await supabaseQuery('GET', `/users?id=eq.${userId}&select=*`);
    const users = Array.isArray(user) ? user : [];
    
    return res.status(200).json({
      success: true,
      data: users.length > 0 ? users[0] : null
    });
  }

  if (req.method === 'PATCH') {
    const updateData = req.body;
    await supabaseQuery('PATCH', `/users?id=eq.${userId}`, updateData);
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({
    success: false,
    error: { code: 'METHOD_NOT_ALLOWED', message: 'Only GET, PATCH allowed' }
  });
}

// ===== STATS HANDLER =====
async function handleStats(req: VercelRequest, res: VercelResponse, userId: string) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: { code: 'METHOD_NOT_ALLOWED', message: 'Only GET allowed' }
    });
  }

  const watchedData = await supabaseQuery('GET',
    `/user_movie_interactions?user_id=eq.${userId}&status=eq.watched&select=id,rating`);

  const watchingData = await supabaseQuery('GET',
    `/user_movie_interactions?user_id=eq.${userId}&status=eq.watching&select=id`);

  const wantToWatchData = await supabaseQuery('GET',
    `/user_movie_interactions?user_id=eq.${userId}&status=eq.want_to_watch&select=id`);

  const watched = Array.isArray(watchedData) ? watchedData : [];
  const watching = Array.isArray(watchingData) ? watchingData : [];
  const wantToWatch = Array.isArray(wantToWatchData) ? wantToWatchData : [];

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
}

// ===== INTERACTIONS HANDLER =====
async function handleInteractions(req: VercelRequest, res: VercelResponse, userId: string, action?: string) {
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');

  if (req.method === 'GET') {
    const { status, limit, offset } = req.query;
    const limitNum = Math.min(parseInt(limit as string) || 20, 50);
    const offsetNum = parseInt(offset as string) || 0;

    let filter = `user_id=eq.${userId}`;
    if (status && status !== 'all') {
      filter += `&status=eq.${status}`;
    }

    const data = await supabaseQuery('GET',
      `/user_movie_interactions?${filter}&select=*,movies(tmdb_id,title,overview,poster_path,vote_average,release_date)&order(updated_at,desc)&limit=${limitNum}&offset=${offsetNum}`);

    const items = Array.isArray(data) ? data.map((item: any) => ({
      tmdb_id: item.movies?.tmdb_id || item.movie_id,
      title: item.movies?.title || '',
      overview: item.movies?.overview || '',
      poster_path: item.movies?.poster_path || '',
      vote_average: item.movies?.vote_average || 0,
      release_date: item.movies?.release_date || '',
      status: item.status,
      rating: item.rating,
      updated_at: item.updated_at
    })) : [];

    return res.status(200).json({
      success: true,
      data: items,
      meta: { limit: limitNum, offset: offsetNum }
    });
  }

  if (req.method === 'POST') {
    const { movie_id, status, rating } = req.body;
    if (!movie_id) {
      return res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'movie_id is required' }
      });
    }

    const existing = await supabaseQuery('GET',
      `/user_movie_interactions?user_id=eq.${userId}&movie_id=eq.${movie_id}&select=id`);

    let result;
    if (Array.isArray(existing) && existing.length > 0) {
      const updateData: Record<string, any> = { updated_at: new Date().toISOString() };
      if (status) updateData.status = status;
      if (rating !== undefined) updateData.rating = rating;

      result = await supabaseQuery('PATCH',
        `/user_movie_interactions?id=eq.${existing[0].id}`, updateData);
    } else {
      result = await supabaseQuery('POST', '/user_movie_interactions', {
        user_id: userId,
        movie_id: movie_id,
        status: status || 'none',
        rating: rating || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }

    return res.status(201).json({ success: true, data: result });
  }

  if (req.method === 'DELETE') {
    const { tmdb_id } = req.query;
    if (!tmdb_id) {
      return res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'tmdb_id is required' }
      });
    }

    const movieData = await supabaseQuery('GET',
      `/movies?tmdb_id=eq.${tmdb_id}&select=id`);

    if (!Array.isArray(movieData) || movieData.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Movie not found' }
      });
    }

    const movieUuid = movieData[0].id;
    await supabaseQuery('DELETE',
      `?user_id=eq.${userId}&movie_id=eq.${movieUuid}`);

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({
    success: false,
    error: { code: 'METHOD_NOT_ALLOWED', message: 'Only GET, POST, DELETE allowed' }
  });
}

// ===== LISTS HANDLER =====
async function handleLists(req: VercelRequest, res: VercelResponse, userId: string, action?: string, id?: string) {
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');

  // GET /user?section=lists - получить все списки
  if (req.method === 'GET' && !action) {
    const lists = await supabaseQuery('GET',
      `/user_lists?user_id=eq.${userId}&select=*&order(created_at,desc)`);
    
    return res.status(200).json({
      success: true,
      data: Array.isArray(lists) ? lists : []
    });
  }

  // POST /user?section=lists - создать новый список
  if (req.method === 'POST' && !action) {
    const { name, description } = req.body;
    if (!name) {
      return res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'name is required' }
      });
    }

    const result = await supabaseQuery('POST', '/user_lists', {
      user_id: userId,
      name,
      description: description || '',
      created_at: new Date().toISOString()
    });

    return res.status(201).json({ success: true, data: result });
  }

  // GET /user?section=lists&action=items&id=123 - получить элементы списка
  if (action === 'items' && id && req.method === 'GET') {
    const items = await supabaseQuery('GET',
      `/list_items?list_id=eq.${id}&select=*,movies(tmdb_id,title,poster_path,vote_average)`);
    
    return res.status(200).json({
      success: true,
      data: Array.isArray(items) ? items : []
    });
  }

  // POST /user?section=lists&action=items&id=123 - добавить элемент в список
  if (action === 'items' && id && req.method === 'POST') {
    const { tmdb_id } = req.body;
    if (!tmdb_id) {
      return res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'tmdb_id is required' }
      });
    }

    const result = await supabaseQuery('POST', '/list_items', {
      list_id: id,
      tmdb_id,
      added_at: new Date().toISOString()
    });

    return res.status(201).json({ success: true, data: result });
  }

  // DELETE /user?section=lists&action=items&id=123 - удалить элемент
  if (action === 'items' && id && req.method === 'DELETE') {
    const { tmdb_id } = req.query;
    if (!tmdb_id) {
      return res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'tmdb_id is required' }
      });
    }

    await supabaseQuery('DELETE',
      `/list_items?list_id=eq.${id}&tmdb_id=eq.${tmdb_id}`);

    return res.status(200).json({ success: true });
  }

  // PATCH /user?section=lists&id=123 - обновить список
  if (id && req.method === 'PATCH') {
    const updateData = req.body;
    await supabaseQuery('PATCH', `/user_lists?id=eq.${id}`, updateData);
    return res.status(200).json({ success: true });
  }

  // DELETE /user?section=lists&id=123 - удалить список
  if (id && req.method === 'DELETE') {
    await supabaseQuery('DELETE', `/user_lists?id=eq.${id}`);
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({
    success: false,
    error: { code: 'METHOD_NOT_ALLOWED', message: 'Only GET, POST, PATCH, DELETE allowed' }
  });
}

// ===== REVIEWS HANDLER =====
async function handleReviews(req: VercelRequest, res: VercelResponse, userId: string, action?: string, id?: string) {
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');

  // GET /user?section=reviews - получить все отзывы пользователя
  if (req.method === 'GET' && !action) {
    const reviews = await supabaseQuery('GET',
      `/reviews?user_id=eq.${userId}&select=*,movies(tmdb_id,title,poster_path)&order(created_at,desc)`);
    
    return res.status(200).json({
      success: true,
      data: Array.isArray(reviews) ? reviews : []
    });
  }

  // POST /user?section=reviews - создать отзыв
  if (req.method === 'POST' && !action) {
    const { movie_id, content, rating } = req.body;
    if (!movie_id || !content) {
      return res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'movie_id and content are required' }
      });
    }

    const result = await supabaseQuery('POST', '/reviews', {
      user_id: userId,
      movie_id,
      content,
      rating: rating || null,
      created_at: new Date().toISOString()
    });

    return res.status(201).json({ success: true, data: result });
  }

  // POST /user?section=reviews&action=like&id=123 - лайкнуть отзыв
  if (action === 'like' && id && req.method === 'POST') {
    const existing = await supabaseQuery('GET',
      `/review_likes?user_id=eq.${userId}&review_id=eq.${id}&select=id`);

    if (Array.isArray(existing) && existing.length > 0) {
      await supabaseQuery('DELETE', `/review_likes?user_id=eq.${userId}&review_id=eq.${id}`);
      await supabaseQuery('PATCH', `/reviews?id=eq.${id}`, { likes_count: supabaseQuery('GET', `/review_likes?review_id=eq.${id}&select=id`).then(r => Array.isArray(r) ? r.length : 0) });
      return res.status(200).json({ success: true, liked: false });
    } else {
      await supabaseQuery('POST', '/review_likes', {
        user_id: userId,
        review_id: id,
        created_at: new Date().toISOString()
      });
      await supabaseQuery('PATCH', `/reviews?id=eq.${id}`, { likes_count: supabaseQuery('GET', `/review_likes?review_id=eq.${id}&select=id`).then(r => Array.isArray(r) ? r.length : 0) });
      return res.status(200).json({ success: true, liked: true });
    }
  }

  // PATCH /user?section=reviews&id=123 - обновить отзыв
  if (id && req.method === 'PATCH') {
    const updateData = req.body;
    await supabaseQuery('PATCH', `/reviews?id=eq.${id}`, updateData);
    return res.status(200).json({ success: true });
  }

  // DELETE /user?section=reviews&id=123 - удалить отзыв
  if (id && req.method === 'DELETE') {
    await supabaseQuery('DELETE', `/reviews?id=eq.${id}`);
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({
    success: false,
    error: { code: 'METHOD_NOT_ALLOWED', message: 'Only GET, POST, PATCH, DELETE allowed' }
  });
}

// ===== ACHIEVEMENTS HANDLER =====
async function handleAchievements(req: VercelRequest, res: VercelResponse, userId: string, action?: string) {
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

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
}

// ===== NOTIFICATIONS HANDLER =====
async function handleNotifications(req: VercelRequest, res: VercelResponse, userId: string, action?: string, id?: string) {
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');

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

  if (req.method === 'PUT' && id) {
    await supabaseQuery('PATCH',
      `/notifications?user_id=eq.${userId}&id=eq.${id}`, {
        is_read: true,
        created_at: new Date().toISOString()
      });
    return res.status(200).json({ success: true });
  }

  if (req.method === 'DELETE' && id) {
    await supabaseQuery('DELETE',
      `/notifications?user_id=eq.${userId}&id=eq.${id}`);
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({
    success: false,
    error: { code: 'METHOD_NOT_ALLOWED', message: 'Only GET, POST, PUT, DELETE allowed' }
  });
}
