"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_js_1 = require("../middleware/auth.js");
const router = (0, express_1.Router)();
router.use(auth_js_1.requireAuth);
router.get('/friend-requests', async (req, res) => {
    const requests = await req.prisma.friendRequest.findMany({
        where: { receiverId: req.userId, status: 'pending' },
        include: { sender: { select: { id: true, username: true, displayName: true, avatarUrl: true } } }
    });
    res.json({ success: true, data: requests });
});
router.post('/friend-requests', async (req, res) => {
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
router.post('/friend-requests/:id', async (req, res) => {
    const { id } = req.params;
    const requestId = Array.isArray(id) ? id[0] : id;
    const { accept } = req.body;
    if (accept) {
        await req.prisma.friendRequest.update({
            where: { id: requestId },
            data: { status: 'accepted' }
        });
        const request = await req.prisma.friendRequest.findUnique({ where: { id: requestId } });
        if (request) {
            await req.prisma.friendship.createMany({
                data: [
                    { userId: request.receiverId, friendId: request.senderId },
                    { userId: request.senderId, friendId: request.receiverId }
                ]
            });
        }
    }
    else {
        await req.prisma.friendRequest.delete({ where: { id: requestId } });
    }
    res.json({ success: true });
});
router.delete('/friend-requests/:id', async (req, res) => {
    const { id } = req.params;
    const requestId = Array.isArray(id) ? id[0] : id;
    await req.prisma.friendRequest.delete({ where: { id: requestId } });
    res.json({ success: true });
});
router.get('/friends', async (req, res) => {
    const friends = await req.prisma.friendship.findMany({
        where: { userId: req.userId },
        include: { friend: { select: { id: true, username: true, displayName: true, avatarUrl: true } } }
    });
    res.json({
        success: true,
        data: friends.map((f) => ({
            id: f.friend.id,
            username: f.friend.username,
            display_name: f.friend.displayName,
            avatar_url: f.friend.avatarUrl
        }))
    });
});
router.delete('/friends/:id', async (req, res) => {
    const { id } = req.params;
    const friendId = Array.isArray(id) ? id[0] : id;
    await req.prisma.friendship.deleteMany({
        where: { userId: req.userId, friendId }
    });
    await req.prisma.friendship.deleteMany({
        where: { userId: friendId, friendId: req.userId }
    });
    res.json({ success: true });
});
exports.default = router;
