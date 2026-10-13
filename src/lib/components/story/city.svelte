<script lang="ts" module>
  import type { Position } from "geojson";
  import type { HoodCollection, ParkCollection } from "#lib/types.js";

  export type Project = (lon: number, lat: number) => [number, number];

  const COS = Math.cos((40.7 * Math.PI) / 180);

  export function frame(hoods: HoodCollection) {
    let west = Infinity;
    let east = -Infinity;
    let south = Infinity;
    let north = -Infinity;
    for (const f of hoods.features) {
      const polys =
        f.geometry.type === "Polygon"
          ? [f.geometry.coordinates]
          : f.geometry.coordinates;
      for (const poly of polys) {
        for (const [lon, lat] of poly[0]!) {
          west = Math.min(west, lon!);
          east = Math.max(east, lon!);
          south = Math.min(south, lat!);
          north = Math.max(north, lat!);
        }
      }
    }

    const width = (east - west) * COS;
    const height = north - south;

    return { west, north, width, height };
  }

  function ring(points: Array<Position>, at: Project) {
    let d = "";
    for (const [i, p] of points.entries()) {
      const [x, y] = at(p[0]!, p[1]!);
      d += `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    }

    return `${d}Z`;
  }

  export function outline(
    geometry: HoodCollection["features"][number]["geometry"],
    at: Project,
  ) {
    const polys =
      geometry.type === "Polygon"
        ? [geometry.coordinates]
        : geometry.coordinates;
    let d = "";
    for (const poly of polys) {
      for (const points of poly) {
        d += ring(points, at);
      }
    }

    return d;
  }
</script>

<script lang="ts">
  import type { Snippet } from "svelte";
  import { cn } from "#lib/utils.js";

  let {
    hoods,
    parks = null,
    fill,
    lit,
    marks = [],
    focus = null,
    over,
    class: className,
  }: {
    hoods: HoodCollection;
    parks?: ParkCollection | null;
    fill: (slug: string) => string;
    lit?: (slug: string) => boolean;
    marks?: Array<{ slug: string; text: string; sub?: string }>;
    focus?: string | null;
    over?: Snippet<[Project, number]>;
    class?: string;
  } = $props();

  let width = $state(0);
  let height = $state(0);

  const box = $derived(frame(hoods));

  const scale = $derived(
    width > 0 && height > 0
      ? Math.min(
          (width - Math.min(16, width * 0.05)) / box.width,
          (height - Math.min(16, height * 0.05)) / box.height,
        )
      : 0,
  );

  const at: Project = $derived.by(() => {
    const s = scale;
    const dx = (width - box.width * s) / 2;
    const dy = (height - box.height * s) / 2;

    return (lon, lat) => [
      dx + (lon - box.west) * COS * s,
      dy + (box.north - lat) * s,
    ];
  });

  const shapes = $derived(
    scale === 0
      ? []
      : hoods.features.map((f) => ({
          slug: f.properties.slug,
          d: outline(f.geometry, at),
          x: at(f.properties.lon, f.properties.lat)[0],
          y: at(f.properties.lon, f.properties.lat)[1],
        })),
  );

  const greens = $derived(
    scale === 0 || parks == null
      ? []
      : parks.features.map((f) => outline(f.geometry, at)),
  );

  const zoom = $derived.by(() => {
    const feature = hoods.features.find((f) => f.properties.slug === focus);
    const cx = width / 2;
    const cy = height * 0.42;
    if (feature == null || scale === 0) {
      return `translate(${cx}px, ${cy}px) scale(1) translate(${-cx}px, ${-cy}px)`;
    }

    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    const polys =
      feature.geometry.type === "Polygon"
        ? [feature.geometry.coordinates]
        : feature.geometry.coordinates;
    for (const poly of polys) {
      for (const [lon, lat] of poly[0]!) {
        const [x, y] = at(lon!, lat!);
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
      }
    }

    const k = Math.min(
      (width * 0.3) / Math.max(1, x1 - x0),
      (height * 0.34) / Math.max(1, y1 - y0),
      4.5,
    );

    return `translate(${cx}px, ${cy}px) scale(${k}) translate(${-(x0 + x1) / 2}px, ${-(y0 + y1) / 2}px)`;
  });

  const where = $derived(new Map(shapes.map((s) => [s.slug, s])));

  const pins = $derived.by(() => {
    const placed: Array<{
      slug: string;
      text: string;
      sub?: string;
      x: number;
      y: number;
      left: boolean;
      ly: number;
    }> = [];
    const sorted = marks
      .flatMap((mark) => {
        const shape = where.get(mark.slug);

        return shape == null ? [] : [{ ...mark, x: shape.x, y: shape.y }];
      })
      .toSorted((a, b) => a.y - b.y);
    for (const mark of sorted) {
      const left = mark.x > width * 0.62;
      let ly = mark.y - 14;
      for (const other of placed) {
        if (other.left === left && Math.abs(other.ly - ly) < 40) {
          ly = other.ly + 40;
        }
      }
      placed.push({ ...mark, left, ly });
    }

    return placed;
  });
</script>

<div
  bind:clientWidth={width}
  bind:clientHeight={height}
  class={cn(
    "relative size-full mask-[radial-gradient(closest-side,black_62%,transparent)] mask-size-[300%_300%] mask-center transition-[mask-size] duration-[calc(var(--1s)*1.3)]",
    { "mask-size-[100%_100%]": focus != null },
    className,
  )}
>
  <svg
    {width}
    {height}
    class="absolute inset-0 overflow-visible"
    aria-hidden="true"
  >
    <g
      class="origin-top-left [transition:transform_calc(var(--1s)*1.3)_cubic-bezier(0.65,0,0.25,1)]"
      style:transform={zoom}
    >
      {#each greens as d, i (i)}
        <path {d} class="fill-paper-300 dark:fill-paper-800/70" />
      {/each}
      {#each shapes as shape (shape.slug)}
        <path
          d={shape.d}
          style:fill={fill(shape.slug)}
          class={cn(
            "stroke-background transition-[fill,opacity] duration-[calc(var(--1s)*0.7)] ease-out",
            { "opacity-30": lit != null && !lit(shape.slug) },
          )}
          stroke-width="0.6"
          vector-effect="non-scaling-stroke"
        />
      {/each}
    </g>
    {#if over != null}
      {@render over(at, scale)}
    {/if}
    {#each pins as pin (pin.slug)}
      <circle
        cx={pin.x}
        cy={pin.y}
        r="3.5"
        class="fill-foreground stroke-background"
        stroke-width="1.5"
      />
      <line
        x1={pin.x}
        y1={pin.y}
        x2={pin.left ? pin.x - 22 : pin.x + 22}
        y2={pin.ly}
        class="stroke-foreground/70"
        stroke-width="1"
      />
    {/each}
  </svg>

  {#each pins as pin (pin.slug)}
    <div
      class={cn(
        "pointer-events-none absolute w-max max-w-44 -translate-y-1/2 rounded-[3px] paper px-2 py-1 shadow-[0_1px_0_rgb(58_48_38/0.16),0_4px_12px_rgb(58_48_38/0.14)] ring-1 ring-foreground/15 dark:shadow-none",
        { "-translate-x-full": pin.left },
      )}
      style:left="{pin.left ? pin.x - 22 : pin.x + 22}px"
      style:top="{pin.ly}px"
    >
      <p class="font-display text-[0.78125rem] leading-tight font-semibold">
        {pin.text}
      </p>
      {#if pin.sub != null}
        <p class="numeric text-[0.6875rem] leading-tight text-muted-foreground">
          {pin.sub}
        </p>
      {/if}
    </div>
  {/each}
</div>
