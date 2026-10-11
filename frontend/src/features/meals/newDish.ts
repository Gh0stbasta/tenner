/** Opening the dish editor for a new dish by URL, used by the plus button on the meal pages (MAINT-008). */

/** Query parameter that makes the dish page open the editor for a new dish. */
export const NEW_DISH_PARAM = "new";

/** Dish page with the editor for a new dish open. */
export const NEW_DISH_PATH = `/essen/gerichte?${NEW_DISH_PARAM}=1`;

/** True on the meal plan and the dish page; the shopping list under /essen is its own page. */
export function isDishPage(pathname: string): boolean {
  return /^\/essen(\/gerichte)?\/?$/.test(pathname);
}
