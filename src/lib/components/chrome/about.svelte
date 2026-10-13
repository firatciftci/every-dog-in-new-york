<script lang="ts">
  import { ArrowRightIcon, ArrowUpRightIcon } from "@lucide/svelte";
  import type { Summary } from "#lib/types.js";
  import Plate from "#lib/components/brand/plate.svelte";
  import Dialog from "#lib/components/chrome/dialog.svelte";
  import { explorer } from "#lib/state.svelte.js";
  import { count } from "#lib/utils.js";

  let { summary }: { summary: Summary } = $props();

  const CAST = [
    "Labrador (or Crossbreed)",
    "Yorkshire Terrier",
    "Shih Tzu",
    "Dachshund",
    "Pug",
    "German Shepherd Dog",
  ];

  const sources = $derived([
    {
      name: "NYC Dog Licensing Dataset",
      href: "https://data.cityofnewyork.us/Health/NYC-Dog-Licensing-Dataset/nu7n-tubp",
      note: `${count(summary.licenses)} licenses in the ${summary.extract_year} file, plus the earlier yearly files`,
    },
    {
      name: "2020 Neighborhood Tabulation Areas",
      href: "https://data.cityofnewyork.us/City-Government/2020-Neighborhood-Tabulation-Areas-NTAs-/9nt8-h7nd",
      note: `the ${summary.neighborhoods} of 262 where people live`,
    },
    {
      name: "2020 Census, by neighborhood",
      href: "https://www.nyc.gov/content/planning/pages/resources/datasets/decennial-census",
      note: `${count(summary.people)} people in ${count(summary.homes)} homes`,
    },
    {
      name: "PLUTO tax lots",
      href: "https://data.cityofnewyork.us/City-Government/Primary-Land-Use-Tax-Lot-Output-PLUTO-/64uk-42ks",
      note: `${count(summary.residential_units)} residential units, used to split ZIP codes, and the year each lot was built`,
    },
    {
      name: "OpenFreeMap & OpenStreetMap",
      href: "https://openfreemap.org",
      note: "basemap tiles",
    },
    {
      name: "MTA subway lines and stations",
      href: "https://data.ny.gov/Transportation/MTA-Subway-Stations/39hk-dx4f",
      note: "subway routes and stops",
    },
    {
      name: "MTA rail branches and stations",
      href: "https://data.ny.gov/Transportation/MTA-Rail-Branches/2vcb-zrh4",
      note: "the Long Island Rail Road and Metro-North",
    },
    {
      name: "OpenStreetMap route relations",
      href: "https://www.openstreetmap.org/relation/1377999",
      note: "PATH, three New Jersey Transit lines, and Amtrak",
    },
    {
      name: "Pearson Scott Foresman archive",
      href: "https://commons.wikimedia.org/w/index.php?search=intitle%3APSF+incategory%3ALine_art_of_dogs&ns6=1",
      note: "public-domain breed plates",
    },
    {
      name: "311 Service Requests",
      href: "https://data.cityofnewyork.us/Social-Services/311-Service-Requests-from-2010-to-Present/erm2-nwe9",
      note: `${count(summary.complaints)} dog complaints in the twelve months through ${summary.complaints_through}`,
    },
    {
      name: "Shelter websites",
      href: "https://www.nycacc.org/locations-and-hours/",
      note: "addresses and phone numbers for all nine",
    },
  ]);
</script>

<Dialog
  size="lg"
  label="How I made this map"
  onclose={() => {
    explorer.about = false;
  }}
