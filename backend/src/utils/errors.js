export class AppError extends Error {
  constructor(statusCode, code, message, details = {}) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export function sendSuccess(res, data, statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    data,
  });
}

export function sendError(res, err) {
  const statusCode = err?.statusCode || 500;
  const code = err?.code || 'INTERNAL_SERVER_ERROR';
  const message = err?.message || 'Unexpected server error occurred.';
  const details = err?.details || {};

  return res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      details,
    },
  });
}

export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
