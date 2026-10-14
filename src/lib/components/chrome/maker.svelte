<script lang="ts" module>
  const SITE = "https://www.firatciftci.com";

  const NAME = "Firat Ciftci";

  const COURSE = "M 70 62 C 150 22, 210 104, 290 70 S 410 26, 500 58";
  const HEADS = [
    "M -10 18 C 20 24, 30 52, 70 62",
    "M -10 104 C 26 96, 40 72, 70 62",
  ];
  const NAMES = [
    "Fırat",
    "Եփրատ",
    "الفرات",
    "Εὐφράτης",
    "Purattu",
    "Buranun",
  ].join("\u00A0".repeat(6));
</script>

<script lang="ts">
  import Shahmaran from "#lib/components/brand/shahmaran.svelte";
  import Dialog from "#lib/components/chrome/dialog.svelte";
  import Newsletter from "#lib/components/chrome/newsletter.svelte";
  import { explorer } from "#lib/state.svelte.js";
  import { cn } from "#lib/utils.js";

  const address = ["firat", "firatciftci.com"].join("@");
  const mailto = `mailto:${address}?subject=${encodeURIComponent("Hello Firat, your dog map brought me here")}`;

  let clip: HTMLAudioElement | null = null;
  let said = $state(0);

  async function say() {
    said += 1;
    clip ??= new Audio(`${SITE}/pronunciation.mp3`);
    try {
      clip.currentTime = 0;
      await clip.play();
    } catch {
      console.error("Failed to play the pronunciation clip");
    }
  }

  let copied = $state(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(address);
      copied = true;
      setTimeout(() => {
        copied = false;
      }, 1600);
    } catch {
      console.error("Failed to copy email address to clipboard");
    }
  }

  let course = $state<SVGPathElement | null>(null);

  const channel = $derived.by(() => {
    const line = course;
    if (line == null) {
      return { water: "", bank: "" };
    }

    const length = line.getTotalLength();
    const left: Array<string> = [];
    const right: Array<string> = [];
    const bankLeft: Array<string> = [];
    const bankRight: Array<string> = [];
    const n = 90;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const p = line.getPointAtLength(t * length);
      const q = line.getPointAtLength(Math.min(length, t * length + 1));
      const r = line.getPointAtLength(Math.max(0, t * length - 1));
      const dx = q.x - r.x;
      const dy = q.y - r.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      const half = 1.4 + 12 * t ** 0.85;
      const bank = half + 3 + 6 * t;
      left.push(
        `${(p.x + nx * half).toFixed(1)} ${(p.y + ny * half).toFixed(1)}`,
      );
      right.unshift(
        `${(p.x - nx * half).toFixed(1)} ${(p.y - ny * half).toFixed(1)}`,
      );
      bankLeft.push(
        `${(p.x + nx * bank).toFixed(1)} ${(p.y + ny * bank).toFixed(1)}`,
      );
      bankRight.unshift(
        `${(p.x - nx * bank).toFixed(1)} ${(p.y - ny * bank).toFixed(1)}`,
      );
    }

    return {
      water: `M ${[...left, ...right].join(" L ")} Z`,
      bank: `M ${[...bankLeft, ...bankRight].join(" L ")} Z`,
    };
  });
</script>

<Dialog
  size="lg"
  label="Who made this"
  onclose={() => {
    explorer.maker = false;
  }}
