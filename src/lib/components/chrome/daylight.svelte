<script lang="ts">
  import { MoonIcon, SunIcon } from "@lucide/svelte";
  import { mode, resetMode, setMode, systemPrefersMode } from "mode-watcher";
  import { cn } from "#lib/utils.js";

  let {
    horizon = false,
    class: className,
  }: { horizon?: boolean; class?: string } = $props();

  const swap = $derived(
    mode.current === "dark" ? "Switch to light mode" : "Switch to dark mode",
  );

  // A press that lands on the system preference clears the stored mode instead of pinning it.
  function flip() {
    const going = mode.current === "dark" ? "light" : "dark";

    if (going === systemPrefersMode.current) {
      resetMode();
    } else {
      setMode(going);
    }
  }
</script>

<button
  type="button"
  class={cn("group grid place-items-center", className)}
  aria-label={swap}
  title={swap}
  onclick={flip}
>
  <span
    class={cn("block", {
      "transition-transform duration-300 ease-out group-hover:-translate-y-0.5":
        horizon,
    })}
  >
    {#if mode.current === "dark"}
      <SunIcon aria-hidden="true" class="size-4.5 text-current" />
    {:else}
      <MoonIcon aria-hidden="true" class="size-4.5 text-current" />
    {/if}
  </span>

  {#if horizon}
    <span
      aria-hidden="true"
      class="mt-1 h-0.75 w-6 rounded-[50%] bg-primary/70 transition-colors duration-200 group-hover:bg-primary"
    ></span>
  {/if}
</button>
