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
  else if (isNum(inp.n)) { rs = RsAngstrom(clamp(inp.n, 0, N), N, ra); rsMethod = 'eq35_sunshine'; }
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
  if (cropId === 'rice') { kIni = RICE_KC_INI[o.riceHumidity || 'subhumid'][o.riceWind || 'moderate']; }
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
   6. LOWLAND RICE: SAFE AWD AND CONTINUOUS FLOODING  [IRRI_AWD, BOUMAN2007, DA_AO25, PHILRICE_AWD, PALAYCHECK]
   ===================================================================== */
const AWD = {
  triggerCm: { dry: 15, wet: 20 },          // DA AO 25-09; PhilRice observation well (IRRI: 15 cm all season)
  refloodCm: 5,                              // IRRI RKB, Bouman 2007, PhilRice
  startDays: [21, 30],                       // PhilRice: 21-30 days after transplanting or sowing (IRRI: 1-2 weeks)
  floweringFloodCm: 5,                       // IRRI, PhilRice (PalayCheck: 5-7 cm)
  floweringWindowDays: 7,                    // one week before to one week after flowering (IRRI, Bouman)
  drainBeforeHarvestDays: { light: 7, clay: 14 },   // PhilRice, PalayCheck
  preAwdDepthCm: [2, 3],                     // PhilRice (Saludez 2022): 2-3 cm before AWD starts
  continuous: { afterTransplantCm: 3, laterCm: [5, 10], drainBeforeHarvestDays: [7, 10] }   // IRRI RKB
};
/* inp: {daysAfterEstablish, daysToFlowering (negative after), daysToHarvest, season:'wet'|'dry', tubeBelowSurfaceCm (positive = below), pondedCm, weedsManaged, soil:'light'|'clay', pondDropCmPerDay} */
function awdDecision(inp) {
  const flags = [], src = ['IRRI_AWD', 'BOUMAN2007', 'DA_AO25', 'PHILRICE_AWD', 'PALAYCHECK'];
  const trig = AWD.triggerCm[inp.season === 'wet' ? 'wet' : 'dry'];
  const drainDays = AWD.drainBeforeHarvestDays[inp.soil === 'clay' ? 'clay' : 'light'];
  if (isNum(inp.daysToHarvest) && inp.daysToHarvest <= drainDays) return { code: 'drain_stop_irrigating', drainDays: drainDays, sources: src };
  if (isNum(inp.daysToFlowering) && Math.abs(inp.daysToFlowering) <= AWD.floweringWindowDays) {
    const ok = isNum(inp.pondedCm) && inp.pondedCm >= AWD.floweringFloodCm;
    return { code: ok ? 'flowering_keep_flooded' : 'flowering_top_up_to_5cm', targetCm: AWD.floweringFloodCm, sources: src };
  }
  if (isNum(inp.daysAfterEstablish) && inp.daysAfterEstablish < AWD.startDays[0]) return { code: 'before_awd_keep_shallow', depthCm: AWD.preAwdDepthCm, sources: src };
  if (inp.weedsManaged === false) { flags.push('postpone_awd_weeds'); }
  const reading = inp.tubeBelowSurfaceCm;
  if (!isNum(reading)) return { code: 'need_tube_reading', triggerCm: trig, flags: flags, sources: src };
  if (reading >= trig) return { code: 'reflood_now', triggerCm: trig, refloodCm: AWD.refloodCm, flags: flags, sources: src };
  let daysLeft = null;
  if (isNum(inp.pondDropCmPerDay) && inp.pondDropCmPerDay > 0) daysLeft = (trig - reading) / inp.pondDropCmPerDay;
  return { code: 'not_yet', triggerCm: trig, remainingCm: trig - reading, daysLeft: daysLeft, flags: flags, sources: src };
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
  maxAirTempC: 30                                                       // GRDC Weather essentials 2022
};
/* inp: {T, RH, P, windKmh, hoursToSunset, hoursAfterSunrise, mistFogDew, smokeHanging, labelMaxWindKmh} */
function sprayWindow(inp) {
  const reasons = [], src = ['GRDC2025', 'GRDC2022', 'GRDC_MANUAL', 'APVMA_LABEL', 'AGVIC'];
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
  const w = inp.windKmh, maxW = isNum(inp.labelMaxWindKmh) ? clamp(inp.labelMaxWindKmh, 15, 20) : 15;
  if (isNum(w)) {
    if (w < 3) { level = 2; reasons.push('wind_below_3'); }
    else if (w < SPRAY.windKmh.variableBelow) { level = Math.max(level, 1); reasons.push('wind_3_5_variable'); }
    if (w > maxW) { level = 2; reasons.push('wind_above_max'); }
  } else reasons.push('wind_unknown');
  // inversion window and indicators
  const night = (isNum(inp.hoursToSunset) && inp.hoursToSunset <= SPRAY.inversionBeforeSunsetH) || (isNum(inp.hoursAfterSunrise) && inp.hoursAfterSunrise <= SPRAY.inversionAfterSunriseH) || inp.isNight === true;
  if (night) {
    if (!isNum(w) || w < SPRAY.inversionNightWindKmh) { level = 2; reasons.push('inversion_window'); }
    else { level = Math.max(level, 1); reasons.push('inversion_window_windy'); }
  }
  if (inp.mistFogDew || inp.smokeHanging) { level = 2; reasons.push('inversion_indicators'); }
  // temperature
  if (inp.T > SPRAY.maxAirTempC) { level = Math.max(level, 1); reasons.push('temp_above_30'); }
  return { code: ['good', 'caution', 'do_not_spray'][level], deltaT: dT, deltaTBand: dtBand, wetBulb: inp.T - dT, reasons: reasons, sources: src };
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
function weightAfterDrying(w1, mc1, mc2) { return w1 * (100 - mc1) / (100 - mc2); }
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
  const rhNeeded = rhForMoisture(inp.T, 14);
  const code = emc <= 14 ? 'can_reach_14' : 'not_assured_14';
  let w2 = null, cavans = null;
  if (isNum(inp.weightKg) && isNum(inp.mc)) {
    w2 = weightAfterDrying(inp.weightKg, inp.mc, 14);
    cavans = w2 / (isNum(inp.cavanKg) ? inp.cavanKg : CAVAN_KG);
  }
  return { code: code, emcWb: emc, rhFor14: rhNeeded, storageTarget: target, weightAt14: w2, cavansAt14: cavans, practice: SUN_DRYING, flags: flags, sources: src };
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
  const per = days.map(d => {
    const codes = [];
    if (ph.hi != null && d.Tmax >= ph.hi) codes.push('heat_above_threshold');
    else if (ph.watch != null && d.Tmax >= ph.watch) codes.push('heat_watch');
    if (ph.lo != null && d.Tmin <= ph.lo) codes.push('cold_at_or_below_threshold');
    return codes;
  });
  const heatDays = per.filter(c => c.includes('heat_above_threshold')).length;
  const consecutive3 = days.length >= 3 && per.slice(-3).every(c => c.includes('heat_above_threshold'));
  const days3 = ph.days3 != null && days.length >= 3 && days.slice(-3).every(d => d.Tmax >= ph.days3);
  return { thresholds: ph, perDay: per, heatDays: heatDays, threeConsecutiveHeat: consecutive3 || days3, sources: c.src };
}

