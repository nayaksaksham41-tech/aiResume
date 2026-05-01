class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
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

  res.status(statusCode).json({ error: message });
};

module.exports = { AppError, notFoundHandler, errorHandler };
