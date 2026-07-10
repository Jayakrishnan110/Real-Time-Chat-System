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

export const auth = admin.auth();
export const db = admin.firestore();
export const FieldValue = admin.firestore.FieldValue;
export const Timestamp = admin.firestore.Timestamp;
export default admin;
