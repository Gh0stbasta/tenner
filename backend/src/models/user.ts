import type { UserId } from "./enums.js";

/** A household member. */
export interface User {
  readonly userId: UserId;
  readonly displayName: string;
  readonly active: boolean;
}

/** Configured household members (version 1: manual configuration, no registration). */
export const HOUSEHOLD_USERS: readonly User[] = [
  { userId: "STEFAN", displayName: "Stefan", active: true },
  { userId: "JULIA", displayName: "Julia", active: true },
];
