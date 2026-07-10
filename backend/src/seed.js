// Seed two default demo users so you can immediately sign in as two people
// and chat. Creates them in Firebase Auth AND writes their Firestore profile
// docs (so they show up in each other's "New chat" list right away).
//
// Run:  npm run seed   (from the backend folder)
import { auth, db, FieldValue } from './firebase.js';

const DEMO_USERS = [
  { email: 'alice@rtc.test', password: 'password123', displayName: 'Alice' },
  { email: 'bob@rtc.test', password: 'password123', displayName: 'Bob' },
];

async function ensureUser({ email, password, displayName }) {
  let userRecord;
  try {
    userRecord = await auth.createUser({ email, password, displayName });
    console.log(`created  ${displayName} <${email}>`);
  } catch (err) {
    if (err.code === 'auth/email-already-exists') {
      userRecord = await auth.getUserByEmail(email);
      // Reset the password so the known demo credentials always work.
      await auth.updateUser(userRecord.uid, { password, displayName });
      console.log(`updated  ${displayName} <${email}>`);
    } else {
      throw err;
    }
  }

  // Mirror the profile into Firestore's users collection.
  await db.collection('users').doc(userRecord.uid).set(
    {
      uid: userRecord.uid,
      email,
      displayName,
      photoURL: null,
      lastSeen: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return userRecord.uid;
}

async function main() {
  console.log('Seeding demo users…\n');
  for (const u of DEMO_USERS) {
    await ensureUser(u);
  }
  console.log('\nDone. You can now log in with:');
  DEMO_USERS.forEach((u) =>
    console.log(`  ${u.email}  /  ${u.password}   (${u.displayName})`)
  );
  process.exit(0);
}

main().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
