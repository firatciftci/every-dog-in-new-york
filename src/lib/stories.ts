import type { HoodCollection, Matrix, Stories, StoryId } from "#lib/types.js";

export const STORIES: ReadonlyArray<{ id: StoryId; title: string }> = [
  { id: "class", title: "The class of 2020" },
  { id: "built", title: "Where the city built, the dogs followed" },
  { id: "fashion", title: "Fifteen years of dog fashion" },
  { id: "borough", title: "A dog’s name can give away its borough" },
];

const CLASS_PRIOR = 25;

export const SIGNATURE_FLOOR = { name: 60, here: 20 };

export function percent(fraction: number) {
  return `${Math.round(fraction * 100)}%`;
}

export function boroughTable(hoods: HoodCollection, matrix: Matrix) {
  const boroughOf = new Map(
    hoods.features.map((f) => [f.properties.slug, f.properties.borough]),
  );
  const rows = matrix.slugs.map((slug) => boroughOf.get(slug) ?? null);
  const boroughs = [...new Set(boroughOf.values())].toSorted((a, b) =>
    a.localeCompare(b),
  );

  const sum = (values: ReadonlyArray<number>) => {
    const out: Record<string, number> = {};
    for (const [i, v] of values.entries()) {
      const b = rows[i];
      if (b != null) {
        out[b] = (out[b] ?? 0) + v;
      }
    }

    return out;
  };

  const dogs = sum(matrix.dogs);
  let all = 0;
  for (const v of Object.values(dogs)) {
    all += v;
  }

  const share: Record<string, number> = {};
  for (const b of boroughs) {
    share[b] = (dogs[b] ?? 0) / all;
  }

  const names = new Map<
    string,
    { total: number; by: Record<string, number> }
  >();
  for (const [name, values] of Object.entries(matrix.names)) {
    const by = sum(values);
    let total = 0;
    for (const v of Object.values(by)) {
      total += v;
    }
    names.set(name, { total, by });
  }

  const signatures = boroughs.map((borough) => {
    let best: {
      name: string;
      over: number;
      here: number;
      total: number;
    } | null = null;
    for (const [name, row] of names) {
      const here = row.by[borough] ?? 0;
      if (row.total < SIGNATURE_FLOOR.name || here < SIGNATURE_FLOOR.here) {
        continue;
      }

      const over = here / row.total / share[borough]!;
      if (best == null || over > best.over) {
        best = { name, over, here, total: row.total };
      }
    }

    return { borough, ...best! };
  });

  return { boroughs, share, names, signatures };
}

export function tone(t: number) {
  const clamped = Math.max(-1, Math.min(1, t));
  const ink =
    clamped >= 0 ? "var(--color-story-warm)" : "var(--color-story-cool)";

  return `color-mix(in oklab, ${ink} ${Math.round(Math.abs(clamped) * 92 + 8)}%, var(--color-story-ground))`;
}

export function shortName(name: string) {
  return name.split(/-(?=[A-Z])/, 1)[0] ?? name;
}

export function boroughWord(borough: string) {
  return borough === "Bronx" ? "the Bronx" : borough;
}

export const NEWS: Record<string, string> = {
  "2014:Jeter": "Derek Jeter played his last season for the Yankees in 2014.",
  "2014:Elsa": "Frozen opened in November 2013.",
  "2016:Bernie": "Bernie Sanders ran in the 2016 Democratic primary.",
  "2017:Leia":
    "Carrie Fisher, who played Princess Leia, died in December 2016.",
  "2019:Elsa": "Frozen II opened in November 2019.",
  "2020:Ruthie": "Ruth Bader Ginsburg died in September 2020.",
  "2020:Appa":
    "Avatar: The Last Airbender, whose hero flies a sky bison named Appa, arrived on Netflix in May 2020.",
};

export function fit(node: HTMLElement) {
  const box = node.parentElement;
  if (box == null) {
    return;
  }

  const measure = () => {
    const tall = node.offsetHeight;
    const wide = node.offsetWidth;
    const shrink = Math.min(
      1,
      box.clientHeight / Math.max(1, tall),
      box.clientWidth / Math.max(1, wide),
    );
    node.style.scale = String(shrink);
    node.style.marginBlock = `${((shrink - 1) * tall) / 2}px`;
    node.style.marginInline = `${((shrink - 1) * wide) / 2}px`;
  };
  const watcher = new ResizeObserver(measure);
  watcher.observe(box);
  watcher.observe(node);

  return () => {
    watcher.disconnect();
  };
}

export function timed(hoods: HoodCollection, stories: Stories): HoodCollection {
  const { bump } = stories.class;

  return {
    ...hoods,
    features: hoods.features.map((f) => {
      const slug = f.properties.slug;
      const [then, now, fresh] = stories.built.hoods[slug] ?? [0, 0, 0];
      const [n19, n20, n21] = stories.class.hoods[slug] ?? [0, 0, 0];

      return {
        ...f,
        properties: {
          ...f.properties,
          share_change: then > 0 ? now / then : 0,
          class_2020:
            n19 + n20 + n21 > 0
              ? (n20 + CLASS_PRIOR * bump) / ((n19 + n21) / 2 + CLASS_PRIOR)
              : 0,
          new_homes: fresh,
        },
      };
    }),
  };
}

export function change(ratio: number) {
  const step = Math.round((ratio - 1) * 100);

  return step === 0 ? "no change" : `${step > 0 ? "+" : "−"}${Math.abs(step)}%`;
}
