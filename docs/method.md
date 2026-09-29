# How the numbers are made

## Read this before quoting a number

A dog license records the owner's ZIP code and nothing finer. The file has no neighborhood field, so **the city has never counted dogs by neighborhood**, and every neighborhood figure on the map is an estimate. Each ZIP's dogs are split across the neighborhoods it touches in proportion to homes, then weighted by a fitted estimate of how likely a home in each neighborhood is to have a dog. Every neighborhood panel lists the ZIPs behind its numbers and the share each one contributed.

Of the 96,459 licenses, 504 sit in ZIPs with no residential lots inside the city and are left out. The rest land in a neighborhood.

The file also holds only about half the dogs that pass through licensing. [The undercount](#the-undercount) explains how that is measured.

## The license file

The pipeline pulls every row of the city's 2026 extract from NYC Open Data, 96,459 licenses. Each yearly file runs through the previous December 31, and the 2026 file includes some licenses that had already expired, so it is a record of recent licensing rather than a strict list of licenses in force.

Two cleanups run before anything is counted. Names recorded as `UNKNOWN` or `NAME NOT PROVIDED`, the two largest raw values, are dropped from the name tallies. Breeds the city files under two spellings are merged: `Terrier mix` into `Terrier Crossbreed` (together 2,705 licenses), `St. Bernard` into `Saint Bernard`, and `Dalmatian Mix` into `Dalmatian Crossbreed`. That leaves 348 breeds, all of which can be looked up and mapped. Names are kept if at least 50 dogs carry them, which keeps 305 of them.

A single breed or name is mapped as a rate per 1,000 dogs in each neighborhood. Rates under ten print with one decimal, so a thin breed like the Saint Bernard, at 0.46 per 1,000 citywide, does not round to zero.

## The neighborhoods

The neighborhoods are the city's **2020 Neighborhood Tabulation Areas**. There are 262 of them: 197 where people live, and 65 that are parks, cemeteries, airports, Rikers Island, and the Navy Yard. The map uses the 197 and draws the rest as a muted mask. Each NTA is an exact bundle of 2020 census tracts, so the boundaries follow street centerlines and the set tiles the city with no gaps or overlaps. An earlier build used crowdsourced outlines from DNAinfo's _Draw Your Neighborhood_. NTAs replaced them because their edges follow real streets and they come with census counts attached.

`step0_neighborhoods.py` takes the residential NTAs (`ntatype = 0`), joins the Department of City Planning's 2020 decennial tables on the NTA code, and runs mapshaper with `snap -clean`, a 6 m simplify, and a clip to the shoreline, then recomputes each area from the clipped shape. Keep `snap -clean` first: without a shared topology, mapshaper simplifies each border twice and the two passes open gaps. Three assertions check the geometry on every build. The result is 197 neighborhoods holding 8,796,527 people in 3,369,743 homes.

A few NTA names are administrative, such as `Breezy Point-Belle Harbor-Rockaway Park-Broad Channel`, which is four places in one shape. The census is from 2020 and the licenses from 2026, and nothing reweights for the years between them.

## Dividing by people and homes

A count of dogs mostly tracks population. Across the 197 neighborhoods, dogs correlate with population at Spearman 0.50. Divide by homes and the correlation drops to −0.08, and a different city comes up.

| layer      | what it measures            | leader                                   |
| ---------- | --------------------------- | ---------------------------------------- |
| how many   | dogs                        | Upper West Side (Central), 2,663         |
| how packed | dogs per square mile        | Upper East Side-Yorkville, 4,594         |
| per home   | dogs per 100 occupied homes | Downtown Brooklyn-DUMBO-Boerum Hill, 6.5 |
| per person | dogs per 1,000 residents    | Long Island City-Hunters Point, 33.7     |

Per home is the better measure, because a dog lives with a household. The two measures split where households are small: Long Island City leads per person but ranks third per home, and Midtown-Times Square ranks fifth per person and sixteenth per home. Citywide there is one licensed dog for every 35 homes.

Density divides by land area, with parks, cemeteries, and airports left out.

## The split is fitted rather than assumed

The crosswalk places each of 767,137 PLUTO tax lots in a neighborhood by point-in-polygon and weights it by its residential units. It covers 184 ZIPs, and the 183 that carry dogs map onto all 197 neighborhoods. `zip_hood_weights.json` publishes this count of homes as is, because it is the figure a reader can check.

Splitting a ZIP's dogs by homes alone assumes every home in the ZIP is equally likely to have a dog. ZIP 11211 covers Williamsburg and South Williamsburg, which differ in household size more than almost any pair in the city, and a flat split gives both the same rate.

So `split_weights()` fits dogs per home at the ZIP level, where it is observed, with a ridge regression on twelve measures of household composition from the same census tables, including renter share, one-person households, households with children, households with someone over 65, large households, three age bands, the vacancy rate, and average household size. The fit uses the 179 ZIPs with at least 500 residential units and 30 dogs. Each neighborhood's own census figures are then read back through the fit, and its weight becomes homes times the predicted rate. **Every ZIP is renormalized, so the fit moves dogs between the neighborhoods that share a ZIP but never changes a ZIP's total.**

The fit has to beat the flat split, and the build checks. The 53 ZIPs that sit at least 90% inside one neighborhood measure that neighborhood almost directly, so they are held out and used for scoring:

|                     | weighted MAE, log dogs per home |
| ------------------- | ------------------------------- |
| split by homes only | 0.2911                          |
| fitted split        | **0.2288**                      |

The fitted split is 21% closer, and the result holds for ridge penalties from 1 to 30. An assertion fails the build if the fit ever loses to the flat split.

The fit moves 95 of the 197 neighborhoods by more than 5% and 14 by more than 20%. The biggest changes are large-household neighborhoods that had been taking the rate of a neighbor in the same ZIP. South Williamsburg goes from 380 estimated dogs to 104. The winning breeds and names barely move: the most common breed changes in 1 neighborhood, the most common name in 1, the distinctive breed in 13, and the distinctive name in 35.

**What the fit cannot fix.** Both the rate being fitted and the dogs being placed come from the license file. The fit puts licensed dogs in better places, but it cannot tell a neighborhood that keeps few dogs from one that licenses few. The decennial census also has no income column, and income is the covariate most likely to matter.

## Common and distinctive

The **most common** layers rank breeds and names by estimated count. Labrador leads 75 of the 197 neighborhoods, and only nine breeds lead any. Luna leads 78.

The **most distinctive** layers rank by lift, how far a breed or name runs above its citywide rate. Lift is `(n + k) / (expected + k)`, where `n` is the estimated count in the neighborhood, `expected` is what the citywide share predicts for a neighborhood that size, and `k` is 8 for breeds and 4 for names. Adding `k` to both sides pulls small counts toward a lift of 1, so a handful of dogs cannot win a neighborhood. On top of that, a breed needs at least 8 dogs in the neighborhood and a name at least 4, and only the 80 most common breeds and names citywide are eligible. The distinctive map spreads 38 breeds and 52 names across the city. Greenpoint, Williamsburg, and Long Island City run on Jindos, and Flushing on Shiba Inus.

On all four breed and name layers, a neighborhood with fewer than 20 estimated dogs has no winner.

`details.json` gives each neighborhood two orderings per facet, by count and by lift, using the same gates as the map, so the first row by lift is always the breed or name the map painted there. Lift is computed in the pipeline against full citywide totals, which the browser does not have.

## The undercount

The city has published seven yearly license files since 2016: 2016, 2017, 2018, 2022, 2023, 2024, and 2026, 819,323 records in all. A dog whose license lapses drops out of one file and comes back in a later one when its owner renews, so the files can be read as a capture-recapture panel.

`lapse_estimate()` matches dogs across the 2023, 2024, and 2026 files on name, breed, birth year, and ZIP. It keeps dogs born from 2014 to 2021, old enough to be licensed in 2023 and young enough to be alive in 2026. The Chao1 estimator then adds the dogs that no file caught.

|                                     |          |
| ----------------------------------- | -------- |
| dogs matched across the three files | 76,937   |
| licensed in 2026                    | 47,282   |
| Chao1 estimate                      | 92,002   |
| **ratio**                           | **1.95** |

**The file holds about half the dogs that pass through licensing.** The ratio varies little by borough, from 1.70 in Staten Island to 2.14 in the Bronx.

The matching is imperfect. Two dogs that share a name, breed, birth year, and ZIP read as one, which pulls the ratio down, and one dog whose name was typed two ways reads as two, which pulls it up. Collisions gather on common names and typos on rare ones, so running the estimate on common and rare names separately brackets that error: 1.89 on the most common names and 2.13 on the rarest.

The estimate cannot see dogs that were never licensed at all. A dog with no chance of appearing in any file cannot be estimated from the dogs that do, so 1.95 is a floor under the undercount, not a count of the city's dogs.

## The 311 layer

311 requests carry coordinates, so each complaint is placed directly inside a neighborhood, with no ZIP split. The window is the twelve months through August 2026, the last full month before the build. `COMPLAINT_WINDOW` in `build_data.py` sets it, and rerunning the pipeline moves it forward.

The layer counts three kinds of complaint from six category pairs in the file:

- **Barking:** `Noise` with `Noise, Barking Dog (NR5)` or `Dog`.
- **Dog waste:** `Dirty Condition` with `Dog Waste`, and `Unsanitary Animal Pvt Property` with `Dog`.
- **Off leash:** `Animal in a Park` with `Dog Off Leash`, and `Unleashed Dog`.

Animal abuse and dead animal reports are left out because they are not specific to dogs, and bites because they are a police matter the 311 file does not carry. The window holds 18,692 matching complaints. 18,609 have coordinates, and 18,081 of those fall inside the 197 residential neighborhoods.

The rate is complaints per 100 estimated licensed dogs. Citywide it is 18.8, and neighborhoods range from 3.1 to 114.0. Manhattan runs at 11.4 and the Bronx at 32.8.

Two things shape the rate. The denominator is licensed dogs, and the rate correlates at −0.52 with dogs per 100 homes: where more dogs are licensed, each one draws fewer complaints, and part of that is licensing rather than behavior. And 311 counts filings, not filers. In Greenpoint, 585 of 688 complaints are for dogs off the leash, and 255 and 229 of those sit at two park coordinates. In Bushwick (West), 284 of 345 barking complaints name a single address.

In June 2026 the Manhattan Borough President's office and BetaNYC published a dog waste report card from the same 311 file, graded on raw complaint counts. This layer adds the denominator.
