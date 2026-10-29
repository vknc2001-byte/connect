# 🔥 FireChat - Real-Time Chat Web Application

A full-featured real-time chat web application built with **Node.js**, **Express**, and **Firebase** (Firebase Authentication, Cloud Firestore, and Cloud Storage).

---

## ✨ Features

1. **Firebase Authentication (Gmail / Google Sign-In)**:
   - One-click Google Sign-In popup using Firebase Auth.
   - Profile detection (Display Name, Gmail, Profile Picture).
   - Real-time online/offline presence tracking.

2. **Registered Users Discovery & 1-on-1 Chat**:
   - Dynamic real-time list of all registered users from Firestore.
   - Search bar to find users by name or email.
   - Click any registered user to initiate a private direct chat.
   - Message history with timestamps, date dividers, and delivery indicators.

3. **Images & Videos Upload & Sharing**:
   - Integrated media picker supporting both photos (`.jpg`, `.png`, `.gif`, `.webp`) and videos (`.mp4`, `.webm`, `.mov`).
   - Pre-send preview thumbnail and optional caption input.
   - Real-time animated upload progress bar powered by Firebase Storage resumable upload.
   - High-quality image viewer with zoom lightbox and embedded responsive HTML5 video players.

4. **Modern UI & Responsive Design**:
   - Dark theme designed with modern styling, glassmorphism, and responsive mobile layout.
   - In-app Firebase Configuration Modal for instant setup without touching code.

---

## 🚀 Quick Start Guide

### Step 1: Install Dependencies
Open your terminal in this directory (`E:\New folder`):
```bash
npm install
```

### Step 2: Start the Node.js Server
```bash
npm start
```
The server will start on: **`http://localhost:3000`**

---

## ⚙️ Firebase Setup (One-time, 3 minutes)

If you already have a Firebase project, copy your Web App configuration keys. If not, follow these quick steps:

### 1. Create a Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/) and click **Add project**.
2. Give your project a name (e.g. `firechat-app`) and complete the creation steps.

### 2. Enable Google Authentication
1. In your Firebase Console, navigate to **Build** &rarr; **Authentication**.
2. Click **Get Started**.
3. Under the **Sign-in method** tab, click **Google**.
4. Enable the toggle, choose your project support email, and click **Save**.
5. Under the **Settings** tab &rarr; **Authorized domains**, make sure `localhost` is listed.

### 3. Enable Cloud Firestore (Database)
1. In the sidebar, navigate to **Build** &rarr; **Firestore Database**.
2. Click **Create database**, choose a location (e.g., `nam5 (us-central)` or nearest to you).
3. Start in **Test mode** (or apply the rules below in the **Rules** tab):
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null;
    }
    match /chats/{chatId} {
      allow read, write: if request.auth != null;
      match /messages/{messageId} {
        allow read, write: if request.auth != null;
      }
    }
  }
}
```

### 4. Enable Cloud Storage (For Photos & Videos)
1. In the sidebar, navigate to **Build** &rarr; **Storage**.
2. Click **Get Started**, choose default settings.
3. In the **Rules** tab, allow authenticated read and write:
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /chats/{chatId}/{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### 5. Get Your Web App Keys
1. In the Firebase Console, click the **Gear icon (⚙️)** next to Project Overview &rarr; **Project settings**.
2. Scroll down to **Your apps**, click the Web icon `(</>)`.
3. Enter an app nickname (e.g. `Web Chat`) and click **Register app**.
4. Copy the `firebaseConfig` object shown on screen:
```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "your-app.firebaseapp.com",
  projectId: "your-app",
  storageBucket: "your-app.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456:web:abcdef"
};
```

---

## 🔑 Applying Your Firebase Config

You have **two easy ways** to apply your configuration:

### Method A: Directly in the Browser (Recommended & Fastest!)
1. Start the app (`npm start`) and open `http://localhost:3000`.
2. Click the orange **"Configure Firebase Keys"** button.
3. Paste the entire `const firebaseConfig = { ... }` block into the paste box and click **Auto-Fill Fields**, then **Save & Apply**.
4. The page will reload and connect automatically!

### Method B: In `.env` file
Open the `.env` file in the project folder and fill in your keys:
```env
PORT=3000
FIREBASE_API_KEY=AIzaSy...
FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
FIREBASE_MESSAGING_SENDER_ID=123456789
FIREBASE_APP_ID=1:123456789:web:abcdef
```
Then restart the server (`npm start`).

---

## 👥 How to Test Chatting Between 2 Users

1. Open `http://localhost:3000` in your main browser (e.g., Chrome).
2. Sign in with your primary Google account.
3. Open an **Incognito / Private Window** (or a second browser like Edge or Firefox) and navigate to `http://localhost:3000`.
4. Sign in with a second Google account.
5. In both windows, you will see each other in the **Registered Users** sidebar list.
6. Click the user name to open the chat window, type messages, and upload images or videos using the paperclip attachment button!

---

## 📁 Project Structure

```text
├── .env                  # Environment variables for Firebase config
├── .env.example          # Example environment variable template
├── package.json          # Node dependencies and npm scripts
├── server.js             # Express web server & config API
├── README.md             # Documentation and instructions
└── public/               # Frontend assets
    ├── index.html        # Main application HTML
    ├── css/
    │   └── style.css     # Clean modern responsive styling
    └── js/
        ├── firebase-config.js # Config management (localStorage & .env)
        └── app.js        # Authentication, real-time Firestore chat & Storage uploads
```
