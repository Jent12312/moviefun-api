"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const compression_1 = __importDefault(require("compression"));
const dotenv_1 = __importDefault(require("dotenv"));
const client_1 = require("@prisma/client");
const auth_js_1 = require("./middleware/auth.js");
const movies_js_1 = __importDefault(require("./routes/movies.js"));
const tv_js_1 = __importDefault(require("./routes/tv.js"));
const search_js_1 = __importDefault(require("./routes/search.js"));
const user_js_1 = __importDefault(require("./routes/user.js"));
const auth_js_2 = __importDefault(require("./routes/auth.js"));
const reviews_js_1 = __importDefault(require("./routes/reviews.js"));
const news_js_1 = __importDefault(require("./routes/news.js"));
const images_js_1 = __importDefault(require("./routes/images.js"));
const rateLimit_js_1 = require("./middleware/rateLimit.js");
const newsWorker_js_1 = require("./services/newsWorker.js");
dotenv_1.default.config();
const app = (0, express_1.default)();
const prisma = new client_1.PrismaClient();
exports.prisma = prisma;
const PORT = process.env.PORT || 3000;
app.use((0, cors_1.default)());
app.use((0, compression_1.default)());
app.use(express_1.default.json());
app.use((req, res, next) => {
    req.prisma = prisma;
    next();
});
const authMiddleware = (0, auth_js_1.createAuthMiddleware)(prisma);
app.use(authMiddleware);
app.use('/api/movies', rateLimit_js_1.apiLimiter, movies_js_1.default);
app.use('/api/tv', rateLimit_js_1.apiLimiter, tv_js_1.default);
app.use('/api/search', rateLimit_js_1.apiLimiter, search_js_1.default);
app.use('/api/user', user_js_1.default);
app.use('/api/auth', auth_js_2.default);
app.use('/api/reviews', reviews_js_1.default);
app.use('/api/news', rateLimit_js_1.apiLimiter, news_js_1.default);
app.use('/api/images', images_js_1.default);
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
app.use((err, req, res, next) => {
    console.error('Error:', err.message);
    res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_SERVER_ERROR', message: err.message }
    });
});
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    (0, newsWorker_js_1.startNewsWorker)(prisma, 15);
});
