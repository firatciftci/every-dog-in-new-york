<script lang="ts" module>
  /* eslint-disable svelte/no-at-html-tags */
  const SITE = "https://everydog.nyc";

  const CARD = { url: `${SITE}/og.png`, w: 1200, h: 630 };

  const TITLE = "Every Dog in New York: an NYC dog map by neighborhood";

  const DESCRIPTION =
    "96,459 licensed New York City dogs, mapped across 197 neighborhoods. Look up any breed or any dog name and see where the city keeps them.";

  const SHARED =
    "96,459 active licenses across 197 neighborhoods. The Upper East Side has more than twice its share of Labradoodles.";

  const CARD_ALT =
    "A brass New York City dog tag struck 96,459, over the title Every Dog in New York and seven breed drawings.";

  const SOURCES = [
    "https://data.cityofnewyork.us/Health/NYC-Dog-Licensing-Dataset/nu7n-tubp",
    "https://data.cityofnewyork.us/City-Government/2020-Neighborhood-Tabulation-Areas-NTAs-/9nt8-h7nd",
    "https://www.nyc.gov/content/planning/pages/resources/datasets/decennial-census",
    "https://data.cityofnewyork.us/City-Government/Primary-Land-Use-Tax-Lot-Output-PLUTO-/64uk-42ks",
  ];
</script>

<script lang="ts">
  import type { Summary } from "$lib/types";

  let { summary }: { summary: Summary } = $props();

  const graph = $derived({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${SITE}/#site`,
        url: `${SITE}/`,
        name: "Every Dog in New York",
        alternateName: "everydog.nyc",
        description: DESCRIPTION,
        inLanguage: "en-US",
        publisher: { "@id": `${SITE}/#maker` },
      },
      {
        "@type": "Organization",
        "@id": `${SITE}/#maker`,
        name: "Every Dog in New York",
        url: `${SITE}/`,
        logo: {
          "@type": "ImageObject",
          url: `${SITE}/icon-512.png`,
          width: 512,
          height: 512,
        },
      },
      {
        "@type": "WebPage",
        "@id": `${SITE}/#page`,
        url: `${SITE}/`,
        name: TITLE,
        description: DESCRIPTION,
        isPartOf: { "@id": `${SITE}/#site` },
        primaryImageOfPage: { "@id": `${SITE}/#card` },
        mainEntity: { "@id": `${SITE}/#data` },
        inLanguage: "en-US",
        about: [
          {
            "@type": "Thing",
            name: "Dog",
            sameAs: "https://en.wikipedia.org/wiki/Dog",
          },
          {
            "@type": "City",
            name: "New York City",
            sameAs: "https://en.wikipedia.org/wiki/New_York_City",
          },
        ],
      },
      {
        "@type": "ImageObject",
        "@id": `${SITE}/#card`,
        url: CARD.url,
        contentUrl: CARD.url,
        width: CARD.w,
        height: CARD.h,
        encodingFormat: "image/png",
        caption: CARD_ALT,
      },
      {
        "@type": "Dataset",
        "@id": `${SITE}/#data`,
        url: `${SITE}/`,
        name: "Licensed dogs by New York City neighborhood",
        description: `${summary.licenses.toLocaleString("en-US")} active New York City dog licenses from the ${summary.extract_year} extract, spread from ZIP codes across ${summary.neighborhoods} neighborhoods against ${summary.people.toLocaleString("en-US")} people and ${summary.homes.toLocaleString("en-US")} homes. A license carries nothing finer than a ZIP, so every neighborhood figure is an estimate: each ZIP's dogs are split by residential units from PLUTO and then weighted by a fitted estimate of how likely a home there is to keep a dog.`,
        creator: { "@id": `${SITE}/#maker` },
        isBasedOn: SOURCES,
        temporalCoverage: summary.extract_year,
        inLanguage: "en-US",
        isAccessibleForFree: true,
        license: "https://opensource.org/license/mit",
        measurementTechnique:
          "Areal interpolation of ZIP-level license counts onto census neighborhood tabulation areas, weighted by residential units and by dogs per home fitted on twelve 2020 census measures of household composition.",
        keywords: [
          "dog licenses",
          "New York City",
          "dog breeds",
          "dog names",
          "neighborhoods",
          "open data",
        ],
        spatialCoverage: {
          "@type": "Place",
          name: "New York City",
          geo: {
            "@type": "GeoShape",
            box: "40.4774 -74.2591 40.9162 -73.7002",
          },
        },
        variableMeasured: [
          "Estimated licensed dogs per neighborhood",
          "Licensed dogs per 100 homes",
          "Licensed dogs per 1,000 people",
          "Most common breed",
          "Most distinctive breed",
          "Most common dog name",
          "Most distinctive dog name",
        ],
        distribution: [
          {
            "@type": "DataDownload",
            name: "Citywide totals and leaderboards",
            encodingFormat: "application/json",
            contentUrl: `${SITE}/data/summary.json`,
          },
          {
            "@type": "DataDownload",
            name: "Every breed and name by neighborhood",
            encodingFormat: "application/json",
            contentUrl: `${SITE}/data/matrix.json`,
          },
          {
            "@type": "DataDownload",
            name: "Per-neighborhood breakdowns and the ZIPs behind them",
            encodingFormat: "application/json",
            contentUrl: `${SITE}/data/details.json`,
          },
        ],
      },
    ],
  });

  // svelte:head does not evaluate a script body, so the tag is built as HTML; </ is escaped to keep this block open.
  const linked = $derived(
    `<script type="application/ld+json">${JSON.stringify(graph)}<\/script>`,
  );
</script>

<svelte:head>
  <title>{TITLE}</title>
  <meta name="description" content={DESCRIPTION} />
  <link rel="canonical" href="{SITE}/" />

  <meta
    name="robots"
    content="index, follow, max-image-preview:large, max-snippet:-1"
  />

  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Every Dog in New York" />
  <meta property="og:url" content="{SITE}/" />
  <meta property="og:title" content={TITLE} />
  <meta property="og:description" content={SHARED} />
  <meta property="og:locale" content="en_US" />
  <meta property="og:image" content={CARD.url} />
  <meta property="og:image:secure_url" content={CARD.url} />
  <meta property="og:image:type" content="image/png" />
  <meta property="og:image:width" content={String(CARD.w)} />
  <meta property="og:image:height" content={String(CARD.h)} />
  <meta property="og:image:alt" content={CARD_ALT} />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content={TITLE} />
  <meta name="twitter:description" content={SHARED} />
  <meta name="twitter:image" content={CARD.url} />
  <meta name="twitter:image:alt" content={CARD_ALT} />

  {@html linked}
</svelte:head>
