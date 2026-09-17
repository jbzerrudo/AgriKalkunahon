/* =====================================================================
   AgriKalkunahon core - agricultural meteorology decision engine
   Every constant is traceable to a cited source. See REFS at bottom.
   Numbers only: this file returns codes, values and source ids;
   the interface turns codes into words (English and Filipino).
   Copyright 2026 Jef Zerrudo. PolyForm Noncommercial License 1.0.0
   ===================================================================== */
(function (root) {
'use strict';

const isNum = v => typeof v === 'number' && isFinite(v);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const rad = d => d * Math.PI / 180;
const round = (v, n) => { const f = Math.pow(10, n); return Math.round(v * f) / f; };

/* =====================================================================
   1. PSYCHROMETRICS AND ATMOSPHERE  (FAO-56 Chapter 3)           [FAO56]
   ===================================================================== */
/* Eq. 7  atmospheric pressure from elevation, kPa (ideal gas, 20 C standard atmosphere) */
function pressure(z) { return 101.3 * Math.pow((293 - 0.0065 * z) / 293, 5.26); }
/* Eq. 8  psychrometric constant, kPa/C  (lambda 2.45, cp 1.013e-3, eps 0.622 -> 0.665e-3) */
function gamma(P) { return 0.665e-3 * P; }
/* Eq. 11 saturation vapour pressure at T, kPa */
function es0(T) { return 0.6108 * Math.exp(17.27 * T / (T + 237.3)); }
/* Eq. 12 mean saturation vapour pressure of a day/period from Tmax and Tmin */
function esMean(Tmax, Tmin) { return (es0(Tmax) + es0(Tmin)) / 2; }
/* Eq. 13 slope of the saturation vapour pressure curve at T, kPa/C */
function slope(T) { return 4098 * es0(T) / Math.pow(T + 237.3, 2); }
/* Eq. 14 actual vapour pressure from dew point */
function eaFromTdew(Tdew) { return es0(Tdew); }
/* inverse of Eq. 11 (exact algebra): dew point from actual vapour pressure */
function tdewFromEa(ea) { const l = Math.log(ea / 0.6108); return 237.3 * l / (17.27 - l); }
/* Eq. 15, 16 actual vapour pressure from dry and wet bulb; apsy by ventilation type */
const APSY = { ventilated: 0.000662, natural: 0.000800, indoor: 0.001200 };
function eaFromWetBulb(Twet, Tdry, P, apsy) { return es0(Twet) - (apsy || APSY.ventilated) * P * (Tdry - Twet); }
/* Eq. 17, 18, 19 actual vapour pressure from relative humidity */
function eaFromRH(Tmin, Tmax, RHmax, RHmin) { return (es0(Tmin) * RHmax / 100 + es0(Tmax) * RHmin / 100) / 2; }
function eaFromRHmax(Tmin, RHmax) { return es0(Tmin) * RHmax / 100; }
function eaFromRHmean(Tmin, Tmax, RHmean) { return esMean(Tmax, Tmin) * RHmean / 100; }
/* Eq. 48 missing humidity: Tdew ~ Tmin (humid and subhumid climates; arid: subtract 2-3 C) */
function eaFromTmin(Tmin, aridOffset) { return es0(Tmin - (aridOffset || 0)); }
/* wet-bulb temperature by bisection on Eq. 15 (ventilated psychrometer constant) */
function wetBulb(T, RH, P, apsy) {
  if (!isNum(T) || !isNum(RH) || RH <= 0 || RH > 100) return NaN;
  const ea = es0(T) * RH / 100, a = apsy || APSY.ventilated;
  let lo = tdewFromEa(ea), hi = T;
  if (RH >= 100) return T;
  for (let i = 0; i < 60; i++) {
    const m = 0.5 * (lo + hi);
    const f = es0(m) - a * P * (T - m) - ea;
    if (f > 0) hi = m; else lo = m;
  }
  return 0.5 * (lo + hi);
}
function deltaT(T, RH, P) { return T - wetBulb(T, RH, P); }
function rhFromTdew(T, Tdew) { return 100 * es0(Tdew) / es0(T); }

/* =====================================================================
   2. RADIATION AND DAY LENGTH  (FAO-56 Chapter 3)                [FAO56]
   ===================================================================== */
const GSC = 0.0820;                 // solar constant, MJ m-2 min-1
const SIGMA = 4.903e-9;             // Stefan-Boltzmann, MJ K-4 m-2 day-1
const ALBEDO = 0.23;                // grass reference
const AS = 0.25, BS = 0.50;         // Angstrom, Eq. 35 defaults
const KRS = { interior: 0.16, coastal: 0.19 };   // Eq. 50
const MJ_TO_MM = 0.408;             // Eq. 20

function dayOfYear(y, m, d) {       // m 1..12 ; FAO-56 Annex 2 Table 2.5 counts 1 Jan = 1
  const a = Date.UTC(y, m - 1, d), b = Date.UTC(y, 0, 1);
  return Math.round((a - b) / 86400000) + 1;
}
function invRelDist(J) { return 1 + 0.033 * Math.cos(2 * Math.PI * J / 365); }          // Eq. 23
function declination(J) { return 0.409 * Math.sin(2 * Math.PI * J / 365 - 1.39); }      // Eq. 24
function sunsetAngle(phi, delta) {                                                         // Eq. 25
  const x = -Math.tan(phi) * Math.tan(delta);
  return Math.acos(clamp(x, -1, 1));
}
/* Eq. 21 extraterrestrial radiation, MJ m-2 day-1 */
function Ra(latDeg, J) {
  const phi = rad(latDeg), dr = invRelDist(J), d = declination(J), ws = sunsetAngle(phi, d);
  return 24 * 60 / Math.PI * GSC * dr * (ws * Math.sin(phi) * Math.sin(d) + Math.cos(phi) * Math.cos(d) * Math.sin(ws));
}
/* Eq. 34 daylight hours */
function daylight(latDeg, J) { return 24 / Math.PI * sunsetAngle(rad(latDeg), declination(J)); }
/* Eq. 35 solar radiation from sunshine hours */
function RsAngstrom(n, N, ra, as, bs) { return ((as == null ? AS : as) + (bs == null ? BS : bs) * n / N) * ra; }
/* Eq. 36 / 37 clear-sky radiation */
function Rso(z, ra, as, bs) { return (as != null && bs != null) ? (as + bs) * ra : (0.75 + 2e-5 * z) * ra; }
/* Eq. 38 net shortwave */
function Rns(rs) { return (1 - ALBEDO) * rs; }
/* Eq. 39 net longwave (Rs/Rso limited to 1) */
function Rnl(Tmax, Tmin, ea, rs, rso) {
  const r = clamp(rs / rso, 0, 1);
  return SIGMA * (Math.pow(Tmax + 273.16, 4) + Math.pow(Tmin + 273.16, 4)) / 2 * (0.34 - 0.14 * Math.sqrt(ea)) * (1.35 * r - 0.35);
}
/* Eq. 50 Hargreaves radiation formula; Eq. 51 island relation (monthly only, 0-100 m) */
function RsFromTemp(Tmax, Tmin, ra, kRs) { return (kRs || KRS.coastal) * Math.sqrt(Math.max(0, Tmax - Tmin)) * ra; }
function RsIsland(ra) { return 0.7 * ra - 4; }
/* Eq. 43, 44 monthly soil heat flux */
function Gmonth(Ti, Tprev, Tnext) { return isNum(Tnext) ? 0.07 * (Tnext - Tprev) : 0.14 * (Ti - Tprev); }
/* Eq. 47 wind at 2 m from height z */
function u2FromHeight(uz, z) { return z === 2 ? uz : uz * 4.87 / Math.log(67.8 * z - 5.42); }

/* Sunrise and sunset in local clock time from FAO-56 Eq. 31-33 (Lz, Lm in degrees WEST of Greenwich).
   For the Philippines Lz = 240 (UTC+8) and Lm = 360 - longitude(E). Returns hours, decimal. */
function seasonalCorrection(J) {
  const b = 2 * Math.PI * (J - 81) / 364;                                                    // Eq. 33
  return 0.1645 * Math.sin(2 * b) - 0.1255 * Math.cos(b) - 0.025 * Math.sin(b);              // Eq. 32
}
function sunTimes(latDeg, lonEastDeg, J, utcOffsetHours) {
  const Lz = (360 - 15 * (utcOffsetHours == null ? 8 : utcOffsetHours)) % 360;
  const Lm = (360 - lonEastDeg) % 360;
  const ws = sunsetAngle(rad(latDeg), declination(J));
  const Sc = seasonalCorrection(J);
  const noon = 12 - 0.06667 * (Lz - Lm) - Sc;            // omega = 0 (Eq. 31 solved for t)
  const half = ws * 12 / Math.PI;
  return { sunrise: noon - half, sunset: noon + half, noon: noon, daylight: 2 * half };
}

/* =====================================================================
   3. REFERENCE EVAPOTRANSPIRATION  (FAO-56 Chapter 4)             [FAO56]
   ===================================================================== */
/* Eq. 6 FAO Penman-Monteith, daily or monthly means. All inputs already resolved. */
function etoPM(Tmax, Tmin, ea, Rn, G, u2, z) {
  const T = (Tmax + Tmin) / 2, D = slope(T), g = gamma(pressure(z)), es = esMean(Tmax, Tmin);
  const u = Math.max(u2, 0.5);      // FAO-56: "u2 should be limited to about u2 >= 0.5 m/s"
  return (0.408 * D * (Rn - G) + g * 900 / (T + 273) * u * (es - ea)) / (D + g * (1 + 0.34 * u));
}
/* Eq. 52 Hargreaves (Ra in MJ m-2 day-1 here; converted to mm inside) */
function etoHargreaves(Tmax, Tmin, ra) { return 0.0023 * ((Tmax + Tmin) / 2 + 17.8) * Math.sqrt(Math.max(0, Tmax - Tmin)) * MJ_TO_MM * ra; }

/* Resolve inputs with FAO-56's documented fallbacks and compute ETo.
   inp: { Tmax, Tmin, lat, elev, J, [RHmax, RHmin, RHmean, Tdew, Twet, ea], [u2 | uz+zWind], [Rs | n],
          site: 'coastal'|'interior'|'island', monthly: bool, Tprev, Tnext, arid: bool }
   Returns numbers, fallback codes and flags. */
function eto(inp) {
  const f = [], flags = [];
  const Tmax = inp.Tmax, Tmin = inp.Tmin;
  if (!isNum(Tmax) || !isNum(Tmin)) return { error: 'need_tmax_tmin' };
  if (Tmax < Tmin) return { error: 'tmax_below_tmin' };
  /* Ra needs both, and rad(undefined) is NaN, which used to travel all the way out inside a fully
     populated result object: a caller testing for the absence of an error would proceed with it. */
  if (!isNum(inp.lat) || !isNum(inp.J)) return { error: 'need_lat_and_day_of_year' };
  const z = isNum(inp.elev) ? inp.elev : 0, P = pressure(z);
  // humidity
  let ea, eaMethod;
  if (isNum(inp.ea)) { ea = inp.ea; eaMethod = 'ea_given'; }
  else if (isNum(inp.Tdew)) { ea = eaFromTdew(inp.Tdew); eaMethod = 'eq14_tdew'; }
  else if (isNum(inp.Twet) && isNum(inp.Tdry)) { ea = eaFromWetBulb(inp.Twet, inp.Tdry, P, inp.apsy); eaMethod = 'eq15_wetbulb'; }
  else if (isNum(inp.RHmax) && isNum(inp.RHmin)) { ea = eaFromRH(Tmin, Tmax, inp.RHmax, inp.RHmin); eaMethod = 'eq17_rhmaxmin'; }
  else if (isNum(inp.RHmax)) { ea = eaFromRHmax(Tmin, inp.RHmax); eaMethod = 'eq18_rhmax'; }
  else if (isNum(inp.RHmean)) { ea = eaFromRHmean(Tmin, Tmax, inp.RHmean); eaMethod = 'eq19_rhmean'; flags.push('eq19_less_desirable'); }
  else { ea = eaFromTmin(Tmin, inp.arid ? 2 : 0); eaMethod = 'eq48_tdew_eq_tmin'; f.push('humidity_from_tmin'); }
  const es = esMean(Tmax, Tmin);
  if (ea > es) { ea = es; flags.push('ea_capped_at_es'); }
  // radiation
  const ra = Ra(inp.lat, inp.J), N = daylight(inp.lat, inp.J);
  let rs, rsMethod;
  const rso = Rso(z, ra);
  if (isNum(inp.Rs)) { rs = inp.Rs; rsMethod = 'rs_measured'; }
  else if (isNum(inp.n)) {
    // Sunshine cannot be negative, nor exceed the daylight hours N. Clamping is right, but say so:
    // every other clamp in this function reports itself, and a farmer who typed minutes instead of
    // hours should not get an answer quietly computed from a different number.
    if (inp.n < 0 || inp.n > N) flags.push('sunshine_clamped_0_N');
    rs = RsAngstrom(clamp(inp.n, 0, N), N, ra); rsMethod = 'eq35_sunshine';
  }
  else if (inp.site === 'island') {
    rs = RsIsland(ra); rsMethod = 'eq51_island'; f.push('radiation_island_monthly');
    if (!inp.monthly) flags.push('eq51_monthly_only');
    if (z > 100) flags.push('eq51_altitude_limit');
  } else {
    const k = inp.site === 'interior' ? KRS.interior : KRS.coastal;
    rs = RsFromTemp(Tmax, Tmin, ra, k); rsMethod = 'eq50_temperature_range'; f.push('radiation_from_temperature');
    if (!inp.monthly) flags.push('eq50_average_over_days');
  }
  if (rs > rso) { rs = rso; flags.push('rs_capped_at_rso'); }
  const rns = Rns(rs), rnl = Rnl(Tmax, Tmin, ea, rs, rso), rn = rns - rnl;
  // soil heat flux
  let G = 0;
  if (inp.monthly && isNum(inp.Tprev)) G = Gmonth((Tmax + Tmin) / 2, inp.Tprev, inp.Tnext);
  // wind
  let u2, windMethod;
  if (isNum(inp.u2)) { u2 = inp.u2; windMethod = 'u2_given'; }
  else if (isNum(inp.uz) && isNum(inp.zWind)) { u2 = u2FromHeight(inp.uz, inp.zWind); windMethod = 'eq47_height_adjusted'; }
  else { u2 = 2.0; windMethod = 'table4_default_2ms'; f.push('wind_default_2ms'); }
  if (u2 < 0.5) flags.push('u2_floor_0_5');
  const value = etoPM(Tmax, Tmin, ea, rn, G, u2, z);
  const harg = etoHargreaves(Tmax, Tmin, ra);
  return {
    eto: value, hargreaves: harg, P: P, ea: ea, es: es, ra: ra, N: N, rs: rs, rso: rso, rns: rns, rnl: rnl, rn: rn, G: G, u2: u2,
    methods: { ea: eaMethod, rs: rsMethod, wind: windMethod }, fallbacks: f, flags: flags,
    // FAO-56 Example 20 sensitivity of the wind default: about -7% at 1 m/s, +6% at 3 m/s
    windSensitivity: windMethod === 'table4_default_2ms' ? { u1: etoPM(Tmax, Tmin, ea, rn, G, 1, z), u3: etoPM(Tmax, Tmin, ea, rn, G, 3, z) } : null,
    sources: ['FAO56']
  };
}

/* =====================================================================
   4. CROPS: Kc, HEIGHT, ROOTING, STAGE LENGTHS (FAO-56 Tables 11, 12, 14, 22)   [FAO56]
   kcEnd may be a two-value range as printed: [first, second]; the first is the default.
   stages: [Lini, Ldev, Lmid, Llate] with the region FAO-56 prints. Vegetables carry
   stage rows as examples only (decision 8: farmers enter their own dates).
   ===================================================================== */
const CROPS = {
  rice:        { kcIni: 1.05, kcMid: 1.20, kcEnd: [0.90, 0.60], h: 1.0, zr: [0.5, 1.0], p: 0.20, pNote: 'of saturation', group: 'i. Cereals',
                 stages: [{ L: [30, 30, 60, 30], plant: 'Dec; May', region: 'Tropics; Mediterranean' }, { L: [30, 30, 80, 40], plant: 'May', region: 'Tropics' }] },
  maize:       { kcIni: 0.3, kcMid: 1.20, kcEnd: [0.60, 0.35], kcEndNote: 'fn11', h: 2.0, zr: [1.0, 1.7], p: 0.55, group: 'i. Cereals', kcIniGroup: true,
                 stages: [{ L: [20, 35, 40, 30], plant: 'June', region: 'Nigeria (humid)' }, { L: [30, 50, 60, 40], plant: 'April', region: 'East Africa (alt.)' }, { L: [25, 40, 45, 30], plant: 'Dec/Jan', region: 'Arid Climate' }] },
  sweetcorn:   { kcIni: 0.3, kcMid: 1.15, kcEnd: [1.05], kcEndNote: 'fn12', h: 1.5, zr: [0.8, 1.2], p: 0.50, group: 'i. Cereals', kcIniGroup: true,
                 stages: [{ L: [20, 20, 30, 10], plant: 'March', region: 'Philippines' }, { L: [20, 25, 25, 10], plant: 'May/June', region: 'Mediterranean' }] },
  sugarcane:   { kcIni: 0.40, kcMid: 1.25, kcEnd: [0.75], h: 3.0, zr: [1.2, 2.0], p: 0.65, group: 'k. Sugar Cane',
                 stages: [{ L: [35, 60, 190, 120], plant: '', region: 'Low Latitudes (virgin)' }, { L: [50, 70, 220, 140], plant: '', region: 'Tropics (virgin)' }, { L: [25, 70, 135, 50], plant: '', region: 'Low Latitudes (ratoon)' }, { L: [30, 50, 180, 60], plant: '', region: 'Tropics (ratoon)' }] },
  banana1:     { kcIni: 0.50, kcMid: 1.10, kcEnd: [1.00], h: 3.0, zr: [0.5, 0.9], p: 0.35, group: 'l. Tropical Fruits and Trees',
                 stages: [{ L: [120, 90, 120, 60], plant: 'Mar', region: 'Mediterranean' }] },
  banana2:     { kcIni: 1.00, kcMid: 1.20, kcEnd: [1.10], h: 4.0, zr: [0.5, 0.9], p: 0.35, group: 'l. Tropical Fruits and Trees',
                 stages: [{ L: [120, 60, 180, 5], plant: 'Feb', region: 'Mediterranean' }] },
  palm:        { kcIni: 0.95, kcMid: 1.00, kcEnd: [1.00], h: 8.0, zr: [0.7, 1.1], p: 0.65, group: 'l. Tropical Fruits and Trees', stages: [] },
  broccoli:    { kcIni: 0.7, kcMid: 1.05, kcEnd: [0.95], h: 0.3, zr: [0.4, 0.6], p: 0.45, group: 'a. Small Vegetables', kcIniGroup: true, stages: [{ L: [35, 45, 40, 15], plant: 'Sept', region: 'Calif. Desert, USA' }] },
  cabbage:     { kcIni: 0.7, kcMid: 1.05, kcEnd: [0.95], h: 0.4, zr: [0.5, 0.8], p: 0.45, group: 'a. Small Vegetables', kcIniGroup: true, stages: [{ L: [40, 60, 50, 15], plant: 'Sept', region: 'Calif. Desert, USA' }] },
  carrot:      { kcIni: 0.7, kcMid: 1.05, kcEnd: [0.95], h: 0.3, zr: [0.5, 1.0], p: 0.35, group: 'a. Small Vegetables', kcIniGroup: true, stages: [{ L: [30, 40, 60, 20], plant: 'Feb/Mar', region: 'Mediterranean' }] },
  cauliflower: { kcIni: 0.7, kcMid: 1.05, kcEnd: [0.95], h: 0.4, zr: [0.4, 0.7], p: 0.45, group: 'a. Small Vegetables', kcIniGroup: true, stages: [{ L: [35, 50, 40, 15], plant: 'Sept', region: 'Calif. Desert, USA' }] },
  lettuce:     { kcIni: 0.7, kcMid: 1.00, kcEnd: [0.95], h: 0.3, zr: [0.3, 0.5], p: 0.30, group: 'a. Small Vegetables', kcIniGroup: true, stages: [{ L: [20, 30, 15, 10], plant: 'April', region: 'Mediterranean' }] },
  tomato:      { kcIni: 0.6, kcMid: 1.15, kcEnd: [0.70, 0.90], kcMidNote: 'fn2', h: 0.6, zr: [0.7, 1.5], p: 0.40, group: 'b. Solanaceae', kcIniGroup: true, stages: [{ L: [30, 40, 45, 30], plant: 'April/May', region: 'Mediterranean' }] },
  pepper:      { kcIni: 0.6, kcMid: 1.05, kcEnd: [0.90], kcMidNote: 'fn2', h: 0.7, zr: [0.5, 1.0], p: 0.30, group: 'b. Solanaceae', kcIniGroup: true, stages: [{ L: [25, 35, 40, 20], plant: 'April/June', region: 'Europe and Medit. (Lini printed 25/30; first value used)' }] },
  potato:      { kcIni: 0.5, kcMid: 1.15, kcEnd: [0.75], kcEndNote: 'fn4', h: 0.6, zr: [0.4, 0.6], p: 0.35, group: 'd. Roots and Tubers', kcIniGroup: true, stages: [{ L: [30, 35, 50, 30], plant: 'April', region: 'Europe' }] },
  strawberry:  { kcIni: 0.40, kcMid: 0.85, kcEnd: [0.75], h: 0.2, zr: [0.2, 0.3], p: 0.20, group: 'f. Perennial Vegetables', stages: [] },
  beans_green: { kcIni: 0.5, kcMid: 1.05, kcEnd: [0.90], kcMidNote: 'fn2', h: 0.4, zr: [0.5, 0.7], p: 0.45, group: 'e. Legumes', stages: [{ L: [15, 25, 25, 10], plant: 'Aug/Sep', region: 'Calif., Egypt, Lebanon' }] }
};
/* Table 14: Kc ini for paddy rice by humidity and wind class */
const RICE_KC_INI = { arid: { light: 1.10, moderate: 1.15, strong: 1.20 }, subhumid: { light: 1.05, moderate: 1.10, strong: 1.15 }, veryhumid: { light: 1.00, moderate: 1.05, strong: 1.10 } };
/* Table 16: RHmin typical of climate classes (used only when RHmin cannot be estimated) */
const RHMIN_CLASS = { arid: 20, semiarid: 30, subhumid: 45, humid: 70, veryhumid: 80 };
/* Table 15 / Table 4 representative wind speeds for the classes */
const WIND_CLASS_MS = { light: 1.0, lightmoderate: 2.0, moderatestrong: 4.0, strong: 5.0 };

/* Eq. 64 RHmin estimated from Tmin (as Tdew) and Tmax */
function rhMinFromTemps(Tmin, Tmax, aridOffset) { return 100 * es0(Tmin - (aridOffset || 0)) / es0(Tmax); }
/* Eq. 62 / 65 climate adjustment. Returns adjusted Kc and the clamp flags. */
function kcAdjust(kcTab, u2, RHmin, h, isEnd) {
  const flags = [];
  if (isEnd && kcTab < 0.45) return { kc: kcTab, flags: ['kc_end_below_0_45_no_adjust'] };
  if (h < 0.1) return { kc: kcTab, flags: ['h_below_0_1_no_adjust'] };
  let u = u2, r = RHmin, hh = h;
  if (u < 1 || u > 6) { u = clamp(u, 1, 6); flags.push('u2_clamped_1_6'); }
  if (r < 20 || r > 80) { r = clamp(r, 20, 80); flags.push('rhmin_clamped_20_80'); }
  if (hh > 10) { hh = 10; flags.push('h_clamped_10'); }
  return { kc: kcTab + (0.04 * (u - 2) - 0.004 * (r - 45)) * Math.pow(hh / 3, 0.3), flags: flags };
}
/* Eq. 66 Kc on day i (1-based) of the season for stage lengths L = [Lini, Ldev, Lmid, Llate] */
function kcOnDay(i, L, kIni, kMid, kEnd) {
  const [a, b, c, d] = L;
  if (i <= a) return kIni;
  if (i <= a + b) return kIni + (i - a) / b * (kMid - kIni);
  if (i <= a + b + c) return kMid;
  if (i <= a + b + c + d) return kMid + (i - (a + b + c)) / d * (kEnd - kMid);
  return kEnd;
}
function stageOnDay(i, L) {
  const [a, b, c, d] = L;
  if (i <= a) return 'initial'; if (i <= a + b) return 'development'; if (i <= a + b + c) return 'mid'; if (i <= a + b + c + d) return 'late'; return 'after';
}
/* Build the three Kc values for a crop under the site climate. opts: {u2, RHmin, Tmin, Tmax, riceHumidity, riceWind, kcEndChoice} */
function cropKc(cropId, opts) {
  const c = CROPS[cropId]; if (!c) return { error: 'unknown_crop' };
  const o = opts || {};
  const u2 = isNum(o.u2) ? o.u2 : 2.0;
  let RHmin = isNum(o.RHmin) ? o.RHmin : (isNum(o.Tmin) && isNum(o.Tmax) ? rhMinFromTemps(o.Tmin, o.Tmax) : 45);
  const flags = [];
  if (!isNum(o.RHmin) && !(isNum(o.Tmin) && isNum(o.Tmax))) flags.push('rhmin_default_45');
  let kIni = c.kcIni;
  if (cropId === 'rice') {
    /* FAO-56 Table 14 labels this row "Sub-humid - Humid", and 'humid' is a valid key of RHMIN_CLASS,
       so a caller passing it was reading the same table. It used to throw. An unrecognised class is
       reported rather than silently defaulted. */
    const hum = o.riceHumidity === 'humid' ? 'subhumid' : (o.riceHumidity || 'subhumid');
    const wnd = o.riceWind || 'moderate';
    if (!RICE_KC_INI[hum] || RICE_KC_INI[hum][wnd] == null) return { error: 'unknown_rice_kc_class' };
    kIni = RICE_KC_INI[hum][wnd];
  }
  else if (c.kcIniGroup) flags.push('kc_ini_is_group_value');
  const mid = kcAdjust(c.kcMid, u2, RHmin, c.h, false);
  const endTab = c.kcEnd[o.kcEndChoice || 0];
  const end = kcAdjust(endTab, u2, RHmin, c.h, true);
  return { kcIni: kIni, kcMid: mid.kc, kcEnd: end.kc, kcMidTab: c.kcMid, kcEndTab: endTab, RHmin: RHmin, u2: u2, h: c.h,
           flags: flags.concat(mid.flags, end.flags), sources: ['FAO56'] };
}

/* =====================================================================
   5. SOIL WATER BALANCE  (FAO-56 Chapter 8, Table 19)             [FAO56]
   ===================================================================== */
/* Table 19 ranges; mid is the midpoint used as the editable default */
const SOILS = {
  sand:          { fc: [0.07, 0.17], wp: [0.02, 0.07] },
  loamy_sand:    { fc: [0.11, 0.19], wp: [0.03, 0.10] },
  sandy_loam:    { fc: [0.18, 0.28], wp: [0.06, 0.16] },
  loam:          { fc: [0.20, 0.30], wp: [0.07, 0.17] },
  silt_loam:     { fc: [0.22, 0.36], wp: [0.09, 0.21] },
  silt:          { fc: [0.28, 0.36], wp: [0.12, 0.22] },
  silt_clay_loam:{ fc: [0.30, 0.37], wp: [0.17, 0.24] },
  silty_clay:    { fc: [0.30, 0.42], wp: [0.17, 0.29] },
  clay:          { fc: [0.32, 0.40], wp: [0.20, 0.24] }
};
function soilMid(id) { const s = SOILS[id]; return s ? { fc: (s.fc[0] + s.fc[1]) / 2, wp: (s.wp[0] + s.wp[1]) / 2 } : null; }
function TAW(fc, wp, zr) { return 1000 * (fc - wp) * zr; }                 // Eq. 82
function RAW(p, taw) { return p * taw; }                                     // Eq. 83
function pAdjust(pTab, ETc) { return clamp(pTab + 0.04 * (5 - ETc), 0.1, 0.8); }
function Ks(Dr, taw, p) { const raw = p * taw; return Dr <= raw ? 1 : Math.max(0, (taw - Dr) / ((1 - p) * taw)); }   // Eq. 84
/* Daily balance, Eq. 85-88. days: [{eto, kc, rain, irrig, ro}], from Dr0. Rain below 0.2 ETo ignored (FAO-56). */
function waterBalance(days, taw, p, Dr0, opts) {
  const o = opts || {};
  let Dr = clamp(isNum(Dr0) ? Dr0 : 0, 0, taw);
  const out = [];
  for (const d of days) {
    const etc = d.eto * d.kc;
    const pUse = o.adjustP ? pAdjust(p, etc) : p;
    const raw = pUse * taw;
    let rain = d.rain || 0;
    if (rain < 0.2 * d.eto) rain = 0;
    const irrig = d.irrig || 0, ro = d.ro || 0;
    const DrStart = Math.max(0, Dr - irrig - (rain - ro));   // wetting early in the day (FAO-56 Ex. 38, note 5)
    const ks = Ks(DrStart, taw, pUse);
    const etcAdj = etc * ks;
    const dp = Math.max(0, (rain - ro) + irrig - etcAdj - Dr);   // Eq. 88 deep percolation
    const DrEnd = clamp(DrStart + etcAdj, 0, taw);
    out.push({ etc: etc, ks: ks, etcAdj: etcAdj, raw: raw, p: pUse, DrStart: DrStart, DrEnd: DrEnd, dp: dp, rainUsed: rain });
    Dr = DrEnd;
  }
  return out;
}
/* Irrigation decision from a stateless ledger since the last thorough wetting.
   inp: {fc, wp, zr, p, etoPerDay (number or array), kc, daysSinceWet, rains:[{day, mm}], irrigs:[{day, mm}], efficiency, areaHa, pumpLs, adjustP}
   Returns Dr, RAW, verdict code, net and gross depths, volumes, days until RAW is reached. */
function irrigationDecision(inp) {
  const taw = TAW(inp.fc, inp.wp, inp.zr);
  const n = Math.max(0, Math.round(inp.daysSinceWet));
  const days = [];
  for (let i = 1; i <= n; i++) {
    const eto = Array.isArray(inp.etoPerDay) ? inp.etoPerDay[Math.min(i - 1, inp.etoPerDay.length - 1)] : inp.etoPerDay;
    const kc = Array.isArray(inp.kc) ? inp.kc[Math.min(i - 1, inp.kc.length - 1)] : inp.kc;
    const rain = (inp.rains || []).filter(r => r.day === i).reduce((a, r) => a + r.mm, 0);
    const irrig = (inp.irrigs || []).filter(r => r.day === i).reduce((a, r) => a + r.mm, 0);
    days.push({ eto: eto, kc: kc, rain: rain, irrig: irrig });
  }
  const traj = waterBalance(days, taw, inp.p, 0, { adjustP: inp.adjustP !== false });
  const last = traj.length ? traj[traj.length - 1] : null;
  const Dr = last ? last.DrEnd : 0;
  const etoNow = Array.isArray(inp.etoPerDay) ? inp.etoPerDay[inp.etoPerDay.length - 1] : inp.etoPerDay;
  const kcNow = Array.isArray(inp.kc) ? inp.kc[inp.kc.length - 1] : inp.kc;
  const etcNow = etoNow * kcNow;
  const pUse = inp.adjustP !== false ? pAdjust(inp.p, etcNow) : inp.p;
  const raw = RAW(pUse, taw);
  const eff = isNum(inp.efficiency) ? inp.efficiency : 1;
  const net = Dr, gross = net / eff;
  const area = isNum(inp.areaHa) ? inp.areaHa : 1;
  const m3 = gross * 10 * area;                       // 1 mm over 1 ha = 10 m3
  const litres = m3 * 1000;
  const pumpHours = isNum(inp.pumpLs) && inp.pumpLs > 0 ? litres / (inp.pumpLs * 3600) : null;
  const stressed = traj.some(t => t.ks < 1);
  let code, daysToRaw = 0;
  if (Dr >= raw) code = 'water_now';
  else { daysToRaw = (raw - Dr) / etcNow; code = daysToRaw < 1 ? 'water_tomorrow' : 'wait'; }
  return { code: code, Dr: Dr, taw: taw, raw: raw, p: pUse, etc: etcNow, daysToRaw: daysToRaw, netMm: net, grossMm: gross, m3: m3, litres: litres,
           pumpHours: pumpHours, stressBegun: stressed, trajectory: traj, sources: ['FAO56', 'FAO_TM4'] };
}

/* =====================================================================
   6. LOWLAND RICE: SAFE AWD AND CONTINUOUS FLOODING  [IRRI_AWD, BOUMAN2007, DA_AO25, PHILRICE_AWD, PINOYRICE_WELL, PALAYCHECK]
   ===================================================================== */
const AWD = {
  triggerCm: { dry: 15, wet: 20 },           // DA AO 25-09 and the PhilRice observation well: the Philippine policy. IRRI safe AWD uses 15 cm all season.
  irriTriggerCm: 15,                         // IRRI safe AWD, every season; the stricter figure, carried as a caveat
  refloodCm: 5,                              // IRRI RKB, Bouman 2007, PhilRice
  startDays: [21, 30],                       // PhilRice: 21-30 days after transplanting or sowing (IRRI: 1-2 weeks)
  floweringFloodCm: 5,                       // IRRI, PhilRice (PalayCheck: 5-7 cm)
  floweringWindowDays: 7,                    // one week before to one week after flowering (IRRI, Bouman)
  drainBeforeHarvestDays: { light: 7, clay: 14 },   // PhilRice, PalayCheck
  preAwdDepthCm: [2, 3],                     // DA-PhilRice news, Mendoza 2022 quoting Saludez: "irrigate the field with 2-3cm water depth" before AWD starts
  continuous: { afterTransplantCm: 3, laterCm: [5, 10], drainBeforeHarvestDays: [7, 10], headingCm: 5 },  // IRRI RKB, verbatim
  /* THE OBSERVATION WELL  [PINOYRICE_WELL, IRRI_AWD]. The card quotes the PhilRice design, not the IRRI
     one, because only the PhilRice well can make the measurement the card asks for. IRRI's tube is 30 cm
     with 15 cm standing above the soil, so it reaches 15 cm down and its bottom sits at the dry-season
     trigger; it cannot show the wet-season trigger of 20 cm at all. PhilRice cuts the tube shorter, at
     25 cm, and moves the soil line instead: two rings are marked 5 and 10 cm from the top, labelled wet
     season and dry season, and the well is pressed in until the ring for the season is level with the
     ground. The bottom of the well then lands exactly on that season's trigger, 20 cm down in the wet
     season and 15 cm in the dry, which is why the published instruction can be as simple as "irrigate
     the field when there is no more visible water in the observation well". Diameter is "at least 10 cm"
     in PhilRice and 10-15 cm in IRRI, so the range is carried from IRRI. The 1 cm gradation is NOT
     published by either: both wells are look-and-see devices, and reading a level in centimetres off one
     is this app's own addition, declared in UNVERIFIED as READING_PRECISION. */
  tube: { lengthCm: 25, diameterCm: [10, 15], aboveSoilCm: { dry: 10, wet: 5 }, belowSoilCm: { dry: 15, wet: 20 },
          holeMm: [3, 5], holeAlongCm: 3, holeAroundCm: 5, gradationCm: 1, gradationPublished: false },
  weedPostponeWeeks: [2, 3]
};
/* TENSIOMETER  [CARRIJO2017, IRROMETER]. A tensiometer reads how hard the soil holds its water, in
   centibars, which is the same quantity as soil water potential with the sign dropped: 20 cb is
   -20 kPa. Carrijo, Lundy and Linquist (2017) put that figure and the AWD tube depth side by side as
   two ways of drawing the same line. Their meta-analysis of 56 studies separates mild AWD, at soil
   water potential at or above -20 kPa OR a field water level no lower than 15 cm, from severe AWD
   below it. Mild AWD did not significantly reduce yield and cut water use by 23.4 per cent; severe
   AWD cost 22.6 per cent of yield. So 20 cb is the same boundary the card already enforces at 15 cm,
   expressed in the units of a different instrument.

   What a tensiometer cannot do is give a date. Turning a tension into a future water level needs the
   soil's water retention curve, which this app does not have and will not assume, so the tensiometer
   answers now or not now and the tube, if the farmer also has one, still supplies the date.

   Two limits are carried as flags rather than silently handled. A tensiometer stops reading truthfully
   somewhere around 80 to 85 cb, where the water column breaks; above that the instrument is out of
   range, not the field dry. And the depth at which the instrument sits changes what the reading means,
   which is declared in UNVERIFIED rather than assumed away. */
/* WHAT EACH METHOD COSTS AND BUYS  [CARRIJO2017, LI2024, BOUMAN2007, IRRI_AWD]. Both sides, from
   meta-analyses rather than from advocacy. The two headline numbers disagree in sign and that is not
   a conflict: Carrijo's -5.4 per cent pools mild and severe AWD together, Li's +1.52 per cent covers a
   different set, and both find the yield penalty appears only once the drying passes the threshold. */
const METHOD_EVIDENCE = {
  awd: {
    pros: [
      'Water use falls about 23 per cent against continuous flooding, with no significant yield loss, provided the drying stays mild, which is what the 15 cm rule enforces (Carrijo et al. 2017, 56 studies).',
      'Methane emissions fall about 43 per cent and the net global warming potential about 37 per cent (Li et al. 2024, 72 studies).',
      'Fewer irrigations means less pumping, and the field tells you when it needs water instead of the calendar.'
    ],
    cons: [
      'Let the field dry past the threshold and it costs about 23 per cent of yield (Carrijo et al. 2017). The whole method depends on not overshooting, which is why it needs an instrument.',
      'Nitrous oxide emissions rise about 43 per cent. Methane still dominates, so the net warming effect falls, but the trade is real (Li et al. 2024).',
      'The yield penalty is worse on alkaline soils, pH 7 and above, and on soils under 1 per cent carbon (Carrijo et al. 2017).',
      'On loamy and sandy soils with a deep water table, IRRI reports water savings above 50 per cent but yield losses above 20 per cent (Bouman et al. 2007).'
    ],
    sources: ['CARRIJO2017', 'LI2024', 'BOUMAN2007', 'IRRI_AWD', 'DA_AO25']
  },
  continuous: {
    pros: [
      'Simplest to manage: keep the water between the target depths and there is no threshold to overshoot.',
      'No yield risk from drying, because the field never dries.',
      'Standing water suppresses weeds, which is why AWD is postponed while weeds are uncontrolled (IRRI).'
    ],
    cons: [
      'Uses about 23 per cent more water than mild AWD for no yield gain (Carrijo et al. 2017).',
      'Methane emissions are roughly 43 per cent higher than under AWD, and rice paddies are a major source (Li et al. 2024).',
      'On a leaky field the losses are large and continuous: Bouman et al. (1994) measured seepage and percolation up to 5 cm a day and more at IRRI where the plow sole had broken up.'
    ],
    sources: ['IRRI_AWD', 'CARRIJO2017', 'LI2024', 'BOUMAN1994']
  },
  none: {
    pros: [
      'Costs nothing and needs no equipment.'
    ],
    cons: [
      'Drying an unmonitored field is not safe AWD. Without a reading you cannot tell a field 5 cm below the surface, which is fine, from one 30 cm below, which is past the point where yield starts to go (Carrijo et al. 2017).',
      'Irrigating when the surface looks dry is the safe error, but it is early, and it gives up the water saving that makes AWD worth doing.',
      'A tube is 30 cm of plastic pipe or bamboo and an hour of work (IRRI).'
    ],
    sources: ['IRRI_AWD', 'CARRIJO2017']
  }
};
const TENSIOMETER = {
  awdTriggerCb: 20,            // Carrijo et al. 2017: the mild/severe AWD boundary, -20 kPa, equal to their 15 cm water level
  saturatedCb: 10,            // IRROMETER standard bands: 0 to 10 cb is saturated soil
  outOfRangeCb: 80,           // the water column breaks around 80 to 85 cb; above this the instrument, not the field, is the limit
  severeBelowKPa: -20         // the same number as a potential, for the text
};
/* Under safe AWD the tensiometer replaces the tube as the trigger. Under continuous flooding it
   answers a different question, which is whether the field is still saturated at all. */
function tensiometerDecision(cb, method) {
  if (!isNum(cb)) return null;
  const flags = [], T = TENSIOMETER;
  if (cb < 0) flags.push('tensiometer_negative');
  if (cb >= T.outOfRangeCb) flags.push('tensiometer_out_of_range');
  if (method === 'continuous') {
    return { code: cb > T.saturatedCb ? 'cf_top_up' : 'cf_ok', cb: cb, saturatedCb: T.saturatedCb,
             flags: flags, from: 'tensiometer', sources: ['IRROMETER'] };
  }
  return { code: cb >= T.awdTriggerCb ? 'reflood_now' : 'not_yet', cb: cb, triggerCb: T.awdTriggerCb,
           remainingCb: cb < T.awdTriggerCb ? T.awdTriggerCb - cb : null,
           flags: flags, from: 'tensiometer', sources: ['CARRIJO2017'] };
}
/* THE MEASUREMENT. One number describes the water in a rice field, on one datum: the soil surface.
   Negative is centimetres below it (what the AWD tube shows), 0 is level with it, positive is water
   standing above it. Every rule in this section is a comparison against that one number, so the sign
   carries the meaning and nothing is measured twice.

   Readings come off a hand-marked tube or stick, so one reading is good to about a centimetre. That
   is an assumption of this app, not a published figure, and it is declared as one in UNVERIFIED. Two
   readings therefore carry sqrt(2) cm between them, which is what makes a one-day pair nearly useless:
   a 2 cm fall in a day gives 2 +/- 1.4 cm a day. The cure is span, not more readings. Averaging the
   daily falls within one drawdown changes nothing at all, because they telescope: the mean of
   (h1-h0), (h2-h1) ... (hn-hn-1) is exactly (hn-h0)/n, the first and last reading and nothing else. */
const READ_SIGMA_CM = 1;
const MIN_FALL_CM = 2 * Math.SQRT2 * READ_SIGMA_CM;    // under this the fall is within 2 sigma of reading noise
const PROJECT_HORIZON_DAYS = 7;                        // past a week the canopy and the weather have both moved on
/* Two readings of the same tube or stick, and the days between them. Gives the loss rate for THIS
   field: crop water use, percolation and seepage together, measured rather than modelled. No
   percolation or seepage coefficient is assumed anywhere in this app; the tube reports their sum.
   Order of preference: this drawdown, then the field's own past average, then a rate typed in. */
function lossRate(inp) {
  const out = { drop: null, dropFrom: null, gainCm: null, days: null, sigma: null, fallCm: null, flags: [] };
  /* A span of zero or less is not a span. It used to be silently replaced by one day, so two readings
     with the same timestamp, or entered in the wrong order, produced a rate reported as measured and
     written into the paddy's history. Two readings with no time between them measure nothing. */
  if (isNum(inp.levelCm) && isNum(inp.levelPrevCm) && isNum(inp.daysBetween) && inp.daysBetween <= 0) {
    out.flags.push(inp.daysBetween === 0 ? 'readings_same_day' : 'readings_out_of_order');
    return out;
  }
  const days = isNum(inp.daysBetween) && inp.daysBetween > 0 ? inp.daysBetween : 1;
  if (isNum(inp.levelCm) && isNum(inp.levelPrevCm)) {
    const fall = inp.levelPrevCm - inp.levelCm;         // positive when the level fell
    out.days = days; out.fallCm = fall;
    if (fall > 0) {
      out.drop = fall / days; out.dropFrom = 'measured'; out.sigma = READ_SIGMA_CM * Math.SQRT2 / days;
      if (fall < MIN_FALL_CM) out.flags.push('readings_too_close');
    } else {
      /* The level rose, so rain or irrigation came in between. These two give no rate. Today's
         reading still decides, and the field's past average can still date the next irrigation. */
      out.gainCm = -fall; out.flags.push('level_net_gain');
    }
  }
  if (out.drop == null && isNum(inp.fieldDropCmPerDay) && inp.fieldDropCmPerDay > 0) {
    out.drop = inp.fieldDropCmPerDay; out.dropFrom = 'field_average';
    out.sigma = isNum(inp.fieldDropSigma) && inp.fieldDropSigma > 0 ? inp.fieldDropSigma : null;
  }
  if (out.drop == null && isNum(inp.dropCmPerDay) && inp.dropCmPerDay > 0) { out.drop = inp.dropCmPerDay; out.dropFrom = 'entered'; }
  /* The level rose and this field has no history to fall back on, so nothing here can say when it will
     dry. Say that plainly rather than leaving the date line silently blank. */
  if (out.drop == null && out.gainCm != null) out.flags.push('no_history_yet');
  /* This drawdown against the field's own history. A rate well outside it means rain between the
     readings, a bund losing water, or a reading taken at a different hour of the day. Two sigma,
     both terms, and only when there is enough history to have a spread. */
  if (out.dropFrom === 'measured' && isNum(inp.fieldDropCmPerDay) && isNum(inp.fieldDropSigma) && inp.fieldDropSigma > 0) {
    const comb = Math.sqrt(out.sigma * out.sigma + inp.fieldDropSigma * inp.fieldDropSigma);
    if (Math.abs(out.drop - inp.fieldDropCmPerDay) > 2 * comb) out.flags.push(out.drop > inp.fieldDropCmPerDay ? 'loss_above_field_average' : 'loss_below_field_average');
  }
  return out;
}
/* Days from where the level is now down to a target level, with the window the reading error puts
   around it. Both terms propagate: the rate's own error, and the error in today's reading. */
function project(levelCm, targetLevelCm, drop, sigma) {
  if (!isNum(levelCm) || !isNum(drop) || drop <= 0) return null;
  const gap = levelCm - targetLevelCm;
  if (!(gap > 0)) return null;
  const days = gap / drop;
  let lo = null, hi = null;
  /* The rate and the distance to the trigger are not independent. Both are built from the same current
     reading: the level enters the gap directly and enters the fall with the opposite sign, so one
     centimetre of reading error shrinks the gap and lengthens the fall together, and both push the date
     the same way. Writing g for the gap and f for the fall between the two readings, propagating the
     error of g/f gives a relative error of sigma_read * sqrt((f+g)^2 + g^2) / (f g). The term this app
     used before was sqrt(2g^2 + f^2) over the same denominator, which is the same expression with the
     2fg cross term dropped, and it was too narrow: against this app's own one-centimetre reading noise
     it covered 57 to 65 per cent of outcomes where one standard deviation implies about 68. With the
     cross term carried it covers 69 to 72. The fall is recovered from the rate, since sigma is
     sigma_read * sqrt(2) / n by construction and f is the rate times n. What is still not modelled is
     the right skew of a ratio: the late end of a date window runs further out than the early end, so
     the window is a planning aid and the tube reading remains the decision rule. */
  if (isNum(sigma) && sigma > 0) {
    const n = READ_SIGMA_CM * Math.SQRT2 / sigma, fall = drop * n;
    const rel = fall > 0
      ? READ_SIGMA_CM * Math.sqrt((fall + gap) * (fall + gap) + gap * gap) / (fall * gap)
      : Math.sqrt((sigma / drop) * (sigma / drop) + (READ_SIGMA_CM / gap) * (READ_SIGMA_CM / gap));
    lo = Math.max(0, days * (1 - rel)); hi = days * (1 + rel);
  }
  return { days: days, lo: lo, hi: hi, beyondHorizon: days > PROJECT_HORIZON_DAYS };
}
/* SEEPAGE AND PERCOLATION  [BOUMAN1994]. Bouman, Wopereis, Kropff, ten Berge and Tuong (1994)
   classed paddy soils by the hydraulic conductivity of the plow sole and of the subsoil, and gave the
   percolation rate of each class. The field experiment was at IRRI, Los Banos, with seepage and
   percolation read off sloping gauges. These are the published Philippine bands a farmer's own
   measured loss is compared against. This app assumes none of them: it measures the loss in the
   farmer's field and reports which band that lands in.

   The paper also settles whether the card may project a straight line. In classes I and IIa the
   percolation rate is "hardly affected by hydrological conditions (soil water content, ground water
   table depth, ponded water depth)", and where the soil hydraulics are stable a constant rate can be
   used in simple book-keeping. In class IIb the rate follows the ponded depth, and their fixed-rate
   book-keeping deviated from the measured depth by 2 to 3 cm. So the projection is sourced where the
   plow sole holds, and is known to weaken where it does not.

   Scope: these are ponded-field measurements. Once the water is below the soil surface, as it is
   through most of an AWD cycle, the paper's percolation-against-ponded-depth relations no longer
   apply directly, and this app does not extend them there. */
const SP = {
  classes: [
    { id: 'I',   loCm: 0, hiCm: 0.5, steady: true,  what: 'plow sole intact and poorly permeable' },
    { id: 'IIa', loCm: 1, hiCm: 1.5, steady: true,  what: 'plow sole permeable, subsoil poorly permeable' },
    { id: 'IIb', loCm: 1, hiCm: 5,   steady: false, what: 'plow sole permeable over a permeable subsoil' }
  ],
  fieldMeasuredCmPerDay: [3.62, 0.40, 1.46, 3.26],   // the four stages of the IRRI experiment, in order
  bookkeepingErrorCm: [2, 3],                        // how far the fixed-rate method drifted in class IIb
  highestPublishedCm: 5
};
/* Which of the published bands a measured seepage-and-percolation rate falls in. The bands overlap,
   so more than one can match, and that is reported rather than resolved: telling them apart needs the
   plow sole and the subsoil, which a farmer cannot read off a tube. */
function spClassify(spCmPerDay) {
  if (!isNum(spCmPerDay)) return null;
  const flags = [];
  if (spCmPerDay < 0) flags.push('sp_negative');
  if (spCmPerDay > SP.highestPublishedCm) flags.push('sp_above_published');
  const hit = SP.classes.filter(c => spCmPerDay >= c.loCm && spCmPerDay <= c.hiCm);
  /* The published bands do not meet: class I stops at 0.5 cm a day and class IIa starts at 1.0.
     A field that measures in between is reported as being between them, not forced into one. */
  if (!hit.length && spCmPerDay >= 0 && spCmPerDay <= SP.highestPublishedCm) flags.push('sp_between_bands');
  /* Any match that tracks the ponded depth makes the straight-line date less dependable. */
  if (hit.some(c => !c.steady) || flags.indexOf('sp_above_published') >= 0) flags.push('sp_may_not_be_steady');
  return { spCm: spCmPerDay, classes: hit.map(c => c.id), match: hit, flags: flags, sources: ['BOUMAN1994'] };
}
/* CONTINUOUS FLOODING  [IRRI_AWD]. Depths from the IRRI Rice Knowledge Bank: "around 3 cm initially",
   "gradually increase to 5-10 cm (with increasing plant height)", 5 cm "from heading to the end of
   flowering", "drained 7-10 days before harvest". Measured on the same datum as everything else, so a
   field that has dried past the surface reads negative and the top-up is the full distance back. */
function continuousFloodDecision(inp) {
  const C = AWD.continuous, src = ['IRRI_AWD', 'PALAYCHECK'];
  const d = C.drainBeforeHarvestDays;
  if (isNum(inp.daysToHarvest) && inp.daysToHarvest <= d[1]) return { code: 'cf_drain_now', drainDays: d, sources: src };
  if (isNum(inp.daysToFlowering) && Math.abs(inp.daysToFlowering) <= AWD.floweringWindowDays) {
    const ok = isNum(inp.levelCm) && inp.levelCm >= C.headingCm;
    return { code: ok ? 'cf_flowering_ok' : 'cf_flowering_top_up', targetCm: C.headingCm, sources: src };
  }
  const early = isNum(inp.daysAfterEstablish) && inp.daysAfterEstablish < AWD.startDays[0];
  const target = early ? [C.afterTransplantCm, C.afterTransplantCm] : C.laterCm;
  const L = lossRate(inp);
  const base = { targetCm: target, dropCmPerDay: L.drop, dropFrom: L.dropFrom, dropSigma: L.sigma,
                 daysBetween: L.days, fallCm: L.fallCm, gainCm: L.gainCm, flags: L.flags.slice(), sources: src };
  /* Under continuous flooding a tensiometer answers a different question. The field is meant to be
     saturated, so any reading out of the 0 to 10 cb saturated band means the ponded water is gone. */
  const tensC = tensiometerDecision(inp.tensiometerCb, 'continuous');
  if (tensC) {
    /* The stick answers the same question from the other side, so where both are given they can
       agree or disagree, exactly as under AWD, and the disagreement is never suppressed. */
    const stickSaysTopUp = isNum(inp.levelCm) ? inp.levelCm < target[0] : null;
    const tensSaysTopUp = tensC.code === 'cf_top_up';
    const disagree = stickSaysTopUp != null && stickSaysTopUp !== tensSaysTopUp;
    const mode = inp.bothMode === 'tube' ? 'tube' : 'tensiometer';
    let by = 'tensiometer', topUp = tensSaysTopUp;
    if (stickSaysTopUp != null) {
      if (mode === 'tube') { by = 'stick'; topUp = stickSaysTopUp; }
      else if (disagree) { topUp = stickSaysTopUp || tensSaysTopUp; by = tensSaysTopUp ? 'tensiometer' : 'stick'; }
    }
    const fl = base.flags.concat(tensC.flags);
    if (disagree) fl.push(stickSaysTopUp ? 'instruments_disagree_tube_drier' : 'instruments_disagree_tensiometer_drier');
    return Object.assign({}, base, { code: topUp ? 'cf_top_up' : 'cf_ok', decidedBy: by, bothMode: stickSaysTopUp != null ? mode : null,
      instrumentsDisagree: disagree, tubeSaysNow: stickSaysTopUp, tensSaysNow: tensSaysTopUp,
      cb: tensC.cb, saturatedCb: tensC.saturatedCb, levelCm: inp.levelCm,
      shortCm: isNum(inp.levelCm) && inp.levelCm < target[0] ? target[0] - inp.levelCm : null,
      flags: fl, sources: src.concat(['IRROMETER']) });
  }
  if (!isNum(inp.levelCm)) return Object.assign({ code: 'cf_need_depth', decidedBy: 'stick' }, base);
  if (inp.levelCm < target[0]) return Object.assign({ code: 'cf_top_up', shortCm: target[0] - inp.levelCm }, base);
  if (inp.levelCm > target[1] + 5) return Object.assign({ code: 'cf_too_deep' }, base);
  const p = project(inp.levelCm, target[0], L.drop, L.sigma);
  return Object.assign({ code: 'cf_ok', daysLeft: p ? p.days : null,
                         projections: p ? [Object.assign({ which: 'cf', triggerCm: target[0] }, p)] : [] }, base);
}
/* INTERMITTENT DRYING WITHOUT A TUBE  [IRRI_AWD]. Returns no dry-down threshold, deliberately. Safe AWD
   is defined by reading the water table in a tube; the IRRI fact sheet gives no guidance for a farmer
   without one, and this app does not invent one. What it does return is what holds whatever the method:
   flooded through flowering, drained before harvest, postponed while weeds are unmanaged. With no
   threshold there is nothing to project a date to, so no loss rate is reported either. */
function intermittentDecision(inp) {
  const src = ['IRRI_AWD', 'PINOYRICE_WELL', 'PALAYCHECK'], flags = ['no_tube_no_published_threshold'];
  const drainDays = AWD.drainBeforeHarvestDays[inp.soil === 'clay' ? 'clay' : 'light'];
  if (inp.weedsManaged === false) flags.push('postpone_awd_weeds');
  if (isNum(inp.daysToHarvest) && inp.daysToHarvest <= drainDays) return { code: 'drain_stop_irrigating', drainDays: drainDays, flags: flags, tube: AWD.tube, sources: src };
  if (isNum(inp.daysToFlowering) && Math.abs(inp.daysToFlowering) <= AWD.floweringWindowDays) {
    const ok = isNum(inp.levelCm) && inp.levelCm >= AWD.floweringFloodCm;
    return { code: ok ? 'flowering_keep_flooded' : 'flowering_top_up_to_5cm', targetCm: AWD.floweringFloodCm, flags: flags, tube: AWD.tube, sources: src };
  }
  if (isNum(inp.daysAfterEstablish) && inp.daysAfterEstablish < AWD.startDays[0]) return { code: 'before_awd_keep_shallow', depthCm: AWD.preAwdDepthCm, flags: flags, tube: AWD.tube, sources: src };
  return { code: 'intermittent_no_threshold', flags: flags, tube: AWD.tube, sources: src };   // no triggerCm: there is none to give
}
/* NO INSTRUMENT  [IRRI_AWD, CARRIJO2017]. The card cannot read the field, so the farmer does. Whether
   the water has gone from the surface is an observation, not an estimate, and putting water on a field
   that has dried out needs no published depth. This is the conservative answer: a dry surface says
   nothing about how far the water table has fallen underneath, so it irrigates earlier than a tube
   would and gives up the water saving that makes AWD worth doing. The card says that rather than
   pretending the answer is as good as a measured one. */
function noInstrumentDecision(inp) {
  const src = ['IRRI_AWD', 'CARRIJO2017', 'PINOYRICE_WELL'], flags = ['no_instrument'];
  const cont = inp.method === 'continuous';
  const drainDays = AWD.drainBeforeHarvestDays[inp.soil === 'clay' ? 'clay' : 'light'];
  if (inp.weedsManaged === false && !cont) flags.push('postpone_awd_weeds');
  if (isNum(inp.daysToHarvest) && inp.daysToHarvest <= (cont ? AWD.continuous.drainBeforeHarvestDays[1] : drainDays))
    return { code: 'drain_stop_irrigating', drainDays: cont ? AWD.continuous.drainBeforeHarvestDays : drainDays, flags: flags, tube: AWD.tube, sources: src };
  if (isNum(inp.daysToFlowering) && Math.abs(inp.daysToFlowering) <= AWD.floweringWindowDays)
    return { code: 'flowering_top_up_to_5cm', targetCm: AWD.floweringFloodCm, flags: flags, tube: AWD.tube, sources: src };
  if (isNum(inp.daysAfterEstablish) && inp.daysAfterEstablish < AWD.startDays[0] && !cont)
    return { code: 'before_awd_keep_shallow', depthCm: AWD.preAwdDepthCm, startDays: AWD.startDays,
             startsInDays: AWD.startDays[0] - inp.daysAfterEstablish, flags: flags, tube: AWD.tube, sources: src };
  const target = cont ? (isNum(inp.daysAfterEstablish) && inp.daysAfterEstablish < AWD.startDays[0]
    ? [AWD.continuous.afterTransplantCm, AWD.continuous.afterTransplantCm] : AWD.continuous.laterCm) : null;
  if (inp.surfaceDry === true) return { code: 'surface_dry_irrigate', refloodCm: AWD.refloodCm, targetCm: target, flags: flags, tube: AWD.tube, sources: src };
  if (inp.surfaceDry === false) return { code: 'surface_wet_wait', refloodCm: AWD.refloodCm, targetCm: target, flags: flags, tube: AWD.tube, sources: src };
  return { code: 'need_surface_check', flags: flags, tube: AWD.tube, sources: src };
}
/* Dispatch on the farmer's chosen method. */
function riceWaterDecision(inp) {
  /* The instrument decides which rule can be applied at all, so it is checked before the method.
     Without one there is no reading, and the card asks the farmer for the one observation they can
     make themselves rather than offering a method whose answer is a refusal. */
  if (inp.instrument === 'none') return noInstrumentDecision(inp);
  if (inp.method === 'continuous') return continuousFloodDecision(inp);
  if (inp.method === 'intermittent') return intermittentDecision(inp);   // kept for older saved inputs
  return awdDecision(inp);
}
/* inp: {daysAfterEstablish, daysToFlowering (negative after), daysToHarvest, season:'wet'|'dry'|'nodry',
   levelCm (negative below the soil surface, 0 at it, positive standing above it), levelPrevCm,
   daysBetween, fieldDropCmPerDay, fieldDropSigma, dropCmPerDay, weedsManaged, soil:'light'|'clay'} */
function awdDecision(inp) {
  const src = ['IRRI_AWD', 'BOUMAN2007', 'BOUMAN1994', 'DA_AO25', 'PHILRICE_AWD', 'PINOYRICE_WELL', 'PHILRICE_NEWS', 'PALAYCHECK'];
  const trig = AWD.triggerCm[inp.season === 'wet' ? 'wet' : 'dry'];
  const drainDays = AWD.drainBeforeHarvestDays[inp.soil === 'clay' ? 'clay' : 'light'];
  if (isNum(inp.daysToHarvest) && inp.daysToHarvest <= drainDays) return { code: 'drain_stop_irrigating', drainDays: drainDays, sources: src };
  if (isNum(inp.daysToFlowering) && Math.abs(inp.daysToFlowering) <= AWD.floweringWindowDays) {
    const ok = isNum(inp.levelCm) && inp.levelCm >= AWD.floweringFloodCm;
    return { code: ok ? 'flowering_keep_flooded' : 'flowering_top_up_to_5cm', targetCm: AWD.floweringFloodCm, sources: src };
  }
  /* AWD does not begin until 21 to 30 days after establishment, and that rule outranks every
     instrument. It used to return here with nothing else, so one tap on the date field made the card
     answer "keep 2 to 3 cm" forever and appear broken. */
  if (isNum(inp.daysAfterEstablish) && inp.daysAfterEstablish < AWD.startDays[0]) {
    const L0 = lossRate(inp);
    return { code: 'before_awd_keep_shallow', depthCm: AWD.preAwdDepthCm, startDays: AWD.startDays,
             startsInDays: AWD.startDays[0] - inp.daysAfterEstablish, daysAfterEstablish: inp.daysAfterEstablish,
             levelCm: inp.levelCm, dropCmPerDay: L0.drop, dropFrom: L0.dropFrom, dropSigma: L0.sigma,
             daysBetween: L0.days, fallCm: L0.fallCm, gainCm: L0.gainCm, flags: L0.flags.slice(), sources: src };
  }
  const L = lossRate(inp), flags = L.flags.slice();
  if (!isNum(inp.daysAfterEstablish)) flags.push('awd_start_window_unknown');
  if (inp.weedsManaged === false) flags.push('postpone_awd_weeds');
  const base = { triggerCm: trig, irriTriggerCm: AWD.irriTriggerCm, dropCmPerDay: L.drop, dropFrom: L.dropFrom,
                 dropSigma: L.sigma, daysBetween: L.days, fallCm: L.fallCm, gainCm: L.gainCm, flags: flags, sources: src };
  /* Everything the tube can say, worked out whenever there is a reading, whoever takes the decision.
     A tensiometer answers now or not now; only the tube gives a date, so the two are complementary
     rather than alternatives and the card keeps both. */
  const lvl = {};
  if (isNum(inp.levelCm)) {
    lvl.levelCm = inp.levelCm;
    lvl.remainingCm = inp.levelCm + trig;
    lvl.riseCm = AWD.refloodCm - inp.levelCm;
    lvl.fromCm = -inp.levelCm;
    lvl.refloodCm = AWD.refloodCm;
    const ps = [], da = project(inp.levelCm, -trig, L.drop, L.sigma);
    if (da) ps.push(Object.assign({ which: 'da', triggerCm: trig }, da));
    if (trig !== AWD.irriTriggerCm) {
      const ir = project(inp.levelCm, -AWD.irriTriggerCm, L.drop, L.sigma);
      if (ir) ps.push(Object.assign({ which: 'irri', triggerCm: AWD.irriTriggerCm }, ir));
    }
    lvl.projections = ps;
  }
  /* The tensiometer reads what the roots feel, and Carrijo et al. (2017) draw the same line at -20 kPa
     that DA AO 25-09 draws at 15 cm. Where both instruments are present they can still disagree, and
     that disagreement is never suppressed: it usually means the tensiometer does not sit at the depth
     the tube watches, and it can mean the card is being asked to contradict the DA rule.

     Which one governs is the farmer's choice, because the honest answer differs by who is asking.
     An extension worker following the Order wants the tube. A farmer who trusts the instrument in the
     root zone wants the tensiometer. Someone checking whether the tensiometer is installed sensibly
     wants both, compared. What the card never does is pick one silently. */
  const tens = tensiometerDecision(inp.tensiometerCb, 'awd');
  if (tens) {
    const tubeSaysNow = isNum(inp.levelCm) ? inp.levelCm <= -trig : null;
    const tensSaysNow = tens.code === 'reflood_now';
    const disagree = tubeSaysNow != null && tubeSaysNow !== tensSaysNow;
    const mode = inp.bothMode === 'tube' ? 'tube' : 'tensiometer';
    let by = 'tensiometer', now = tensSaysNow;
    if (tubeSaysNow != null) {
      if (mode === 'tube') { by = 'tube'; now = tubeSaysNow; }
      /* Validate, and any disagreement at all, follow whichever calls for water first. Re-flooding
         earlier than the trigger is always allowed, so the early call is never the harmful error. */
      /* On a disagreement, follow whichever calls for water first: re-flooding early is always
         allowed, so it is never the harmful error. */
      else if (disagree) { now = tubeSaysNow || tensSaysNow; by = tensSaysNow ? 'tensiometer' : 'tube'; }
    }
    if (disagree) flags.push(tubeSaysNow ? 'instruments_disagree_tube_drier' : 'instruments_disagree_tensiometer_drier');
    /* Carrijo anchors the equivalence at the boundary and nowhere else, so the tensiometer is only
       compared against 20 cb at the moment the tube reaches its own trigger. Away from that line no
       published mapping exists between a water table depth and a tension, and none is invented. */
    const out = Object.assign({}, base, lvl, { code: now ? 'reflood_now' : 'not_yet', decidedBy: by,
      bothMode: tubeSaysNow != null ? mode : null, instrumentsDisagree: disagree,
      tubeSaysNow: tubeSaysNow, tensSaysNow: tensSaysNow,
      cb: tens.cb, triggerCb: tens.triggerCb, remainingCb: tens.remainingCb, refloodCm: AWD.refloodCm,
      flags: flags.concat(tens.flags), sources: src.concat(['CARRIJO2017']) });
    if (out.code === 'reflood_now') delete out.projections;
    if (out.code !== 'not_yet') delete out.remainingCm;
    return out;
  }
  if (!isNum(inp.levelCm)) return Object.assign({ code: 'need_tube_reading', decidedBy: 'tube' }, base);
  if (inp.levelCm <= -trig) { const out = Object.assign({}, base, lvl, { code: 'reflood_now', decidedBy: 'tube' }); delete out.projections; delete out.remainingCm; return out; }
  return Object.assign({}, base, lvl, { code: 'not_yet', decidedBy: 'tube',
    daysLeft: lvl.projections && lvl.projections.length ? lvl.projections[0].days : null });
}

/* =====================================================================
   7. EFFECTIVE RAINFALL (monthly planning)  [FAO_TM3]
   ===================================================================== */
function effectiveRainMonthly(P) { if (!isNum(P) || P <= 0) return 0; return Math.max(0, P > 75 ? 0.8 * P - 25 : 0.6 * P - 10); }

/* =====================================================================
   8. SPRAY WINDOW  [GRDC2025, GRDC2022, GRDC_MANUAL, APVMA_LABEL, AGVIC]
   ===================================================================== */
const SPRAY = {
  deltaT: { good: [2, 8], caution: [8, 10], veryCoarseOnly: [10, 12] },  // GRDC Practical tips 2025
  windKmh: { good: [3, 15], variableBelow: 5, labelMax: 20 },           // BOM/AgVic/APVMA 3-15; GRDC 2022 warns below 5; label up to 20
  inversionNightWindKmh: 11,                                            // GRDC: hazardous inversions likely below 11 km/h at night
  inversionBeforeSunsetH: 2, inversionAfterSunriseH: 2,                 // APVMA label: 1-2 h before sunset until 1-2 h after sunrise
  /* A farmer without an anemometer picks what the wind is doing to the trees, and the card turns that
     into a speed. The descriptions and the bands are Beaufort forces 0 to 4 as the WMO scale defines
     them [BEAUFORT], not this app's invention: the card used to carry bands close to Beaufort but not
     equal to it, with no source named. The speed used is the midpoint of the band, which is an
     assumption of this app and is declared as one: the scale gives a range, not a number. */
  beaufort: [
    { force: 0, loKmh: 0,    hiKmh: 1,    land: { en: 'Calm: smoke rises straight up', fil: 'Walang hangin: tuwid na pataas ang usok' } },
    { force: 1, loKmh: 1.1,  hiKmh: 5.5,  land: { en: 'Smoke drifts, but leaves are still', fil: 'Gumagalaw ang usok, tahimik ang mga dahon' } },
    { force: 2, loKmh: 5.6,  hiKmh: 11,   land: { en: 'Leaves rustle, wind felt on the face', fil: 'Kumakaluskos ang dahon, ramdam sa mukha' } },
    { force: 3, loKmh: 12,   hiKmh: 19,   land: { en: 'Leaves and twigs move all the time', fil: 'Tuloy-tuloy ang galaw ng dahon at sanga' } },
    { force: 4, loKmh: 20,   hiKmh: 28,   land: { en: 'Dust rises, small branches move', fil: 'Umaalikabok, gumagalaw ang maliliit na sanga' } }
  ],
  maxAirTempC: 30                                                       // GRDC Weather essentials 2022
};
/* inp: {T, RH, P, windKmh, hoursToSunset, hoursAfterSunrise, mistFogDew, smokeHanging, labelMaxWindKmh} */
function sprayWindow(inp) {
  /* BEAUFORT is cited whether or not the farmer used the descriptor picker, because the card cannot tell
     from the speed alone which way it was obtained, and a source list that changes with the input is
     worse than one that names everything the card can rest on. */
  const reasons = [], src = ['GRDC2025', 'GRDC2022', 'GRDC_MANUAL', 'APVMA_LABEL', 'AGVIC', 'BEAUFORT'];
  const P = isNum(inp.P) ? inp.P : 101.3;
  const dT = deltaT(inp.T, inp.RH, P);
  let level = 0;   // 0 good, 1 caution, 2 do not spray
  // Delta T bands (GRDC 2025)
  let dtBand;
  if (dT < 2) { dtBand = 'below_2'; level = Math.max(level, 1); reasons.push('deltaT_below_2'); }
  else if (dT <= 8) dtBand = 'good';
  else if (dT <= 10) { dtBand = 'caution'; level = Math.max(level, 1); reasons.push('deltaT_8_10'); }
  else if (dT <= 12) { dtBand = 'very_coarse_only'; level = Math.max(level, 1); reasons.push('deltaT_10_12'); }
  else { dtBand = 'above_12'; level = 2; reasons.push('deltaT_above_12'); }
  // wind
  /* The label governs. A product label may raise the GRDC figure as far as the 20 km/h the bands allow,
     but a label stricter than 15 km/h is the legal limit and this card may not relax it: the old clamp
     raised a 10 km/h label to 15 and returned a green light at 14. */
  const w = inp.windKmh;
  const maxW = isNum(inp.labelMaxWindKmh) ? Math.min(clamp(inp.labelMaxWindKmh, 0, SPRAY.windKmh.labelMax), Math.max(inp.labelMaxWindKmh, SPRAY.windKmh.good[1])) : SPRAY.windKmh.good[1];
  if (isNum(w)) {
    if (w < 3) { level = 2; reasons.push('wind_below_3'); }
    else if (w < SPRAY.windKmh.variableBelow) { level = Math.max(level, 1); reasons.push('wind_3_5_variable'); }
    if (w > maxW) { level = 2; reasons.push('wind_above_max'); }
  } else reasons.push('wind_unknown');
  // Wind is the primary drift criterion in every label and in the GRDC bands. Without it the card
  // reports that it cannot answer, rather than showing a green light it has no basis for.
  const windUnknown = !isNum(w);
  // inversion window and indicators
  const night = (isNum(inp.hoursToSunset) && inp.hoursToSunset <= SPRAY.inversionBeforeSunsetH) || (isNum(inp.hoursAfterSunrise) && inp.hoursAfterSunrise <= SPRAY.inversionAfterSunriseH) || inp.isNight === true;
  if (night) {
    if (!isNum(w) || w < SPRAY.inversionNightWindKmh) { level = 2; reasons.push('inversion_window'); }
    else { level = Math.max(level, 1); reasons.push('inversion_window_windy'); }
  }
  if (inp.mistFogDew || inp.smokeHanging) { level = 2; reasons.push('inversion_indicators'); }
  // temperature
  if (inp.T > SPRAY.maxAirTempC) { level = Math.max(level, 1); reasons.push('temp_above_30'); }
  const code = (windUnknown && level < 2) ? 'need_wind' : ['good', 'caution', 'do_not_spray'][level];
  return { code: code, deltaT: dT, deltaTBand: dtBand, wetBulb: inp.T - dT, reasons: reasons, sources: src };
}

/* =====================================================================
   9. PALAY DRYING  [ASABE_D245_ZHONG, UAEX_FSA1074, IRRI_DRYING, PALAYCHECK]
   ===================================================================== */
/* Modified Henderson, ASABE D245.6 long-grain rough rice constants as reproduced by Zhong (2015),
   corroborated against the University of Arkansas EMC table (FSA1074) to 0.05 points. M in % dry basis. */
const EMC_HENDERSON_LONG_ROUGH = { A: 4.1276e-5, B: 2.1191, C: 49.828 };
function emcDryBasis(T, RH) {   // RH in percent
  const k = EMC_HENDERSON_LONG_ROUGH, r = clamp(RH, 0.5, 99.9) / 100;
  return Math.pow(Math.log(1 - r) / (-k.A * (T + k.C)), 1 / k.B);
}
function dbToWb(db) { return 100 * db / (100 + db); }
function wbToDb(wb) { return 100 * wb / (100 - wb); }
function emcWetBasis(T, RH) { return dbToWb(emcDryBasis(T, RH)); }
/* RH at which grain equilibrates to a target wet-basis moisture at temperature T (bisection) */
function rhForMoisture(T, targetWb) {
  let lo = 1, hi = 99;
  for (let i = 0; i < 60; i++) { const m = 0.5 * (lo + hi); if (emcWetBasis(T, m) < targetWb) lo = m; else hi = m; }
  return 0.5 * (lo + hi);
}
/* IRRI mass balance: weight after drying (wet basis percentages) */
/* Mass balance on the dry matter. Only meaningful when drying, mc1 > mc2, and for real moisture
   contents: at mc 100 the whole mass is water and the answer degenerates to zero. */
function weightAfterDrying(w1, mc1, mc2) {
  if (!isNum(w1) || w1 <= 0 || !isNum(mc1) || !isNum(mc2)) return null;
  if (mc1 <= 0 || mc1 >= 100 || mc2 <= 0 || mc2 >= 100) return null;
  if (mc1 <= mc2) return null;                 // not drying; this formula would report a weight gain
  return w1 * (100 - mc1) / (100 - mc2);
}
const CAVAN_KG = 50;   // PhilRice PalayCheck 2022: "cav - cavan (usually 50kg)"
const STORAGE_MC = { weeks_to_months: 14, months_8_12: 13, seed: 12, over_1_year: 9 };   // IRRI RKB
const SUN_DRYING = { layerCm: [2, 4], stirMinutes: 30, coverAboveGrainC: 50, coverAboveGrainSeedC: 42, seedAirMaxC: 43 };   // IRRI RKB
/* inp: {T, RH, weightKg, mc, cavanKg, storage:'weeks_to_months'|'months_8_12'|'seed'|'over_1_year'} */
function dryingDecision(inp) {
  const flags = [], src = ['ASABE_D245_ZHONG', 'UAEX_FSA1074', 'IRRI_DRYING', 'PALAYCHECK'];
  if (inp.RH < 25 || inp.RH > 90) flags.push('rh_outside_corroborated_table');
  if (inp.T < 10 || inp.T > 50) flags.push('temp_outside_corroborated_range');
  const emc = emcWetBasis(inp.T, inp.RH);
  const target = STORAGE_MC[inp.storage || 'weeks_to_months'];
  /* An unknown key used to leave the target undefined, whereupon the bisection for the humidity needed
     compared everything against undefined, every test failed, and the card reported one per cent. */
  if (!isNum(target)) return { code: 'unknown_storage_target', flags: flags.concat(['unknown_storage_target']), sources: src };
  const rhNeeded = rhForMoisture(inp.T, target);
  /* Palay off the field runs roughly 20-26% moisture; anything above 40 or at or below the target is
     either a typo or a crop that needs no drying, and the card says so rather than computing from it. */
  if (isNum(inp.mc) && (inp.mc <= 0 || inp.mc >= 100)) return { code: 'moisture_out_of_range', emcWb: emc, rhForTarget: rhNeeded, storageTarget: target, weightAtTarget: null, cavansAtTarget: null, practice: SUN_DRYING, flags: flags, sources: src };
  if (isNum(inp.mc) && inp.mc <= target) return { code: 'already_dry_enough', emcWb: emc, rhForTarget: rhNeeded, storageTarget: target, mc: inp.mc, weightAtTarget: null, cavansAtTarget: null, practice: SUN_DRYING, flags: flags, sources: src };
  if (isNum(inp.mc) && inp.mc > 40) flags.push('moisture_above_normal_harvest');
  const code = emc <= target ? 'can_reach_target' : 'not_assured_target';
  let w2 = null, cavans = null;
  if (isNum(inp.weightKg) && isNum(inp.mc)) {
    w2 = weightAfterDrying(inp.weightKg, inp.mc, target);
    cavans = w2 == null ? null : w2 / (isNum(inp.cavanKg) ? inp.cavanKg : CAVAN_KG);
  }
  return { code: code, emcWb: emc, rhForTarget: rhNeeded, storageTarget: target, weightAtTarget: w2, cavansAtTarget: cavans, practice: SUN_DRYING, flags: flags, sources: src };
}

/* =====================================================================
   10. HEAT AND COLD STRESS  [YOSHIDA1981, LUO2011, SATAKE1978, JAGADISH2007, HATFIELD2011, HATFIELD2015, QDAF_CTT]
   Each phase: lo = critical low (Tmin at or below -> cold), hi = critical high (Tmax at or above -> heat), watch = optional early warning.
   ===================================================================== */
const STRESS = {
  rice: { src: ['YOSHIDA1981', 'LUO2011', 'SATAKE1978', 'JAGADISH2007', 'HATFIELD2011'], phases: {
    /* Yoshida (1981) Table 2.4; where Yoshida gives a range the lower value is the cold line. */
    germination:            { lo: 10, hi: 45 }, seedling: { lo: 12, hi: 35 }, rooting: { lo: 16, hi: 35 }, tillering: { lo: 9, hi: 33 },
    panicle_initiation:     { lo: 15, hi: null }, panicle_differentiation: { lo: 15, hi: 38 },
    anthesis:               { lo: 22, hi: 35, watch: 33 }, ripening: { lo: 12, hi: 30 } } },
  maize: { src: ['HATFIELD2011', 'HATFIELD2015', 'QDAF_CTT'], phases: {
    germination: { lo: 12, hi: 35 }, vegetative: { lo: 10, hi: 35 }, flowering: { lo: 13, hi: 35, watch: 33 }, grain_fill: { lo: 13, hi: 33, watch: 30 } } },
  sweetcorn: { src: ['QDAF_CTT', 'HATFIELD2011'], phases: {
    germination: { lo: 12, hi: 35 }, vegetative: { lo: 10, hi: 35 }, flowering: { lo: 13, hi: 33 }, cob_fill: { lo: 13, hi: 33 } } },
  cabbage: { src: ['QDAF_CTT'], phases: { germination: { lo: 12, hi: 32 }, vegetative: { lo: 6.5, hi: 32 }, head_formation: { lo: 5, hi: 32, watch: 24 } } },
  potato: { src: ['QDAF_CTT'], phases: { establishment: { lo: 0, hi: 28 }, tuber_initiation: { lo: 0, hi: 29 }, tuber_growth: { lo: 0, hi: 32 }, maturation: { lo: 0, hi: 32 } } },
  tomato: { src: ['QDAF_CTT'], phases: { germination: { lo: 15, hi: 25 }, early_vegetative: { lo: 12, hi: 35 }, flowering: { lo: 10, hi: 27, days3: 29 }, fruit_growth: { lo: 0, hi: 32 } } },
  pepper: { src: ['QDAF_CTT'], phases: { juvenile: { lo: 10, hi: 31 }, flowering: { lo: 15, hi: 28 }, fruit: { lo: 10, hi: 31 } } },
  lettuce: { src: ['QDAF_CTT'], phases: { germination: { lo: 10, hi: 30 }, vegetative: { lo: 0, hi: 30 }, hearting: { lo: 0, hi: 28 } } },
  carrot: { src: ['QDAF_CTT'], phases: { germination: { lo: 5, hi: 35 }, vegetative: { lo: 0, hi: 35 }, root_development: { lo: 5, hi: 30 } } },
  cauliflower: { src: ['QDAF_CTT'], phases: { germination: { lo: 5, hi: 30 }, vegetative: { lo: 5, hi: 30 }, curd_induction: { lo: 20, hi: 27 }, curd_growth: { lo: 20, hi: 30 } } },
  broccoli: { src: ['QDAF_CTT', 'BJORKMAN1998'], phases: { germination: { lo: 5, hi: 31 }, vegetative: { lo: 10, hi: 35 }, head_growth: { lo: 10, hi: 32, watch: 30 } } }
};
/* days: [{Tmax, Tmin}] most recent last. Returns per-day codes and a summary. */
function stressCheck(cropId, phase, days) {
  const c = STRESS[cropId]; if (!c) return { error: 'no_thresholds_for_crop' };
  const ph = c.phases[phase]; if (!ph) return { error: 'unknown_phase' };
  if (!Array.isArray(days)) return { error: 'need_days' };
  const per = days.map(d => {
    const codes = [];
    if (ph.hi != null && d.Tmax >= ph.hi) codes.push('heat_above_threshold');
    else if (ph.watch != null && d.Tmax >= ph.watch) codes.push('heat_watch');
    if (ph.lo != null && d.Tmin <= ph.lo) codes.push('cold_at_or_below_threshold');
    return codes;
  });
  const heatDays = per.filter(c => c.includes('heat_above_threshold')).length;
  /* The run of days is QDAF's own rule, not this app's, and it has two parts that used to be applied
     separately and wrongly. Carey and Deuter state it: "To simulate the effects of high temperatures on
     consecutive days, we have used the critical temperature + 2 C for 3 days and applied this to each
     crops' threshold", their reason being that "plant stress caused by several days in a row above a
     critical temperature tends to tip the system into decline". So the window is three days and the bar
     is the critical temperature plus two, for every crop QDAF covers. This card used to run its own
     stricter rule alongside it, three days at the critical temperature itself, with the window and the
     bar both chosen here. That rule is gone. The one explicit days3 value carried for tomato at
     flowering, 29 against a critical temperature of 27, is QDAF's rule already worked out, and a test
     holds the two together. Crops whose thresholds come from elsewhere get no run-of-days verdict,
     because QDAF's rule is stated for QDAF's thresholds. */
  const qdafSourced = c.src.indexOf('QDAF_CTT') >= 0;
  const bar = ph.days3 != null ? ph.days3 : (qdafSourced && isNum(ph.hi) ? ph.hi + STRESS_RUN.overThresholdC : null);
  const runOfDays = isNum(bar) && days.length >= STRESS_RUN.days
    && days.slice(-STRESS_RUN.days).every(d => d.Tmax >= bar);
  return { thresholds: ph, perDay: per, heatDays: heatDays, threeConsecutiveHeat: runOfDays,
           runBarC: isNum(bar) ? bar : null, runDays: STRESS_RUN.days, sources: c.src };
}

/* =====================================================================
   11. FROST INDICATOR (qualitative)  [FAO_FROST, MARASIGAN2017, BASQUIAL2021, LAUNIO2020]
   ===================================================================== */
/* QDAF's consecutive-day rule, quoted in stressCheck above. [QDAF_CTT] */
const STRESS_RUN = { days: 3, overThresholdC: 2 };

const FROST = { dewPointLineC: 2.0 /* design assumption, stated on the card */,
  /* Marasigan (2017): 70% of MODIS-detected frost occurrences at land surface temperature at or below
     10 C, 57% at or below 9 C. A marker, not a threshold: 30% of her events were above it, her figure is
     a surface temperature rather than a screen reading, and what decides frost is how far the surface can
     radiate below the air. Comparison is 'at or below', matching the source. */
  singleDigitC: 10,
  /* Benguet frost season. Marasigan (2017): January has the highest frequency of occurrences at every
     threshold, followed by February; November has the least. Her recorded events fall in December,
     January and February. Launio et al. (2020): "Frost is known to occur from December to February",
     and farmers now expect episodes "until March". Marasigan et al. (2025) analyse November to March.
     Months are 1 to 12. This is Benguet; the app carries no frost climatology for anywhere else. */
  seasonCore: [12, 1, 2], seasonEdge: [11, 3], seasonPeak: 1,
  /* A reading only speaks to the coming night once the air has started cooling. Through the morning and
     the middle of the day it is still warming or at its daily peak, so the card refuses those readings
     instead of dressing them up as a verdict. The window used to open two hours BEFORE sunset, a number
     chosen here so that a farmer looking at dusk would still get an answer. It now opens at the FAO
     frost manual's own reading time, two hours AFTER sunset, so the card takes its readings when the
     cited method takes them. The cost is declared in UNVERIFIED as FROST_READING_WINDOW: the conditions
     this card tests, a clear sky and a still night, are visible before sunset, and the card now declines
     to judge from them. */
  /* The FAO frost manual takes its own reading two hours AFTER sunset, for the regression that
     predicts the night minimum, and it puts the minimum just before sunrise. Those two published times
     are what the card now uses to say how much a reading is worth, instead of the two round numbers it
     used to split the night on: a reading before the FAO time is early, one after it is the reading the
     published method is built around, and one inside the last hour before sunrise is taken at the
     minimum itself. Nothing here is a new quantity; it is the cited method's own clock. */
  faoReadingAfterSunsetH: 2, coldestWindowBeforeSunriseH: 1 };
/* Where a reading sits on the cited method's clock. Returns 'early', 'method' or 'at_minimum'. */
function frostReadingWeight(nowH, sunsetH, sunriseH) {
  const wrap = h => ((h % 24) + 24) % 24;
  if (wrap(sunriseH - nowH) <= FROST.coldestWindowBeforeSunriseH) return 'at_minimum';
  /* Hours since sunset, signed: the card accepts readings from two hours before sunset, so this runs
     from about -2 up to the length of the night. Anything above half a day is the evening before. */
  let since = wrap(nowH - sunsetH); if (since > 12) since -= 24;
  return since >= FROST.faoReadingAfterSunsetH ? 'method' : 'early';
}
/* All hours are local decimal hours, 0 to 24. Handles the window wrapping past midnight. */
function frostReadingUsable(nowH, sunsetH, sunriseH) {
  const start = ((sunsetH + FROST.faoReadingAfterSunsetH) % 24 + 24) % 24;
  const end = ((sunriseH % 24) + 24) % 24;
  return start > end ? (nowH >= start || nowH <= end) : (nowH >= start && nowH <= end);
}
/* month: 1 to 12. Returns 'peak', 'core', 'edge' or 'outside'. */
/* Where the Philippine frost record actually is. The reference point is the PAGASA Benguet
   agrometeorological station as Marasigan (2017) gives it; the elevation is her figure for Benguet.
   Frost in the Philippines is reported from the highlands, particularly Benguet (Basconcillo et al.,
   FROST-PH). No elevation threshold for frost is published, so none is applied: the card prints the
   comparison and lets the farmer see it. */
/* The box that decides whether the card tells a user they are outside the Philippines, and whether the
   frost card says the place is not in the frost record. It used to be 4 to 22 N and 116 to 127 E, with
   no source: the right shape, rounded outward from nothing in particular. These are the published
   bounds of the Philippine 12 nautical mile territorial sea [PH_BOUNDS]. Being the territorial sea
   rather than the coastline it is generous, which is the safe direction for a warning: it errs toward
   staying quiet near the coast rather than telling someone standing on Philippine soil that they are
   somewhere else. */
const PH_ENVELOPE = { minLat: 4.2138, maxLat: 21.4009, minLon: 116.6863, maxLon: 126.8063, source: 'PH_BOUNDS' };
function insidePH(lat, lon) {
  const E = PH_ENVELOPE;
  return isNum(lat) && isNum(lon) && lat >= E.minLat && lat <= E.maxLat && lon >= E.minLon && lon <= E.maxLon;
}

const BENGUET = { lat: 16.46, lon: 120.59, place: 'the PAGASA Benguet agrometeorological station at La Trinidad', elevM: 1524, recordLowM: 900, recordHighM: 1600, towns: 'Atok, Buguias, Kabayan, Kibungan and Mankayan' };
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371, p = Math.PI / 180;
  const dLat = (lat2 - lat1) * p, dLon = (lon2 - lon1) * p;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * p) * Math.cos(lat2 * p) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}