>
  <div class="flow-root">
    <div
      class="group/photo relative float-right mt-1 mr-2 mb-8 ml-12 -rotate-3 transition-transform duration-500 hover:rotate-0 @max-xs:ml-4"
    >
      <div
        class="rounded-t-full bg-cobalt p-0.75 shadow-[0_10px_24px_-10px_rgb(31_63_166/0.6)]"
      >
        <div class="rounded-t-full bg-background p-0.75">
          <div class="rounded-t-full bg-turquoise p-0.5">
            <img
              src="/firat.jpg"
              alt="Firat Ciftci"
              width="320"
              height="320"
              decoding="async"
              class="block h-38 w-28 rounded-t-full object-cover transition-[scale] duration-700 group-hover/photo:scale-105 @max-xs:h-28 @max-xs:w-20"
            />
          </div>
        </div>
      </div>
      <a
        href="https://en.wikipedia.org/wiki/Shahmaran"
        target="_blank"
        rel="noreferrer external"
        aria-label="Shahmaran, on Wikipedia"
        class="absolute -bottom-7 -left-11 rotate-16 text-cobalt drop-shadow-[0_0_0_var(--color-background)] transition-transform duration-700 group-hover/photo:-translate-y-1 hover:rotate-[4deg]"
      >
        <span
          class="block plate-cut [--plate-paper:var(--color-background)] [--plate-ring:2px]"
        >
          <Shahmaran height={84} />
        </span>
      </a>
    </div>
    <h2
      class="mt-2 font-wide text-[1.5rem] leading-[1.06] font-[820] tracking-[-0.02em] text-foreground font-stretch-125% sm:text-[1.75rem]"
    >
      <button
        type="button"
        onclick={say}
        aria-label="{NAME}. Press to hear it said in Turkish."
        class="block text-left text-cobalt"
      >
        {#key said}
          {#each NAME.split(" ") as word, w (w)}
            {#if w > 0}{" "}{/if}<span class="whitespace-nowrap"
              >{#each [...word] as letter, i (i)}<span
                  class={cn("inline-block", {
                    "motion-safe:animate-[wave_0.7s_ease-in-out_both]":
                      said > 0,
                  })}
                  style:animation-delay="{(w * 6 + i) * 0.045}s">{letter}</span
                >{/each}</span
            >
          {/each}
        {/key}
      </button>
      I tell stories with data.
    </h2>
  </div>

  <p class="mt-5 text-[0.9375rem] leading-relaxed text-foreground/85">
    I have built
    <a
      href="{SITE}/#sozluk"
      target="_blank"
      rel="noreferrer external"
      class="underline decoration-cobalt/40 underline-offset-2 transition-colors duration-200 hover:text-cobalt hover:decoration-cobalt"
      >dictionaries</a
    >
    of Turkish,
    <a
      href="{SITE}/#ottoman"
      target="_blank"
      rel="noreferrer external"
      class="underline decoration-cobalt/40 underline-offset-2 transition-colors duration-200 hover:text-cobalt hover:decoration-cobalt"
      >archives</a
    >
    at the University of Chicago, and now this map. For this one, I wrote the Python
    pipeline and the statistics, then designed and built the site. I live in Brooklyn.
  </p>

  <p class="mt-3 text-[0.84375rem] leading-snug text-muted-foreground italic">
    Press my name to hear it. Fırat is Turkish for the Euphrates.
  </p>

  <figure class="-mx-6 mt-3 overflow-hidden @max-xs:-mx-4" aria-hidden="true">
    <svg viewBox="0 0 480 120" class="block w-full">
      <defs>
        <linearGradient id="maker-water" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stop-color="#2aa6a0" />
          <stop offset="1" stop-color="#1f3fa6" />
        </linearGradient>
        <filter id="maker-silt" x="-5%" y="-30%" width="110%" height="160%">
          <feGaussianBlur stdDeviation="2.4" />
        </filter>
        <clipPath id="maker-channel">
          <path d={channel.water} />
        </clipPath>
      </defs>

      {#each HEADS as head (head)}
        <path
          d={head}
          fill="none"
          class="stroke-[#d9cdb3] dark:stroke-[#5a5243]"
          stroke-width="4"
          stroke-linecap="round"
          filter="url(#maker-silt)"
        />
        <path
          d={head}
          fill="none"
          class="stroke-turquoise"
          stroke-width="1.4"
          stroke-linecap="round"
        />
      {/each}

      <path
        d={channel.bank}
        class="fill-[#d9cdb3] dark:fill-[#5a5243]"
        filter="url(#maker-silt)"
      />
      <path d={channel.water} fill="url(#maker-water)" />
      <path bind:this={course} d={COURSE} fill="none" stroke="none" />

      <g clip-path="url(#maker-channel)" class="text-[#f3f6f9]">
        {#each [-7, -3, 2, 6] as offset, i (offset)}
          <path
            d={COURSE}
            fill="none"
            stroke="currentColor"
            stroke-opacity={0.5 - i * 0.07}
            stroke-width="0.9"
            stroke-dasharray="{3 + i} {16 + i * 5}"
            stroke-linecap="round"
            transform="translate(0 {offset})"
            class="motion-safe:animate-[current_linear_infinite]"
            style:animation-duration="{2.4 + i * 0.7}s"
          />
        {/each}
        <text
          class="fill-current font-serif text-[8px] tracking-widest italic opacity-95 select-none"
          dy="3"
        >
          <textPath href="#maker-course" startOffset="26%">{NAMES}</textPath>
        </text>
      </g>
      <path id="maker-course" d={COURSE} fill="none" stroke="none" />
    </svg>
  </figure>

  <div
    class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-3.5 @max-xs:wrap-anywhere"
  >
    <a
      href={mailto}
      class="stone -rotate-1 bg-cobalt px-5 pt-2.5 pb-2 font-wide text-[0.875rem] font-[760] text-background font-stretch-118% [--flood:var(--color-turquoise)]"
    >
      <span aria-hidden="true" class="flood"></span>Write to me
    </a>
    <button
      type="button"
      onclick={copy}
      class="stone translate-y-1 rotate-1 border-2 border-cobalt px-4 pt-2 pb-1.5 font-wide text-[0.8125rem] font-bold text-cobalt font-stretch-115% [--flood:var(--color-cobalt)] hover:text-background focus-visible:text-background"
    >
      <span aria-hidden="true" class="flood"></span>{copied
        ? "Copied email address"
        : "Copy email address"}
    </button>
    {#each [{ label: "GitHub", href: "https://github.com/firatciftci" }, { label: "LinkedIn", href: "https://linkedin.com/in/ciftcifirat" }, { label: "firatciftci.com", href: SITE }] as link, i (link.href)}
      <a
        href={link.href}
        target="_blank"
        rel="noreferrer external"
        class={cn(
          "stone border-2 border-cobalt px-4 pt-2 pb-1.5 font-wide text-[0.8125rem] font-bold text-cobalt font-stretch-115% [--flood:var(--color-cobalt)] hover:text-background focus-visible:text-background",
          {
            "-translate-y-0.5 -rotate-2": i % 2 === 0,
            "translate-y-1 rotate-1": i % 2 === 1,
          },
        )}
      >
        <span aria-hidden="true" class="flood"
        ></span>{#each link.label.split(/(?=\.)/) as part, j (j)}{#if j > 0}<wbr
            />{/if}{part}{/each}
        ↗
      </a>
    {/each}
    <span role="status" class="sr-only">{copied ? "Copied" : ""}</span>
  </div>

  <div class="mt-6 border-t rule pt-4">
    <p class="mb-1 text-[0.9375rem] leading-snug text-foreground/85">
      Leave your email, and I’ll write when I finish my next project.
    </p>
    <Newsletter from="everydog" />
  </div>

  <p class="mt-6 text-[0.71875rem] leading-snug text-muted-foreground">
    The figure by the photo is the Shahmaran, half woman and half snake, from
    the folklore of Anatolia, Mesopotamia, and Iran. This version is by my
    friend
    <a
      href="https://www.ceyhun.info/"
      target="_blank"
      rel="noreferrer external"
      class="font-medium underline decoration-cobalt/40 underline-offset-2 transition-colors duration-200 hover:text-cobalt hover:decoration-cobalt"
      >Ceyhun</a
    >.
  </p>
</Dialog>
