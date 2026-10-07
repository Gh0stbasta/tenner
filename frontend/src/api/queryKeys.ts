/** Query keys shared by features, so mutations can invalidate exactly what they change. */

export const queryKeys = {
  dashboard: ["dashboard"] as const,
  tenners: ["tenners"] as const,
  tennerList: (params: object) => ["tenners", "list", params] as const,
  tenner: (tennerId: string) => ["tenners", "detail", tennerId] as const,
  history: ["history"] as const,
  recentActivity: ["history", "recent"] as const,
  tennerHistory: (tennerId: string) => ["history", "tenner", tennerId] as const,
  onboarding: ["onboarding"] as const,
  household: ["household"] as const,
  alexa: ["household", "alexa"] as const,
  members: ["members"] as const,
  categories: ["categories"] as const,
  /** Meal planning (release 2.0). */
  meals: ["meals"] as const,
  mealIngredients: ["meals", "ingredients"] as const,
  mealProfile: ["meals", "profile"] as const,
  /** Plans have their own root so only they are kept offline (MOBILE-003), not the profile with allergies. */
  mealPlans: ["mealPlans"] as const,
  mealPlan: (week: string) => ["mealPlans", week] as const,
};