function frostSeason(month) {
  if (month === FROST.seasonPeak) return 'peak';
  if (FROST.seasonCore.indexOf(month) >= 0) return 'core';
  if (FROST.seasonEdge.indexOf(month) >= 0) return 'edge';
  return 'outside';
}
/* inp: {T, RH, sky:'clear'|'partly'|'overcast', wind:'calm'|'light'|'breezy', hollow:bool, elev} */
function frostIndicator(inp) {
  const td = tdewFromEa(es0(inp.T) * inp.RH / 100);
  const conds = { clear: inp.sky === 'clear', partlyClear: inp.sky === 'partly', calm: inp.wind === 'calm' || inp.wind === 'light', lowDewPoint: td <= FROST.dewPointLineC, cold: inp.T <= FROST.singleDigitC, hollow: !!inp.hollow };
  let code, ruledOutBy = null;
  // Cloud and wind suppress radiative cooling, so they rule frost out, but only while they last: both
  // can lift at any hour, and then cooling starts. The card reports which one is holding frost off so
  // the farmer knows what would undo the answer. Air temperature is different again: it falls all
  // night, so an evening reading can never rule frost out, and a clear calm night returns at least
  // 'watch' however mild the thermometer reads.
  /* Only two things rule frost out, and both are things that can lift within the hour: thick cloud and
     a real wind. Partial cloud is neither. It slows radiative cooling without stopping it, and no source
     puts a number on how much, so a partly cloudy sky cannot be treated as an overcast one. It used to
     fall through to 'unlikely' here, which returned a green verdict at -2 C on a calm night with no
     reason attached. A sky that is not overcast, over a wind that is not breezy, now answers on the same
     ladder as a clear one, one rung lower: 'watch' where a clear sky would read 'possible'. */
  const ruledOut = inp.sky === 'overcast' || inp.wind === 'breezy';
  const openSky = !ruledOut && (inp.sky === 'clear' || inp.sky === 'partly');
  if (ruledOut) {
    code = 'unlikely';
    ruledOutBy = inp.sky === 'overcast' ? (inp.wind === 'breezy' ? 'sky_and_wind' : 'sky') : 'wind';
  }
  else if (conds.clear && conds.calm && conds.lowDewPoint && conds.cold) code = 'possible';
  else if (openSky && conds.calm) code = 'watch';
  else code = 'unlikely';
  return { code: code, ruledOutBy: ruledOutBy, dewPoint: td, conditions: conds, assumption: 'dew_point_line_2C', readingTimeSensitive: true, sources: ['FAO_FROST', 'MARASIGAN2017', 'BASQUIAL2021', 'LAUNIO2020'] };
}

