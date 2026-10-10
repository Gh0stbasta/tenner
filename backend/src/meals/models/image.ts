/** Dish photo limits (FOOD-011), shared by the validators and the image storage. */

export const IMAGE_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type ImageContentType = (typeof IMAGE_CONTENT_TYPES)[number];

export const IMAGE_LIMITS = {
  /** Largest upload S3 accepts; the app sends about 300 KB. */
  maxBytes: 2 * 1024 * 1024,
  /** Lifetime of a presigned upload URL. */
  uploadExpirySeconds: 300,
} as const;
