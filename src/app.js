/* AgriKalkunahon interface. Decision first, number second, sources always.
   Every number comes from AGRI (engine/core.js); this file only asks and explains.
   Filipino strings are drafts for review by the author. */
(function () {
'use strict';
const A = window.AGRI;
const $ = (s, r) => (r || document).querySelector(s);
const el = (tag, attrs, ...kids) => {
  const e = document.createElement(tag);
  for (const k in (attrs || {})) { if (k === 'class') e.className = attrs[k]; else if (k === 'html') e.innerHTML = attrs[k]; else if (k.startsWith('on')) e.addEventListener(k.slice(2), attrs[k]); else e.setAttribute(k, attrs[k]); }
  for (const kid of kids) { if (kid == null) continue; e.appendChild(typeof kid === 'string' ? document.createTextNode(kid) : kid); }
  return e;
};
const fmt = (v, n) => (v == null || !isFinite(v)) ? '–' : Number(v).toFixed(n == null ? 1 : n);
const todayJ = d => A.dayOfYear(d.getFullYear(), d.getMonth() + 1, d.getDate());

/* ---------- persistence (per-viewer convenience only) ---------- */
const KEY = 'agrikalk.v1';
let store = {};
try { store = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { store = {}; }
function save() { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {} }
store.loc = store.loc || { lat: 14.6, lon: 121.0, elev: 20, site: 'coastal', set: false };
store.inputs = store.inputs || {};

/* ---------- bilingual strings ---------- */
const T = {
  app: { en: 'AgriKalkunahon', fil: 'AgriKalkunahon' },
  tagline: { en: 'What should I do on the farm today?', fil: 'Ano ang gagawin ko ngayon sa bukid?' },
  cards: {
    water: { en: 'Should I water today?', fil: 'Kailangan ko bang magpatubig ngayon?' },
    rice: { en: 'Rice field: re-flood now?', fil: 'Sa palayan: magpatubig na ba?' },
    rain: { en: 'How much of the rain counts?', fil: 'Gaano karaming ulan ang napakinabangan?' },
    spray: { en: 'Is it safe to spray now?', fil: 'Ligtas bang mag-spray ngayon?' },
    dry: { en: 'Can my palay be dried enough today?', fil: 'Matutuyo ba nang sapat ang palay ngayon?' },
    stress: { en: 'Too hot or too cold for my crop?', fil: 'Masyado bang mainit o malamig para sa pananim?' },
    frost: { en: 'Frost (andap) tonight?', fil: 'Mag-aandap (frost) ba ngayong gabi?' },
    disease: { en: 'Will the leaves be wet in the morning?', fil: 'Mababasa ba ang dahon sa umaga?' },
    timing: { en: 'When is harvest? Heat units, day length', fil: 'Kailan ang ani? Init na naipon, haba ng araw' },
    sources: { en: 'Sources and limits', fil: 'Sanggunian at hangganan' },
    feedback: { en: 'Comments and suggestions', fil: 'Puna at mungkahi' },
    about: { en: 'About this app', fil: 'Tungkol sa app na ito' }
  },
  ui: {
    compute: { en: 'Answer', fil: 'Sagot' }, why: { en: 'Why', fil: 'Bakit' }, sources: { en: 'Sources', fil: 'Sanggunian' },
    assumptions: { en: 'Assumptions', fil: 'Mga palagay' }, limits: { en: 'Not valid for', fil: 'Hindi para sa' }, back: { en: 'Main Menu', fil: 'Pangunahing Menu' },
    location: { en: 'Location', fil: 'Lokasyon' }, gps: { en: 'Use phone GPS', fil: 'Gamitin ang GPS ng smartphone' },
    lat: { en: 'Latitude (°N)', fil: 'Latitud (°H)' }, lon: { en: 'Longitude (°E)', fil: 'Longhitud (°S)' }, elev: { en: 'Elevation (m)', fil: 'Taas mula sa dagat (m)' },
    site: { en: 'Site', fil: 'Lugar' }, siteCoastal: { en: 'Near the sea (coastal)', fil: 'Malapit sa dagat' }, siteInterior: { en: 'Inland, far from the sea', fil: 'Malayo sa dagat' }, siteIsland: { en: 'Small island (20 km across or less)', fil: 'Maliit na isla (20 km o mas makitid)' },
    date: { en: 'Date', fil: 'Petsa' }, tmax: { en: 'Afternoon high (°C)', fil: 'Pinakamainit sa hapon (°C)' }, tmin: { en: 'Morning low (°C)', fil: 'Pinakamalamig sa umaga (°C)' },
    rhmax: { en: 'Morning humidity, if known (%)', fil: 'Halumigmig sa umaga, kung alam (%)' }, rhmin: { en: 'Afternoon humidity, if known (%)', fil: 'Halumigmig sa hapon, kung alam (%)' },
    wind: { en: 'Wind', fil: 'Hangin' }, sun: { en: 'Hours of sunshine, if known', fil: 'Oras ng sikat ng araw, kung alam' },
    crop: { en: 'Crop', fil: 'Pananim' }, stage: { en: 'Growth stage', fil: 'Yugto ng paglaki' }, soil: { en: 'Soil', fil: 'Lupa' }, zr: { en: 'Root depth (m)', fil: 'Lalim ng ugat (m)' },
    daysSince: { en: 'Days since the soil was last soaked (rain or irrigation)', fil: 'Ilang araw mula nang huling mabasa nang husto ang lupa' },
    rains: { en: 'Rain since then (mm, and how many days ago)', fil: 'Ulan mula noon (mm, at ilang araw na ang nakalipas)' },
    method: { en: 'How you water', fil: 'Paraan ng pagpapatubig' }, area: { en: 'Area (hectares)', fil: 'Lawak (ektarya)' }, pump: { en: 'Pump discharge, if any (litres per second)', fil: 'Labas ng bomba, kung meron (litro kada segundo)' },
    result: { en: 'Result', fil: 'Resulta' }, fallback: { en: 'Estimated, not measured', fil: 'Tinantiya, hindi sinukat' }
  },
  stages: { initial: { en: 'Just planted (initial)', fil: 'Bagong tanim' }, development: { en: 'Growing, not yet full cover', fil: 'Lumalaki, hindi pa buo ang lilim' }, mid: { en: 'Full cover to flowering (mid-season)', fil: 'Buo ang lilim hanggang pamumulaklak' }, late: { en: 'Ripening (late season)', fil: 'Nagkakahinog' } },
  crops: { rice: { en: 'Rice (lowland)', fil: 'Palay (mababang lupa)' }, maize: { en: 'Corn (grain)', fil: 'Mais (butil)' }, sweetcorn: { en: 'Sweet corn', fil: 'Sweet corn' }, sugarcane: { en: 'Sugarcane', fil: 'Tubo' }, banana1: { en: 'Banana, first year', fil: 'Saging, unang taon' }, banana2: { en: 'Banana, second year onward', fil: 'Saging, ikalawang taon pataas' }, palm: { en: 'Palm trees (FAO-56 value; used for coconut)', fil: 'Mga palma (halaga ng FAO-56; ginagamit sa niyog)' }, cabbage: { en: 'Cabbage', fil: 'Repolyo' }, potato: { en: 'Potato', fil: 'Patatas' }, carrot: { en: 'Carrot', fil: 'Karot' }, lettuce: { en: 'Lettuce', fil: 'Letsugas' }, broccoli: { en: 'Broccoli', fil: 'Broccoli' }, cauliflower: { en: 'Cauliflower', fil: 'Cauliflower' }, tomato: { en: 'Tomato', fil: 'Kamatis' }, pepper: { en: 'Bell pepper', fil: 'Bell pepper' }, strawberry: { en: 'Strawberry', fil: 'Strawberry' }, beans_green: { en: 'Green beans', fil: 'Sitaw / Baguio beans' } },
  soils: { sand: { en: 'Sand', fil: 'Buhangin' }, loamy_sand: { en: 'Loamy sand', fil: 'Buhanging may lupa' }, sandy_loam: { en: 'Sandy loam', fil: 'Mabuhanging lupa' }, loam: { en: 'Loam', fil: 'Katamtamang lupa (loam)' }, silt_loam: { en: 'Silt loam', fil: 'Silt loam' }, silt: { en: 'Silt', fil: 'Silt' }, silt_clay_loam: { en: 'Silty clay loam', fil: 'Silty clay loam' }, silty_clay: { en: 'Silty clay', fil: 'Silty clay' }, clay: { en: 'Clay', fil: 'Luwad (clay)' } },
  windClass: { unknown: { en: 'Not known (2 m/s assumed)', fil: 'Hindi alam (ipagpapalagay na 2 m/s)' }, light: { en: 'Light (leaves barely move)', fil: 'Mahina (halos di gumagalaw ang dahon)' }, lightmoderate: { en: 'Light to moderate (leaves rustle)', fil: 'Mahina hanggang katamtaman (kumakaluskos ang dahon)' }, moderatestrong: { en: 'Moderate to strong (branches move)', fil: 'Katamtaman hanggang malakas (gumagalaw ang sanga)' }, strong: { en: 'Strong (small trees sway)', fil: 'Malakas (umuuga ang maliliit na puno)' } },
  methods: { surface: { en: 'Flooding, furrow or basin (60%)', fil: 'Pagbaha, kanal o basin (60%)' }, sprinkler: { en: 'Sprinkler (75%)', fil: 'Sprinkler (75%)' }, drip: { en: 'Drip (90%)', fil: 'Drip (90%)' } },
  verdicts: {
    need_wind: { en: 'Enter the wind first. Without it this card cannot say whether spraying is safe.', fil: 'Ilagay muna ang hangin. Kung wala ito, hindi masasabi ng card na ito kung ligtas mag-spray.' },
    bad_rh: { en: 'Humidity must be between 1 and 100%.', fil: 'Ang halumigmig ay dapat nasa 1 hanggang 100%.' },
    bad_minmax: { en: 'The afternoon high must be above the morning low.', fil: 'Dapat mas mataas ang pinakamainit sa hapon kaysa pinakamalamig sa umaga.' },
    cf_ok: { en: 'Water level is right. Keep it there.', fil: 'Tama ang lalim ng tubig. Panatilihin ito.' },
    cf_top_up: { en: 'Top up. Bring the water to {lo} to {hi} cm.', fil: 'Dagdagan ang tubig. Iangat sa {lo} hanggang {hi} cm.' },
    cf_too_deep: { en: 'Too deep. Let it down to {lo} to {hi} cm.', fil: 'Masyadong malalim. Pababain sa {lo} hanggang {hi} cm.' },
    cf_need_depth: { en: 'Measure the water depth in the field first.', fil: 'Sukatin muna ang lalim ng tubig sa bukid.' },
    cf_flowering_ok: { en: 'Flowering: the water is deep enough. Keep it flooded.', fil: 'Namumulaklak: sapat ang tubig. Panatilihing nakababad.' },
    cf_flowering_top_up: { en: 'Flowering: top up to 5 cm now.', fil: 'Namumulaklak: dagdagan ang tubig hanggang 5 cm ngayon.' },
    cf_drain_now: { en: 'Drain the field now for harvest.', fil: 'Patuyuin na ang bukid para sa anihan.' },
    intermittent_no_threshold: { en: 'No published depth says when to re-flood without a tube.', fil: 'Walang nailathalang lalim kung kailan dapat patubigan kung walang tubo.' },
    water_now: { en: 'Water now. Give about {mm} mm.', fil: 'Magpatubig na ngayon. Mga {mm} mm.' },
    water_tomorrow: { en: 'Water by tomorrow. Give about {mm} mm.', fil: 'Magpatubig bukas. Mga {mm} mm.' },
    wait: { en: 'No need to water yet. Wait about {d} days.', fil: 'Hindi pa kailangang magpatubig. Maghintay ng mga {d} araw.' },
    reflood_now: { en: 'Re-flood now to about 5 cm.', fil: 'Magpatubig na ngayon hanggang mga 5 cm.' },
    not_yet: { en: 'Not yet. Re-flood when the tube shows {trig} cm below the soil.', fil: 'Hindi pa. Magpatubig kapag {trig} cm na ang lalim ng tubig sa tubo mula sa lupa.' },
    flowering_keep_flooded: { en: 'Flowering: keep 5 cm of water.', fil: 'Namumulaklak: panatilihin ang 5 cm na tubig.' },
    flowering_top_up_to_5cm: { en: 'Flowering: top up to 5 cm now.', fil: 'Namumulaklak: dagdagan ng tubig hanggang 5 cm ngayon.' },
    before_awd_keep_shallow: { en: 'Too early for AWD. Keep 2 to 3 cm of water.', fil: 'Maaga pa para sa AWD. Panatilihin ang 2 hanggang 3 cm na tubig.' },
    drain_stop_irrigating: { en: 'Stop irrigating and let the field drain before harvest.', fil: 'Ihinto na ang pagpapatubig at patuyuin ang bukid bago mag-ani.' },
    need_tube_reading: { en: 'Read the field water tube first.', fil: 'Basahin muna ang tubo ng tubig sa bukid.' },
    good: { en: 'Good conditions to spray now.', fil: 'Maganda ang kondisyon para mag-spray ngayon.' },
    caution: { en: 'Spray with caution.', fil: 'Mag-ingat kung mag-i-spray.' },
    do_not_spray: { en: 'Do not spray now.', fil: 'Huwag mag-spray ngayon.' },
    can_reach_target: { en: 'Yes. Today\'s air can dry palay to about {x}%.', fil: 'Oo. Kayang patuyuin ng hangin ngayon ang palay hanggang mga {x}%.' },
    already_dry_enough: { en: 'Already dry enough. Stop drying and store it.', fil: 'Sapat na ang tuyo. Itigil ang pagpapatuyo at itago na.' },
    moisture_out_of_range: { en: 'Check the moisture reading. It must be between 1 and 99%.', fil: 'Suriin ang basa ng palay. Dapat nasa 1 hanggang 99%.' },
    not_assured_target: { en: 'Not assured. Today\'s air alone dries palay only to about {x}%.', fil: 'Hindi tiyak. Hanggang mga {x}% lang ang matutuyo ng palay sa hangin ngayon.' },
    heat_above_threshold: { en: 'Above the published heat threshold for this stage.', fil: 'Lampas sa nailathalang hangganan ng init para sa yugtong ito.' },
    heat_watch: { en: 'Near the heat threshold. Watch the crop.', fil: 'Malapit sa hangganan ng init. Bantayan ang pananim.' },
    cold_at_or_below_threshold: { en: 'At or below the published cold threshold.', fil: 'Nasa o mas mababa sa nailathalang hangganan ng lamig.' },
    within: { en: 'Within the published range for this stage.', fil: 'Nasa loob ng nailathalang saklaw para sa yugtong ito.' },
    possible: { en: 'Frost possible tonight. Protect if you can.', fil: 'Maaaring mag-andap ngayong gabi. Protektahan kung kaya.' },
    watch: { en: 'Watch tonight. Check the field in the hour before sunrise.', fil: 'Bantayan ngayong gabi. Tingnan ang bukid sa loob ng isang oras bago sumikat ang araw.' },
    unlikely: { en: 'Frost unlikely tonight.', fil: 'Malabong mag-andap ngayong gabi.' },
    dew_very_likely_near_saturation: { en: 'Wet leaves at dawn very likely. The air only needs to cool {dep} °C, which happens on almost any night.', fil: 'Halos tiyak na basa ang dahon sa madaling-araw. Kailangan lang lumamig ng {dep} °C ang hangin, na nangyayari halos tuwing gabi.' },
    dew_likely_if_cools_to_dewpoint: { en: 'Dew likely by morning if the night cools to {td} °C, which is {dep} °C below now.', fil: 'Malamang magkaroon ng hamog sa umaga kung lalamig hanggang {td} °C, {dep} °C mas malamig kaysa ngayon.' },
    lw_shorter_than_measured: { en: 'The PAGASA Farm Weather Forecast gives {lo} to {hi} hours of leaf wetness for your forecast area. That is a short wet spell: on clear dry-season nights on lowland rice at Los Baños, dew kept the leaves wet for {rlo} to {rhi} hours (see "Sources" below).', fil: 'Ayon sa Farm Weather Forecast ng PAGASA, {lo} hanggang {hi} oras na basa ang dahon sa inyong forecast area. Maikling panahon ito: sa maaliwalas na gabi ng tag-araw sa palayan sa Los Baños, {rlo} hanggang {rhi} oras na basa ang dahon dahil sa hamog (tingnan ang "Sanggunian" sa ibaba).' },
    lw_overlaps_measured: { en: 'The PAGASA Farm Weather Forecast gives {lo} to {hi} hours of leaf wetness for your forecast area. That reaches the length of a dewing night: on clear dry-season nights on lowland rice at Los Baños, dew kept the leaves wet for {rlo} to {rhi} hours (see "Sources" below).', fil: 'Ayon sa Farm Weather Forecast ng PAGASA, {lo} hanggang {hi} oras na basa ang dahon sa inyong forecast area. Umaabot ito sa haba ng isang gabing may hamog: sa maaliwalas na gabi ng tag-araw sa palayan sa Los Baños, {rlo} hanggang {rhi} oras na basa ang dahon (tingnan ang "Sanggunian" sa ibaba).' },
    lw_longer_than_measured: { en: 'The PAGASA Farm Weather Forecast gives {lo} to {hi} hours of leaf wetness for your forecast area, longer than a dewing night: on clear dry-season nights on lowland rice at Los Baños, dew kept the leaves wet for {rlo} to {rhi} hours (see "Sources" below). A spell this long usually means rain or fog, not dew alone.', fil: 'Ayon sa Farm Weather Forecast ng PAGASA, {lo} hanggang {hi} oras na basa ang dahon sa inyong forecast area, mas mahaba kaysa sa gabing may hamog: sa maaliwalas na gabi ng tag-araw sa palayan sa Los Baños, {rlo} hanggang {rhi} oras (tingnan ang "Sanggunian" sa ibaba). Ang ganitong haba ay karaniwang ulan o hamog-ulap, hindi hamog lamang.' },
    lw_out_of_range: { en: 'Leaf wetness hours must be between 0 and 24, with the low figure first.', fil: 'Ang oras ng basang dahon ay dapat nasa 0 hanggang 24, at ang mas mababa ang mauuna.' },
    lw_need_both: { en: 'Enter both figures of the range, for example 0 and 4.', fil: 'Ilagay ang dalawang bilang ng saklaw, halimbawa 0 at 4.' },
    dew_less_likely: { en: 'Dry leaves by morning more likely: the air must cool {dep} °C, and cloud or wind slows the night cooling.', fil: 'Malamang tuyo ang dahon sa umaga: kailangang lumamig ng {dep} °C ang hangin, at nababawasan ng ulap o hangin ang paglamig.' },
    hutton_high_risk: { en: 'High late blight risk: the Hutton Criteria were met.', fil: 'Mataas ang panganib ng late blight: natugunan ang Hutton Criteria.' },
    hutton_not_met: { en: 'Hutton Criteria not met in the last two days.', fil: 'Hindi natugunan ang Hutton Criteria sa huling dalawang araw.' },
    harvest: { en: 'Expected harvest around {date}. Judge by the grain, not by the date.', fil: 'Inaasahang ani sa bandang {date}. Ang butil ang basehan, hindi ang petsa.' }
  }
};
const t = (obj, ph) => {
  let en = obj.en, fil = obj.fil;
  if (ph) for (const k in ph) { en = en.replace('{' + k + '}', ph[k]); fil = fil.replace('{' + k + '}', ph[k]); }
  return { en, fil };
};
const bi = (obj, ph, cls) => { const s = t(obj, ph); return el('span', { class: 'bi ' + (cls || '') }, el('span', { class: 'en' }, s.en), el('span', { class: 'fil' }, s.fil)); };

/* explanations of engine method and flag codes */
/* Humidity outside 1 to 100% puts the dew point above the air temperature, which is impossible and
   silently poisons every card that derives one. Checked wherever a humidity reading is taken. */
const badRH = (...v) => v.some(x => x != null && (x < 1 || x > 100));
const CODES = {
  no_tube_no_published_threshold: 'Letting the field dry without a field water tube is not safe AWD. Safe AWD is defined by reading the water table in the tube, and the IRRI fact sheet gives no re-flood depth for a farmer without one. This app will not invent a number for it, so the answer below covers only what holds whatever method you use.',
  ea_given: 'Humidity from the vapour pressure you entered.', eq14_tdew: 'Humidity from the dew point (FAO-56 Eq. 14).', eq15_wetbulb: 'Humidity from the wet bulb (FAO-56 Eq. 15).',
  eq17_rhmaxmin: 'Humidity from morning and afternoon RH (FAO-56 Eq. 17).', eq18_rhmax: 'Humidity from morning RH only (FAO-56 Eq. 18).', eq19_rhmean: 'Humidity from mean RH (FAO-56 Eq. 19, which FAO-56 calls less desirable).',
  eq48_tdew_eq_tmin: 'No humidity given: dew point taken equal to the morning low (FAO-56 Eq. 48). FAO-56: this holds where the air is near saturation at sunrise and "should be checked" for the region; in dry conditions the true value is 2 to 3 °C lower.',
  rs_measured: 'Sunlight from your measured radiation.', eq35_sunshine: 'Sunlight from the hours of sunshine (FAO-56 Eq. 35, as = 0.25, bs = 0.50).',
  eq50_temperature_range: 'No sunshine given: sunlight estimated from the difference between the afternoon high and the morning low (FAO-56 Eq. 50). FAO-56 recommends averaging such daily estimates over a week or more.',
  eq51_island: 'Small island: sunlight from the FAO-56 island relation (Eq. 51), which FAO-56 allows only for monthly means at 0 to 100 m elevation.',
  u2_given: 'Wind as entered.', eq47_height_adjusted: 'Wind converted to 2 m height (FAO-56 Eq. 47).', table4_default_2ms: 'No wind given: 2 m/s used, the average of 2000 stations worldwide (FAO-56 Table 4). FAO-56 Example 20: about 7% less water at 1 m/s, 6% more at 3 m/s.',
  eq19_less_desirable: 'FAO-56 prefers RHmax and RHmin over mean RH.', ea_capped_at_es: 'Humidity was above saturation and was capped.', rs_capped_at_rso: 'Estimated sunlight exceeded the clear-sky value and was capped (FAO-56 Eq. 50 rule).',
  eq50_average_over_days: 'Daily result from temperature-estimated sunlight: treat as a several-day average, not a true daily value (FAO-56).', eq51_monthly_only: 'The island relation is for monthly means; today\'s number carries a wide uncertainty (FAO-56).', eq51_altitude_limit: 'The island relation is stated for 0 to 100 m elevation only.',
  u2_floor_0_5: 'Wind below 0.5 m/s raised to 0.5 m/s (FAO-56 rule).', kc_ini_is_group_value: 'The initial-stage crop coefficient is a group value that FAO-56 calls a planning approximation (Table 12, footnote 1).', rhmin_default_45: 'Afternoon humidity assumed 45% (FAO-56 Table 12 standard) because no temperatures were given.',
  sunshine_clamped_0_N: 'Sunshine hours were outside the possible range and have been limited to between zero and the daylight hours for your latitude and date. Check what you entered: the field wants hours of bright sunshine for the whole day, not minutes.',
  u2_clamped_1_6: 'Wind clamped to the 1 to 6 m/s range of FAO-56 Eq. 62.', rhmin_clamped_20_80: 'Afternoon humidity clamped to the 20 to 80% range of FAO-56 Eq. 62.', h_clamped_10: 'Crop height clamped to 10 m (FAO-56 Eq. 62).', kc_end_below_0_45_no_adjust: 'End-season coefficient below 0.45 is not climate-adjusted (FAO-56 Eq. 65 rule).', h_below_0_1_no_adjust: 'Crop shorter than 0.1 m: no climate adjustment (FAO-56).',
  postpone_awd_weeds: 'Weeds not yet managed: IRRI and PhilRice say postpone AWD 2 to 3 weeks.', rh_outside_corroborated_table: 'Humidity outside the 25 to 90% range of the corroborating EMC table.', temp_outside_corroborated_range: 'Temperature outside the 10 to 50 °C range covered by the corroborating data.',
  deltaT_below_2: 'Delta T below 2: very moist air, droplets survive and drift further; inversion risk (GRDC).', deltaT_8_10: 'Delta T 8 to 10: fast droplet evaporation, spray with caution (GRDC 2025).', deltaT_10_12: 'Delta T 10 to 12: only very coarse droplets (GRDC 2025).', deltaT_above_12: 'Delta T above 12: avoid spraying (GRDC 2025).',
  wind_below_3: 'Wind below 3 km/h: too still, direction unpredictable, inversion likely (BOM, Agriculture Victoria, APVMA label 3 to 20 km/h).', wind_3_5_variable: 'Wind 3 to 5 km/h: direction may shift (GRDC 2022 prefers above 5 km/h).', wind_above_max: 'Wind above the limit (15 km/h, or the label limit up to 20 km/h).', wind_unknown: 'Wind not entered: the wind checks were skipped.',
  inversion_window: 'Within the surface inversion window (1 to 2 h before sunset until 1 to 2 h after sunrise) with wind under 11 km/h: labels prohibit spraying under hazardous inversions (APVMA label, GRDC).', inversion_window_windy: 'Within the inversion window but wind above 11 km/h: inversion less likely, still caution (GRDC).', inversion_indicators: 'Mist, fog, dew or hanging smoke indicate an inversion (GRDC 10.4 checklist).', temp_above_30: 'Air above 30 °C: GRDC 2022 says avoid spraying.',
  maturity_basis_not_stated_for_method: 'PhilRice gives one maturity figure for this variety without saying whether it is for transplanted or direct-seeded crops.'
};

/* ---------- shared location block ---------- */
function locationBlock(onchange) {
  const L = store.loc;
  const wrap = el('fieldset', { class: 'loc' }, el('legend', null, bi(T.ui.location)));
  const lat = numInput('lat', T.ui.lat, L.lat, 0.01, { prefilled: true }), lon = numInput('lon', T.ui.lon, L.lon, 0.01, { prefilled: true }), elev = numInput('elev', T.ui.elev, L.elev, 1, { prefilled: true });
  const site = selectInput('site', T.ui.site, [['coastal', T.ui.siteCoastal], ['interior', T.ui.siteInterior], ['island', T.ui.siteIsland]], L.site);
  const hint = el('p', { class: 'lochint' }, bi({ en: 'Give latitude and longitude to two decimal places, no more. A hundredth of a degree is about 1 km, which is as fine as any of these calculations can tell apart, and more digits only look precise.', fil: 'Dalawang decimal lamang ang ilagay sa latitud at longhitud. Ang isang sandaan ng digri ay mga 1 km, at iyon na ang pinakamaliit na pagkakaibang kayang tukuyin ng mga kalkulasyong ito; ang dagdag na numero ay mukhang tumpak lamang.' }));
  const note = el('p', { class: 'locnote' });
  /* A silent failure here is how a farmer ends up with someone else's sunrise: the button appears to
     do nothing and the default quietly stays. Say what happened and what to do instead. */
  const gpsFailed = why => { note.innerHTML = ''; note.appendChild(bi(why)); redraw(); };
  const gps = el('button', { type: 'button', class: 'btn small', onclick: () => {
    if (!navigator.geolocation) return gpsFailed({ en: 'This browser cannot read your location. Type the numbers in below.', fil: 'Hindi kayang basahin ng browser na ito ang lokasyon ninyo. I-type ang mga numero sa ibaba.' });
    navigator.geolocation.getCurrentPosition(
      p => { const n = v => (typeof v === 'number' && isFinite(v)) ? v : null;   // isFinite(null) is true, so test the type too
             lat.input.value = p.coords.latitude.toFixed(2); lon.input.value = p.coords.longitude.toFixed(2);
             if (n(p.coords.altitude) != null) elev.input.value = Math.round(p.coords.altitude);
             /* The device states its own uncertainty; record it so the card can say how much it matters. */
             L.acc = n(p.coords.accuracy); L.altAcc = n(p.coords.altitudeAccuracy); L.altFromGps = n(p.coords.altitude) != null; sync(); },
      err => gpsFailed(err && err.code === 1
        ? { en: 'Your device refused to share its location, so the app is still using the location shown below. Type your own in.', fil: 'Tumanggi ang device ninyo na ibigay ang lokasyon, kaya ang nasa ibaba pa rin ang ginagamit ng app. I-type ang sarili ninyo.' }
        : { en: 'Could not read your location. Type the numbers in below.', fil: 'Hindi nakuha ang lokasyon ninyo. I-type ang mga numero sa ibaba.' }),
      { enableHighAccuracy: true, timeout: 8000 });
  } }, bi(T.ui.gps));
  function sync() { L.lat = +lat.input.value; L.lon = +lon.input.value; L.elev = +elev.input.value; L.site = site.input.value; L.set = true; save(); redraw(); if (onchange) onchange(); }
  [lat, lon, elev].forEach(x => x.input.addEventListener('input', () => { L.acc = null; L.altAcc = null; L.altFromGps = false; }));
  function redraw() {
    warn.innerHTML = '';
    const u = gpsUncertainty(); if (u) warn.appendChild(el('p', { class: 'locacc' }, bi(u)));
    locationWarnings().forEach(x => warn.appendChild(el('p', { class: 'warn locwarn' }, bi(x))));
  }
  const warn = el('div');
  [lat, lon, elev, site].forEach(x => x.input.addEventListener('change', sync));
  wrap.append(gps, note, hint, lat.row, lon.row, elev.row, site.row, warn);
  redraw();
  return wrap;
}
/* What the app can check about the saved location without guessing: whether anyone ever set it,
   whether it is in the country every threshold here comes from, and whether the device clock agrees
   with the Philippine time the sun calculations assume. */
/* The reading window compares the device clock against sun times computed for UTC+8. On a device set
   to any other zone the two are not on the same footing, so the window cannot be tested; the card then
   answers anyway and says the window went unchecked, rather than refusing for a reason that is false. */
const tzHours = () => -new Date().getTimezoneOffset() / 60;
/* Which clock the sun times belong to. The device clock is the better answer whenever the person is
   anywhere near their field: it knows the legal offset and any daylight saving, and longitude knows
   neither. It is the wrong answer only when the device is somewhere else entirely, which is what
   turns a 05:48 Manila sunrise into 23:48 on a European laptop. So trust the device while it sits
   within two hours of the field's standard meridian, which covers daylight saving and the ordinary
   legal departures from the meridian, and fall back to the meridian beyond that. */
const meridianTz = () => { const L = store.loc; return isFinite(L.lon) ? Math.round(L.lon / 15) : tzHours(); };
/* If the location came from this device's own fix, the device is standing in the field and its clock
   is the field's clock, daylight saving and all. store.loc.acc is set only by the locate button and
   cleared the moment anyone types a coordinate by hand, so it answers exactly that question. */
const locFromGps = () => store.loc.acc != null;
const fieldTz = () => (locFromGps() || Math.abs(tzHours() - meridianTz()) <= 2 ? tzHours() : meridianTz());
const fieldShiftH = () => fieldTz() - tzHours();
const fieldNow = () => new Date(Date.now() + fieldShiftH() * 3600000);
const fieldHourNow = () => { const d = fieldNow(); return d.getHours() + d.getMinutes() / 60; };
const inPH = () => { const L = store.loc; return isFinite(L.lat) && isFinite(L.lon) && L.lat >= 4 && L.lat <= 22 && L.lon >= 116 && L.lon <= 127; };
/* What the device said about its own fix, and what that does to the answers. Horizontal error is
   compared with the hundredth of a degree the app asks for (about 1 km); elevation enters only through
   the FAO-56 Eq. 7 air pressure, where 50 m moves ETo by 0.06 per cent. */
function gpsUncertainty() {
  const L = store.loc;
  const grid0 = Math.round(A.haversineKm(0, 0, 0.01, 0) * 1000);
  const alt = ' Elevation enters only the air pressure in FAO-56, where being 50 m out moves the water answer by about 0.06 per cent.';
  const altF = ' Pumapasok lamang ang taas sa presyon ng hangin sa FAO-56, at ang 50 m na pagkakamali ay 0.06 porsiyento lamang ang ibinabago sa sagot sa tubig.';
  /* A typed coordinate has an uncertainty too: the app reads two decimal places and no more. Say it,
     so the farmer is never looking at a number without one. */
  if (typeof L.acc !== 'number' || !isFinite(L.acc)) return {
    en: 'These coordinates were typed in, so the app knows of no satellite fix behind them. It reads them to a hundredth of a degree, about ' + grid0 + ' m across the ground, and works to no finer than that.' + alt,
    fil: 'Itinipa ang mga koordinadang ito, kaya walang alam ang app na fix mula sa satellite. Binabasa ito hanggang sandaan ng digri lamang, mga ' + grid0 + ' m sa lupa, at hindi hihigit doon ang kanyang tinutukoy.' + altF
  };
  const h = Math.round(L.acc);
  const v = (typeof L.altAcc === 'number' && isFinite(L.altAcc)) ? Math.round(L.altAcc) : null;
  const grid = Math.round(A.haversineKm(0, 0, 0.01, 0) * 1000);   // metres in the hundredth of a degree the app works in
  const coarse = L.acc >= grid;
  /* The browser reports one radius in metres, not a figure per coordinate, so put it into the units of
     the boxes above: degrees of latitude are the same everywhere, degrees of longitude shrink with
     the cosine of the latitude, so the two are not equal. */
  const mLat = A.haversineKm(0, 0, 1, 0) * 1000, mLon = A.haversineKm(L.lat, 0, L.lat, 1) * 1000;
  const dLat = L.acc / mLat, dLon = mLon > 1 ? L.acc / mLon : null;
  /* Below half a grid cell both figures round to 0.00, which tells the farmer nothing, so only show
     the conversion when the circle is wide enough to move the second decimal place. */
  const showDeg = dLat >= 0.005 || (dLon != null && dLon >= 0.005);
  const inDeg = showDeg ? ' In the units of the boxes above that is about \u00b1' + fmt(dLat, 2) + ' \u00b0 of latitude and \u00b1' + (dLon != null ? fmt(dLon, 2) : '\u2013') + ' \u00b0 of longitude, one circle of that radius around the point rather than a separate figure for each.' : '';
  const inDegF = showDeg ? ' Sa yunit ng mga kahon sa itaas, mga \u00b1' + fmt(dLat, 2) + ' \u00b0 iyon ng latitud at \u00b1' + (dLon != null ? fmt(dLon, 2) : '\u2013') + ' \u00b0 ng longhitud, isang bilog na ganoon ang lapad sa paligid ng punto at hindi magkahiwalay na bilang sa bawat isa.' : '';
  const en = 'Your device put this fix at about \u00b1' + h + ' m across the ground'
    + (v != null ? ' and \u00b1' + v + ' m in height' : (L.altFromGps ? ', and gave no figure for the height' : ', and gave no height at all'))
    + (coarse
        ? '. That is as wide as the hundredth of a degree this app works in, about ' + grid + ' m, so the fix is too rough to trust. A figure this wide usually means the browser located you from the network rather than from satellites, and a VPN will place you wherever it leaves the internet, not where your field is. Check the numbers against what you know, or type them in yourself.'
        : '. That is finer than the hundredth of a degree this app works in, about ' + grid + ' m, so it changes nothing.')
    + inDeg
    + ' Height matters even less: it enters only the air pressure in FAO-56, where being 50 m out moves the water answer by about 0.06 per cent.'
    + (!L.altFromGps ? ' The elevation below is not from the satellite fix; type it in yourself if you know it.' : '');
  const fil = 'Ayon sa device ninyo, ang lokasyong ito ay may \u00b1' + h + ' m na kawalang-katiyakan sa lupa'
    + (v != null ? ' at \u00b1' + v + ' m sa taas' : (L.altFromGps ? ', at walang ibinigay na bilang para sa taas' : ', at walang ibinigay na taas'))
    + (coarse
        ? '. Kasinlawak iyon ng sandaan ng digri na ginagamit ng app, mga ' + grid + ' m, kaya masyadong magaspang ang fix. Kadalasan, ibig sabihin nito ay galing sa network ang lokasyon at hindi sa satellite; at kung may VPN kayo, ilalagay kayo nito kung saan lumalabas ang VPN, hindi kung nasaan ang bukid ninyo. Suriin ang mga numero o i-type na lamang ninyo.'
        : '. Mas maliit pa iyon kaysa sa sandaan ng digri na ginagamit ng app, mga ' + grid + ' m, kaya wala itong binabago.')
    + inDegF
    + ' Mas maliit pa ang epekto ng taas: pumapasok lamang ito sa presyon ng hangin sa FAO-56, at ang 50 m na pagkakamali ay 0.06 porsiyento lamang ang ibinabago sa sagot sa tubig.'
    + (!L.altFromGps ? ' Hindi galing sa satellite ang taas sa ibaba; i-type na lamang ninyo kung alam ninyo.' : '');
  return { en: en, fil: fil };
}
function locationWarnings() {
  const L = store.loc, out = [];
  if (!L.set) out.push({ en: 'This is the app\'s starting location (Metro Manila), not your field. Nothing you see that depends on location, including sunrise, sunset and the frost reading window, is about your place until you set it.', fil: 'Ito ang panimulang lokasyon ng app (Metro Manila), hindi ang bukid ninyo. Lahat ng nakadepende sa lokasyon, kasama ang pagsikat at paglubog ng araw at ang oras ng pagbasa para sa andap, ay hindi tungkol sa lugar ninyo hangga\'t hindi ninyo ito itinatakda.' });
  if (isFinite(L.lat) && isFinite(L.lon) && (L.lat < 4 || L.lat > 22 || L.lon < 116 || L.lon > 127)) out.push({ en: 'This location is outside the Philippines. The physics still holds anywhere: evapotranspiration, dew point, drying and day length are FAO-56 and general, and the clock times are computed for your own time zone. The thresholds are another matter. The rice water depths and harvest checks are Philippine, the spray bands Australian, the vegetable thresholds Queensland, the late blight model Scottish and untested outside the UK, and the frost card is built on Benguet records. Every result names its source, so check whether that source suits your country.', fil: 'Nasa labas ng Pilipinas ang lokasyong ito. Nananatiling tama ang pisika kahit saan: ang evapotranspiration, dew point, pagpapatuyo at haba ng araw ay FAO-56 at pangkalahatan, at ang mga oras ay batay sa sariling time zone ninyo. Iba naman ang mga hangganan. Ang lalim ng tubig sa palayan at ang pagsusuri sa pag-ani ay Pilipino, ang spray bands ay Australyano, ang hangganan sa gulay ay Queensland, ang modelo sa late blight ay Scottish at hindi pa nasusubok sa labas ng UK, at ang card ng andap ay nakabatay sa talaan ng Benguet. Bawat sagot ay may nakasaad na sanggunian, kaya suriin kung angkop ito sa bansa ninyo.' });
  const dev = tzHours(), fld = fieldTz();
  const z = n => 'UTC' + (n >= 0 ? '+' : '') + n;
  if (dev !== fld) out.push({ en: 'This device\'s clock is set to ' + z(dev) + ', too far from your field to be its clock, so every hour shown here, sunrise, sunset, the reading window and the drying window, is worked out for ' + z(fld) + ' instead, from the field\'s longitude. Those are the times on the clocks around the field, not the time on this screen.', fil: 'Nakatakda sa ' + z(dev) + ' ang orasan ng device na ito, masyadong malayo sa bukid ninyo, kaya lahat ng oras dito, ang pagsikat at paglubog ng araw, ang oras ng pagbasa at ang oras ng pagkatuyo, ay ayon sa ' + z(fld) + ' batay sa longitude ng bukid. Ito ang mga oras sa mga orasan sa paligid ng bukid, hindi ang oras sa screen na ito.' });
  else if (isFinite(L.lon) && dev !== meridianTz() && !locFromGps()) out.push({ en: 'Times here follow this device\'s clock, ' + z(dev) + ', which is taken to be your field\'s clock as well. That is right if you are at or near the field. If you have carried this device into another time zone without moving the location above, press the locate button or type in where the crop actually is.', fil: 'Ang mga oras dito ay sumusunod sa orasan ng device na ito, ' + z(dev) + ', na itinuturing ding orasan ng bukid ninyo. Tama ito kung nasa bukid kayo o malapit dito. Kung dinala ninyo ang device sa ibang time zone nang hindi binabago ang lokasyon sa itaas, pindutin ang locate button o i-type kung nasaan talaga ang pananim.' });
  return out;
}
function numInput(id, label, value, step, opts) {
  const input = el('input', { type: 'number', id: id, step: step || 'any', inputmode: 'decimal' });
  if (value != null && value !== '') input.value = value;
  if (opts && opts.placeholder) input.placeholder = opts.placeholder;
  const row = el('label', { class: 'row' }, bi(label), optTag(opts), input);
  return { row, input };
}
/* Farmers were filling every box because nothing said which ones they could leave alone. Only the
   inputs a card genuinely cannot answer without are unmarked. */
function optTag(opts) {
  if (!opts) return null;
  if (opts.optional) return el('span', { class: 'opt' }, bi({ en: '(optional)', fil: '(opsyonal)' }));
  /* Not blank, but filled by the app rather than by the farmer. Calling these "optional" would tell
     someone to ignore a latitude that is probably not theirs. */
  if (opts.prefilled) return el('span', { class: 'opt pre' }, bi({ en: '(filled in for you, change if wrong)', fil: '(nalagay na para sa inyo, palitan kung mali)' }));
  return null;
}
function selectInput(id, label, options, value) {
  const input = el('select', { id: id });
  options.forEach(([v, lab]) => { const s = t(lab); input.appendChild(el('option', { value: v }, s.en + ' / ' + s.fil)); });
  if (value != null) input.value = value;
  const row = el('label', { class: 'row' }, bi(label), input);
  return { row, input };
}
function dateInput(id, label, value, opts) {
  /* opts is { optional } for a box that may stay blank, or { prefilled } for one this app fills with
     today's date. A bare boolean used to mean "optional"; both forms are accepted. */
  const o = (opts === true) ? { optional: true } : (opts || {});
  const input = el('input', { type: 'date', id: id }); input.value = o.optional ? (value || '') : (value || new Date().toISOString().slice(0, 10));
  return { row: el('label', { class: 'row' }, bi(label), optTag(o), input), input };
}
function checkInput(id, label, value) {
  const input = el('input', { type: 'checkbox', id: id }); input.checked = !!value;
  return { row: el('label', { class: 'row check' }, input, bi(label)), input };
}
const num = inp => { const v = parseFloat(inp.value); return isFinite(v) ? v : null; };
function remember(card, obj) { store.inputs[card] = obj; save(); }
function show(out, node) { out.appendChild(node); try { node.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) {} }
const recall = (card) => store.inputs[card] || {};

/* ---------- result rendering ---------- */
/* A reference may carry a second URL (url2), for instance a project's own abstract alongside the
   news item that reports it. Each link is labelled, so the reader knows which is which. */
function refLinks(r) {
  if (!r || !r.url) return null;
  const frag = el('span', { class: 'reflinks' }, el('a', { href: r.url, target: '_blank', rel: 'noopener' }, r.urllabel || 'link'));
  if (r.url2) { frag.appendChild(document.createTextNode(' ')); frag.appendChild(el('a', { href: r.url2, target: '_blank', rel: 'noopener' }, r.url2label || 'link')); }
  return frag;
}
function result(spec) {
  // spec: {level:'go'|'caution'|'stop'|'info', verdict:{en,fil}, lines:[[label, value]], why:[str], flags:[str], assumptions:[str], limits:[str], sources:[id]}
  const box = el('section', { class: 'result ' + spec.level });
  box.appendChild(el('h3', { class: 'verdict' }, el('span', { class: 'en' }, spec.verdict.en), el('span', { class: 'fil' }, spec.verdict.fil)));
  if (spec.lines && spec.lines.length) { const dl = el('dl', { class: 'nums' }); spec.lines.forEach(([k, v, cls]) => { dl.append(el('dt', { class: cls || '' }, k), el('dd', { class: cls || '' }, v)); }); box.appendChild(dl); }
  const det = (title, items, cls) => { if (!items || !items.length) return; const d = el('details', { class: cls || '' }, el('summary', null, bi(title))); const ul = el('ul'); items.forEach(x => ul.appendChild(el('li', { html: x }))); d.appendChild(ul); box.appendChild(d); };
  det(T.ui.why, spec.why);
  det(T.ui.fallback, spec.flags, 'flags');
  det(T.ui.assumptions, spec.assumptions);
  det(T.ui.limits, spec.limits);
  if (spec.sources && spec.sources.length) {
    const d = el('details', null, el('summary', null, bi(T.ui.sources)));
    const ul = el('ul');
    spec.sources.forEach(id => { const r = A.REFS[id]; if (r) ul.appendChild(el('li', null, el('span', { class: 'cls ' + r.cls }, r.cls), ' ', r.cite, ' ', refLinks(r))); });
    d.appendChild(ul); box.appendChild(d);
  }
  return box;
}
const LIMITS_ETO = [
  'FAO-56 needs the afternoon high and the morning low of the same day; a single reading is not enough.',
  'Estimated sunlight (no sunshine hours) makes a single day uncertain; FAO-56 says to average over a week or more.',
  'On small islands (20 km across or less) the temperature method is not appropriate; the app switches to the FAO-56 island relation, which is for monthly means only.',
  'Results are for a well-watered, disease-free crop under good management (FAO-56 standard conditions).'
];

/* ---------- cards ---------- */
const CARDS = {};

/* WATER */
CARDS.water = function (root) {
  const prev = recall('water');
  const form = el('form', { class: 'card-form', onsubmit: e => { e.preventDefault(); run(); } });
  form.appendChild(locationBlock());
  const cropOpts = Object.keys(A.CROPS).map(k => [k, T.crops[k]]);
  const crop = selectInput('crop', T.ui.crop, cropOpts, prev.crop || 'maize');
  const stage = selectInput('stage', T.ui.stage, Object.keys(T.stages).map(k => [k, T.stages[k]]), prev.stage || 'mid');
  const soil = selectInput('soil', T.ui.soil, Object.keys(A.SOILS).map(k => [k, T.soils[k]]), prev.soil || 'loam');
  const zr = numInput('zr', T.ui.zr, prev.zr, 0.1, { prefilled: true });
  const date = dateInput('date', T.ui.date, prev.date, { prefilled: true });
  const tmax = numInput('tmax', T.ui.tmax, prev.tmax, 0.1), tmin = numInput('tmin', T.ui.tmin, prev.tmin, 0.1);
  const rhmax = numInput('rhmax', T.ui.rhmax, prev.rhmax, 1, { optional: true }), rhmin = numInput('rhmin', T.ui.rhmin, prev.rhmin, 1, { optional: true });
  const wind = selectInput('wind', T.ui.wind, Object.keys(T.windClass).map(k => [k, T.windClass[k]]), prev.wind || 'unknown');
  const sun = numInput('sun', T.ui.sun, prev.sun, 0.5, { optional: true });
  const days = numInput('days', T.ui.daysSince, prev.days == null ? 5 : prev.days, 1, { prefilled: true });
  const rainRows = [0, 1, 2].map(i => { const mm = numInput('rmm' + i, { en: 'Rain ' + (i + 1) + ' (mm)', fil: 'Ulan ' + (i + 1) + ' (mm)' }, prev['rmm' + i], 0.5, { optional: true }), ago = numInput('rago' + i, { en: 'days ago', fil: 'araw na nakalipas' }, prev['rago' + i], 1, { optional: true }); return { mm, ago }; });
  const method = selectInput('method', T.ui.method, Object.keys(T.methods).map(k => [k, T.methods[k]]), prev.method || 'surface');
  const area = numInput('area', T.ui.area, prev.area == null ? 1 : prev.area, 0.01, { prefilled: true }), pump = numInput('pump', T.ui.pump, prev.pump, 0.5, { optional: true });
  function setZr() { const c = A.CROPS[crop.input.value]; if (c && !zr.input.value) zr.input.value = c.zr[0]; }
  crop.input.addEventListener('change', () => { zr.input.value = ''; setZr(); }); setZr();
  const rainBox = el('div', { class: 'grid2' }); rainRows.forEach(r => rainBox.append(r.mm.row, r.ago.row));
  form.append(el('h4', null, bi(T.ui.crop)), crop.row, stage.row, soil.row, zr.row,
    el('h4', null, bi({ en: 'Weather today', fil: 'Panahon ngayon' })), date.row, tmax.row, tmin.row, rhmax.row, rhmin.row, wind.row, sun.row,
    el('h4', null, bi({ en: 'Water since the last soaking', fil: 'Tubig mula sa huling pagkabasa' })), days.row, el('p', { class: 'hint' }, bi(T.ui.rains)), rainBox,
    el('h4', null, bi({ en: 'Your irrigation', fil: 'Pagpapatubig mo' })), method.row, area.row, pump.row,
    el('button', { type: 'submit', class: 'btn primary' }, bi(T.ui.compute)));
  const out = el('div');
  root.append(form, out);
  function run() {
    const inp = { crop: crop.input.value, stage: stage.input.value, soil: soil.input.value, zr: num(zr.input), date: date.input.value, tmax: num(tmax.input), tmin: num(tmin.input), rhmax: num(rhmax.input), rhmin: num(rhmin.input), wind: wind.input.value, sun: num(sun.input), days: num(days.input), method: method.input.value, area: num(area.input), pump: num(pump.input) };
    rainRows.forEach((r, i) => { inp['rmm' + i] = num(r.mm.input); inp['rago' + i] = num(r.ago.input); });
    remember('water', inp);
    out.innerHTML = '';
    if (inp.tmax == null || inp.tmin == null) { show(out, result({ level: 'info', verdict: { en: 'Enter the afternoon high and the morning low.', fil: 'Ilagay ang pinakamainit sa hapon at pinakamalamig sa umaga.' } })); return; }
    if (inp.tmax < inp.tmin) { show(out, result({ level: 'info', verdict: { en: 'The high must be above the low.', fil: 'Dapat mas mataas ang pinakamainit kaysa pinakamalamig.' } })); return; }
    if (badRH(inp.rhmax, inp.rhmin)) { show(out, result({ level: 'info', verdict: t(T.verdicts.bad_rh) })); return; }
    const L = store.loc, d = new Date(inp.date + 'T00:00:00'), J = todayJ(d);
    const u2 = inp.wind === 'unknown' ? null : A.WIND_CLASS_MS[inp.wind];
    const e = A.eto({ Tmax: inp.tmax, Tmin: inp.tmin, RHmax: inp.rhmax, RHmin: inp.rhmin, u2: u2, n: inp.sun, lat: L.lat, elev: L.elev, J: J, site: L.site });
    const kc = A.cropKc(inp.crop, { u2: e.u2, Tmin: inp.tmin, Tmax: inp.tmax, RHmin: inp.rhmin, riceHumidity: 'subhumid', riceWind: e.u2 <= 1 ? 'light' : (e.u2 >= 4 ? 'strong' : 'moderate') });
    const kcNow = { initial: kc.kcIni, development: (kc.kcIni + kc.kcMid) / 2, mid: kc.kcMid, late: (kc.kcMid + kc.kcEnd) / 2 }[inp.stage];
    const c = A.CROPS[inp.crop], s = A.soilMid(inp.soil), zrUse = inp.zr || c.zr[0];
    const eff = { surface: 0.60, sprinkler: 0.75, drip: 0.90 }[inp.method];
    const rains = []; rainRows.forEach((r, i) => { if (inp['rmm' + i] > 0 && inp['rago' + i] != null) rains.push({ day: Math.max(1, Math.round(inp.days - inp['rago' + i])), mm: inp['rmm' + i] }); });
    const dec = A.irrigationDecision({ fc: s.fc, wp: s.wp, zr: zrUse, p: c.p, etoPerDay: e.eto, kc: kcNow, daysSinceWet: inp.days || 0, rains: rains, efficiency: eff, areaHa: inp.area || 1, pumpLs: inp.pump });
    const ph = { mm: fmt(dec.grossMm, 0), d: fmt(dec.daysToRaw, 0) };
    const level = dec.code === 'water_now' ? 'stop' : (dec.code === 'water_tomorrow' ? 'caution' : 'go');
    const lines = [
      [bi({ en: 'Crop water use today', fil: 'Gamit na tubig ng pananim ngayon' }), fmt(dec.etc) + ' mm/day (ETo ' + fmt(e.eto) + ' × Kc ' + fmt(kcNow, 2) + ')'],
      [bi({ en: 'Water used from the root zone so far', fil: 'Nagamit nang tubig mula sa ugat' }), fmt(dec.Dr, 0) + ' mm of ' + fmt(dec.raw, 0) + ' mm readily available (total ' + fmt(dec.taw, 0) + ' mm)'],
    ];
    if (dec.code !== 'wait') lines.push([bi({ en: 'Amount to apply', fil: 'Dami ng ipapatubig' }), fmt(dec.netMm, 0) + ' mm net, about ' + fmt(dec.grossMm, 0) + ' mm gross at ' + Math.round(eff * 100) + '% efficiency = ' + fmt(dec.m3, 0) + ' m³ (' + fmt(dec.litres / 1000, 0) + ' thousand litres) for ' + fmt(inp.area || 1, 2) + ' ha' + (dec.pumpHours ? ', about ' + fmt(dec.pumpHours, 1) + ' pump hours at ' + inp.pump + ' L/s' : '')]);
    lines.push([bi({ en: 'Hargreaves check (temperature only)', fil: 'Pagsusuri gamit ang Hargreaves' }), fmt(e.hargreaves) + ' mm/day ETo; FAO-56: overpredicts in humid air']);
    const why = [CODES[e.methods.ea], CODES[e.methods.rs], CODES[e.methods.wind], 'Crop coefficient from FAO-56 Table 12' + (inp.crop === 'rice' ? ' and Table 14' : '') + ', climate-adjusted with FAO-56 Eq. 62 and 65 (RHmin ' + fmt(kc.RHmin, 0) + '%, wind ' + fmt(kc.u2, 1) + ' m/s, height ' + kc.h + ' m).',
      'Soil water: FAO-56 Chapter 8 balance from the last soaking (depletion zero), total available water 1000 (θFC − θWP) × root depth, readily available fraction p = ' + fmt(dec.p, 2) + ' (Table 22, adjusted for today\'s crop water use), rain below 0.2 ETo ignored.'];
    if (inp.crop === 'rice') why.push('Rice: this card gives the field\'s evaporative use only; percolation is not included. Use the rice card for the AWD decision.');
    const flags = e.fallbacks.map(f => CODES[{ humidity_from_tmin: 'eq48_tdew_eq_tmin', radiation_from_temperature: 'eq50_temperature_range', wind_default_2ms: 'table4_default_2ms', radiation_island_monthly: 'eq51_island' }[f]]).concat(e.flags.map(f => CODES[f]), kc.flags.map(f => CODES[f])).filter(Boolean);
    if (dec.stressBegun) flags.push('The readily available water was already used up on an earlier day; the crop has probably been under stress and today\'s water use is reduced accordingly (FAO-56 Ks).');
    const assumptions = ['Soil water holding taken as the midpoint of the FAO-56 Table 19 range for ' + t(T.soils[inp.soil]).en + ' (θFC ' + fmt(s.fc, 2) + ', θWP ' + fmt(s.wp, 2) + ').', 'Root depth ' + fmt(zrUse, 2) + ' m (FAO-56 Table 22 gives ' + c.zr[0] + ' to ' + c.zr[1] + ' m; the lower value is for scheduling).', 'No runoff and no capillary rise (water table assumed more than 1 m below the roots).', 'Stage coefficient: ' + t(T.stages[inp.stage]).en + (inp.stage === 'development' || inp.stage === 'late' ? ', taken at the middle of the stage' : '') + '.', 'Application efficiency ' + Math.round(eff * 100) + '% (FAO Training Manual 4, Table 8: surface 60, sprinkler 75, drip 90).'];
    const limits = LIMITS_ETO.concat(['Vegetable and corn stage lengths differ from FAO-56\'s regional examples; choose the stage from what you see in the field.']);
    show(out, result({ level, verdict: t(T.verdicts[dec.code], ph), lines, why, flags, assumptions, limits, sources: ['FAO56', 'FAO_TM4'] }));
  }
};

/* RICE AWD */
CARDS.rice = function (root) {
  const prev = recall('rice');
  const form = el('form', { class: 'card-form', onsubmit: e => { e.preventDefault(); run(); } });
  const method = selectInput('rmethod', { en: 'How you manage the water', fil: 'Paraan ng pamamahala ng tubig' }, [
    ['continuous', { en: 'Continuous flooding: the field is kept flooded', fil: 'Laging nakababad ang bukid' }],
    ['awd', { en: 'Safe AWD: you have a field water tube and read it', fil: 'Safe AWD: may tubo sa bukid at binabasa mo ito' }],
    ['intermittent', { en: 'You let the field dry, with no field water tube', fil: 'Hinahayaang matuyo ang bukid, walang tubo' }]
  ], prev.method || 'awd');
  const season = selectInput('season', { en: 'Season', fil: 'Panahon' }, [['dry', { en: 'Dry season (tag-araw)', fil: 'Tag-araw' }], ['wet', { en: 'Wet season (tag-ulan)', fil: 'Tag-ulan' }]], prev.season || 'dry');
  const est = dateInput('est', { en: 'Date transplanted or sown', fil: 'Petsa ng lipat-tanim o sabog-tanim' }, prev.est, { prefilled: true });
  const flower = dateInput('flower', { en: 'Expected flowering date (if known)', fil: 'Inaasahang petsa ng pamumulaklak (kung alam)' }, prev.flower, { optional: true });
  const harvest = dateInput('harvest', { en: 'Expected harvest date (if known)', fil: 'Inaasahang petsa ng ani (kung alam)' }, prev.harvest, { optional: true });
  const soil = selectInput('rsoil', T.ui.soil, [['light', { en: 'Sandy or light', fil: 'Mabuhangin o magaan' }], ['clay', { en: 'Clay or heavy', fil: 'Luwad o mabigat' }]], prev.soil || 'clay');
  const tube = numInput('tube', { en: 'Water level in the field tube, cm below the soil surface (0 if the field is flooded)', fil: 'Lalim ng tubig sa tubo, cm mula sa ibabaw ng lupa (0 kung may tubig sa bukid)' }, prev.tube, 1);
  const pond = numInput('pond', { en: 'Water depth above the soil, cm (if flooded)', fil: 'Lalim ng tubig sa ibabaw ng lupa, cm (kung may tubig)' }, prev.pond, 1);
  const drop = numInput('drop', { en: 'How fast the water level drops, cm per day (if you have watched it)', fil: 'Gaano kabilis bumaba ang tubig, cm kada araw (kung napansin mo)' }, prev.drop, 0.5, { optional: true });
  const weeds = checkInput('weeds', { en: 'Weeds are under control', fil: 'Kontrolado na ang damo' }, prev.weeds !== false);
  form.append(method.row, season.row, est.row, flower.row, harvest.row, soil.row, tube.row, pond.row, drop.row, weeds.row, el('button', { type: 'submit', class: 'btn primary' }, bi(T.ui.compute)));
  /* The tube reading only means anything under safe AWD; the drop rate is read from the tube too. */
  const syncMethod = () => { const awd = method.input.value === 'awd'; tube.row.hidden = !awd; drop.row.hidden = !awd; };
  method.input.addEventListener('change', syncMethod); syncMethod();
  const out = el('div'); root.append(form, out);
  function run() {
    const inp = { method: method.input.value, season: season.input.value, est: est.input.value, flower: flower.input.value, harvest: harvest.input.value, soil: soil.input.value, tube: num(tube.input), pond: num(pond.input), drop: num(drop.input), weeds: weeds.input.checked };
    remember('rice', inp); out.innerHTML = '';
    const now = new Date(); const dd = s => s ? Math.round((new Date(s + 'T00:00:00') - now) / 86400000) : null;
    const r = A.riceWaterDecision({ method: inp.method, daysAfterEstablish: inp.est ? -dd(inp.est) : null, daysToFlowering: dd(inp.flower), daysToHarvest: dd(inp.harvest), season: inp.season, tubeBelowSurfaceCm: inp.tube, pondedCm: inp.pond, weedsManaged: inp.weeds, soil: inp.soil, pondDropCmPerDay: inp.drop });
    const level = { reflood_now: 'stop', flowering_top_up_to_5cm: 'stop', cf_flowering_top_up: 'stop', cf_top_up: 'stop', cf_too_deep: 'caution', drain_stop_irrigating: 'caution', cf_drain_now: 'caution', need_tube_reading: 'info', cf_need_depth: 'info', intermittent_no_threshold: 'info', before_awd_keep_shallow: 'caution' }[r.code] || 'go';
    const lines = [];
    if (r.triggerCm) lines.push([bi({ en: 'Re-flood trigger this season', fil: 'Hudyat ng pagpapatubig ngayong panahon' }), r.triggerCm + ' cm below the soil surface, then flood to about 5 cm']);
    if (r.code === 'not_yet') lines.push([bi({ en: 'Still to go', fil: 'Natitira pa' }), fmt(r.remainingCm, 0) + ' cm' + (r.daysLeft != null ? ', about ' + fmt(r.daysLeft, 0) + ' days at your drop rate' : '')]);
    if (r.drainDays) lines.push([bi({ en: 'Drain', fil: 'Patuyuin' }), r.drainDays + ' days before harvest for this soil']);
    const whyByMethod = {
      continuous: ['Continuous flooding, as the IRRI Rice Knowledge Bank describes it: "After transplanting, water levels should be around 3 cm initially" and "gradually increase to 5-10 cm (with increasing plant height) and remain there until the field is drained". Keep 5 cm "at all times from heading to the end of flowering", and drain "7-10 days before harvest".'],
      intermittent: ['Safe AWD is defined by the field water tube. IRRI\'s fact sheet sets the re-flood depth by what the tube shows, and gives no depth for a field without one, so this app reports none rather than estimating one. Drying an unmonitored field risks taking the water table below the roots without the farmer seeing it.', 'What still holds whatever you do: keep the field flooded to 5 cm from one week before to one week after flowering, drain before harvest, and postpone drying for 2 to 3 weeks while weeds are uncontrolled (IRRI).']
    }[inp.method];
    const why = whyByMethod || ['Safe AWD: re-flood when the field tube shows the trigger depth; 15 cm in the dry season and 20 cm in the wet season (DA Administrative Order 25-09; PhilRice observation well); IRRI uses 15 cm all season.', 'Keep 5 cm of water from one week before to one week after flowering (IRRI, Bouman et al. 2007, PhilRice).', 'Start AWD 21 to 30 days after transplanting or sowing, once weeds are managed (PhilRice; DA AO 25-09: 20 to 30 days).', 'Stop irrigating one week before harvest on light soils and two weeks on clay (PhilRice PalayCheck).'];
    const flags = (r.flags || []).filter(f => f !== 'no_tube_no_published_threshold').map(f => CODES[f]).filter(Boolean);   // the Why text already carries this one in full
    const limits = ['Safe AWD assumes heavy soils with a shallow water table; on loamy and sandy soils with deep water tables, IRRI reports water savings above 50% but yield losses above 20% (Bouman et al. 2007).', 'No percolation rate is assumed; the "days left" line appears only when you enter your own observed drop rate.'];
    if (r.targetCm && Array.isArray(r.targetCm)) lines.push([bi({ en: 'Target depth now', fil: 'Dapat na lalim ngayon' }), r.targetCm[0] === r.targetCm[1] ? r.targetCm[0] + ' cm' : r.targetCm[0] + ' to ' + r.targetCm[1] + ' cm']);
    if (r.tube) {
      lines.push([bi({ en: 'How to make a field water tube', fil: 'Paano gumawa ng tubo sa bukid' }),
        r.tube.lengthCm + ' cm of plastic pipe or bamboo, ' + r.tube.diameterCm[0] + ' to ' + r.tube.diameterCm[1] + ' cm across, hammered in so ' + r.tube.aboveSoilCm + ' cm stands above the soil (IRRI)']);
    }
    show(out, result({ level, verdict: t(T.verdicts[r.code], { trig: r.triggerCm, lo: r.targetCm && r.targetCm[0], hi: r.targetCm && r.targetCm[1] }), lines, why, flags, assumptions: ['The field tube is 25 to 30 cm long, perforated, buried with 15 cm below the soil (IRRI), at a representative spot.'], limits, sources: r.sources }));
  }
};

/* RAIN */
CARDS.rain = function (root) {
  const prev = recall('rain');
  const form = el('form', { class: 'card-form', onsubmit: e => { e.preventDefault(); run(); } });
  const P = numInput('P', { en: 'Rain this month (mm)', fil: 'Ulan ngayong buwan (mm)' }, prev.P, 1);
  const area = numInput('rArea', { en: 'Your field (hectares). It changes only the litres, never the millimetres.', fil: 'Lawak ng bukid (ektarya). Ang litro lang ang binabago nito, hindi ang milimetro.' }, prev.area, 0.01, { optional: true });
  form.append(P.row, area.row, el('button', { type: 'submit', class: 'btn primary' }, bi(T.ui.compute)));
  const out = el('div'); root.append(form, out);
  function run() {
    const inp = { P: num(P.input), area: num(area.input) }; remember('rain', inp); out.innerHTML = '';
    if (inp.P == null) return;
    if (inp.area != null && inp.area <= 0) { show(out, result({ level: 'info', verdict: { en: 'Field area must be greater than zero.', fil: 'Dapat mas malaki sa sero ang lawak ng bukid.' } })); return; }
    const pe = A.effectiveRainMonthly(inp.P);
    /* Millimetres mean nothing to most farmers until they are shown as a depth of standing water and as
       a volume per hectare. Both are exact conversions, not estimates: 1 mm is 1 litre per square metre. */
    const ha = inp.area != null ? inp.area : 1;
    const cm = v => fmt(v / 10, 1), m3 = v => fmt(A.mmToM3PerHa(v) * ha, 0);
    /* Litres read badly past a million as "5000 thousand"; switch unit rather than pile on zeroes. */
    const lit = (v, word) => { const L = A.mmToM3PerHa(v) * ha * 1000; return L >= 1e6 ? fmt(L / 1e6, 2) + (word === 'en' ? ' million litres' : ' milyong litro') : fmt(L / 1e3, 0) + (word === 'en' ? ' thousand litres' : ' libong litro'); };
    const onArea = { en: inp.area != null ? 'on your ' + fmt(ha, 2) + ' ha' : 'on one hectare', fil: inp.area != null ? 'sa ' + fmt(ha, 2) + ' ektarya ninyo' : 'sa isang ektarya' };
    show(out, result({ level: 'info', verdict: { en: 'Of ' + fmt(inp.P, 0) + ' mm, about ' + fmt(pe, 0) + ' mm counts for the crop this month.', fil: 'Sa ' + fmt(inp.P, 0) + ' mm, mga ' + fmt(pe, 0) + ' mm ang napakinabangan ng pananim ngayong buwan.' },
      lines: [[bi({ en: 'The ' + fmt(pe, 0) + ' mm that counts, as water', fil: 'Ang ' + fmt(pe, 0) + ' mm na napakinabangan, bilang tubig' }), bi({ en: cm(pe) + ' cm deep, the same depth on a field of any size: ' + m3(pe) + ' m\u00b3 (' + lit(pe, 'en') + ') ' + onArea.en + '.', fil: cm(pe) + ' cm ang lalim, pareho sa bukid na anumang laki: ' + m3(pe) + ' m\u00b3 (' + lit(pe, 'fil') + ') ' + onArea.fil + '.' }), 'key'],
              [bi({ en: 'Lost to runoff and deep drainage', fil: 'Nawala sa pag-agos at pagsipsip pailalim' }), fmt(inp.P - pe, 0) + ' mm'],
              [bi({ en: 'All ' + fmt(inp.P, 0) + ' mm, as water', fil: 'Lahat ng ' + fmt(inp.P, 0) + ' mm, bilang tubig' }), bi({ en: cm(inp.P) + ' cm deep standing on the field, if none ran off or soaked away: ' + m3(inp.P) + ' m\u00b3 (' + lit(inp.P, 'en') + ') ' + onArea.en + '.', fil: cm(inp.P) + ' cm ang lalim ng tubig sa bukid, kung walang umagos o sumipsip pailalim: ' + m3(inp.P) + ' m\u00b3 (' + lit(inp.P, 'fil') + ') ' + onArea.fil + '.' }), 'minor'],
              [bi({ en: 'What a millimetre is', fil: 'Ano ang isang milimetro' }), bi({ en: '1 mm of rain is 1 litre on every square metre. The depth is the same whatever the size of your field; only the volume changes.', fil: 'Ang 1 mm na ulan ay 1 litro sa bawat metro kuwadrado. Pareho ang lalim gaano man kalaki ang bukid ninyo; ang dami lang ang nagbabago.' }), 'minor']],
      why: ['FAO Training Manual 3: Pe = 0.8 P − 25 for P above 75 mm/month, Pe = 0.6 P − 10 below, never negative.'],
      limits: ['A monthly planning number for rain spread over the month on slopes up to 4 to 5% (FAO). Not for a single storm: 400 mm in three days is mostly runoff although the formula still returns 295 mm.', 'For today\'s watering decision the water card takes your gauge rainfall directly (FAO-56 water balance).'],
      sources: ['FAO_TM3'] }));
  }
};

/* SPRAY */
CARDS.spray = function (root) {
  const prev = recall('spray');
  const form = el('form', { class: 'card-form', onsubmit: e => { e.preventDefault(); run(); } });
  form.appendChild(locationBlock());
  const Tn = numInput('sT', { en: 'Air temperature now (°C)', fil: 'Temperatura ng hangin ngayon (°C)' }, prev.T, 0.1);
  const RH = numInput('sRH', { en: 'Humidity now (%)', fil: 'Halumigmig ngayon (%)' }, prev.RH, 1);
  const bft = [['', { en: 'Choose from what you see', fil: 'Piliin mula sa nakikita' }], ['0.5', { en: 'Calm: smoke rises straight (under 1 km/h)', fil: 'Walang hangin: tuwid ang usok' }], ['4', { en: 'Smoke drifts, leaves still (2 to 5 km/h)', fil: 'Gumagalaw ang usok, tahimik ang dahon' }], ['9', { en: 'Leaves rustle, wind felt on face (7 to 11 km/h)', fil: 'Kumakaluskos ang dahon, ramdam sa mukha' }], ['16', { en: 'Leaves and twigs move all the time (13 to 19 km/h)', fil: 'Laging gumagalaw ang dahon at sanga' }], ['25', { en: 'Dust rises, small branches move (20 to 30 km/h)', fil: 'Tumataas ang alikabok, gumagalaw ang sanga' }]];
  const wsel = selectInput('sW', { en: 'Wind now', fil: 'Hangin ngayon' }, bft, prev.wsel || '');
  const wkmh = numInput('sWk', { en: 'or wind in km/h at 2 m', fil: 'o hangin sa km/h sa 2 m' }, prev.wkmh, 1, { optional: true });
  const label = numInput('sLbl', { en: 'Wind limit printed on the label, if any (km/h)', fil: 'Limitasyon ng hangin sa label, kung meron (km/h)' }, prev.label, 1, { optional: true });
  const mist = checkInput('sMist', { en: 'Mist, fog, dew or frost present', fil: 'May ambon, ulap sa lupa, hamog o andap' }, prev.mist);
  const smoke = checkInput('sSmoke', { en: 'Smoke or dust hangs and moves sideways near the ground', fil: 'Nakabitin ang usok o alikabok at pahalang ang galaw' }, prev.smoke);
  const timeRow = numInput('sHour', { en: 'Time now (24 h clock, e.g. 15.5 for 3:30 pm)', fil: 'Oras ngayon (24 oras, hal. 15.5 para sa 3:30 ng hapon)' }, fieldHourNow().toFixed(1), 0.1, { prefilled: true });
  form.append(Tn.row, RH.row, wsel.row, wkmh.row, label.row, mist.row, smoke.row, timeRow.row, el('button', { type: 'submit', class: 'btn primary' }, bi(T.ui.compute)));
  const out = el('div'); root.append(form, out);
  function run() {
    const inp = { T: num(Tn.input), RH: num(RH.input), wsel: wsel.input.value, wkmh: num(wkmh.input), label: num(label.input), mist: mist.input.checked, smoke: smoke.input.checked, hour: num(timeRow.input) };
    remember('spray', inp); out.innerHTML = '';
    if (inp.T == null || inp.RH == null) return;
    if (badRH(inp.RH)) { show(out, result({ level: 'info', verdict: t(T.verdicts.bad_rh) })); return; }
    const L = store.loc, J = todayJ(fieldNow()), st = A.sunTimes(L.lat, L.lon, J, fieldTz());
    const wind = inp.wkmh != null ? inp.wkmh : (inp.wsel ? parseFloat(inp.wsel) : null);
    const hoursToSunset = st.sunset - inp.hour, hoursAfterSunrise = inp.hour - st.sunrise;
    const r = A.sprayWindow({ T: inp.T, RH: inp.RH, P: A.pressure(L.elev), windKmh: wind, hoursToSunset: hoursToSunset, hoursAfterSunrise: hoursAfterSunrise, isNight: inp.hour < st.sunrise || inp.hour > st.sunset, mistFogDew: inp.mist, smokeHanging: inp.smoke, labelMaxWindKmh: inp.label });
    const level = { good: 'go', caution: 'caution', do_not_spray: 'stop', need_wind: 'info' }[r.code];
    const hhmm = h => { const x = ((h % 24) + 24) % 24; return String(Math.floor(x)).padStart(2, '0') + ':' + String(Math.round((x % 1) * 60)).padStart(2, '0'); };
    const lines = [[bi({ en: 'Delta T (dry bulb minus wet bulb)', fil: 'Delta T' }), fmt(r.deltaT, 1) + ' °C (wet bulb ' + fmt(r.wetBulb, 1) + ' °C); good range 2 to 8'], [bi({ en: 'Wind', fil: 'Hangin' }), wind == null ? 'not entered' : fmt(wind, 0) + ' km/h; good range 3 to 15'], [bi({ en: 'Sunrise and sunset here today', fil: 'Sikat at lubog ng araw dito ngayon' }), hhmm(st.sunrise) + ' and ' + hhmm(st.sunset) + '; avoid from ' + hhmm(st.sunset - 2) + ' to ' + hhmm(st.sunrise + 2)]];
    const why = r.reasons.map(c => CODES[c]).filter(Boolean);
    if (!why.length) why.push('Delta T 2 to 8, wind 3 to 15 km/h, outside the inversion window, no inversion signs, air at or below 30 °C (GRDC, BOM, Agriculture Victoria, APVMA label).');
    why.push('Rainfastness is product-specific: check the label. BASF Philippine labels say do not spray within 24 h of heavy rain and do not apply when windy.');
    show(out, result({ level, verdict: t(T.verdicts[r.code]), lines, why, assumptions: ['Sunrise and sunset from FAO-56 Eq. 25 and 31 to 33, in this device\'s time zone.', 'Wet bulb from FAO-56 Eq. 15 and 16 (ventilated psychrometer constant) at your elevation.'],
      limits: ['Thresholds come from Australian grain-industry guidance for boom spraying; they describe the weather, not knapsack equipment.', 'Wind is at 2 m over the field; a 10 m station wind can be twice the field wind (GRDC).'], sources: r.sources }));
  }
};

/* DRYING */
CARDS.dry = function (root) {
  const prev = recall('dry');
  const form = el('form', { class: 'card-form', onsubmit: e => { e.preventDefault(); run(); } });
  const Tn = numInput('dT', { en: 'Air temperature at the drying area (°C)', fil: 'Temperatura sa bilaran (°C)' }, prev.T, 0.1);
  const RH = numInput('dRH', { en: 'Humidity (%)', fil: 'Halumigmig (%)' }, prev.RH, 1);
  const w = numInput('dW', { en: 'Wet palay weight (kg), or leave blank', fil: 'Bigat ng basang palay (kg), o iwanang blangko' }, prev.w, 1, { optional: true });
  const cav = numInput('dCav', { en: 'or number of cavans', fil: 'o bilang ng kaban' }, prev.cav, 1, { optional: true });
  const cavkg = numInput('dCavKg', { en: 'kg per cavan', fil: 'kg kada kaban' }, prev.cavkg == null ? A.CAVAN_KG : prev.cavkg, 1, { prefilled: true });
  const mc = numInput('dMC', { en: 'Moisture of the wet palay (%), if known; harvest is usually 20 to 25', fil: 'Halumigmig ng basang palay (%), kung alam; karaniwang 20 hanggang 25 sa ani' }, prev.mc == null ? 24 : prev.mc, 0.5, { optional: true });
  const storage = selectInput('dSt', { en: 'Plan for the grain', fil: 'Plano sa butil' }, [['weeks_to_months', { en: 'Sell or store a few months (14%)', fil: 'Ibenta o itago ng ilang buwan (14%)' }], ['months_8_12', { en: 'Store 8 to 12 months (13%)', fil: 'Itago ng 8 hanggang 12 buwan (13%)' }], ['seed', { en: 'Keep as seed (12%)', fil: 'Gawing binhi (12%)' }]], prev.storage || 'weeks_to_months');
  form.append(Tn.row, RH.row, w.row, cav.row, cavkg.row, mc.row, storage.row, el('button', { type: 'submit', class: 'btn primary' }, bi(T.ui.compute)));
  const out = el('div'); root.append(form, out);
  function run() {
    const inp = { T: num(Tn.input), RH: num(RH.input), w: num(w.input), cav: num(cav.input), cavkg: num(cavkg.input) || A.CAVAN_KG, mc: num(mc.input), storage: storage.input.value };
    remember('dry', inp); out.innerHTML = '';
    if (inp.T == null || inp.RH == null) return;
    if (badRH(inp.RH)) { show(out, result({ level: 'info', verdict: t(T.verdicts.bad_rh) })); return; }
    const weight = inp.w != null ? inp.w : (inp.cav != null ? inp.cav * inp.cavkg : null);
    const r = A.dryingDecision({ T: inp.T, RH: inp.RH, weightKg: weight, mc: inp.mc, cavanKg: inp.cavkg, storage: inp.storage });
    const lines = [[bi({ en: 'Lowest moisture reachable with this air', fil: 'Pinakamababang halumigmig na maaabot sa hanging ito' }), fmt(r.emcWb, 1) + '% (target ' + r.storageTarget + '%)'], [bi({ en: 'Humidity needed to reach 14% at this temperature', fil: 'Halumigmig na kailangan para umabot sa 14%' }), 'below ' + fmt(r.rhFor14, 0) + '%']];
    if (r.weightAt14 != null) lines.push([bi({ en: 'Weight after drying to 14%', fil: 'Bigat pagkatapos matuyo sa 14%' }), fmt(r.weightAt14, 0) + ' kg = ' + fmt(r.cavansAt14, 1) + ' cavans of ' + inp.cavkg + ' kg (from ' + fmt(weight, 0) + ' kg at ' + inp.mc + '%)']);
    lines.push([bi({ en: 'Sun-drying practice (IRRI)', fil: 'Tamang pagbibilad (IRRI)' }), 'Layer 2 to 4 cm; stir every 30 minutes; cover when the grain is hotter than 50 °C (42 °C for seed); cover at rain and at night.']);
    const why = ['Equilibrium moisture by the Modified Henderson equation with the ASABE D245.6 long-grain rough rice constants, checked against the University of Arkansas EMC table.', 'Weight after drying by mass balance: W2 = W1 (100 − M1)/(100 − M2) (IRRI).', 'Storage targets: 14% for weeks to months, 13% for 8 to 12 months, 12% for seed (IRRI Rice Knowledge Bank; PhilRice PalayCheck 12 to 14%).'];
    const flags = r.flags.map(f => CODES[f]).filter(Boolean);
    const limits = ['The reachable moisture is computed from the air, so the reading must be shaded air temperature and humidity, not a thermometer sitting in the sun. Grain lying in the sun is warmer than that air and can dry lower, which is why "not assured" means the air alone is too humid, not that drying is impossible.', 'IRRI\'s own EMC table runs about one percentage point lower than the ASABE constants used here; the standard itself was not accessible for this version.', 'Cavan mass defaults to 50 kg (PhilRice); change it if your sacks differ.'];
    show(out, result({ level: { can_reach_target: 'go', already_dry_enough: 'go', moisture_out_of_range: 'info' }[r.code] || 'caution', verdict: t(T.verdicts[r.code], { x: fmt(r.emcWb, 1) }), lines, why, flags, limits, sources: r.sources }));
  }
};

/* STRESS */
CARDS.stress = function (root) {
  const prev = recall('stress');
  const form = el('form', { class: 'card-form', onsubmit: e => { e.preventDefault(); run(); } });
  const crops = Object.keys(A.STRESS).map(k => [k, T.crops[k] || { en: k, fil: k }]);
  const crop = selectInput('xCrop', T.ui.crop, crops, prev.crop || 'rice');
  const phaseRow = el('label', { class: 'row' }, bi({ en: 'Stage', fil: 'Yugto' })); const phase = el('select', { id: 'xPhase' }); phaseRow.appendChild(phase);
  const PH = { germination: { en: 'Germination', fil: 'Pagsibol' }, seedling: { en: 'Seedling emergence', fil: 'Pagsulpot ng punla' }, rooting: { en: 'Rooting', fil: 'Pag-uugat' }, tillering: { en: 'Tillering', fil: 'Pagsusuwi' }, panicle_initiation: { en: 'Panicle initiation', fil: 'Pagbubuo ng uhay' }, panicle_differentiation: { en: 'Panicle differentiation (booting)', fil: 'Pagbubuntis' }, anthesis: { en: 'Flowering (anthesis)', fil: 'Pamumulaklak' }, ripening: { en: 'Ripening', fil: 'Paghihinog' }, vegetative: { en: 'Vegetative growth', fil: 'Paglaki ng dahon' }, flowering: { en: 'Flowering and pollination', fil: 'Pamumulaklak at polinasyon' }, grain_fill: { en: 'Grain filling', fil: 'Pagbubuo ng butil' }, cob_fill: { en: 'Cob fill', fil: 'Pagbubuo ng butil' }, head_formation: { en: 'Head formation', fil: 'Pagbubuo ng ulo' }, establishment: { en: 'Establishment and vegetative', fil: 'Pagtatatag at paglaki' }, tuber_initiation: { en: 'Tuber initiation', fil: 'Pagsisimula ng tubo' }, tuber_growth: { en: 'Tuber growth', fil: 'Paglaki ng tubo' }, maturation: { en: 'Maturation', fil: 'Paggulang' }, early_vegetative: { en: 'Early vegetative', fil: 'Maagang paglaki' }, fruit_growth: { en: 'Fruit growth', fil: 'Paglaki ng bunga' }, juvenile: { en: 'Juvenile', fil: 'Batang halaman' }, fruit: { en: 'Fruit development', fil: 'Pagbubunga' }, hearting: { en: 'Hearting', fil: 'Pagbubuo ng ulo' }, root_development: { en: 'Root development', fil: 'Paglaki ng ugat' }, curd_induction: { en: 'Curd induction', fil: 'Pagsisimula ng bulaklak' }, curd_growth: { en: 'Curd growth', fil: 'Paglaki ng bulaklak' }, head_growth: { en: 'Head growth', fil: 'Paglaki ng ulo' } };
  function fillPhases() { phase.innerHTML = ''; Object.keys(A.STRESS[crop.input.value].phases).forEach(p => { const s = PH[p] || { en: p, fil: p }; phase.appendChild(el('option', { value: p }, s.en + ' / ' + s.fil)); }); if (prev.phase && A.STRESS[crop.input.value].phases[prev.phase]) phase.value = prev.phase; }
  crop.input.addEventListener('change', fillPhases); fillPhases();
  const d0x = numInput('x0x', { en: 'Today\'s high (°C)', fil: 'Pinakamainit ngayon (°C)' }, prev.d0x, 0.1), d0n = numInput('x0n', { en: 'Today\'s low (°C)', fil: 'Pinakamalamig ngayon (°C)' }, prev.d0n, 0.1);
  const d1x = numInput('x1x', { en: 'Yesterday\'s high, if known', fil: 'Pinakamainit kahapon, kung alam' }, prev.d1x, 0.1, { optional: true }), d1n = numInput('x1n', { en: 'Yesterday\'s low', fil: 'Pinakamalamig kahapon' }, prev.d1n, 0.1, { optional: true });
  const d2x = numInput('x2x', { en: 'Day before, high', fil: 'Noong isang araw, pinakamainit' }, prev.d2x, 0.1, { optional: true }), d2n = numInput('x2n', { en: 'Day before, low', fil: 'Noong isang araw, pinakamalamig' }, prev.d2n, 0.1, { optional: true });
  const g = el('div', { class: 'grid2' }); g.append(d0x.row, d0n.row, d1x.row, d1n.row, d2x.row, d2n.row);
  form.append(crop.row, phaseRow, g, el('button', { type: 'submit', class: 'btn primary' }, bi(T.ui.compute)));
  const out = el('div'); root.append(form, out);
  function run() {
    const inp = { crop: crop.input.value, phase: phase.value, d0x: num(d0x.input), d0n: num(d0n.input), d1x: num(d1x.input), d1n: num(d1n.input), d2x: num(d2x.input), d2n: num(d2n.input) };
    remember('stress', inp); out.innerHTML = '';
    if (inp.d0x == null || inp.d0n == null) return;
    /* A swapped high and low silently produces a nonsense verdict, so refuse it as the water card does. */
    const swapped = [[inp.d0x, inp.d0n], [inp.d1x, inp.d1n], [inp.d2x, inp.d2n]].some(([x, n]) => x != null && n != null && x < n);
    if (swapped) { show(out, result({ level: 'info', verdict: t(T.verdicts.bad_minmax) })); return; }
    const days = [];
    if (inp.d2x != null && inp.d2n != null) days.push({ Tmax: inp.d2x, Tmin: inp.d2n });
    if (inp.d1x != null && inp.d1n != null) days.push({ Tmax: inp.d1x, Tmin: inp.d1n });
    days.push({ Tmax: inp.d0x, Tmin: inp.d0n });
    const r = A.stressCheck(inp.crop, inp.phase, days);
    const today = r.perDay[r.perDay.length - 1];
    const code = today.includes('heat_above_threshold') ? 'heat_above_threshold' : (today.includes('cold_at_or_below_threshold') ? 'cold_at_or_below_threshold' : (today.includes('heat_watch') ? 'heat_watch' : 'within'));
    const level = { heat_above_threshold: 'stop', cold_at_or_below_threshold: 'stop', heat_watch: 'caution', within: 'go' }[code];
    const th = r.thresholds;
    const lines = [[bi({ en: 'Published thresholds for this stage', fil: 'Nailathalang hangganan para sa yugtong ito' }), (th.lo != null ? 'cold at or below ' + th.lo + ' °C; ' : '') + (th.hi != null ? 'heat at or above ' + th.hi + ' °C' : 'no heat threshold published') + (th.watch != null ? '; watch from ' + th.watch + ' °C' : '')], [bi({ en: 'Today', fil: 'Ngayon' }), inp.d0x + ' / ' + inp.d0n + ' °C']];
    if (days.length >= 3) lines.push([bi({ en: 'Three consecutive days above threshold', fil: 'Tatlong sunod na araw na lampas sa hangganan' }), r.threeConsecutiveHeat ? 'yes' : 'no']);
    const why = { rice: ['Rice thresholds: Yoshida (1981), Fundamentals of Rice Crop Science, Table 2.4, critical low and high temperatures by growth stage; where Yoshida gives a range, the lower value is the cold line. An FAO reproduction of this table differs at two stages (germination low, panicle differentiation high) and is not used. Sterility above 35 °C at anthesis for more than an hour (Yoshida 1981, section 2.3.6; Satake and Yoshida 1978); one hour at 33.7 °C spikelet temperature already causes sterility (Jagadish et al. 2007), hence the watch line at 33 °C.'], maize: ['Maize: pollen viability falls above 35 °C and kernel growth is reduced from 30 to 35 °C (Hatfield et al. 2011; Hatfield and Prueger 2015); Queensland DAF sweet corn thresholds 33 °C at flowering.'], sweetcorn: ['Queensland DAF sweet corn thresholds; Hatfield et al. 2011 for pollen viability.'] }[inp.crop] || ['Queensland Department of Agriculture and Fisheries critical temperature thresholds (literature review, 2023-2024); the series calls its values "a good guide, but by no means definitive due to slight varietal variation".'];
    const limits = ['Yoshida\'s rice thresholds are daily mean temperatures (germination excepted); this card compares them with the afternoon high and the morning low, so it flags stress earlier than a daily-mean test would. The anthesis heat line is the exception: it rests on afternoon temperatures at flowering (Satake and Yoshida 1978; Jagadish et al. 2007).', 'Thresholds are air temperatures; plant tissue can be warmer under water stress or cooler when well watered (Hatfield et al. 2011).', 'Duration matters: many studies used exposure of one hour to several days; a single afternoon reading is an indicator, not a damage estimate.', 'No yield loss is predicted.'];
    show(out, result({ level, verdict: t(T.verdicts[code]), lines, why, limits, sources: r.sources }));
  }
};

/* FROST */
CARDS.frost = function (root) {
  const prev = recall('frost');
  const form = el('form', { class: 'card-form', onsubmit: e => { e.preventDefault(); run(); } });
  form.appendChild(locationBlock());
  const Tn = numInput('fT', { en: 'Air temperature at the time you read it (°C)', fil: 'Temperatura sa oras ng pagbasa (°C)' }, prev.T, 0.1);
  const RH = numInput('fRH', { en: 'Humidity at the same time (%)', fil: 'Halumigmig sa parehong oras (%)' }, prev.RH, 1);
  const sky = selectInput('fSky', { en: 'Sky', fil: 'Langit' }, [['clear', { en: 'Clear, stars visible', fil: 'Maaliwalas, kita ang bituin' }], ['partly', { en: 'Partly cloudy', fil: 'Bahagyang maulap' }], ['overcast', { en: 'Overcast or foggy', fil: 'Maulap o maambon' }]], prev.sky || 'clear');
  const wind = selectInput('fWind', { en: 'Wind', fil: 'Hangin' }, [['calm', { en: 'Calm', fil: 'Walang hangin' }], ['light', { en: 'Light', fil: 'Mahina' }], ['breezy', { en: 'Breezy or windy', fil: 'Mahangin' }]], prev.wind || 'calm');
  const hollow = checkInput('fHollow', { en: 'Field is in a valley bottom or hollow where cold air collects', fil: 'Nasa lambak o kubkob na lugar ang bukid kung saan naiipon ang malamig na hangin' }, prev.hollow);
  form.append(Tn.row, RH.row, sky.row, wind.row, hollow.row, el('button', { type: 'submit', class: 'btn primary' }, bi(T.ui.compute)));
  const out = el('div'); root.append(form, out);
  function run() {
    const inp = { T: num(Tn.input), RH: num(RH.input), sky: sky.input.value, wind: wind.input.value, hollow: hollow.input.checked };
    remember('frost', inp); out.innerHTML = '';
    if (inp.T == null || inp.RH == null) return;
    if (badRH(inp.RH)) { show(out, result({ level: 'info', verdict: t(T.verdicts.bad_rh) })); return; }
    const r = A.frostIndicator(inp);
    const c = r.conditions;
    const season = A.frostSeason(new Date().getMonth() + 1);
    const L = store.loc, now0 = fieldNow();
    const st = A.sunTimes(L.lat, L.lon, todayJ(new Date(now0.getTime() + 86400000)), fieldTz());  // tomorrow's sunrise: the card is about tonight
    const stToday = A.sunTimes(L.lat, L.lon, todayJ(now0), fieldTz());                            // tonight's sunset
    const hhmm = h => { const x = ((h % 24) + 24) % 24; return String(Math.floor(x)).padStart(2, '0') + ':' + String(Math.round((x % 1) * 60)).padStart(2, '0'); };
    /* How far this reading sits from the coldest hour. The device clock supplies the reading time, so
       the farmer is not asked for it. No cooling rate is applied: this weighs the reading, it does not
       extrapolate it. */
    const nowH = fieldHourNow();   // compared against field-time sun times, so it must be field time too
    /* Refuse a daytime reading rather than judging tonight from air that is still warming. */
    if (!A.frostReadingUsable(nowH, stToday.sunset, st.sunrise)) {
      const opens = ((stToday.sunset - A.FROST.readingBeforeSunsetH) % 24 + 24) % 24;
      show(out, result({ level: 'info',
        verdict: { en: 'Too early in the day to judge tonight.', fil: 'Masyadong maaga pa upang hatulan kung magkaka-andap.' },
        lines: [[bi({ en: 'Read again after', fil: 'Magbasa uli pagkatapos ng' }), hhmm(opens) + ' (sunset ' + hhmm(stToday.sunset) + ')'],
                [bi({ en: 'Coldest hour tonight', fil: 'Pinakamalamig na oras ngayong gabi' }), 'about ' + hhmm(st.sunrise - 1) + ' to ' + hhmm(st.sunrise) + ' (sunrise ' + hhmm(st.sunrise) + ')']],
        why: ['Frost forms because the ground loses heat to a clear sky through the night. Until the air has begun to cool, a temperature and humidity reading carries no information about the night ahead: the air will warm further, reach its peak, and only then start falling.', 'The card therefore accepts readings from about two hours before sunset until sunrise, and refuses them at other times rather than returning a verdict it cannot support.'],
        limits: ['The time comes from this device\'s clock, and sun times are computed for this device\'s time zone.'],
        sources: ['FAO_FROST'] }));
      return;
    }
    const toMin = ((st.sunrise - nowH) % 24 + 24) % 24;      // hours from now until sunrise
    const weight = toMin > 10 ? 'early' : (toMin > 4.5 ? 'middle' : 'close');   // a Philippine night runs about 12 hours
    const weightText = {
      early: { en: 'This is an early reading, taken near dusk. Almost the whole night of cooling is still ahead, so treat this answer as provisional and read again before you sleep.', fil: 'Maagang pagbasa ito, malapit sa dapithapon. Halos buong gabi pa ang lalamig, kaya pansamantala muna ang sagot na ito; magbasa uli bago matulog.' },
      middle: { en: 'An evening reading. The air will keep cooling for several more hours, so a later reading will tell you more.', fil: 'Pagbasa sa gabi. Lalamig pa ang hangin nang ilang oras, kaya mas marami ang masasabi ng pagbasa mamaya.' },
      close: { en: 'Read close to the coldest hour, so this reading carries the most weight.', fil: 'Malapit na sa pinakamalamig na oras ang pagbasa, kaya ito ang pinakamabigat na batayan.' }
    }[weight];
    /* Cloud and wind hold frost off only while they last. Name whichever is doing it, so the farmer
       knows what would undo this answer, and only while the night still has hours to run. */
    const revoke = { sky: { en: 'the cloud cover', fil: 'ang takip ng ulap' }, wind: { en: 'the wind', fil: 'ang hangin' }, sky_and_wind: { en: 'the cloud cover and the wind', fil: 'ang takip ng ulap at ang hangin' } }[r.ruledOutBy];
    const revocable = revoke && toMin > 1.5;
    /* Name the month the verdict is based on, so the farmer can see which month the card thinks it is
       rather than trusting a bare classification. The classification is monthly, so no day is shown. */
    const mi = new Date().getMonth();
    const MON_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const MON_FIL = ['Enero', 'Pebrero', 'Marso', 'Abril', 'Mayo', 'Hunyo', 'Hulyo', 'Agosto', 'Setyembre', 'Oktubre', 'Nobyembre', 'Disyembre'];
    const mEn = MON_EN[mi], mFil = MON_FIL[mi];
    const seasonText = {
      peak: { en: mEn + '. The month with the most recorded frost in Benguet.', fil: mFil + '. Ang buwan na may pinakamaraming naitalang andap sa Benguet.' },
      core: { en: mEn + '. Within the months when frost is recorded in Benguet, December to February.', fil: mFil + '. Nasa loob ng mga buwan na may naitalang andap sa Benguet, Disyembre hanggang Pebrero.' },
      edge: { en: mEn + '. Edge of the Benguet frost season: November is the least frequent, March is reported by farmers.', fil: mFil + '. Gilid ng panahon ng andap sa Benguet: Nobyembre ang pinakabihira, Marso ay iniuulat ng mga magsasaka.' },
      outside: { en: mEn + '. Outside the months when frost has been recorded in Benguet, which run November to March.', fil: mFil + '. Wala sa mga buwan na may naitalang andap sa Benguet, na Nobyembre hanggang Marso.' }
    }[season];
    /* Frost has only ever been recorded in the Philippine highlands. Below that, or outside the country,
       the card still answers, because the reading is the farmer's, but it says the answer does not
       describe their place. No elevation threshold for frost is claimed: 900 m is simply the bottom of
       the range the records themselves come from (Marasigan 2017, citing Estoque 2012 for Baguio). */
    const benguetKm = A.haversineKm(L.lat, L.lon, A.BENGUET.lat, A.BENGUET.lon);
    const offPH = isFinite(L.lat) && isFinite(L.lon) && (L.lat < 4 || L.lat > 22 || L.lon < 116 || L.lon > 127);
    const lowland = isFinite(L.elev) && L.elev < A.BENGUET.recordLowM;
    const lines = [];
    if (offPH || lowland) lines.push([bi({ en: 'This place is not in the frost record', fil: 'Wala sa talaan ng andap ang lugar na ito' }),
      bi({ en: 'No frost has been recorded where you are. The Philippine frost record comes from the Benguet highlands, roughly ' + A.BENGUET.recordLowM + ' to ' + A.BENGUET.recordHighM + ' m, at ' + A.BENGUET.towns + '. Your location is ' + (isFinite(L.elev) ? 'at ' + fmt(L.elev, 0) + ' m and ' : '') + fmt(benguetKm, 0) + ' km away. The answer below is shown so you can see how the card works, not as a warning for your field.',
              fil: 'Walang naitalang andap sa kinaroroonan ninyo. Ang talaan ng andap sa Pilipinas ay mula sa kabundukan ng Benguet, mga ' + A.BENGUET.recordLowM + ' hanggang ' + A.BENGUET.recordHighM + ' m, sa ' + A.BENGUET.towns + '. Ang lokasyon ninyo ay ' + (isFinite(L.elev) ? 'nasa ' + fmt(L.elev, 0) + ' m at ' : '') + fmt(benguetKm, 0) + ' km ang layo. Ipinapakita ang sagot sa ibaba para makita kung paano gumagana ang card, hindi bilang babala para sa bukid ninyo.' }), 'alert']);
    if (revocable) lines.push([bi({ en: 'What is holding frost off', fil: 'Ano ang pumipigil sa andap' }), bi({ en: t(revoke).en + ', which can lift at any hour', fil: t(revoke).fil + ', na maaaring mawala anumang oras' })]);
    lines.push([bi({ en: 'You read this at', fil: 'Oras ng pagbasa' }), hhmm(nowH) + ', ' + fmt(toMin, 1) + ' hours before the coldest hour'],
      [bi({ en: 'Coldest hour tonight', fil: 'Pinakamalamig na oras ngayong gabi' }), 'about ' + hhmm(st.sunrise - 1) + ' to ' + hhmm(st.sunrise) + ' (sunrise ' + hhmm(st.sunrise) + ')'],
      [bi({ en: 'Your location', fil: 'Lokasyon ninyo' }), fmt(L.lat, 2) + ' \u00b0N, ' + fmt(L.lon, 2) + ' \u00b0E' + (isFinite(L.elev) ? ' at ' + fmt(L.elev, 0) + ' m' : '') + ', ' + fmt(benguetKm, 0) + ' km from ' + A.BENGUET.place],
      [bi({ en: 'Time of year', fil: 'Panahon ng taon' }), bi(seasonText)], [bi({ en: 'Dew point now', fil: 'Dew point ngayon' }), fmt(r.dewPoint, 1) + ' °C (line used: 2 °C)'], [bi({ en: 'Radiation-frost conditions present', fil: 'Mga kondisyon ng andap na naroroon' }), ['clear sky', 'calm or light wind', 'low dew point', 'at or below 10 °C'].filter((_, i) => [c.clear, c.calm, c.lowDewPoint, c.cold][i]).join(', ') || 'none']);
    const why = ['Radiation frosts "are characterized by a clear sky, calm or very little wind, temperature inversion, low dew-point temperatures" (FAO frost manual, Snyder and de Melo-Abreu 2005).', 'The air keeps losing heat to the sky all night, so the minimum comes just before sunrise, when the sun starts to put heat back (FAO frost manual). That is the hour to look at the crop.', 'When dew forms, the released latent heat "reduces the rate of temperature drop" (FAO), so a low dew point lets the surface keep cooling; a high dew point sets a brake near the dew point.', 'Benguet frost (andap) is radiative frost of the northeast monsoon season in Atok, Buguias, Kabayan, Kibungan and Mankayan: weak monsoon flow, cloudless nights, air above freezing while surfaces frost. Marasigan (2017) found 70% of satellite-detected occurrences at land-surface temperatures at or below 10 °C (57% at or below 9 °C), consistent with farmers\' reports of frost at or below 10 °C; Basquial et al. (2021) measured 1.5 to 3.9 °C air temperature on frost mornings.', 'Atok farmers name the same precursors: a very cold, still evening, thick dew and no wind after a long dry spell; wind at dawn prevents frost; frost settles on low ground; and 9 °C without frost against 13 °C with frost shows that temperature alone is not enough (Launio et al. 2020).'];
    const assumptions = ['The reading time comes from this device\'s clock, and sunrise and sunset are computed for the same time zone, so the two agree wherever you are. If the device clock or zone is wrong, the hours before the coldest hour are wrong with it.', 'Sunrise from FAO-56 Eq. 25 and 31 to 33, in this device\'s time zone, at the location saved above. The one-hour window before it is where the minimum usually falls, not a computed minimum: this card forecasts no temperature.', 'The 2 °C dew-point line is a design assumption of this app. FAO prints no threshold; its method is a regression whose coefficients must be fitted from local records, and none exist for Benguet. The line tests how dry the air is, not how cold it is: the dew point is always at or below the air temperature, so 2 °C is reached on an ordinary dry night with the air near 10 °C.', 'Readings taken outdoors, away from walls, at about head height. The card does not know what time you read the thermometer: the later in the evening, the more the reading tells you about the night ahead.', 'The 10 °C line comes from Marasigan (2017), where it is a land surface temperature measured by satellite (passes near 10:30 p.m. and 1:30 a.m., model output at 2 a.m.), not an air temperature. At night the surface runs colder than the air at head height, so holding your air reading to 10 °C is stricter than her finding requires. The reading is also taken hours before the night minimum, so a reading above 10 °C does not mean the night will stay above 10 °C. That is why a clear, calm night is never reported as unlikely here.'];
    const limits = ['The season note is Benguet only. This app holds no frost climatology for any other part of the Philippines, and the conditions themselves are general physics, not local to Benguet.', 'The answer depends on when you read the thermometer, and the card cannot tell. On one clear, calm night the same air can read 14 °C at 7 p.m. and 5 °C by 2 a.m. Cloud, wind and dew point barely change with the hour; air temperature does.', 'No minimum temperature is forecast: FAO\'s forecast method needs local regression coefficients that do not exist for Benguet.', 'Leaves cool below the air temperature on clear nights (FAO), so frost can occur with the thermometer above 0 °C.', 'Where PAGASA issues an official frost advisory for your area, prefer it over this indicator.'];
    if (revocable) why.push('This answer rests on ' + t(revoke).en + ', and that can change tonight. Cloud thins and wind drops without warning, and once the sky opens the ground begins losing heat to it straight away. With about ' + fmt(toMin, 1) + ' hours still to run before the coldest hour, look outside again before you sleep: if the stars come out and the air goes still, run this card again.');
    why.push('The 10 °C line is a marker, not a threshold. Marasigan (2017) found 70% of frost occurrences at or below it, which means three in ten happened above it, and her figure is a surface temperature, not a reading at head height. Frost can form at 13 °C on the thermometer if the air is dry, and fail to form at 9 °C if it is humid, which is what Atok farmers reported to Launio et al. (2020). That is why this card asks for humidity and not temperature alone.');
    why.push(t(weightText).en + ' / ' + t(weightText).fil);
    why.push(season === 'outside'
      ? 'Frost in Benguet is a northeast monsoon event. Marasigan (2017) records it in December, January and February, with January the most frequent and November the least; Launio et al. (2020) report December to February, now sometimes into March. Today falls outside those months, so check the readings before acting on this answer.'
      : 'Frost in Benguet is a northeast monsoon event. Marasigan (2017) found January the most frequent month at every temperature threshold, then February, with November the least; Launio et al. (2020) report December to February, now sometimes into March.');
    if (inp.hollow) why.push('Cold air pools in hollows and valley bottoms; local agriculturists note frost "in mountainous areas with low air circulation".');
    show(out, result({ level: { possible: 'stop', watch: 'caution', unlikely: 'go' }[r.code], verdict: t(T.verdicts[r.code]), lines, why, assumptions, limits, sources: r.sources }));
  }
};

/* DISEASE */
CARDS.disease = function (root) {
  const prev = recall('disease');
  const form = el('form', { class: 'card-form', onsubmit: e => { e.preventDefault(); run(); } });
  const Tn = numInput('zT', { en: 'Air temperature this evening (°C)', fil: 'Temperatura ngayong gabi (°C)' }, prev.T, 0.1);
  const RH = numInput('zRH', { en: 'Humidity this evening (%)', fil: 'Halumigmig ngayong gabi (%)' }, prev.RH, 1);
  const sky = selectInput('zSky', { en: 'Sky', fil: 'Langit' }, [['clear', { en: 'Clear', fil: 'Maaliwalas' }], ['partly', { en: 'Partly cloudy', fil: 'Bahagyang maulap' }], ['overcast', { en: 'Overcast', fil: 'Maulap' }]], prev.sky || 'clear');
  const wind = selectInput('zWind', { en: 'Wind', fil: 'Hangin' }, [['calm', { en: 'Calm', fil: 'Walang hangin' }], ['light', { en: 'Light', fil: 'Mahina' }], ['breezy', { en: 'Breezy', fil: 'Mahangin' }]], prev.wind || 'calm');
  const lwLo = numInput('zLWlo', { en: 'PAGASA leaf wetness, lower figure (hours)', fil: 'Leaf wetness ng PAGASA, mas mababang bilang (oras)' }, prev.lwLo, 0.5, { optional: true });
  const lwHi = numInput('zLWhi', { en: 'PAGASA leaf wetness, upper figure (hours)', fil: 'Leaf wetness ng PAGASA, mas mataas na bilang (oras)' }, prev.lwHi, 0.5, { optional: true });
  const lwNote = el('p', { class: 'hint' }, bi({
    en: 'From the Leaf Wetness column of the daily Farm Weather Forecast at bagong.pagasa.dost.gov.ph/agri-weather. It is published as a range for the whole forecast area, such as 0 to 4, so enter both figures. This app reports them back as given and does not convert or interpret them. Leave blank if you do not have them.',
    fil: 'Mula sa hanay na Leaf Wetness ng araw-araw na Farm Weather Forecast sa bagong.pagasa.dost.gov.ph/agri-weather. Saklaw ito para sa buong forecast area, tulad ng 0 hanggang 4, kaya ilagay ang dalawang bilang. Iniuulat lang ito ng app nang buo at hindi kinakalkula o binibigyang-kahulugan. Huwag punan kung wala kayo nito.'
  }));
  const h = el('h4', null, bi({ en: 'Potato late blight, only with a data logger', fil: 'Late blight ng patatas, kung may data logger lamang' }));
  const hNote = el('p', { class: 'hint' }, bi({
    en: 'The Hutton Criteria count hours at or above 90% humidity across a whole day and night, twice over. That needs an automatic weather station or a data logger; a hand-held hygrometer cannot do it, and this app will not guess the hours for you. Without one, what the criteria describe is two days running of cool nights, no colder than 10 °C, with long damp spells. Watch for that pattern and ask your DA or BPI technician.',
    fil: 'Binibilang ng Hutton Criteria ang mga oras na 90% pataas ang halumigmig sa buong araw at gabi, nang dalawang beses. Kailangan nito ng automatic weather station o data logger; hindi kaya ng hawak-kamay na hygrometer, at hindi huhulaan ng app na ito ang mga oras. Kung wala kayo nito, ang inilalarawan ng pamantayan ay dalawang magkasunod na araw ng malamig na gabi, hindi bababa sa 10 °C, na may mahabang panahong mahalumigmig. Bantayan ang ganitong pattern at magtanong sa inyong tekniko ng DA o BPI.'
  }));
  const hOn = checkInput('zLogger', { en: 'I have a data logger or weather station', fil: 'May data logger o weather station ako' }, prev.logger);
  const a1 = numInput('zA1', { en: 'Yesterday: lowest temperature (°C)', fil: 'Kahapon: pinakamababang temperatura (°C)' }, prev.a1, 0.1, { optional: true }), a2 = numInput('zA2', { en: 'Yesterday: hours at or above 90% humidity', fil: 'Kahapon: oras na 90% pataas ang halumigmig' }, prev.a2, 0.5, { optional: true });
  const b1 = numInput('zB1', { en: 'Day before: lowest temperature (°C)', fil: 'Noong isang araw: pinakamababang temperatura (°C)' }, prev.b1, 0.1, { optional: true }), b2 = numInput('zB2', { en: 'Day before: hours at or above 90% humidity', fil: 'Noong isang araw: oras na 90% pataas ang halumigmig' }, prev.b2, 0.5, { optional: true });
  form.append(Tn.row, RH.row, sky.row, wind.row, lwLo.row, lwHi.row, lwNote, h, hNote, hOn.row, a1.row, a2.row, b1.row, b2.row, el('button', { type: 'submit', class: 'btn primary' }, bi(T.ui.compute)));
  const syncLogger = () => { const on = hOn.input.checked; [a1, a2, b1, b2].forEach(x => { x.row.hidden = !on; }); };
  hOn.input.addEventListener('change', syncLogger); syncLogger();
  const out = el('div'); root.append(form, out);
  function run() {
    const inp = { T: num(Tn.input), RH: num(RH.input), sky: sky.input.value, wind: wind.input.value, lwLo: num(lwLo.input), lwHi: num(lwHi.input), logger: hOn.input.checked, a1: num(a1.input), a2: num(a2.input), b1: num(b1.input), b2: num(b2.input) };
    remember('disease', inp); out.innerHTML = '';
    if (badRH(inp.RH)) { show(out, result({ level: 'info', verdict: t(T.verdicts.bad_rh) })); return; }
    const L0 = store.loc, now0 = fieldNow();
    const stT = A.sunTimes(L0.lat, L0.lon, todayJ(now0), fieldTz()), stN = A.sunTimes(L0.lat, L0.lon, todayJ(new Date(now0.getTime() + 86400000)), fieldTz());
    const nowH0 = fieldHourNow();  // compared against field-time sun times, so it must be field time too
    const hhmm0 = h => { const x = ((h % 24) + 24) % 24; return String(Math.floor(x)).padStart(2, '0') + ':' + String(Math.round((x % 1) * 60)).padStart(2, '0'); };
    /* A forecast does not care what time the thermometer was read, so this is answered before the
       reading-time gate below, which returns early. */
    if (inp.lwLo != null || inp.lwHi != null) {
      const lwr = A.leafWetnessReport(inp.lwLo, inp.lwHi);
      show(out, result({ level: 'info', verdict: t(T.verdicts[lwr.code], { lo: fmt(inp.lwLo, 1), hi: fmt(inp.lwHi, 1), rlo: fmt(A.DEW_RICE_LB.nightLoH, 1), rhi: fmt(A.DEW_RICE_LB.nightHiH, 1) }),
        why: ['Leaf wetness hours count how much of the day free water sits on the leaf surface, from dew, rain or irrigation. It matters because fungi and bacteria need the leaf wet to germinate and get inside it, so the same weather that wets the crop for two hours and for twelve are not the same weather at all.',
          'This is PAGASA\'s own figure from the daily Farm Weather Forecast, reported back to you exactly as published. The app does not recompute it or convert it.',
          'The column is published as a range across a whole forecast area, in the same way the temperature and humidity columns beside it are. The low figure and the high figure describe different places inside that area, not the start and end of one night.',
          'The yardstick it is set against is the only measured dew duration from a Philippine rice field: Luo and Goudriaan (2000) watched the leaves every 15 minutes for 16 rain-free nights at IRRI Los Baños in the 1994 dry season and recorded 9.0 to 12.8 hours on heavy dew nights. That is what a clear, calm, dewing night on lowland paddy looks like, so it tells you whether the forecast spell is short or long. Cloud and wind cut dew short, which is why a cloudy night can forecast far fewer hours.'],
        limits: ['No disease risk is scored from these hours. Published infection thresholds in hours of leaf wetness exist for other crops and climates, and none is established for Philippine rice, so the card reports the length and stops there.',
          'A forecast covers an area, not your field. Where PAGASA and this card differ, follow PAGASA.',
          'Leaf wetness hours and hours at or above 90% humidity are different quantities. Do not put these numbers in the Hutton boxes below.',
          'The measured yardstick is lowland paddy rice at one site in one dry season, on clear rain-free nights.'],
        sources: ['PAGASA_FWFA', 'LUO2000'] }));
    }
    /* Dew is a night question, so a reading taken while the air is still warming says nothing about it. */
    if (inp.T != null && inp.RH != null && !A.frostReadingUsable(nowH0, stT.sunset, stN.sunrise)) {
      show(out, result({ level: 'info',
        verdict: { en: 'Too early in the day to judge tonight.', fil: 'Masyadong maaga pa sa araw upang hatulan ang gabi.' },
        lines: [[bi({ en: 'Read again after', fil: 'Magbasa uli pagkatapos ng' }), hhmm0(((stT.sunset - A.FROST.readingBeforeSunsetH) % 24 + 24) % 24) + ' (sunset ' + hhmm0(stT.sunset) + ')']],
        why: ['Dew forms as the surface cools through the night. Until the air has begun cooling, a reading carries no information about tonight: the air will warm further, peak, and only then start falling.'],
        sources: ['FAO56', 'FAO_FROST'] }));
      return;
    }
    if (inp.T != null && inp.RH != null) {
      const d = A.dewTonight(inp.T, inp.RH, inp.sky, inp.wind);
      show(out, result({ level: (d.code === 'dew_less_likely') ? 'go' : 'caution', verdict: t(T.verdicts[d.code], { td: fmt(d.dewPoint, 1), dep: fmt(d.depression, 1) }), lines: (function () {
          const ls = [
            [bi({ en: 'Read any time between', fil: 'Puwedeng magbasa mula' }), hhmm0(stT.sunset - A.FROST.readingBeforeSunsetH) + ' and ' + hhmm0(stN.sunrise) + ' at your field, and the later in that window the better', 'minor'],
            [bi({ en: 'Air temperature now', fil: 'Temperatura ng hangin ngayon' }), fmt(inp.T, 1) + ' °C, what you measured'],
            [bi({ en: 'Dew point', fil: 'Dew point' }), fmt(d.dewPoint, 1) + ' °C, the temperature the air must fall to before dew forms'],
            [bi({ en: 'Still to cool', fil: 'Lamig na kailangan pa' }), fmt(d.depression, 1) + ' °C, the difference between the two figures above']
          ];
          /* The end of wetness can be given, because the sun sets it: Luo & Goudriaan measured dew outlasting
             sunrise by 1.4 to 3.4 h on rice. The start cannot: no published method gets dew onset from a single
             evening reading. So the card anchors their measured range to this location's own sunrise. */
          if (d.code !== 'dew_less_likely') {
            const R = A.DEW_RICE_LB;
            ls.push([bi({ en: 'Leaves likely dry by', fil: 'Malamang tuyo na ang dahon bandang' }),
              hhmm0(stN.sunrise + R.afterSunriseLoH) + ' to ' + hhmm0(stN.sunrise + R.afterSunriseHiH) + ', that is your sunrise ' + hhmm0(stN.sunrise) + ' plus the ' + R.afterSunriseLoH + ' to ' + R.afterSunriseHiH + ' h that dew outlasted sunrise on rice at IRRI Los Baños', 'key']);
            ls.push([bi({ en: 'Wet period measured there', fil: 'Sukat na haba ng pagkabasa roon' }),
              R.nightLoH.toFixed(1) + ' to ' + R.nightHiH.toFixed(1) + ' h, measured on ' + R.nights + ' heavy dew nights at that one site, not calculated for your field', 'minor']);
          }
          return ls;
        })(),
        why: ['Dew forms when a surface cools to the dew point (FAO-56 definition; FAO frost manual). Clear, calm nights cool most.',
          'A reading taken before the air has begun cooling says nothing about the night, which is why the window opens two hours before sunset. Later is better inside that window: every hour you wait is an hour of cooling that has already happened and no longer has to be guessed at. The FAO frost manual takes its own readings two hours after sunset.', 'The question is about the morning, not the evening, because dew that forms early is close to universal on a clear, calm night and tells you little on its own. What decides infection is how long the leaves stay wet, and that period runs from the moment dew forms until the sun dries it, usually well into the morning. A night that leaves the crop wet at dawn is the one that matters.',
          'How long leaves stay wet after dawn has been measured on rice in this country. Luo and Goudriaan (2000) checked dew onset and drying every 15 minutes over 16 rain-free nights at IRRI Los Baños in the 1994 dry season, on IR72. Dew lasted 1.4 to 3.4 hours after sunrise, and the whole dew period on the top leaves ran 9.0 to 12.8 hours on heavy dew nights. Shielding the crop to cut the dew period short moved the drying time by only 0 to 2 hours, because what dries the leaves is the sun coming up, not when the dew began. So on a night that dews, expect the crop to still be wet for the first hours of the morning. Those figures are lowland paddy in the dry season at one site, and have not been repeated elsewhere in the Philippines.',
          'Wet leaves through the night favour fungal and bacterial disease generally. For rice, IRRI names this pattern for blast: it occurs "in areas with low soil moisture, frequent and prolonged periods of rain shower, and cool temperature in the daytime", and in upland rice "large day-night temperature differences that cause dew formation on leaves and overall cooler temperatures favor the development of the disease" (IRRI Rice Knowledge Bank). That is a description of the weather, not a threshold, so this card reports the dew and does not score blast risk.',
          'What IRRI gives for blast is management rather than a number: plant resistant varieties and ask your local agriculture office which ones are current; sow early, after the onset of the rainy season; split the nitrogen, because excessive fertiliser increases blast intensity; and flood the field as often as possible.'], limits: ['Hours of leaf wetness are not calculated for your own field. The RH ≥ 90% method needs humidity recorded right through the night, not one evening reading, and its threshold has to be fitted locally: Sentelhas et al. (2008) fitted 83, 85, 90 and 92% at four sites on turfgrass. No Philippine fit is published.', 'The drying time above is your own sunrise plus a range measured on rice at one lowland site in the 1994 dry season (Luo and Goudriaan 2000). Sunrise is calculated for your location; the rest is measurement from elsewhere, not a prediction for your field, crop or season.', 'The start of the wet period is not given, because no published method gets the moment dew forms from a single evening reading.'], sources: ['FAO56', 'FAO_FROST', 'SENTELHAS2008', 'LUO2000'] }));
    }
    if (inp.logger && inp.a1 != null && inp.a2 != null && inp.b1 != null && inp.b2 != null) {
      const hcr = A.huttonCriteria([{ Tmin: inp.b1, hoursRH90: inp.b2 }, { Tmin: inp.a1, hoursRH90: inp.a2 }]);
      show(out, result({ level: hcr.code === 'hutton_high_risk' ? 'stop' : 'go', verdict: t(T.verdicts[hcr.code]), why: ['Hutton Criteria: "two consecutive days have a minimum temperature of 10°C, and at least six hours of relative humidity at or above 90%" (James Hutton Institute, via the IPM Decisions factsheet).'], limits: ['Developed and tested in the UK; "not tested yet in other countries" (IPM Decisions).'], sources: ['HUTTON'] }));
    }
  }
};

/* TIMING */
CARDS.timing = function (root) {
  const prev = recall('timing');
  const form = el('form', { class: 'card-form', onsubmit: e => { e.preventDefault(); run(); } });
  form.appendChild(locationBlock());
  const variety = selectInput('tVar', { en: 'Rice variety', fil: 'Uri ng palay' }, Object.keys(A.RICE_VARIETIES).map(k => [k, { en: k, fil: k }]), prev.variety || 'NSIC Rc222 (Tubigan 18)');
  const method = selectInput('tMet', { en: 'Establishment', fil: 'Paraan ng pagtatanim' }, [['tp', { en: 'Transplanted', fil: 'Lipat-tanim' }], ['ds', { en: 'Direct seeded', fil: 'Sabog-tanim' }]], prev.method || 'tp');
  const sow = dateInput('tSow', { en: 'Sowing date', fil: 'Petsa ng pagpunla' }, prev.sow, { prefilled: true });
  const h2 = el('h4', null, bi({ en: 'Corn heat units (tracker only)', fil: 'Init na naipon ng mais (pagsubaybay lang)' }));
  const plant = dateInput('tPlant', { en: 'Corn planting date', fil: 'Petsa ng pagtatanim ng mais' }, prev.plant, { optional: true });
  const tx = numInput('tTx', { en: 'Typical afternoon high since planting (°C)', fil: 'Karaniwang pinakamainit mula nang itanim (°C)' }, prev.tx, 0.1, { optional: true }), tn = numInput('tTn', { en: 'Typical morning low since planting (°C)', fil: 'Karaniwang pinakamalamig mula nang itanim (°C)' }, prev.tn, 0.1, { optional: true });
  form.append(variety.row, method.row, sow.row, h2, plant.row, tx.row, tn.row, el('button', { type: 'submit', class: 'btn primary' }, bi(T.ui.compute)));
  const out = el('div'); root.append(form, out);
  function run() {
    const inp = { variety: variety.input.value, method: method.input.value, sow: sow.input.value, plant: plant.input.value, tx: num(tx.input), tn: num(tn.input) };
    remember('timing', inp); out.innerHTML = '';
    if (inp.tx != null && inp.tn != null && inp.tx < inp.tn) { show(out, result({ level: 'info', verdict: t(T.verdicts.bad_minmax) })); return; }
    const L = store.loc, now = new Date(), J = todayJ(now);
    const h = A.harvestWindow(inp.variety, inp.method, new Date(inp.sow + 'T00:00:00Z'));
    /* The date is the weakest thing on this card, so it leads with what the farmer can see instead.
       PalayCheck Key Check 8 gives criteria in the field; the date only says when to start looking. */
    const lines = [
      [bi({ en: 'When to cut (PhilRice PalayCheck, Key Check 8)', fil: 'Kailan gapasin (PhilRice PalayCheck, Key Check 8)' }), bi({ en: '85 to 90% of the grains golden yellow for manual harvest, 90 to 95% with a combine.', fil: '85 hanggang 90% ng butil ay dilaw-ginto kung manu-manong gapas, 90 hanggang 95% kung combine harvester.' }), 'key'],
      [bi({ en: 'Grain moisture at harvest', fil: 'Halumigmig ng butil sa pag-ani' }), bi({ en: '18 to 21% in the dry season, 20 to 25% in the wet season.', fil: '18 hanggang 21% sa tag-araw, 20 hanggang 25% sa tag-ulan.' })],
      [bi({ en: 'Before harvest', fil: 'Bago umani' }), bi({ en: 'Drain the field 1 to 2 weeks before the expected date.', fil: 'Patuyuin ang bukid 1 hanggang 2 linggo bago ang inaasahang petsa.' })],
      [bi({ en: 'Maturity for this variety (PhilRice)', fil: 'Gulang ng uring ito (PhilRice)' }), h.days + ' days'],
      [bi({ en: 'Daylight today here', fil: 'Haba ng araw dito ngayon' }), fmt(A.daylight(L.lat, J), 1) + ' hours (FAO-56 Eq. 34)']];
    const flags = h.flag ? [CODES[h.flag]] : [];
    if (inp.plant && inp.tx != null && inp.tn != null) {
      const days = Math.max(0, Math.round((now - new Date(inp.plant + 'T00:00:00')) / 86400000));
      const g = A.gdd(inp.tx, inp.tn, 10, 30, 2) * days;
      lines.push([bi({ en: 'Corn heat units since planting', fil: 'Init na naipon ng mais mula nang itanim' }), fmt(g, 0) + ' °C·day over ' + days + ' days (base 10 °C, cap 30 °C, McMaster and Wilhelm method 2); no stage target is published for Philippine hybrids, so this is a tracker only']);
    }
    show(out, result({ level: 'info', verdict: t(T.verdicts.harvest, { date: h.date.toISOString().slice(0, 10) }), lines, why: ['Maturity days from the PhilRice Pinoy Rice Knowledge Bank variety pages, counted from sowing as the pages state.', 'Heat units: GDD = (Tmax + Tmin)/2 − 10 with Tmax and Tmin clamped to 10 and 30 °C (McMaster and Wilhelm 1997, corn values from Cross and Zuber 1972).'], flags, assumptions: ['The harvest date is an orientation, not a promise: it says when to start looking at the crop. Judge the cut by PalayCheck Key Check 8 above.', 'Any window of about a week around this date would be a design assumption; PhilRice publishes none, and a week is probably too narrow. Cauba et al. (2025) estimated harvest dates for 99 Philippine rice fields from Sentinel-1 against farmer-reported dates and report root mean squared differences of 16 to 17.5 days in the dry season and 8 to 22 days in the wet. That is detection rather than prediction, but it is the closest published measure and it is wider than a week.', 'Heat units use one typical high and low for the whole period; enter daily values in a later version for a true sum.'], limits: ['Day length is the astronomical value, not a photoperiod threshold for any variety.'], sources: h.sources.concat(['PALAYCHECK', 'CAUBA2025', 'MCMASTER1997', 'FAO56']) }));
  }
};

/* SOURCES */
CARDS.sources = function (root) {
  const groups = { primary: 'Primary standards and peer-reviewed papers', regulatory: 'Regulatory texts and labels', extension: 'Extension guidance (IRRI, PhilRice, DA, GRDC, Queensland DAF, universities)', secondary: 'Secondary reproductions (the primary text was not accessible)' };
  Object.keys(groups).forEach(cls => {
    const items = Object.keys(A.REFS).filter(k => A.REFS[k].cls === cls);
    if (!items.length) return;
    root.appendChild(el('h3', null, groups[cls]));
    const ul = el('ul', { class: 'refs' });
    items.forEach(k => { const r = A.REFS[k]; ul.appendChild(el('li', null, el('code', null, k), ' ', r.cite, ' ', refLinks(k && r))); });
    root.appendChild(ul);
  });
  root.appendChild(el('h3', null, bi({ en: 'Cannot be verified against a primary source', fil: 'Hindi mabeberipika sa pangunahing sanggunian' })));
  const ul = el('ul', { class: 'refs' }); A.UNVERIFIED.forEach(u => ul.appendChild(el('li', null, u.text))); root.appendChild(ul);
  root.appendChild(el('h3', null, bi({ en: 'How estimates are shown', fil: 'Paano ipinapakita ang mga tantiya' })));
  root.appendChild(el('p', null, 'Whenever an input is missing, the app uses the fallback that FAO-56 itself documents (dew point from the morning low, sunlight from the temperature range, 2 m/s wind) and lists it under "Estimated, not measured" on the result, with FAO-56\'s own statement of what it costs. Values outside a formula\'s published range are flagged, not silently returned.'));
};

/* ABOUT */
CARDS.about = function (root) {
  root.appendChild(el('p', null, 'AgriKalkunahon is an offline decision aid for farmers, extension workers and agriculture students in the Philippines. It answers "what should I do" from readings a farmer can take: the afternoon high, the morning low, a rain gauge, and sometimes a hygrometer. Every result names the published source it derives from and lists the assumptions it made.'));
  root.appendChild(el('p', { class: 'warn' }, 'This app is a decision aid, not a prescription. Its thresholds and formulas are published values that may not match your field, your variety or your season. Decisions that cost money and food remain yours; check them against local advice, especially PAGASA.'));
  root.appendChild(el('p', null, 'Engine tested with 298 numerical assertions against published worked examples (FAO-56 Examples 2 to 37, FAO Training Manual 3, the University of Arkansas EMC table, IRRI and PhilRice examples). Run node engine/test.js in the repository.'));
  root.appendChild(el('p', null, 'Author: Jef Zerrudo (DOST-PAGASA; Wageningen University & Research). Version __VERSION__, build __BUILD__. Licence: PolyForm Noncommercial 1.0.0. NOT OFFICIAL. NOT ENDORSED by FAO, IRRI, PhilRice, DA, PAGASA, GRDC or Queensland DAF.'));
  const h = el('div', { class: 'haiku' });
  h.appendChild(el('div', { class: 'jp' }, '\u540d\u6708\u306b\u8fb2\u6a5f\u4ed5\u7acb\u3066\u308b\u8001\u723a\u54c9'));
  h.appendChild(el('div', { class: 'romaji' }, 'meigetsu ni / nouki shitateru / rouya kana'));
  h.appendChild(el('span', { class: 'en' }, 'under the harvest moon'));
  h.appendChild(el('span', { class: 'en' }, 'the old farmer'));
  h.appendChild(el('span', { class: 'en' }, 'readies his machine'));
  h.appendChild(el('span', { class: 'attrib' }, 'Makirin (Jef Zerrudo)'));
  root.appendChild(h);
};

/* Which agency holds the mandate for each calculator. Shown at the top of every card, so the farmer
   sees it before entering anything, not folded away under the answer. */
const AUTHORITY = {
  water:   { en: 'PAGASA issues the official weather data, and DA and NIA the official irrigation guidance. Where they differ from this card, follow them.', fil: 'Ang PAGASA ang naglalabas ng opisyal na datos ng panahon, at ang DA at NIA ng opisyal na patnubay sa patubig. Sundin sila kung iba sa card na ito.' },
  rice:    { en: 'DA and PhilRice set the official alternate wetting and drying practice (DA AO 25-09, PalayCheck). Where they differ from this card, follow them.', fil: 'Ang DA at PhilRice ang nagtatakda ng opisyal na AWD (DA AO 25-09, PalayCheck). Sundin sila kung iba sa card na ito.' },
  rain:    { en: 'PAGASA issues the official rainfall data and forecasts. Where they differ from this card, follow them.', fil: 'Ang PAGASA ang naglalabas ng opisyal na datos at taya ng ulan. Sundin sila kung iba sa card na ito.' },
  spray:   { en: 'The product label and the Fertilizer and Pesticide Authority govern how a pesticide may be applied. The label takes precedence over this card, always.', fil: 'Ang label ng produkto at ang Fertilizer and Pesticide Authority ang namamahala sa paggamit ng pestisidyo. Ang label ang laging sinusunod, hindi ang card na ito.' },
  dry:     { en: 'DA and PhilRice set the official drying and storage practice (PalayCheck). Where they differ from this card, follow them.', fil: 'Ang DA at PhilRice ang nagtatakda ng opisyal na pagpapatuyo at pag-iimbak (PalayCheck). Sundin sila kung iba sa card na ito.' },
  stress:  { en: 'PAGASA issues the official temperature data and warnings, and DA the official crop advisories. Where they differ from this card, follow them.', fil: 'Ang PAGASA ang naglalabas ng opisyal na datos at babala sa temperatura, at ang DA ng opisyal na payo sa pananim. Sundin sila kung iba sa card na ito.' },
  frost:   { en: 'PAGASA issues the official weather warnings and advisories in the Philippines, and its Frost Risk Observation and Support Tool (FROST-PH) covers frost in Benguet. Where they differ from this card, follow them. This card is a farmer\'s checklist for one field on one night, not an advisory.', fil: 'Ang PAGASA ang naglalabas ng opisyal na babala at abiso sa panahon sa Pilipinas, at ang Frost Risk Observation and Support Tool (FROST-PH) nito ang sumasaklaw sa andap sa Benguet. Sundin sila kung iba sa card na ito. Isa lang itong checklist ng magsasaka para sa isang bukid sa isang gabi, hindi abiso.' },
  disease: { en: 'DA and the Bureau of Plant Industry issue the official plant health guidance, and PAGASA the official weather data. Where they differ from this card, follow them.', fil: 'Ang DA at ang Bureau of Plant Industry ang naglalabas ng opisyal na patnubay sa kalusugan ng halaman, at ang PAGASA ng opisyal na datos ng panahon. Sundin sila kung iba sa card na ito.' },
  timing:  { en: 'DA and PhilRice publish the official variety maturity data, and PAGASA the official seasonal outlook. Where they differ from this card, follow them.', fil: 'Ang DA at PhilRice ang naglalathala ng opisyal na datos sa pagkahinog ng barayti, at ang PAGASA ng opisyal na seasonal outlook. Sundin sila kung iba sa card na ito.' }
};

/* How and when each reading must be taken. Shown under the authority note, above the inputs, because
   a caveat folded under the answer arrives after the farmer has already typed the wrong number. */
const READING = {
  water:   { en: 'Use the day\'s highest afternoon temperature and lowest morning temperature, not one reading taken now. A thermometer left in the shade, read in mid-afternoon and again at sunrise, gives both.', fil: 'Gamitin ang pinakamataas na temperatura sa hapon at pinakamababa sa umaga, hindi ang isang pagbasa ngayon. Ang termometro sa lilim, basahin sa tanghali-hapon at muli sa pagsikat ng araw.' },
  rice:    { en: 'Read the field water tube in the morning, before you add any water that day.', fil: 'Basahin ang tubo ng tubig sa bukid sa umaga, bago magdagdag ng tubig sa araw na iyon.' },
  rain:    { en: 'Use the total your gauge collected over the whole month, not a single storm.', fil: 'Gamitin ang kabuuang naipon ng panukat ng ulan (ulansukod) sa buong buwan, hindi ang isang ulan lamang.' },
  spray:   { en: 'Take these readings where and when you intend to spray. Conditions change within the hour, so a reading from earlier in the morning does not describe the afternoon.', fil: 'Basahin ito sa lugar at oras na balak mong mag-spray. Nagbabago ang kondisyon kada oras, kaya hindi naglalarawan ng hapon ang pagbasa kaninang umaga.' },
  dry:     { en: 'Read the air beside the drying area in the early afternoon, when it is hottest and driest. Keep the instruments out of direct sun: in the sun a thermometer reads its own heated bulb, not the air, and the answer comes out too hopeful. A morning reading understates what the day can dry.', fil: 'Basahin ang hangin sa tabi ng patuyuan sa maagang hapon, kung kailan pinakamainit at pinakatuyo. Huwag ilagay sa tuwirang araw ang mga kagamitan: sa araw, ang nababasa ng termometro ay ang sarili nitong init, hindi ang hangin, kaya lumalabas na masyadong maganda ang sagot. Maliit ang ipinapakita ng pagbasa sa umaga.' },
  stress:  { en: 'Use each day\'s actual afternoon high and morning low, not one reading taken now.', fil: 'Gamitin ang tunay na pinakamainit sa hapon at pinakamalamig sa umaga bawat araw, hindi ang isang pagbasa ngayon.' },
  frost:   { en: 'Read as late as you can before sleeping. The air keeps cooling all night, so a reading taken at 6 or 7 p.m. can understate the risk. Take it outdoors, away from walls, at about head height.', fil: 'Magbasa nang pinakahuli bago matulog. Patuloy na lumalamig ang hangin buong gabi, kaya maaaring maliitin ng pagbasa sa alas-6 o alas-7 ng gabi ang panganib. Sa labas, malayo sa pader, mga kasintaas ng ulo.' },
  disease: { en: 'Take the temperature and humidity outdoors in the evening, near the crop. The late blight section below is separate and needs a data logger; leave it blank if you do not have one.', fil: 'Sukatin ang temperatura at halumigmig sa labas kinagabihan, malapit sa pananim. Hiwalay ang late blight sa ibaba at kailangan nito ng data logger; huwag punan kung wala kayo nito.' },
  timing:  { en: 'Use a typical afternoon high and morning low for the season so far, not today\'s weather alone.', fil: 'Gamitin ang karaniwang pinakamainit sa hapon at pinakamalamig sa umaga sa buong panahon, hindi ang panahon ngayon lamang.' }
};

CARDS.feedback = function (root) {
  const MAIL = 'jbzerrudo@pagasa.dost.gov.ph';
  const subject = encodeURIComponent('AgriKalkunahon feedback (build __BUILD__)');
  root.appendChild(el('p', null, bi({
    en: 'If an answer does not match what you see in your field, or a word is wrong, or something will not work on your phone, please write. Corrections from farmers and extension workers are the main way this app improves.',
    fil: 'Kung hindi tugma ang sagot sa nakikita mo sa bukid, o mali ang salita, o may hindi gumagana sa smartphone mo, sumulat po kayo. Ang mga pagwawasto mula sa mga magsasaka at extension worker ang pangunahing paraan ng pagpapabuti ng app na ito.'
  })));
  root.appendChild(el('p', null, el('a', { class: 'btn primary', href: 'mailto:' + MAIL + '?subject=' + subject, style: 'display:block;text-align:center;text-decoration:none' }, bi({ en: 'Write to the author', fil: 'Sumulat sa may-akda' }))));
  root.appendChild(el('p', { class: 'hint' }, bi({ en: 'Or copy the address: ', fil: 'O kopyahin ang address: ' }), el('code', null, MAIL)));
  root.appendChild(el('h4', null, bi({ en: 'What helps most', fil: 'Ano ang pinakanakakatulong' })));
  const ul = el('ul', { class: 'refs' });
  [{ en: 'Which calculator, and what you typed in.', fil: 'Aling kalkulador, at ano ang inilagay mo.' },
   { en: 'What it answered, and what you expected instead.', fil: 'Ano ang isinagot nito, at ano ang inaasahan mo.' },
   { en: 'Your town or province, and the crop.', fil: 'Ang bayan o lalawigan mo, at ang pananim.' },
   { en: 'The build shown at the bottom of the main menu (this copy is build __BUILD__).', fil: 'Ang build na nasa ibaba ng pangunahing menu (build __BUILD__ ang kopyang ito).' }
  ].forEach(x => ul.appendChild(el('li', null, bi(x))));
  root.appendChild(ul);
  root.appendChild(el('p', { class: 'warn' }, bi({
    en: 'This app is offline and sends nothing by itself. The button opens your own mail app, and nothing you type into the calculators ever leaves your phone.',
    fil: 'Offline ang app na ito at walang ipinapadala nang kusa. Binubuksan lang ng pindutan ang sarili mong mail app, at walang inilalagay sa mga kalkulador ang lumalabas sa smartphone mo.'
  })));
};

/* What the farmer physically needs before starting. Shown above the inputs, because the commonest
   confusion reported is not knowing what to go and fetch. */
const NEEDS = {
  water:   { en: 'A maximum and minimum thermometer, the kind that holds the highest and lowest reading until you reset it, kept in the shade. The high comes in the afternoon and the low just before sunrise, so it must run through the night as well as the day. A rain gauge. Your location, which the phone can fill in. With no thermometer, a phone weather app\'s high and low for the nearest town will serve as a rough stand-in, but it is a forecast for somewhere else: expect error, and more of it if that town sits at a different elevation.', fil: 'Isang max-min na termometro, iyong kayang humawak ng pinakamataas at pinakamababang reading hanggang sa i-reset mo ito, na nakalagay sa lilim. Ang pinakamataas na temperatura ay nangyayari sa hapon at ang pinakamababa bago sumikat ang araw, kaya dapat itong tumagal sa buong gabi pati na rin sa araw. Panukat ng ulan. Ang lokasyon ninyo, na kayang kunin ng smartphone. Kung walang termometro, puwedeng gamiting pahapyaw na panghalili ang mataas at mababang temperatura ng pinakamalapit na bayan sa weather app ng smartphone, ngunit hula iyon para sa ibang lugar: asahan ang pagkakamali, lalo na kung magkaiba ang taas ng lugar.' },
  rice:    { en: 'A stick or ruler to measure the water. A field water tube as well, if you use safe AWD. No weather app can tell you the depth of water in your own field; this one has to be measured.', fil: 'Patpat o ruler na pansukat ng tubig. Tubo rin sa bukid, kung safe AWD ang ginagamit ninyo. Walang weather app na makapagsasabi ng lalim ng tubig sa bukid ninyo; kailangan itong sukatin mismo.' },
  rain:    { en: 'A rain gauge, read at the same hour each day and added up for the whole month. If you have none, PAGASA publishes monthly rainfall for its stations: use the nearest one, remembering that rainfall can differ a great deal between your field and a station some distance away. A phone weather app is a weaker fallback than the station record, because the rainfall it shows is an estimate for a wide area rather than what fell on your field.', fil: 'Sa panukat ng ulan (ulansukod), basahin sa parehong oras araw-araw at ipunin sa buong buwan. Kung wala kayo nito, naglalathala ang PAGASA ng buwanang ulan sa mga istasyon nito: gamitin ang pinakamalapit, ngunit tandaan na malaki ang maaaring pagkakaiba ng ulan sa bukid ninyo at sa istasyong malayo. Mas mahina ang weather app sa smartphone kaysa sa talaan ng istasyon, dahil tantiya lamang iyon para sa malawak na lugar at hindi ang tunay na bumagsak sa bukid ninyo.' },
  spray:   { en: 'A thermometer and a hygrometer, taken at the spot you will spray. A watch, and some way to judge the wind. Do not take the wind from a phone weather app: drift is decided by the wind in your field at boom height, not at a station kilometres away and ten metres up, and the label holds you to the conditions where you spray.', fil: 'Termometro at hygrometer, sa mismong lugar na sisprayan. Relo, at paraan ng pagtantiya ng hangin. Huwag kunin sa weather app ng smartphone ang hangin: ang pag-anod ng spray ay nakasalalay sa hangin sa mismong bukid ninyo sa taas ng boom, hindi sa istasyong ilang kilometro ang layo at sampung metro ang taas, at ang label ang panagot ninyo sa kondisyon kung saan kayo nagsi-spray.' },
  dry:     { en: 'A thermometer and a hygrometer, shaded from direct sun but standing in the air beside the drying area. A weighing scale. A moisture meter if you have one; otherwise your usual way of judging the grain. A phone weather app\'s humidity is measured somewhere else entirely and will not match your drying floor; use it only if you have nothing at all.', fil: 'Termometro at hygrometer, may silong mula sa tuwirang araw ngunit nasa hangin sa tabi ng patuyuan. Timbangan. Moisture meter kung meron; kung wala, ang nakasanayan ninyong paraan ng pagtingin sa butil. Ang humidity na ipinapakita ng weather app sa smartphone ay sinukat sa ibang lugar at hindi tutugma sa bilaran ninyo; gamitin lamang kung talagang wala kayong ibang paraan.' },
  stress:  { en: 'A maximum and minimum thermometer, the kind that holds the highest and lowest reading until you reset it, kept in the shade. The high comes in the afternoon and the low just before sunrise, so it must run through the night as well as the day. With none, a phone weather app\'s high and low for the nearest town will serve as a rough stand-in, but it is a forecast for somewhere else: expect error, and more of it if that town sits at a different elevation.', fil: 'Isang max-min na termometro, iyong kayang humawak ng pinakamataas at pinakamababang reading hanggang sa i-reset mo ito, na nakalagay sa lilim. Ang pinakamataas na temperatura ay nangyayari sa hapon at ang pinakamababa bago sumikat ang araw, kaya dapat itong tumagal sa buong gabi pati na rin sa araw. Kung wala nito, puwedeng gamiting pahapyaw na panghalili ang mataas at mababang temperatura ng pinakamalapit na bayan sa weather app ng smartphone, ngunit hula iyon para sa ibang lugar: asahan ang pagkakamali, lalo na kung magkaiba ang taas ng lugar.' },
  frost:   { en: 'A thermometer and a hygrometer, read outdoors away from walls, at about head height. If you have neither, a phone weather app for the nearest town can be used, but know which way it is wrong: cold air drains downhill and pools, so a field in a hollow gets colder than the town on a clear, calm night, and the app will read too warm. Treat its number as the warmest your field will be, not the coldest, and take a frost warning seriously even when the app looks safe.', fil: 'Basahin sa labas ang termometro at hygrometer na malayo sa pader, at mga kasintaas ng ulo. Kung wala kayo ng dalawa, puwedeng gamitin ang weather app ng smartphone para sa pinakamalapit na bayan, ngunit alamin kung saan ito nagkakamali: umaagos pababa at namumuo ang malamig na hangin, kaya mas lumalamig ang bukid sa lubak kaysa sa bayan kapag maaliwalas at walang hangin, at mas mainit ang ipapakita ng app. Ituring ninyong pinakamainit na posible ang bilang nito, hindi ang pinakamalamig, at seryosohin ang babala sa andap kahit mukhang ligtas sa app.' },
  disease: { en: 'A thermometer and a hygrometer, read outdoors near the crop in the evening. As with frost, a phone weather app is a poor substitute here, because dew depends on how your own field cools rather than on the town average. Use it only if you have nothing else.', fil: 'Basahin sa labas ang termometro at hygrometer malapit sa pananim kinagabihan. Tulad sa andap mahina ang weather app galing smartphone dito, dahil nakadepende ang hamog sa paglamig ng sarili ninyong bukid at hindi sa karaniwan ng bayan. Gamitin kung wala talaga.' },
  timing:  { en: 'Your planting or sowing dates, and a thermometer for a typical high and low. A phone weather app is acceptable here, because this card wants a typical value for the season rather than a particular day.', fil: 'Ang petsa ng pagtatanim o pagpupunla, at termometro para sa karaniwang mataas at mababa. Puwede ang weather app sa smartphone dito, dahil karaniwang halaga para sa panahon ang hinahanap ng card na ito at hindi ang isang tiyak na araw.' }
};

/* ---------- router ---------- */
const ORDER = ['water', 'rice', 'rain', 'spray', 'dry', 'stress', 'frost', 'disease', 'timing', 'sources', 'about', 'feedback'];
const ICON = { water: '💧', rice: '🌾', rain: '🌧', spray: '🧴', dry: '☀', stress: '🌡', frost: '❄', disease: '🍃', timing: '📅', sources: '📚', about: 'ℹ', feedback: '✉' };
function renderHome(main) {
  main.innerHTML = '';
  main.appendChild(el('p', { class: 'lead' }, bi(T.tagline)));
  const grid = el('div', { class: 'grid' });
  ORDER.forEach(id => { grid.appendChild(el('a', { class: 'tile', href: '#/' + id }, el('span', { class: 'ico' }, ICON[id]), bi(T.cards[id]))); });
  main.appendChild(grid);
  main.appendChild(el('p', { class: 'foot' }, 'Offline. Every answer shows its source. Decision aid, not a prescription. Build __BUILD__.'));
}
function renderCard(main, id) {
  main.innerHTML = '';
  main.appendChild(el('a', { class: 'back', href: '#/' }, '← ', bi(T.ui.back)));
  main.appendChild(el('h2', null, bi(T.cards[id])));
  if (AUTHORITY[id]) main.appendChild(el('p', { class: 'warn authority' }, bi(AUTHORITY[id])));
  if (NEEDS[id]) main.appendChild(el('p', { class: 'needs' }, el('strong', null, 'What you need / Ano ang kailangan: '), bi(NEEDS[id])));
  if (READING[id]) main.appendChild(el('p', { class: 'reading' }, bi(READING[id])));
  const body = el('div', { class: 'card-body' }); main.appendChild(body);
  CARDS[id](body);
}
function route() {
  const main = $('#main'); const id = (location.hash || '#/').replace('#/', '');
  if (id && CARDS[id]) renderCard(main, id); else renderHome(main);
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', route);
route();

/* PWA registration only in a secure context served over http(s) */
try {
  if ('serviceWorker' in navigator && window.isSecureContext && location.protocol !== 'file:') {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').then(reg => {
        // An installed copy can stay open for days; re-check for a new build whenever it comes back to the foreground.
        document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
      }).catch(() => {});
    });
  }
} catch (e) {}

/* Install prompt, same pattern as Kalkunahon. Chrome and Edge fire beforeinstallprompt
   when the app is installable and not yet installed; the event is stashed and the
   header button is shown. Browsers that never fire it (Safari, Firefox, embedded
   webviews) keep the button hidden; on iOS use Share > Add to Home Screen. */
let deferredInstall = null;
const installBtn = document.getElementById('installBtn');
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredInstall = e;
  if (installBtn) installBtn.hidden = false;
});
if (installBtn) {
  installBtn.addEventListener('click', async () => {
    if (!deferredInstall) return;
    installBtn.hidden = true;
    deferredInstall.prompt();
    await deferredInstall.userChoice;
    deferredInstall = null;
  });
}
window.addEventListener('appinstalled', () => { deferredInstall = null; if (installBtn) installBtn.hidden = true; });
})();
