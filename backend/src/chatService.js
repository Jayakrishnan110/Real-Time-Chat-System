import { db, FieldValue, Timestamp } from './firebase.js';

// Deterministic conversation id for a 1-to-1 chat: sorted uids joined with "_".
// This means both participants always resolve to the same conversation document.
export function conversationId(uidA, uidB) {
  return [uidA, uidB].sort().join('_');
}

// Ensure the conversation document exists and return its id.
export async function ensureConversation(senderUid, receiverUid) {
  const id = conversationId(senderUid, receiverUid);
  const ref = db.collection('conversations').doc(id);
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set({
      participants: [senderUid, receiverUid].sort(),
      createdAt: FieldValue.serverTimestamp(),
      lastMessage: '',
      lastMessageSender: null,
      lastMessageAt: FieldValue.serverTimestamp(),
    });
  }
  return id;
}

// Persist a message and update the conversation preview atomically.
export async function saveMessage({ senderUid, receiverUid, content }) {
  const convId = await ensureConversation(senderUid, receiverUid);
  const convRef = db.collection('conversations').doc(convId);
  const msgRef = convRef.collection('messages').doc();

  const now = Timestamp.now();
  const message = {
    id: msgRef.id,
    conversationId: convId,
    senderUid,
    receiverUid,
    content,
    status: 'sent',
    createdAt: now,
  };

  const batch = db.batch();
  batch.set(msgRef, message);
  batch.set(
    convRef,
    {
      lastMessage: content,
      lastMessageSender: senderUid,
      lastMessageAt: now,
      participants: [senderUid, receiverUid].sort(),
    },
    { merge: true }
  );
  await batch.commit();

  return serializeMessage(message);
}

// Mark all messages in a conversation sent *to* the given user as read.
// We filter on the single-field `receiverUid` (auto-indexed) and narrow the
// status in memory, so no composite index is required.
export async function markConversationRead(convId, readerUid) {
  const snap = await db
    .collection('conversations')
    .doc(convId)
    .collection('messages')
    .where('receiverUid', '==', readerUid)
    .get();

  const unread = snap.docs.filter((d) => ['sent', 'delivered'].includes(d.data().status));
  if (unread.length === 0) return [];

  const batch = db.batch();
  unread.forEach((doc) => batch.update(doc.ref, { status: 'read' }));
  await batch.commit();
  return unread.map((d) => d.id);
}

// List every conversation the user participates in, newest activity first.
// Uses only the single-field `array-contains` filter (auto-indexed); ordering
// and unread counting are done in memory so NO composite index is needed.
export async function listConversations(uid) {
  const snap = await db
    .collection('conversations')
    .where('participants', 'array-contains', uid)
    .get();

  const conversations = [];
  for (const doc of snap.docs) {
    const data = doc.data();
    const otherUid = data.participants.find((p) => p !== uid);
    let other = null;
    if (otherUid) {
      const userSnap = await db.collection('users').doc(otherUid).get();
      other = userSnap.exists ? userSnap.data() : { uid: otherUid, displayName: 'Unknown' };
    }
    // Count unread messages addressed to the current user (in memory).
    const unreadSnap = await doc.ref
      .collection('messages')
      .where('receiverUid', '==', uid)
      .get();
    const unreadCount = unreadSnap.docs.filter((d) =>
      ['sent', 'delivered'].includes(d.data().status)
    ).length;

    conversations.push({
      id: doc.id,
      participants: data.participants,
      lastMessage: data.lastMessage,
      lastMessageSender: data.lastMessageSender,
      lastMessageAt: toMillis(data.lastMessageAt),
      unreadCount,
      contact: other && {
        uid: other.uid,
        displayName: other.displayName,
        photoURL: other.photoURL || null,
        email: other.email || null,
      },
    });
  }

  // Newest activity first.
  conversations.sort((a, b) => (b.lastMessageAt || 0) - (a.lastMessageAt || 0));
  return conversations;
}

// Paginated message history (lazy-loading of older messages).
// Returns messages in ascending (oldest -> newest) order for easy rendering.
// Hides messages the given user has deleted-for-me and anything older than the
// point where they cleared the chat for themselves.
export async function getMessages(convId, uid, { limit = 20, before } = {}) {
  const convRef = db.collection('conversations').doc(convId);
  const convSnap = await convRef.get();
  const clearedAtMs = convSnap.exists ? toMillis(convSnap.data().clearedAt?.[uid]) : null;

  let query = convRef.collection('messages').orderBy('createdAt', 'desc').limit(limit);
  if (before) {
    query = query.startAfter(Timestamp.fromMillis(Number(before)));
  }

  const snap = await query.get();
  const visible = snap.docs
    .map((d) => d.data())
    .filter((m) => {
      // Deleted just for this user.
      if (Array.isArray(m.deletedFor) && m.deletedFor.includes(uid)) return false;
      // Older than this user's "clear chat" cutoff.
      const created = toMillis(m.createdAt);
      if (clearedAtMs && created != null && created <= clearedAtMs) return false;
      return true;
    });

  const messages = visible.map(serializeMessage).reverse();
  const oldest = snap.docs.length ? toMillis(snap.docs[snap.docs.length - 1].data().createdAt) : null;

  return {
    messages,
    hasMore: snap.docs.length === limit,
    nextCursor: oldest, // pass this back as `before` to load the previous page
  };
}

