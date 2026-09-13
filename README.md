# AgriKalkunahon

[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.22726046.svg)](https://doi.org/10.5281/zenodo.22726046)
[![Licence: PolyForm Noncommercial 1.0.0](https://img.shields.io/badge/licence-PolyForm%20Noncommercial%201.0.0-34B233)](https://polyformproject.org/licenses/noncommercial/1.0.0/)

**Live:** https://jbzerrudo.github.io/AgriKalkunahon/
**Download:** grab `AgriKalkunahon.html` from [Releases](https://github.com/jbzerrudo/AgriKalkunahon/releases)
and keep it on a phone or a USB stick.

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
| Too hot or too cold for my crop? | Above or within published thresholds by stage | Yoshida (1981) *Fundamentals of Rice Crop Science*, Table 2.4, critical temperatures by growth stage; Satake and Yoshida (1978); Jagadish et al. (2007); Luo (2011); Hatfield et al. (2011, 2015); Queensland DAF critical temperature thresholds for vegetables and sweet corn |
| Frost (andap) tonight? | Possible, watch, or unlikely | Radiation-frost conditions from the FAO frost manual (Snyder and de Melo-Abreu 2005); Benguet evidence from Marasigan (2017), Launio et al. (2020) and Basquial et al. (2021). The card names DOST-PAGASA as the authority on frost warnings and FROST-PH as its Benguet tool |
| Will the leaves be wet tonight? | Dew tonight; potato late blight by the Hutton Criteria when a data logger supplies hourly humidity | FAO-56 dew point; Sentelhas et al. (2008); James Hutton Institute; IRRI Rice Knowledge Bank for rice blast, which is described in words rather than scored |
| When is harvest? | Harvest window by variety; corn heat units; day length | PhilRice variety pages; McMaster and Wilhelm (1997); IRRI ORYZA2000; FAO-56 Eq. 34 |

The **Sources and limits** card lists every source by class (primary, regulatory, extension,
secondary) and every item that could not be verified against a primary source.

## What changed in 0.4.0

Every calculator now opens with a **What you need** line naming the instruments it assumes, and says
whether a smartphone weather app can stand in for them. The answer differs by card, and the reason is
given each time. A weather app is acceptable for harvest timing, which wants a seasonal typical value.
It is a rough stand-in for the water and stress cards, with the warning that it is a forecast for
another place and the error grows with a difference in elevation. It is a weaker fallback than PAGASA's
published station totals on the rain card. On the spray card it is refused outright, because drift is
decided by the wind in your own field at boom height and the label holds you to the conditions where
you spray. On the frost and wet-leaves cards it may be used as a last resort, but the card states which
way it is wrong: cold air drains downhill and pools, so a field in a hollow runs colder than the town
and the app reads too warm.

The wet-leaves card was rebuilt. It is now titled **Will the leaves be wet tonight?**, and its verdict
weighs how far the air must cool to reach its dew point rather than looking only at cloud and wind. The
Hutton Criteria inputs are hidden behind a checkbox, because they need a data logger and were otherwise
an unusable field on the screen. Readings taken during the day are refused on both this card and the
frost card, since air that is still warming carries no information about the night. Rice blast is named
with IRRI's own description of the weather that favours it and IRRI's management advice, and is
deliberately not scored, because IRRI publishes no threshold.

Drying instruments are now specified as shaded from direct sun but standing in the air beside the
drying floor, with the reason given. The rain card offers PAGASA's published monthly station rainfall
for farmers with no gauge, with the caveat that rainfall differs a great deal over short distances.

A comments and suggestions card carries the author's PAGASA address with the build stamp prefilled.

## What changed in 0.3.1

Same app as 0.3.0. The 0.3.0 release was published while Zenodo was down, so its archive webhook was
dropped and no DOI was minted for it. This tag exists so the archive has something to pick up.

## What changed in 0.3.0

The rice card now asks how you manage the water before anything else, and answers differently for each:
continuous flooding, safe AWD with a field water tube, or letting the field dry without one. Continuous
flooding follows the IRRI Rice Knowledge Bank depths. The third option returns no dry-down threshold,
because none is published for a field without a tube, and offers IRRI's instructions for making one
instead.

An input-validation pass across every calculator. The spray card refuses to answer at all when the wind
is unknown, rather than reporting good conditions it has no basis for. Humidity outside 1 to 100%, a
daily high below the daily low, and impossible grain moisture are all rejected. Sunshine hours outside
the possible range are still clamped, but now say so, as every other FAO-56 clamp already did.

The drying card honours the storage target you pick. It previously computed the target from your choice
and then used 14% regardless, so choosing seed or long-term storage changed nothing. It now also tells
you to stop when the grain is already dry enough, and refuses to compute a weight gain.

A comments and suggestions card carries the author's address and a prefilled message including the build
stamp. The frost card refuses readings taken during the day, when the air is still warming and tells you
nothing about the coming night.

## What changed in 0.2.0

Every calculator now carries two notes above its inputs: which government agency's guidance takes
precedence over it, and how and when the reading must be taken. PAGASA and its Frost Risk Observation
and Support Tool (FROST-PH) are named as the authority on frost in Benguet.

The frost card was reworked. A clear, calm night is never reported as unlikely, because the air keeps
cooling all night and an evening reading cannot rule frost out; cloud and wind still can, but the card
now names which one is holding frost off and warns that it can lift. The card reads the device clock and
reports how far the reading sits from the coldest hour, which it computes from sunrise rather than
assuming 4 to 5 a.m. The Benguet frost season is shown, from Marasigan (2017) and Launio et al. (2020).

Rice temperature thresholds now follow Yoshida (1981) Table 2.4 directly rather than an FAO
reproduction of it, which differed at two growth stages. Sources were re-checked against the primary
texts where those could be obtained, and the unverified list names only what genuinely could not be.

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

To change the app, edit `src/app.js` (interface) or `engine/core.js` (calculations), then run
`node build.js`; it rewrites `index.html` and `AgriKalkunahon.html` from those two files and the
page shell. Bump `VERSION` in `sw.js` when you publish, so installed copies pick the new build up.

## Repository layout

```
index.html             the app, built: engine and interface inlined
AgriKalkunahon.html    the same file under its own name, for download
manifest.webmanifest   makes it installable
icon-192.png, icon-512.png
sw.js                  service worker, so the installed app works with no connection
engine/core.js         the calculation engine, no dependencies
engine/test.js         257 assertions against published values
src/app.js             the interface: questions, plain-language answers, source notes
src/index.template.html  page shell and styles, with the two inlining placeholders
build.js               node build.js rebuilds index.html and AgriKalkunahon.html in place
uitest.js              headless check of every card at phone width (needs playwright)
.nojekyll              stops GitHub Pages running Jekyll over the files
```

## How to cite

Archived on Zenodo, so it can be cited in a thesis or paper.

**Concept DOI** [10.5281/zenodo.22726046](https://doi.org/10.5281/zenodo.22726046) always resolves to the latest
version. Use it when you mean the tool in general.

**Version DOI** every release gets its own: v0.3.1 is
[10.5281/zenodo.22734515](https://doi.org/10.5281/zenodo.22734515), v0.2.0 is
[10.5281/zenodo.22728972](https://doi.org/10.5281/zenodo.22728972) and v0.1.0 is
[10.5281/zenodo.22726047](https://doi.org/10.5281/zenodo.22726047). Use the version DOI in a paper, so
a reader gets the exact build you used. (v0.3.0 was published while Zenodo was down and never archived;
v0.3.1 is the same app.)

> Zerrudo, J. (2026). *AgriKalkunahon: an offline farm-decision calculator for the Philippines*
> (version 0.3.1). Zenodo. https://doi.org/10.5281/zenodo.22734515

```bibtex
@software{zerrudo_agrikalkunahon_2026,
  author  = {Zerrudo, Jef},
  title   = {AgriKalkunahon: an offline farm-decision calculator for the Philippines},
  version = {0.3.1},
  year    = {2026},
  doi     = {10.5281/zenodo.22734515},
  url     = {https://jbzerrudo.github.io/AgriKalkunahon/}
}
```

GitHub's "Cite this repository" button reads `CITATION.cff` and will offer APA and BibTeX directly.

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
