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

- [ ] Photos can be uploaded from the phone camera or gallery
- [ ] Images are private in S3 and served via CloudFront
- [ ] Upload limited in type, size and tenant prefix
- [ ] Placeholders when no photo exists
- [ ] Tests passing

---

# Definition of Done

- [ ] Implementation completed
- [ ] Tests completed
- [ ] Documentation updated
- [ ] Technical debt documented
- [ ] Acceptance criteria verified
- [ ] Git commit created

---

# Assumptions

- Images are served without signed URLs (unguessable keys); they show food, not people. Photos of people are not
  the intended content (hint in the UI).
- Storage cost is negligible (≈ 100 images × 300 KB).

---

# Out of Scope

- Stock images and AI-generated images (FOOD-024).
- Server-side image processing.
