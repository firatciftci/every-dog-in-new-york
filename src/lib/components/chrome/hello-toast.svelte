<script lang="ts">
  import { PawPrintIcon, XIcon } from "@lucide/svelte";
  import type { Kind, Shown } from "#lib/crowd.js";
  import Plate from "#lib/components/brand/plate.svelte";
  import HelloButton from "#lib/components/map/hello-button.svelte";
  import { crowd } from "#lib/crowd.svelte.js";
  import { collarOf, MIXED } from "#lib/pet.svelte.js";

  let {
    hello,
  }: {
    hello: {
      n: number;
      dog: number;
      kind: Kind;
      from: Shown | null;
      by: string;
      back: number | null;
      headline: string;
      where: string | null;
    };
  } = $props();

  const LINGER = 9000;
  const AFTER = 2600;
  const REPLIES: ReadonlyArray<{ kind: Kind; label: string; noun: string }> = [
    { kind: "sniff", label: "Sniff back", noun: "sniff" },
    { kind: "ball", label: "Toss one back", noun: "ball" },
    { kind: "bark", label: "Bark back", noun: "bark" },
  ];

  let held = $state(false);
  let sent = $state<Kind | null>(null);

  const collar = $derived(
    hello.from == null ? "#8a8170" : collarOf(hello.from.collar),
  );
  const sender = $derived.by(() => {
    const { from } = hello;
    if (from == null) {
      return "";
    }

    return (
      from.name ?? `The ${from.breed === MIXED ? "mixed breed" : from.breed}`
    );
  });

  $effect(() => {
    if (held) {
      return;
    }

    const timer = setTimeout(
      () => {
        crowd.dismiss(hello.n);
      },
      sent == null ? LINGER : AFTER,
    );

    return () => clearTimeout(timer);
  });
</script>

<div
  role="group"
  aria-label={hello.headline}
  class="pointer-events-auto relative rounded-[14px] rounded-tr-md paper py-3 pr-9 pl-3 text-foreground shadow-[0_12px_32px_rgb(20_16_10/0.4)] outline outline-foreground/15"
  style:--collar={collar}
  onpointerenter={() => {
    held = true;
  }}
  onpointerleave={() => {
    held = false;
  }}
  onfocusin={() => {
    held = true;
  }}
  onfocusout={(event) => {
    held = event.currentTarget.contains(event.relatedTarget as Node | null);
  }}
>
  <button
    type="button"
    aria-label="Dismiss"
    title="Dismiss"
    class="absolute top-1.5 right-1.5 grid size-7 cursor-pointer place-items-center rounded-full text-muted-foreground transition-colors duration-200 hover:text-foreground"
    onclick={() => {
      crowd.dismiss(hello.n);
    }}
  >
    <XIcon aria-hidden="true" class="size-3.5" />
  </button>

  <div class="flex items-center gap-3">
    <span
      aria-hidden="true"
      class="relative grid size-12 shrink-0 place-items-center rounded-full bg-[#f7f4ec] shadow-[0_0_0_2.5px_var(--collar),0_0_0_3.5px_rgb(255_255_255/0.8),0_4px_10px_rgb(20_16_10/0.3)] motion-safe:animate-[stamp_calc(var(--1s)*0.45)_cubic-bezier(0.2,0.9,0.25,1)_both]"
    >
      {#if hello.from == null}
        <PawPrintIcon class="size-6 text-[#1d1b18]" strokeWidth={1.75} />
      {:else}
        <span
          class="absolute inset-x-0 bottom-0.5 mx-auto block w-max origin-bottom motion-safe:animate-[wag_calc(var(--1s)*0.55)_ease-in-out_2_calc(var(--1s)*0.4)]"
        >
          <Plate breed={hello.from.breed} height={42} halo />
        </span>
      {/if}
    </span>
    <div class="min-w-0">
      <p class="text-[0.96875rem] leading-snug font-semibold text-pretty">
        {hello.headline}
      </p>
      {#if hello.where != null}
        <p class="mt-0.5 text-[0.75rem] leading-snug text-muted-foreground">
          {hello.where}
        </p>
      {/if}
    </div>
  </div>

  {#if hello.back != null}
    <div class="mt-3 -mr-6 border-t rule pt-2.5">
      {#if sent == null}
        <div class="grid grid-cols-3 gap-2">
          {#each REPLIES as { kind, label } (kind)}
            <HelloButton
              {kind}
              {label}
              onpress={() => {
                if (hello.back == null) {
                  return;
                }

                crowd.ping(hello.by, hello.back, kind, hello.dog);
                sent = kind;
              }}
            />
          {/each}
        </div>
      {:else}
        <p class="text-[0.78125rem] leading-snug text-muted-foreground">
          {sender} got your {REPLIES.find((r) => r.kind === sent)?.noun}.
        </p>
      {/if}
    </div>
  {/if}

  <button
    type="button"
    title="Your dog’s card brings them back."
    class="mt-2.5 cursor-pointer text-[0.6875rem] leading-snug text-muted-foreground underline decoration-current/40 decoration-dotted underline-offset-[3px] transition-colors duration-200 hover:text-foreground hover:decoration-current"
    onclick={() => {
      crowd.off = true;
    }}
  >
    Stop seeing other readers’ dogs
  </button>
</div>
