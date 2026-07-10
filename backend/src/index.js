import http from 'http';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Server } from 'socket.io';

import './firebase.js';
import { socketAuth } from './auth.js';
import routes from './routes.js';
import {
  saveMessage,
  markConversationRead,
  conversationId,
  deleteMessageForMe,
  deleteMessageForEveryone,
  editMessage,
  clearConversationForMe,
  clearConversationForEveryone,
} from './chatService.js';

dotenv.config();

const PORT = process.env.PORT || 4000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

const app = express();
app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/api', routes);

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: CLIENT_ORIGIN, methods: ['GET', 'POST'] },
});

// Validate the Firebase ID token on every socket connection.
io.use(socketAuth);

io.on('connection', (socket) => {
  const me = socket.user;
  // Personal room so we can address messages to a user across all their tabs/devices.
  socket.join(me.uid);
  console.log(`connected: ${me.displayName} (${me.uid})`);

  // Broadcast presence.
  socket.broadcast.emit('presence:online', { uid: me.uid });

  // Send a message. Payload: { receiverUid, content }
  socket.on('message:send', async (payload, ack) => {
    try {
      const receiverUid = payload?.receiverUid;
      const content = (payload?.content || '').trim();
      if (!receiverUid || !content) {
        return ack?.({ error: 'receiverUid and content are required' });
      }

      const message = await saveMessage({
        senderUid: me.uid,
        receiverUid,
        content,
      });

      // Deliver to the receiver (all their sockets) and echo to the sender.
      io.to(receiverUid).emit('message:new', message);
      socket.emit('message:new', message);
      ack?.({ ok: true, message });
    } catch (err) {
      console.error('message:send error', err);
      ack?.({ error: err.message });
    }
  });

  // Typing indicator. Payload: { receiverUid, isTyping }
  socket.on('typing', ({ receiverUid, isTyping }) => {
    if (!receiverUid) return;
    io.to(receiverUid).emit('typing', {
      conversationId: conversationId(me.uid, receiverUid),
      fromUid: me.uid,
      fromName: me.displayName,
      isTyping: !!isTyping,
    });
  });

  // Delete a message. Payload: { conversationId, messageId, scope: 'me' | 'all' }
  socket.on('message:delete', async ({ conversationId: convId, messageId, scope }, ack) => {
    try {
      if (!convId || !messageId) return ack?.({ error: 'conversationId and messageId required' });
      if (!convId.split('_').includes(me.uid)) return ack?.({ error: 'Not a participant' });

      if (scope === 'all') {
        const updated = await deleteMessageForEveryone(convId, messageId, me.uid);
        // Tombstone visible to both participants.
        convId.split('_').forEach((uid) => io.to(uid).emit('message:update', updated));
      } else {
        await deleteMessageForMe(convId, messageId, me.uid);
        // Removed from this user's own devices only.
        io.to(me.uid).emit('message:remove', { conversationId: convId, messageId });
      }
      ack?.({ ok: true });
    } catch (err) {
      console.error('message:delete error', err);
      ack?.({ error: err.message });
    }
  });

  // Edit a message. Payload: { conversationId, messageId, content }
  socket.on('message:edit', async ({ conversationId: convId, messageId, content }, ack) => {
    try {
      if (!convId.split('_').includes(me.uid)) return ack?.({ error: 'Not a participant' });
      const updated = await editMessage(convId, messageId, me.uid, content);
      convId.split('_').forEach((uid) => io.to(uid).emit('message:update', updated));
      ack?.({ ok: true, message: updated });
    } catch (err) {
      console.error('message:edit error', err);
      ack?.({ error: err.message });
    }
  });

  // Clear a whole conversation. Payload: { conversationId, scope: 'me' | 'all' }
  socket.on('conversation:clear', async ({ conversationId: convId, scope }, ack) => {
    try {
      if (!convId.split('_').includes(me.uid)) return ack?.({ error: 'Not a participant' });
      if (scope === 'all') {
        await clearConversationForEveryone(convId, me.uid);
        convId.split('_').forEach((uid) =>
          io.to(uid).emit('conversation:clear', { conversationId: convId, scope: 'all' })
        );
      } else {
        await clearConversationForMe(convId, me.uid);
        io.to(me.uid).emit('conversation:clear', { conversationId: convId, scope: 'me' });
      }
      ack?.({ ok: true });
    } catch (err) {
      console.error('conversation:clear error', err);
      ack?.({ error: err.message });
    }
  });

  // Mark a conversation's incoming messages as read.
  socket.on('message:read', async ({ conversationId: convId }) => {
    try {
      if (!convId) return;
      const updatedIds = await markConversationRead(convId, me.uid);
      if (!updatedIds.length) return;
      const otherUid = convId.split('_').find((u) => u !== me.uid);
      if (otherUid) {
        io.to(otherUid).emit('message:read', { conversationId: convId, messageIds: updatedIds });
      }
    } catch (err) {
      console.error('message:read error', err);
    }
  });

  socket.on('disconnect', () => {
    socket.broadcast.emit('presence:offline', { uid: me.uid });
    console.log(`disconnected: ${me.uid}`);
  });
});

server.listen(PORT, () => {
  console.log(`RTC backend listening on http://localhost:${PORT}`);
  console.log(`Allowed client origin: ${CLIENT_ORIGIN}`);
});
