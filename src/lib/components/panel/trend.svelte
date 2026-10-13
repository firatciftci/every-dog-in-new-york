<script lang="ts" module>
  import type { Facet, Trends } from "#lib/types.js";

  let pending: Promise<Trends | null> | null = null;

  async function load() {
    pending ??= fetch("/data/trends.json")
      .then(async (r) => (r.ok ? ((await r.json()) as Trends) : null))
      .catch(() => null);

    return pending;
  }

  const H = 40;
</script>

<script lang="ts">
  import { cn } from "#lib/utils.js";

  let {
    facet,
    label,
    mark,
  }: { facet: Facet; label: string; mark?: { year: number; color: string } } =
    $props();

  let trends = $state<Trends | null>(null);

  $effect(() => {
    let live = true;
    void load().then((found) => {
      if (live) {
        trends = found;
      }
    });

    return () => {
      live = false;
    };
  });

  const series = $derived(trends?.[facet][label] ?? null);
  const years = $derived(trends?.years ?? []);
  const top = $derived(series == null ? 1 : Math.max(...series, 0.01));
  const peak = $derived(series == null ? 0 : series.indexOf(top));

  let at = $state<number | null>(null);

  const x = (i: number) => (i / Math.max(1, years.length - 1)) * 100;
  const y = (v: number) => H - 3 - (v / top) * (H - 8);

  const marked = $derived(mark == null ? -1 : years.indexOf(mark.year));

  const line = $derived(
    series == null
      ? ""
      : series
          .map(
            (v, i) =>
              `${i === 0 ? "M" : "L"}${x(i).toFixed(2)} ${y(v).toFixed(2)}`,
          )
          .join(""),
  );
  const area = $derived(series == null ? "" : `${line}L100 ${H}L0 ${H}Z`);

  const per = (v: number) =>
    v >= 10 ? Math.round(v).toString() : v.toFixed(1);
  const unit = $derived(facet === "breeds" ? "dogs" : "named dogs");
  const shown = $derived(at ?? peak);
  const said = $derived(
    series == null
      ? ""
      : at == null
        ? `Most common among dogs born in ${years[peak]}, at ${per(top)} in every 1,000 ${unit}.`
        : `Born in ${years[at]}: ${per(series[at] ?? 0)} in every 1,000 ${unit}.`,
  );

  function pointAt(event: PointerEvent & { currentTarget: HTMLElement }) {
    const box = event.currentTarget.getBoundingClientRect();
    const t = (event.clientX - box.left) / Math.max(1, box.width);
    at = Math.min(
      years.length - 1,
      Math.max(0, Math.round(t * (years.length - 1))),
    );
  }
</script>

{#if series != null}
  <div class="mt-3">
    <h3 class="slab text-[0.8125rem]">By birth year</h3>
    <p
      class="mt-1 h-[2lh] text-[0.78125rem] leading-snug text-foreground/85"
      aria-live="off"
    >
      {said}
    </p>
    <div
      role="slider"
      tabindex="0"
      aria-label="{label} by birth year"
      aria-valuemin={years[0]}
      aria-valuemax={years.at(-1)}
      aria-valuenow={years[shown]}
      aria-valuetext={said}
      class="relative mt-1 h-10 cursor-crosshair touch-none rounded-[3px] outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
      onpointermove={pointAt}
      onpointerdown={pointAt}
      onpointerleave={() => {
        at = null;
      }}
      onblur={() => {
        at = null;
      }}
      onkeydown={(event) => {
        const step =
          event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
        if (step !== 0) {
          event.preventDefault();
          at = Math.min(years.length - 1, Math.max(0, (at ?? peak) + step));
        }
      }}
    >
      <svg
        viewBox="0 0 100 {H}"
        preserveAspectRatio="none"
        class="absolute inset-0 size-full overflow-visible"
        aria-hidden="true"
      >
        <path d={area} class="fill-primary/10" />
        <path
          d={line}
          class="fill-none stroke-foreground/80"
          stroke-width="1.5"
          stroke-linejoin="round"
          vector-effect="non-scaling-stroke"
        />
        <line
          x1={x(shown)}
          x2={x(shown)}
          y1="0"
          y2={H}
          class={cn("stroke-primary/60 transition-opacity duration-150", {
            "opacity-0": at == null,
          })}
          stroke-width="1"
          stroke-dasharray="2 2"
          vector-effect="non-scaling-stroke"
        />
      </svg>
      {#if mark != null && marked >= 0}
        <span
          aria-hidden="true"
          class="pointer-events-none absolute size-2.5 -translate-1/2 rotate-45 rounded-xs ring-2 ring-background"
          style:left="{x(marked)}%"
          style:top="{(y(series[marked] ?? 0) / H) * 100}%"
          style:background={mark.color}
        ></span>
      {/if}
      <span
        aria-hidden="true"
        class="pointer-events-none absolute size-2 -translate-1/2 rounded-full bg-primary ring-2 ring-background transition-[left,top] duration-150 ease-out"
        style:left="{x(shown)}%"
        style:top="{(y(series[shown] ?? 0) / H) * 100}%"
      ></span>
    </div>
    <div
      class="mt-1 flex justify-between numeric text-[0.65625rem] text-muted-foreground"
      aria-hidden="true"
    >
      <span>born {years[0]}</span>
      <span>{years.at(-1)}</span>
    </div>
  </div>
{/if}
