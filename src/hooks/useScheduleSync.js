import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_USER_COLOR } from '../constants/schedule';
import {
  decodeRoomFromHash,
  encodeRoomToHash,
  getSyncMode,
  mergeUsersIntoLocalRoom,
  removeUserSchedule,
  saveUserSchedule,
  subscribeRoom,
} from '../services/syncService';

const UID_STORAGE_KEY = 'timescheduling_uid';
const PROFILE_STORAGE_KEY = 'timescheduling_profile';

function generateShortId(length = 6) {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  let result = '';
  for (let i = 0; i < length; i += 1) {
    result += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return result;
}

function getOrCreateRoomId() {
  const params = new URLSearchParams(window.location.search);
  const existing = params.get('room')?.trim();
  if (existing && /^[a-zA-Z0-9_-]{2,40}$/.test(existing)) {
    return existing;
  }
  const generated = generateShortId(6);
  params.set('room', generated);
  const nextUrl = `${window.location.pathname}?${params.toString()}${window.location.hash}`;
  window.history.replaceState(null, '', nextUrl);
  return generated;
}

function getOrCreateUserId() {
  try {
    const stored = localStorage.getItem(UID_STORAGE_KEY);
    if (stored) return stored;
    const generated = `u_${generateShortId(10)}`;
    localStorage.setItem(UID_STORAGE_KEY, generated);
    return generated;
  } catch {
    return `u_${generateShortId(10)}`;
  }
}

function readSavedProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        name: typeof parsed.name === 'string' ? parsed.name : '',
        color:
          typeof parsed.color === 'string' && parsed.color
            ? parsed.color
            : DEFAULT_USER_COLOR,
      };
    }
  } catch {
    // Ignore storage read failure
  }
  return { name: '', color: DEFAULT_USER_COLOR };
}

function persistLocalProfile(profile) {
  try {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // Ignore storage write failure
  }
}

export function useScheduleSync() {
  const [roomId] = useState(() => getOrCreateRoomId());
  const [currentUserId] = useState(() => getOrCreateUserId());
  const [profile, setProfile] = useState(() => readSavedProfile());
  const [usersMap, setUsersMap] = useState({});
  const [syncStatus, setSyncStatus] = useState('syncing');
  const syncMode = getSyncMode();
  const profileSyncTimerRef = useRef(null);
  const usersMapRef = useRef(usersMap);
  usersMapRef.current = usersMap;

  useEffect(() => {
    const imported = decodeRoomFromHash(window.location.hash);
    if (imported && syncMode === 'local') {
      mergeUsersIntoLocalRoom(roomId, imported);
    }

    const unsubscribe = subscribeRoom(
      roomId,
      (nextMap) => {
        setUsersMap(nextMap);
      },
      (status) => {
        setSyncStatus(status);
      },
    );

    return () => {
      unsubscribe();
      if (profileSyncTimerRef.current) {
        clearTimeout(profileSyncTimerRef.current);
      }
    };
  }, [roomId, syncMode]);

  const currentUser = useMemo(() => {
    const remoteUser = usersMap[currentUserId];
    return {
      id: currentUserId,
      name: profile.name,
      color: profile.color,
      slots: remoteUser?.slots || [],
    };
  }, [currentUserId, profile.color, profile.name, usersMap]);

  const users = useMemo(() => {
    const list = Object.values(usersMap);
    return list.sort((a, b) => {
      if (a.id === currentUserId) return -1;
      if (b.id === currentUserId) return 1;
      return a.name.localeCompare(b.name, 'vi');
    });
  }, [usersMap, currentUserId]);

  const persistUserToRoom = useCallback(
    async (userObj) => {
      const trimmedName = userObj.name.trim();
      if (!trimmedName) return;

      if (profileSyncTimerRef.current) {
        clearTimeout(profileSyncTimerRef.current);
        profileSyncTimerRef.current = null;
      }

      setSyncStatus((prev) => (prev === 'offline' ? prev : 'syncing'));
      setUsersMap((prev) => ({
        ...prev,
        [userObj.id]: {
          ...userObj,
          name: trimmedName,
          updatedAt: Date.now(),
        },
      }));

      try {
        await saveUserSchedule(roomId, { ...userObj, name: trimmedName });
        setSyncStatus('synced');
      } catch {
        setSyncStatus('error');
      }
    },
    [roomId],
  );

  const updateProfile = useCallback(
    ({ name, color }) => {
      const nextProfile = {
        name: name !== undefined ? name : profile.name,
        color: color !== undefined ? color : profile.color,
      };
      setProfile(nextProfile);
      persistLocalProfile(nextProfile);

      if (profileSyncTimerRef.current) {
        clearTimeout(profileSyncTimerRef.current);
      }

      const trimmedName = nextProfile.name.trim();
      const existingRemote = usersMapRef.current[currentUserId];

      if (!trimmedName && existingRemote && existingRemote.slots.length === 0) {
        removeUserSchedule(roomId, currentUserId).catch(() => {});
        return;
      }

      if (trimmedName) {
        profileSyncTimerRef.current = setTimeout(() => {
          const latestSlots = usersMapRef.current[currentUserId]?.slots || [];
          persistUserToRoom({
            id: currentUserId,
            name: trimmedName,
            color: nextProfile.color,
            slots: latestSlots,
          });
        }, 280);
      }
    },
    [currentUserId, persistUserToRoom, profile.color, profile.name, roomId],
  );

  const toggleSlots = useCallback(
    (slotKeys, shouldSelect) => {
      if (!profile.name.trim() || !slotKeys.length) return;
      const existingSlots = new Set(usersMap[currentUserId]?.slots || []);

      for (const key of slotKeys) {
        if (shouldSelect) {
          existingSlots.add(key);
        } else {
          existingSlots.delete(key);
        }
      }

      persistUserToRoom({
        id: currentUserId,
        name: profile.name.trim(),
        color: profile.color,
        slots: Array.from(existingSlots),
      });
    },
    [currentUserId, persistUserToRoom, profile.color, profile.name, usersMap],
  );

  const clearMyWeekSlots = useCallback(
    (weekIsoDates) => {
      const existingSlots = usersMap[currentUserId]?.slots || [];
      if (!existingSlots.length) return;
      const weekDateSet = new Set(weekIsoDates);
      const remaining = existingSlots.filter((slotKey) => {
        const [isoDate] = slotKey.split('_');
        return !weekDateSet.has(isoDate);
      });

      if (profile.name.trim()) {
        persistUserToRoom({
          id: currentUserId,
          name: profile.name.trim(),
          color: profile.color,
          slots: remaining,
        });
      }
    },
    [currentUserId, persistUserToRoom, profile.color, profile.name, usersMap],
  );

  const clearAllMySlots = useCallback(async () => {
    setUsersMap((prev) => {
      const next = { ...prev };
      delete next[currentUserId];
      return next;
    });
    try {
      await removeUserSchedule(roomId, currentUserId);
      setSyncStatus('synced');
    } catch {
      setSyncStatus('error');
    }
  }, [currentUserId, roomId]);

  const getShareUrl = useCallback(() => {
    const base = `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(roomId)}`;
    if (syncMode === 'local') {
      const hash = encodeRoomToHash(usersMap);
      return `${base}${hash}`;
    }
    return base;
  }, [roomId, syncMode, usersMap]);

  return {
    roomId,
    syncMode,
    syncStatus,
    users,
    currentUser,
    updateProfile,
    toggleSlots,
    clearMyWeekSlots,
    clearAllMySlots,
    getShareUrl,
  };
}
