/** One household member to choose on the assignment page (HOTFIX-001). */

import PersonOutlinedIcon from "@mui/icons-material/PersonOutlined";
import { Card, CardActionArea, CardContent, Typography } from "@mui/material";
import type { HouseholdMemberOption } from "./api";

export interface AssignmentCardProps {
  readonly member: HouseholdMemberOption;
  readonly disabled: boolean;
  readonly onSelect: (member: HouseholdMemberOption) => void;
}

export function AssignmentCard({ member, disabled, onSelect }: AssignmentCardProps) {
  const unavailable = !member.available;
  return (
    <Card variant="outlined" sx={{ opacity: unavailable ? 0.6 : 1 }}>
      <CardActionArea
        disabled={disabled || unavailable}
        onClick={() => onSelect(member)}
        aria-label={unavailable ? `${member.displayName} (bereits vergeben)` : `Ich bin ${member.displayName}`}
        sx={{ minHeight: 96 }}
      >
        <CardContent sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <PersonOutlinedIcon aria-hidden sx={{ fontSize: 40 }} />
          <div>
            <Typography variant="h3" component="p">
              {member.displayName}
            </Typography>
            {unavailable && (
              <Typography variant="body2" color="text.secondary">
                Bereits vergeben
              </Typography>
            )}
          </div>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
