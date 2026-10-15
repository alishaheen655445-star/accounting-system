// -----------------------------------------------------------------------------
//  validate — runs after express-validator chains; if any rule failed, it stops
//  the request with a single 400 ApiError carrying the field-level messages.
// -----------------------------------------------------------------------------
const { validationResult } = require('express-validator');
const ApiError = require('../utils/ApiError');

module.exports = (req, _res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const details = errors.array().map((e) => ({
      field: e.path,
      message: e.msg,
    }));
    return next(new ApiError(400, 'Validation failed', details));
  }
  return next();
};
