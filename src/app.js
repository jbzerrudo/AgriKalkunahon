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
/* Saved readings. Kept on this device only and never sent anywhere. localStorage is not durable: it
   goes when browsing data is cleared, and iOS evicts it after about a week of not opening the app, so
   the CSV export in the About card is the farmer's real copy, not a convenience. Capped so a long
   season cannot fill the quota and start losing writes silently. */
store.log = Array.isArray(store.log) ? store.log : [];
const LOG_MAX = 500;

/* The rice field's own history. One record per day on which the card measured a real fall, plus the
   days the card said to re-flood. This is what lets the card describe the field rather than only
   today's reading: its usual loss rate, its usual gap between irrigations, and whether this drawdown
   is behaving like the others. Same device, same limits as the log above. */
store.riceField = (store.riceField && typeof store.riceField === 'object') ? store.riceField : {};
store.riceField.rates = Array.isArray(store.riceField.rates) ? store.riceField.rates : [];
store.riceField.refloods = Array.isArray(store.riceField.refloods) ? store.riceField.refloods : [];
const RICE_LOG_MAX = 60;
/* The field's loss rate combined from past drawdowns, weighted by the square of each span. A pair n
   days apart carries an error of sqrt(2)/n cm/day, so the weight is inverse variance: a five-day
   pair counts twenty-five times a one-day pair, which is exactly right. The spread is the plain
   standard deviation of the rates, because a new drawdown is judged against the whole scatter, not
   against the precision of the mean. It carries reading error and real seasonal change together. */
function riceFieldStats() {
  const rs = store.riceField.rates;
  if (!rs.length) return null;
  let sw = 0, swx = 0;
  rs.forEach(r => { const w = r.days * r.days; sw += w; swx += w * r.rate; });
  let sd = null;
  if (rs.length >= 2) {
    const m = rs.reduce((a, r) => a + r.rate, 0) / rs.length;
    sd = Math.sqrt(rs.reduce((a, r) => a + (r.rate - m) * (r.rate - m), 0) / (rs.length - 1));
  }
  const v = rs.map(r => r.rate);
  return { mean: swx / sw, sd: sd, n: rs.length, lo: Math.min.apply(null, v), hi: Math.max.apply(null, v) };
}
const today10 = () => new Date().toISOString().slice(0, 10);
function riceRecordRate(rate, days, onDate) {
  const rs = store.riceField.rates, d = onDate || today10(), rec = { d: d, rate: rate, days: days };
  let i = -1; rs.forEach((r, k) => { if (r.d === d) i = k; });     // one record a day: the latest wins
  if (i >= 0) rs[i] = rec; else rs.push(rec);
  if (rs.length > RICE_LOG_MAX) rs.splice(0, rs.length - RICE_LOG_MAX);
  save();
}
function riceRecordReflood(onDate) {
  const f = store.riceField.refloods, d = onDate || today10();
  if (f.indexOf(d) < 0) { f.push(d); if (f.length > RICE_LOG_MAX) f.shift(); save(); }
}
/* Mean days between re-floods: the farmer's own irrigation interval, read straight off the dates.
   The mean of the gaps is (last - first)/(n-1), so it needs no more than the two end dates. */
