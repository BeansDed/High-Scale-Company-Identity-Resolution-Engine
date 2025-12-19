export type Result<T, E> = Ok<T> | Err<E>;

export class Ok<T> {
  public readonly kind = "ok" as const;

  constructor(public readonly value: T) {}

  public isOk(): this is Ok<T> {
    return true;
  }

  public isErr(): this is Err<unknown> {
    return false;
  }
}

export class Err<E> {
  public readonly kind = "err" as const;

  constructor(public readonly error: E) {}

  public isOk(): this is Ok<unknown> {
    return false;
  }

  public isErr(): this is Err<E> {
    return true;
  }
}

export const Result = {
  ok<T>(value: T): Result<T, never> {
    return new Ok(value);
  },

  err<E>(error: E): Result<never, E> {
    return new Err(error);
  }
};
