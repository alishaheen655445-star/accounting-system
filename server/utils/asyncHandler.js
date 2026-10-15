// -----------------------------------------------------------------------------
//  asyncHandler — wraps an async route handler so any rejected promise is
//  forwarded to Express' error middleware via next(err). This removes the need
//  for try/catch inside every controller (requirement 21: centralized handling).
// -----------------------------------------------------------------------------
module.exports = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
