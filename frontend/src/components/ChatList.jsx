import { useEffect, useRef, useState } from 'react';
import Avatar from './Avatar.jsx';
import { formatDayLabel } from '../utils/format.js';

export default function ChatList({
  me,
  conversations,
  users,
  activeContactUid,
  onlineUids,
  onSelectContact,
  onClearConversation,
  onLogout,
}) {
  const [search, setSearch] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [menuFor, setMenuFor] = useState(null); // conversation id whose menu is open
  const menuRef = useRef(null);

  // Close an open conversation menu when clicking elsewhere.
  useEffect(() => {
    if (!menuFor) return;
    const onDoc = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuFor(null);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuFor]);

  const filtered = conversations.filter((c) =>
    (c.contact?.displayName || '').toLowerCase().includes(search.toLowerCase())
  );

  // Users that don't yet have a conversation — for starting a new chat.
  const existingUids = new Set(conversations.map((c) => c.contact?.uid));
  const newUsers = users.filter((u) => !existingUids.has(u.uid));

  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-wa-panel">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar name={me.displayName} photoURL={me.photoURL} size={40} />
          <span className="font-semibold text-gray-800 truncate">{me.displayName}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            title="New chat"
            onClick={() => setShowNew((v) => !v)}
            className="w-9 h-9 rounded-full hover:bg-gray-200 flex items-center justify-center text-gray-600"
          >
            ✏️
          </button>
          <button
            title="Log out"
            onClick={onLogout}
            className="w-9 h-9 rounded-full hover:bg-gray-200 flex items-center justify-center text-gray-600"
          >
            ⏻
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="p-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search or start new chat"
          className="w-full bg-wa-panel rounded-lg px-3 py-2 text-sm focus:outline-none"
        />
      </div>

      {/* New chat picker */}
      {showNew && (
        <div className="border-b border-gray-100 max-h-60 overflow-y-auto scroll-thin">
          <p className="px-4 py-2 text-xs uppercase tracking-wide text-wa-green font-semibold">
            Start new chat
          </p>
          {newUsers.length === 0 && (
            <p className="px-4 py-2 text-sm text-gray-400">No other users yet.</p>
          )}
          {newUsers.map((u) => (
            <button
              key={u.uid}
              onClick={() => {
                onSelectContact(u);
                setShowNew(false);
              }}
              className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-50"
            >
              <Avatar name={u.displayName} photoURL={u.photoURL} size={36} online={onlineUids.has(u.uid)} />
              <span className="text-sm text-gray-800">{u.displayName}</span>
            </button>
          ))}
        </div>
      )}

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto scroll-thin">
        {filtered.length === 0 && (
          <p className="px-4 py-6 text-sm text-gray-400 text-center">
            No conversations yet. Tap ✏️ to start one.
          </p>
        )}
        {filtered.map((c) => {
          const active = c.contact?.uid === activeContactUid;
          const preview =
            (c.lastMessageSender === me.uid ? 'You: ' : '') + (c.lastMessage || '');
          return (
            <div
              key={c.id}
              onClick={() => onSelectContact(c.contact)}
              className={`group relative w-full flex items-center gap-3 px-3 py-3 border-b border-gray-50 text-left cursor-pointer ${
                active ? 'bg-wa-panel' : 'hover:bg-gray-50'
              }`}
            >
              <Avatar
                name={c.contact?.displayName}
                photoURL={c.contact?.photoURL}
                size={48}
                online={onlineUids.has(c.contact?.uid)}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900 truncate">
                    {c.contact?.displayName || 'Unknown'}
                  </span>
                  <span className="text-xs text-gray-400 shrink-0 ml-2">
                    {formatDayLabel(c.lastMessageAt)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500 truncate">{preview}</span>
                  {c.unreadCount > 0 && (
                    <span className="ml-2 shrink-0 bg-wa-green text-white text-xs font-semibold rounded-full min-w-5 h-5 px-1.5 flex items-center justify-center">
                      {c.unreadCount}
                    </span>
                  )}
                </div>
              </div>

              {/* Conversation options menu */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuFor(menuFor === c.id ? null : c.id);
                }}
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-700 w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-200"
                title="Chat options"
              >
                ⋮
              </button>
              {menuFor === c.id && (
                <div
                  ref={menuRef}
                  onClick={(e) => e.stopPropagation()}
                  className="absolute z-20 top-9 right-2 bg-white shadow-lg rounded-md border border-gray-100 text-xs w-48 py-1"
                >
                  <button
                    onClick={() => {
                      onClearConversation(c, 'me');
                      setMenuFor(null);
                    }}
                    className="block w-full text-left px-3 py-2 hover:bg-gray-50"
                  >
                    🧹 Clear chat (for me)
                  </button>
                  <button
                    onClick={() => {
                      if (
                        window.confirm(
                          'Delete this chat for BOTH you and ' +
                            (c.contact?.displayName || 'the contact') +
                            '? This cannot be undone.'
                        )
                      ) {
                        onClearConversation(c, 'all');
                      }
                      setMenuFor(null);
                    }}
                    className="block w-full text-left px-3 py-2 hover:bg-gray-50 text-red-600"
                  >
                    🗑 Clear for everyone
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
