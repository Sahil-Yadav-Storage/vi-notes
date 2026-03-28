export class ServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class ValidationError extends ServiceError {
  constructor(message: string) {
    super(message, 400, "VALIDATION_ERROR");
  }
}

export class UnauthorizedError extends ServiceError {
  constructor(message: string = "Unauthorized") {
    super(message, 401, "UNAUTHORIZED");
  }
}

export class NotFoundError extends ServiceError {
  constructor(message: string) {
    super(message, 404, "NOT_FOUND");
  }
}

export class ConflictError extends ServiceError {
  constructor(message: string) {
    super(message, 409, "CONFLICT");
  }
}

export class InternalServiceError extends ServiceError {
  constructor(message: string = "Internal service error") {
    super(message, 500, "INTERNAL");
  }
}

export const getServiceErrorResponse = (
  error: unknown,
): { statusCode: number; message: string } => {
  if (error instanceof ServiceError) {
    return { statusCode: error.statusCode, message: error.message };
  }

  return { statusCode: 500, message: "Internal server error" };
};
