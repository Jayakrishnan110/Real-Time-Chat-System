import admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config();

// Initialize the Firebase Admin SDK. Two supported credential sources:
//   1. FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY env vars.
//   2. GOOGLE_APPLICATION_CREDENTIALS pointing at a service-account JSON file
//      (admin.credential.applicationDefault() picks it up automatically).
// A service-account private key gets mangled in several predictable ways as it
// travels through a hosting dashboard. Each of these produces the same opaque
// OpenSSL failure at call time -- 'error:1E08010C:DECODER routines::unsupported'
// -- so normalize them all up front rather than guessing later.
function normalizePrivateKey(raw) {
  if (!raw) return null;
  let key = raw.trim();

  // A .env file lets the shell strip surrounding quotes, but dashboards such as
  // Render store them as literal characters that then corrupt the PEM.
  const isQuoted =
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"));
  if (isQuoted) key = key.slice(1, -1).trim();

  // Escaped newlines back to real ones. Double-escaped first: some UIs escape
  // the value a second time on save.
  key = key.replace(/\\\\n/g, '\n').replace(/\\n/g, '\n');

  // The key may have been base64-encoded to survive transport intact.
  if (!key.includes('-----BEGIN')) {
    const decoded = Buffer.from(key, 'base64').toString('utf8');
    if (decoded.includes('-----BEGIN')) key = decoded.trim();
  }

  // Rebuild the PEM from scratch: strip every whitespace character out of the
  // base64 body and re-wrap it at 64 columns. This repairs the most common
  // corruption of all, where the newlines were flattened into spaces on paste.
  const match = key.match(/-----BEGIN ([A-Z ]+?)-----([\s\S]*?)-----END \1-----/);
  if (!match) return key; // Not a PEM we recognize; let the SDK report it.

  const label = match[1];
  const body = match[2].replace(/\s+/g, '');
  const wrapped = (body.match(/.{1,64}/g) || []).join('\n');
  return `-----BEGIN ${label}-----\n${wrapped}\n-----END ${label}-----\n`;
}

if (!admin.apps.length) {
  const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;
  const privateKey = normalizePrivateKey(FIREBASE_PRIVATE_KEY);

  if (FIREBASE_PROJECT_ID && FIREBASE_CLIENT_EMAIL && privateKey) {
    if (!privateKey.includes('-----BEGIN')) {
      console.error(
        'FIREBASE_PRIVATE_KEY does not look like a PEM key: it should start ' +
          'with -----BEGIN PRIVATE KEY----- . Copy the private_key field from ' +
          'the service-account JSON verbatim, with no surrounding quotes.'
      );
    }
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: FIREBASE_PROJECT_ID,
        clientEmail: FIREBASE_CLIENT_EMAIL,
        privateKey,
      }),
    });
  } else {
    // Falls back to GOOGLE_APPLICATION_CREDENTIALS.
    admin.initializeApp({ credential: admin.credential.applicationDefault() });
  }
}

// Startup diagnostic: which project the Admin SDK actually authenticated as.
// Firebase ID tokens are only valid for the project that minted them, so a
// mismatch here means every verifyIdToken() call will fail at runtime even
// though the server itself starts up fine.
const activeProjectId =
  admin.app().options.projectId ||
  process.env.FIREBASE_PROJECT_ID ||
  process.env.GOOGLE_CLOUD_PROJECT ||
  '(unknown)';
const credentialSource = process.env.FIREBASE_PRIVATE_KEY
  ? 'FIREBASE_* environment variables'
  : 'application default credentials';
console.log(`Firebase Admin initialized for project: ${activeProjectId}`);
console.log(`Credential source: ${credentialSource}`);
if (activeProjectId === '(unknown)') {
  console.error(
    'No Firebase project could be resolved. Set FIREBASE_PROJECT_ID, ' +
      'FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY, or point ' +
      'GOOGLE_APPLICATION_CREDENTIALS at a service-account JSON file. ' +
      'Until then every authenticated request and socket will be rejected.'
  );
}

export const auth = admin.auth();
export const db = admin.firestore();
export const FieldValue = admin.firestore.FieldValue;
export const Timestamp = admin.firestore.Timestamp;
export default admin;
