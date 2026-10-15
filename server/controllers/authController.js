// -----------------------------------------------------------------------------
//  Auth controller — thin HTTP layer: reads request, calls service, sends reply.
//  No business logic here; that lives in services/. (Clean architecture.)
// -----------------------------------------------------------------------------
const authService = require('../services/authService');
const userModel = require('../models/userModel');
const { sendSuccess } = require('../utils/response');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

/** POST /api/auth/login */
const login = asyncHandler(async (req, res) => {
  const { identifier, password } = req.body;
  const ip = req.ip;

  const { token, user } = await authService.login({ identifier, password, ip });

  return sendSuccess(res, {
    message: 'Login successful',
    data: { token, user },
  });
});

/** GET /api/auth/me  (protected — returns the currently authenticated user) */
const me = asyncHandler(async (req, res) => {
  const user = await userModel.findByIdSafe(req.user.id);
  if (!user) {
    throw new ApiError(404, 'User not found');
  }
  return sendSuccess(res, { message: 'Current user', data: { user } });
});

module.exports = { login, me };
