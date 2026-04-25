"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_js_1 = require("../middleware/auth.js");
const index_js_1 = require("../types/index.js");
const tmdb_js_1 = require("../services/tmdb.js");
const router = (0, express_1.Router)();
router.use(auth_js_1.requireAuth);
router.get('/profile', async (req, res) => {
    const user = await req.prisma.user.findUnique({
        where: { id: req.userId },
        select: { id: true, username: true, displayName: true, avatarUrl: true, createdAt: true }
    });
    res.json({ success: true, data: user });
});
router.patch('/profile', async (req, res) => {
    const { displayName, avatarUrl } = req.body;
    await req.prisma.user.update({
        where: { id: req.userId },
        data: { displayName, avatarUrl }
    });
    res.json({ success: true });
});
router.get('/stats', async (req, res) => {
    const movieWatched = await req.prisma.userMovieInteraction.count({
        where: { userId: req.userId, status: 'watched' }
    });
    const movieWatching = await req.prisma.userMovieInteraction.count({
        where: { userId: req.userId, status: 'watching' }
    });
    const movieWantToWatch = await req.prisma.userMovieInteraction.count({
        where: { userId: req.userId, status: 'want_to_watch' }
    });
    const seriesWatched = await req.prisma.userTvInteraction.count({
        where: { userId: req.userId, status: 'watched' }
    });
    const seriesWatching = await req.prisma.userTvInteraction.count({
        where: { userId: req.userId, status: 'watching' }
    });
    const seriesWantToWatch = await req.prisma.userTvInteraction.count({
        where: { userId: req.userId, status: 'want_to_watch' }
    });
    const rated = await req.prisma.userMovieInteraction.findMany({
        where: { userId: req.userId, status: 'watched', rating: { not: null } },
        select: { rating: true }
    });
    const watchedCount = movieWatched + seriesWatched;
    const watchingCount = movieWatching + seriesWatching;
    const wantToWatchCount = movieWantToWatch + seriesWantToWatch;
    const totalRating = rated.reduce((sum, r) => sum + (r.rating ? Number(r.rating) : 0), 0);
    const averageRating = rated.length > 0 ? totalRating / rated.length : 0;
    res.json({
        success: true,
        data: {
            watched_count: watchedCount,
            watching_count: watchingCount,
            want_to_watch_count: wantToWatchCount,
            average_rating: Math.round(averageRating * 10) / 10,
            total_movies: watchedCount + watchingCount + wantToWatchCount,
        }
    });
});
router.get('/interactions', async (req, res) => {
    const { status, limit = 20, offset = 0, movie_id, type } = req.query;
    const limitNum = Math.min(parseInt(limit), 50);
    const offsetNum = parseInt(offset);
    const contentType = type || 'movies';
    if (movie_id) {
        const movie = await req.prisma.movie.findUnique({ where: { tmdbId: parseInt(movie_id) } });
        if (!movie)
            return res.json({ success: true, data: [] });
        const interaction = await req.prisma.userMovieInteraction.findFirst({
            where: { userId: req.userId, movieId: movie.id },
            include: { movie: { select: { tmdbId: true, title: true } } }
        });
        if (!interaction)
            return res.json({ success: true, data: [] });
        return res.json({
            success: true,
            data: [{
                    tmdb_id: interaction.movie.tmdbId,
                    title: interaction.movie.title,
                    status: interaction.status,
                    rating: interaction.rating ? Number(interaction.rating) : null,
                    is_favorite: interaction.isFavorite
                }]
        });
    }
    let items = [];
    if (contentType === 'all' || contentType === 'movies') {
        const where = { userId: req.userId };
        if (status && status !== 'all')
            where.status = status;
        const movies = await req.prisma.userMovieInteraction.findMany({
            where,
            include: { movie: { select: { tmdbId: true, title: true, overview: true, posterPath: true, releaseDate: true } } },
            orderBy: { updatedAt: 'desc' },
            take: limitNum,
            skip: offsetNum
        });
        items = items.concat(movies.map(item => ({
            type: 'movie',
            tmdb_id: item.movie.tmdbId,
            title: item.movie.title,
            overview: item.movie.overview,
            poster_path: item.movie.posterPath,
            vote_average: item.rating ? Number(item.rating) : 0,
            release_date: item.movie.releaseDate,
            status: item.status,
            rating: item.rating ? Number(item.rating) : null,
            is_favorite: item.isFavorite,
            updated_at: item.updatedAt
        })));
    }
    if (contentType === 'all' || contentType === 'series') {
        const where = { userId: req.userId };
        if (status && status !== 'all')
            where.status = status;
        const series = await req.prisma.userTvInteraction.findMany({
            where,
            include: { series: { select: { tmdbId: true, name: true, overview: true, posterPath: true } } },
            orderBy: { updatedAt: 'desc' },
            take: limitNum,
            skip: offsetNum
        });
        items = items.concat(series.map((item) => ({
            type: 'series',
            tmdb_id: item.series.tmdbId,
            title: item.series.name,
            overview: item.series.overview,
            poster_path: item.series.posterPath,
            vote_average: item.rating ? Number(item.rating) : 0,
            status: item.status,
            rating: item.rating ? Number(item.rating) : null,
            current_season: item.currentSeason,
            current_episode: item.currentEpisode,
            updated_at: item.updatedAt
        })));
    }
    items.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    res.json({ success: true, data: items, meta: { limit: limitNum, offset: offsetNum } });
});
router.post('/interactions', async (req, res) => {
    const { movie_id, series_id, status, rating, title, overview, poster_path, season_number, episode_number } = req.body;
    if (series_id) {
        let series = await req.prisma.tvSeries.findUnique({ where: { tmdbId: parseInt(series_id) } });
        if (!series) {
            series = await req.prisma.tvSeries.create({
                data: { tmdbId: parseInt(series_id), name: title || `Series ${series_id}`, overview: overview || '', posterPath: poster_path }
            });
        }
        const existing = await req.prisma.userTvInteraction.findFirst({
            where: { userId: req.userId, seriesId: series.id }
        });
        if (existing) {
            await req.prisma.userTvInteraction.update({
                where: { id: existing.id },
                data: {
                    status: status || existing.status,
                    rating: rating !== undefined ? rating : existing.rating,
                    currentSeason: season_number || existing.currentSeason,
                    currentEpisode: episode_number || existing.currentEpisode
                }
            });
        }
        else {
            await req.prisma.userTvInteraction.create({
                data: {
                    userId: req.userId,
                    seriesId: series.id,
                    status: status || 'none',
                    rating: rating,
                    currentSeason: season_number || 1,
                    currentEpisode: episode_number || 1
                }
            });
        }
        return res.status(201).json({ success: true });
    }
    if (!movie_id) {
        return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'movie_id is required' } });
    }
    let movie = await req.prisma.movie.findUnique({ where: { tmdbId: parseInt(movie_id) } });
    if (!movie) {
        movie = await req.prisma.movie.create({
            data: { tmdbId: parseInt(movie_id), title: title || `Movie ${movie_id}`, overview: overview || '', posterPath: poster_path }
        });
    }
    const existing = await req.prisma.userMovieInteraction.findFirst({
        where: { userId: req.userId, movieId: movie.id }
    });
    if (existing) {
        await req.prisma.userMovieInteraction.update({
            where: { id: existing.id },
            data: { status: status || existing.status, rating: rating !== undefined ? rating : existing.rating }
        });
    }
    else {
        await req.prisma.userMovieInteraction.create({
            data: {
                userId: req.userId,
                movieId: movie.id,
                status: status || 'want_to_watch',
                rating: rating
            }
        });
    }
    res.status(201).json({ success: true });
});
router.delete('/interactions', async (req, res) => {
    const { tmdb_id } = req.query;
    if (!tmdb_id) {
        return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'tmdb_id is required' } });
    }
    const movie = await req.prisma.movie.findUnique({ where: { tmdbId: parseInt(tmdb_id) } });
    if (!movie) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Movie not found' } });
    }
    await req.prisma.userMovieInteraction.deleteMany({
        where: { userId: req.userId, movieId: movie.id }
    });
    res.json({ success: true });
});
router.get('/reviews', async (req, res) => {
    const reviews = await req.prisma.userReview.findMany({
        where: { userId: req.userId },
        include: { user: { select: { id: true, username: true, displayName: true } } },
        orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: reviews });
});
router.post('/reviews/:id/like', async (req, res) => {
    const { id } = req.params;
    const reviewId = Array.isArray(id) ? id[0] : id;
    const existing = await req.prisma.reviewLike.findFirst({
        where: { userId: req.userId, reviewId }
    });
    if (existing) {
        await req.prisma.reviewLike.delete({ where: { id: existing.id } });
        await req.prisma.userReview.update({
            where: { id: reviewId },
            data: { likesCount: { decrement: 1 } }
        });
        return res.json({ success: true, liked: false });
    }
    else {
        await req.prisma.reviewLike.create({ data: { userId: req.userId, reviewId } });
        await req.prisma.userReview.update({
            where: { id: reviewId },
            data: { likesCount: { increment: 1 } }
        });
        return res.json({ success: true, liked: true });
    }
});
router.get('/achievements', async (req, res) => {
    const userAchievements = await req.prisma.userAchievement.findMany({
        where: { userId: req.userId }
    });
    const earnedCodes = new Set(userAchievements.map(a => a.achievementCode));
    const achievements = index_js_1.ACHIEVEMENTS.map(def => ({
        ...def,
        isEarned: earnedCodes.has(def.code),
        progress: earnedCodes.has(def.code) ? 100 : 0
    }));
    const totalPoints = achievements.filter(a => a.isEarned).reduce((sum, a) => sum + a.points, 0);
    res.json({
        success: true,
        data: achievements,
        meta: { earnedCount: earnedCodes.size, totalCount: achievements.length, totalPoints }
    });
});
router.post('/achievements', async (req, res) => {
    const { achievement_code } = req.body;
    if (!achievement_code) {
        return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'achievement_code is required' } });
    }
    const existing = await req.prisma.userAchievement.findFirst({
        where: { userId: req.userId, achievementCode: achievement_code }
    });
    if (existing) {
        return res.json({ success: true, message: 'Already earned' });
    }
    await req.prisma.userAchievement.create({
        data: { userId: req.userId, achievementCode: achievement_code }
    });
    res.status(201).json({ success: true });
});
router.get('/personal-recommendations', async (req, res) => {
    const topRated = await req.prisma.userMovieInteraction.findMany({
        where: { userId: req.userId, rating: { gte: 9 } },
        include: { movie: { select: { tmdbId: true, title: true } } },
        orderBy: { updatedAt: 'desc' },
        take: 3
    });
    if (topRated.length === 0) {
        return res.json({ success: true, data: [], message: 'No rated movies yet' });
    }
    const watchedMovies = await req.prisma.userMovieInteraction.findMany({
        where: { userId: req.userId, status: 'watched' },
        include: { movie: { select: { tmdbId: true } } }
    });
    const watchedIds = new Set(watchedMovies.map((m) => m.movie.tmdbId));
    const allRecommendations = [];
    for (const interaction of topRated) {
        const tmdbId = interaction.movie.tmdbId;
        try {
            const data = await (0, tmdb_js_1.getMovieRecommendations)(tmdbId);
            if (data.results && data.results.length > 0) {
                allRecommendations.push(...data.results);
            }
        }
        catch (err) {
            console.error(`Failed to get recommendations for movie ${tmdbId}:`, err);
        }
    }
    const uniqueById = new Map();
    for (const movie of allRecommendations) {
        if (!watchedIds.has(movie.id) && !uniqueById.has(movie.id)) {
            uniqueById.set(movie.id, movie);
        }
    }
    const shuffled = Array.from(uniqueById.values()).sort(() => Math.random() - 0.5);
    const final = shuffled.slice(0, 20).map((m) => ({
        tmdb_id: m.id,
        title: m.title || m.name,
        overview: m.overview,
        poster_path: m.poster_path,
        backdrop_path: m.backdrop_path,
        vote_average: m.vote_average,
        release_date: m.release_date || m.first_air_date,
        media_type: m.media_type || 'movie'
    }));
    res.json({ success: true, data: final });
});
exports.default = router;