/* =====================================================================
   12. DISEASE WEATHER (minimal)  [SENTELHAS2008, HUTTON]
   ===================================================================== */
/* Two things decide dew: how far the surface must cool to reach the dew point, and how fast it can.
   Cloud and wind slow the cooling, but they cannot stop a degree of it, so air already near saturation
   dews whatever the sky. The 2 C depression below which dew is called likely regardless of cloud is a
   design assumption of this app, stated on the card: FAO defines dew by the surface reaching the dew
   point and prints no such number. */
const DEW = { nearSaturationC: 2.0 };
/* Luo & Goudriaan (2000), Agric. For. Meteorol. 104(4):303-313. Dew onset and drying on rice top leaves
   checked visually every 15 min over 16 rain-free nights, February to April 1994, IR72, at IRRI Los Baños
   (14 deg 11' N, 121 deg 15' E, 20 m amsl). Section 3.1 gives the after-sunrise range; Table 3 gives the
   nightly totals for the 14 heavy dew nights. Measured values, not a model: nothing here is calculated. */
const DEW_RICE_LB = { afterSunriseLoH: 1.4, afterSunriseHiH: 3.4, nightLoH: 9.0, nightHiH: 12.8, nights: 14,
  shiftFromShieldingHiH: 2.0, site: 'IRRI Los Baños', variety: 'IR72', season: 'dry season, February to April' };
