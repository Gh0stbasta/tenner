/** Cognito implementation of the household membership store (HOTFIX-001). */

import {
  AdminAddUserToGroupCommand,
  AdminListGroupsForUserCommand,
  AdminRemoveUserFromGroupCommand,
  CreateGroupCommand,
  ListUsersInGroupCommand,
  type AdminListGroupsForUserCommandOutput,
  type ListUsersInGroupCommandOutput,
} from "@aws-sdk/client-cognito-identity-provider";
import type { CognitoSender } from "../../clients/cognito.js";
import { PersistenceError } from "../../exceptions/index.js";
import type { HouseholdMembershipRepository } from "../household-membership.repository.js";

/** Users have at most a handful of groups; one page is enough. */
const GROUP_PAGE_LIMIT = 60;

/** Cognito error name, e.g. ResourceNotFoundException. */
const errorName = (error: unknown): string | undefined => (error instanceof Error ? error.name : undefined);

function toPersistenceError(operation: string, error: unknown): PersistenceError {
  return new PersistenceError(`Failed to ${operation}.`, { cause: error });
}

export class CognitoHouseholdMembershipRepository implements HouseholdMembershipRepository {
  constructor(
    private readonly client: CognitoSender,
    private readonly userPoolId: string,
  ) {}

  async groupsOf(username: string): Promise<string[]> {
    try {
      const result = (await this.client.send(
        new AdminListGroupsForUserCommand({ UserPoolId: this.userPoolId, Username: username, Limit: GROUP_PAGE_LIMIT }),
      )) as AdminListGroupsForUserCommandOutput;
      return (result.Groups ?? []).map((group) => group.GroupName).filter((name): name is string => typeof name === "string");
    } catch (error) {
      throw toPersistenceError("load the user's groups", error);
    }
  }

  async memberCount(group: string): Promise<number> {
    try {
      const result = (await this.client.send(new ListUsersInGroupCommand({ UserPoolId: this.userPoolId, GroupName: group, Limit: 2 }))) as ListUsersInGroupCommandOutput;
      return Math.min(result.Users?.length ?? 0, 2);
    } catch (error) {
      // A member added in the app has no group until the first assignment: nobody has claimed it.
      if (errorName(error) === "ResourceNotFoundException") return 0;
      throw toPersistenceError("load the household member", error);
    }
  }

  async removeAllMembers(group: string): Promise<number> {
    let removed = 0;
    let nextToken: string | undefined;
    try {
      do {
        const page = (await this.client.send(
          new ListUsersInGroupCommand({ UserPoolId: this.userPoolId, GroupName: group, Limit: GROUP_PAGE_LIMIT, NextToken: nextToken }),
        )) as ListUsersInGroupCommandOutput;
        for (const user of page.Users ?? []) {
          if (!user.Username) continue;
          await this.client.send(new AdminRemoveUserFromGroupCommand({ UserPoolId: this.userPoolId, Username: user.Username, GroupName: group }));
          removed += 1;
        }
        nextToken = page.NextToken;
      } while (nextToken);
    } catch (error) {
      if (errorName(error) === "ResourceNotFoundException") return removed;
      throw toPersistenceError("revoke household access", error);
    }
    return removed;
  }

  async ensureGroup(group: string): Promise<void> {
    try {
      await this.client.send(
        new CreateGroupCommand({ UserPoolId: this.userPoolId, GroupName: group, Description: "Tenner household member (created on first assignment)." }),
      );
    } catch (error) {
      if (errorName(error) === "GroupExistsException") return;
      throw toPersistenceError("create the household group", error);
    }
  }

  async addMember(username: string, group: string): Promise<void> {
    try {
      await this.client.send(new AdminAddUserToGroupCommand({ UserPoolId: this.userPoolId, Username: username, GroupName: group }));
    } catch (error) {
      throw toPersistenceError("assign the household member", error);
    }
  }

  async removeMember(username: string, group: string): Promise<void> {
    try {
      await this.client.send(new AdminRemoveUserFromGroupCommand({ UserPoolId: this.userPoolId, Username: username, GroupName: group }));
    } catch (error) {
      throw toPersistenceError("undo the household assignment", error);
    }
  }
}
