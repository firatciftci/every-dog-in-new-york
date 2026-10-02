<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";
  import { on } from "svelte/events";
  import { cn } from "#lib/utils.js";

  let {
    children,
    class: className,
    ...rest
  }: { children?: Snippet } & HTMLAttributes<HTMLDivElement> = $props();

  const GRABBED = 10;

  // Mouse only: a coarse pointer already scrolls this natively.
  function wire(node: HTMLDivElement) {
    let from: { x: number; left: number } | null = null;
    let dragged = false;

    const release = () => {
      from = null;
      document.body.classList.remove("drag-scrolling");
    };

    const off = [
      on(node, "mousedown", (event) => {
        if (event.button !== 0 || node.scrollWidth <= node.clientWidth) {
          return;
        }

        from = { x: event.clientX, left: node.scrollLeft };
        dragged = false;
        document.body.classList.add("drag-scrolling");
        event.preventDefault();
      }),
      on(window, "mousemove", (event) => {
        if (from == null) {
          return;
        }

        const by = event.clientX - from.x;
        if (Math.abs(by) > GRABBED) {
          dragged = true;
        }

        node.scrollLeft = from.left - by;
      }),
      on(window, "mouseup", release),
      on(
        node,
        "click",
        (event) => {
          if (dragged) {
            event.preventDefault();
            event.stopPropagation();
          }
        },
        { capture: true },
      ),
    ];

    return () => {
      for (const end of off) {
        end();
      }

      release();
    };
  }
</script>

<div
  {...rest}
  class={cn(
    "drag-scroll-container no-scrollbar cursor-grab overflow-auto",
    className,
  )}
  {@attach wire}
>
  {@render children?.()}
</div>