function dewTonight(T, RH, sky, wind) {
  const td = tdewFromEa(es0(T) * RH / 100);
  const depression = T - td;
  const clearCalm = (sky === 'clear') && (wind === 'calm' || wind === 'light');
  let code;
  if (depression <= DEW.nearSaturationC) code = 'dew_very_likely_near_saturation';
  else if (clearCalm) code = 'dew_likely_if_cools_to_dewpoint';
  else code = 'dew_less_likely';
  return { dewPoint: td, depression: depression, clearCalm: clearCalm, assumption: 'dew_near_saturation_2C', code: code, sources: ['FAO56', 'FAO_FROST'] };
}
/* Dew point and dew point depression from one reading of air temperature and humidity, FAO-56
   Eq. 11 and 14. This is a property of the air at the moment and place it is read, so unlike the
   frost verdict it carries no time-of-day condition and no sky or wind term. It is reported on its
   own so that a reading taken at any hour still yields the two numbers it can honestly yield. */
/* ---------- dew point and frost point from first principles ----------
   Romps (2021) derives explicit analytic expressions for both the dew point and the frost point from
   the Rankine-Kirchhoff approximations (ideal gas, fixed heat capacities, zero specific volume of
   condensates). He reports them accurate to within a few hundredths of a degree against modern
   laboratory measurements, over 230 to 330 K for the dew point and 180 to 273 K for the frost point.
   The constants are the optimised set he carries over from Romps (2017). Kelvin throughout. */
