// -----------------------------------------------------------------------------
//  api.js — the ONLY place the frontend talks to the backend.
//  - attaches the JWT (Authorization: Bearer ...) automatically
//  - parses JSON and normalizes errors into one shape (ApiClientError)
//  - on HTTP 401 (token missing/expired) it clears the session and returns to login
//  This keeps every screen small: they just call api.get/post/put/del.
// -----------------------------------------------------------------------------

class ApiClientError extends Error {
  constructor(message, status, errors) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;    // HTTP status (0 = network/CORS failure)
    this.errors = errors;    // backend field-level errors array, if present
  }
}

async function apiRequest(path, { method = 'GET', body, auth = true } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  // Tell the backend which language to return stored DATA in (account names,
  // ledger narrations, notes). Read straight from localStorage so this file
  // stays independent of ui.js load order.
  headers['X-App-Lang'] = localStorage.getItem('app_lang') === 'ar' ? 'ar' : 'en';
  if (auth) {
    const token = localStorage.getItem('acct_token');
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (netErr) {
    // Server unreachable / CORS blocked / offline -> status 0
    throw new ApiClientError('Cannot reach the server. Make sure the API is running on port 3000.', 0, null);
  }

  // Read the body once as text, then try to parse JSON (handles empty responses).
  let data = null;
  const text = await res.text();
  if (text) {
    try { data = JSON.parse(text); } catch { data = null; }
  }

  // Auto-logout on expired/invalid token for authenticated calls.
  if (res.status === 401 && auth) {
    localStorage.removeItem('acct_token');
    localStorage.removeItem('acct_user');
    const onLoginPage = location.pathname.endsWith('index.html') || location.pathname.endsWith('/');
    if (!onLoginPage) location.href = 'index.html';
  }

  if (!res.ok) {
    const message = (data && data.message) || `Request failed (${res.status})`;
    throw new ApiClientError(message, res.status, data && data.errors);
  }

  // Return the full envelope: { success, message, data, meta }
  return data;
}

// Small helpers so screens read nicely: api.get('/customers'), api.post(...), ...
const api = {
  get: (path) => apiRequest(path),
  post: (path, body) => apiRequest(path, { method: 'POST', body }),
  put: (path, body) => apiRequest(path, { method: 'PUT', body }),
  del: (path) => apiRequest(path, { method: 'DELETE' }),
};
