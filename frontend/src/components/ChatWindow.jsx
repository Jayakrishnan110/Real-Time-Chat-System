import { useEffect, useLayoutEffect, useRef } from 'react';
import Avatar from './Avatar.jsx';
import MessageBubble from './MessageBubble.jsx';
import MessageInput from './MessageInput.jsx';
import TypingIndicator from './TypingIndicator.jsx';

export default function ChatWindow({
  me,
  contact,
  messages,
  hasMore,
  loadingOlder,
  typingName,
  online,
  onSend,
  onTyping,
  onLoadMore,
  onEditMessage,
  onDeleteMessage,
}) {
  const scrollRef = useRef(null);
  const bottomRef = useRef(null);
  const prevScrollHeight = useRef(0);
  const prevMsgCount = useRef(0);

  // Auto-scroll to the newest message when a message is appended (not when
  // older history is prepended). We compare against the previous count and
  // whether the change came from the top.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const grewFromTop = loadingOlder === false && prevScrollHeight.current > 0;
    if (grewFromTop && messages.length > prevMsgCount.current && wasPrepend()) {
      // Preserve scroll position after prepending older messages.
      el.scrollTop = el.scrollHeight - prevScrollHeight.current;
    } else {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevScrollHeight.current = el.scrollHeight;
    prevMsgCount.current = messages.length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, typingName]);

  // Heuristic: a prepend keeps the last message id stable but adds items at the front.
  const lastIdRef = useRef(null);
  function wasPrepend() {
    const lastId = messages[messages.length - 1]?.id;
    const isPrepend = lastId && lastId === lastIdRef.current;
    lastIdRef.current = lastId;
    return isPrepend;
  }

  // Load older messages when scrolled to the top.
  const handleScroll = () => {
    const el = scrollRef.current;
    if (el && el.scrollTop < 40 && hasMore && !loadingOlder) {
      prevScrollHeight.current = el.scrollHeight;
      onLoadMore();
    }
  };

  useEffect(() => {
    lastIdRef.current = messages[messages.length - 1]?.id || null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contact?.uid]);

  if (!contact) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-wa-panel text-center px-6">
        <div className="text-6xl mb-4">💬</div>
        <h2 className="text-2xl font-light text-gray-600">RTC Real-Time Chat</h2>
        <p className="text-gray-400 mt-2 max-w-sm">
          Select a conversation or start a new one to begin messaging in real time.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-wa-panel border-l border-gray-200">
        <Avatar name={contact.displayName} photoURL={contact.photoURL} size={40} online={online} />
        <div>
          <p className="font-semibold text-gray-800 leading-tight">{contact.displayName}</p>
          <p className="text-xs text-gray-500">
            {typingName ? 'typing…' : online ? 'online' : 'offline'}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto scroll-thin bg-chat bg-wa-bg py-3 space-y-1"
      >
        {loadingOlder && (
          <p className="text-center text-xs text-gray-500 py-2">Loading older messages…</p>
        )}
        {!hasMore && messages.length > 0 && (
          <p className="text-center text-xs text-gray-400 py-2">Beginning of conversation</p>
        )}
        {messages.map((m) => (
          <MessageBubble
            key={m.id}
            message={m}
            mine={m.senderUid === me.uid}
            onEdit={onEditMessage}
            onDelete={onDeleteMessage}
          />
        ))}
        {typingName && <TypingIndicator name={typingName} />}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <MessageInput onSend={onSend} onTyping={onTyping} />
    </div>
  );
}
