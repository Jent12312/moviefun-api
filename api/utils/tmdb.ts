import type { VercelRequest, VercelResponse } from '@vercel/node';

// ===== TMDB Response Types =====

export interface TMDBMovie {
  id: number;
  title?: string;
  original_title?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string;
  runtime?: number;
  vote_average?: number;
  vote_count?: number;
  popularity?: number;
  genres?: Array<{ id: number; name: string }>;
  original_language?: string;
  status?: string;
  tagline?: string;
  adult?: boolean;
  imdb_id?: string;
  budget?: number;
  revenue?: number;
}

export interface TMDBTVShow {
  id: number;
  name?: string;
  original_name?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  first_air_date?: string;
  last_air_date?: string;
  episode_run_time?: number[];
  number_of_seasons?: number;
  number_of_episodes?: number;
  vote_average?: number;
  vote_count?: number;
  popularity?: number;
  genres?: Array<{ id: number; name: string }>;
  original_language?: string;
  status?: string;
  type?: string;
  tagline?: string;
  in_production?: boolean;
  networks?: Array<{ id: number; name: string; logo_path?: string | null }>;
  created_by?: Array<{ id: number; name: string }>;
}

export interface TMDBSeason {
  id: number;
  name?: string;
  overview?: string;
  poster_path?: string | null;
  season_number?: number;
  air_date?: string;
  episodes?: Array<{
    id: number;
    name?: string;
    overview?: string;
    episode_number?: number;
    season_number?: number;
    air_date?: string;
    still_path?: string | null;
    vote_average?: number;
    vote_count?: number;
    runtime?: number;
  }>;
}

export interface TMDBCredits {
  cast?: Array<{
    id: number;
    name: string;
    character: string;
    profile_path: string | null;
    order: number;
    known_for_department?: string;
    gender?: number;
  }>;
  crew?: Array<{
    id: number;
    name: string;
    job: string;
    department: string;
    profile_path: string | null;
    known_for_department?: string;
    gender?: number;
  }>;
}

export interface TMDBPaginatedResponse<T> {
  page: number;
  results: T[];
  total_pages: number;
  total_results: number;
}

// ===== Helper Functions =====

export function getTMDBKey(): string {
  const key = process.env.TMDB_API_KEY;
  if (!key) {
    throw new Error('TMDB API Key is not configured');
  }
  return key;
}

export async function fetchFromTMDB(
  endpoint: string
): Promise<unknown> {
  const tmdbKey = getTMDBKey();
  const url = `https://api.themoviedb.org/3${endpoint}`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${tmdbKey}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`TMDB API error: ${response.status}`);
  }

  return response.json();
}

export function setCORSHeaders(res: VercelResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
}

export function handleOPTIONS(req: VercelRequest, res: VercelResponse): boolean {
  if (req.method === 'OPTIONS') {
    setCORSHeaders(res);
    res.status(204).end();
    return true;
  }
  return false;
}

export function sendError(
  res: VercelResponse,
  status: number,
  code: string,
  message: string
): void {
  setCORSHeaders(res);
  res.status(status).json({
    success: false,
    error: { code, message },
  });
}
