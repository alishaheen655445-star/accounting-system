// -----------------------------------------------------------------------------
//  Centralized error handling (requirement 21).
//  Every thrown ApiError / unexpected error funnels here and is converted into
//  ONE consistent error shape:  { success: false, message, errors? }
// -----------------------------------------------------------------------------
const ApiError = require('../utils/ApiError');

// 404 catch-all for unmatched routes.
const notFound = (req, _res, next) => {
  next(new ApiError(404, `Endpoint not found: ${req.method} ${req.originalUrl}`));
};

/**
 * Translates low-level MySQL errors into friendly HTTP errors.
 * (Never expose raw DB messages to the client.)
 */
const normalizeDbError = (err) => {
  switch (err.code) {
    case 'ER_DUP_ENTRY':
      return new ApiError(409, 'A record with this value already exists');
    case 'ER_NO_REFERENCED_ROW_2':
      return new ApiError(400, 'Referenced record does not exist');
    case 'ER_ROW_IS_REFERENCED_2':
      return new ApiError(409, 'This record is referenced by other data and cannot be deleted');
    case 'ER_BAD_NULL_ERROR':
      return new ApiError(400, 'A required field is missing');
    default:
      return null;
  }
};

// Final error middleware (must have 4 args so Express recognises it).
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, _req, res, _next) => {
  let error = err;

  // Wrap express-validator style arrays if thrown as-is
  if (Array.isArray(err)) {
    error = new ApiError(400, 'Validation failed', err);
  }

  // Try to map unknown DB errors to something safe.
  if (err.code && typeof err.code === 'string' && err.code.startsWith('ER_')) {
    error = normalizeDbError(err) || new ApiError(500, 'Database error');
  }

  // Ensure we always work with an ApiError carrying a status code.
  if (!(error instanceof ApiError)) {
    const statusCode = error.statusCode || 500;
    error = new ApiError(statusCode, error.message || 'Internal server error');
  }

  // Log unexpected (non-operational) errors loudly for debugging.
  if (!error.isOperational || error.statusCode >= 500) {
    console.error('💥 Unexpected error:', err);
  }

  const body = { success: false, message: error.message };
  if (error.details) body.errors = error.details; // e.g. field-level validation

  // Hide internal details in production for 5xx.
  if (process.env.NODE_ENV === 'production' && error.statusCode >= 500) {
    body.message = 'Internal server error';
    delete body.errors;
  }

  res.status(error.statusCode).json(body);
};

module.exports = { notFound, errorHandler };
