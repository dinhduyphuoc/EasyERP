export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code?: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class BadRequestError extends AppError {
  constructor(message = "Bad request") {
    super(message, 400, "BAD_REQUEST");
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(message, 404, "NOT_FOUND");
  }
}

export class ConflictError extends AppError {
  constructor(message = "Conflict") {
    super(message, 409, "CONFLICT");
  }
}

export class UnauthorizedError extends AppError {
  constructor(
    message = "Authentication required",
    code = "AUTH_UNAUTHORIZED",
    details?: Record<string, unknown>,
  ) {
    super(message, 401, code, details);
  }
}

export class ForbiddenError extends AppError {
  constructor(
    message = "You do not have permission to perform this action",
    details?: Record<string, unknown>,
  ) {
    super(message, 403, "AUTH_FORBIDDEN", details);
  }
}

export class TooManyRequestsError extends AppError {
  constructor(
    message = "Too many requests",
    details?: Record<string, unknown>,
  ) {
    super(message, 429, "RATE_LIMITED", details);
  }
}
