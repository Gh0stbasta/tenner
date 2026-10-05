/** Icon for a category icon ID (HOUSEHOLD-ADMIN-002). */

import CleaningServicesOutlinedIcon from "@mui/icons-material/CleaningServicesOutlined";
import DirectionsCarOutlinedIcon from "@mui/icons-material/DirectionsCarOutlined";
import FamilyRestroomOutlinedIcon from "@mui/icons-material/FamilyRestroomOutlined";
import FavoriteBorderOutlinedIcon from "@mui/icons-material/FavoriteBorderOutlined";
import FitnessCenterOutlinedIcon from "@mui/icons-material/FitnessCenterOutlined";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import PersonOutlinedIcon from "@mui/icons-material/PersonOutlined";
import PetsOutlinedIcon from "@mui/icons-material/PetsOutlined";
import SavingsOutlinedIcon from "@mui/icons-material/SavingsOutlined";
import StarBorderOutlinedIcon from "@mui/icons-material/StarBorderOutlined";
import WorkOutlineOutlinedIcon from "@mui/icons-material/WorkOutlineOutlined";
import YardOutlinedIcon from "@mui/icons-material/YardOutlined";
import type { SvgIconProps } from "@mui/material";
import type { ComponentType } from "react";
import type { CategoryIcon as CategoryIconId } from "../../types/domain";

const ICONS: Readonly<Record<CategoryIconId, ComponentType<SvgIconProps>>> = {
  HOME: HomeOutlinedIcon,
  CLEANING: CleaningServicesOutlinedIcon,
  FITNESS: FitnessCenterOutlinedIcon,
  FAMILY: FamilyRestroomOutlinedIcon,
  PERSON: PersonOutlinedIcon,
  MONEY: SavingsOutlinedIcon,
  GARDEN: YardOutlinedIcon,
  PET: PetsOutlinedIcon,
  CAR: DirectionsCarOutlinedIcon,
  HEALTH: FavoriteBorderOutlinedIcon,
  WORK: WorkOutlineOutlinedIcon,
  STAR: StarBorderOutlinedIcon,
};

export function CategoryIcon({ icon, ...props }: { readonly icon: CategoryIconId } & SvgIconProps) {
  const Icon = ICONS[icon];
  return <Icon aria-hidden {...props} />;
}
