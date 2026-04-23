import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/friend-requests', async (req: Request, res: Response) => {
  const requests = await req.prisma.friendRequest.findMany({
    where: { receiverId: req.userId, status: 'pending' },
    include: { sender: { select: { id: true, username: true, displayName: true, avatarUrl: true } } }
  });
  res.json({ success: true, data: requests });
});

router.post('/friend-requests', async (req: Request, res: Response) => {
  const { user_id } = req.body;
  if (!user_id) {
    return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'user_id is required' } });
  }

  const existing = await req.prisma.friendRequest.findFirst({
    where: { senderId: req.userId, receiverId: user_id }
  });
  if (existing) {
    return res.status(409).json({ success: false, error: { code: 'CONFLICT', message: 'Friend request already sent' } });
  }

  await req.prisma.friendRequest.create({
    data: { senderId: req.userId, receiverId: user_id }
  });
  res.status(201).json({ success: true });
});

router.post('/friend-requests/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { accept } = req.body;

  if (accept) {
    await req.prisma.friendRequest.update({
      where: { id },
      data: { status: 'accepted' }
    });

    const request = await req.prisma.friendRequest.findUnique({ where: { id } });
    if (request) {
      await req.prisma.friendship.createMany({
        data: [
          { userId: request.receiverId, friendId: request.senderId },
          { userId: request.senderId, friendId: request.receiverId }
        ]
      });
    }
  } else {
    await req.prisma.friendRequest.delete({ where: { id } });
  }

  res.json({ success: true });
});

router.delete('/friend-requests/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  await req.prisma.friendRequest.delete({ where: { id } });
  res.json({ success: true });
});

router.get('/friends', async (req: Request, res: Response) => {
  const friends = await req.prisma.friendship.findMany({
    where: { userId: req.userId },
    include: { friend: { select: { id: true, username: true, displayName: true, avatarUrl: true } } }
  });
  res.json({
    success: true,
    data: friends.map(f => ({
      id: f.friend.id,
      username: f.friend.username,
      display_name: f.friend.displayName,
      avatar_url: f.friend.avatarUrl
    }))
  });
});

router.delete('/friends/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  await req.prisma.friendship.deleteMany({
    where: { userId: req.userId, friendId: id }
  });
  await req.prisma.friendship.deleteMany({
    where: { userId: id, friendId: req.userId }
  });
  res.json({ success: true });
});

export default router;