import admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config();

// Initialize the Firebase Admin SDK. Two supported credential sources:
//   1. FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY env vars.
//   2. GOOGLE_APPLICATION_CREDENTIALS pointing at a service-account JSON file
//      (admin.credential.applicationDefault() picks it up automatically).
if (!admin.apps.length) {
  const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;

  if (FIREBASE_PROJECT_ID && FIREBASE_CLIENT_EMAIL && FIREBASE_PRIVATE_KEY) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: FIREBASE_PROJECT_ID,
        clientEmail: FIREBASE_CLIENT_EMAIL,
        // In .env the newlines are escaped as \n — turn them back into real newlines.
        privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
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
