/**
 * Framework-agnostic domain errors carrying an HTTP status. The service and
 * stores throw these; the Hono `onError` handler maps them to the JSend
 * envelope (4xx -> `fail`, 5xx -> `error`). Keeping them free of any Hono
 * import is what lets the service be unit-tested without a runtime.
 */
export class RegistryError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class BadRequestError extends RegistryError {
  constructor(message: string) {
    super(400, message);
  }
}

export class NotFoundError extends RegistryError {
  constructor(message: string) {
    super(404, message);
  }
}

export class ConflictError extends RegistryError {
  constructor(message: string) {
    super(409, message);
  }
}
