"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const tmdbService = __importStar(require("../services/tmdb.js"));
const router = (0, express_1.Router)();
function sendError(res, status, code, message) {
    res.status(status).json({ success: false, error: { code, message } });
}
router.get('/', async (req, res) => {
    const { action, id, page } = req.query;
    const pageNum = parseInt(page) || 1;
    try {
        if (action === 'popular') {
            const data = await tmdbService.getPopularMovies(pageNum);
            return res.json({
                success: true,
                data: data.results,
                meta: { page: data.page, total_pages: data.total_pages, total_results: data.total_results }
            });
        }
        if (action === 'top-rated') {
            const data = await tmdbService.getTopRatedMovies(pageNum);
            return res.json({
                success: true,
                data: data.results,
                meta: { page: data.page, total_pages: data.total_pages, total_results: data.total_results }
            });
        }
        if (action === 'trending') {
            const data = await tmdbService.getTrendingMovies(pageNum);
            return res.json({
                success: true,
                data: data.results,
                meta: { page: data.page, total_pages: data.total_pages, total_results: data.total_results }
            });
        }
        if (action === 'upcoming') {
            const data = await tmdbService.getUpcomingMovies(pageNum);
            return res.json({
                success: true,
                data: data.results,
                meta: { page: data.page, total_pages: data.total_pages, total_results: data.total_results }
            });
        }
        if (action === 'search') {
            const query = req.query.query;
            if (!query || query.trim().length < 2) {
                return sendError(res, 400, 'INVALID_QUERY', 'Search query must be at least 2 characters');
            }
            const data = await tmdbService.searchMovies(query, pageNum);
            return res.json({
                success: true,
                data: data.results,
                meta: { page: data.page, total_pages: data.total_pages, total_results: data.total_results, query }
            });
        }
        if (action === 'similar' && id) {
            if (!/^\d+$/.test(id)) {
                return sendError(res, 400, 'INVALID_ID', 'Valid movie ID is required');
            }
            const data = await tmdbService.getSimilarMovies(parseInt(id));
            return res.json({ success: true, data: data.results, meta: { page: data.page, total_pages: data.total_pages, total_results: data.total_results } });
        }
        if (action === 'credits' && id) {
            if (!/^\d+$/.test(id)) {
                return sendError(res, 400, 'INVALID_ID', 'Valid movie ID is required');
            }
            const data = await tmdbService.getMovieCredits(parseInt(id));
            return res.json({ success: true, data });
        }
        if (!action && id) {
            if (!/^\d+$/.test(id)) {
                return sendError(res, 400, 'INVALID_ID', 'Valid movie ID is required');
            }
            const movie = await tmdbService.getMovie(parseInt(id));
            res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
            return res.json({
                success: true,
                data: {
                    id: movie.id,
                    title: movie.title || movie.original_title,
                    title_ru: movie.title,
                    original_title: movie.original_title,
                    overview: movie.overview,
                    poster_path: movie.poster_path,
                    backdrop_path: movie.backdrop_path,
                    release_date: movie.release_date,
                    runtime: movie.runtime,
                    vote_average: movie.vote_average,
                    vote_count: movie.vote_count,
                    genres: movie.genres,
                    original_language: movie.original_language,
                    status: movie.status,
                    tagline: movie.tagline,
                }
            });
        }
        return sendError(res, 400, 'INVALID_ACTION', 'Valid action or id parameter is required');
    }
    catch (error) {
        return sendError(res, 500, 'INTERNAL_SERVER_ERROR', error.message || 'Unknown error');
    }
});
exports.default = router;
