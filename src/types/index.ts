import { PrismaClient } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      prisma: PrismaClient;
      userId?: string;
    }
  }
}

export interface JWTPayload {
  sub: string;
  email: string;
  exp: number;
}

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

export interface AchievementDefinition {
  code: string;
  title: string;
  description: string;
  icon: string;
  category: number;
  points: number;
}

export const ACHIEVEMENTS: AchievementDefinition[] = [
  { code: 'first_step', title: 'Первый шаг', description: 'Посмотреть первый фильм', icon: '🎬', category: 0, points: 10 },
  { code: 'marathon', title: 'Марафонец', description: 'Посмотреть 10 фильмов за неделю', icon: '🏃', category: 0, points: 50 },
  { code: 'cinephile', title: 'Киноман', description: 'Посмотреть 100 фильмов', icon: '🎥', category: 0, points: 100 },
  { code: 'critic', title: 'Критик', description: 'Оценить 50 фильмов', icon: '⭐', category: 0, points: 75 },
  { code: 'first_friend', title: 'Первый друг', description: 'Добавить друга', icon: '🤝', category: 1, points: 10 },
  { code: 'influencer', title: 'Влиятелен', description: 'Получить 50 лайков', icon: '💫', category: 1, points: 100 },
  { code: 'cosmopolitan', title: 'Космополит', description: 'Фильмы из 10 стран', icon: '🌍', category: 2, points: 75 },
  { code: 'time_traveler', title: 'Путешественник', description: 'Фильмы каждого десятилетия', icon: '⏰', category: 2, points: 100 },
  { code: 'curator', title: 'Куратор', description: 'Создать подборку 20+', icon: '📚', category: 3, points: 50 },
  { code: 'archivist', title: 'Архивист', description: 'Заполнить профиль', icon: '📋', category: 3, points: 25 },
];