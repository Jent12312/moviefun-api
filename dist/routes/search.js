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
    const { query, page } = req.query;
    const pageNum = parseInt(page) || 1;
    if (!query || query.trim().length < 2) {
        return sendError(res, 400, 'INVALID_QUERY', 'Search query must be at least 2 characters');
    }
    try {
        const data = await tmdbService.searchMulti(query, pageNum);
        const results = data.results;
        const movies = results
            .filter(item => item.media_type === 'movie')
            .map(item => ({
            tmdbId: item.id,
            title: item.title || item.original_title,
            overview: item.overview,
            posterPath: item.poster_path,
            releaseDate: item.release_date,
            voteAverage: item.vote_average,
            mediaType: 'movie',
        }));
        const series = results
            .filter(item => item.media_type === 'tv')
            .map(item => ({
            tmdbId: item.id,
            title: item.name || item.original_name,
            overview: item.overview,
            posterPath: item.poster_path,
            releaseDate: item.first_air_date,
            voteAverage: item.vote_average,
            mediaType: 'tv',
        }));
        return res.json({
            success: true,
            data: {
                movies,
                series,
                all: [...movies, ...series],
            },
            meta: {
                page: data.page,
                total_pages: data.total_pages,
                total_results: data.total_results,
                query,
                moviesCount: movies.length,
                seriesCount: series.length,
            },
        });
    }
    catch (error) {
        return sendError(res, 500, 'INTERNAL_SERVER_ERROR', error.message || 'Unknown error');
    }
});
exports.default = router;
