# LeadStack New Homes — daily Horton inventory

Public D.R. Horton scrape for realtor sites. **No SPR.** Runs every day at **10:00 am Florida** (14:00 UTC during EDT) on GitHub Actions. Mac off. $0.

JSON: `map-inventory.json` — the live map reads this URL.

## Lennar — added 2026-10-26

`scripts/new-homes/sync-lennar.mjs` reads public Lennar page data in Orlando,
Tampa/Manatee, Ocala and Jacksonville/St. Augustine. It discovers active communities
from each market page and reads their plans and advertised homes. Collections remain
separate, builder-prefixed communities so their lot numbers and maps cannot collide
with Horton. Published home coordinates are used directly; no community centroid is
substituted for a missing home location and no plat is fabricated.

Only move-in-ready and under-construction homes are included. Coming-soon and sold
homes are excluded. Prices are the public home asking price, not model base prices or
mortgage payments. Images are builder renderings/model images and are marked as such.
The feed is a dated public snapshot, not an MLS or a guarantee of availability.

The daily workflow refreshes Lennar, then combines both builders. On a market failure,
its previous Lennar snapshot and original checkedAt values are retained; the job reports
failure after publishing other successful updates. A missing parser never replaces a
market with an empty result. `sourceRuns` records per-market success/failure. The combined
feed's `updatedAt` is its assembly time; use each community's `checkedAt` for freshness.
The top-level `source: drhorton-public` remains a legacy compatibility discriminator for
already deployed realtor readers. Actual provenance is in each community's `builder`,
`source`, `sourceUrl`, `checkedAt` and the top-level `sources` object.

Run: `node scripts/new-homes/sync-lennar.mjs`, then
`node scripts/new-homes/build-map.mjs`. Validate with
`node --test scripts/new-homes/test/lennar.test.mjs`.
