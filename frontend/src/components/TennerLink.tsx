import { Link } from "@mui/material";
import type { ReactNode } from "react";
import { Link as RouterLink } from "react-router";

/** Title link to the Tenner detail page (FRONTEND-009). */
export function TennerLink({ tennerId, children }: { readonly tennerId: string; readonly children: ReactNode }) {
  return (
    <Link component={RouterLink} to={`/tenners/${encodeURIComponent(tennerId)}`} color="inherit" underline="hover">
      {children}
    </Link>
  );
}
