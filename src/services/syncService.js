import { getApps, initializeApp } from 'firebase/app';
import { getDatabase, onValue, ref, remove, set } from 'firebase/database';
import {
  compressToEncodedURIComponent,
  decompressFromEncodedURIComponent,
} from 'lz-string';

const LOCAL_ROOM_PREFIX = 'timescheduling_room_';
const HASH_PREFIX = '#data=';

function getFirebaseConfig() {
  const databaseURL = import.meta.env.VITE_FIREBASE_DATABASE_URL?.trim();
  if (!databaseURL) return null;

  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY?.trim() || undefined,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN?.trim() || undefined,
    databaseURL,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim() || undefined,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET?.trim() || undefined,
    messagingSenderId:
      import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID?.trim() || undefined,
    appId: import.meta.env.VITE_FIREBASE_APP_ID?.trim() || undefined,
  };
}

let cachedDb = null;

function getFirebaseDatabase() {
  if (cachedDb) return cachedDb;
  const config = getFirebaseConfig();
  if (!config) return null;

  const app = getApps().length > 0 ? getApps()[0] : initializeApp(config);
  cachedDb = getDatabase(app, config.databaseURL);
  return cachedDb;
}

export function getSyncMode() {
  return getFirebaseConfig() ? 'firebase' : 'local';
}

function normalizeUserRecord(id, raw) {
  if (!raw || typeof raw !== 'object') return null;
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  const color = typeof raw.color === 'string' && raw.color ? raw.color : '#10B981';
  const rawSlots = Array.isArray(raw.slots)
    ? raw.slots
    : raw.slots && typeof raw.slots === 'object'
      ? Object.values(raw.slots)
      : [];

  return {
    id: raw.id || id,
    name,
    color,
    slots: Array.from(new Set(rawSlots.filter((s) => typeof s === 'string'))),
    updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : 0,
  };
}

function normalizeUsersMap(rawMap) {
  if (!rawMap || typeof rawMap !== 'object') return {};
  const normalized = {};
  for (const [id, entry] of Object.entries(rawMap)) {
    const user = normalizeUserRecord(id, entry);
    if (user && user.name && user.slots.length > 0) {
      normalized[user.id] = user;
    }
  }
  return normalized;
}

function getLocalStorageKey(roomId) {
  return `${LOCAL_ROOM_PREFIX}${roomId}`;
}

function readLocalRoom(roomId) {
  try {
    const raw = localStorage.getItem(getLocalStorageKey(roomId));
    if (!raw) return {};
    return normalizeUsersMap(JSON.parse(raw));
  } catch {
    return {};
  }
}

function writeLocalRoom(roomId, usersMap) {
  try {
    localStorage.setItem(getLocalStorageKey(roomId), JSON.stringify(usersMap));
  } catch {
    // Ignore quota errors cleanly
  }
}

export function encodeRoomToHash(usersMap) {
  try {
    const clean = normalizeUsersMap(usersMap);
    if (Object.keys(clean).length === 0) return '';
    return `${HASH_PREFIX}${compressToEncodedURIComponent(JSON.stringify(clean))}`;
  } catch {
    return '';
  }
}

export function decodeRoomFromHash(hashString = window.location.hash) {
  if (!hashString || !hashString.startsWith(HASH_PREFIX)) return null;
  try {
    const compressed = hashString.slice(HASH_PREFIX.length);
    const json = decompressFromEncodedURIComponent(compressed);
    if (!json) return null;
    return normalizeUsersMap(JSON.parse(json));
  } catch {
    return null;
  }
}

export function mergeUsersIntoLocalRoom(roomId, incomingUsers) {
  if (!incomingUsers || Object.keys(incomingUsers).length === 0) return;
  const existing = readLocalRoom(roomId);
  const merged = { ...existing };

  for (const [id, user] of Object.entries(incomingUsers)) {
    const current = merged[id];
    if (!current || (user.updatedAt || 0) >= (current.updatedAt || 0)) {
      merged[id] = user;
    }
  }

  writeLocalRoom(roomId, merged);
}

function notifyLocalChannel(roomId, usersMap) {
  if (typeof BroadcastChannel === 'undefined') return;
  try {
    const channel = new BroadcastChannel(`timescheduling_${roomId}`);
    channel.postMessage({ type: 'room_update', users: usersMap });
    channel.close();
  } catch {
    // BroadcastChannel unavailable or closed
  }
}

export function subscribeRoom(roomId, onData, onStatus) {
  const mode = getSyncMode();

  if (mode === 'firebase') {
    let db;
    try {
      db = getFirebaseDatabase();
    } catch {
      onStatus('error');
      return () => {};
    }

    if (!db) {
      onStatus('error');
      return () => {};
    }

    onStatus('syncing');
    const roomUsersRef = ref(db, `rooms/${roomId}/users`);
    const connectedRef = ref(db, '.info/connected');

    const unsubConnected = onValue(connectedRef, (snap) => {
      const connected = snap.val() === true;
      onStatus(connected ? 'synced' : 'offline');
    });

    const unsubData = onValue(
      roomUsersRef,
      (snapshot) => {
        const val = snapshot.val();
        onData(normalizeUsersMap(val));
        onStatus('synced');
      },
      () => {
        onStatus('error');
      },
    );

    return () => {
      unsubConnected();
      unsubData();
    };
  }

  // Local + BroadcastChannel + URL Hash fallback
  onData(readLocalRoom(roomId));
  onStatus('synced');

  let channel = null;
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      channel = new BroadcastChannel(`timescheduling_${roomId}`);
      channel.onmessage = (event) => {
        if (event.data?.type === 'room_update') {
          onData(normalizeUsersMap(event.data.users));
        }
      };
    } catch {
      channel = null;
    }
  }

  const handleStorage = (event) => {
    if (event.key === getLocalStorageKey(roomId)) {
      onData(readLocalRoom(roomId));
    }
  };
  window.addEventListener('storage', handleStorage);

  return () => {
    window.removeEventListener('storage', handleStorage);
    if (channel) {
      channel.close();
    }
  };
}

export async function saveUserSchedule(roomId, user) {
  const payload = {
    id: user.id,
    name: user.name.trim(),
    color: user.color,
    slots: Array.from(new Set(user.slots || [])),
    updatedAt: Date.now(),
  };

  if (getSyncMode() === 'firebase') {
    const db = getFirebaseDatabase();
    if (!db) throw new Error('Firebase unavailable');
    await set(ref(db, `rooms/${roomId}/users/${payload.id}`), payload);
    return;
  }

  const current = readLocalRoom(roomId);
  const next = { ...current, [payload.id]: payload };
  writeLocalRoom(roomId, next);
  notifyLocalChannel(roomId, next);
}

export async function removeUserSchedule(roomId, userId) {
  if (getSyncMode() === 'firebase') {
    const db = getFirebaseDatabase();
    if (!db) throw new Error('Firebase unavailable');
    await remove(ref(db, `rooms/${roomId}/users/${userId}`));
    return;
  }

  const current = readLocalRoom(roomId);
  const next = { ...current };
  delete next[userId];
  writeLocalRoom(roomId, next);
  notifyLocalChannel(roomId, next);
}
