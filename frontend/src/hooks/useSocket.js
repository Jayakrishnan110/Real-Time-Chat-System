import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

let RAW_SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000';

// A trailing slash on the base URL produces '//api/...' and breaks Socket.IO's
// path handling, so strip it.
if (RAW_SERVER_URL.endsWith('/')) RAW_SERVER_URL = RAW_SERVER_URL.slice(0, -1);

const SERVER_URL = RAW_SERVER_URL;

if (import.meta.env.PROD && SERVER_URL.includes('localhost')) {
  console.error(
    'VITE_SERVER_URL is not set for this build — the app is trying to reach ' +
      SERVER_URL +
      '. Set it to your deployed backend URL and redeploy (Vite inlines env vars at build time).'
  );
}

// Establish an authenticated socket connection. Reconnects when the token changes.
export function useSocket(token) {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!token) return;

    const socket = io(SERVER_URL, {
      auth: { token },
      // Try WebSocket first but keep HTTP long-polling as a fallback: some
      // hosts and corporate proxies block the WebSocket upgrade, and without
      // a fallback the client would retry forever showing "Reconnecting…".
      transports: ['websocket', 'polling'],
      withCredentials: true,
      // Free hosting tiers sleep when idle and can take ~1 min to wake up.
      timeout: 20000,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    });
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', (err) => {
      console.error(`socket connect_error (${SERVER_URL}):`, err.message);
      setConnected(false);
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token]);

  return { socket: socketRef, connected };
}
