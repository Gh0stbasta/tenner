/** Skeleton loading components (FRONTEND-001). Skeletons instead of spinner-only loading. */

import { Box, Card, CardContent, Skeleton, Stack } from "@mui/material";

export interface SkeletonListProps {
  readonly count?: number;
  readonly label?: string;
}

/** A list of skeleton cards, e.g. while Tenners load. */
export function SkeletonList({ count = 3, label = "Wird geladen" }: SkeletonListProps) {
  return (
    <Stack spacing={1.5} role="status" aria-label={label} aria-busy="true">
      {Array.from({ length: count }, (_, index) => (
        <Card key={index}>
          <CardContent>
            <Skeleton variant="text" width="60%" height={28} />
            <Skeleton variant="text" width="40%" />
          </CardContent>
        </Card>
      ))}
    </Stack>
  );
}

/** Loading placeholder for one section of a page. */
export function SectionLoading({ label = "Bereich wird geladen" }: { readonly label?: string }) {
  return (
    <Box role="status" aria-label={label} aria-busy="true">
      <Skeleton variant="text" width={180} height={32} />
      <Skeleton variant="rounded" height={96} />
    </Box>
  );
}

/** Loading placeholder for a whole page: header, metrics and list. */
export function PageLoading({ label = "Seite wird geladen" }: { readonly label?: string }) {
  return (
    <Box role="status" aria-label={label} aria-busy="true">
      <Skeleton variant="text" width={240} height={44} />
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" }, gap: 2, my: 3 }}>
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} variant="rounded" height={88} />
        ))}
      </Box>
      <Skeleton variant="rounded" height={72} sx={{ mb: 1.5 }} />
      <Skeleton variant="rounded" height={72} sx={{ mb: 1.5 }} />
      <Skeleton variant="rounded" height={72} />
    </Box>
  );
}
