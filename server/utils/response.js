// -----------------------------------------------------------------------------
//  Response helpers — enforce ONE consistent success shape across the whole API
//  (requirement 21). Errors are handled centrally by the error middleware, so
//  here we only standardise the happy path.
//
//  Success shape:
//    { success: true, message, data?, meta? }
// -----------------------------------------------------------------------------
const sendSuccess = (res, { statusCode = 200, message = 'OK', data = undefined, meta = undefined } = {}) => {
  const body = { success: true, message };
  if (data !== undefined) body.data = data;
  if (meta !== undefined) body.meta = meta;
  return res.status(statusCode).json(body);
};

const sendCreated = (res, { message = 'Created', data = undefined } = {}) =>
  sendSuccess(res, { statusCode: 201, message, data });

module.exports = { sendSuccess, sendCreated };
