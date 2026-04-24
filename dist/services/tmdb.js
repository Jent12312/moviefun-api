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
exports.getTVCredits = getTVCredits;
exports.getSimilarTV = getSimilarTV;
exports.getTVSeason = getTVSeason;
exports.getMovieVideos = getMovieVideos;
exports.getTVVideos = getTVVideos;
exports.getMovieGenres = getMovieGenres;
exports.discoverMovies = discoverMovies;
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
    return fetchFromTMDB(`/genre/movie/list?language=ru-RU`);
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
