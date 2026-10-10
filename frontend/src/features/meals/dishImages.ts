/**
 * Dish photos (FOOD-011): shrink in the browser, upload straight to the private image bucket with a presigned PUT,
 * then attach the key to the dish. CloudFront serves the photos from this origin under /images/*.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { apiClient } from "../../api/client";
import { queryKeys } from "../../api/queryKeys";
import { dishSchema, type Dish } from "./dishes";

/** Same limits as the backend (backend/src/meals/models/image.ts). */
export const PHOTO_LIMITS = {
  maxEdge: 1200,
  /** Target size; the server accepts up to 2 MB. */
  targetBytes: 300 * 1024,
  maxBytes: 2 * 1024 * 1024,
} as const;

/** Photos are re-encoded as JPEG: every browser can encode it, and it is small for food photos. */
const OUTPUT_TYPE = "image/jpeg";
const QUALITIES = [0.85, 0.75, 0.65, 0.5] as const;

/** URL of a stored photo on this origin. */
export function dishImageUrl(imageKey: string): string {
  return `/${imageKey}`;
}

/** Placeholder per dish category: an emoji on a soft background. Unknown categories get a plate. */
export const CATEGORY_PLACEHOLDERS: Readonly<Record<string, string>> = {
  PASTA: "🍝",
  POTATO: "🥔",
  RICE: "🍚",
  BURGER_WRAP: "🍔",
  MEAT_FISH: "🍗",
  VEGETARIAN: "🥦",
  SALAD: "🥗",
  SOUP: "🍲",
  SWEET: "🥞",
  SNACK: "🥪",
};
const DEFAULT_PLACEHOLDER = "🍽️";

export function placeholderFor(category: string): string {
  return CATEGORY_PLACEHOLDERS[category] ?? DEFAULT_PLACEHOLDER;
}

/** Width and height that fit into maxEdge × maxEdge without upscaling. */
export function fitWithin(
  width: number,
  height: number,
  maxEdge: number = PHOTO_LIMITS.maxEdge,
): { width: number; height: number } {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export class PhotoError extends Error {}

/** Browser APIs used for resizing; tests pass fakes. */
export interface ImageTools {
  readonly decode: (file: Blob) => Promise<{
    readonly width: number;
    readonly height: number;
    readonly source: CanvasImageSource;
    readonly close?: () => void;
  }>;
  readonly encode: (source: CanvasImageSource, width: number, height: number, quality: number) => Promise<Blob>;
}

export const browserImageTools: ImageTools = {
  decode: async (file) => {
    // createImageBitmap applies the EXIF orientation of phone photos.
    const bitmap = await createImageBitmap(file);
    return { width: bitmap.width, height: bitmap.height, source: bitmap, close: () => bitmap.close() };
  },
  encode: (source, width, height, quality) =>
    new Promise((resolve, reject) => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) return reject(new PhotoError("Das Foto konnte nicht verarbeitet werden."));
      context.drawImage(source, 0, 0, width, height);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new PhotoError("Das Foto konnte nicht verarbeitet werden."))),
        OUTPUT_TYPE,
        quality,
      );
    }),
};

/** Shrink a photo to at most 1200 px and about 300 KB (JPEG); lower quality steps until it fits. */
export async function resizePhoto(file: Blob, tools: ImageTools = browserImageTools): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new PhotoError("Bitte ein Foto wählen.");
  let image: Awaited<ReturnType<ImageTools["decode"]>>;
  try {
    image = await tools.decode(file);
  } catch {
    throw new PhotoError("Dieses Bildformat kann der Browser nicht öffnen. Bitte ein JPEG- oder PNG-Foto wählen.");
  }
  try {
    const { width, height } = fitWithin(image.width, image.height);
    let blob: Blob | undefined;
    for (const quality of QUALITIES) {
      blob = await tools.encode(image.source, width, height, quality);
      if (blob.size <= PHOTO_LIMITS.targetBytes) return blob;
    }
    if (!blob || blob.size > PHOTO_LIMITS.maxBytes) throw new PhotoError("Das Foto ist zu groß.");
    return blob;
  } finally {
    image.close?.();
  }
}

const uploadSchema = z.object({
  imageKey: z.string(),
  uploadUrl: z.string().url(),
  headers: z.record(z.string(), z.string()),
  expiresInSeconds: z.number(),
});

/** Upload a (resized) photo and attach it; returns the saved dish. */
// S3 is not our API: the presigned URL must not get the API client's Authorization header.
// eslint-disable-next-line no-restricted-globals -- direct upload to the presigned S3 URL (FOOD-011)
const directFetch: typeof fetch = (...args) => fetch(...args);

export async function uploadDishPhoto(dishId: string, photo: Blob, put: typeof fetch = directFetch): Promise<Dish> {
  const path = `/meals/dishes/${encodeURIComponent(dishId)}`;
  const upload = await apiClient.post(`${path}/image-upload`, {
    schema: uploadSchema,
    body: { contentType: photo.type, size: photo.size },
  });
  // Straight to S3: no Authorization header, only the signed ones.
  const response = await put(upload.uploadUrl, { method: "PUT", headers: upload.headers, body: photo });
  if (!response.ok) throw new PhotoError("Das Foto konnte nicht hochgeladen werden. Bitte versuche es noch einmal.");
  return apiClient.put(`${path}/image`, { schema: dishSchema, body: { imageKey: upload.imageKey } });
}

/** Photo change of the editor, applied after the dish is saved. */
export type PhotoChange = { readonly kind: "new"; readonly photo: Blob } | { readonly kind: "remove" };

export function useDishPhoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ dishId, change }: { readonly dishId: string; readonly change: PhotoChange }) =>
      change.kind === "new"
        ? uploadDishPhoto(dishId, change.photo)
        : apiClient.delete(`/meals/dishes/${encodeURIComponent(dishId)}/image`, { schema: dishSchema }),
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.meals }),
        queryClient.invalidateQueries({ queryKey: queryKeys.mealPlans }),
      ]),
  });
}
