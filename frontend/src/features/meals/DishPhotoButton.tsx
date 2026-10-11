/**
 * Dish picture that changes the photo on tap (MAINT-013): opens the image chooser (camera or gallery, no `capture`
 * attribute), shrinks the photo and uploads it like the editor (FOOD-011).
 */

import PhotoCameraOutlinedIcon from "@mui/icons-material/PhotoCameraOutlined";
import { Box, ButtonBase, CircularProgress } from "@mui/material";
import { useState } from "react";
import { errorMessage } from "../../api/errorMessages";
import { useNotify } from "../../components/NotificationProvider";
import type { DishSummary } from "./api";
import { DishImage } from "./DishImage";
import { PhotoError, resizePhoto, useDishPhoto } from "./dishImages";

export interface DishPhotoButtonProps {
  readonly dish: Pick<DishSummary, "dishId" | "name" | "category" | "imageKey">;
  readonly height: number;
}

export function DishPhotoButton({ dish, height }: DishPhotoButtonProps) {
  const notify = useNotify();
  const photo = useDishPhoto();
  const [preparing, setPreparing] = useState(false);
  const busy = preparing || photo.isPending;

  const change = async (file: File | undefined) => {
    if (!file) return;
    setPreparing(true);
    let resized: Blob;
    try {
      resized = await resizePhoto(file);
    } catch (error) {
      notify({
        severity: "error",
        message: error instanceof PhotoError ? error.message : "Das Foto konnte nicht verarbeitet werden.",
      });
      return;
    } finally {
      setPreparing(false);
    }
    photo.mutate(
      { dishId: dish.dishId, change: { kind: "new", photo: resized } },
      {
        onSuccess: () => notify({ message: `📷 Foto für „${dish.name}“ gespeichert.` }),
        onError: (error) =>
          notify({
            severity: "error",
            message: `Foto nicht gespeichert. ${error instanceof PhotoError ? error.message : errorMessage(error)}`,
          }),
      },
    );
  };

  return (
    <ButtonBase
      component="label"
      aria-label={`Foto ändern: ${dish.name}`}
      aria-busy={busy}
      disabled={busy}
      sx={{ display: "block", width: "100%", position: "relative", borderRadius: 1, mb: 1 }}
    >
      <DishImage name={dish.name} category={dish.category} imageKey={dish.imageKey} height={height} />
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          right: 8,
          bottom: 8,
          width: 36,
          height: 36,
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: "background.paper",
          color: "text.primary",
          boxShadow: 1,
        }}
      >
        {busy ? <CircularProgress size={20} /> : <PhotoCameraOutlinedIcon fontSize="small" />}
      </Box>
      <input
        hidden
        type="file"
        accept="image/*"
        disabled={busy}
        aria-label={`Foto aufnehmen oder auswählen: ${dish.name}`}
        onChange={(event) => {
          void change(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
    </ButtonBase>
  );
}
