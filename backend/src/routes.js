import { Router } from 'express';
import { db } from './firebase.js';
import { requireAuth } from './auth.js';
import { getMessages, listConversations, conversationId } from './chatService.js';

const router = Router();

// All REST endpoints require a valid Firebase ID token.
router.use(requireAuth);

// GET /api/users -> everyone except me (to start new chats).
router.get('/users', async (req, res) => {
  try {
    const snap = await db.collection('users').get();
    const users = snap.docs
      .map((d) => d.data())
      .filter((u) => u.uid !== req.user.uid)
      .map((u) => ({
        uid: u.uid,
        displayName: u.displayName,
        email: u.email || null,
        photoURL: u.photoURL || null,
      }));
    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/conversations -> my conversation list with previews + unread counts.
router.get('/conversations', async (req, res) => {
  try {
    res.json({ conversations: await listConversations(req.user.uid) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/conversations/:id/messages?limit=20&before=<millis>
// Lazy-loading of older messages. Omit `before` for the newest page.
router.get('/conversations/:id/messages', async (req, res) => {
  try {
    const { id } = req.params;
    // Authorization: the requester must be a participant of the conversation.
    if (!id.split('_').includes(req.user.uid)) {
      return res.status(403).json({ error: 'Not a participant of this conversation' });
    }
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const before = req.query.before || null;
    res.json(await getMessages(id, req.user.uid, { limit, before }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Convenience: resolve/derive the conversation id for a given contact.
router.get('/conversations/with/:uid', (req, res) => {
  res.json({ conversationId: conversationId(req.user.uid, req.params.uid) });
});

export default router;