function riceInterval() {
  const r = store.riceField.refloods.slice().sort();
  if (r.length < 2) return null;
  const a = new Date(r[0] + 'T00:00:00'), b = new Date(r[r.length - 1] + 'T00:00:00');
  return { days: (b - a) / 86400000 / (r.length - 1), n: r.length, first: r[0] };
}
const dmy = d => String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
const dayFrom = n => new Date(Date.now() + n * 86400000);

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
    about: { en: 'About this app and saved suggestions', fil: 'Tungkol sa app na ito at mga naitalang mungkahi' }
  },
  ui: {
    saveReading: { en: 'Save this reading', fil: 'Itala ang pagbasa na ito' },
    saved: { en: 'Saved on this phone', fil: 'Naitala sa telepono na ito' },
    savedTitle: { en: 'Your saved suggestions', fil: 'Mga naitalang mungkahi para sa inyo' },
    savedNone: { en: 'Nothing saved yet. Use any card, then tap "Save this reading."', fil: 'Wala pang naitala. Gamitin ang alinmang card, pagkatapos pindutin ang "Itala ang pagbasa na ito."' },
    savedCount: { en: 'saved readings', fil: 'naitalang pagbasa' },
    csv: { en: 'Download as CSV', fil: 'I-download bilang CSV' },
    clearLog: { en: 'Delete all saved readings', fil: 'Burahin lahat ng naitala' },
    clearAsk: { en: 'Delete every saved reading? This cannot be undone.', fil: 'Burahin lahat ng naitala? Hindi na ito maibabalik.' },
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
    cf_top_up: { en: 'Top up. Bring the water to {depth} cm.', fil: 'Dagdagan ang tubig. Iangat sa {depth} cm.' },
    cf_too_deep: { en: 'Too deep. Let it down to {depth} cm.', fil: 'Masyadong malalim. Pababain sa {depth} cm.' },
    cf_need_depth: { en: 'Measure the water depth in the field first.', fil: 'Sukatin muna ang lalim ng tubig sa bukid.' },
    cf_flowering_ok: { en: 'Flowering: the water is deep enough. Keep it flooded.', fil: 'Namumulaklak: sapat ang tubig. Panatilihing nakababad.' },
    cf_flowering_top_up: { en: 'Flowering: top up to 5 cm now.', fil: 'Namumulaklak: dagdagan ang tubig hanggang 5 cm ngayon.' },
    cf_drain_now: { en: 'Drain the field now for harvest.', fil: 'Patuyuin na ang bukid para sa anihan.' },
    intermittent_no_threshold: { en: 'No published depth says when to re-flood without a tube.', fil: 'Walang nailathalang lalim kung kailan dapat patubigan kung walang AWD tube (pani tube).' },
    water_now: { en: 'Water now. Give about {mm} mm.', fil: 'Magpatubig na ngayon. Mga {mm} mm.' },
    water_tomorrow: { en: 'Water by tomorrow. Give about {mm} mm.', fil: 'Magpatubig bukas. Mga {mm} mm.' },
    wait: { en: 'No need to water yet. Wait about {d} days.', fil: 'Hindi pa kailangang magpatubig. Maghintay ng mga {d} araw.' },
    reflood_now: { en: 'Re-flood now to about 5 cm.', fil: 'Magpatubig na ngayon hanggang mga 5 cm.' },
    not_yet: { en: 'Not yet. Re-flood when the tube shows {trig} cm below the soil.', fil: 'Hindi pa. Magpatubig kapag {trig} cm na ang lalim ng tubig sa AWD tube (pani tube) mula sa lupa.' },
    flowering_keep_flooded: { en: 'Flowering: keep 5 cm of water.', fil: 'Namumulaklak: panatilihin ang 5 cm na tubig.' },
    flowering_top_up_to_5cm: { en: 'Flowering: top up to 5 cm now.', fil: 'Namumulaklak: dagdagan ng tubig hanggang 5 cm ngayon.' },
    before_awd_keep_shallow: { en: 'Too early for AWD. Keep 2 to 3 cm of water.', fil: 'Maaga pa para sa AWD. Panatilihin ang 2 hanggang 3 cm na tubig.' },
    drain_stop_irrigating: { en: 'Stop irrigating and let the field drain before harvest.', fil: 'Ihinto na ang pagpapatubig at patuyuin ang bukid bago mag-ani.' },
    need_tube_reading: { en: 'Read the AWD tube (pani tube) first.', fil: 'Basahin muna ang AWD tube (pani tube).' },
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
    lw_under_blast: { en: 'The PAGASA Farm Weather Forecast gives {lo} to {hi} hours of leaf wetness for your forecast area. {news}, because that is a short wet spell (below the {blo} to {bhi} hours rice blast spores need to germinate, and shorter than the {rlo} to {rhi} hours dew lasted on clear, dry-season nights over lowland rice at Los Baños; see "Sources" below).', fil: 'Ang PAGASA Farm Weather Forecast ay nagbibigay ng {lo} hanggang {hi} oras na basang dahon para sa iyong lugar sa kanilang ulat-panahon. {newsF}, dahil maikli lang ang pagkabasa na iyan (mas mababa sa {blo} hanggang {bhi} oras na kailangan ng spore ng blast upang tumubo, at mas maikli sa {rlo} hanggang {rhi} oras na nanatiling basa ang mga dahon sa maaliwalas at tuyong gabi sa kapatagan ng Los Baños; tingnan ang "Sanggunian" sa ibaba).' },
    lw_at_blast: { en: 'The PAGASA Farm Weather Forecast gives {lo} to {hi} hours of leaf wetness for your forecast area. {news}{scope}, because that reaches the {blo} to {bhi} hours rice blast spores need to germinate (see "Sources" below). Germination is the first step, not a diseased crop: it still needs spores present, humidity near 100%, and a susceptible variety and stage.', fil: 'Ang PAGASA Farm Weather Forecast ay nagbibigay ng {lo} hanggang {hi} oras na basang dahon para sa iyong lugar sa kanilang ulat-panahon. {newsF}{scopeF}, dahil umaabot ito sa {blo} hanggang {bhi} oras na kailangan ng spore ng blast upang tumubo (tingnan ang "Sanggunian" sa ibaba). Ang pagtubo ay unang hakbang lamang at hindi pa sakit: kailangan pa rin ng spore, ng halumigmig na malapit sa 100%, at ng baryedad at yugto ng pananim na tablan nito.' },
    lw_dew_night: { en: 'The PAGASA Farm Weather Forecast gives {lo} to {hi} hours of leaf wetness for your forecast area. {news}{scope}, because that is as long as a dewing night, well past the {blo} to {bhi} hours rice blast spores need to germinate (over lowland rice at Los Baños, clear dry-season nights kept the leaves wet for {rlo} to {rhi} hours; see "Sources" below).', fil: 'Ang PAGASA Farm Weather Forecast ay nagbibigay ng {lo} hanggang {hi} oras na basang dahon para sa iyong lugar sa kanilang ulat-panahon. {newsF}{scopeF}, dahil kasintagal ito ng isang gabing may hamog at lampas na sa {blo} hanggang {bhi} oras na kailangan ng spore ng blast upang tumubo (sa kapatagan ng Los Baños, sa maaliwalas at tuyong gabi ay nanatiling basa ang mga dahon sa loob ng {rlo} hanggang {rhi} oras; tingnan ang "Sanggunian" sa ibaba).' },
    lw_beyond_dew: { en: 'The PAGASA Farm Weather Forecast gives {lo} to {hi} hours of leaf wetness for your forecast area. {news}{scope}, because that is a long wet spell, longer than dew alone usually gives and well past the {blo} to {bhi} hours rice blast spores need to germinate (over lowland rice at Los Baños, clear dry-season nights kept the leaves wet for {rlo} to {rhi} hours; see "Sources" below). Rain or fog is the usual reason.', fil: 'Ang PAGASA Farm Weather Forecast ay nagbibigay ng {lo} hanggang {hi} oras na basang dahon para sa iyong lugar sa kanilang ulat-panahon. {newsF}{scopeF}, dahil mahaba ang pagkabasa na iyan, mas mahaba kaysa sa karaniwang naidudulot ng hamog lamang at lampas na sa {blo} hanggang {bhi} oras na kailangan ng spore ng blast upang tumubo (sa kapatagan ng Los Baños, sa maaliwalas at tuyong gabi ay nanatiling basa ang mga dahon sa loob ng {rlo} hanggang {rhi} oras; tingnan ang "Sanggunian" sa ibaba). Karaniwang ulan o hamog ang dahilan.' },
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
  no_tube_no_published_threshold: 'Letting the field dry without an AWD tube (pani tube) is not safe AWD. Safe AWD is defined by reading the water table in the tube, and the IRRI fact sheet gives no re-flood depth for a farmer without one. This app will not invent a number for it, so the answer below covers only what holds whatever method you use.',
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
  level_net_gain: 'The water is higher than at your earlier reading, so rain or irrigation came in between. Those two readings cannot give a daily loss, and the rain has re-set the drawdown. Today\'s reading still decides whether to irrigate. Start your next pair from today.',
  no_history_yet: 'The water rose instead of falling, and this field has no past readings to fall back on, so there is not enough information yet to say when it will dry. Read again on two days with no rain between them, at the same hour, and the card can date the next irrigation from then on.',
  sp_negative: 'The crop water use you entered is larger than the whole loss you measured, which cannot be. Either the two readings were not a clean drying spell, or the crop water use came from a different day or a different field. The split below is not usable.',
  sp_above_published: 'This field is losing more through seepage and percolation than any of the four soil classes Bouman et al. (1994) measured at IRRI, where the highest band reaches 5 cm/day. Walk the bunds: seepage through ill-maintained bunds can be considerable, and it is the loss a farmer can actually stop.',
  sp_between_bands: 'This field sits between the published bands, which run 0 to 0.5 cm/day where the plow sole is intact and 1 to 1.5 cm/day where the subsoil is what limits percolation (Bouman et al. 1994). Nothing is wrong with the reading; the bands simply do not meet.',
  sp_may_not_be_steady: 'At this rate the field behaves like Bouman et al.\'s class IIb, where percolation follows the depth of water standing on the field instead of holding steady. Two things follow. The date above is less dependable: their own fixed-rate book-keeping drifted 2 to 3 cm in this class. And there is something you can do, which they state plainly: in a field like this, losses fall considerably if the ponded water is kept low, close to zero. Check the bunds as well.',
  rice_kc_stage_unknown: 'No transplanting date, so the crop coefficient could not be taken from the growth stage and the mid-season value was used. That is the largest one rice reaches, so crop water use is at its highest here and the seepage-and-percolation remainder is at its lowest. Give the transplanting date and both become stage-specific.',
  reading_dates_out_of_order: 'The earlier reading is dated on or after the one you called today, so no span can be worked out and no loss rate is taken from the pair. Check the two dates.',
  earlier_reading_date_missing: 'You gave an earlier reading but no date for it, so the card cannot tell how far apart the two are and will not guess. Put the date in and the loss rate and the irrigation date follow.',
  reading_date_in_future: 'The reading is dated in the future. Every date below is counted forward from it, so they will all be wrong by the same amount.',
  readings_too_close: 'The level fell less than about 3 cm between your two readings. A reading off a hand-marked tube is good to about a centimetre, so a fall that small is close to the reading error itself and the daily loss taken from it is unreliable. Leave more days between readings: the further apart they are, the tighter the date.',
  loss_above_field_average: 'This drawdown is losing water faster than this field usually does. Check the bunds for a leak, check that both readings were taken at the same hour, and check that no water came in between them.',
  loss_below_field_average: 'This drawdown is losing water more slowly than this field usually does. That can be a cooler or cloudier spell, a fuller canopy shading the water, or rain you did not count.',
  awd_start_window_unknown: 'No transplanting date given, so this card cannot check the start window. AWD should not begin until 21 to 30 days after transplanting or sowing (PhilRice; DA AO 25-09: 20 to 30 days). Before that, keep 2 to 3 cm of water.',
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
  if (!L.set) out.push({ en: 'This is the app\'s starting location (Metro Manila), not your field. Nothing you see that depends on location, including sunrise, sunset, the frost reading window and the time the leaves should dry, is about your place until you set it.', fil: 'Ito ang panimulang lokasyon ng app (Metro Manila), hindi ang bukid ninyo. Lahat ng nakadepende sa lokasyon, kasama ang pagsikat at paglubog ng araw, ang oras ng pagbasa para sa andap, at ang oras ng pagkatuyo ng dahon, ay hindi tungkol sa lugar ninyo hangga\'t hindi ninyo ito itinatakda.' });
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
/* A save button on every answer. The record is built from the rendered box rather than from the spec,
   so whatever the farmer actually saw is what gets stored, labels and units included. */
function saveRecord(node, card) {
  const spec = node.__spec || {};
  const items = [];
  node.querySelectorAll('dl.nums dt').forEach((dt, i) => {
    const dd = node.querySelectorAll('dl.nums dd')[i];
    const label = (dt.querySelector('.en') || dt).textContent.trim();
    const value = dd ? (dd.querySelector('.en') || dd).textContent.trim() : '';
    if (label || value) items.push([label, value]);
  });
  const L = store.loc;
  store.log.push({ t: new Date().toISOString(), card: card,
    title: T.cards[card] ? T.cards[card].en : card,
    level: spec.level || '', verdict: spec.verdict ? spec.verdict.en : '',
    items: items, lat: L.lat, lon: L.lon, elev: L.elev, build: '__BUILD__' });
  if (store.log.length > LOG_MAX) store.log.splice(0, store.log.length - LOG_MAX);
  save();
}
function show(out, node) {
  out.appendChild(node);
  if (node.__spec && currentCard && T.cards[currentCard]) {
    const btn = el('button', { type: 'button', class: 'btn small save' }, bi(T.ui.saveReading));
    btn.addEventListener('click', () => {
      saveRecord(node, currentCard);
      btn.disabled = true; btn.innerHTML = ''; btn.appendChild(bi(T.ui.saved));
    });
    node.appendChild(btn);
  }
  try { node.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) {}
}
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
  box.__spec = spec;
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
    /* Crop water use for rice is banked so the rice card can split a measured loss into crop water
       use and the seepage-and-percolation remainder without asking the farmer to type it twice. */
    if (inp.crop === 'rice' && isFinite(dec.etc)) { store.riceEtc = { mm: dec.etc, d: today10() }; save(); }
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
    ['awd', { en: 'Safe AWD: you have an AWD tube (pani tube) and read it', fil: 'Safe AWD: may AWD tube (pani tube) sa bukid at binabasa mo ito' }],
    ['intermittent', { en: 'You let the field dry, with no AWD tube (pani tube)', fil: 'Hinahayaang matuyo ang bukid, walang AWD tube (pani tube)' }]
  ], prev.method || 'awd');
  const est = dateInput('est', { en: 'Date transplanted or sown', fil: 'Petsa ng lipat-tanim o sabog-tanim' }, prev.est, { optional: true });
  const EST_LABEL = {
    awd:  { en: 'Date transplanted or sown (to check whether it is time to start AWD)', fil: 'Petsa ng lipat-tanim o sabog-tanim (upang malaman kung panahon nang simulan ang AWD)' },
    cont: { en: 'Date transplanted or sown (to set the target depth: 3 cm early, 5 to 10 cm later)', fil: 'Petsa ng lipat-tanim o sabog-tanim (upang itakda ang dapat na lalim: 3 cm sa simula, 5 hanggang 10 cm pagkatapos)' }
  };
  const flower = dateInput('flower', { en: 'Expected flowering date (to keep the field flooded through flowering)', fil: 'Inaasahang petsa ng pamumulaklak (upang manatiling may tubig sa panahon ng pamumulaklak)' }, prev.flower, { optional: true });
  const harvest = dateInput('harvest', { en: 'Expected harvest date (to know when to drain before harvest)', fil: 'Inaasahang petsa ng ani (upang malaman kung kailan patutuyuin bago mag-ani)' }, prev.harvest, { optional: true });
  const soil = selectInput('rsoil', T.ui.soil, [['light', { en: 'Sandy or light', fil: 'Mabuhangin o magaan' }], ['clay', { en: 'Clay or heavy', fil: 'Luwad o mabigat' }]], prev.soil || 'clay');
  /* ONE measurement, on one datum. The AWD tube and a stick in the field read the same thing: where
     the water stands relative to the soil surface. Asking for it twice made the farmer discard the
     sign and type it again, so the card asks once and the sign carries the meaning. */
  const level = numInput('level', { en: 'Water level, cm', fil: 'Lalim ng tubig, cm' }, prev.level, 'any');
  const LEVEL_LABEL = {
    awd: { en: 'Water level in the AWD tube (pani tube), cm. Minus below the soil surface: -16 is 16 cm down. 0 is level with the soil. Plus is water standing on top: +5 is 5 cm.',
           fil: 'Lalim ng tubig sa AWD tube (pani tube), cm. Minus kung nasa ilalim ng lupa: -16 ay 16 cm pababa. 0 kung kapantay ng lupa. Plus kung may tubig sa ibabaw: +5 ay 5 cm.' },
    cont: { en: 'Water level in the field, cm, by stick or ruler. Plus is water standing on the soil: +5 is 5 cm. 0 is level with the soil. Minus if it has dried below the surface.',
            fil: 'Lalim ng tubig sa bukid, cm, sa patpat o ruler. Plus kung may tubig sa ibabaw ng lupa: +5 ay 5 cm. 0 kung kapantay ng lupa. Minus kung natuyo na sa ilalim ng lupa.' },
    int: { en: 'Water level in the field, cm (used only in the week either side of flowering). Plus is water on top, 0 is level with the soil, minus is below it.',
           fil: 'Lalim ng tubig sa bukid, cm (ginagamit lamang sa linggo bago at pagkatapos ng pamumulaklak). Plus kung may tubig sa ibabaw, 0 kung kapantay ng lupa, minus kung nasa ilalim.' }
  };
  const levelPrev = numInput('levelprev', { en: 'Your earlier reading at the same place, cm (same minus and plus)', fil: 'Ang naunang pagbasa sa parehong lugar, cm (parehong minus at plus)' }, prev.levelPrev, 'any', { optional: true });
  /* The two reading dates, not "how many days ago". They give the span without the farmer doing
     arithmetic, and they anchor the answer on when the tube was actually read rather than on the
     moment the button was pressed. Read at seven, entered at nine at night, and the old card was
     already out; a reading entered two days late was two days wrong. Span is the whole game besides:
     two readings a day apart give a rate of (fall +/- 1.4) cm/day, which dates nothing, while the
     same pair five days apart gives (fall/5 +/- 0.28). */
  const levelDate = dateInput('leveldate', { en: 'Date you took that reading', fil: 'Petsa ng pagbasa ngayon' }, prev.levelDate, { prefilled: true });
  const levelPrevDate = dateInput('levelprevdate', { en: 'Date of the earlier reading (the further back it is, the tighter the date below: wait until the water has fallen at least about 3 cm)', fil: 'Petsa ng naunang pagbasa (mas malayo ito, mas tiyak ang petsa sa ibaba: hintayin munang bumaba ang tubig nang hindi bababa sa mga 3 cm)' }, prev.levelPrevDate, { optional: true });
  /* Two thermometer readings are all FAO-56 needs to reach crop water use, and they are what a
     farmer actually has. Given only temperature, FAO-56 fills in humidity from Eq. 48, sunlight from
     Eq. 50 and wind from Table 4, and names each substitution in the answer. Without this the split
     was only available to someone who had already worked through the watering card. */
  const tmax = numInput('rtmax', { en: 'Afternoon high on the day of that reading, deg C (with the morning low, the card works out crop water use and can split your loss)', fil: 'Pinakamainit sa araw ng pagbasang iyon, deg C (kasama ang pinakamalamig sa umaga, matutuya ng card ang gamit na tubig ng pananim at mahahati ang pagbaba ng tubig)' }, prev.tmax, 0.1, { optional: true });
  const tmin = numInput('rtmin', { en: 'Morning low on that same day, deg C', fil: 'Pinakamalamig sa umaga ng araw na iyon, deg C' }, prev.tmin, 0.1, { optional: true });
  /* One optional number splits the measured loss into its parts. The watering card already prints it
     for rice, so it is carried across rather than asked for again when it is recent. */
  const banked = (store.riceEtc && isFinite(store.riceEtc.mm) && (Date.now() - new Date(store.riceEtc.d + 'T00:00:00')) / 86400000 <= 7) ? store.riceEtc : null;
  const etc = numInput('retc', { en: 'Crop water use, mm/day (only if you already have it from the watering card. Leave it blank and the two temperatures above are used instead)', fil: 'Gamit na tubig ng pananim, mm kada araw (kung mayroon ka na nito mula sa card ng pagpapatubig. Iwanang blangko at gagamitin ang dalawang temperatura sa itaas)' }, prev.etc != null ? prev.etc : (banked ? Math.round(banked.mm * 10) / 10 : null), 0.5, { optional: true });
  etc.input.min = 0;
  const weeds = checkInput('weeds', { en: 'Weeds are under control', fil: 'Kontrolado na ang damo' }, prev.weeds !== false);
  const season = selectInput('season', { en: 'Season', fil: 'Panahon' }, [['dry', { en: 'Dry season (tag-araw)', fil: 'Tag-araw' }], ['wet', { en: 'Wet season (tag-ulan)', fil: 'Tag-ulan' }], ['nodry', { en: 'My area has no dry season', fil: 'Walang tag-init sa lugar namin' }]], prev.season || 'dry');
  form.append(method.row, season.row, est.row, flower.row, harvest.row, soil.row, level.row, levelDate.row, levelPrev.row, levelPrevDate.row, tmax.row, tmin.row, etc.row, weeds.row, el('button', { type: 'submit', class: 'btn primary' }, bi(T.ui.compute)));
  /* What the card keeps, stated plainly. Forgetting was the only control here and it sat under the
     Answer button looking like the thing to press; remembering is what the card actually does. */
  const memo = el('div', { class: 'hint' });
  const clear = el('button', { type: 'button', class: 'btn' }, bi({ en: 'Forget this field\'s past readings', fil: 'Burahin ang mga naunang pagbasa sa bukid na ito' }));
  clear.addEventListener('click', () => {
    if (!confirm(t({ en: 'Forget every past reading from this field? The card will go back to using only the two readings you type in.', fil: 'Burahin lahat ng naunang pagbasa sa bukid na ito? Babalik ang card sa paggamit lamang ng dalawang pagbasang ita-type mo.' }).en)) return;
    store.riceField.rates.length = 0; store.riceField.refloods.length = 0; save(); syncForget();
  });
  const syncForget = () => {
    const n = store.riceField.rates.length, rf = store.riceField.refloods.length;
    memo.innerHTML = '';
    if (!n && !rf) {
      memo.append(bi({ en: 'This card remembers each pair of readings you give it, on this phone only. From them it works out your field\'s usual water loss and your usual gap between irrigations.',
                       fil: 'Naitatala ng card na ito ang bawat pares ng pagbasang ibibigay mo, sa telepono na ito lamang. Mula rito, matutuya ang karaniwang pagbaba ng tubig sa bukid mo at ang karaniwang agwat ng pagpapatubig.' }));
      return;
    }
    memo.append(bi({ en: 'Remembering ' + n + (n === 1 ? ' reading' : ' readings') + ' and ' + rf + (rf === 1 ? ' re-flood' : ' re-floods') + ' from this field, on this phone only.',
                     fil: 'Naitala: ' + n + ' pagbasa at ' + rf + ' pagpapatubig mula sa bukid na ito, sa telepono na ito lamang.' }), ' ', clear);
  };
  /* A row is shown only where the chosen method actually reads it. The pair of readings drives the
     date under safe AWD and under continuous flooding; without a tube there is no published
     threshold to project a date to, so the card does not ask for a second reading at all. */
  const syncMethod = () => {
    const m = method.input.value, awd = m === 'awd', cont = m === 'continuous';
    season.row.hidden = !awd;
    soil.row.hidden = cont;
    weeds.row.hidden = cont;
    levelPrev.row.hidden = !(awd || cont);
    levelDate.row.hidden = !(awd || cont);
    levelPrevDate.row.hidden = !(awd || cont);
    tmax.row.hidden = !(awd || cont); tmin.row.hidden = !(awd || cont);
    etc.row.hidden = !(awd || cont);
    level.row.replaceChild(bi(awd ? LEVEL_LABEL.awd : cont ? LEVEL_LABEL.cont : LEVEL_LABEL.int), level.row.firstChild);
    est.row.replaceChild(bi(cont ? EST_LABEL.cont : EST_LABEL.awd), est.row.firstChild);
  };
  method.input.addEventListener('change', syncMethod); syncMethod();
  const out = el('div'); root.append(form, memo, out); syncForget();
  function run() {
    const inp = { method: method.input.value, season: season.input.value, est: est.input.value, flower: flower.input.value, harvest: harvest.input.value,
                  soil: soil.input.value, level: num(level.input), levelPrev: num(levelPrev.input), levelDate: levelDate.input.value, levelPrevDate: levelPrevDate.input.value, tmax: num(tmax.input), tmin: num(tmin.input), etc: num(etc.input), weeds: weeds.input.checked };
    remember('rice', inp); out.innerHTML = '';
    const now = new Date(); const dd = s => s ? Math.round((new Date(s + 'T00:00:00') - now) / 86400000) : null;
    /* Everything downstream is measured from the reading, not from now. anchor is the day the tube
       was read; span is the gap between the two readings, in whole days. */
    const dayMs = 86400000, D = s => s ? new Date(s + 'T00:00:00') : null;
    const anchor = D(inp.levelDate) || new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00');
    const prevDate = D(inp.levelPrevDate);
    let span = null; const dateFlags = [];
    if (prevDate) {
      span = Math.round((anchor - prevDate) / dayMs);
      if (span <= 0) { dateFlags.push('reading_dates_out_of_order'); span = null; }
    } else if (inp.levelPrev != null) dateFlags.push('earlier_reading_date_missing');
    if (D(inp.levelDate) && (D(inp.levelDate) - new Date()) / dayMs > 1) dateFlags.push('reading_date_in_future');
    const F = riceFieldStats();
    const r = A.riceWaterDecision({ method: inp.method, daysAfterEstablish: inp.est ? -dd(inp.est) : null, daysToFlowering: dd(inp.flower), daysToHarvest: dd(inp.harvest),
      season: inp.season, levelCm: inp.level, levelPrevCm: span != null ? inp.levelPrev : null, daysBetween: span,
      fieldDropCmPerDay: F ? F.mean : null, fieldDropSigma: F ? F.sd : null, weedsManaged: inp.weeds, soil: inp.soil });
    /* The field only learns from a drawdown it actually measured. A rate carried over from its own
       history is not a new observation and must not be fed back in. */
    if (r.dropFrom === 'measured' && r.dropCmPerDay > 0) riceRecordRate(r.dropCmPerDay, r.daysBetween || 1, inp.levelDate);
    if (r.code === 'reflood_now') riceRecordReflood(inp.levelDate);
    syncForget();
    const level2 = { reflood_now: 'stop', flowering_top_up_to_5cm: 'stop', cf_flowering_top_up: 'stop', cf_top_up: 'stop', cf_too_deep: 'caution', drain_stop_irrigating: 'caution', cf_drain_now: 'caution', need_tube_reading: 'info', cf_need_depth: 'info', intermittent_no_threshold: 'info', before_awd_keep_shallow: 'caution' }[r.code] || 'go';
    const depthText = Array.isArray(r.targetCm) ? (r.targetCm[0] === r.targetCm[1] ? String(r.targetCm[0]) : r.targetCm[0] + ' to ' + r.targetCm[1]) : (r.targetCm != null ? String(r.targetCm) : '');
    const lines = [];
    /* The loss rate leads: it is the one number that decides when the farmer must act. */
    if (r.gainCm != null) lines.push([bi({ en: 'Net gain since your earlier reading', fil: 'Naidagdag mula sa naunang pagbasa' }), fmt(r.gainCm, 1) + ' cm: the water rose instead of falling']);
    if (r.dropCmPerDay != null) {
      const src = r.dropFrom === 'measured' ? ', from your two readings ' + fmt(r.fallCm, 1) + ' cm apart, ' + dmy(prevDate) + ' to ' + dmy(anchor) + ', ' + (r.daysBetween || 1) + (r.daysBetween === 1 ? ' day' : ' days') + ' apart'
                : r.dropFrom === 'field_average' ? ', this field\'s usual rate, because these two readings cannot give one'
                : ', the rate you entered';
      lines.push([bi({ en: 'Water loss', fil: 'Pagbaba ng tubig' }), fmt(r.dropCmPerDay, 1) + ' cm/day' + src]);
    }
    if (r.triggerCm) lines.push([bi({ en: 'Re-flood trigger', fil: 'Hudyat ng pagpapatubig' }), r.triggerCm + ' cm below the soil surface, then flood to about ' + (r.refloodCm || A.AWD.refloodCm) + ' cm above it']);
    /* The date, and the window the reading error puts around it. It is a planning aid: the decision
       is still the reading itself, and it holds only while no rain falls. */
    (r.projections || []).forEach(p => {
      const lab = p.which === 'irri' ? { en: 'Or, on IRRI safe AWD at ' + p.triggerCm + ' cm, irrigate on or before', fil: 'O, sa IRRI safe AWD na ' + p.triggerCm + ' cm, magpatubig sa o bago ang' }
                : p.which === 'cf' ? { en: 'Top up on or before', fil: 'Dagdagan ang tubig sa o bago ang' }
                : { en: 'Irrigate on or before', fil: 'Magpatubig sa o bago ang' };
      const on = n => dmy(new Date(anchor.getTime() + n * dayMs));
      const due = anchor.getTime() + p.days * dayMs;
      /* A date is always given, even far out. Withholding it left the farmer with nothing; the honest
         course is to print it and say what it rests on. Past a week that is a real assumption: the
         rate measured on one pair of days is being treated as this field's mean daily loss. Where the
         field has a history to lean on, the card says so instead, and says whether the two agree. */
      let far = '';
      if (p.beyondHorizon) {
        far = F && F.n >= 2
          ? '. That is more than a week out, so it leans on this field\'s own record: ' + F.n + ' measurements averaging ' + fmt(F.mean, 1) + ' cm/day, ranging ' + fmt(F.lo, 1) + ' to ' + fmt(F.hi, 1)
              + (r.dropFrom === 'measured' ? (Math.abs(r.dropCmPerDay - F.mean) <= (F.sd || 0) ? ', and today\'s ' + fmt(r.dropCmPerDay, 1) + ' sits inside that' : ', while today\'s ' + fmt(r.dropCmPerDay, 1) + ' sits outside it, so treat the date as the rougher of the two') : '')
          : '. That is more than a week out, and this field has no record yet, so the date assumes the ' + fmt(r.dropCmPerDay, 1) + ' cm/day you measured is your field\'s average water loss per day. Read again in a few days and it will tighten';
      }
      const val = due < Date.now() - dayMs ? 'already due: that date, ' + on(p.days) + ', has passed. Read the tube again now.'
                : on(p.days) + (p.lo != null ? ' (between ' + on(p.lo) + ' and ' + on(p.hi) + ', from the reading error)' : '') + ', if no rain falls' + far;
      lines.push([bi(lab), val]);
    });
    if (r.code === 'not_yet') lines.push([bi({ en: 'Still to go', fil: 'Natitira pa' }), fmt(r.remainingCm, 0) + ' cm before the trigger']);
    if (r.riseCm != null) lines.push([bi({ en: 'Water to add', fil: 'Tubig na idadagdag' }), 'raise it by about ' + fmt(r.riseCm, 0) + ' cm: ' + fmt(r.fromCm, 0) + ' cm up to the soil surface, then ' + r.refloodCm + ' cm above it']);
    if (r.shortCm != null) lines.push([bi({ en: 'Water to add', fil: 'Tubig na idadagdag' }), 'raise it by about ' + fmt(r.shortCm, 0) + ' cm']);
    if (r.drainDays) lines.push([bi({ en: 'Drain', fil: 'Patuyuin' }), Array.isArray(r.drainDays) ? r.drainDays[0] + ' to ' + r.drainDays[1] + ' days before harvest' : r.drainDays + ' days before harvest on ' + (inp.soil === 'clay' ? 'clay' : 'light soil')]);
    if (r.targetCm && Array.isArray(r.targetCm)) lines.push([bi({ en: 'Target depth now', fil: 'Dapat na lalim ngayon' }), depthText + ' cm above the soil']);
    /* What this field has told the card so far. Its own rate, its own interval: the traits of the
       field rather than of rice in general. */
    if (F) {
      lines.push([bi({ en: 'This field\'s usual loss', fil: 'Karaniwang pagbaba ng tubig sa bukid na ito' }),
        fmt(F.mean, 1) + ' cm/day, from ' + F.n + (F.n === 1 ? ' measurement' : ' measurements') + (F.n > 1 ? ' ranging ' + fmt(F.lo, 1) + ' to ' + fmt(F.hi, 1) + ' cm/day' : '')]);
    }
    /* The measured loss is crop water use plus seepage plus percolation. Give the watering card's
       crop water use and the remainder separates out, measured rather than modelled, and can be set
       beside the Philippine figures of Bouman et al. (1994). */
    /* Crop water use: what you already have from the watering card if you gave it, otherwise worked
       out here from the two temperatures. Kc follows the crop stage when the transplanting date is
       known and sits at the mid-season value when it is not, which is said rather than hidden. */
    let etcMm = inp.etc, etcNote = 'as you entered it', etoFlags = [];
    if (etcMm == null && inp.tmax != null && inp.tmin != null && inp.tmax >= inp.tmin) {
      const L2 = store.loc, e2 = A.eto({ Tmax: inp.tmax, Tmin: inp.tmin, lat: L2.lat, elev: L2.elev, J: todayJ(anchor), site: L2.site });
      if (!e2.error) {
        const k2 = A.cropKc('rice', { u2: e2.u2, Tmin: inp.tmin, Tmax: inp.tmax, riceHumidity: 'subhumid', riceWind: e2.u2 <= 1 ? 'light' : (e2.u2 >= 4 ? 'strong' : 'moderate') });
        const stages = A.CROPS.rice.stages[0].L, dae = inp.est ? -dd(inp.est) : null;
        const kcNow = dae != null ? A.kcOnDay(dae, stages, k2.kcIni, k2.kcMid, k2.kcEnd) : k2.kcMid;
        if (dae == null) etoFlags.push('rice_kc_stage_unknown');
        etcMm = e2.eto * kcNow;
        etcNote = 'ETo ' + fmt(e2.eto, 1) + ' mm from your two temperatures, times Kc ' + fmt(kcNow, 2) + ' for rice';
        etoFlags = etoFlags.concat(e2.flags || []);
      }
    }
    let sp = null;
    if (r.dropCmPerDay != null && etcMm != null && etcMm >= 0) {
      const etcCm = etcMm / 10;
      sp = A.spClassify(r.dropCmPerDay - etcCm);
      lines.push([bi({ en: 'Crop water use', fil: 'Gamit na tubig ng pananim' }), fmt(etcCm, 2) + ' cm/day (' + fmt(etcMm, 1) + ' mm), ' + etcNote]);
      lines.push([bi({ en: 'Seepage and percolation', fil: 'Tagas at tagimtim (seepage at percolation)' }), fmt(sp.spCm, 2) + ' cm/day, what is left of your measured loss after crop water use']);
      const band = sp.classes.length
        ? 'class ' + sp.classes.join(' or ') + ' (' + sp.match.map(c => c.what).join('; or ') + '), ' + sp.match.map(c => c.loCm + ' to ' + c.hiCm).join(' and ') + ' cm/day'
        : sp.flags.indexOf('sp_above_published') >= 0 ? 'above every band they measured, the highest of which reaches ' + A.SP.highestPublishedCm + ' cm/day'
        : sp.flags.indexOf('sp_negative') >= 0 ? 'below zero, which cannot happen: one of the two figures is wrong'
        : 'between their bands, which run 0 to 0.5 and then 1 to 1.5 cm/day';
      lines.push([bi({ en: 'Against Philippine paddies', fil: 'Kumpara sa palayan sa Pilipinas' }),
        'Bouman et al. (1994), measured at IRRI: ' + band + (sp.flags.indexOf('sp_negative') >= 0 ? '' : '. Their own four field readings were ' + A.SP.fieldMeasuredCmPerDay.join(', ') + ' cm/day, the lowest with the plow sole intact and the highest after it was damaged') + '.']);
    }
    const iv = riceInterval();
    if (iv) lines.push([bi({ en: 'Usual gap between irrigations', fil: 'Karaniwang agwat ng pagpapatubig' }), fmt(iv.days, 0) + ' days, from ' + iv.n + ' re-floods since ' + iv.first]);
    else if (store.riceField.refloods.length === 1) lines.push([bi({ en: 'Re-floods recorded', fil: 'Naitalang pagpapatubig' }), '1 so far. After the next one this card can give your usual gap between irrigations.']);
    if (r.tube) {
      lines.push([bi({ en: 'How to make an AWD tube (pani tube)', fil: 'Paano gumawa ng AWD tube (pani tube)' }),
        r.tube.lengthCm + ' cm of plastic pipe or bamboo, ' + r.tube.diameterCm[0] + ' to ' + r.tube.diameterCm[1] + ' cm across, hammered in so ' + r.tube.aboveSoilCm + ' cm stands above the soil (IRRI)']);
    }
    const whyByMethod = {
      continuous: ['Continuous flooding, as the IRRI Rice Knowledge Bank describes it: "After transplanting, water levels should be around 3 cm initially" and "gradually increase to 5-10 cm (with increasing plant height) and remain there until the field is drained". Keep 5 cm "at all times from heading to the end of flowering", and drain "7-10 days before harvest".',
        'The card measures the water on one datum, the soil surface, so a field that has dried below the surface reads as a minus and the top-up covers the whole distance back.'],
      intermittent: ['Safe AWD is defined by the AWD tube (pani tube). IRRI\'s fact sheet sets the re-flood depth by what the tube shows, and gives no depth for a field without one, so this app reports none rather than estimating one. Drying an unmonitored field risks taking the water table below the roots without the farmer seeing it.',
        'With no threshold there is nothing to project a date to, so this card does not ask for a second reading or report a loss rate under this method.',
        'What still holds whatever you do: keep the field flooded to 5 cm from one week before to one week after flowering, drain before harvest, and postpone drying for 2 to 3 weeks while weeds are uncontrolled (IRRI).']
    }[inp.method];
    const why = whyByMethod || ['DA Administrative Order 25-09 and the PhilRice observation well set the Philippine rule, and this card follows it: re-flood when the AWD tube (pani tube) shows 15 cm of water below the soil surface in the dry season and 20 cm in the wet. Flood back to about 5 cm above the surface. The water stays between those two marks. The card acts when the level reaches the trigger, not after it has passed it.',
      'One number describes the water, on one datum: the soil surface. A minus is centimetres below it, which is what the tube shows; 0 is level with the soil; a plus is water standing on top. At -16 cm in the dry season the card asks for 21 cm of water: 16 cm back up to the surface, then 5 cm above it.',
      'The date comes from your own two readings. The fall between them, divided by the days between them, is this field\'s loss: crop water use, percolation and seepage together, measured rather than modelled. This app assumes no percolation rate and no seepage rate, because no Philippine value it could cite exists for your field.',
      'Leave several days between the two readings. A reading off a hand-marked tube is good to about a centimetre, so a one-day pair gives a rate with an error of about 1.4 cm/day, and the date it produces can be out by days. The same pair five days apart cuts that error to about 0.3 cm/day. Averaging daily readings does not help: the daily falls telescope to the first and last reading, so span is the only thing that buys precision.',
      'The date assumes no rain and assumes the loss rate holds. It is a planning aid. The decision rule is still the reading itself: if the tube is at the trigger, irrigate, whatever date this card printed.',
      'The Philippines is not one season everywhere. PAGASA divides the country into four climate types (Climate Map of the Philippines 1951-2010, DOST-PAGASA CADS/IAAS CAD, August 2014). Type I has two pronounced seasons, dry from November to April. Type II has no dry season, with the heaviest rain from December to February. Type III has a dry season of only one to three months. Type IV has rainfall spread more or less evenly through the year and no dry season. Two of the four have no dry season at all. If yours is one of them, choose "My area has no dry season" and the card uses the dry-season depth, 15 cm, which re-floods earlier and is the smaller mistake. The Order does not say which depth applies where there is no dry season, so that choice is an assumption of this app.',
      'IRRI safe AWD uses 15 cm in every season, not 20. Re-flooding earlier than the DA depth is always allowed, and on light soils with a deep water table it is the safer error. In the wet season the card therefore gives two dates: the DA one at 20 cm, which is the policy, and the earlier IRRI one at 15 cm.',
      'Keep 5 cm of water from one week before to one week after flowering (IRRI, Bouman et al. 2007, PhilRice).',
      'Start AWD 21 to 30 days after transplanting or sowing, once weeds are managed (PhilRice; DA AO 25-09: 20 to 30 days).',
      'Stop irrigating one week before harvest on light soils and two weeks on clay (PhilRice PalayCheck).'];
    const flags = (r.flags || []).concat(sp ? sp.flags : []).concat(dateFlags).concat(etoFlags).filter(f => f !== 'no_tube_no_published_threshold').map(f => CODES[f]).filter(Boolean);
    const limits = ['Safe AWD assumes heavy soils with a shallow water table; on loamy and sandy soils with deep water tables, IRRI reports water savings above 50% but yield losses above 20% (Bouman et al. 2007).',
      'No percolation or seepage rate is assumed. Every loss figure here was measured in your field, not modelled, and none appears until you have given two readings or the field has a history. The published rates of Bouman et al. (1994) are used only to say which band your own measurement falls in.',
      'Those published rates were measured on ponded fields at IRRI. Once the water is below the soil surface, where it sits through most of an AWD cycle, their relation between percolation and ponded depth no longer applies directly, and this app does not carry it there.',
      'Splitting the loss needs the crop water use figure from the watering card, which is FAO-56 with the paddy rice crop coefficient. Those coefficients are derived for flooded paddy, so under AWD with no standing water the split is less certain than the total loss, which is measured.',
      'The field history is kept on this phone only. It is not sent anywhere, it is not backed up, and it goes if browsing data is cleared.',
      'Reading windows that overlap share the same measurements, so a field average built from many overlapping pairs is a little firmer-looking than it really is. The date on any one day is taken from that day\'s own pair wherever there is one, not from the average.'];
    show(out, result({ level: level2, verdict: t(T.verdicts[r.code], { trig: r.triggerCm, depth: depthText, lo: r.targetCm && r.targetCm[0], hi: r.targetCm && r.targetCm[1] }), lines, why, flags,
      assumptions: ['The field tube is 25 to 30 cm long, perforated, buried with 15 cm below the soil (IRRI), at a representative spot, and both readings are taken at the same place.',
        'Read at the same hour on both days, in the morning before you add any water. Water use runs with the sun, so a reading at seven and one at five in the afternoon are not one day apart in the way this calculation needs.',
        'Any date assumes the loss rate you measured keeps up. Bouman et al. (1994) found that a constant rate is sound where the plow sole is intact or the subsoil is what limits percolation, and that it is not where a permeable plow sole sits over a permeable subsoil: there percolation follows the depth of water standing on the field, and their own fixed-rate book-keeping drifted 2 to 3 cm. Crop water use also rises with the canopy and falls after flowering. Where the rate slows, this card names a date earlier than the water arrives, which is the safer error.',
        'A reading is taken as good to about one centimetre. That figure sets the width of the date window and is an assumption of this app, not a published value.'],
      limits, sources: r.sources }));
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
    const limits = ['Yoshida\'s rice thresholds are daily mean temperatures (germination excepted); this card compares them with the afternoon high and the morning low, so it flags stress earlier than a daily-mean test would. The anthesis heat line is the exception: it rests on afternoon temperatures at flowering (Satake and Yoshida 1978; Jagadish et al. 2007).', 'Thresholds are air temperatures; plant tissue can be warmer under water stress or cooler when well watered (Hatfield et al. 2011).', 'Duration matters: many studies used exposure of one hour to several days; a single afternoon reading is an indicator, not a damage estimate.', 'No yield loss is predicted.', 'This card does not say what to do when a threshold is crossed, because no published work ties a management response to a threshold under Philippine conditions. The nearest Philippine evidence is the shade-net crop shelter tested at Benguet State University under DOST-PCAARRD (Malamug 2018) and protected cultivation of lettuce under chilling in Benguet (Basquial et al. 2021); neither is tied to a temperature trigger. Follow DA and your local agriculturist.'];
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
  /* This card prints sunrise, the reading window and the drying window, all of which come from the
     coordinates. Without the block a farmer on the app's starting location gets someone else's times
     with nothing on screen saying so, and the clock warnings never appear either. Elevation is not used
     here; the block is the app's shared location rather than this card's own input. */
  form.appendChild(locationBlock(() => { if (out.childElementCount) run(); }));
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
    /* Built here, rendered last. A forecast does not depend on when the thermometer was read, so it must
       survive the reading-time gate below, which returns early. But it must never lead: this card exists to
       say that a reading from your own field beats a row covering a whole forecast area, and the order the
       answers appear in is that argument. Local first, PAGASA underneath it. */
    let lwPanel = null;
    if (inp.lwLo != null || inp.lwHi != null) {
      const lwr = A.leafWetnessReport(inp.lwLo, inp.lwHi);
      lwPanel = result({ level: 'info', verdict: t(T.verdicts[lwr.code], { lo: fmt(inp.lwLo, 1), hi: fmt(inp.lwHi, 1), blo: A.BLAST_WET.germLoH, bhi: A.BLAST_WET.germHiH,
          /* A range starting below the germination figure is not one piece of news: the dry end of the
             area is fine and the wet end is not. The headline says which end it is talking about. */
          news: { good: 'Good news', somewhat_bad: 'Somewhat bad news', bad: 'Bad news', somewhat_worse: 'Somewhat worse news', worse: 'Worse news', worst: 'Worst news' }[lwr.newsLevel],
          newsF: { good: 'Magandang balita', somewhat_bad: 'Medyo hindi magandang balita', bad: 'Masamang balita', somewhat_worse: 'Medyo mas masamang balita', worse: 'Mas masamang balita', worst: 'Pinakamasamang balita' }[lwr.newsLevel],
          scope: lwr.straddlesBlast ? ' for the wetter parts of your area' : '',
          scopeF: lwr.straddlesBlast ? ' para sa mas basang bahagi ng inyong lugar' : '', rlo: fmt(A.DEW_RICE_LB.nightLoH, 1), rhi: fmt(A.DEW_RICE_LB.nightHiH, 1) }),
        lines: lwr.straddlesBlast ? [[bi({ en: 'Your area is split', fil: 'Hati ang inyong lugar' }),
          bi({ en: 'The drier parts stay under ' + A.BLAST_WET.germLoH + ' h, but the wetter parts reach ' + fmt(inp.lwHi, 1) + ' h. Which one your own field is, only you can say.',
            fil: 'Ang mas tuyong bahagi ay wala pang ' + A.BLAST_WET.germLoH + ' oras, ngunit ang mas basang bahagi ay umaabot sa ' + fmt(inp.lwHi, 1) + ' oras. Kung alin doon ang bukid ninyo, kayo lamang ang makapagsasabi.' })]] : null,
        why: ['Leaf wetness hours count how much of the day free water sits on the leaf surface, from dew, rain or irrigation. It matters because fungi and bacteria need the leaf wet to germinate and get inside it, so the same weather that wets the crop for two hours and for twelve are not the same weather at all.',
          'This is PAGASA\'s own figure from the daily Farm Weather Forecast, reported back to you exactly as published. The app does not recompute it or convert it.',
          'The column is published as a range across a whole forecast area, in the same way the temperature and humidity columns beside it are. The low figure and the high figure describe different places inside that area, not the start and end of one night.',
          '<table class="wet"><caption>Germination is the first step, not infection itself, and blast is the only disease in this app\'s range with a published wetness figure. Other diseases also need the leaf wet, but their hours are not established for Philippine conditions, so no risk level is attached to any row.</caption><tr><th>Hours the leaves stay wet</th><th>What is published about it</th></tr><tr><td>under 6 h</td><td>Short of what rice blast spores need. Jackson (2017): "the leaves need to be wet for 6-8 hours for spore germination".</td></tr><tr><td>6 to 8 h</td><td>Long enough for rice blast spores to germinate, with 24 to 28 &deg;C favourable and humidity close to 100% needed for infection (Jackson 2017).</td></tr><tr><td>9 to 12.8 h</td><td>What was actually measured on a clear, calm, dewing night on lowland rice at Los Ba&ntilde;os, dry season (Luo and Goudriaan 2000). Past the blast germination figure for several hours.</td></tr><tr><td>over 12.8 h</td><td>Longer than dew alone gave on any night in that record. Something else is keeping the crop wet, usually rain or fog.</td></tr></table>',
          'The yardstick it is set against is the only measured dew duration from a Philippine rice field: Luo and Goudriaan (2000) watched the leaves every 15 minutes for 16 rain-free nights at IRRI Los Baños in the 1994 dry season and recorded 9.0 to 12.8 hours on heavy dew nights. That is what a clear, calm, dewing night on lowland paddy looks like, so it tells you whether the forecast spell is short or long. Cloud and wind cut dew short, which is why a cloudy night can forecast far fewer hours.'],
        limits: ['No disease risk is scored from these hours, and the table above is not a risk scale. It places the forecast beside two published figures and stops there.',
          'The blast figure is for spore germination, which is the first step in infection and not the same as a diseased crop. Whether infection follows depends on the spores being present, on humidity near 100%, on the variety, and on the crop stage.',
          'A forecast covers an area, not your field. Where PAGASA and this card differ, follow PAGASA.',
          'Leaf wetness hours and hours at or above 90% humidity are different quantities. Do not put these numbers in the Hutton boxes below.',
          'The measured yardstick is lowland paddy rice at one site in one dry season, on clear rain-free nights.'],
        sources: ['PAGASA_FWFA', 'LUO2000', 'PACIFICPESTS_BLAST'] });
    }
    /* Dew is a night question, so a reading taken while the air is still warming says nothing about it. */
    if (inp.T != null && inp.RH != null && !A.frostReadingUsable(nowH0, stT.sunset, stN.sunrise)) {
      show(out, result({ level: 'info',
        verdict: { en: 'Too early in the day to judge tonight.', fil: 'Masyadong maaga pa sa araw upang hatulan ang gabi.' },
        lines: [[bi({ en: 'Read again after', fil: 'Magbasa uli pagkatapos ng' }), hhmm0(((stT.sunset - A.FROST.readingBeforeSunsetH) % 24 + 24) % 24) + ' (sunset ' + hhmm0(stT.sunset) + ')']],
        why: ['Dew forms as the surface cools through the night. Until the air has begun cooling, a reading carries no information about tonight: the air will warm further, peak, and only then start falling.'],
        sources: ['FAO56', 'FAO_FROST'] }));
      if (lwPanel) show(out, lwPanel);
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
              bi({ en: 'If tonight is clear, calm, and rain-free like the nights this came from, the leaves should be dry by ' + hhmm0(stN.sunrise + R.afterSunriseHiH) + ' at the latest, possibly as early as ' + hhmm0(stN.sunrise + R.afterSunriseLoH) + '. This is your sunrise, ' + hhmm0(stN.sunrise) + ', plus the ' + R.afterSunriseLoH + ' to ' + R.afterSunriseHiH + ' hours dew lasted past sunrise on rice at IRRI Los Baños. Rain or fog would keep the leaves wet well past this, and the card cannot detect either. If PAGASA forecasts a longer wet spell, follow PAGASA: the ' + R.afterSunriseHiH + ' hours is only the longest measured at one site and is not realistic every time.'
                + (Math.abs(L0.lat) > 23.5 ? ' Those hours were measured in the tropics. At your latitude the morning sun climbs more slowly, so expect longer, not shorter.' : ''),
                fil: 'Kung maaliwalas, walang hangin, at walang ulan ngayong gabi tulad ng mga gabing pinagkunan nito, dapat tuyo na ang dahon nang hindi lalampas sa ' + hhmm0(stN.sunrise + R.afterSunriseHiH) + ', maaaring kasing-aga ng ' + hhmm0(stN.sunrise + R.afterSunriseLoH) + '. Ito ang pagsikat ng araw sa inyo, ' + hhmm0(stN.sunrise) + ', kasama ang ' + R.afterSunriseLoH + ' hanggang ' + R.afterSunriseHiH + ' oras na tinagal ng hamog pagkalipas ng pagsikat ng araw sa palayan sa IRRI Los Baños. Ang ulan o hamog ay magpapatagal pa nito nang husto, at hindi ito natutukoy ng card. Kung mas mahabang pagkabasa ang taya ng PAGASA, sundin ang PAGASA: ang ' + R.afterSunriseHiH + ' oras ay ang pinakamahabang nasukat sa iisang lugar lamang at hindi makatotohanan sa lahat ng pagkakataon.'
                + (Math.abs(L0.lat) > 23.5 ? ' Sinukat ang mga oras na iyon sa tropiko. Sa latitud ninyo ay mas mabagal sumikat ang araw, kaya asahang mas matagal, hindi mas maikli.' : '') }), 'key']);
            ls.push([bi({ en: 'Whole wet period measured there', fil: 'Buong haba ng pagkabasa roon' }),
              bi({ en: R.nightLoH.toFixed(1) + ' to ' + R.nightHiH.toFixed(1) + ' h, from when dew formed in the evening until it dried the next morning. The ' + R.afterSunriseLoH + ' to ' + R.afterSunriseHiH + ' hours after sunrise above are the tail end of it, not a separate thing. Measured on ' + R.nights + ' heavy dew nights at that one site, not calculated for your field.',
                fil: R.nightLoH.toFixed(1) + ' hanggang ' + R.nightHiH.toFixed(1) + ' oras, mula nang magsimula ang hamog kinagabihan hanggang sa matuyo ito kinabukasan. Ang ' + R.afterSunriseLoH + ' hanggang ' + R.afterSunriseHiH + ' oras pagkatapos sumikat ang araw sa itaas ay ang dulo nito, hindi hiwalay na bagay. Sinukat sa ' + R.nights + ' gabing malakas ang hamog sa iisang lugar, hindi kinalkula para sa bukid ninyo.' }), 'minor']);
          }
          return ls;
        })(),
        why: ['Dew forms when a surface cools to the dew point (FAO-56 definition; FAO frost manual). Clear, calm nights cool most.',
          'A reading taken before the air has begun cooling says nothing about the night, which is why the window opens two hours before sunset. Later is better inside that window: every hour you wait is an hour of cooling that has already happened and no longer has to be guessed at. The FAO frost manual takes its own readings two hours after sunset.', 'The question is about the morning, not the evening, because dew that forms early is close to universal on a clear, calm night and tells you little on its own. What decides infection is how long the leaves stay wet, and that period runs from the moment dew forms until the sun dries it, usually well into the morning. A night that leaves the crop wet at dawn is the one that matters.',
          'How long leaves stay wet after dawn has been measured on rice in this country. Luo and Goudriaan (2000) checked dew onset and drying every 15 minutes over 16 rain-free nights at IRRI Los Baños in the 1994 dry season, on IR72. Dew lasted 1.4 to 3.4 hours after sunrise, and the whole dew period on the top leaves ran 9.0 to 12.8 hours on heavy dew nights. Shielding the crop to cut the dew period short moved the drying time by only 0 to 2 hours, because what dries the leaves is the sun coming up, not when the dew began. So on a night that dews, expect the crop to still be wet for the first hours of the morning. Those figures are lowland paddy in the dry season at one site, and have not been repeated elsewhere in the Philippines.',
          'Wet leaves through the night favour fungal and bacterial disease generally. For rice, IRRI names this pattern for blast: it occurs "in areas with low soil moisture, frequent and prolonged periods of rain shower, and cool temperature in the daytime", and in upland rice "large day-night temperature differences that cause dew formation on leaves and overall cooler temperatures favor the development of the disease" (IRRI Rice Knowledge Bank). That is a description of the weather, not a threshold, so this card reports the dew and does not score blast risk.',
          'What IRRI gives for blast is management rather than a number: plant resistant varieties and ask your local agriculture office which ones are current; sow early, after the onset of the rainy season; split the nitrogen, because excessive fertiliser increases blast intensity; and flood the field as often as possible.'], limits: ['Hours of leaf wetness are not calculated for your own field. The RH ≥ 90% method needs humidity recorded right through the night, not one evening reading, and its threshold has to be fitted locally: Sentelhas et al. (2008) fitted 83, 85, 90 and 92% at four sites on turfgrass. No Philippine fit is published.', 'The drying time above is your own sunrise plus a range measured on rice at one lowland site in the 1994 dry season (Luo and Goudriaan 2000). Sunrise is calculated for your location; the rest is measurement from elsewhere, not a prediction for your field, crop or season.', 'The start of the wet period is not given, because no published method gets the moment dew forms from a single evening reading.'], sources: ['FAO56', 'FAO_FROST', 'SENTELHAS2008', 'LUO2000'] }));
    }
    if (lwPanel) show(out, lwPanel);
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
  root.appendChild(el('p', null, 'Engine tested with __ASSERTIONS__ numerical assertions against published worked examples (FAO-56 Examples 2 to 37, FAO Training Manual 3, the University of Arkansas EMC table, IRRI and PhilRice examples). Run node engine/test.js in the repository.'));
  root.appendChild(el('p', null, 'Author: Jef Zerrudo (DOST-PAGASA; Wageningen University & Research). Version __VERSION__, build __BUILD__. Licence: PolyForm Noncommercial 1.0.0. NOT OFFICIAL. NOT ENDORSED by FAO, IRRI, PhilRice, DA, PAGASA, GRDC or Queensland DAF.'));
  /* Saved readings. One row per number so the file opens straight into a chart in any spreadsheet:
     a variable-width row per reading would need the farmer to unpick it first. */
  root.appendChild(el('h3', null, bi(T.ui.savedTitle)));
  const logBox = el('div');
  root.appendChild(logBox);
  const csvEscape = v => '"' + String(v == null ? '' : v).split('"').join('""') + '"';
  function toCsv() {
    const head = ['saved_at', 'card', 'verdict', 'item', 'value', 'lat', 'lon', 'elev_m', 'build'];
    const rows = [head.join(',')];
    store.log.forEach(r => {
      const base = [r.t, r.title, r.verdict];
      const tail = [r.lat, r.lon, r.elev, r.build];
      if (!r.items || !r.items.length) rows.push(base.concat(['', '']).concat(tail).map(csvEscape).join(','));
      else r.items.forEach(it => rows.push(base.concat(it).concat(tail).map(csvEscape).join(',')));
    });
    return rows.join('\r\n');
  }
  function drawLog() {
    logBox.innerHTML = '';
    if (!store.log.length) { logBox.appendChild(el('p', { class: 'hint' }, bi(T.ui.savedNone))); return; }
    logBox.appendChild(el('p', { class: 'hint' }, store.log.length + ' ', bi(T.ui.savedCount)));
    const tb = el('table', { class: 'wet log' });
    tb.appendChild(el('tr', null, el('th', null, 'Date'), el('th', null, 'Card'), el('th', null, 'Answer')));
    store.log.slice().reverse().forEach(r => {
      tb.appendChild(el('tr', null,
        el('td', null, (r.t || '').slice(0, 16).replace('T', ' ')),
        el('td', null, r.title || r.card),
        el('td', null, r.verdict || '')));
    });
    logBox.appendChild(el('div', { class: 'tablewrap' }, tb));
    const dl = el('button', { type: 'button', class: 'btn small' }, bi(T.ui.csv));
    dl.addEventListener('click', () => {
      try {
        const blob = new Blob(['\ufeff' + toCsv()], { type: 'text/csv;charset=utf-8' });
        const a = el('a', { href: URL.createObjectURL(blob), download: 'agrikalkunahon-readings.csv' });
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      } catch (e) { alert('Could not save the file on this browser.'); }
    });
    const rm = el('button', { type: 'button', class: 'btn small danger' }, bi(T.ui.clearLog));
    rm.addEventListener('click', () => { if (confirm(t(T.ui.clearAsk).en)) { store.log.length = 0; save(); drawLog(); } });
    logBox.appendChild(el('p', null, dl, ' ', rm));
  }
  drawLog();
  root.appendChild(el('p', { class: 'warn' }, bi({
    en: 'Saved readings stay on this phone and are never sent anywhere. They are also not safe from being lost: clearing your browsing data deletes them, and an iPhone clears them after about a week of not opening the app. Download the CSV whenever the record matters to you.',
    fil: 'Ang mga naitalang pagbasa ay nananatili sa telepono na ito at hindi ipinapadala kahit saan. Hindi rin ito ligtas sa pagkawala: mabubura ito kapag nilinis ninyo ang browsing data, at buburahin ito ng iPhone pagkalipas ng mga isang linggong hindi pagbukas ng app. I-download ang CSV tuwing mahalaga sa inyo ang talaan.'
  })));
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
  rice:    { en: 'Read the AWD tube (pani tube) in the morning, before you add any water that day.', fil: 'Basahin ang AWD tube (pani tube) sa umaga, bago magdagdag ng tubig sa araw na iyon.' },
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
  water:   { en: 'A maximum and minimum thermometer, the kind that holds the highest and lowest reading until you reset it, kept in the shade. The high comes in the afternoon and the low just before sunrise, so it must run through the night as well as the day. A rain gauge. Your location, which the phone can fill in. With no thermometer, a phone weather app\'s high and low for the nearest town will serve as a rough stand-in, but it is a forecast for somewhere else: expect error, and more of it if that town sits at a different elevation.', fil: 'Isang max-min na termometro, iyong kayang humawak ng pinakamataas at pinakamababang reading hanggang sa i-reset mo ito, na nakalagay sa lilim. Ang pinakamataas na temperatura ay nangyayari sa hapon at ang pinakamababa bago sumikat ang araw, kaya dapat itong tumagal sa buong gabi pati na rin sa araw. Panukat ng ulan. Ang lokasyon ninyo, na kayang kunin ng smartphone. Kung walang termometro, puwedeng gamiting pahapyaw na panghalili ang mataas at mababang temperatura ng pinakamalapit na bayan sa weather app ng smartphone, ngunit taya iyon para sa ibang lugar: asahan ang pagkakamali, lalo na kung magkaiba ang taas ng lugar.' },
  rice:    { en: 'A stick or ruler to measure the water. An AWD tube (pani tube) as well, if you use safe AWD. No weather app can tell you the depth of water in your own field; this one has to be measured.', fil: 'Patpat o ruler na pansukat ng tubig. Tubo rin sa bukid, kung safe AWD ang ginagamit ninyo. Walang weather app na makapagsasabi ng lalim ng tubig sa bukid ninyo; kailangan itong sukatin mismo.' },
  rain:    { en: 'A rain gauge, read at the same hour each day and added up for the whole month. If you have none, PAGASA publishes monthly rainfall for its stations: use the nearest one, remembering that rainfall can differ a great deal between your field and a station some distance away. A phone weather app is a weaker fallback than the station record, because the rainfall it shows is an estimate for a wide area rather than what fell on your field.', fil: 'Sa panukat ng ulan (ulansukod), basahin sa parehong oras araw-araw at ipunin sa buong buwan. Kung wala kayo nito, naglalathala ang PAGASA ng buwanang ulan sa mga istasyon nito: gamitin ang pinakamalapit, ngunit tandaan na malaki ang maaaring pagkakaiba ng ulan sa bukid ninyo at sa istasyong malayo. Mas mahina ang weather app sa smartphone kaysa sa talaan ng istasyon, dahil tantiya lamang iyon para sa malawak na lugar at hindi ang tunay na bumagsak sa bukid ninyo.' },
  spray:   { en: 'A thermometer and a hygrometer, taken at the spot you will spray. A watch, and some way to judge the wind. Do not take the wind from a phone weather app: drift is decided by the wind in your field at boom height, not at a station kilometres away and ten metres up, and the label holds you to the conditions where you spray.', fil: 'Termometro at hygrometer, sa mismong lugar na sisprayan. Relo, at paraan ng pagtantiya ng hangin. Huwag kunin sa weather app ng smartphone ang hangin: ang pag-anod ng spray ay nakasalalay sa hangin sa mismong bukid ninyo sa taas ng boom, hindi sa istasyong ilang kilometro ang layo at sampung metro ang taas, at ang label ang panagot ninyo sa kondisyon kung saan kayo nagsi-spray.' },
  dry:     { en: 'A thermometer and a hygrometer, shaded from direct sun but standing in the air beside the drying area. A weighing scale. A moisture meter if you have one; otherwise your usual way of judging the grain. A phone weather app\'s humidity is measured somewhere else entirely and will not match your drying floor; use it only if you have nothing at all.', fil: 'Termometro at hygrometer, may silong mula sa tuwirang araw ngunit nasa hangin sa tabi ng patuyuan. Timbangan. Moisture meter kung meron; kung wala, ang nakasanayan ninyong paraan ng pagtingin sa butil. Ang humidity na ipinapakita ng weather app sa smartphone ay sinukat sa ibang lugar at hindi tutugma sa bilaran ninyo; gamitin lamang kung talagang wala kayong ibang paraan.' },
  stress:  { en: 'A maximum and minimum thermometer, the kind that holds the highest and lowest reading until you reset it, kept in the shade. The high comes in the afternoon and the low just before sunrise, so it must run through the night as well as the day. With none, a phone weather app\'s high and low for the nearest town will serve as a rough stand-in, but it is a forecast for somewhere else: expect error, and more of it if that town sits at a different elevation.', fil: 'Isang max-min na termometro, iyong kayang humawak ng pinakamataas at pinakamababang reading hanggang sa i-reset mo ito, na nakalagay sa lilim. Ang pinakamataas na temperatura ay nangyayari sa hapon at ang pinakamababa bago sumikat ang araw, kaya dapat itong tumagal sa buong gabi pati na rin sa araw. Kung wala nito, puwedeng gamiting pahapyaw na panghalili ang mataas at mababang temperatura ng pinakamalapit na bayan sa weather app ng smartphone, ngunit taya iyon para sa ibang lugar: asahan ang pagkakamali, lalo na kung magkaiba ang taas ng lugar.' },
  frost:   { en: 'A thermometer and a hygrometer, read outdoors away from walls, at about head height. If you have neither, a phone weather app for the nearest town can be used, but know which way it is wrong: cold air drains downhill and pools, so a field in a hollow gets colder than the town on a clear, calm night, and the app will read too warm. Treat its number as the warmest your field will be, not the coldest, and take a frost warning seriously even when the app looks safe.', fil: 'Basahin sa labas ang termometro at hygrometer na malayo sa pader, at mga kasintaas ng ulo. Kung wala kayo ng dalawa, puwedeng gamitin ang weather app ng smartphone para sa pinakamalapit na bayan, ngunit alamin kung saan ito nagkakamali: umaagos pababa at namumuo ang malamig na hangin, kaya mas lumalamig ang bukid sa lubak kaysa sa bayan kapag maaliwalas at walang hangin, at mas mainit ang ipapakita ng app. Ituring ninyong pinakamainit na posible ang bilang nito, hindi ang pinakamalamig, at seryosohin ang babala sa andap kahit mukhang ligtas sa app.' },
  disease: { en: 'A thermometer and a hygrometer, read outdoors near the crop in the evening. As with frost, a phone weather app is a poor substitute here, because dew depends on how your own field cools rather than on the town average. Use it only if you have nothing else.', fil: 'Basahin sa labas ang termometro at hygrometer malapit sa pananim kinagabihan. Tulad sa andap mahina ang weather app galing smartphone dito, dahil nakadepende ang hamog sa paglamig ng sarili ninyong bukid at hindi sa karaniwan ng bayan. Gamitin kung wala talaga.' },
  timing:  { en: 'Your planting or sowing dates, and a thermometer for a typical high and low. A phone weather app is acceptable here, because this card wants a typical value for the season rather than a particular day.', fil: 'Ang petsa ng pagtatanim o pagpupunla, at termometro para sa karaniwang mataas at mababa. Puwede ang weather app sa smartphone dito, dahil karaniwang halaga para sa panahon ang hinahanap ng card na ito at hindi ang isang tiyak na araw.' }
};