>
  <h2
    class="-ml-0.5 font-display text-[1.6875rem] leading-[1.02] font-bold tracking-tight text-pretty text-foreground"
  >
    How I made this map
  </h2>
  <p class="mt-1 text-[0.8125rem] text-muted-foreground">
    Where the data came from and what I did with it.
  </p>
  <div class="mt-2 h-1.25 rounded-[50%] bg-primary/80"></div>

  <p class="mt-4 text-[0.875rem] leading-relaxed text-foreground/85">
    New York City publishes its dog licenses. The {summary.extract_year} file holds
    {count(summary.licenses)} of them, and each lists a dog’s name, breed, and birth
    year, along with the owner’s ZIP code. I placed those dogs in the city’s {summary.neighborhoods}
    residential neighborhoods and compared each neighborhood with the city as a whole.
    The city’s earlier yearly files show how that picture has changed since 2016.
  </p>

  <div
    class="mt-5 border-t rule pt-4 text-[0.875rem] leading-relaxed text-foreground/85"
  >
    <h3 class="slab text-[0.9375rem]">Placing the dogs</h3>
    <p class="mt-2">
      A license records the owner’s ZIP code and nothing finer, and ZIP codes
      cross neighborhood lines. I split each ZIP’s dogs among the neighborhoods
      it touches, in proportion to the homes on each side of the line, then
      weighted each share by a fitted estimate of how likely a household there
      is to have a dog. Every neighborhood figure is an estimate, and each
      neighborhood card lists the ZIP codes its number came from.
    </p>
    <p class="mt-2">
      The neighborhoods are the city’s 2020 Neighborhood Tabulation Areas. They
      are built from census tracts and come with a population and a household
      count. Raw dog totals rise with population, so the map also shows dogs per
      100 homes and per 1,000 people. I lean on the per-home figure, because a
      dog belongs to a household. By that measure brownstone Brooklyn climbs and
      the far edges of Queens drop back.
    </p>
  </div>

  <div
    class="mt-5 border-t rule pt-4 text-[0.875rem] leading-relaxed text-foreground/85"
  >
    <h3 class="slab text-[0.9375rem]">Common and distinctive</h3>
    <p class="mt-2">
      The breed and name maps have two views. <strong
        class="font-semibold text-foreground">Most common</strong
      >
      ranks by count, and the same few winners repeat: Labradors lead 75 of the {summary.neighborhoods}
      neighborhoods, and Luna leads 78.
      <strong class="font-semibold text-foreground">Most distinctive</strong>
      ranks by how far a breed or name runs above its citywide rate. That view spreads
      38 breeds across the city and turns up Greenpoint’s Jindos, at 2.8 times the
      city’s rate.
    </p>
    <p class="mt-2">
      To keep a few dogs from deciding a neighborhood, I pull small counts
      toward the citywide average and set floors: 8 dogs for a breed, 4 for a
      name, and 20 dogs in the neighborhood before anything wins. The {count(
        summary.breed_unknown,
      )} dogs whose breed is listed as Unknown count in every total but sit out the
      breed rankings.
    </p>
  </div>

  <div
    class="mt-5 border-t rule pt-4 text-[0.875rem] leading-relaxed text-foreground/85"
  >
    <h3 class="slab text-[0.9375rem]">The missing half</h3>
    <p class="mt-2">
      A dog drops out of the file when its license lapses and comes back when
      its owner renews. I matched dogs across the {new Intl.ListFormat(
        "en-US",
      ).format(summary.lapse_occasions)}
      files by name, breed, birth year, and ZIP code. Of the {count(
        summary.lapse_dogs_seen,
      )}
      dogs born from {summary.lapse_cohort_births[0]} to {summary
        .lapse_cohort_births[1]}
      that appear in any of them, {count(summary.lapse_holding_now)} are in the
      {summary.extract_year} file. With an estimate for the dogs no file caught, that
      works out to {summary.lapse_ratio} dogs passing through licensing for every
      one in the file, so the map shows about half of them. Checking the matching
      on common and rare names puts that ratio between
      {summary.lapse_ratio_common_names} and {summary.lapse_ratio_rare_names}.
    </p>
  </div>

  <div
    class="mt-5 border-t rule pt-4 text-[0.875rem] leading-relaxed text-foreground/85"
  >
    <h3 class="slab text-[0.9375rem]">Over time</h3>
    <p class="mt-2">
      The city has published seven yearly files since 2016, and it built them in
      different ways. Some hold the licenses active that year, some only the
      ones issued that year, and the 2022 file holds three years of them. Their
      totals do not compare, so I compare shares and birth years inside each
      file instead.
    </p>
    <p class="mt-2">
      Two views come from that. <strong class="font-semibold text-foreground"
        >Since 2016</strong
      >
      shows how each neighborhood’s share of the city’s dogs changed between the 2016
      and {summary.extract_year} files, and the neighborhoods with the most new housing
      tended to gain the most. Long Island City’s share grew 65%, and 47% of its homes
      went up in 2016 or later.
      <strong class="font-semibold text-foreground">Class of 2020</strong>
      compares the dogs born in 2020 with those born the year before and the year
      after. Citywide, the file holds 25% more dogs born in 2020 than in the years
      around it, and the 2024 file gives 22% on its own.
    </p>
    <p class="mt-2">
      A breed or name card also draws a line by birth year, read from all seven
      files with each dog counted once. It shows the French Bulldog peaking
      among dogs born in 2016. The four stories under the walk follow these
      findings in more detail.
    </p>
  </div>

  <div
    class="mt-5 border-t rule pt-4 text-[0.875rem] leading-relaxed text-foreground/85"
  >
    <h3 class="slab text-[0.9375rem]">The drawings</h3>
    <div class="mt-2 flex items-end justify-center gap-1.5">
      {#each CAST as breed, i (breed)}
        <Plate
          {breed}
          height={i % 2 === 0 ? 46 : 40}
          flip={i % 2 === 1}
          class="origin-bottom wag-hover"
        />
      {/each}
    </div>
    <div class="h-1.25 rounded-[50%] bg-primary/80"></div>
    <p class="mt-2.5">
      The originals are pen-and-ink breed plates from the <a
        href="https://commons.wikimedia.org/w/index.php?search=intitle%3APSF+incategory%3ALine_art_of_dogs&ns6=1"
        target="_blank"
        rel="noreferrer external"
        class="font-medium text-primary underline decoration-primary/45 underline-offset-2 transition-colors duration-200 hover:decoration-primary"
        >Pearson Scott Foresman archive</a
      >, which the publisher released into the public domain. The archive never
      drew most of the breeds in the license file, Shiba Inus and doodles among
      them, so I made new plates in the same style, using six of the originals
      as a reference.
    </p>
  </div>

  <div
    class="mt-5 border-t rule pt-4 text-[0.875rem] leading-relaxed text-foreground/85"
  >
    <h3 class="slab text-[0.9375rem]">Also on the map</h3>
    <p class="mt-2">
      Zoom in and dogs ride the subway, the Long Island Rail Road, Metro-North,
      PATH, New Jersey Transit, and Amtrak, on their real routes and in each
      railroad’s own cars. Each dog is the leading breed of the neighborhood
      where it boarded, with a name common there. Click one and the map follows
      it.
    </p>
    <p class="mt-2">
      You can add your own dogs, too. Each one stands in its neighborhood, with
      a card that compares its name, breed, and birth year with the city’s, and
      it can ride a line you choose. Your dogs stay in your browser and count in
      no figure on the map.
    </p>
    <p class="mt-2">
      The nine shelters are the ones you can walk into. I took each address and
      phone number from the shelter’s own website, because directories still
      listed one shelter that had moved and one that closed in 2023. Five of the
      nine are in Manhattan. The Bronx has none, and Animal Care Centers of NYC
      is still building its first full-service center there.
    </p>
    <p class="mt-2">
      The <strong class="font-semibold text-foreground">on 311</strong> view
      maps complaints about barking, dog waste, and off-leash dogs in the twelve
      months through {summary.complaints_through}. Each complaint has
      coordinates, so it lands in its neighborhood directly, without the ZIP
      split. The view divides those complaints by the neighborhood’s licensed
      dogs: 18.8 per 100 dogs citywide, 11.4 in Manhattan, and 32.8 in the
      Bronx. Part of that gap is licensing. The rate falls where more owners
      license their dogs, and a few repeat callers can drive a neighborhood’s
      count.
    </p>
  </div>

  <div class="mt-5 border-t rule pt-4">
    <h3 class="mb-2 slab text-[0.9375rem]">Sources</h3>
    <ul class="grid gap-2">
      {#each sources as source (source.name)}
        <li class="text-[0.8125rem] leading-snug">
          <a
            href={source.href}
            target="_blank"
            rel="noreferrer external"
            class="font-medium text-primary underline decoration-primary/45 underline-offset-2 transition-colors duration-200 hover:decoration-primary"
          >
            {source.name}
          </a><span class="text-muted-foreground">, {source.note}</span>
        </li>
      {/each}
    </ul>
  </div>

  <a
    href="https://github.com/firatciftci/every-dog-in-new-york"
    target="_blank"
    rel="noreferrer external"
    class="group mt-5 block border-t rule pt-3"
  >
    <span class="flex items-baseline gap-1.5">
      <span
        class="slab text-[0.9375rem] text-foreground transition-colors duration-200 group-hover:text-primary"
        >The code</span
      >
      <ArrowUpRightIcon
        aria-hidden="true"
        class="size-3.25 translate-y-px text-foreground transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-px group-hover:text-primary"
        strokeWidth={2.25}
      />
    </span>
    <span
      class="mt-0.5 block text-[0.75rem] leading-snug text-muted-foreground"
    >
      The site and the Python pipeline behind every number are on GitHub, under
      the MIT License.
    </span>
  </a>

  <button
    type="button"
    class="group mt-5 block w-full cursor-pointer border-t rule pt-3 text-left"
    onclick={() => {
      explorer.about = false;
      explorer.maker = true;
    }}
  >
    <span class="flex items-baseline gap-1.5">
      <span
        class="slab text-[0.9375rem] text-foreground transition-colors duration-200 group-hover:text-cobalt"
        >Who made this</span
      >
      <ArrowRightIcon
        aria-hidden="true"
        class="size-3.25 translate-y-px text-foreground transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-cobalt"
        strokeWidth={2.25}
      />
    </span>
    <span
      class="mt-0.5 block text-[0.75rem] leading-snug text-muted-foreground"
    >
      Firat Ciftci is a software engineer in Brooklyn, New York.
    </span>
  </button>
</Dialog>
