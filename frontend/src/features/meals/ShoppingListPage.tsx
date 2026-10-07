/**
 * Shopping list /essen/einkaufsliste (FOOD-014): the week's ingredients in the household's own order (drag and drop
 * with mouse, touch or keyboard), ticked items struck through at the end, pantry items collapsed, own items, sharing.
 * Readable and usable offline: changes are queued and sent later (useShoppingChanges).
 */

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ShareOutlinedIcon from "@mui/icons-material/ShareOutlined";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Card,
  Checkbox,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { useState, type FormEvent } from "react";
import { Link as RouterLink } from "react-router";
import { errorMessage } from "../../api/errorMessages";
import { isApiError } from "../../api/errors";
import { ErrorAlert } from "../../components/ErrorAlert";
import { PageLoading } from "../../components/LoadingState";
import { useNotify } from "../../components/NotificationProvider";
import { PageHeader } from "../../components/PageHeader";
import { useOnline } from "../../hooks/useConnectivity";
import { formatShortDate } from "../../utils/format";
import { useRefreshShoppingList, useShoppingList, type ShoppingItem, type ShoppingRange, type WeekChoice } from "./api";
import { formatQuantity, groupShoppingItems, moveOperation, shareText, usedForLabel } from "./shopping";
import { useShoppingChanges } from "./useShoppingChanges";

interface RowProps {
  readonly item: ShoppingItem;
  readonly onCheck: (item: ShoppingItem, checked: boolean) => void;
  readonly onRemove: (item: ShoppingItem) => void;
  readonly sortable?: boolean;
}

function ItemContent({ item, onCheck, onRemove }: RowProps) {
  const quantity = formatQuantity(item);
  return (
    <>
      <Checkbox
        edge="start"
        checked={item.checked}
        onChange={(event) => onCheck(item, event.target.checked)}
        slotProps={{ input: { "aria-label": item.name } }}
        sx={{ "& .MuiSvgIcon-root": { fontSize: 28 } }}
      />
      <ListItemText
        primary={quantity ? `${quantity} ${item.name}` : item.name}
        secondary={usedForLabel(item.usedFor) || undefined}
        sx={item.checked ? { textDecoration: "line-through", color: "text.secondary" } : undefined}
      />
      {item.manual && (
        <IconButton aria-label={`Entfernen: ${item.name}`} onClick={() => onRemove(item)} size="small">
          <DeleteOutlinedIcon fontSize="small" />
        </IconButton>
      )}
    </>
  );
}

function SortableRow(props: RowProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: props.item.key,
  });
  return (
    <ListItem
      ref={setNodeRef}
      disableGutters
      sx={{
        transform: CSS.Transform.toString(transform),
        transition,
        bgcolor: isDragging ? "action.selected" : undefined,
        position: "relative",
        zIndex: isDragging ? 1 : undefined,
      }}
    >
      <IconButton
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={`Verschieben: ${props.item.name}`}
        size="small"
        sx={{ touchAction: "none", cursor: "grab", mr: 0.5 }}
      >
        <DragIndicatorIcon fontSize="small" />
      </IconButton>
      <ItemContent {...props} />
    </ListItem>
  );
}

function PlainRow(props: RowProps) {
  return (
    <ListItem disableGutters sx={{ pl: 4.5 }}>
      <ItemContent {...props} />
    </ListItem>
  );
}

