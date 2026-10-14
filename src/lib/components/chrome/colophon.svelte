<script lang="ts">
  import { MailIcon } from "@lucide/svelte";
  import { on } from "svelte/events";
  import { prefersReducedMotion } from "svelte/motion";
  import { slide } from "svelte/transition";
  import Shahmaran from "#lib/components/brand/shahmaran.svelte";
  import Newsletter from "#lib/components/chrome/newsletter.svelte";
  import { explorer } from "#lib/state.svelte.js";

  let asking = $state(false);

  function show(node: HTMLElement) {
    node.scrollIntoView({
      block: "end",
      behavior: prefersReducedMotion.current ? "instant" : "smooth",
    });
  }

  // The sheet shrinks to the visual viewport when the iOS keyboard opens, so the field scrolls back into what is left.
  function keep(node: HTMLDivElement) {
    node.focus({ preventScroll: true });
    const port = window.visualViewport;
    if (port == null) {
      return;
    }

    return on(port, "resize", () => {
      const field = document.activeElement;
      if (field instanceof HTMLInputElement && node.contains(field)) {
        requestAnimationFrame(() => show(node));
      }
    });
  }
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
    <div
      {@attach keep}
      transition:slide={{ duration: 260 }}
      onintroend={(event) => show(event.currentTarget)}
      tabindex="-1"
      class="scroll-mb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-2 pb-1 outline-none"
    >
      <p
        class="flex items-baseline gap-1 text-[0.71875rem] leading-relaxed text-cobalt"
      >
        <MailIcon
          aria-hidden="true"
          class="size-3.5 shrink-0 translate-y-0.75 transition-transform duration-200 group-hover:-rotate-8"
          strokeWidth={1.75}
        />I’ll email you when I finish my next project.
      </p>
      <Newsletter from="everydog" />
    </div>
  {:else}
    <button
      type="button"
      class="group mt-1 inline-flex items-center gap-1.5 text-[0.71875rem] leading-relaxed text-cobalt underline decoration-cobalt/40 underline-offset-2 hover:decoration-cobalt"
      onclick={() => {
        asking = true;
      }}
      ><MailIcon
        aria-hidden="true"
        class="size-3.5 shrink-0 transition-transform duration-200 group-hover:-rotate-8"
        strokeWidth={1.75}
      />Hear about my next project</button
    >
  {/if}
</footer>