/* ---------- router ---------- */
const ORDER = ['water', 'rice', 'rain', 'spray', 'dry', 'stress', 'frost', 'disease', 'timing', 'sources', 'about', 'feedback'];
/* Card icons, inlined so the single-file app stays offline. 128 px WebP, trimmed to content
   and centred so every tile reads at the same visual size. Sources in cards_icons/. */
const ICON = {
  water: 'data:image/webp;base64,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',
  rice: 'data:image/webp;base64,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',
  rain: 'data:image/webp;base64,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',
  spray: 'data:image/webp;base64,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',
  dry: 'data:image/webp;base64,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',
  stress: 'data:image/webp;base64,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',
  frost: 'data:image/webp;base64,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',
  disease: 'data:image/webp;base64,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',
  timing: 'data:image/webp;base64,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',
  sources: 'data:image/webp;base64,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',
  about: 'data:image/webp;base64,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',
  feedback: 'data:image/webp;base64,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'
};
function renderHome(main) {
  main.innerHTML = '';
  main.appendChild(el('p', { class: 'lead' }, bi(T.tagline)));
  const grid = el('div', { class: 'grid' });
  ORDER.forEach(id => { grid.appendChild(el('a', { class: 'tile', href: '#/' + id }, el('span', { class: 'ico' }, el('img', { src: ICON[id], alt: '', width: 44, height: 44, decoding: 'async' })), bi(T.cards[id]))); });
  main.appendChild(grid);
  main.appendChild(el('p', { class: 'foot' }, 'Offline. Every answer shows its source. Decision aid, not a prescription. Build __BUILD__.'));
}
let currentCard = null;
function renderCard(main, id) {
  currentCard = id;
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
