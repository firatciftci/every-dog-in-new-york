<script lang="ts">
  /* eslint-disable no-restricted-imports */
  import type { Snippet } from "svelte";
  import { mode, ModeWatcher } from "mode-watcher";
  import "../app.css";

  let { children }: { children: Snippet } = $props();

  // Must match the transition-duration of html.printing in app.css.
  const DISSOLVE = 320;

  let printed: "light" | "dark" | undefined;

  $effect(() => {
    const now = mode.current;
    if (now === printed) {
      return;
    }

    const opening = printed === undefined;
    printed = now;
    if (opening) {
      return;
    }

    const root = document.documentElement;
    root.classList.add("printing");
    const done = setTimeout(() => {
      root.classList.remove("printing");
    }, DISSOLVE);

    return () => {
      clearTimeout(done);
      root.classList.remove("printing");
    };
  });
</script>

<!-- mode-watcher disables transitions during a theme change by default; html.printing needs them. -->
<ModeWatcher disableTransitions={false} />

{@render children()}