export function ShoppingListPage() {
  const [week, setWeek] = useState<WeekChoice>("current");
  const list = useShoppingList(week);
  const refresh = useRefreshShoppingList(week);
  const { items, change, pending } = useShoppingChanges(list.data);
  const online = useOnline();
  const notify = useNotify();
  const [newItem, setNewItem] = useState("");
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const { open, pantry, done } = groupShoppingItems(items);
  const title = list.data ? `Einkaufsliste ${formatShortDate(list.data.weekStart)}` : "Einkaufsliste";

  const onCheck = (item: ShoppingItem, checked: boolean) => change([{ type: "check", key: item.key, checked }]);
  const onRemove = (item: ShoppingItem) => change([{ type: "remove", key: item.key }]);
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over) return;
    const operation = moveOperation(open, String(active.id), String(over.id));
    if (operation) change([operation]);
  };
  const addItem = (event: FormEvent) => {
    event.preventDefault();
    const name = newItem.trim();
    if (!name) return;
    change([{ type: "add", key: `manual-${crypto.randomUUID()}`, name: name.slice(0, 80) }]);
    setNewItem("");
  };
  const refreshList = (range?: ShoppingRange) =>
    refresh.mutate(range, { onError: (error) => notify({ message: errorMessage(error), severity: "error" }) });
  const share = async () => {
    const text = shareText(title, items);
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title, text });
        return;
      }
      await navigator.clipboard.writeText(text);
      notify({ message: "Einkaufsliste kopiert." });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      notify({ message: "Teilen hat nicht geklappt.", severity: "error" });
    }
  };

  const header = (
    <PageHeader
      title="Einkaufsliste"
      subtitle={list.data ? `Woche ab ${formatShortDate(list.data.weekStart)}` : undefined}
      actions={
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 1 }}>
          {list.data && (
            <Button variant="outlined" size="small" startIcon={<ShareOutlinedIcon />} onClick={() => void share()}>
              Teilen
            </Button>
          )}
          <ToggleButtonGroup
            exclusive
            size="small"
            value={week}
            onChange={(_, value: WeekChoice | null) => value && setWeek(value)}
            aria-label="Woche"
          >
            <ToggleButton value="current">Diese Woche</ToggleButton>
            <ToggleButton value="next">Nächste Woche</ToggleButton>
          </ToggleButtonGroup>
        </Stack>
      }
    />
  );

  if (list.isPending) return <PageLoading label="Einkaufsliste wird geladen" />;
  if (list.isError) {
    const noPlan = isApiError(list.error) && list.error.status === 404;
    return (
      <>
        {header}
        {noPlan ? (
          <Alert
            severity="info"
            action={
              <Button component={RouterLink} to="/essen" color="inherit" size="small">
                Zum Essensplan
              </Button>
            }
          >
            Für diese Woche gibt es noch keinen Essensplan, daraus entsteht die Einkaufsliste.
          </Alert>
        ) : (
          <ErrorAlert
            title="Einkaufsliste konnte nicht geladen werden"
            message={errorMessage(list.error)}
            onRetry={() => void list.refetch()}
          />
        )}
      </>
    );
  }

  const data = list.data;
  return (
    <>
      {header}
      <Stack spacing={2}>
        {data.stale && (
          <Alert
            severity="info"
            action={
              <Button
                color="inherit"
                size="small"
                onClick={() => refreshList()}
                disabled={!online || refresh.isPending}
              >
                Liste aktualisieren
              </Button>
            }
          >
            Der Essensplan hat sich geändert.
          </Alert>
        )}
        {pending > 0 && !online && (
          <Alert severity="warning">Offline: Änderungen werden übertragen, sobald du wieder online bist.</Alert>
        )}
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 1 }}>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={data.range}
            disabled={!online || refresh.isPending}
            onChange={(_, value: ShoppingRange | null) => value && value !== data.range && refreshList(value)}
            aria-label="Zeitraum"
          >
            <ToggleButton value="REST">Ab heute</ToggleButton>
            <ToggleButton value="WEEK">Ganze Woche</ToggleButton>
          </ToggleButtonGroup>
          <Button component={RouterLink} to="/essen" size="small">
            Zum Essensplan
          </Button>
        </Stack>
        <Box component="form" onSubmit={addItem} sx={{ display: "flex", gap: 1 }}>
          <TextField
            label="Eigener Eintrag"
            value={newItem}
            onChange={(event) => setNewItem(event.target.value)}
            size="small"
            fullWidth
            slotProps={{ htmlInput: { maxLength: 80 } }}
          />
          <Button type="submit" variant="contained" disabled={!newItem.trim()}>
            Hinzufügen
          </Button>
        </Box>
        <Card sx={{ px: 1 }}>
          {open.length === 0 ? (
            <Typography color="text.secondary" sx={{ p: 2 }}>
              {done.length > 0 ? "Alles erledigt." : "Nichts einzukaufen."}
            </Typography>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={open.map((item) => item.key)} strategy={verticalListSortingStrategy}>
                <List aria-label="Einkaufen" dense>
                  {open.map((item) => (
                    <SortableRow key={item.key} item={item} onCheck={onCheck} onRemove={onRemove} />
                  ))}
                </List>
              </SortableContext>
            </DndContext>
          )}
        </Card>
        {pantry.length > 0 && (
          <Accordion disableGutters>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography>Vorrat prüfen ({pantry.length})</Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 0 }}>
              <List aria-label="Vorrat" dense>
                {pantry.map((item) => (
                  <PlainRow key={item.key} item={item} onCheck={onCheck} onRemove={onRemove} />
                ))}
              </List>
            </AccordionDetails>
          </Accordion>
        )}
        {done.length > 0 && (
          <Card sx={{ px: 1 }}>
            <Typography variant="overline" color="text.secondary" sx={{ px: 1 }}>
              Erledigt ({done.length})
            </Typography>
            <List aria-label="Erledigt" dense>
              {done.map((item) => (
                <PlainRow key={item.key} item={item} onCheck={onCheck} onRemove={onRemove} />
              ))}
            </List>
          </Card>
        )}
      </Stack>
    </>
  );
}