/* =====================================================================
   11. FROST INDICATOR (qualitative)  [FAO_FROST, MARASIGAN2017, BASQUIAL2021, LAUNIO2020]
   ===================================================================== */
const FROST = { dewPointLineC: 2.0 /* design assumption, stated on the card */, singleDigitC: 10,
  /* Benguet frost season. Marasigan (2017): January has the highest frequency of occurrences at every
     threshold, followed by February; November has the least. Her recorded events fall in December,
     January and February. Launio et al. (2020): "Frost is known to occur from December to February",
     and farmers now expect episodes "until March". Marasigan et al. (2025) analyse November to March.
     Months are 1 to 12. This is Benguet; the app carries no frost climatology for anywhere else. */
  seasonCore: [12, 1, 2], seasonEdge: [11, 3], seasonPeak: 1 };
/* month: 1 to 12. Returns 'peak', 'core', 'edge' or 'outside'. */
function frostSeason(month) {
  if (month === FROST.seasonPeak) return 'peak';
  if (FROST.seasonCore.indexOf(month) >= 0) return 'core';
  if (FROST.seasonEdge.indexOf(month) >= 0) return 'edge';
  return 'outside';
}
/* inp: {T, RH, sky:'clear'|'partly'|'overcast', wind:'calm'|'light'|'breezy', hollow:bool, elev} */
function frostIndicator(inp) {
  const td = tdewFromEa(es0(inp.T) * inp.RH / 100);
  const conds = { clear: inp.sky === 'clear', calm: inp.wind === 'calm' || inp.wind === 'light', lowDewPoint: td <= FROST.dewPointLineC, cold: inp.T < FROST.singleDigitC, hollow: !!inp.hollow };
  let code;
  // Cloud and wind suppress radiative cooling and do not change through the night, so they can rule
  // frost out. Air temperature falls all night, so an evening reading cannot: a clear, calm night
  // returns at least 'watch' however mild the thermometer reads when the farmer walks out.
  if (inp.sky === 'overcast' || inp.wind === 'breezy') code = 'unlikely';
  else if (conds.clear && conds.calm && conds.lowDewPoint && conds.cold) code = 'possible';
  else if (conds.clear && conds.calm) code = 'watch';
  else code = 'unlikely';
  return { code: code, dewPoint: td, conditions: conds, assumption: 'dew_point_line_2C', readingTimeSensitive: true, sources: ['FAO_FROST', 'MARASIGAN2017', 'BASQUIAL2021', 'LAUNIO2020'] };
}

