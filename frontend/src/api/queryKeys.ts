/** Query keys shared by features, so mutations can invalidate exactly what they change. */

export const queryKeys = {
  dashboard: ["dashboard"] as const,
  tenners: ["tenners"] as const,
  tennerList: (params: object) => ["tenners", "list", params] as const,
  tenner: (tennerId: string) => ["tenners", "detail", tennerId] as const,
  history: ["history"] as const,
  recentActivity: ["history", "recent"] as const,
  tennerHistory: (tennerId: string) => ["history", "tenner", tennerId] as const,
};