const RK = { cvv: 1418, ptrip: 611.65, Ttrip: 273.16, E0v: 2.3740e6, E0s: 0.3337e6, Rv: 461, cvl: 4119, cvs: 1861,
             dewLoK: 230, dewHiK: 330, frostLoK: 180, frostHiK: 273 };
RK.cpv = RK.cvv + RK.Rv;
const ZEROC = 273.15;
/* Eq. 3, saturation vapour pressure over liquid water, Pa */
function pvLiquidRK(T) {
  return RK.ptrip * Math.pow(T / RK.Ttrip, (RK.cpv - RK.cvl) / RK.Rv) *
    Math.exp((RK.E0v - (RK.cvv - RK.cvl) * RK.Ttrip) / RK.Rv * (1 / RK.Ttrip - 1 / T));
}
/* Eq. 4, saturation vapour pressure over ice, Pa */
function pvIceRK(T) {
  return RK.ptrip * Math.pow(T / RK.Ttrip, (RK.cpv - RK.cvs) / RK.Rv) *
    Math.exp((RK.E0v + RK.E0s - (RK.cvv - RK.cvs) * RK.Ttrip) / RK.Rv * (1 / RK.Ttrip - 1 / T));
}
/* Lambert W, lower branch, defined for -1/e <= x < 0. Halley iteration from the asymptotic start. */
function lambertWm1(x) {
  if (!(x < 0 && x >= -Math.exp(-1))) return NaN;
  let w = Math.log(-x); w = w - Math.log(-w);
  for (let i = 0; i < 100; i++) {
    const e = Math.exp(w), f = w * e - x, d = e * (w + 1) - (w + 2) * f / (2 * w + 2), step = f / d;
    w -= step;
    if (Math.abs(step) < 1e-14 * Math.abs(w)) break;
  }
  return w;
}
/* Lambert W, principal branch. The frost point's argument overflows double precision, so it is
   carried as its logarithm and expanded by the series of Corless et al. (1996) that Romps prints. */
