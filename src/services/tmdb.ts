import { TMDBMovie, TMDBTVShow, TMDBSeason, TMDBCredits } from '../types/index.js';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

function getTMDBKey(): string {
  const key = process.env.TMDB_API_KEY;
  if (!key) {
    throw new Error('TMDB API Key is not configured');
  }
  return key;
}

export async function fetchFromTMDB(endpoint: string): Promise<unknown> {
  const tmdbKey = getTMDBKey();
  const url = `${TMDB_BASE_URL}${endpoint}`;
  
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

export async function getMovie(id: number): Promise<TMDBMovie> {
  return fetchFromTMDB(`/movie/${id}?language=ru-RU`) as Promise<TMDBMovie>;
}

export async function getPopularMovies(page = 1) {
  return fetchFromTMDB(`/movie/popular?language=ru-RU&page=${page}`);
}

export async function getTopRatedMovies(page = 1) {
  return fetchFromTMDB(`/movie/top_rated?language=ru-RU&page=${page}`);
}

export async function getTrendingMovies(page = 1) {
  return fetchFromTMDB(`/trending/movie/day?language=ru-RU&page=${page}`);
}

export async function getUpcomingMovies(page = 1) {
  return fetchFromTMDB(`/movie/upcoming?language=ru-RU&page=${page}`);
}

export async function searchMovies(query: string, page = 1) {
  return fetchFromTMDB(`/search/movie?query=${encodeURIComponent(query)}&language=ru-RU&page=${page}`);
}

export async function getSimilarMovies(id: number) {
  return fetchFromTMDB(`/movie/${id}/similar?language=ru-RU`);
}

export async function getMovieCredits(id: number): Promise<TMDBCredits> {
  return fetchFromTMDB(`/movie/${id}/credits?language=ru-RU`) as Promise<TMDBCredits>;
}

export async function getTVShow(id: number): Promise<TMDBTVShow> {
  return fetchFromTMDB(`/tv/${id}?language=ru-RU`) as Promise<TMDBTVShow>;
}

export async function getPopularTV(page = 1) {
  return fetchFromTMDB(`/tv/popular?language=ru-RU&page=${page}`);
}

export async function getTopRatedTV(page = 1) {
  return fetchFromTMDB(`/tv/top_rated?language=ru-RU&page=${page}`);
}

export async function getTrendingTV(page = 1) {
  return fetchFromTMDB(`/trending/tv/week?language=ru-RU&page=${page}`);
}

export async function searchTV(query: string, page = 1) {
  return fetchFromTMDB(`/search/tv?query=${encodeURIComponent(query)}&language=ru-RU&page=${page}`);
}

export async function searchMulti(query: string, page = 1) {
  return fetchFromTMDB(`/search/multi?query=${encodeURIComponent(query)}&language=ru-RU&page=${page}`);
}

export async function getTVCredits(id: number): Promise<TMDBCredits> {
  return fetchFromTMDB(`/tv/${id}/credits?language=ru-RU`) as Promise<TMDBCredits>;
}

export async function getSimilarTV(id: number) {
  return fetchFromTMDB(`/tv/${id}/similar?language=ru-RU`);
}

export async function getTVSeason(id: number, season: number): Promise<TMDBSeason> {
  return fetchFromTMDB(`/tv/${id}/season/${season}?language=ru-RU`) as Promise<TMDBSeason>;
}

export async function getMovieVideos(id: number) {
  return fetchFromTMDB(`/movie/${id}/videos?language=ru-RU`);
}

export async function getTVVideos(id: number) {
  return fetchFromTMDB(`/tv/${id}/videos?language=ru-RU`);
}

export interface TMDBGenre {
  id: number;
  name: string;
}

export async function getMovieGenres(): Promise<{ genres: TMDBGenre[] }> {
  return fetchFromTMDB(`/genre/movie/list?language=ru-RU`) as Promise<{ genres: TMDBGenre[] }>;
}

export interface DiscoverFilters {
  genre_id?: number;
  year?: number;
  min_rating?: number;
  sort_by?: string;
}

export async function discoverMovies(filters: DiscoverFilters, page = 1) {
  const params = new URLSearchParams();
  params.append('language', 'ru-RU');
  params.append('page', String(page));

  if (filters.genre_id) {
    params.append('with_genres', String(filters.genre_id));
  }
  if (filters.year) {
    params.append('primary_release_year', String(filters.year));
  }
  if (filters.min_rating) {
    params.append('vote_average.gte', String(filters.min_rating));
  }
  if (filters.sort_by) {
    params.append('sort_by', filters.sort_by);
  } else {
    params.append('sort_by', 'popularity.desc');
  }

  return fetchFromTMDB(`/discover/movie?${params.toString()}`);
}