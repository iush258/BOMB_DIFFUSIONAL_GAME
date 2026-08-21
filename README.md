# Bomb Defusal Challenge

A two-screen React and Firebase game for an event:

- `/admin` — host/control-room screen for creating rounds, viewing progress, forcing outcomes, and viewing the leaderboard.
- `/bomb` — mobile screen for joining a round, answering questions, entering a PIN, playing event audio, and showing the bomb outcome.

## Features

- Real-time round synchronization with Firebase Realtime Database
- Unique join code for every new round; old round data is cleared on the bomb screen
- Question and/or PIN defuse modes
- Timer, strike limit, leaderboard, vibration, fullscreen support, and admin overrides
- Supplied MP3 recordings for bomb arm, explosion, and defuse events, plus timer beeps and strike buzzer

## Requirements

- Node.js 18 or newer
- npm
- A Firebase project with **Realtime Database** enabled for multi-device use

## Run locally

1. Install packages:

   ```bash
   npm install
   ```

2. Create your local environment file:

   ```bash
   cp .env.example .env.local
   ```

3. In the Firebase console, create or select a project, add a **Web app**, enable **Realtime Database**, then copy its configuration into `.env.local`:

   ```env
   VITE_FIREBASE_API_KEY=your_api_key_here
   VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
   VITE_FIREBASE_DATABASE_URL=https://your_project_id-default-rtdb.firebaseio.com
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=123456789012
   VITE_FIREBASE_APP_ID=1:123456789012:web:abcdef123456
   ```

4. Start Vite:

   ```bash
   npm run dev
   ```

5. Open `http://localhost:5173/admin` on the host computer. For a phone on the same Wi-Fi, open the **Network** address printed by Vite, followed by `/bomb`, for example `http://192.168.1.105:5173/bomb`.

> Without Firebase configuration, the project only uses the browser-local fallback. It is useful for same-browser testing, but it does not reliably synchronize different devices. Use Firebase for the event and for any live deployment.

## Test checklist

1. On `/admin`, create a round and note the join code.
2. On `/bomb`, enter the code and start the bomb.
3. Confirm the arm sound and timer beeps play after interacting with the phone screen.
4. Test a wrong answer, a final wrong answer/timeout, and a correct final answer or PIN.
5. Confirm arm, buzzer, explosion, and defuse sounds, the admin state, and leaderboard all update as expected.

## Build for production

```bash
npm run build
```

The deployable static site is created in `dist/`.

## Push to GitHub

Before pushing, confirm `.env.local` is not included. It is already ignored by `.gitignore`.

1. Create a new **empty** repository on GitHub. Do not add a README, `.gitignore`, or license on GitHub because this project already has them.

2. In this project directory, run:

   ```bash
   git init
   git add .
   git commit -m "Initial bomb defusal challenge"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPOSITORY.git
   git push -u origin main
   ```

3. Verify on GitHub that `.env.local` is not present. If it was ever committed, remove it from Git history and replace the Firebase API key before deploying.

For future updates:

```bash
git add .
git commit -m "Describe your change"
git push
```

## Deploy with Vercel (recommended)

1. Push the repository to GitHub.
2. Sign in to [Vercel](https://vercel.com), select **Add New → Project**, and import the repository.
3. Vercel should detect **Vite**. Confirm:
   - Build command: `npm run build`
   - Output directory: `dist`
4. In **Project Settings → Environment Variables**, add every `VITE_FIREBASE_*` variable from `.env.local`. Add them to the Production environment (and Preview too, if you want preview deployments to use Firebase).
5. Click **Deploy**.
6. Use the deployed URL with:
   - `https://your-project.vercel.app/admin`
   - `https://your-project.vercel.app/bomb`

Every push to `main` will create a new production deployment when the GitHub integration is connected.

## Deploy with Firebase Hosting

Firebase Hosting is also a good choice because this project already uses Firebase.

```bash
npm install -g firebase-tools
firebase login
firebase init hosting
```

During initialization:

- Choose the same Firebase project used in `.env.local`.
- Set the public directory to `dist`.
- Select **Yes** for single-page app rewriting.
- Do not overwrite `dist/index.html`.

Then deploy:

```bash
npm run build
firebase deploy --only hosting
```

Firebase will print the live Hosting URL. Add `/admin` or `/bomb` to open the relevant screen.

## Firebase security note

The event app writes round state directly from the browser. Restrict Realtime Database access before sharing the project publicly or using it after the event. Temporary open rules are only appropriate for a short, supervised event:

```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

For a public or long-running app, add Firebase Authentication and rules that allow only authorized hosts to create or control sessions.

## Project structure

```text
src/
├── components/
│   ├── AdminScreen.jsx
│   └── BombScreen.jsx
├── utils/audioSynth.js
├── firebase.js
├── App.jsx
└── main.jsx
public/audio/
├── arm.mp3
├── explosion.mp3
└── defuse.mp3
```
