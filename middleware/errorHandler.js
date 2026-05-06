class AppError extends Error {
  constructor(message, statusCode = 500, code = undefined) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

const notFoundHandler = (_req, res) => {
  res.status(404).json({ error: "Route not found" });
};

const errorHandler = (err, _req, res, _next) => {
  const statusCode = err.statusCode || 500;
  const isOperational = err instanceof AppError;
  const message = isOperational ? err.message : "Internal server error";

  if (statusCode >= 500) {
    console.error("Unhandled error:", err);
  }

  const body = { error: message };
  if (err.code) body.code = err.code;
  res.status(statusCode).json(body);
};

module.exports = { AppError, notFoundHandler, errorHandler };
