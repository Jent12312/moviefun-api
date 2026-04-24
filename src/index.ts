import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { createAuthMiddleware } from './middleware/auth.js';
import moviesRouter from './routes/movies.js';
import tvRouter from './routes/tv.js';
import searchRouter from './routes/search.js';
import userRouter from './routes/user.js';
import authRouter from './routes/auth.js';
import reviewsRouter from './routes/reviews.js';
import newsRouter from './routes/news.js';
import imagesRouter from './routes/images.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { startNewsWorker } from './services/newsWorker.js';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  (req as any).prisma = prisma;
  next();
});

const authMiddleware = createAuthMiddleware(prisma);

app.use(authMiddleware);

app.use('/api/movies', apiLimiter, moviesRouter);
app.use('/api/tv', apiLimiter, tvRouter);
app.use('/api/search', apiLimiter, searchRouter);
app.use('/api/user', userRouter);
app.use('/api/auth', authRouter);
app.use('/api/reviews', reviewsRouter);
app.use('/api/news', apiLimiter, newsRouter);
app.use('/api/images', imagesRouter);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err.message);
  res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_SERVER_ERROR', message: err.message }
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  startNewsWorker(prisma, 15);
});

export { prisma };