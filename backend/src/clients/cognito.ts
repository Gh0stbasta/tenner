/**
 * Cognito client for household self-assignment (HOTFIX-001).
 * One shared client per Lambda container. Only the household-membership repository uses it.
 */

import {
  CognitoIdentityProviderClient,
  type AdminAddUserToGroupCommand,
  type AdminListGroupsForUserCommand,
  type AdminRemoveUserFromGroupCommand,
  type ListUsersInGroupCommand,
} from "@aws-sdk/client-cognito-identity-provider";

/** Commands used by the application. */
export type CognitoCommand = AdminAddUserToGroupCommand | AdminRemoveUserFromGroupCommand | AdminListGroupsForUserCommand | ListUsersInGroupCommand;

/** Minimal client interface, so tests can provide a fake. */
export interface CognitoSender {
  send(command: CognitoCommand): Promise<unknown>;
}

let sharedClient: CognitoIdentityProviderClient | undefined;

export function getCognitoClient(): CognitoIdentityProviderClient {
  sharedClient ??= new CognitoIdentityProviderClient({ maxAttempts: 2 });
  return sharedClient;
}
