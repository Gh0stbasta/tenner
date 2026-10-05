/** /users contracts (HOUSEHOLD-ADMIN-001). */

import type { MemberColor, UserId } from "../models/index.js";

export interface MemberResponse {
  readonly userId: UserId;
  readonly displayName: string;
  readonly color: MemberColor;
  readonly active: boolean;
}

export interface CreateMemberRequest {
  /** Optional; derived from displayName when omitted. Immutable afterwards. */
  readonly userId?: UserId | undefined;
  readonly displayName: string;
  readonly color: MemberColor;
}

export interface UpdateMemberRequest {
  readonly displayName?: string | undefined;
  readonly color?: MemberColor | undefined;
}
