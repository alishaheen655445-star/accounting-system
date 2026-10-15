// -----------------------------------------------------------------------------
//  JWT helpers — sign and verify access tokens.
//  The token payload carries only non-sensitive identity claims (id, role).
//  NEVER put passwords or secrets inside the token.
// -----------------------------------------------------------------------------
const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET;
const EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';

if (!SECRET) {
  // Fail loudly at startup rather than silently using an insecure default.
  throw new Error('JWT_SECRET is not set. Define it in the .env file.');
}

const signToken = (user) =>
  jwt.sign(
    { sub: user.id, role: user.role, username: user.username },
    SECRET,
    { expiresIn: EXPIRES_IN }
  );

const verifyToken = (token) => jwt.verify(token, SECRET);

module.exports = { signToken, verifyToken };
