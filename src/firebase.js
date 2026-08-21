import { initializeApp, getApps } from 'firebase/app';
import { getDatabase, ref, set, get, onValue, push, remove } from 'firebase/database';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || ""
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.databaseURL && 
  firebaseConfig.databaseURL !== "https://your_project_id-default-rtdb.firebaseio.com" &&
  firebaseConfig.apiKey &&
  firebaseConfig.apiKey !== "your_api_key_here"
);

let app = null;
let db = null;

if (isFirebaseConfigured) {
  try {
    app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
    db = getDatabase(app);
    console.log("🔥 Firebase Realtime Database initialized successfully!");
  } catch (err) {
    console.error("Firebase initialization failed:", err);
  }
} else {
  console.warn("⚠️ Firebase configuration keys are missing in .env.local.");
}

const broadcastChannel = typeof window !== 'undefined' && 'BroadcastChannel' in window
  ? new BroadcastChannel('bomb_defusal_channel')
  : null;

const localListeners = new Map();

if (broadcastChannel) {
  broadcastChannel.onmessage = (event) => {
    const { path, data } = event.data;
    if (path && localListeners.has(path)) {
      localListeners.get(path).forEach(cb => cb(data));
    }
  };
}

export function subscribeToPath(path, callback) {
  if (db && isFirebaseConfigured) {
    const dbRef = ref(db, path);
    const unsubscribe = onValue(dbRef, (snapshot) => {
      callback(snapshot.val());
    }, (err) => {
      console.error(`Error subscribing to path ${path}:`, err);
    });
    return () => unsubscribe();
  } else {
    if (!localListeners.has(path)) {
      localListeners.set(path, new Set());
    }
    localListeners.get(path).add(callback);

    try {
      const item = localStorage.getItem(`local_db_${path}`);
      callback(item ? JSON.parse(item) : null);
    } catch (e) {
      callback(null);
    }

    return () => {
      if (localListeners.has(path)) {
        localListeners.get(path).delete(callback);
      }
    };
  }
}

export async function writeData(path, value) {
  if (db && isFirebaseConfigured) {
    const dbRef = ref(db, path);
    await set(dbRef, value);
  } else {
    try {
      const parts = path.split('/');
      const rootPath = parts[0];

      if (parts.length === 1) {
        localStorage.setItem(`local_db_${path}`, JSON.stringify(value));
        if (localListeners.has(path)) {
          localListeners.get(path).forEach(cb => cb(value));
        }
        if (broadcastChannel) {
          broadcastChannel.postMessage({ path, data: value });
        }
      } else {
        const existingRoot = localStorage.getItem(`local_db_${rootPath}`);
        let rootObj = existingRoot ? JSON.parse(existingRoot) : {};
        if (rootObj && typeof rootObj === 'object') {
          let current = rootObj;
          for (let i = 1; i < parts.length - 1; i++) {
            if (!current[parts[i]]) current[parts[i]] = {};
            current = current[parts[i]];
          }
          current[parts[parts.length - 1]] = value;
          localStorage.setItem(`local_db_${rootPath}`, JSON.stringify(rootObj));
          if (localListeners.has(rootPath)) {
            localListeners.get(rootPath).forEach(cb => cb(rootObj));
          }
          if (broadcastChannel) {
            broadcastChannel.postMessage({ path: rootPath, data: rootObj });
          }
        }
      }
    } catch (e) {
      console.error("LocalStorage write error:", e);
    }
  }
}

export async function pushData(path, value) {
  if (db && isFirebaseConfigured) {
    const listRef = ref(db, path);
    const newRef = push(listRef);
    await set(newRef, value);
    return newRef.key;
  } else {
    try {
      const existing = localStorage.getItem(`local_db_${path}`);
      const list = existing ? JSON.parse(existing) : [];
      const newItem = { id: Date.now().toString(), ...value };
      list.push(newItem);
      localStorage.setItem(`local_db_${path}`, JSON.stringify(list));
      if (localListeners.has(path)) {
        localListeners.get(path).forEach(cb => cb(list));
      }
      if (broadcastChannel) {
        broadcastChannel.postMessage({ path, data: list });
      }
      return newItem.id;
    } catch (e) {
      console.error("LocalStorage push error:", e);
    }
  }
}

export async function readDataOnce(path) {
  if (db && isFirebaseConfigured) {
    const dbRef = ref(db, path);
    const snapshot = await get(dbRef);
    return snapshot.val();
  } else {
    try {
      const parts = path.split('/');
      const rootPath = parts[0];
      const item = localStorage.getItem(`local_db_${rootPath}`);
      if (!item) return null;
      let current = JSON.parse(item);
      for (let i = 1; i < parts.length; i++) {
        if (current && typeof current === 'object' && parts[i] in current) {
          current = current[parts[i]];
        } else {
          return null;
        }
      }
      return current;
    } catch (e) {
      return null;
    }
  }
}
