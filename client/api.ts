import { sleep } from './lib/util';

/**
 * База API: window.__STRATEGY_AI_API_URL__ или '' (режим localStorage).
 */
export const API_BASE =
  (typeof window !== 'undefined' && (window as unknown as { __STRATEGY_AI_API_URL__?: string }).__STRATEGY_AI_API_URL__) ||
  '';

export function getJWT(): string {
  try {
    return localStorage.getItem('sa_jwt') || '';
  } catch {
    return '';
  }
}
export function setJWT(t: string) {
  try {
    localStorage.setItem('sa_jwt', t);
  } catch {}
}
export function clearJWT() {
  try {
    localStorage.removeItem('sa_jwt');
  } catch {}
}
export function getRefreshToken(): string {
  try {
    return localStorage.getItem('sa_refresh_jwt') || '';
  } catch {
    return '';
  }
}
export function setRefreshToken(t: string) {
  try {
    localStorage.setItem('sa_refresh_jwt', t);
  } catch {}
}
export function clearRefreshToken() {
  try {
    localStorage.removeItem('sa_refresh_jwt');
  } catch {}
}

export function saveTokens(token: string, refreshToken?: string) {
  setJWT(token);
  if (refreshToken) setRefreshToken(refreshToken);
}

let _refreshingPromise: Promise<boolean> | null = null;

async function tryRefreshToken(): Promise<boolean> {
  if (_refreshingPromise) return _refreshingPromise;
  _refreshingPromise = (async () => {
    try {
      const rt = getRefreshToken();
      if (!rt) return false;
      const r = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: rt }),
      });
      if (!r.ok) {
        clearJWT();
        clearRefreshToken();
        return false;
      }
      const d = await r.json();
      saveTokens(d.token, d.refreshToken);
      return true;
    } catch {
      return false;
    } finally {
      _refreshingPromise = null;
    }
  })();
  return _refreshingPromise;
}

export async function apiFetch(path: string, opts: RequestInit = {}, retry = true): Promise<any> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((opts.headers as Record<string, string>) || {}),
  };
  const jwt = getJWT();
  if (jwt) headers['Authorization'] = `Bearer ${jwt}`;
  const r = await fetch(`${API_BASE}${path}`, { ...opts, headers });
  if (r.status === 204) return {};

  if (r.status === 401 && retry) {
    const refreshed = await tryRefreshToken();
    if (refreshed) return apiFetch(path, opts, false);
    clearJWT();
    clearRefreshToken();
    try {
      (window as unknown as { __sa_onSessionExpired?: () => void }).__sa_onSessionExpired?.();
    } catch {}
    throw new Error('session_expired');
  }

  let data: any;
  try {
    data = await r.json();
  } catch {
    data = {};
  }
  if (!r.ok) throw new Error(data?.error || `HTTP ${r.status}`);
  return data;
}

export async function refreshUserAfterPayment(expectedTier: string | null) {
  let last: any = null;
  for (let attempt = 0; attempt < 12; attempt++) {
    try {
      const d = await apiFetch('/api/auth/me');
      if (d.user) {
        last = normalizeUser(d.user);
        if (!expectedTier || last.tier === expectedTier) return last;
      }
    } catch {}
    await sleep(500);
  }
  return last;
}

type StorageApi = {
  get(k: string): Promise<{ value: string } | null>;
  set(k: string, v: string): Promise<void>;
  delete(k: string): Promise<void>;
};

if (typeof window !== 'undefined' && !(window as unknown as { storage?: StorageApi }).storage) {
  (window as unknown as { storage: StorageApi }).storage = {
    async get(k: string) {
      try {
        const v = localStorage.getItem(k);
        return v != null ? { value: v } : null;
      } catch {
        return null;
      }
    },
    async set(k: string, v: string) {
      try {
        localStorage.setItem(k, v);
      } catch {}
    },
    async delete(k: string) {
      try {
        localStorage.removeItem(k);
      } catch {}
    },
  };
}

export const store = {
  async get(k: string) {
    try {
      const w = window as unknown as { storage: StorageApi };
      const r = await w.storage.get(k);
      return r ? JSON.parse(r.value) : null;
    } catch {
      return null;
    }
  },
  async set(k: string, v: any) {
    try {
      const w = window as unknown as { storage: StorageApi };
      await w.storage.set(k, JSON.stringify(v));
    } catch {}
  },
  async del(k: string) {
    try {
      const w = window as unknown as { storage: StorageApi };
      await w.storage.delete(k);
    } catch {}
  },
};

