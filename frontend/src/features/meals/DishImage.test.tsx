import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DishImage } from "./DishImage";

describe("DishImage (FOOD-011)", () => {
  it("shows the photo lazily and falls back to the category placeholder when it fails", () => {
    render(<DishImage name="Lasagne" category="PASTA" imageKey="images/meals/default/d/k.jpg" height={80} />);
    const photo = screen.getByRole("img", { name: "Foto: Lasagne" });
    expect(photo).toHaveAttribute("src", "/images/meals/default/d/k.jpg");
    expect(photo).toHaveAttribute("loading", "lazy");
    fireEvent.error(photo);
    expect(screen.getByRole("img", { name: "Kein Foto: Lasagne" })).toHaveTextContent("🍝");
  });

  it("shows a placeholder without photo and the preview before the upload", () => {
    const { rerender } = render(<DishImage name="Linsensuppe" category="SOUP" height={80} />);
    expect(screen.getByRole("img", { name: "Kein Foto: Linsensuppe" })).toHaveTextContent("🍲");
    rerender(<DishImage name="Linsensuppe" category="SOUP" previewUrl="blob:preview" height={80} />);
    expect(screen.getByRole("img", { name: "Foto: Linsensuppe" })).toHaveAttribute("src", "blob:preview");
  });
});
