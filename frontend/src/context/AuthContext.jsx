import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        const idToken = await fbUser.getIdToken();
        setUser({
          uid: fbUser.uid,
          displayName: fbUser.displayName || fbUser.email,
          email: fbUser.email,
          photoURL: fbUser.photoURL,
        });
        setToken(idToken);
      } else {
        setUser(null);
        setToken(null);
      }
      setLoading(false);
    });
  }, []);

  // Firebase ID tokens expire after ~1h; refresh proactively every 30 min.
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(async () => {
      if (auth.currentUser) setToken(await auth.currentUser.getIdToken(true));
    }, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, token, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
