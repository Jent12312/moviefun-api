import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('Невалидный email'),
  username: z.string().optional(),
  password: z.string().min(6, 'Пароль должен быть минимум 6 символов'),
});

export const loginSchema = z.object({
  email: z.string().email('Невалидный email'),
  password: z.string().min(1, 'Пароль обязателен'),
});

export const createReviewSchema = z.object({
  content_id: z.string().regex(/^\d+$/, 'content_id должен быть числом'),
  content_type: z.enum(['movie', 'tv']).optional().default('movie'),
  title: z.string().max(200, 'Заголовок слишком длинный').optional().default(''),
  content: z.string().min(1, 'Текст рецензии обязателен').max(5000, 'Рецензия слишком длинная'),
  rating: z.number().min(0.5, 'Рейтинг минимум 0.5').max(10, 'Рейтинг максимум 10'),
  contains_spoilers: z.boolean().optional().default(false),
});