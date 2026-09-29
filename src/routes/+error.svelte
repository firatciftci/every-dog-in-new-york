<script lang="ts">
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import Plate from "$lib/components/brand/plate.svelte";

  const lost = $derived(page.status === 404);
</script>

<svelte:head>
  <title>{lost ? "Lost" : "Bad dog"} · Every Dog in New York</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<main class="grid min-h-dvh place-items-center paper px-5 py-12">
  <div class="w-full max-w-lg text-center">
    <p
      class="slab text-[10px] tracking-[0.13em] text-muted-foreground uppercase"
    >
      Error {page.status}
    </p>

    <h1
      class="mt-3 rotate-[-1.4deg] poster text-[clamp(2.5rem,10.5vw,5.2rem)]"
      class:whitespace-nowrap={lost}
    >
      {lost ? "LOST" : "BAD DOG"}
    </h1>

    <div class="mt-8 flex justify-center">
      <Plate
        breed={lost ? "Beagle" : "Bull Dog, English"}
        height={112}
        class="origin-bottom wag-hover"
      />
    </div>
    <div class="mx-auto h-1.5 max-w-64 rounded-[50%] bg-primary/85"></div>

    <p
      class="mx-auto mt-6 max-w-md text-[15.5px] leading-relaxed text-balance text-foreground/85"
    >
      {#if lost}
        Nothing lives at
        <span class="slab text-[14px] break-all text-foreground">
          {page.url.pathname}
        </span>. Every dog in New York is on the map, and that is not one of
        them.
      {:else}
        <span class="mb-1 block font-bold"
          >{page.error?.message ?? "Something went wrong."}</span
        >
        Nothing you did caused it, and the map is still where you left it.
      {/if}
    </p>

    <div class="mt-9 flex justify-center">
      <a href={resolve("/")} class="shout px-7 py-2.5 text-[21px]">
        BACK TO THE MAP
      </a>
    </div>
  </div>
</main>
