// -----------------------------------------------------------------------------
//  Central configuration. One place to point the frontend at the backend API.
//  * Explicit override (optional): set window.API_BASE_URL before this loads.
//  * Dev: the client runs on http-server (:5500) while the API is on :3000, so
//    an absolute localhost URL is used.
//  * Production single-service: Express serves BOTH the client and /api on the
//    SAME origin, so a RELATIVE '/api' works on any deployed host with no config.
// -----------------------------------------------------------------------------
const API_BASE = (function () {
  try { if (window.API_BASE_URL) return window.API_BASE_URL; } catch (e) {}
  const isLocalHost = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if (isLocalHost && location.port && location.port !== '3000') {
    return `http://${location.hostname}:3000/api`; // dev: separate static server
  }
  return '/api'; // same-origin (deployed single service, or API served on :3000)
})();
