/**
 * A dish photo (FOOD-011) or, without one, a placeholder for the dish category. Photos load lazily; a photo that
 * fails to load falls back to the placeholder.
 */

import { Box, type SxProps, type Theme } from "@mui/material";
import { useState } from "react";
import { dishImageUrl, placeholderFor } from "./dishImages";

export interface DishImageProps {
  readonly name: string;
  readonly category: string;
  readonly imageKey?: string | undefined;
  /** Local preview (object URL) before the upload; wins over imageKey. */
  readonly previewUrl?: string | undefined;
  readonly width?: number | string;
  readonly height: number | string;
  readonly sx?: SxProps<Theme>;
}

export function DishImage({ name, category, imageKey, previewUrl, width = "100%", height, sx }: DishImageProps) {
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const src = previewUrl ?? (imageKey && imageKey !== failedKey ? dishImageUrl(imageKey) : undefined);
  const frame = { width, height, flexShrink: 0, borderRadius: 1, overflow: "hidden", ...sx } as const;
  if (src) {
    return (
      <Box
        component="img"
        src={src}
        alt={`Foto: ${name}`}
        loading="lazy"
        decoding="async"
        onError={() => imageKey && setFailedKey(imageKey)}
        sx={{ ...frame, objectFit: "cover", display: "block" }}
      />
    );
  }
  return (
    <Box
      role="img"
      aria-label={`Kein Foto: ${name}`}
      sx={{
        ...frame,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "action.hover",
        fontSize: typeof height === "number" ? Math.max(18, Math.round(height * 0.45)) : "2.5rem",
        userSelect: "none",
      }}
    >
      <span aria-hidden="true">{placeholderFor(category)}</span>
    </Box>
  );
}
