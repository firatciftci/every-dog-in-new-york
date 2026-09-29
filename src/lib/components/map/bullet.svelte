<script lang="ts">
  import type { System } from "$lib/rail";
  import { inkOn } from "$lib/rail";
  import { cn } from "$lib/utils";
  import NjIcon from "./nj-icon.svelte";

  let {
    system,
    route,
    bullet,
    color,
    small = false,
  }: {
    system: System;
    route: string;
    bullet: string;
    color: string;
    small?: boolean;
  } = $props();

  const ink = $derived(inkOn(color));

  const plate = $derived(system !== "subway" && system !== "path");
</script>

{#if system === "njt"}
  <span
    class={cn(
      "grid shrink-0 place-items-center rounded-[3px]",
      small ? "size-3.75" : "size-4.25",
    )}
    style:background={color}
    aria-hidden="true"
  >
    <NjIcon
      {route}
      body={ink}
      edge={color}
      class={cn("block", { "size-3.25": small, "size-3.75": !small })}
    />
  </span>
{:else}
  <span
    class={cn(
      "grid shrink-0 place-items-center font-sans font-bold tabular-nums",
      { "rounded-[3px]": plate, "rounded-full": !plate },
      { "h-3.75 min-w-3.75 px-0.75": small, "h-4.25 min-w-4.25 px-1": !small },
      { "ring-[1.5px] ring-inset": system === "path" },
    )}
    role="img"
    aria-label="{bullet} train"
    style:background={color}
    style:color={ink}
    style:--tw-ring-color={ink}
    style:font-size="{(small ? 7 : 8) + (bullet.length > 1 ? 0 : 3)}px"
  >
    {bullet}
  </span>
{/if}
