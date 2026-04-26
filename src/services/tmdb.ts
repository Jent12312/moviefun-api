import NodeCache from 'node-cache';
import { TMDBMovie, TMDBTVShow, TMDBSeason, TMDBCredits } from '../types/index.js';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

const cache = new NodeCache({ stdTTL: 1800 }); // 30 minutes

function getCacheKey(endpoint: string, page: number): string {
  return `${endpoint}_${page}`;
}

function getTMDBKey(): string {
  const key = process.env.TMDB_API_KEY;
  if (!key) {
    throw new Error('TMDB API Key is not configured');
  }
  return key;
}

const CACHEABLE_ENDPOINTS = [
  '/movie/popular',
  '/movie/top_rated',
  '/movie/upcoming',
  '/trending/movie/day',
  '/tv/popular',
  '/tv/top_rated',
  '/trending/tv/week',
  '/genre/movie/list',
];

function isCacheable(endpoint: string): boolean {
  return CACHEABLE_ENDPOINTS.some(e => endpoint.startsWith(e));
}

async function fetchFromTMDBCached(endpoint: string, page = 1): Promise<unknown> {
  const cacheKey = getCacheKey(endpoint, page);
  
  if (isCacheable(endpoint) && cache.has(cacheKey)) {
    return cache.get(cacheKey)!;
  }
  
  const data = await fetchFromTMDB(endpoint);
  
  if (isCacheable(endpoint)) {
    cache.set(cacheKey, data);
  }
  
  return data;
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
  return fetchFromTMDBCached(`/movie/${id}?language=ru-RU`) as Promise<TMDBMovie>;
}

export async function getPopularMovies(page = 1) {
  return fetchFromTMDBCached(`/movie/popular?language=ru-RU&page=${page}`, page);
}

export async function getTopRatedMovies(page = 1) {
  return fetchFromTMDBCached(`/movie/top_rated?language=ru-RU&page=${page}`, page);
}

export async function getTrendingMovies(page = 1) {
  return fetchFromTMDBCached(`/trending/movie/day?language=ru-RU&page=${page}`, page);
}

export async function getUpcomingMovies(page = 1) {
  return fetchFromTMDBCached(`/movie/upcoming?language=ru-RU&page=${page}`, page);
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
  return fetchFromTMDBCached(`/tv/${id}?language=ru-RU`) as Promise<TMDBTVShow>;
}

export async function getPopularTV(page = 1) {
  return fetchFromTMDBCached(`/tv/popular?language=ru-RU&page=${page}`, page);
}

export async function getTopRatedTV(page = 1) {
  return fetchFromTMDBCached(`/tv/top_rated?language=ru-RU&page=${page}`, page);
}

export async function getTrendingTV(page = 1) {
  return fetchFromTMDBCached(`/trending/tv/week?language=ru-RU&page=${page}`, page);
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
  return fetchFromTMDBCached(`/genre/movie/list?language=ru-RU`) as Promise<{ genres: TMDBGenre[] }>;
}

export async function getTVGenres(): Promise<{ genres: TMDBGenre[] }> {
  return fetchFromTMDBCached(`/genre/tv/list?language=ru-RU`) as Promise<{ genres: TMDBGenre[] }>;
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

  if (filters.genre_id) params.append('with_genres', String(filters.genre_id));
  if (filters.year) params.append('primary_release_year', String(filters.year));
  if (filters.min_rating) params.append('vote_average.gte', String(filters.min_rating));
  params.append('sort_by', filters.sort_by || 'popularity.desc');

  return fetchFromTMDB(`/discover/movie?${params.toString()}`);
}

export async function discoverTV(filters: DiscoverFilters, page = 1) {
  const params = new URLSearchParams();
  params.append('language', 'ru-RU');
  params.append('page', String(page));

  if (filters.genre_id) params.append('with_genres', String(filters.genre_id));
  if (filters.year) params.append('first_air_date_year', String(filters.year));
  if (filters.min_rating) params.append('vote_average.gte', String(filters.min_rating));
  params.append('sort_by', filters.sort_by || 'popularity.desc');

  return fetchFromTMDB(`/discover/tv?${params.toString()}`);
}

export async function getMovieRecommendations(id: number) {
  return fetchFromTMDB(`/movie/${id}/recommendations?language=ru-RU`);
}