function lambertW0FromLog(L1) {
  const L2 = Math.log(L1);
  return L1 - L2 + L2 / L1 + L2 * (-2 + L2) / (2 * L1 * L1) + L2 * (6 - 9 * L2 + 2 * L2 * L2) / (6 * L1 * L1 * L1) +
    L2 * (-12 + 36 * L2 - 22 * L2 * L2 + 3 * L2 * L2 * L2) / (12 * L1 * L1 * L1 * L1);
}
/* Eq. 5 and 6. T and the result in degrees Celsius, RH in percent. */
function dewPointRK(Tc, RH) {
  const T = Tc + ZEROC, c = (RK.E0v - (RK.cvv - RK.cvl) * RK.Ttrip) / ((RK.cpv - RK.cvl) * T);
  return c / lambertWm1(Math.pow(RH / 100, RK.Rv / (RK.cvl - RK.cpv)) * c * Math.exp(c)) * T - ZEROC;
}
/* Eq. 7, 8 and 9. RH is given over liquid water, as a hygrometer reports it, and converted to the
   humidity over ice that the frost point is defined against. */
function frostPointRK(Tc, RH) {
  const T = Tc + ZEROC, RHs = (RH / 100) * pvLiquidRK(T) / pvIceRK(T);
  const c = (RK.E0v + RK.E0s - (RK.cvv - RK.cvs) * RK.Ttrip) / ((RK.cpv - RK.cvs) * T);
  const logArg = (RK.Rv / (RK.cvs - RK.cpv)) * Math.log(RHs) + Math.log(c) + c;
  let W;
  if (logArg > 709) W = lambertW0FromLog(logArg);
  else {
    const x = Math.exp(logArg); W = Math.log(1 + x);
    for (let i = 0; i < 100; i++) {
      const e = Math.exp(W), f = W * e - x, d = e * (W + 1) - (W + 2) * f / (2 * W + 2), step = f / d;
      W -= step;
      if (Math.abs(step) < 1e-14 * Math.abs(W)) break;
    }
  }
  return c / W * T - ZEROC;
}
/* Magnus-form coefficient sets, for the comparison the card reports. The leading constant cancels
   when the input is a relative humidity, so only b and c are needed; the Buck (1996) form carries a
   fourth constant d. Every set here was read from a source named in REFS: no set is included whose
   published coefficients could not be checked. */
const DEWPOINT_SETS = [
  { id: 'fao56', b: 17.27, c: 237.3, ref: 'FAO56', name: 'FAO-56 (Tetens)' },
  { id: 'buck81', b: 17.502, c: 240.97, ref: 'BUCK1981', name: 'Buck (1981)' },
  { id: 'buck96', b: 18.678, c: 257.14, d: 234.5, ref: 'BUCK1996', name: 'Buck (1996), B\u00f6gel form' }
];
function dewPointMagnus(Tc, RH, set) {
  const g = Math.log(RH / 100) + (set.d ? (set.b - Tc / set.d) : set.b) * Tc / (set.c + Tc);
  return set.c * g / (set.b - g);
}
/* One reading of temperature and humidity, and everything that reading alone supports. The dew point
   the card leads with stays the FAO-56 one, because every other humidity quantity in this app is
   FAO-56 and two saturation curves in one program would disagree with each other. The alternatives
   are reported beside it so the reader can see how little the choice matters here. The frost point is
   withheld above freezing: Romps states his frost point over 180 to 273 K, and above the triple point
   the ice curve is an extrapolation with no ice to describe. */
function dewPointNow(T, RH) {
  if (!isNum(T) || !isNum(RH) || RH <= 0 || RH > 100) return { error: 'need_temperature_and_humidity' };
  const td = tdewFromEa(es0(T) * RH / 100);
  const compare = DEWPOINT_SETS.map(function (s) { return { id: s.id, name: s.name, ref: s.ref, dewPoint: dewPointMagnus(T, RH, s) }; });
  compare.push({ id: 'romps', name: 'Romps (2021), from first principles', ref: 'ROMPS2021', dewPoint: dewPointRK(T, RH) });
  const spread = Math.max.apply(null, compare.map(function (x) { return x.dewPoint; })) -
                 Math.min.apply(null, compare.map(function (x) { return x.dewPoint; }));
  const fp = frostPointRK(T, RH);
  const frostPoint = (isNum(fp) && fp <= 0) ? fp : null;
  return { dewPoint: td, depression: T - td, T: T, RH: RH,
           compare: compare, compareSpreadC: spread,
           frostPoint: frostPoint, frostPointWithheld: frostPoint === null ? 'above_freezing' : null,
           sources: frostPoint === null ? ['FAO56', 'ROMPS2021'] : ['FAO56', 'ROMPS2021'] };
}
/* Jackson (2017), Pacific Pests and Pathogens fact sheet 252: on rice, "the leaves need to be wet for
   6-8 hours for spore germination", with 24 to 28 C favourable and humidity near 100% needed for
   infection. Germination is the first step, not a diseased crop. */
const BLAST_WET = { germLoH: 6, germHiH: 8, favLoC: 24, favHiC: 28, src: 'PACIFICPESTS_BLAST' };

/* PAGASA publishes Leaf Wetness in the Farm Weather Forecast as a range across the forecast area,
   alongside the temperature and humidity ranges for that same area. Reported back as given, never
   converted. It is banded against the two published figures this app has: the 6 to 8 h rice blast
   spores need to germinate (Jackson 2017) and the 9.0 to 12.8 h dew actually lasted on lowland rice
   at Los Banos (Luo & Goudriaan 2000). Banding is on the UPPER figure, because that is the worst case
   inside the forecast area and the one worth acting on. No risk score is attached to any band. */
function leafWetnessReport(loH, hiH) {
  if (!isNum(loH) || !isNum(hiH)) return { code: 'lw_need_both', sources: ['PAGASA_FWFA'] };
  if (loH < 0 || hiH > 24 || loH > hiH) return { code: 'lw_out_of_range', sources: ['PAGASA_FWFA'] };
  const R = DEW_RICE_LB, B = BLAST_WET;
  let code;
  if (hiH < B.germLoH) code = 'lw_under_blast';
  else if (hiH < R.nightLoH) code = 'lw_at_blast';
  else if (hiH <= R.nightHiH) code = 'lw_dew_night';
  else code = 'lw_beyond_dew';
  /* A range can straddle the germination figure: the drier parts of the area stay under it while the
     wetter parts reach it. One verdict cannot say that, so the card adds a line when it happens. */
  const straddlesBlast = loH < B.germLoH && hiH >= B.germLoH;
  /* How bad the news is, which is not the same question as how long the wet spell is. Two things set it:
     which band the upper figure falls in, and whether the range starts below the germination figure. A
     range that starts below it always leaves part of the area in the clear, so it is never the flat
     verdict for its band, only the half-step below. The ladder is ordinal: longer wetness is worse for
     infection, but nothing published says by how much. */
  const NEWS = {
    lw_under_blast:  ['good',           'good'],
    lw_at_blast:     ['bad',            'somewhat_bad'],
    lw_dew_night:    ['worse',          'somewhat_worse'],
    lw_beyond_dew:   ['worst',          'worse']
  };
  const newsLevel = NEWS[code][straddlesBlast ? 1 : 0];
  return { code: code, loH: loH, hiH: hiH, spanH: hiH - loH, straddlesBlast: straddlesBlast, newsLevel: newsLevel,
    germLoH: B.germLoH, germHiH: B.germHiH, refLoH: R.nightLoH, refHiH: R.nightHiH,
    sources: ['PAGASA_FWFA', 'PACIFICPESTS_BLAST', 'LUO2000'] };
}

