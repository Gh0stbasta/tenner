/** Translate AWS SDK errors into application errors. */

import { ConflictError, NotFoundError, PersistenceError } from "../../exceptions/index.js";

/** True for DynamoDB's ConditionalCheckFailedException. */
export function isConditionalCheckFailed(error: unknown): boolean {
  return error instanceof Error && error.name === "ConditionalCheckFailedException";
}

export function toPersistenceError(operation: string, error: unknown): PersistenceError {
  return new PersistenceError(`Failed to ${operation}.`, { cause: error });
}

export function toConflictOrPersistenceError(operation: string, conflictMessage: string, error: unknown): ConflictError | PersistenceError {
  return isConditionalCheckFailed(error) ? new ConflictError(conflictMessage) : toPersistenceError(operation, error);
}

export function toNotFoundOrPersistenceError(operation: string, notFoundMessage: string, error: unknown): NotFoundError | PersistenceError {
  return isConditionalCheckFailed(error) ? new NotFoundError(notFoundMessage) : toPersistenceError(operation, error);
}
