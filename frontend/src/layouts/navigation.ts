/** Navigation entries (FRONTEND-001). Analytics is a placeholder for now; Settings since FRONTEND-008. */

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
