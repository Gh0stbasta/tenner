/**
 * SSM Parameter Store client for secrets (SECURITY-006, ADR 0004). One shared client per Lambda container; only
 * the secret loader uses it.
 */

import { SSMClient, type GetParameterCommand } from "@aws-sdk/client-ssm";

/** Minimal client interface, so tests can provide a fake. */
export interface SsmSender {
  send(command: GetParameterCommand): Promise<unknown>;
}

let sharedClient: SSMClient | undefined;

export function getSsmClient(): SSMClient {
  sharedClient ??= new SSMClient({ maxAttempts: 2 });
  return sharedClient;
}