/* days: [{Tmin, hoursRH90}] last two days */
function huttonCriteria(days) {
  if (!days || days.length < 2) return { code: 'need_two_days', sources: ['HUTTON'] };
  const two = days.slice(-2);
  const met = two.every(d => d.Tmin >= 10 && d.hoursRH90 >= 6);
  return { code: met ? 'hutton_high_risk' : 'hutton_not_met', sources: ['HUTTON'], caveat: 'uk_not_tested_elsewhere' };
}

/* =====================================================================
   13. CROP TIMING  [MCMASTER1997, ORYZA2000, PHILRICE_VARIETIES]
   ===================================================================== */
/* McMaster and Wilhelm 1997: method 1 clamps the mean, method 2 clamps Tmax and Tmin; upper cap optional */
function gdd(Tmax, Tmin, base, cap, method) {
  if (method === 1) { let m = (Tmax + Tmin) / 2; if (m < base) m = base; if (isNum(cap) && m > cap) m = cap; return m - base; }
  let a = Tmax, b = Tmin;
  if (a < base) a = base; if (b < base) b = base;
  if (isNum(cap)) { if (a > cap) a = cap; if (b > cap) b = cap; }
  return (a + b) / 2 - base;
}
const GDD_BASE = { maize: { base: 10, cap: 30, src: 'MCMASTER1997' }, rice: { base: 8, cap: null, src: 'ORYZA2000' } };
/* PhilRice Pinoy Rice Knowledge Bank maturity days (verbatim page values); tp = transplanted, ds = direct seeded */
const RICE_VARIETIES = {
  'NSIC Rc222 (Tubigan 18)': { tp: 114, ds: 106 }, 'NSIC Rc216 (Tubigan 17)': { tp: 112, ds: 104 }, 'NSIC Rc160 (Tubigan 14)': { tp: 122, ds: 107 },
  'NSIC Rc218 SR (Mabango 3)': { ds: 120 }, 'NSIC Rc402 (Tubigan 36)': { tp: 114, ds: 107 }, 'NSIC Rc480 (GSR 8)': { ds: 107, saline: 121 },
  'NSIC Rc534 (Salinas 29)': { any: 131 }, 'NSIC Rc300 (Tubigan 24)': { tp: 115, ds: 105 }, 'PSB Rc18 (Ala)': { ds: 123 }, 'PSB Rc82 (Penaranda)': { ds: 110 },
  'NSIC Rc240 (Tubigan 22)': { tp: 115, ds: 108 }, 'NSIC Rc238 (Tubigan 21)': { any: 110 }, 'NSIC Rc226 (Tubigan 20)': { tp: 112, ds: 104 }
};
function harvestWindow(variety, method, sowDateUTC) {
  const v = RICE_VARIETIES[variety]; if (!v) return { error: 'unknown_variety' };
  let days = v[method] != null ? v[method] : (v.any != null ? v.any : (v.ds != null ? v.ds : v.tp));
  const basisFlag = v[method] != null ? null : 'maturity_basis_not_stated_for_method';
  /* Accept a Date or anything Date can parse, and decline rather than throw on neither. Clearing the
     sowing-date field used to take the whole timing card down with an invalid time value. */
  const sown = sowDateUTC instanceof Date ? sowDateUTC : (sowDateUTC != null ? new Date(sowDateUTC) : null);
  if (!sown || !isFinite(sown.getTime())) return { error: 'need_sowing_date' };
  const d = new Date(sown.getTime() + days * 86400000);
  return { days: days, date: d, plusMinusDays: 7 /* design assumption */, flag: basisFlag, sources: ['PHILRICE_VARIETIES'] };
}

/* =====================================================================
   14. UNITS
   ===================================================================== */
function mmToM3PerHa(mm) { return mm * 10; }
function pumpHours(m3, litresPerSecond) { return m3 * 1000 / (litresPerSecond * 3600); }
function kmhToMs(v) { return v / 3.6; }

/* =====================================================================
   REFS - every source used, by id. cls: primary | extension | regulatory | secondary
   ===================================================================== */
const REFS = {
  FAO56: { cls: 'primary', cite: 'Allen, R.G., Pereira, L.S., Raes, D., Smith, M. (1998). Crop evapotranspiration: guidelines for computing crop water requirements. FAO Irrigation and Drainage Paper 56.', url: 'https://www.fao.org/4/x0490e/x0490e00.htm' },
  FAO_TM3: { cls: 'primary', cite: 'Brouwer, C., Heibloem, M. (1986). Irrigation Water Needs. FAO Irrigation Water Management Training Manual 3, Part II Ch. 4.2.', url: 'https://www.fao.org/4/s2022e/s2022e08.htm' },
  FAO_TM4: { cls: 'primary', cite: 'Brouwer, C., Prins, K., Heibloem, M. (1989). Irrigation Scheduling. FAO Irrigation Water Management Training Manual 4, Annex I.', url: 'https://www.fao.org/4/t7202e/t7202e08.htm' },
  ROMPS2021: { cls: 'primary', cite: 'Romps, D.M. (2021). Accurate Expressions for the Dewpoint and Frost Point Derived from the Rankine-Kirchhoff Approximations. Journal of the Atmospheric Sciences 78(7): 2113-2116. Explicit analytic expressions for both points, accurate to within a few hundredths of a degree against laboratory measurement over 230 to 330 K for the dew point and 180 to 273 K for the frost point.', url: 'https://doi.org/10.1175/JAS-D-20-0301.1' },
  BUCK1981: { cls: 'primary', cite: 'Buck, A.L. (1981). New Equations for Computing Vapor Pressure and Enhancement Factor. Journal of Applied Meteorology 20(12): 1527-1532. Coefficients as compiled by Voemel (see VOEMEL_VP).', url: 'https://doi.org/10.1175/1520-0450(1981)020<1527:NEFCVP>2.0.CO;2' },
  BUCK1996: { cls: 'primary', cite: 'Buck, A.L. (1996). Buck Research CR-1A User\'s Manual, Appendix 1, revising the equations of Buck (1981). Coefficients as compiled by Voemel (see VOEMEL_VP).', url: 'https://doi.org/10.1175/1520-0450(1981)020<1527:NEFCVP>2.0.CO;2' },
  VOEMEL_VP: { cls: 'secondary', cite: 'Voemel, H. Water Vapor Pressure Formulations. National Center for Atmospheric Research. The compilation from which the Buck (1981) and Buck (1996) coefficients used here were read.', url: 'https://cires1.colorado.edu/~voemel/vp.html' },
  FAO_FROST: { cls: 'primary', cite: 'Snyder, R.L., de Melo-Abreu, J.P. (2005). Frost Protection: fundamentals, practice and economics, Vol. 1. FAO Environment and Natural Resources Series 10.', url: 'https://www.fao.org/4/y7223e/y7223e00.htm' },
  YOSHIDA1981: { cls: 'primary', cite: 'Yoshida, S. (1981). Fundamentals of Rice Crop Science. International Rice Research Institute, Los Baños. Table 2.4, critical temperatures by growth stage (adapted from Yoshida 1977a), and section 2.3.6, spikelet sterility when temperature exceeds 35 °C at anthesis for more than 1 hour.', url: 'http://books.irri.org/9711040522_content.pdf' },
  CARRIJO2017: { cls: 'primary', cite: 'Carrijo, D.R., Lundy, M.E., Linquist, B.A. (2017). Rice yields and water use under alternate wetting and drying irrigation: A meta-analysis. Field Crops Research 203: 173-180. 56 studies, 528 comparisons.', url: 'https://doi.org/10.1016/j.fcr.2016.12.002' },
  LI2024: { cls: 'primary', cite: 'Li, L., Huang, Z., Mu, Y. et al. (2024). Alternate wetting and drying maintains rice yield and reduces global warming potential: A global meta-analysis. Field Crops Research 318. 72 studies.', url: 'https://doi.org/10.1016/j.fcr.2024.109603' },
  PH_BOUNDS: { cls: 'primary', cite: 'Flanders Marine Institute (2023). Maritime Boundaries Geodatabase: Territorial Seas (12NM), version 4, record "Philippine 12 NM", MRGID 49051: minimum latitude 4.2138 N, maximum 21.4009 N; minimum longitude 116.6863 E, maximum 126.8063 E. The envelope is the territorial sea, so it takes in coastal waters as well as land.', url: 'https://doi.org/10.14284/633' },
  BEAUFORT: { cls: 'extension', cite: 'World Meteorological Organization Beaufort wind force scale, forces 0 to 4, as tabulated by the NOAA Storm Prediction Center: force 0 calm below 1 km/h, smoke rises vertically; force 1 light air 1.1 to 5.5 km/h, smoke drift indicates wind direction; force 2 light breeze 5.6 to 11 km/h, wind felt on exposed skin, leaves rustle; force 3 gentle breeze 12 to 19 km/h, leaves and twigs constantly moving; force 4 moderate breeze 20 to 28 km/h, dust and loose paper raised, small branches begin to move.', url: 'https://www.spc.noaa.gov/faq/tornado/beaufort.html' },
  IRROMETER: { cls: 'extension', cite: 'IRROMETER Company. Soil Water Basics: tensiometer reading ranges, 0-10 cb saturated, 10-30 adequately wet, 30-60 usual range for initiating irrigation in most soils.', url: 'https://www.irrometer.com/basics.html' },
  BOUMAN1994: { cls: 'primary', cite: 'Bouman, B.A.M., Wopereis, M.C.S., Kropff, M.J., ten Berge, H.F.M., Tuong, T.P. (1994). Water use efficiency of flooded rice fields II. Percolation and seepage losses. Agricultural Water Management 26(4): 291-304. Field experiment at IRRI, Los Banos, Philippines.', url: 'https://doi.org/10.1016/0378-3774(94)90007-8' },
  BOUMAN2007: { cls: 'primary', cite: 'Bouman, B.A.M., Lampayan, R.M., Tuong, T.P. (2007). Water Management in Irrigated Rice: Coping with Water Scarcity. IRRI.', url: 'http://books.irri.org/9789712202193_content.pdf' },
  IRRI_AWD: { cls: 'extension', cite: 'IRRI Rice Knowledge Bank. Saving water with alternate wetting drying (AWD); Water management.', url: 'http://www.knowledgebank.irri.org/training/fact-sheets/water-management/saving-water-alternate-wetting-drying-awd' },
  DA_AO25: { cls: 'regulatory', cite: 'Department of Agriculture (2009). Administrative Order No. 25 s. 2009, Guidelines for the adoption of water saving technologies in irrigated rice production systems in the Philippines, Section 5.', url: 'https://legaldex.com/laws/guidelines-for-the-adoption-of-water-saving-technologies-wst-in' },
  PHILRICE_AWD: { cls: 'extension', cite: 'PhilRice Pinoy Rice Knowledge Bank. Alternate Wetting and Drying (AWD).', url: 'https://www.pinoyrice.com/alternate-wetting-and-dryingawd/' },
  /* The observation well page is the source of the well itself: 25 cm long, at least 10 cm across, holes
     3-5 mm every 3 cm lengthwise and 5 cm apart crosswise, rings at 5 and 10 cm from the top for wet and
     dry season, installed to the ring, re-flooded to the top of the tube in the wet season and to 5 cm
     above ground in the dry. It publishes no gradation and no numeric reading: the rule it gives is
     whether water is visible in the well. */
  PINOYRICE_WELL: { cls: 'extension', cite: 'PhilRice Pinoy Rice Knowledge Bank. How to make Observation Well for Controlled Irrigation (Key Check 6, Water Management). Published 3 April 2018, last modified 7 February 2022.', url: 'https://www.pinoyrice.com/keycheck6-water-management/how-to-make-observation-well-for-controlled-irrigation' },
  /* The news item is a separate source from the Knowledge Bank page and carries different figures, so it is
     cited separately. Fredierick Saludez is the DA-PhilRice agriculturist quoted, not the author. It gives the
     2 to 3 cm pre-AWD depth, the 21 to 30 day start window, 5 cm through flowering and the 7 and 14 day
     pre-harvest drainage. It gives NO re-flood depth and no observation well dimensions, so nothing in this
     app may lean on it for either: the 15 and 20 cm come from DA AO 25-09, the well recipe from PINOYRICE_WELL. */
  PHILRICE_NEWS: { cls: 'extension', cite: 'Mendoza, C.A. (2022). Expert recommends technique to conserve water in rice farming. DA-PhilRice, 18 April 2022, quoting F. Saludez, DA-PhilRice agriculturist.', url: 'https://www.philrice.gov.ph/expert-recommends-technique-to-conserve-water-in-rice-farming/' },
  PALAYCHECK: { cls: 'extension', cite: 'PhilRice (2022). PalayCheck System, 2022 Revised Edition (Key Check 6; Key Check 8, harvesting at the right time: 85 to 90 per cent golden-yellow grains for manual harvest and 90 to 95 per cent by combine, 18 to 21 per cent moisture in the dry season and 20 to 25 per cent in the wet, field drained 1 to 2 weeks before harvest; Key Check 9; cavan 50 kg).', url: 'https://www.philrice.gov.ph/wp-content/uploads/2023/02/PalayCheck-System-2022-Revised-Edition.pdf' },
  GRDC2025: { cls: 'extension', cite: 'GRDC (2025). Practical tips for spraying, revised January 2025.', url: 'https://grdc.com.au/__data/assets/pdf_file/0025/618811/practical-tips-for-spraying-grdc-20250131.pdf' },
  GRDC2022: { cls: 'extension', cite: 'GRDC (2022). Weather essentials for pesticide application, grower edition.', url: 'https://grdc.com.au/__data/assets/pdf_file/0033/579525/GRDC_WeatherEssen2205_Grower_Final.pdf' },
  GRDC_MANUAL: { cls: 'extension', cite: 'GRDC. Spray Application Manual for Grain Growers, Module 10 (10.2, 10.3, 10.4).', url: 'https://grdc.com.au/resources-and-publications/grownotes/technical-manuals/spray-application-manual' },
  APVMA_LABEL: { cls: 'regulatory', cite: 'APVMA-approved label, Conquest CropCover Insecticide (approval 93445): spray drift restraints.', url: 'https://elabels.apvma.gov.au/93445ELBL.pdf' },
  AGVIC: { cls: 'extension', cite: 'Agriculture Victoria. Managing spray drift.', url: 'https://agriculture.vic.gov.au/farm-management/chemicals/spraying-agricultural-chemicals/managing-spray-drift' },
  ASABE_D245_ZHONG: { cls: 'secondary', cite: 'ASABE Standard D245.6 (2012) constants for long-grain rough rice as reproduced in Zhong, H. (2015), M.S. thesis, University of Arkansas, Tables 1.1 and 4.2.', url: 'https://scholarworks.uark.edu/cgi/viewcontent.cgi?article=2412&context=etd' },
  UAEX_FSA1074: { cls: 'extension', cite: 'Sadaka, S., Bautista, R. University of Arkansas Extension FSA1074, Grain drying tools: equilibrium moisture content tables (long-grain rice table used for corroboration).', url: 'https://www.uaex.uada.edu/publications/pdf/FSA-1074.pdf' },
  IRRI_DRYING: { cls: 'extension', cite: 'IRRI Rice Knowledge Bank: Drying; How to sun dry; Moisture content for safe storage; Moisture content calculations; Fundamentals of grain drying; training manual Paddy Drying.', url: 'http://www.knowledgebank.irri.org/step-by-step-production/postharvest/drying' },
  LUO2011: { cls: 'primary', cite: 'Luo, Q. (2011). Temperature thresholds and crop production: a review. Climatic Change 109:583-598.', url: 'https://doi.org/10.1007/s10584-011-0028-6' },
  SATAKE1978: { cls: 'primary', cite: 'Satake, T., Yoshida, S. (1978). High temperature-induced sterility in indica rices at flowering. Japanese Journal of Crop Science 47(1):6-17.', url: 'https://www.jstage.jst.go.jp/article/jcs1927/47/1/47_1_6/_article' },
  JAGADISH2007: { cls: 'primary', cite: 'Jagadish, S.V.K., Craufurd, P.Q., Wheeler, T.R. (2007). High temperature stress and spikelet fertility in rice. J. Exp. Bot. 58:1627-1635.', url: 'https://academic.oup.com/jxb/article/58/7/1627/512931' },
  HATFIELD2011: { cls: 'primary', cite: 'Hatfield, J.L. et al. (2011). Climate impacts on agriculture: implications for crop production. Agronomy Journal 103:351-370, Table 2.', url: 'https://digitalcommons.unl.edu/cgi/viewcontent.cgi?article=2355&context=usdaarsfacpub' },
  HATFIELD2015: { cls: 'primary', cite: 'Hatfield, J.L., Prueger, J.H. (2015). Temperature extremes: effect on plant growth and development. Weather and Climate Extremes 10:4-10.', url: 'https://doi.org/10.1016/j.wace.2015.08.001' },
  BJORKMAN1998: { cls: 'primary', cite: 'Bjorkman, T., Pearson, K.J. (1998). High temperature arrest of inflorescence development in broccoli. J. Exp. Bot. 49:101-106.', url: 'https://academic.oup.com/jxb/article-abstract/49/318/101/555642' },
  QDAF_CTT: { cls: 'extension', cite: 'Queensland Department of Agriculture and Fisheries, Drought and Climate Adaptation Program (Carey, Deuter, 2023-2024). Critical temperature thresholds for vegetables and sweet corn.', url: 'https://www.longpaddock.qld.gov.au/dcap/horticulture-industry/vegetable-threshold/' },
  BASQUIAL2021: { cls: 'primary', cite: 'Basquial, R.T. et al. (2021). Protected cultivation improves growth of Lollo Rossa lettuce under chilling conditions in Benguet, Philippines. J. ISSAAS 27(2):154-165.', url: 'http://issaasphil.org/wp-content/uploads/2021/12/12.-Basquial-et-al-2021-Lettuce-protected-cultivation-FINAL.pdf' },
  MARASIGAN2017: { cls: 'primary', cite: 'Marasigan, R.A.A. (2017). Characterization of Frost Events in Benguet, Philippines. M.S. Meteorology thesis, Institute of Environmental Science and Meteorology, University of the Philippines Diliman. 70% of MODIS-detected frost occurrences at land-surface temperature at or below 10 °C. DOI 10.13140/RG.2.2.24517.10727.', url: 'https://doi.org/10.13140/RG.2.2.24517.10727' },
  FROSTPH: { cls: 'extension', cite: 'DOST-PAGASA and DOST-NRCP. Frost Risk Observation and Support Tool (FROST-PH), introduced to Benguet LGUs on 22 April 2026: near real-time monitoring of frost events, reporting, assessment of occurrences, and access to frost risk data. Part of the FrostRiskPH project (September 2024 to August 2026), project leader Dr. Joseph Q. Basconcillo. PAGASA is the authority on frost in Benguet; where FROST-PH and this app differ, follow FROST-PH.', url: 'https://egallery.nrcp.dost.gov.ph/cluster/frost-ph-frost-risk-observation-and-support-tool-in-the-philippines/', urllabel: 'project abstract', url2: 'https://nrcp.dost.gov.ph/benguet-lgus-farmers-join-dost-in-designing-a-frost-risk-tool-for-highland-crops/', url2label: 'NRCP news' },
  CAUBA2025: { cls: 'primary', cite: 'Cauba, A.G. Jr., Darvishzadeh, R., Schlund, M., Nelson, A., Laborte, A. (2025). Estimation of transplanting and harvest dates of rice crops in the Philippines using Sentinel-1 data. Remote Sensing Applications: Society and Environment 37:101435. Harvest-date root mean squared differences against farmer-reported dates across 99 fields in Agusan del Sur, Cagayan and Leyte: 16 to 17.5 days in the dry season, 8 to 22 days in the wet.', url: 'https://doi.org/10.1016/j.rsase.2024.101435' },
  LAUNIO2020: { cls: 'primary', cite: 'Launio, C.C., Batani, R.S., Galagal, C., Follosco, R., Labon, K.O. (2020). Local knowledge on climate hazards, weather forecasts and adaptation strategies: case of cool highlands in Benguet, Philippines. Philippine Agricultural Scientist 103 (Special Issue): 67-79.', url: 'https://pas.uplb.edu.ph/journal-issues/local-knowledge-on-climate-hazards-weather-forecasts-and-adaptation-strategies-case-of-cool-highlands-in-benguet-philippines/' },
  SENTELHAS2008: { cls: 'primary', cite: 'Sentelhas, P.C. et al. (2008). Suitability of relative humidity as an estimator of leaf wetness duration. Agric. For. Meteorol. 148:392-400.', url: 'https://doi.org/10.1016/j.agrformet.2007.09.011' },
  PAGASA_FWFA: { cls: 'extension', cite: 'DOST-PAGASA daily Farm Weather Forecast and Advisories, among the agri-weather products: lowland and upland temperature and humidity, winds, leaf wetness in hours, soil moisture and farming advisories.', url: 'https://bagong.pagasa.dost.gov.ph/agri-weather' },
  PAGASA_CLIMATEMAP: { cls: 'extension', cite: 'DOST-PAGASA, CADS/IAAS CAD (2014). Climate Map of the Philippines (1951-2010), August 2014. Modified Coronas Climate Classification: "The modal of the yearly type of rainfall distribution during the 1951-2010 period in 45 synoptic and 66 climat stations were considered." Type I: two pronounced seasons, dry from November to April and wet during the rest of the year, maximum rain period from June to September. Type II: no dry season with a very pronounced maximum rain period from December to February; there is not a single dry month. Type III: no very pronounced maximum rain period, with a dry season lasting only from one to three months. Type IV: rainfall more or less evenly distributed throughout the year, no dry season.', url: 'https://www.pagasa.dost.gov.ph/information/climate-philippines' },
  PACIFICPESTS_BLAST: { cls: 'extension', cite: 'Jackson, G. (2017). Rice blast (252). Pacific Pests and Pathogens fact sheet, produced under ACIAR project PC/2010/090 with the University of Queensland and the Secretariat of the Pacific Community: "the leaves need to be wet for 6-8 hours for spore germination. High humidity, close to 100%, is needed for infection", with 24-28 C favourable.', url: 'https://apps.lucidcentral.org/ppp/text/web_full/entities/rice_blast_252.htm' },
  LUO2000: { cls: 'primary', cite: 'Luo, W. & Goudriaan, J. (2000). Dew formation on rice under varying durations of nocturnal radiative loss. Agric. For. Meteorol. 104(4):303-313.', url: 'https://doi.org/10.1016/S0168-1923(00)00168-4' },
  HUTTON: { cls: 'extension', cite: 'IPM Decisions (Horizon 2020) factsheet: Hutton Criteria late blight model (James Hutton Institute).', url: 'https://www.ipmdecisions.net/media/4jkcvxnf/ipm_factsheet-hutton-criteria-late-blight-model_v0001_print.pdf' },
  MCMASTER1997: { cls: 'primary', cite: 'McMaster, G.S., Wilhelm, W.W. (1997). Growing degree-days: one equation, two interpretations. Agric. For. Meteorol. 87:291-300.', url: 'https://digitalcommons.unl.edu/cgi/viewcontent.cgi?article=1086&context=usdaarsfacpub' },
  ORYZA2000: { cls: 'extension', cite: 'IRRI ORYZA2000 crop data file IR72.D92: TBD = 8, TOD = 30, TMD = 42 C.', url: 'https://sites.google.com/a/irri.org/oryza2000/tutorials/model-setup/appendix-5---ir72-d92' },
  PHILRICE_VARIETIES: { cls: 'extension', cite: 'PhilRice Pinoy Rice Knowledge Bank, rice variety pages (maturity in days).', url: 'https://www.pinoyrice.com/rice-varieties/' }
};
/* Items the app could not verify against a primary source (shown in the Sources module) */
/* Each entry names the cards whose answers rest on it. The interface renders the entry's own text into
   the assumptions block of every card listed, so the declaration required by R3(a) comes from the same
   object as the registry rather than from prose retyped on the card, and a card cannot use one of these
   quantities while quietly omitting the declaration. A card suppresses an entry only where the quantity
   is not in play in that particular answer, such as the tensiometer depth on a paddy read with a well.
   A test asserts that every entry names at least one card. */
