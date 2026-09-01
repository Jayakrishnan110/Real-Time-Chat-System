import { auth, db, FieldValue } from './firebase.js';

// Verify a Firebase ID token and return a normalized user object.
export async function verifyToken(idToken) {
  const decoded = await auth.verifyIdToken(idToken);
  return {
    uid: decoded.uid,
    email: decoded.email || null,
    displayName: decoded.name || decoded.email || 'Anonymous',
    photoURL: decoded.picture || null,
  };
}

// Upsert the user profile into Firestore so the chat list can show everyone.
export async function upsertUser(user) {
  await db.collection('users').doc(user.uid).set(
    {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      lastSeen: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

// Express middleware: expects "Authorization: Bearer <idToken>".
export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Missing auth token' });
    req.user = await verifyToken(token);
    next();
  } catch (err) {
    // Log the real reason (wrong project, malformed key, expired token) —
    // the client only ever sees the generic message.
    console.error(`requireAuth failed [${err.code || 'no-code'}]: ${err.message}`);
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Socket.IO middleware: token passed via handshake.auth.token.
export async function socketAuth(socket, next) {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Missing auth token'));
    const user = await verifyToken(token);
    await upsertUser(user);
    socket.user = user;
    next();
  } catch (err) {
    // Without this the socket just retries forever and the UI is stuck on
    // "Reconnecting…" with no indication of why the handshake was refused.
    console.error(`socketAuth failed [${err.code || 'no-code'}]: ${err.message}`);
    next(new Error('Invalid or expired token'));
  }
}
