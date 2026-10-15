// -----------------------------------------------------------------------------
//  Authentication & Authorization middleware (requirement 20).
//
//  authenticate : verifies the JWT on every protected request and sets req.user
//  authorize    : role-based access control — allows only the given roles
// -----------------------------------------------------------------------------
const ApiError = require('../utils/ApiError');
const { verifyToken } = require('../utils/jwt');

/**
 * Reads the "Authorization: Bearer <token>" header, verifies it, and attaches
 * the decoded user to req.user. Rejects with 401 when missing/invalid/expired.
 */
const authenticate = (req, _res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return next(new ApiError(401, 'Authentication required. Provide a Bearer token.'));
  }

  try {
    const payload = verifyToken(token);
    req.user = { id: payload.sub, role: payload.role, username: payload.username };
    return next();
  } catch (err) {
    // Expired or tampered token — a generic message avoids leaking internals.
    return next(new ApiError(401, 'Invalid or expired token'));
  }
};

/**
 * Restricts a route to specific roles. Usage:
 *   router.post('/invoices', authenticate, authorize('admin', 'accountant'), handler)
 */
const authorize = (...allowedRoles) => (req, _res, next) => {
  if (!req.user) {
    return next(new ApiError(401, 'Authentication required'));
  }
  if (!allowedRoles.includes(req.user.role)) {
    return next(new ApiError(403, 'You do not have permission to perform this action'));
  }
  return next();
};

module.exports = { authenticate, authorize };
