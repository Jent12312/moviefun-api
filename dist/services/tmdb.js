"use strict";
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
exports.getSimilarTV = getSimilarTV;
exports.getTVSeason = getTVSeason;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
function getTMDBKey() {
    const key = process.env.TMDB_API_KEY;
    if (!key) {
        throw new Error('TMDB API Key is not configured');
    }
    return key;
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
    return fetchFromTMDB(`/movie/${id}?language=ru-RU`);
}
async function getPopularMovies(page = 1) {
    return fetchFromTMDB(`/movie/popular?language=ru-RU&page=${page}`);
}
async function getTopRatedMovies(page = 1) {
    return fetchFromTMDB(`/movie/top_rated?language=ru-RU&page=${page}`);
}
async function getTrendingMovies(page = 1) {
    return fetchFromTMDB(`/trending/movie/day?language=ru-RU&page=${page}`);
}
async function getUpcomingMovies(page = 1) {
    return fetchFromTMDB(`/movie/upcoming?language=ru-RU&page=${page}`);
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
    return fetchFromTMDB(`/tv/${id}?language=ru-RU`);
}
async function getPopularTV(page = 1) {
    return fetchFromTMDB(`/tv/popular?language=ru-RU&page=${page}`);
}
async function getTopRatedTV(page = 1) {
    return fetchFromTMDB(`/tv/top_rated?language=ru-RU&page=${page}`);
}
async function getTrendingTV(page = 1) {
    return fetchFromTMDB(`/trending/tv/week?language=ru-RU&page=${page}`);
}
async function searchTV(query, page = 1) {
    return fetchFromTMDB(`/search/tv?query=${encodeURIComponent(query)}&language=ru-RU&page=${page}`);
}
async function getSimilarTV(id) {
    return fetchFromTMDB(`/tv/${id}/similar?language=ru-RU`);
}
async function getTVSeason(id, season) {
    return fetchFromTMDB(`/tv/${id}/season/${season}?language=ru-RU`);
}