/** Хеш пароля для локального режима без API (должен совпадать с проверкой в login/register). */
export const hashPw = (e: string, p: string) => btoa(`${e}:${p}:sa2026`);

export async function getSession() {
  if (API_BASE) {
    const jwt = getJWT();
    if (!jwt) return null;
    try {
      const d = await apiFetch('/api/auth/me');
      return d.user ? { email: d.user.email } : null;
    } catch (e: any) {
      if (e?.message === 'session_expired') {
        clearJWT();
        clearRefreshToken();
      }
      return null;
    }
  }
  return store.get('sa_sess');
}

export async function setSession(email: string) {
  if (!API_BASE) await store.set('sa_sess', { email });
}

export async function clearSession() {
  if (API_BASE) {
    clearJWT();
    clearRefreshToken();
  } else await store.del('sa_sess');
}

export async function seedDefault() {
  if (API_BASE) return;
  const a = (await store.get('sa_acc')) || [];
  const e = 'denisblackman2@gmail.com';
  if (!a.find((x: any) => x.email === e))
    await store.set('sa_acc', [
      ...a,
      { email: e, pwHash: hashPw(e, 'Denis123'), name: 'Denis', tier: 'team', createdAt: Date.now() },
    ]);
}

export function normalizeUser(raw: any) {
  if (!raw) return raw;
  return {
    ...raw,
    notifEmail: raw.notifEmail ?? raw.notif_email,
    notifPush: raw.notifPush ?? raw.notif_push,
    autoSave: raw.autoSave ?? raw.auto_save,
    compactMode: raw.compactMode ?? raw.compact_mode,
    defaultView: raw.defaultView ?? raw.default_view,
    aiLang: raw.aiLang ?? raw.ai_lang,
    theme: raw.theme ?? 'dark',
    palette: raw.palette ?? 'indigo',
    createdAt: raw.createdAt ?? raw.created_at,
    trialEndsAt: raw.trialEndsAt ?? raw.trial_ends_at,
    emailVerified: raw.emailVerified ?? raw.email_verified ?? true,
    is_dev: raw.is_dev ?? false,
  };
}

export async function register(email: string, pw: string, name: string) {
  if (API_BASE) {
    try {
      const d = await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password: pw, name }),
      });
      saveTokens(d.token, d.refreshToken);
      return { user: normalizeUser(d.user), isNew: true };
    } catch (e: any) {
      return { error: e.message };
    }
  }
  const e2 = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e2)) return { error: 'Некорректный формат email' };
  if (pw.length < 6) return { error: 'Пароль должен быть не менее 6 символов' };
  const a = (await store.get('sa_acc')) || [];
  if (a.find((x: any) => x.email === e2)) return { error: 'Email уже зарегистрирован' };
  const u = {
    email: e2,
    pwHash: hashPw(e2, pw),
    name: name?.trim() || e2.split('@')[0],
    tier: 'free',
    createdAt: Date.now(),
  };
  await store.set('sa_acc', [...a, u]);
  await setSession(e2);
  return { user: u, isNew: true };
}

export async function login(email: string, pw: string) {
  if (API_BASE) {
    try {
      const d = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password: pw }),
      });
      saveTokens(d.token, d.refreshToken);
      return { user: normalizeUser(d.user), isNew: false };
    } catch (e: any) {
      return { error: e.message };
    }
  }
  const e = email.trim().toLowerCase();
  const a = (await store.get('sa_acc')) || [];
  const u = a.find((x: any) => x.email === e && x.pwHash === hashPw(e, pw));
  if (!u) return { error: 'Неверный email или пароль' };
  await setSession(e);
  return { user: u, isNew: false };
}

