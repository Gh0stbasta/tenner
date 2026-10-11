# MAINT-013: Change a dish photo from „Heute essen wir“

## Goal

Tapping a dish picture on the dashboard card „Heute essen wir“ lets the owner add or replace the dish's photo with the
phone camera or from the gallery.

## Context

Owner request (2026-10-11): „ich will bei "heute essen wir" auf das bild klicken können, um das bild zu ändern und
mittels handykamera oder galerie eins hinzufügen können.“ Photos exist since FOOD-011 but can only be changed in the
dish editor (Essen → Gerichte → edit).

## Requirements

- The picture of each of today's dishes is a button „Foto ändern: <dish>“ with a small camera badge.
- Tapping it opens the device's file chooser for images without the `capture` attribute, so phones offer camera and
  gallery.
- The photo is shrunk in the browser and uploaded like in the editor (FOOD-011: `resizePhoto`, `useDishPhoto`); the
  card shows the new photo after the upload.
- While uploading the button is disabled and shows progress; success and errors are reported as snackbar messages.
- Meals without a dish have no button.

## Acceptance Criteria

- [x] Tapping the picture opens the image chooser (camera or gallery)
- [x] A chosen photo is uploaded and attached to the dish
- [x] Progress, success and error feedback
- [x] Tests passing

## Definition of Done

- [x] Implementation completed
- [x] Tests completed
- [x] Documentation updated
- [x] Technical debt documented
- [x] Acceptance criteria verified
- [x] Git commit created

## Implementation Status

Done (2026-10-11). New `DishPhotoButton.tsx`: `ButtonBase` as label around `DishImage` with a hidden
`<input type="file" accept="image/*">` (no `capture`), camera badge that turns into a spinner while busy; on change
`resizePhoto` then `useDishPhoto` (presigned upload, attach, invalidate meals and plans, so the card reloads with the
new photo); snackbars for success and errors. `TodayMealsCard` uses it for every meal with a dish. Tests: upload flow
(requests in order, no `capture`, confirmation) and a failed S3 upload. Validation: lint, typecheck, all frontend
tests. New technical debt TD-048 (the editor's input still has `capture`).

## Assumptions

- Changing the photo needs a connection (same as in the editor); offline the upload fails with a message.
- Removing a photo stays in the editor.

## Out of Scope

- Changing photos from the meal plan page.
- Changing the editor's photo button (see technical debt for its `capture` attribute).
