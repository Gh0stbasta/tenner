/**
 * Secret loader (SECURITY-006, ADR 0004): reads SecureString parameters from SSM Parameter Store
 * (`/tenner/<environment>/<component>/<name>`) with decryption and caches them in memory for a TTL, so a warm Lambda
 * reads each secret about once per TTL. Values never appear in logs, errors or environment variables.
 */

import { GetParameterCommand, type GetParameterCommandOutput } from "@aws-sdk/client-ssm";
import type { SsmSender } from "../clients/ssm.js";

export const DEFAULT_SECRET_TTL_MS = 5 * 60_000;

/** A secret could not be read. The message names the parameter, never a value. */
export class SecretUnavailableError extends Error {
  constructor(
    readonly parameterName: string,
    readonly reason: string,
  ) {
    super(`Secret ${parameterName} is unavailable (${reason}).`);
    this.name = "SecretUnavailableError";
  }
}

export interface SecretLoader {
  /** The decrypted value of a parameter (cached for the TTL). */
  get(parameterName: string): Promise<string>;
}

export interface SecretLoaderOptions {
  readonly client: SsmSender;
  readonly ttlMs?: number;
  /** Milliseconds since epoch; injectable for tests. */
  readonly now?: () => number;
}

/** Placeholder Terraform writes until an administrator sets the real value out of band. */
export const SECRET_PLACEHOLDER = "SET-OUT-OF-BAND";

export function createSecretLoader({ client, ttlMs = DEFAULT_SECRET_TTL_MS, now = Date.now }: SecretLoaderOptions): SecretLoader {
  const cache = new Map<string, { value: string; expiresAt: number }>();
  const inFlight = new Map<string, Promise<string>>();

  async function load(parameterName: string): Promise<string> {
    let output: GetParameterCommandOutput;
    try {
      output = (await client.send(new GetParameterCommand({ Name: parameterName, WithDecryption: true }))) as GetParameterCommandOutput;
    } catch (error) {
      // Only the error name: SDK messages can contain request details.
      throw new SecretUnavailableError(parameterName, error instanceof Error ? error.name : "UnknownError");
    }
    const value = output.Parameter?.Value;
    if (value === undefined || value === "") throw new SecretUnavailableError(parameterName, "empty");
    if (value === SECRET_PLACEHOLDER) throw new SecretUnavailableError(parameterName, "not set yet");
    cache.set(parameterName, { value, expiresAt: now() + ttlMs });
    return value;
  }

  return {
    async get(parameterName: string): Promise<string> {
      const cached = cache.get(parameterName);
      if (cached && cached.expiresAt > now()) return cached.value;
      const pending = inFlight.get(parameterName) ?? load(parameterName).finally(() => inFlight.delete(parameterName));
      inFlight.set(parameterName, pending);
      return pending;
    },
  };
}

/** Parameter name per the naming standard: /tenner/<environment>/<component>/<name>. */
export function secretParameterName(environment: string, component: string, name: string): string {
  return `/tenner/${environment}/${component}/${name}`;
}
