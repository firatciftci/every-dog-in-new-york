import type { Attachment } from "svelte/attachments";

export function scrollEdges(axis: "y" | "x" = "y"): Attachment<HTMLElement> {
  return (node) => {
    let queued = 0;

    const read = () => {
      const isVertical = axis === "y";
      const at = isVertical ? node.scrollTop : node.scrollLeft;
      const view = isVertical ? node.clientHeight : node.clientWidth;
      const whole = isVertical ? node.scrollHeight : node.scrollWidth;

      // 1px slack for fractional layout.
      node.dataset.fadeStart = String(at > 1);
      node.dataset.fadeEnd = String(at + view < whole - 1);
    };

    // rAF-batched: reading scrollHeight forces layout.
    const schedule = () => {
      cancelAnimationFrame(queued);
      queued = requestAnimationFrame(read);
    };

    read();
    node.addEventListener("scroll", schedule, { passive: true });

    const resized = new ResizeObserver(schedule);
    resized.observe(node);

    // ResizeObserver misses content changes once the scroller is at its max height.
    const changed = new MutationObserver(schedule);
    changed.observe(node, { childList: true, subtree: true });

    return () => {
      cancelAnimationFrame(queued);
      node.removeEventListener("scroll", schedule);
      resized.disconnect();
      changed.disconnect();
    };
  };
}
