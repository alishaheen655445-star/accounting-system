// -----------------------------------------------------------------------------
//  auth.js — session management for the SPA.
//  The JWT + user profile live in localStorage so every page/tab reuses them.
//  SECURITY TRADE-OFF (good exam talking-point):
//    localStorage is simple and works for a demo, but is readable by injected JS
//    (XSS). A hardened app would use an httpOnly cookie instead. We note it and
//    keep the API itself safe (token is still verified server-side every request).
// -----------------------------------------------------------------------------
const TOKEN_KEY = 'acct_token';
const USER_KEY = 'acct_user';

async function login(identifier, password) {
  const res = await api.post('/auth/login', { identifier, password }); // auth=false not needed; login ignores token
  const { token, user } = res.data;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  return user;
}

function logout() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  location.href = 'index.html';
}

function getToken() { return localStorage.getItem(TOKEN_KEY); }

function getUser() {
  const raw = localStorage.getItem(USER_KEY);
  try { return raw ? JSON.parse(raw) : null; } catch { return null; }
}

function isAuthed() { return !!getToken(); }

// Call at the very top of any protected page: bounces to login if no session.
function requireAuth() {
  if (!isAuthed()) { location.href = 'index.html'; return false; }
  return true;
}

// Role helper for showing/hiding write actions in the UI (backend still enforces).
function hasAnyRole(...roles) {
  const u = getUser();
  return !!u && roles.includes(u.role);
}
