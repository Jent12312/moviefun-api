"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createReviewSchema = exports.loginSchema = exports.registerSchema = void 0;
const zod_1 = require("zod");
exports.registerSchema = zod_1.z.object({
    email: zod_1.z.string().email('Невалидный email'),
    username: zod_1.z.string().optional(),
    password: zod_1.z.string().min(6, 'Пароль должен быть минимум 6 символов'),
});
exports.loginSchema = zod_1.z.object({
    email: zod_1.z.string().email('Невалидный email'),
    password: zod_1.z.string().min(1, 'Пароль обязателен'),
});
exports.createReviewSchema = zod_1.z.object({
    content_id: zod_1.z.string().regex(/^\d+$/, 'content_id должен быть числом'),
    content_type: zod_1.z.enum(['movie', 'tv']).optional().default('movie'),
    title: zod_1.z.string().max(200, 'Заголовок слишком длинный').optional().default(''),
    content: zod_1.z.string().min(1, 'Текст рецензии обязателен').max(5000, 'Рецензия слишком длинная'),
    rating: zod_1.z.number().min(0.5, 'Рейтинг минимум 0.5').max(10, 'Рейтинг максимум 10'),
    contains_spoilers: zod_1.z.boolean().optional().default(false),
});
