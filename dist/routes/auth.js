"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const validation_js_1 = require("../schemas/validation.js");
const rateLimit_js_1 = require("../middleware/rateLimit.js");
const router = (0, express_1.Router)();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
router.post('/register', rateLimit_js_1.authLimiter, async (req, res) => {
    const parsed = validation_js_1.registerSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({
            success: false,
            error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message }
        });
    }
    const { email, username, password } = parsed.data;
    try {
        const existingEmail = await req.prisma.user.findUnique({ where: { email } });
        if (existingEmail) {
            return res.status(409).json({ success: false, error: { code: 'CONFLICT', message: 'Email уже зарегистрирован' } });
        }
        const finalUsername = username || email.split('@')[0] + Math.floor(Math.random() * 1000);
        const saltRounds = 10;
        const passwordHash = await bcrypt_1.default.hash(password, saltRounds);
        const user = await req.prisma.user.create({
            data: { email, username: finalUsername, passwordHash, role: 'user' }
        });
        const token = jsonwebtoken_1.default.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
        res.status(201).json({
            success: true,
            data: { user: { id: user.id, email: user.email, username: user.username }, token }
        });
    }
    catch (error) {
        console.error("Register Error:", error);
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});
router.post('/login', rateLimit_js_1.authLimiter, async (req, res) => {
    const parsed = validation_js_1.loginSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({
            success: false,
            error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message }
        });
    }
    const { email, password } = parsed.data;
    try {
        const user = await req.prisma.user.findUnique({ where: { email } });
        if (!user) {
            return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Неверный email или пароль' } });
        }
        const isValid = await bcrypt_1.default.compare(password, user.passwordHash);
        if (!isValid) {
            return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Неверный email или пароль' } });
        }
        const token = jsonwebtoken_1.default.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
        res.json({
            success: true,
            data: { user: { id: user.id, email: user.email, username: user.username }, token }
        });
    }
    catch (error) {
        console.error("Login Error:", error);
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
    }
});
router.get('/verify', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Missing token' } });
    }
    const token = authHeader.substring(7);
    try {
        const payload = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        const user = await req.prisma.user.findUnique({
            where: { id: payload.sub },
            select: { id: true, email: true, username: true, role: true, createdAt: true }
        });
        if (!user) {
            return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'User not found' } });
        }
        res.json({ success: true, data: user });
    }
    catch {
        res.status(401).json({ success: false, error: { code: 'INVALID_TOKEN', message: 'Invalid or expired token' } });
    }
});
exports.default = router;
