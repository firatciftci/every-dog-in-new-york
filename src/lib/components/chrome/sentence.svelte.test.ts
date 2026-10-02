import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-svelte";
import { page } from "vitest/browser";
import { chip, figure, partsText, place } from "#lib/sentence.js";
import Sentence from "./sentence.svelte";

function visibleText(container: HTMLElement) {
  const copy = container.cloneNode(true) as HTMLElement;
  for (const hidden of copy.querySelectorAll(".sr-only")) {
    hidden.remove();
  }

  return copy.textContent;
}

describe("sentence.svelte", () => {
  it("closes punctuation up against the word before it", async () => {
    const parts = [
      chip("names", "Luna"),
      "is the most common dog name in New York, but not in the",
      place("Financial District"),
      ", where it is",
      chip("names", "Teddy"),
      ".",
    ];

    const { container } = await render(Sentence, { parts });

    expect(visibleText(container)).toBe(partsText(parts));
  });

  it("gives a part an action only when it carries one", async () => {
    const { container } = await render(Sentence, {
      parts: [chip("breeds", "Maltese"), place("Greenpoint", () => {})],
    });

    expect(container.querySelectorAll("button")).toHaveLength(1);
    expect(page.getByRole("button", { name: /Greenpoint/ })).toBeDefined();
  });

  it("underlines a bare word that opens something and never a chip", async () => {
    const { container } = await render(Sentence, {
      parts: [chip("breeds", "Jindo", () => {}), figure("2,663", () => {})],
    });

    const [dressed, bare] = [...container.querySelectorAll("button")];

    expect(dressed?.className).not.toContain("underline");
    expect(bare?.className).toContain("underline");
  });

  it("runs the action behind a figure", async () => {
    const go = vi.fn();
    await render(Sentence, { parts: [figure("197", go)] });

    await page.getByRole("button", { name: "197" }).click();

    expect(go).toHaveBeenCalledOnce();
  });
});
