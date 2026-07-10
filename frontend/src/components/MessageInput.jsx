import { useRef, useState } from 'react';

export default function MessageInput({ onSend, onTyping }) {
  const [text, setText] = useState('');
  const typingTimeout = useRef(null);

  const emitTyping = () => {
    onTyping(true);
    clearTimeout(typingTimeout.current);
    // Auto-clear the typing state 1.5s after the last keystroke.
    typingTimeout.current = setTimeout(() => onTyping(false), 1500);
  };

  const send = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText('');
    clearTimeout(typingTimeout.current);
    onTyping(false);
  };

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-wa-panel">
      <input
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          emitTyping();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            send();
          }
        }}
        placeholder="Type a message"
        className="flex-1 rounded-full px-4 py-2 bg-white focus:outline-none text-sm"
      />
      <button
        onClick={send}
        disabled={!text.trim()}
        className="w-10 h-10 rounded-full bg-wa-green hover:bg-wa-darkgreen text-white flex items-center justify-center disabled:opacity-50 transition"
        title="Send"
      >
        ➤
      </button>
    </div>
  );
}
