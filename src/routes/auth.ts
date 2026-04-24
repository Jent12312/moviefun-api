import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

router.post('/register', async (req: Request, res: Response) => {
  const { email, username, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Email и пароль обязательны' } });
  }

  try {
    const existingEmail = await req.prisma.user.findUnique({ where: { email } });
    if (existingEmail) {
      return res.status(409).json({ success: false, error: { code: 'CONFLICT', message: 'Email уже зарегистрирован' } });
    }

    const finalUsername = username || email.split('@')[0] + Math.floor(Math.random() * 1000);

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const user = await req.prisma.user.create({
      data: { email, username: finalUsername, passwordHash, role: 'user' }
    });

    const token = jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });

    res.status(201).json({
      success: true,
      data: { user: { id: user.id, email: user.email, username: user.username }, token }
    });
  } catch (error: any) {
    console.error("Register Error:", error);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
  }
});

router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Email и пароль обязательны' } });
  }

  try {
    const user = await req.prisma.user.findUnique({ where: { email } });

    if (!user) {
      return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Неверный email или пароль' } });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    
    if (!isValid) {
      return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Неверный email или пароль' } });
    }

    const token = jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });

    res.json({
      success: true,
      data: { user: { id: user.id, email: user.email, username: user.username }, token }
    });
  } catch (error: any) {
    console.error("Login Error:", error);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
  }
});

router.get('/verify', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Missing token' } });
  }

  const token = authHeader.substring(7);
  
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { sub: string; email: string };
    const user = await req.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, username: true, role: true, createdAt: true }
    });

    if (!user) {
      return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'User not found' } });
    }

    res.json({ success: true, data: user });
  } catch {
    res.status(401).json({ success: false, error: { code: 'INVALID_TOKEN', message: 'Invalid or expired token' } });
  }
});

export default router;