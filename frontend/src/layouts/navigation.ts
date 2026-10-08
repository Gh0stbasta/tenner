/** Navigation entries (FRONTEND-001). Settings since FRONTEND-008; shopping list its own entry since FOOD-027. */

export interface NavigationItem {
  readonly label: string;
  readonly path: string;
  /** Shorter label for the bottom navigation, where six entries share a phone's width. */
  readonly shortLabel?: string;
}

export const NAVIGATION_ITEMS: readonly NavigationItem[] = [
  { label: "Dashboard", path: "/dashboard" },
  { label: "Aufgaben", path: "/tenners" },
  { label: "Essen", path: "/essen" },
  { label: "Einkaufsliste", path: "/einkaufsliste", shortLabel: "Einkauf" },
  { label: "Auswertung", path: "/analytics" },
  { label: "Einstellungen", path: "/settings" },
];
