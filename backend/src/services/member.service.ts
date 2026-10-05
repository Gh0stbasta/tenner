/** Household member management (HOUSEHOLD-ADMIN-001). Members live in the household item of tenner-households. */

import type { Identity } from "../auth/index.js";
import type { CreateMemberRequest, MemberResponse, UpdateMemberRequest } from "../dto/index.js";
import { ConflictError, NotFoundError, ValidationError } from "../exceptions/index.js";
import { SEED_MEMBERS, USER_ID_PATTERN, type HouseholdMember, type UserId } from "../models/index.js";
import type { HouseholdRepository } from "../repositories/index.js";
import { toUtcTimestamp, type Clock } from "../utils/clock.js";

/** Upper bound that keeps the household item small. */
export const MAX_MEMBERS = 20;

/** The household's members (stored list or seed). */
export type MemberSource = (tenantId: string) => Promise<readonly HouseholdMember[]>;

export class MemberService {
  constructor(
    private readonly repository: Pick<HouseholdRepository, "get" | "saveMembers">,
    private readonly clock: Clock,
  ) {}

  /** Stored members, or the seed members (STEFAN, JULIA) while the household has not saved a list. */
  async membersOf(tenantId: string): Promise<readonly HouseholdMember[]> {
    return (await this.load(tenantId)).members;
  }

  async listMembers(tenantId: string): Promise<MemberResponse[]> {
    return (await this.membersOf(tenantId)).map(toMemberResponse);
  }

  /** Add a member; userId defaults to a slug of the name ("Lena" → LENA) and must be unique (409 MEMBER_EXISTS). */
  async createMember(identity: Identity, request: CreateMemberRequest): Promise<MemberResponse> {
    const { members, version } = await this.load(identity.tenantId);
    const userId = request.userId ?? slugify(request.displayName);
    if (!USER_ID_PATTERN.test(userId)) {
      throw new ValidationError("Invalid member.", [{ field: "userId", message: "Cannot derive an ID from the name; provide userId (A-Z, 0-9, _)." }]);
    }
    if (members.some((member) => member.userId === userId)) throw new ConflictError(`Member ${userId} already exists.`, "MEMBER_EXISTS");
    if (members.length >= MAX_MEMBERS) {
      throw new ValidationError("Invalid member.", [{ field: "(root)", message: `A household can have at most ${MAX_MEMBERS} members.` }]);
    }
    const timestamp = toUtcTimestamp(this.clock());
    const member: HouseholdMember = { userId, displayName: request.displayName, color: request.color, active: true, createdAt: timestamp, updatedAt: timestamp };
    await this.repository.saveMembers(identity.tenantId, [...members, member], version, identity.userId, timestamp);
    return toMemberResponse(member);
  }

  /** Rename or recolor a member; the userId is immutable. Unknown member → 404. */
  async updateMember(identity: Identity, userId: UserId, request: UpdateMemberRequest): Promise<MemberResponse> {
    const { members, version } = await this.load(identity.tenantId);
    const current = members.find((member) => member.userId === userId);
    if (!current) throw new NotFoundError("Household member not found.");
    const timestamp = toUtcTimestamp(this.clock());
    const updated: HouseholdMember = {
      ...current,
      displayName: request.displayName ?? current.displayName,
      color: request.color ?? current.color,
      updatedAt: timestamp,
    };
    await this.repository.saveMembers(identity.tenantId, members.map((member) => (member.userId === userId ? updated : member)), version, identity.userId, timestamp);
    return toMemberResponse(updated);
  }

  private async load(tenantId: string): Promise<{ members: readonly HouseholdMember[]; version: number }> {
    const settings = await this.repository.get(tenantId);
    return { members: settings?.members ?? SEED_MEMBERS, version: settings?.membersVersion ?? 0 };
  }
}

export function toMemberResponse(member: HouseholdMember): MemberResponse {
  const { userId, displayName, color, active } = member;
  return { userId, displayName, color, active };
}

const UMLAUTS: Readonly<Record<string, string>> = { Ä: "AE", Ö: "OE", Ü: "UE", ß: "SS" };

/** "Lena-Marie" → LENA_MARIE; IDs must start with a letter (otherwise empty → validation error). */
export function slugify(name: string): string {
  const ascii = name
    .toUpperCase()
    .replace(/[ÄÖÜß]/g, (char) => UMLAUTS[char] ?? char)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  return ascii.replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 30).replace(/_+$/, "");
}

/** 400 unless `userId` is an active household member (assignedTo, completedBy). */
export function requireMember(members: readonly HouseholdMember[], userId: UserId, field: string): void {
  if (!members.some((member) => member.userId === userId && member.active)) {
    throw new ValidationError("Invalid request.", [{ field, message: "Unknown household member." }]);
  }
}
