import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  setPersistence,
  browserSessionPersistence,
  signOut,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Use SESSION persistence instead of the default LOCAL persistence: the login
// is cleared when the browser is fully closed, so the next person on a shared
// machine does NOT land in the previous user's session. (Refreshing a tab keeps
// you logged in; closing the whole browser logs you out.)
setPersistence(auth, browserSessionPersistence).catch((err) =>
  console.error('Failed to set auth persistence:', err)
);

const googleProvider = new GoogleAuthProvider();
// Always show the Google account chooser, even if one account is already signed
// in to the browser. This prevents Google from silently reusing an existing
// session and makes account switching explicit on shared computers.
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const loginWithGoogle = () => signInWithPopup(auth, googleProvider);
export const loginWithEmail = (email, password) =>
  signInWithEmailAndPassword(auth, email, password);

export async function registerWithEmail(email, password, displayName) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  if (displayName) await updateProfile(cred.user, { displayName });
  return cred;
}

export const logout = () => signOut(auth);
