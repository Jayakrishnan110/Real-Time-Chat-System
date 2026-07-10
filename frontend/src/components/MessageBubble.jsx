import { useEffect, useRef, useState } from 'react';
import { formatTime } from '../utils/format.js';

// A single message bubble. Mine = right/green, theirs = left/white.
// A 3-dot menu sits beside the bubble (left of my messages, right of theirs)
// and reveals on hover: Edit / Delete for everyone (own) + Delete for me (any).
// Deleted messages render as a tombstone.
export default function MessageBubble({ message, mine, onEdit, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const menuRef = useRef(null);

  const deleted = message.deletedForEveryone;

  // Close the menu when clicking outside it.
  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen]);

  const saveEdit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== message.content) onEdit(message, trimmed);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className={`flex ${mine ? 'justify-end' : 'justify-start'} px-2`}>
        <div className="max-w-[75%] bg-white rounded-lg px-2 py-2 shadow">
          <textarea
            autoFocus
            rows={2}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                saveEdit();
              }
              if (e.key === 'Escape') {
                setEditing(false);
                setDraft(message.content);
              }
            }}
            className="w-56 text-sm border border-gray-200 rounded p-1 focus:outline-none focus:ring-1 focus:ring-wa-green"
          />
          <div className="flex justify-end gap-3 mt-1 text-xs">
            <button
              onClick={() => {
                setEditing(false);
                setDraft(message.content);
              }}
              className="text-gray-500"
            >
              Cancel
            </button>
            <button onClick={saveEdit} className="text-wa-green font-semibold">
              Save
            </button>
          </div>
        </div>
      </div>
    );
  }

  // The 3-dot trigger + dropdown, rendered on whichever side of the bubble.
  // `align` controls which edge the dropdown opens from so it stays on-screen.
  const Menu = () => (
    <div className="relative shrink-0 self-center">
      <button
        onClick={() => setMenuOpen((v) => !v)}
        className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-700 w-6 h-6 flex items-center justify-center rounded-full hover:bg-black/5 transition"
        title="Message options"
      >
        ⋮
      </button>
      {menuOpen && (
        <div
          ref={menuRef}
          className={`absolute z-20 top-7 ${mine ? 'right-0' : 'left-0'} bg-white shadow-lg rounded-md border border-gray-100 text-xs w-48 py-1`}
        >
          {mine && !deleted && (
            <button
              onClick={() => {
                setEditing(true);
                setMenuOpen(false);
              }}
              className="block w-full text-left px-3 py-2 hover:bg-gray-50"
            >
              ✏️ Edit
            </button>
          )}
          {mine && !deleted && (
            <button
              onClick={() => {
                onDelete(message, 'all');
                setMenuOpen(false);
              }}
              className="block w-full text-left px-3 py-2 hover:bg-gray-50 text-red-600"
            >
              🗑 Delete for everyone
            </button>
          )}
          <button
            onClick={() => {
              onDelete(message, 'me');
              setMenuOpen(false);
            }}
            className="block w-full text-left px-3 py-2 hover:bg-gray-50"
          >
            🙈 Delete for me
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div
      className={`group flex items-center gap-1 px-2 ${
        mine ? 'justify-end' : 'justify-start'
      }`}
    >
      {/* My messages: menu on the LEFT of the bubble. */}
      {mine && <Menu />}

      <div
        className={`relative max-w-[75%] rounded-lg px-3 py-1.5 shadow-sm text-sm ${
          mine ? 'bg-wa-bubble' : 'bg-white'
        }`}
      >
        {deleted ? (
          <p className="italic text-gray-400 pr-14">🚫 This message was deleted</p>
        ) : (
          <p className="whitespace-pre-wrap break-words text-gray-800 pr-16">
            {message.content}
          </p>
        )}
        <span className="absolute bottom-1 right-2 flex items-center gap-1 text-[10px] text-gray-400">
          {message.edited && !deleted && <span className="italic">edited</span>}
          {formatTime(message.createdAt)}
          {mine && !deleted && <Ticks status={message.status} />}
        </span>
      </div>

      {/* Their messages: menu on the RIGHT of the bubble. */}
      {!mine && <Menu />}
    </div>
  );
}

function Ticks({ status }) {
  // sent = single grey, delivered = double grey, read = double blue.
  if (status === 'read') return <span className="text-blue-500">✓✓</span>;
  if (status === 'delivered') return <span>✓✓</span>;
  return <span>✓</span>;
}
