/**
 * Household categories (HOUSEHOLD-ADMIN-002): add, rename, icon/color, reorder, archive. Archived categories stay on
 * existing Tenners but cannot be chosen for new ones.
 */

import ArchiveOutlinedIcon from "@mui/icons-material/ArchiveOutlined";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import UnarchiveOutlinedIcon from "@mui/icons-material/UnarchiveOutlined";
import AddIcon from "@mui/icons-material/Add";
import { Alert, Box, Button, IconButton, List, ListItem, ListItemIcon, ListItemText } from "@mui/material";
import { useState } from "react";
import { errorMessage } from "../../api/errorMessages";
import { useNotify } from "../../components/NotificationProvider";
import { MEMBER_COLOR_VALUES } from "../../types/domain";
import { useCategories, useUpdateCategory, type CategoryChanges, type CategoryEntry } from "../categories/api";
import { CategoryDialog } from "../categories/CategoryDialog";
import { CategoryIcon } from "../categories/CategoryIcon";
import { SettingsSection } from "./SettingsSection";

export function CategoriesSettings() {
  const categories = useCategories();
  const update = useUpdateCategory();
  const notify = useNotify();
  /** undefined = closed, null = add, CategoryEntry = edit */
  const [editing, setEditing] = useState<CategoryEntry | null | undefined>(undefined);
  const list = categories.data ?? [];

  const change = (category: CategoryEntry, changes: CategoryChanges, message?: string) =>
    update.mutate(
      { categoryId: category.categoryId, changes },
      {
        onSuccess: () => message && notify({ message }),
        onError: (error) => notify({ message: `Speichern fehlgeschlagen. ${errorMessage(error)}`, severity: "error" }),
      },
    );

  return (
    <SettingsSection
      title="Kategorien"
      description="Gilt für alle im Haushalt. Archivierte Kategorien bleiben an bestehenden Tennern, sind für neue aber nicht wählbar."
    >
      {categories.isError && (
        <Alert severity="error">Kategorien konnten nicht geladen werden. {errorMessage(categories.error)}</Alert>
      )}
      <List dense disablePadding aria-label="Kategorien">
        {list.map((category, index) => (
          <ListItem key={category.categoryId} disableGutters sx={{ opacity: category.archived ? 0.6 : 1, pr: 0 }}>
            <ListItemIcon sx={{ minWidth: 36 }}>
              <CategoryIcon icon={category.icon} sx={{ color: MEMBER_COLOR_VALUES[category.color] }} />
            </ListItemIcon>
            <ListItemText primary={category.name} secondary={category.archived ? "Archiviert" : undefined} />
            <Box sx={{ display: "flex", flexShrink: 0 }}>
              <IconButton
                aria-label={`${category.name} nach oben`}
                disabled={index === 0 || update.isPending}
                onClick={() => change(category, { sortOrder: index - 1 })}
              >
                <ArrowUpwardIcon fontSize="small" />
              </IconButton>
              <IconButton
                aria-label={`${category.name} nach unten`}
                disabled={index === list.length - 1 || update.isPending}
                onClick={() => change(category, { sortOrder: index + 1 })}
              >
                <ArrowDownwardIcon fontSize="small" />
              </IconButton>
              <IconButton aria-label={`${category.name} bearbeiten`} onClick={() => setEditing(category)}>
                <EditOutlinedIcon fontSize="small" />
              </IconButton>
              <IconButton
                aria-label={category.archived ? `${category.name} wiederherstellen` : `${category.name} archivieren`}
                disabled={update.isPending}
                onClick={() =>
                  change(
                    category,
                    { archived: !category.archived },
                    category.archived ? `„${category.name}“ wiederhergestellt.` : `„${category.name}“ archiviert.`,
                  )
                }
              >
                {category.archived ? (
                  <UnarchiveOutlinedIcon fontSize="small" />
                ) : (
                  <ArchiveOutlinedIcon fontSize="small" />
                )}
              </IconButton>
            </Box>
          </ListItem>
        ))}
      </List>
      <Button startIcon={<AddIcon />} onClick={() => setEditing(null)} disabled={!categories.isSuccess} sx={{ mt: 1 }}>
        Kategorie hinzufügen
      </Button>
      {editing !== undefined && (
        <CategoryDialog key={editing?.categoryId ?? "new"} category={editing} onClose={() => setEditing(undefined)} />
      )}
    </SettingsSection>
  );
}
