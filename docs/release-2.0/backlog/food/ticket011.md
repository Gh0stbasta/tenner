# FOOD-011: Dish Photos

## Type

Full-Stack Feature / Infrastructure

---

## Priority

Medium

---

## Phase

2.0 Extended

---

## Goal

Dishes get a photo — taken with the phone or picked from the gallery — so the plan, the Echo Show and the dish list
show what is for dinner, not only a name.

---

# Background

Owner breakdown FOOD-011: photo, stock image, AI-generated image. Photo upload uses only allowed services
(S3, CloudFront; ADR 0007). Stock and AI images need external services and are evaluated in FOOD-024.

---

# Dependencies

```text
FOOD-001 (ADR 0007, images)
FOOD-002
FOOD-010 (editor)
```

---

# Scope

## Infrastructure

- Private S3 bucket `tenner-meal-images-<env>` (block public access, encryption, versioning with 30-day noncurrent
  expiry, tags) as a second origin of the existing CloudFront distribution under `/images/*` with Origin Access
  Control; CSP `img-src` extended.
- API Lambda may `PutObject`/`DeleteObject` only under `meals/<tenantId>/`.

## Upload Flow

```text
browser: pick/take photo → resize to max 1200 px, JPEG/WebP ≤ 300 KB (canvas)
POST /meals/dishes/{dishId}/image-upload   → presigned PUT URL (5 min, content-type and size fixed)
PUT to S3 → PUT /meals/dishes/{dishId} { imageKey }
```

- Allowed types: JPEG, PNG, WebP; max 2 MB at S3 (presigned condition).
- Delete image; replacing deletes the old object.
- Placeholder illustration per category when no image exists.

## UI

- Editor: „Foto aufnehmen / auswählen“ (`<input type="file" accept="image/*" capture>`), preview, remove.
- Images on plan cards, today card, dish list; lazy loading.

---

# Testing Requirements

```text
Terraform: bucket settings, OAC, IAM prefix scope, CSP
Presigned URL constraints (type, size, expiry, key prefix per tenant)
Other tenant's key rejected
Client-side resize
Placeholder per category
```

Coverage for new code: 80% minimum.

---

# Deliverables

```text
Bucket and CloudFront origin
Upload endpoint
Editor and display
Tests
```

---

# Validation

```bash
cd terraform && terraform fmt -check -recursive && terraform validate && terraform test
cd backend && npm run lint && npm run typecheck && npm test
cd frontend && npm run lint && npm run build && npm test
```

---

# Acceptance Criteria

- [x] Photos can be uploaded from the phone camera or gallery
- [x] Images are private in S3 and served via CloudFront
- [x] Upload limited in type, size and tenant prefix
- [x] Placeholders when no photo exists
- [x] Tests passing

---

# Definition of Done

- [x] Implementation completed
- [x] Tests completed
- [x] Documentation updated
- [x] Technical debt documented
- [x] Acceptance criteria verified
- [x] Git commit created

---

# Assumptions

- Images are served without signed URLs (unguessable keys); they show food, not people. Photos of people are not
  the intended content (hint in the UI).
- Storage cost is negligible (≈ 100 images × 300 KB).
- Attaching uses its own route `PUT /meals/dishes/{dishId}/image` instead of `imageKey` in the general dish update, so
  the editor's save never touches the bucket and only keys issued for this dish are accepted. Removal:
  `DELETE /meals/dishes/{dishId}/image`.
- Keys are `images/meals/<tenantId>/<dishId>/<uuid>.<ext>`: CloudFront forwards the path, so the `/images/*` behavior
  needs the `images/` prefix; the IAM scope is `images/meals/*`.
- A presigned PUT cannot carry a size range, so the exact size (≤ 2 MB), type and cache header are signed instead.
- The browser always re-encodes as JPEG (every browser can encode it). In a new dish the photo is uploaded right
  after the first save.
- `img-src` needed no new host (same origin); it gained `blob:` for the preview. `connect-src` gained the bucket host.

---

# Out of Scope

- Stock images and AI-generated images (FOOD-024).
- Server-side image processing.

---

# Implementation Status

Done (2026-10-10).

- Infrastructure (`terraform/meal-images.tf`, `frontend-hosting.tf`, `iam.tf`, `api.tf`, `locals.tf`): private
  bucket `tenner-meal-images-<env>` (Block Public Access, SSE-S3, versioning with 30-day noncurrent expiry, TLS-only
  policy, read only by the distribution via OAC), CORS for PUT from the app origin, second CloudFront origin with
  behavior `/images/*` (cached, HTTPS), CSP `img-src … blob:` and `connect-src` with the bucket host, API role policy
  `-meal-images` (`PutObject`, `DeleteObject` on `images/meals/*`), env `MEAL_IMAGES_BUCKET`, three routes.
- Backend: `src/meals/images.ts` (keys, presigned PUT with signed type, size and cache header, quiet delete),
  `services/dish-image.service.ts` (upload, attach with key check per household and dish, replace deletes the old
  object, remove), `DishService.setImageKey`, handlers and routes, `src/clients/s3.ts`. New dependencies
  `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` 3.1145.0 (Apache-2.0, same SDK family, 0 audit findings).
- Frontend: `dishImages.ts` (resize with canvas, upload, placeholders), `DishImage.tsx`, photo section in the editor,
  photos on the dish list, plan cards and „Heute essen wir“.
- Tests: `backend/tests/meals-dish-images.test.ts` and route tests; `terraform/tests/meal_images.tftest.hcl` (bucket,
  OAC read, CORS, IAM prefix, CSP), `tests/api.tftest.hcl`; `frontend/src/features/meals/dishImages.test.ts`,
  `DishImage.test.tsx`, editor photo tests.
- Validation: backend lint, typecheck, 1,098 tests; frontend lint, typecheck, build, 474 tests; Terraform fmt,
  validate and all tests passed.
- Owner step **before merging**: if `GitHubActionsDeployRole` limits S3 rights to `tenner-frontend-<env>`, add
  `tenner-meal-images-<env>` with the same bucket rights plus `s3:PutBucketCORS`/`GetBucketCORS` (README → "CI
  Permissions"). Otherwise the deploy fails at the bucket. After the deploy: take a photo on the phone in „Gericht
  bearbeiten“.
- Technical debt: TD-045 (unattached uploads, SPA fallback for missing photos).