/* =====================================================================
   12. DISEASE WEATHER (minimal)  [SENTELHAS2008, HUTTON]
   ===================================================================== */
function dewTonight(T, RH, sky, wind) {
  const td = tdewFromEa(es0(T) * RH / 100);
  const clearCalm = (sky === 'clear') && (wind === 'calm' || wind === 'light');
  return { dewPoint: td, code: clearCalm ? 'dew_likely_if_cools_to_dewpoint' : 'dew_less_likely', sources: ['FAO56', 'FAO_FROST'] };
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
  const d = new Date(sowDateUTC.getTime() + days * 86400000);
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
  FAO_FROST: { cls: 'primary', cite: 'Snyder, R.L., de Melo-Abreu, J.P. (2005). Frost Protection: fundamentals, practice and economics, Vol. 1. FAO Environment and Natural Resources Series 10.', url: 'https://www.fao.org/4/y7223e/y7223e00.htm' },
  YOSHIDA1981: { cls: 'primary', cite: 'Yoshida, S. (1981). Fundamentals of Rice Crop Science. International Rice Research Institute, Los Baños. Table 2.4, critical temperatures by growth stage (adapted from Yoshida 1977a), and section 2.3.6, spikelet sterility when temperature exceeds 35 °C at anthesis for more than 1 hour.', url: 'http://books.irri.org/9711040522_content.pdf' },
  BOUMAN2007: { cls: 'primary', cite: 'Bouman, B.A.M., Lampayan, R.M., Tuong, T.P. (2007). Water Management in Irrigated Rice: Coping with Water Scarcity. IRRI.', url: 'http://books.irri.org/9789712202193_content.pdf' },
  IRRI_AWD: { cls: 'extension', cite: 'IRRI Rice Knowledge Bank. Saving water with alternate wetting drying (AWD); Water management.', url: 'http://www.knowledgebank.irri.org/training/fact-sheets/water-management/saving-water-alternate-wetting-drying-awd' },
  DA_AO25: { cls: 'regulatory', cite: 'Department of Agriculture (2009). Administrative Order No. 25 s. 2009, Guidelines for the adoption of water saving technologies in irrigated rice production systems in the Philippines, Section 5.', url: 'https://legaldex.com/laws/guidelines-for-the-adoption-of-water-saving-technologies-wst-in' },
  PHILRICE_AWD: { cls: 'extension', cite: 'PhilRice Pinoy Rice Knowledge Bank. Alternate Wetting and Drying (AWD); Saludez (2022) in PhilRice news.', url: 'https://www.pinoyrice.com/alternate-wetting-and-dryingawd/' },
  PALAYCHECK: { cls: 'extension', cite: 'PhilRice (2022). PalayCheck System, 2022 Revised Edition (Key Checks 6 and 9; cavan 50 kg).', url: 'https://www.philrice.gov.ph/wp-content/uploads/2023/02/PalayCheck-System-2022-Revised-Edition.pdf' },
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
  FROSTPH: { cls: 'extension', cite: 'DOST-PAGASA and DOST-NRCP. Frost Risk Observation and Support Tool (FROST-PH), introduced to Benguet LGUs on 22 April 2026: near real-time monitoring of frost events, reporting, assessment of occurrences, and access to frost risk data. Part of the FrostRiskPH project (September 2024 to August 2026), project leader Dr. Joseph Q. Basconcillo. PAGASA is the authority on frost in Benguet; where FROST-PH and this app differ, follow FROST-PH.', url: 'https://nrcp.dost.gov.ph/benguet-lgus-farmers-join-dost-in-designing-a-frost-risk-tool-for-highland-crops/' },
  LAUNIO2020: { cls: 'primary', cite: 'Launio, C.C., Batani, R.S., Galagal, C., Follosco, R., Labon, K.O. (2020). Local knowledge on climate hazards, weather forecasts and adaptation strategies: case of cool highlands in Benguet, Philippines. Philippine Agricultural Scientist 103 (Special Issue): 67-79.', url: 'https://pas.uplb.edu.ph/journal-issues/local-knowledge-on-climate-hazards-weather-forecasts-and-adaptation-strategies-case-of-cool-highlands-in-benguet-philippines/' },
  SENTELHAS2008: { cls: 'primary', cite: 'Sentelhas, P.C. et al. (2008). Suitability of relative humidity as an estimator of leaf wetness duration. Agric. For. Meteorol. 148:392-400.', url: 'https://doi.org/10.1016/j.agrformet.2007.09.011' },
  HUTTON: { cls: 'extension', cite: 'IPM Decisions (Horizon 2020) factsheet: Hutton Criteria late blight model (James Hutton Institute).', url: 'https://www.ipmdecisions.net/media/4jkcvxnf/ipm_factsheet-hutton-criteria-late-blight-model_v0001_print.pdf' },
  MCMASTER1997: { cls: 'primary', cite: 'McMaster, G.S., Wilhelm, W.W. (1997). Growing degree-days: one equation, two interpretations. Agric. For. Meteorol. 87:291-300.', url: 'https://digitalcommons.unl.edu/cgi/viewcontent.cgi?article=1086&context=usdaarsfacpub' },
  ORYZA2000: { cls: 'extension', cite: 'IRRI ORYZA2000 crop data file IR72.D92: TBD = 8, TOD = 30, TMD = 42 C.', url: 'https://sites.google.com/a/irri.org/oryza2000/tutorials/model-setup/appendix-5---ir72-d92' },
  PHILRICE_VARIETIES: { cls: 'extension', cite: 'PhilRice Pinoy Rice Knowledge Bank, rice variety pages (maturity in days).', url: 'https://www.pinoyrice.com/rice-varieties/' }
};
/* Items the app could not verify against a primary source (shown in the Sources module) */
const UNVERIFIED = [
  { id: 'D245_STANDARD', text: 'ASABE D245.6/D245.7 could not be verified (the standard is paywalled); the rough-rice constants are taken from a thesis reproduction and corroborated against the University of Arkansas EMC table. IRRI\'s own EMC statements run about one percentage point lower.' },
  { id: 'SMITH1992', text: 'CROPWAT effective rainfall methods are not implemented. The USDA-SCS table is verified in FAO Irrigation and Drainage Paper 25, Chapter II (Tables 7 and 8); the FAO/AGLW formula could not be verified against FAO Paper 46. This app uses the FAO Training Manual 3 formula instead.' },
  { id: 'FROST_DEWPOINT', text: 'The 2 C dew-point line in the frost indicator is a design assumption; the FAO frost manual supports the physics but prints no number, and none of the Benguet sources consulted (Marasigan 2017; Launio et al. 2020) gives a dew-point value.' },
  { id: 'HARVEST_PM7', text: 'The plus or minus one week on the harvest window is a design assumption; PhilRice gives none.' }
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
  AWD, awdDecision,
  // rain
  effectiveRainMonthly,
  // spray
  SPRAY, sprayWindow,
  // drying
  EMC_HENDERSON_LONG_ROUGH, emcDryBasis, emcWetBasis, dbToWb, wbToDb, rhForMoisture, weightAfterDrying, CAVAN_KG, STORAGE_MC, SUN_DRYING, dryingDecision,
  // stress, frost, disease
  STRESS, stressCheck, FROST, frostIndicator, frostSeason, dewTonight, huttonCriteria,
  // timing
  gdd, GDD_BASE, RICE_VARIETIES, harvestWindow,
  // units and refs
  mmToM3PerHa, pumpHours, kmhToMs, REFS, UNVERIFIED, round
};
if (typeof module !== 'undefined' && module.exports) module.exports = API;
root.AGRI = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
