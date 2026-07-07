// Parent-token holder. Deliberately session-only (sessionStorage) per
// TASK_2.1: parent access should NOT persist to another tab or survive
// closing the app. Auto-expires client-side too (30 min → matches JWT exp).

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from './api';

const PARENT_TOKEN_KEY = 'kidsbrain_parent_token';
const PARENT_EXPIRES_KEY = 'kidsbrain_parent_expires_at';

function getStoredToken() {
  const t = sessionStorage.getItem(PARENT_TOKEN_KEY);
  const exp = Number(sessionStorage.getItem(PARENT_EXPIRES_KEY) || 0);
  if (!t) return null;
  if (exp && exp < Date.now()) {
    sessionStorage.removeItem(PARENT_TOKEN_KEY);
    sessionStorage.removeItem(PARENT_EXPIRES_KEY);
    return null;
  }
  return t;
}

function saveToken(t, expiresInSeconds) {
  sessionStorage.setItem(PARENT_TOKEN_KEY, t);
  sessionStorage.setItem(PARENT_EXPIRES_KEY, String(Date.now() + expiresInSeconds * 1000));
}

function clearToken() {
  sessionStorage.removeItem(PARENT_TOKEN_KEY);
  sessionStorage.removeItem(PARENT_EXPIRES_KEY);
}

const ParentAuthCtx = createContext(null);

export function ParentAuthProvider({ children }) {
  const [token, setToken] = useState(getStoredToken());
  const [parent, setParent] = useState(null);

  const refresh = useCallback(async () => {
    const t = getStoredToken();
    setToken(t);
    if (!t) { setParent(null); return; }
    try {
      const info = await api('/parent/me', { token: t });
      setParent(info);
    } catch {
      clearToken();
      setToken(null);
      setParent(null);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Auto-lock when the tab is hidden for >2min — a lightweight defence in depth.
  useEffect(() => {
    let hiddenAt = 0;
    const onVis = () => {
      if (document.visibilityState === 'hidden') hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > 2 * 60 * 1000) logout();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  const login = async ({ childId, clientId, pin }) => {
    const res = await api('/parent/login', {
      method: 'POST',
      body: { childId, clientId, pin }
    });
    saveToken(res.token, res.expires_in_seconds || 1800);
    setToken(res.token);
    setParent({ role: 'parent', clientId: res.parent.clientId, childIds: res.parent.childIds });
    return res.parent;
  };

  const logout = () => {
    clearToken();
    setToken(null);
    setParent(null);
  };

  return (
    <ParentAuthCtx.Provider value={{ token, parent, login, logout, refresh }}>
      {children}
    </ParentAuthCtx.Provider>
  );
}

export function useParentAuth() {
  return useContext(ParentAuthCtx);
}
