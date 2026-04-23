import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

router.post('/register', async (req: Request, res: Response) => {
  const { email, username, password } = req.body;
  
  if (!email || !username || !password) {
    return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'email, username and password are required' } });
  }

  const existingEmail = await req.prisma.user.findUnique({ where: { email } });
  if (existingEmail) {
    return res.status(409).json({ success: false, error: { code: 'CONFLICT', message: 'Email already registered' } });
  }

  const existingUsername = await req.prisma.user.findUnique({ where: { username } });
  if (existingUsername) {
    return res.status(409).json({ success: false, error: { code: 'CONFLICT', message: 'Username already taken' } });
  }

  const passwordHash = crypto.createHash('sha256').update(password).digest('hex');

  const user = await req.prisma.user.create({
    data: { email, username, passwordHash, role: 'user' }
  });

  const token = jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });

  res.status(201).json({
    success: true,
    data: { user: { id: user.id, email: user.email, username: user.username }, token }
  });
});

router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'email and password are required' } });
  }

  const passwordHash = crypto.createHash('sha256').update(password).digest('hex');
  
  const user = await req.prisma.user.findFirst({
    where: { email, passwordHash }
  });

  if (!user) {
    return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' } });
  }

  const token = jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });

  res.json({
    success: true,
    data: { user: { id: user.id, email: user.email, username: user.username, displayName: user.displayName, avatarUrl: user.avatarUrl }, token }
  });
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