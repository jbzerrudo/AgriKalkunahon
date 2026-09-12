# AgriKalkunahon

An offline farm-decision calculator for the Philippines. The published build is a single HTML
file: no install, no server, no network. It answers "what should I do" from readings a farmer
can take (afternoon high, morning low, a rain gauge, sometimes a hygrometer), leads with the
decision, shows the number second, and names the published source of every result. Values
outside a formula's published range are flagged rather than silently returned.

Sister project: [Kalkunahon](https://jbzerrudo.github.io/Kalkunahon/), a meteorological
calculator for professionals. AgriKalkunahon is not an extension of it; Kalkunahon answers
"what is this quantity", AgriKalkunahon answers "what should I do".

## What it covers

| Card | Decision | Method and source |
|---|---|---|
| Should I water today? | Water now, or wait N days; net and gross depth, m³, litres, pump hours | FAO-56 Penman-Monteith with FAO-56's own missing-data procedures (Tdew from Tmin, radiation from the temperature range, 2 m/s wind default), Kc from Tables 12 and 14 adjusted by Eq. 62 and 65, soil water balance of Chapter 8 (Tables 19 and 22); efficiencies from FAO Training Manual 4 |
| Rice field: re-flood now? | Safe AWD rule by season and stage | DA Administrative Order 25-09 and PhilRice (15 cm dry season, 20 cm wet season, start 21 to 30 days, 5 cm around flowering, drain 1 to 2 weeks before harvest); IRRI Rice Knowledge Bank; Bouman, Lampayan and Tuong (2007) |
| How much of the rain counts? | Monthly effective rainfall | FAO Training Manual 3 |
| Is it safe to spray now? | Good, caution, or do not spray | Delta T bands and wind limits from GRDC (2022, 2025), BOM, Agriculture Victoria and an APVMA label; inversion window from sunrise and sunset computed with FAO-56 Eq. 25 and 31 to 33 |
| Can my palay dry enough today? | Reachable moisture, weight and cavans after drying | Modified Henderson equation with ASABE D245.6 long-grain rough rice constants (as reproduced by Zhong 2015 and corroborated against the University of Arkansas EMC table); IRRI mass balance and storage targets; PhilRice PalayCheck |
| Too hot or too cold for my crop? | Above or within published thresholds by stage | FAO table adapted from Yoshida (1978); Satake and Yoshida (1978); Jagadish et al. (2007); Luo (2011); Hatfield et al. (2011, 2015); Queensland DAF critical temperature thresholds for vegetables and sweet corn |
| Frost (andap) tonight? | Possible, watch, or unlikely | Radiation-frost conditions from the FAO frost manual (Snyder and de Melo-Abreu 2005); Benguet reports (Basquial et al. 2021; PIA, PNA, DA-CAR) |
| Wet leaves and disease weather | Dew tonight; potato late blight by the Hutton Criteria when hourly humidity is available | FAO-56 dew point; Sentelhas et al. (2008); James Hutton Institute |
| When is harvest? | Harvest window by variety; corn heat units; day length | PhilRice variety pages; McMaster and Wilhelm (1997); IRRI ORYZA2000; FAO-56 Eq. 34 |

The **Sources and limits** card lists every source by class (primary, regulatory, extension,
secondary) and every item that could not be verified against a primary source.

## Accuracy

The engine ships with 257 numerical assertions checked against published worked examples:
every FAO-56 example in Chapters 3, 4, 6 and 8 (Examples 2 to 20, 27, 28, 36, 37), the FAO
Training Manual 3 rainfall table, the University of Arkansas long-grain rice EMC table, the
IRRI and PhilRice weight-after-drying examples, and the rule sets for AWD, spraying, stress,
frost, the Hutton Criteria and growing degree-days.

```
node engine/test.js
```

## Running it

Open `index.html`. It works from a local file, a USB stick, or a phone in aeroplane mode.
Served over HTTPS (for example GitHub Pages), Chrome and Edge offer to install it; the
service worker caches the app on first visit so the installed copy works with no connection.
Field settings are remembered on the device only.

## Repository layout

```
index.html             the app (engine and interface inlined)
AgriKalkunahon.html    the same file, for download
manifest.webmanifest   makes it installable
icon-192.png, icon-512.png
sw.js                  service worker
engine/core.js         the calculation engine, no dependencies
engine/test.js         257 assertions against published values
src/                   sources of the interface (app.js, index.template.html) and the build inputs
build.js               node build.js rebuilds index.html from engine/core.js and src/
.nojekyll              stops GitHub Pages running Jekyll over the files
```

## Language

English with Filipino decision lines and labels. The Filipino text is a draft for review.

## Caution

This app is a decision aid, not a prescription. Its thresholds and formulas are published
values that may not match a particular field, variety or season. Decisions that cost money
and food remain the user's; check them against local advice. Not affiliated with or endorsed
by FAO, IRRI, PhilRice, DA, PAGASA, GRDC or Queensland DAF.

## Licence

[PolyForm Noncommercial 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0/).
Free for any noncommercial purpose, including use by educational institutions, public research
organisations and government institutions regardless of funding. Commercial use is reserved to
the copyright holder: Jef Zerrudo, jbzerrudo@pagasa.dost.gov.ph.
