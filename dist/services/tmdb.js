"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchFromTMDB = fetchFromTMDB;
exports.getMovie = getMovie;
exports.getPopularMovies = getPopularMovies;
exports.getTopRatedMovies = getTopRatedMovies;
exports.getTrendingMovies = getTrendingMovies;
exports.getUpcomingMovies = getUpcomingMovies;
exports.searchMovies = searchMovies;
exports.getSimilarMovies = getSimilarMovies;
exports.getMovieCredits = getMovieCredits;
exports.getTVShow = getTVShow;
exports.getPopularTV = getPopularTV;
exports.getTopRatedTV = getTopRatedTV;
exports.getTrendingTV = getTrendingTV;
exports.searchTV = searchTV;
exports.searchMulti = searchMulti;
exports.getTVCredits = getTVCredits;
exports.getSimilarTV = getSimilarTV;
exports.getTVSeason = getTVSeason;
exports.getMovieVideos = getMovieVideos;
exports.getTVVideos = getTVVideos;
exports.getMovieGenres = getMovieGenres;
exports.discoverMovies = discoverMovies;
exports.getMovieRecommendations = getMovieRecommendations;
const node_cache_1 = __importDefault(require("node-cache"));
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const cache = new node_cache_1.default({ stdTTL: 1800 }); // 30 minutes
function getCacheKey(endpoint, page) {
    return `${endpoint}_${page}`;
}
function getTMDBKey() {
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
function isCacheable(endpoint) {
    return CACHEABLE_ENDPOINTS.some(e => endpoint.startsWith(e));
}
async function fetchFromTMDBCached(endpoint, page = 1) {
    const cacheKey = getCacheKey(endpoint, page);
    if (isCacheable(endpoint) && cache.has(cacheKey)) {
        return cache.get(cacheKey);
    }
    const data = await fetchFromTMDB(endpoint);
    if (isCacheable(endpoint)) {
        cache.set(cacheKey, data);
    }
    return data;
}
async function fetchFromTMDB(endpoint) {
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
async function getMovie(id) {
    return fetchFromTMDBCached(`/movie/${id}?language=ru-RU`);
}
async function getPopularMovies(page = 1) {
    return fetchFromTMDBCached(`/movie/popular?language=ru-RU&page=${page}`, page);
}
async function getTopRatedMovies(page = 1) {
    return fetchFromTMDBCached(`/movie/top_rated?language=ru-RU&page=${page}`, page);
}
async function getTrendingMovies(page = 1) {
    return fetchFromTMDBCached(`/trending/movie/day?language=ru-RU&page=${page}`, page);
}
async function getUpcomingMovies(page = 1) {
    return fetchFromTMDBCached(`/movie/upcoming?language=ru-RU&page=${page}`, page);
}
async function searchMovies(query, page = 1) {
    return fetchFromTMDB(`/search/movie?query=${encodeURIComponent(query)}&language=ru-RU&page=${page}`);
}
async function getSimilarMovies(id) {
    return fetchFromTMDB(`/movie/${id}/similar?language=ru-RU`);
}
async function getMovieCredits(id) {
    return fetchFromTMDB(`/movie/${id}/credits?language=ru-RU`);
}
async function getTVShow(id) {
    return fetchFromTMDBCached(`/tv/${id}?language=ru-RU`);
}
async function getPopularTV(page = 1) {
    return fetchFromTMDBCached(`/tv/popular?language=ru-RU&page=${page}`, page);
}
async function getTopRatedTV(page = 1) {
    return fetchFromTMDBCached(`/tv/top_rated?language=ru-RU&page=${page}`, page);
}
async function getTrendingTV(page = 1) {
    return fetchFromTMDBCached(`/trending/tv/week?language=ru-RU&page=${page}`, page);
}
async function searchTV(query, page = 1) {
    return fetchFromTMDB(`/search/tv?query=${encodeURIComponent(query)}&language=ru-RU&page=${page}`);
}
async function searchMulti(query, page = 1) {
    return fetchFromTMDB(`/search/multi?query=${encodeURIComponent(query)}&language=ru-RU&page=${page}`);
}
async function getTVCredits(id) {
    return fetchFromTMDB(`/tv/${id}/credits?language=ru-RU`);
}
async function getSimilarTV(id) {
    return fetchFromTMDB(`/tv/${id}/similar?language=ru-RU`);
}
async function getTVSeason(id, season) {
    return fetchFromTMDB(`/tv/${id}/season/${season}?language=ru-RU`);
}
async function getMovieVideos(id) {
    return fetchFromTMDB(`/movie/${id}/videos?language=ru-RU`);
}
async function getTVVideos(id) {
    return fetchFromTMDB(`/tv/${id}/videos?language=ru-RU`);
}
async function getMovieGenres() {
    return fetchFromTMDBCached(`/genre/movie/list?language=ru-RU`);
}
async function discoverMovies(filters, page = 1) {
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
    }
    else {
        params.append('sort_by', 'popularity.desc');
    }
    return fetchFromTMDB(`/discover/movie?${params.toString()}`);
}
async function getMovieRecommendations(id) {
    return fetchFromTMDB(`/movie/${id}/recommendations?language=ru-RU`);
}