const UNVERIFIED = [
  { id: 'D245_STANDARD', cards: ['dry'], text: 'ASABE D245.6/D245.7 could not be verified (the standard is paywalled); the rough-rice constants are taken from a thesis reproduction and corroborated against the University of Arkansas EMC table. IRRI\'s own EMC statements run about one percentage point lower.' },
  { id: 'SMITH1992', cards: ['rain'], text: 'CROPWAT effective rainfall methods are not implemented. The USDA-SCS table is verified in FAO Irrigation and Drainage Paper 25, Chapter II (Tables 7 and 8); the FAO/AGLW formula could not be verified against FAO Paper 46. This app uses the FAO Training Manual 3 formula instead.' },
  { id: 'FROST_DEWPOINT', cards: ['frost'], text: 'The 2 C dew-point line in the frost indicator is a design assumption. The FAO frost manual prints no threshold: its recommended method is a regression, Tmin = a T + b Td + c, from the temperature and dew point two hours after sunset on radiative frost nights, whose coefficients must be fitted locally from historical records. No such fit exists for Benguet, and neither Marasigan (2017) nor Launio et al. (2020) gives a dew-point value.' },
  { id: 'DEW_NEAR_SATURATION', cards: ['disease'], text: 'The 2 C dew-point depression below which the leaf-wetness card calls dew likely whatever the sky is a design assumption of this app. FAO defines dew by a surface reaching the dew point and prints no such number.' },
  { id: 'LEAF_WETNESS_DURATION', cards: ['disease'], text: 'Hours of leaf wetness are not calculated, because every published method needs an input this card does not have. The RH >= 90% estimator needs hourly humidity through the night (Sentelhas et al. 2008). The sigmoid on daily mean relative humidity used by Alsafadi et al. (2024), after Alvares et al. (2015) in Brazil, needs its three coefficients fitted locally, and no Philippine fit is published. Luo and Goudriaan (2000), the only Philippine study of dew duration on rice, drove its model with nocturnal net radiation measured by a net radiometer. What this card reports instead is their measured drying time.' },
  { id: 'HARVEST_PM7', cards: ['timing'], text: 'The plus or minus one week on the harvest window is a design assumption; PhilRice gives none, and it is probably optimistic. Cauba et al. (2025), estimating harvest dates for 99 Philippine rice fields from Sentinel-1 against farmer-reported dates, report root mean squared differences of 16 to 17.5 days in the dry season and 8 to 22 days in the wet. That is detection rather than prediction, but it is the closest published measure of how tightly a Philippine harvest date can be pinned, and it is wider than a week. The card therefore gives PhilRice PalayCheck Key Check 8 as the thing to judge by.' },
  { id: 'AWD_NO_DRY_SEASON', cards: ['rice'], text: 'The re-flood depth follows DA Administrative Order 25-09: 15 cm below the surface in the dry season and 20 cm in the wet. Two of the four Philippine climate types have no dry season at all (DOST-PAGASA Climate Map of the Philippines 1951-2010), and the Order does not say which depth applies there. Where there is no dry season this app tells the farmer to use the dry-season setting, 15 cm, because re-flooding earlier is the smaller mistake. That choice is an assumption of this app, not a published rule.' },
  { id: 'VEGETABLE_TEMPERATURES', cards: ['stress'], text: 'The vegetable critical temperatures are Queensland values (Queensland Department of Agriculture and Fisheries), not Philippine ones. The one Philippine document that prints temperatures for highland vegetables, the crop climate calendar for Atok, Benguet (Domingo, Umlas and Zuluaga 2020, PIDS Discussion Paper 2020-09), gives optimum ranges for cabbage, carrot and potato only, compiled from production manuals rather than measured at Atok, with no citation attached to the figures. An optimum range is not a damage threshold, so it is not used here.' },
  { id: 'TENSIOMETER_DEPTH', cards: ['rice'], text: 'The tensiometer trigger of 20 centibars is the mild-versus-severe AWD boundary of Carrijo, Lundy and Linquist (2017), who give it as -20 kPa alongside a field water level of 15 cm. What their figure does not fix, and this app therefore does not assume, is the depth at which the instrument sits. A tensiometer reads the soil around its cup, so the same field gives different numbers at different installation depths, and no Philippine guidance on where to place one in a paddy under AWD was found. The card states the trigger and tells the farmer to install the instrument in the root zone at about the depth the AWD tube monitors, which is an assumption of this app.' },
  { id: 'PH_ENVELOPE_IS_MARITIME', cards: ['frost'], text: 'Whether a place counts as being in the Philippines is decided here by the published bounds of the 12 nautical mile territorial sea. That envelope is a maritime boundary, and using it to answer a question about land is an assumption of this app. It was chosen because it is generous: it takes in coastal waters, so the card stays quiet near the shore rather than telling a farmer standing on Philippine soil that the place is somewhere else. The cost runs the other way, that a boat or a sandbar well off the coast is not questioned either.' },
  { id: 'FROST_READING_WINDOW', cards: ['frost', 'disease'], text: 'This card accepts a reading only from two hours after sunset until sunrise, which is when the FAO frost manual takes its own readings for the regression that predicts the night minimum. Applying that time here is an assumption of this app: the manual set it for a regression this card cannot run, because no local fit exists for Benguet, while what this card actually tests, a clear sky and a still night with dry air, is already visible before sunset. The card follows the published reading time rather than a wider one chosen here, and the cost is that a reading taken at dusk is refused even though the sky may already have told you the answer. Look again two hours after the sun goes down.' },
  { id: 'BEAUFORT_MIDPOINT', cards: ['spray'], text: 'Where the wind speed is chosen from what the trees are doing rather than measured, the description and the band are the WMO Beaufort scale, forces 0 to 4. The scale gives a band, not a number, and this card uses the midpoint of the band. That choice is an assumption of this app. A reading near the edge of a band can therefore sit on the wrong side of the 15 km/h spray limit, so where the answer is close to that limit the wind is worth measuring rather than judging.' },
  { id: 'READING_PRECISION', cards: ['rice'], text: 'The rice card dates the next irrigation by projecting the water level forward at the loss rate the farmer measured. Two figures in that projection are design assumptions of this app, not published values. The first is that a reading off a hand-marked tube or stick is good to about one centimetre, which is what sets the width of the date window and the rule that the level must have fallen at least about 3 cm between readings before a rate is worth using. The centimetre gradation itself is an addition of this app: the PhilRice observation well and the IRRI field water tube are both look-and-see devices, marked only at the depth that calls for water, and the published rule is whether water can still be seen in the well rather than how far down it is. The second is the one-week horizon beyond which the card gives no date, chosen because the canopy and the weather both change over longer periods. No published study gives the reading precision of a farmer-made AWD tube. The loss rate itself is not assumed: it is measured in the field, and compared against the Philippine seepage and percolation bands of Bouman et al. (1994). The projection is a planning aid in any case: the decision rule is the tube reading itself, as DA Administrative Order 25-09 and IRRI state it.' },
  { id: 'STRESS_NO_ACTION', cards: ['stress'], text: 'This app tells you when a temperature threshold has been crossed. It does not tell you what to do about it, because no published work ties a management response to a threshold being crossed under Philippine conditions. The nearest Philippine evidence is the shade-net crop shelter tested at Benguet State University under DOST-PCAARRD (Malamug 2018) and protected cultivation of lettuce under chilling in Benguet (Basquial et al. 2021); neither is tied to a temperature trigger. Follow DA and your local agriculturist on what to do.' }
];

const API = {
  // psychrometrics
  APSY, pressure, gamma, es0, esMean, slope, eaFromTdew, tdewFromEa, eaFromWetBulb, eaFromRH, eaFromRHmax, eaFromRHmean, eaFromTmin, wetBulb, deltaT, rhFromTdew,
  // radiation
  GSC, SIGMA, ALBEDO, AS, BS, KRS, MJ_TO_MM, dayOfYear, invRelDist, declination, sunsetAngle, Ra, daylight, RsAngstrom, Rso, Rns, Rnl, RsFromTemp, RsIsland, Gmonth, u2FromHeight, seasonalCorrection, sunTimes,
  // ETo
  etoPM, etoHargreaves, eto,
  // crops
  CROPS, RICE_KC_INI, RHMIN_CLASS, WIND_CLASS_MS, rhMinFromTemps, kcAdjust, kcOnDay, stageOnDay, cropKc,
  // soil water
  SOILS, soilMid, TAW, RAW, pAdjust, Ks, waterBalance, irrigationDecision,
  // rice
  AWD, awdDecision, continuousFloodDecision, intermittentDecision, riceWaterDecision, lossRate, project,
  SP, spClassify,
  TENSIOMETER, tensiometerDecision, METHOD_EVIDENCE,
  noInstrumentDecision,
  READ_SIGMA_CM, MIN_FALL_CM, PROJECT_HORIZON_DAYS,
  // rain
  effectiveRainMonthly,
  // spray
  SPRAY, sprayWindow,
  // drying
  EMC_HENDERSON_LONG_ROUGH, emcDryBasis, emcWetBasis, dbToWb, wbToDb, rhForMoisture, weightAfterDrying, CAVAN_KG, STORAGE_MC, SUN_DRYING, dryingDecision,
  // stress, frost, disease
  STRESS, STRESS_RUN, stressCheck, FROST, BENGUET, PH_ENVELOPE, insidePH, frostReadingWeight, haversineKm, frostIndicator, frostSeason, frostReadingUsable, DEW, DEW_RICE_LB, BLAST_WET, dewTonight, dewPointNow, RK, DEWPOINT_SETS, dewPointMagnus, dewPointRK, frostPointRK, pvLiquidRK, pvIceRK, lambertWm1, huttonCriteria, leafWetnessReport,
  // timing
  gdd, GDD_BASE, RICE_VARIETIES, harvestWindow,
  // units and refs
  mmToM3PerHa, pumpHours, kmhToMs, REFS, UNVERIFIED, round
};
if (typeof module !== 'undefined' && module.exports) module.exports = API;
root.AGRI = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
