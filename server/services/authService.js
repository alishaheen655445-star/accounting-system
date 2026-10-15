// -----------------------------------------------------------------------------
//  Auth service — business logic for authentication (separate from HTTP layer).
// -----------------------------------------------------------------------------
const bcrypt = require('bcrypt');

const userModel = require('../models/userModel');
const auditService = require('./auditService');
const { signToken } = require('../utils/jwt');
const ApiError = require('../utils/ApiError');

const GENERIC_LOGIN_FAIL = 'Invalid username/email or password';

/**
 * Validate credentials and, on success, return a JWT + safe user profile.
 * @returns {Promise<{token:string, user:object}>}
 */
const login = async ({ identifier, password, ip }) => {
  const user = await userModel.findByUsernameOrEmail(identifier);

  // Same message + same bcrypt work regardless of "user missing" vs "wrong pw"
  // to avoid user-enumeration timing/oracle leaks.
  if (!user) {
    // Burn comparable time so response timing doesn't reveal existence.
    await bcrypt.compare(password, '$2b$12$0000000000000000000000000000000000000000000000000000');
    throw new ApiError(401, GENERIC_LOGIN_FAIL);
  }

  if (!user.is_active) {
    throw new ApiError(403, 'This account has been disabled');
  }

  const passwordOk = await bcrypt.compare(password, user.password_hash);
  if (!passwordOk) {
    throw new ApiError(401, GENERIC_LOGIN_FAIL);
  }

  const token = signToken(user);
  const safeUser = {
    id: user.id,
    username: user.username,
    email: user.email,
    full_name: user.full_name,
    role: user.role,
  };

  await auditService.log({
    userId: user.id,
    action: 'user.login',
    entity: 'users',
    entityId: user.id,
    description: `Successful login for ${user.username}`,
    ip,
  });

  return { token, user: safeUser };
};

module.exports = { login };
