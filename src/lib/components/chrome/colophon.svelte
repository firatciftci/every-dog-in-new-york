<script lang="ts">
  import { slide } from "svelte/transition";
  import Shahmaran from "#lib/components/brand/shahmaran.svelte";
  import Newsletter from "#lib/components/chrome/newsletter.svelte";
  import { explorer } from "#lib/state.svelte.js";

  let asking = $state(false);
</script>

<footer class="shrink-0 border-t rule px-5 py-2.5">
  <p class="text-[0.71875rem] leading-relaxed text-foreground/60">
    Dogs from
    <a
      href="https://data.cityofnewyork.us/Health/NYC-Dog-Licensing-Dataset/nu7n-tubp"
      target="_blank"
      rel="noreferrer external"
      class="underline decoration-foreground/25 underline-offset-2 hover:decoration-foreground"
      >NYC Open Data</a
    >, basemap from
    <a
      href="https://openfreemap.org"
      target="_blank"
      rel="noreferrer external"
      class="underline decoration-foreground/25 underline-offset-2 hover:decoration-foreground"
      >OpenFreeMap</a
    >
    and
    <a
      href="https://www.openstreetmap.org/copyright"
      target="_blank"
      rel="noreferrer external"
      class="underline decoration-foreground/25 underline-offset-2 hover:decoration-foreground"
      >OpenStreetMap</a
    >.
    <button
      type="button"
      class="underline decoration-foreground/25 underline-offset-2 hover:decoration-foreground"
      onclick={() => (explorer.about = true)}>How I built it</button
    >. Made by
    <button
      type="button"
      class="group inline-flex items-baseline gap-1 text-cobalt underline decoration-cobalt/40 underline-offset-2 hover:decoration-cobalt"
      onclick={() => (explorer.maker = true)}
      ><Shahmaran
        height={12}
        class="translate-y-0.5 transition-transform duration-200 group-hover:translate-y-0"
      />Firat Ciftci</button
    >.
  </p>
  {#if asking}
    <div transition:slide={{ duration: 260 }} class="pt-2 pb-1">
      <p
        class="flex items-baseline gap-1 text-[0.71875rem] leading-relaxed text-cobalt"
      >
        <Shahmaran height={12} class="shrink-0 translate-y-0.5" />I’ll email you
        when I finish my next project.
      </p>
      <Newsletter from="everydog" eager />
    </div>
  {:else}
    <button
      type="button"
      class="group mt-1 inline-flex items-baseline gap-1 text-[0.71875rem] leading-relaxed text-cobalt underline decoration-cobalt/40 underline-offset-2 hover:decoration-cobalt"
      onclick={() => {
        asking = true;
      }}
      ><Shahmaran
        height={12}
        class="translate-y-0.5 transition-transform duration-200 group-hover:translate-y-0"
      />Hear about my next project</button
    >
  {/if}
</footer>
