import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../api/queryKeys";
import { fetchRecentActivity } from "./api";

/** Last 10 completions of the household (FRONTEND-007). */
export function useRecentActivity() {
  return useQuery({ queryKey: queryKeys.recentActivity, queryFn: fetchRecentActivity });
}
