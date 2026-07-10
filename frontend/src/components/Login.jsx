import { useState } from 'react';
import {
  loginWithGoogle,
  loginWithEmail,
  registerWithEmail,
} from '../firebase.js';
import { DEMO_USERS } from '../demoUsers.js';

export default function Login() {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'login') {
        await loginWithEmail(email, password);
      } else {
        await registerWithEmail(email, password, name);
      }
    } catch (err) {
      setError(err.message.replace('Firebase: ', ''));
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setError('');
    try {
      await loginWithGoogle();
    } catch (err) {
      setError(err.message.replace('Firebase: ', ''));
    }
  };

  const quickLogin = async (demo) => {
    setError('');
    setBusy(true);
    try {
      await loginWithEmail(demo.email, demo.password);
    } catch (err) {
      // Most common cause: the seed script hasn't been run yet.
      const msg = err.message.replace('Firebase: ', '');
      setError(
        /user-not-found|invalid-credential/.test(err.code || '')
          ? 'Demo user not found. Run "npm run seed" in the backend folder first.'
          : msg
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-wa-panel">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-full bg-wa-green text-white flex items-center justify-center text-xl">
            💬
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">RTC Chat</h1>
            <p className="text-sm text-gray-500">Real-time messaging</p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-3">
          {mode === 'register' && (
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-wa-green"
              placeholder="Display name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          )}
          <input
            type="email"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-wa-green"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-wa-green"
            placeholder="Password (min 6 chars)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full bg-wa-green hover:bg-wa-darkgreen text-white font-semibold py-2 rounded-lg transition disabled:opacity-60"
          >
            {busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}
          </button>
        </form>

        <div className="flex items-center gap-3 my-4">
          <div className="h-px bg-gray-200 flex-1" />
          <span className="text-xs text-gray-400">OR</span>
          <div className="h-px bg-gray-200 flex-1" />
        </div>

        <button
          onClick={google}
          className="w-full border border-gray-300 hover:bg-gray-50 py-2 rounded-lg font-medium text-gray-700 flex items-center justify-center gap-2 transition"
        >
          <span className="text-lg">🔵</span> Continue with Google
        </button>

        {/* One-click demo logins (accounts created by backend `npm run seed`). */}
        <div className="mt-4">
          <p className="text-xs text-gray-400 text-center mb-2">Quick demo login</p>
          <div className="grid grid-cols-2 gap-2">
            {DEMO_USERS.map((demo) => (
              <button
                key={demo.email}
                onClick={() => quickLogin(demo)}
                disabled={busy}
                className="border border-wa-green text-wa-green hover:bg-wa-green hover:text-white py-2 rounded-lg text-sm font-medium transition disabled:opacity-60"
              >
                Login as {demo.label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-gray-400 text-center mt-2">
            Open the second user in a different browser / incognito window.
          </p>
        </div>

        <p className="text-center text-sm text-gray-500 mt-5">
          {mode === 'login' ? "Don't have an account?" : 'Already registered?'}{' '}
          <button
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setError('');
            }}
            className="text-wa-green font-semibold hover:underline"
          >
            {mode === 'login' ? 'Sign up' : 'Log in'}
          </button>
        </p>
      </div>
    </div>
  );
}