export async function patchUser(email: string, patch: any) {
  if (API_BASE) {
    try {
      const body: any = {};
      if (patch.name !== undefined) body.name = patch.name;
      if (patch.bio !== undefined) body.bio = patch.bio;
      if (patch.aiLang !== undefined) body.ai_lang = patch.aiLang;
      if (patch.notifEmail !== undefined) body.notif_email = patch.notifEmail;
      if (patch.notifPush !== undefined) body.notif_push = patch.notifPush;
      if (patch.autoSave !== undefined) body.auto_save = patch.autoSave;
      if (patch.compactMode !== undefined) body.compact_mode = patch.compactMode;
      if (patch.defaultView !== undefined) body.default_view = patch.defaultView;
      if (patch.tier !== undefined) body.tier = patch.tier;
      if (patch.theme !== undefined) body.theme = patch.theme;
      if (patch.palette !== undefined) body.palette = patch.palette;
      const d = await apiFetch('/api/auth/profile', { method: 'PATCH', body: JSON.stringify(body) });
      return normalizeUser(d.user);
    } catch (e: any) {
      throw e;
    }
  }
  const a = (await store.get('sa_acc')) || [];
  const upd = a.map((x: any) => (x.email === email ? { ...x, ...patch } : x));
  await store.set('sa_acc', upd);
  return upd.find((x: any) => x.email === email);
}

export function normalizeProject(p: any) {
  if (!p) return p;
  return { ...p, owner: p.owner ?? p.owner_email, createdAt: p.createdAt ?? p.created_at };
}

export async function getProjects(_email: string) {
  if (API_BASE) {
    try {
      const d = await apiFetch('/api/projects');
      return (d.projects || []).map(normalizeProject);
    } catch {
      return [];
    }
  }
  const a = (await store.get('sa_proj')) || [];
  return a.filter(
    (p: any) => p.owner === _email || p.members?.find((m: any) => m.email === _email)
  );
}

export async function saveProject(p: any) {
  if (API_BASE) {
    try {
      if (p._new) {
        const d = await apiFetch('/api/projects', { method: 'POST', body: JSON.stringify({ name: p.name }) });
        return normalizeProject(d.project);
      } else {
        const body: any = { name: p.name };
        if (p.members !== undefined) body.members = p.members;
        const d = await apiFetch(`/api/projects/${p.id}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
        return normalizeProject(d.project);
      }
    } catch (e) {
      // Ранее ошибка проглатывалась и возвращался исходный проект (ложный успех).
      // Пробрасываем — вызывающий код обёрнут в try/catch и показывает тост.
      throw e;
    }
  }
  const a = (await store.get('sa_proj')) || [];
  const i = a.findIndex((x: any) => x.id === p.id);
  const pp = { ...p, updatedAt: Date.now() };
  await store.set('sa_proj', i >= 0 ? a.map((x: any) => (x.id === p.id ? pp : x)) : [...a, pp]);
  return pp;
}

export async function addProjectMember(projectId: string, email: string, role: string) {
  if (API_BASE) {
    try {
      const d = await apiFetch(`/api/projects/${projectId}/members`, {
        method: 'POST',
        body: JSON.stringify({ email, role }),
      });
      return normalizeProject(d.project);
    } catch {
      return null;
    }
  }
  return null;
}

export async function removeProjectMember(projectId: string, email: string): Promise<any> {
  if (API_BASE) {
    try {
      const d = await apiFetch(
        `/api/projects/${projectId}/members/${encodeURIComponent(email)}`,
        { method: 'DELETE' }
      );
      return normalizeProject(d?.project);
    } catch {
      return null;
    }
  }
  return null;
}

export async function deleteProject(id: string) {
  if (API_BASE) {
    try {
      await apiFetch(`/api/projects/${id}`, { method: 'DELETE' });
    } catch {}
    return;
  }
  const a = (await store.get('sa_proj')) || [];
  await store.set(
    'sa_proj',
    a.filter((p: any) => p.id !== id)
  );
  await store.del(`sa_maps_${id}`);
}

export async function getNotifications() {
  if (API_BASE) {
    try {
      return await apiFetch('/api/notifications');
    } catch {
      return { notifications: [], unread: 0 };
    }
  }
  return { notifications: [], unread: 0 };
}

export async function readAllNotifications() {
  if (API_BASE) {
    try {
      return await apiFetch('/api/notifications/read-all', { method: 'POST' });
    } catch {
      return { ok: false };
    }
  }
  return { ok: true };
}

export async function readNotification(id: string) {
  if (API_BASE) {
    try {
      return await apiFetch(`/api/notifications/${id}/read`, { method: 'POST' });
    } catch {
      return { ok: false };
    }
  }
  return { ok: true };
}

export async function deleteNotification(id: string) {
  if (API_BASE) {
    try {
      return await apiFetch(`/api/notifications/${id}`, { method: 'DELETE' });
    } catch {
      return { ok: false };
    }
  }
  return { ok: true };
}
