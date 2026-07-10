import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from './context/AuthContext.jsx';
import { useToast } from './context/ToastContext.jsx';
import { useSocket } from './hooks/useSocket.js';
import { logout } from './firebase.js';
import {
  fetchConversations,
  fetchMessages,
  fetchUsers,
} from './api.js';
import Login from './components/Login.jsx';
import ChatList from './components/ChatList.jsx';
import ChatWindow from './components/ChatWindow.jsx';

const PAGE_SIZE = 20;

// Build the deterministic conversation id used by the backend.
const convIdOf = (a, b) => [a, b].sort().join('_');

export default function App() {
  const { user, token, loading } = useAuth();
  const { notify } = useToast();
  const { socket, connected } = useSocket(token);

  const [conversations, setConversations] = useState([]);
  const [users, setUsers] = useState([]);
  const [activeContact, setActiveContact] = useState(null);
  const [messages, setMessages] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [typing, setTyping] = useState({}); // { [conversationId]: name }
  const [onlineUids, setOnlineUids] = useState(new Set());

  // Keep a ref to the active contact so socket handlers see the latest value.
  const activeContactRef = useRef(null);
  activeContactRef.current = activeContact;

  // ---- Initial data load ----
  const refreshConversations = useCallback(async () => {
    if (!token) return;
    try {
      const { conversations } = await fetchConversations(token);
      setConversations(conversations);
    } catch (err) {
      console.error(err);
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    refreshConversations();
    fetchUsers(token).then((r) => setUsers(r.users)).catch(console.error);
  }, [token, refreshConversations]);

  // ---- Load messages for the active conversation ----
  const openConversation = useCallback(
    async (contact) => {
      setActiveContact(contact);
      setMessages([]);
      setNextCursor(null);
      setHasMore(false);
      if (!contact) return;

      const convId = convIdOf(user.uid, contact.uid);
      try {
        const res = await fetchMessages(token, convId, { limit: PAGE_SIZE });
        setMessages(res.messages);
        setHasMore(res.hasMore);
        setNextCursor(res.nextCursor);
        // Mark the conversation as read.
        socket.current?.emit('message:read', { conversationId: convId });
        setConversations((prev) =>
          prev.map((c) => (c.id === convId ? { ...c, unreadCount: 0 } : c))
        );
      } catch (err) {
        console.error(err);
      }
    },
    [token, user, socket]
  );

  // ---- Lazy load older messages ----
  const loadOlder = useCallback(async () => {
    if (!activeContact || !hasMore || loadingOlder || !nextCursor) return;
    setLoadingOlder(true);
    const convId = convIdOf(user.uid, activeContact.uid);
    try {
      const res = await fetchMessages(token, convId, {
        limit: PAGE_SIZE,
        before: nextCursor,
      });
      setMessages((prev) => [...res.messages, ...prev]);
      setHasMore(res.hasMore);
      setNextCursor(res.nextCursor);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingOlder(false);
    }
  }, [activeContact, hasMore, loadingOlder, nextCursor, token, user]);

  // ---- Socket event wiring ----
  useEffect(() => {
    const s = socket.current;
    if (!s || !connected) return;

    const onNewMessage = (msg) => {
      const active = activeContactRef.current;
      const isActive =
        active &&
        (msg.senderUid === active.uid || msg.receiverUid === active.uid) &&
        msg.conversationId === convIdOf(user.uid, active.uid);

      if (isActive) {
        setMessages((prev) =>
          prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]
        );
        // We're looking at this chat — mark incoming as read immediately.
        if (msg.receiverUid === user.uid) {
          s.emit('message:read', { conversationId: msg.conversationId });
        }
      } else if (msg.receiverUid === user.uid) {
        // Toast notification for a message in another conversation.
        const sender = users.find((u) => u.uid === msg.senderUid);
        notify({
          title: sender?.displayName || 'New message',
          body: msg.content,
          onClick: () =>
            openConversation(
              sender || { uid: msg.senderUid, displayName: 'Unknown' }
            ),
        });
      }
      refreshConversations();
    };

    const onTyping = ({ conversationId, fromName, isTyping }) => {
      setTyping((prev) => {
        const next = { ...prev };
        if (isTyping) next[conversationId] = fromName;
        else delete next[conversationId];
        return next;
      });
    };

    const onRead = ({ conversationId, messageIds }) => {
      const ids = new Set(messageIds);
      setMessages((prev) =>
        prev.map((m) =>
          ids.has(m.id) && m.conversationId === conversationId
            ? { ...m, status: 'read' }
            : m
        )
      );
    };

    const onOnline = ({ uid }) =>
      setOnlineUids((prev) => new Set(prev).add(uid));
    const onOffline = ({ uid }) =>
      setOnlineUids((prev) => {
        const next = new Set(prev);
        next.delete(uid);
        return next;
      });

    // A message was removed just for me (delete-for-me).
    const onMessageRemove = ({ conversationId, messageId }) => {
      const active = activeContactRef.current;
      if (active && conversationId === convIdOf(user.uid, active.uid)) {
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
      }
      refreshConversations();
    };

    // A message changed for everyone (edit or delete-for-everyone tombstone).
    const onMessageUpdate = (msg) => {
      const active = activeContactRef.current;
      if (active && msg.conversationId === convIdOf(user.uid, active.uid)) {
        setMessages((prev) => prev.map((m) => (m.id === msg.id ? msg : m)));
      }
      refreshConversations();
    };

    // A whole conversation was cleared (for me, or for everyone).
    const onConversationClear = ({ conversationId }) => {
      const active = activeContactRef.current;
      if (active && conversationId === convIdOf(user.uid, active.uid)) {
        setMessages([]);
        setHasMore(false);
        setNextCursor(null);
      }
      refreshConversations();
    };

    s.on('message:new', onNewMessage);
    s.on('typing', onTyping);
    s.on('message:read', onRead);
    s.on('message:remove', onMessageRemove);
    s.on('message:update', onMessageUpdate);
    s.on('conversation:clear', onConversationClear);
    s.on('presence:online', onOnline);
    s.on('presence:offline', onOffline);

    return () => {
      s.off('message:new', onNewMessage);
      s.off('typing', onTyping);
      s.off('message:read', onRead);
      s.off('message:remove', onMessageRemove);
      s.off('message:update', onMessageUpdate);
      s.off('conversation:clear', onConversationClear);
      s.off('presence:online', onOnline);
      s.off('presence:offline', onOffline);
    };
  }, [connected, socket, user, users, notify, openConversation, refreshConversations]);

  // ---- Send / typing actions ----
  const sendMessage = (content) => {
    if (!activeContact) return;
    socket.current?.emit(
      'message:send',
      { receiverUid: activeContact.uid, content },
      (res) => {
        if (res?.error) notify({ title: 'Send failed', body: res.error });
      }
    );
  };

  const sendTyping = (isTyping) => {
    if (!activeContact) return;
    socket.current?.emit('typing', {
      receiverUid: activeContact.uid,
      isTyping,
    });
  };

  // ---- Delete / edit / clear actions ----
  const deleteMessage = (message, scope) => {
    socket.current?.emit(
      'message:delete',
      { conversationId: message.conversationId, messageId: message.id, scope },
      (res) => {
        if (res?.error) notify({ title: 'Delete failed', body: res.error });
      }
    );
  };

  const editMessageAction = (message, content) => {
    socket.current?.emit(
      'message:edit',
      { conversationId: message.conversationId, messageId: message.id, content },
      (res) => {
        if (res?.error) notify({ title: 'Edit failed', body: res.error });
      }
    );
  };

  const clearConversation = (conversation, scope) => {
    socket.current?.emit(
      'conversation:clear',
      { conversationId: conversation.id, scope },
      (res) => {
        if (res?.error) notify({ title: 'Clear failed', body: res.error });
      }
    );
  };

  const handleLogout = async () => {
    socket.current?.disconnect();
    await logout();
  };

  // ---- Render ----
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-wa-panel text-gray-500">
        Loading…
      </div>
    );
  }

  if (!user) return <Login />;

  const activeConvId = activeContact ? convIdOf(user.uid, activeContact.uid) : null;
  const typingName = activeConvId ? typing[activeConvId] : null;

  return (
    <div className="h-screen flex bg-wa-bg">
      {!connected && (
        <div className="absolute top-0 inset-x-0 bg-amber-500 text-white text-center text-xs py-1 z-40">
          Reconnecting…
        </div>
      )}
      <div className="w-full max-w-[420px] h-full">
        <ChatList
          me={user}
          conversations={conversations}
          users={users}
          activeContactUid={activeContact?.uid}
          onlineUids={onlineUids}
          onSelectContact={openConversation}
          onClearConversation={clearConversation}
          onLogout={handleLogout}
        />
      </div>
      <ChatWindow
        me={user}
        contact={activeContact}
        messages={messages}
        hasMore={hasMore}
        loadingOlder={loadingOlder}
        typingName={typingName}
        online={activeContact ? onlineUids.has(activeContact.uid) : false}
        onSend={sendMessage}
        onTyping={sendTyping}
        onLoadMore={loadOlder}
        onEditMessage={editMessageAction}
        onDeleteMessage={deleteMessage}
      />
    </div>
  );
}
