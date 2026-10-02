/** Navigation entries (FRONTEND-001). Analytics and Settings are placeholders for now. */

export interface NavigationItem {
  readonly label: string;
  readonly path: string;
}

export const NAVIGATION_ITEMS: readonly NavigationItem[] = [
  { label: "Dashboard", path: "/dashboard" },
  { label: "Tenner", path: "/tenners" },
  { label: "Auswertung", path: "/analytics" },
  { label: "Einstellungen", path: "/settings" },
];