// ---- Delete / edit / clear ----------------------------------------------

// "Delete for me": hide a single message for one user only. The other
// participant is unaffected.
export async function deleteMessageForMe(convId, messageId, uid) {
  const ref = db
    .collection('conversations')
    .doc(convId)
    .collection('messages')
    .doc(messageId);
  await ref.update({ deletedFor: FieldValue.arrayUnion(uid) });
}

// "Delete for everyone": replace the message with a tombstone visible to BOTH
// participants. Only the original sender is allowed to do this.
export async function deleteMessageForEveryone(convId, messageId, requesterUid) {
  const ref = db
    .collection('conversations')
    .doc(convId)
    .collection('messages')
    .doc(messageId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('Message not found');
  const msg = snap.data();
  if (msg.senderUid !== requesterUid) {
    throw new Error('Only the sender can delete for everyone');
  }
  await ref.update({ deletedForEveryone: true, content: '', edited: false });
  await refreshConversationPreview(convId);
  return serializeMessage({ ...msg, deletedForEveryone: true, content: '' });
}

// Edit a message's content. Only the sender may edit; syncs to the receiver.
export async function editMessage(convId, messageId, requesterUid, content) {
  const trimmed = (content || '').trim();
  if (!trimmed) throw new Error('Content is required');
  const ref = db
    .collection('conversations')
    .doc(convId)
    .collection('messages')
    .doc(messageId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('Message not found');
  const msg = snap.data();
  if (msg.senderUid !== requesterUid) throw new Error('Only the sender can edit');
  if (msg.deletedForEveryone) throw new Error('Cannot edit a deleted message');
  await ref.update({ content: trimmed, edited: true });
  await refreshConversationPreview(convId);
  return serializeMessage({ ...msg, content: trimmed, edited: true });
}

// "Clear chat" for one user only: records a cutoff timestamp; everything up to
// now becomes hidden for this user. The other participant keeps the history.
export async function clearConversationForMe(convId, uid) {
  await db
    .collection('conversations')
    .doc(convId)
    .set({ clearedAt: { [uid]: Timestamp.now() } }, { merge: true });
}

// "Clear for everyone": hard-delete every message for BOTH participants.
export async function clearConversationForEveryone(convId, requesterUid) {
  const convRef = db.collection('conversations').doc(convId);
  const convSnap = await convRef.get();
  if (!convSnap.exists) return;
  if (!convSnap.data().participants?.includes(requesterUid)) {
    throw new Error('Not a participant of this conversation');
  }

  const msgsSnap = await convRef.collection('messages').get();
  let batch = db.batch();
  let ops = 0;
  for (const doc of msgsSnap.docs) {
    batch.delete(doc.ref);
    if (++ops === 400) {
      await batch.commit();
      batch = db.batch();
      ops = 0;
    }
  }
  if (ops > 0) await batch.commit();

  await convRef.set(
    { lastMessage: '', lastMessageSender: null, lastMessageAt: Timestamp.now(), clearedAt: {} },
    { merge: true }
  );
}

// Recompute the conversation's last-message preview after an edit/delete.
async function refreshConversationPreview(convId) {
  const convRef = db.collection('conversations').doc(convId);
  const snap = await convRef
    .collection('messages')
    .orderBy('createdAt', 'desc')
    .limit(1)
    .get();

  if (snap.empty) {
    await convRef.set({ lastMessage: '', lastMessageSender: null }, { merge: true });
    return;
  }
  const m = snap.docs[0].data();
  await convRef.set(
    {
      lastMessage: m.deletedForEveryone ? 'This message was deleted' : m.content,
      lastMessageSender: m.senderUid,
      lastMessageAt: m.createdAt,
    },
    { merge: true }
  );
}

function toMillis(ts) {
  if (!ts) return null;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  return ts;
}

function serializeMessage(m) {
  return {
    id: m.id,
    conversationId: m.conversationId,
    senderUid: m.senderUid,
    receiverUid: m.receiverUid,
    content: m.deletedForEveryone ? '' : m.content,
    status: m.status,
    createdAt: toMillis(m.createdAt),
    edited: !!m.edited,
    deletedForEveryone: !!m.deletedForEveryone,
  };
}
