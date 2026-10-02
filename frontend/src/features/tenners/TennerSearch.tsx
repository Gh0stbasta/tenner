import SearchIcon from "@mui/icons-material/Search";
import { InputAdornment, TextField } from "@mui/material";

export interface TennerSearchProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
}

/** Free-text search on titles; the page debounces the value (300 ms). */
export function TennerSearch({ value, onChange }: TennerSearchProps) {
  return (
    <TextField
      type="search"
      label="Suche"
      placeholder="Titel durchsuchen"
      size="small"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      fullWidth
      slotProps={{
        input: {
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon />
            </InputAdornment>
          ),
        },
      }}
    />
  );
}
