# RTC — Real-Time Chat System

A WhatsApp-style real-time chat app.

- **Frontend:** React (Vite) + Tailwind CSS
- **Backend:** Node.js + Express + Socket.IO
- **Auth:** Firebase Authentication (Google + Email/Password)
- **Database:** Cloud Firestore

## Features

| Requirement | Where |
|---|---|
| Real-time messages (WebSocket) | Socket.IO `message:send` / `message:new` |
| Auto-scroll to latest message | `ChatWindow.jsx` |
| Input box for sending | `MessageInput.jsx` |
| Typing indicator ("User is typing…") | `typing` socket event + `TypingIndicator.jsx` |
| Chat list with last message + timestamp | `ChatList.jsx` (`/api/conversations`) |
| In-app toast notifications | `ToastContext.jsx` |
| Send / receive / retrieve message APIs | `routes.js` + socket handlers |
| Chat history (sender, receiver, content, timestamp, status) | `chatService.js` → Firestore |
| Pagination / lazy loading of older messages | `?before=` cursor + scroll-to-top loader |
| Token validation on WebSocket connections | `socketAuth` middleware |

```
d:\RTC
├── backend/          Node + Socket.IO + Firebase Admin
├── frontend/         React + Vite + Tailwind
├── firestore/        Security rules & indexes
└── README.md
```

---

## 1. Firebase / Firestore setup

You said you already have a Firebase account. Do the following **once** in the
[Firebase Console](https://console.firebase.google.com/):

### 1.1 Create / pick a project
Create a project (or reuse one). Note the **Project ID**.

### 1.2 Enable Authentication
- Go to **Build → Authentication → Get started**.
- Enable **Email/Password**.
- Enable **Google** (pick a support email).
- Under **Settings → Authorized domains**, make sure `localhost` is listed
  (it is by default).

### 1.3 Create the Firestore database
- Go to **Build → Firestore Database → Create database**.
- Start in **production mode** (rules below lock it down anyway).
- Pick a region close to you.

You do **not** need to manually create collections — the backend creates
`users`, `conversations`, and `conversations/{id}/messages` automatically on
first use.

### 1.4 Deploy security rules & indexes (recommended)
The app talks to Firestore only through the backend Admin SDK, so these rules
mainly block stray direct client access.

```bash
npm install -g firebase-tools
cd firestore
firebase login
firebase use <your-project-id>
firebase deploy --only firestore:rules,firestore:indexes
```

> The two composite indexes are required (conversation ordering + unread
> counting). If you skip the CLI, Firestore will print a "create index" link in
> the backend console the first time a query runs — click it once.

---

## 2. Credentials you need to provide

### 2.1 Backend — service account (Admin SDK)
Firebase Console → **⚙ Project Settings → Service accounts → Generate new
private key**. This downloads a JSON file. Copy `backend/.env.example` to
`backend/.env` and fill in:

```env
PORT=4000
CLIENT_ORIGIN=http://localhost:5173

FIREBASE_PROJECT_ID=<project_id from the JSON>
FIREBASE_CLIENT_EMAIL=<client_email from the JSON>
FIREBASE_PRIVATE_KEY="<private_key from the JSON — keep the \n escapes, wrap in quotes>"
```

> Alternatively, put the downloaded JSON at `backend/serviceAccountKey.json` and
> set `GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json` instead of the
> three vars above.

### 2.2 Frontend — web app config
Firebase Console → **Project Settings → General → Your apps → Web app (`</>`)**.
Register a web app if you haven't, then copy the config values. Copy
`frontend/.env.example` to `frontend/.env` and fill in:

```env
VITE_SERVER_URL=http://localhost:4000
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=<project-id>.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=<project-id>
VITE_FIREBASE_STORAGE_BUCKET=<project-id>.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

**Summary of what you must supply:**

| # | Value | From |
|---|---|---|
| 1 | Service account `project_id`, `client_email`, `private_key` | Project Settings → Service accounts |
| 2 | Web app `apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId` | Project Settings → General → Web app |

---

## 3. Run it

Open two terminals.

**Backend**
```bash
cd backend
npm install
npm run dev      # → http://localhost:4000
```

**Frontend**
```bash
cd frontend
npm install
npm run dev      # → http://localhost:5173
```

Open http://localhost:5173, sign up (or Google sign-in) in two different
browsers / profiles, and start chatting. New users appear in each other's
"New chat" (✏️) picker once they've signed in at least once.

---

## 4. Data model (Firestore)

```
users/{uid}
  uid, email, displayName, photoURL, lastSeen

conversations/{convId}            convId = sorted("uidA_uidB")
  participants: [uidA, uidB]
  lastMessage, lastMessageSender, lastMessageAt, createdAt

conversations/{convId}/messages/{messageId}
  id, conversationId, senderUid, receiverUid,
  content, status ("sent" | "delivered" | "read"), createdAt
```

## 5. Real-time protocol (Socket.IO)

Client connects with `auth: { token: <Firebase ID token> }`; the backend
verifies it with the Admin SDK before accepting the connection.

| Event | Direction | Payload |
|---|---|---|
| `message:send` | client → server | `{ receiverUid, content }` (ack returns saved message) |
| `message:new` | server → clients | the saved message |
| `typing` | both ways | `{ receiverUid / conversationId, isTyping }` |
| `message:read` | both ways | `{ conversationId, messageIds }` |
| `presence:online` / `presence:offline` | server → clients | `{ uid }` |

## 6. REST API

All require `Authorization: Bearer <Firebase ID token>`.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/users` | list other users (start new chats) |
| GET | `/api/conversations` | my conversations + previews + unread counts |
| GET | `/api/conversations/:id/messages?limit=20&before=<ms>` | paginated history |
| GET | `/api/conversations/with/:uid` | derive a conversation id |
```
# Real-Time-Chat-System
