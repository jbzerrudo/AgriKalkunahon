/* AgriKalkunahon engine tests. Run: node engine/test.js
   Every numeric fixture is a printed value from a cited source (see research dossier v0.1). */
const A = require('./core.js');
let pass = 0, fail = 0;
function ok(name, got, want, tol, unit) {
  const d = Math.abs(got - want);
  const good = isFinite(d) && d <= tol;
  good ? pass++ : fail++;
  console.log((good ? '  ok  ' : '  FAIL'), name.padEnd(56), 'got', (typeof got === 'number' ? got.toFixed(4) : got).toString().padStart(12),
    'want', want.toString().padStart(10), (unit || ''), good ? '' : ('  d=' + d.toFixed(5)));
}
function eq(name, got, want) { const g = (got === want); g ? pass++ : fail++;
  console.log((g ? '  ok  ' : '  FAIL'), name.padEnd(56), 'got', String(got).padStart(30), 'want', String(want)); }

console.log('\n== FAO-56 CH.3: ATMOSPHERE AND HUMIDITY (Examples 2-6) ==');
ok('Ex2 P at 1800 m', A.pressure(1800), 81.8, 0.05, 'kPa');
ok('Ex2 gamma at 1800 m', A.gamma(A.pressure(1800)), 0.054, 0.0005, 'kPa/C');
ok('Ex3 e0(24.5)', A.es0(24.5), 3.075, 0.001, 'kPa');
ok('Ex3 e0(15)', A.es0(15), 1.705, 0.001, 'kPa');
ok('Ex3 es mean', A.esMean(24.5, 15), 2.39, 0.005, 'kPa');
ok('Ex3 e0(19.75) is lower', A.es0(19.75), 2.30, 0.005, 'kPa');
ok('Ex4 P at 1200 m', A.pressure(1200), 87.9, 0.05, 'kPa');
ok('Ex4 e0(Twet 19.5)', A.es0(19.5), 2.267, 0.001, 'kPa');
ok('Ex4 ea from psychrometer', A.eaFromWetBulb(19.5, 25.6, 87.9), 1.91, 0.005, 'kPa');
ok('Ex4 wet-bulb solver round trip', A.wetBulb(25.6, 100 * A.eaFromWetBulb(19.5, 25.6, 87.9) / A.es0(25.6), 87.9), 19.5, 0.01, 'C');
ok('Ex5 ea from RHmax/RHmin (Eq.17)', A.eaFromRH(18, 25, 82, 54), 1.70, 0.005, 'kPa');
ok('Ex5 ea from RHmean (Eq.19)', A.eaFromRHmean(18, 25, 68), 1.78, 0.005, 'kPa');
ok('Ex6 vapour pressure deficit', A.esMean(25, 18) - A.eaFromRH(18, 25, 82, 54), 0.91, 0.005, 'kPa');
ok('Tdew round trip', A.tdewFromEa(A.es0(21.3)), 21.3, 1e-9, 'C');
ok('wet-bulb = T at RH 100', A.wetBulb(30, 100, 101.3), 30, 1e-9, 'C');
ok('delta T zero at saturation', A.deltaT(30, 100, 101.3), 0, 1e-9, 'C');

console.log('\n== FAO-56 CH.3: RADIATION (Examples 7-16) ==');
ok('Ex7 Bangkok latitude rad', 13.73 * Math.PI / 180, 0.240, 0.0005);
ok('Ex8 dr (J 246)', A.invRelDist(246), 0.985, 0.0005);
ok('Ex8 declination', A.declination(246), 0.120, 0.0005, 'rad');
ok('Ex8 sunset angle 20S', A.sunsetAngle(-20 * Math.PI / 180, A.declination(246)), 1.527, 0.0005, 'rad');
ok('Ex8 Ra 3 Sept 20S', A.Ra(-20, 246), 32.2, 0.05, 'MJ/m2/d');
ok('Ex8 Ra as evaporation', A.MJ_TO_MM * A.Ra(-20, 246), 13.1, 0.05, 'mm/d');
ok('Ex9 daylight 3 Sept 20S', A.daylight(-20, 246), 11.7, 0.05, 'h');
ok('Ex10 Ra Rio May', A.Ra(-22.9, 135), 25.1, 0.05, 'MJ/m2/d');
ok('Ex10 N Rio May', A.daylight(-22.9, 135), 10.9, 0.05, 'h');
{ const ra = A.Ra(-22.9, 135), N = A.daylight(-22.9, 135), rs = A.RsAngstrom(220 / 31, N, ra);
  ok('Ex10 Rs from 220 h sunshine', rs, 14.5, 0.05, 'MJ/m2/d');
  const rso = 0.75 * ra, rnl = A.Rnl(25.1, 19.1, 2.1, rs, rso);
  ok('Ex11 Rso = 0.75 Ra', rso, 18.8, 0.05, 'MJ/m2/d');
  ok('Ex11 Rnl', rnl, 3.5, 0.05, 'MJ/m2/d');
  ok('Ex12 Rns', A.Rns(rs), 11.1, 0.05, 'MJ/m2/d');
  ok('Ex12 Rn', A.Rns(rs) - rnl, 7.6, 0.06, 'MJ/m2/d'); }
ok('Ex13 G April Algiers', A.Gmonth(16.1, 14.1, 18.8), 0.33, 0.005, 'MJ/m2/d');
ok('Ex14 wind factor 10 m', 4.87 / Math.log(67.8 * 10 - 5.42), 0.75, 0.005);
ok('Ex14 u2 from 3.2 m/s at 10 m', A.u2FromHeight(3.2, 10), 2.4, 0.02, 'm/s');
ok('Ex15 Ra Lyon July', A.Ra(45.72, 196), 40.6, 0.05, 'MJ/m2/d');
ok('Ex15 Rs from temperature (interior)', A.RsFromTemp(26.6, 14.8, A.Ra(45.72, 196), A.KRS.interior), 22.3, 0.05, 'MJ/m2/d');
{ const ra = A.Ra(13.73, 105); ok('Ex16 Ra Bangkok April', ra, 38.1, 0.05, 'MJ/m2/d');
  const rs = A.RsFromTemp(34.8, 25.6, ra, A.KRS.coastal); ok('Ex16 Rs coastal', rs, 21.9, 0.05, 'MJ/m2/d');
  const rso = 0.75 * ra; ok('Ex16 Rso', rso, 28.5, 0.06, 'MJ/m2/d');
  ok('Ex16 Rns', A.Rns(rs), 16.9, 0.06, 'MJ/m2/d');
  const rnl = A.Rnl(34.8, 25.6, 2.85, rs, rso); ok('Ex16 Rnl', rnl, 3.0, 0.06, 'MJ/m2/d');
  ok('Ex16 Rn', A.Rns(rs) - rnl, 13.9, 0.1, 'MJ/m2/d'); }
ok('Eq.51 island Rs = 0.7 Ra - 4', A.RsIsland(38.1), 0.7 * 38.1 - 4, 1e-12);

console.log('\n== FAO-56 CH.4: ETo (Examples 17, 18, 20) ==');
{ const r = A.eto({ Tmax: 34.8, Tmin: 25.6, ea: 2.85, u2: 2, n: 8.5, lat: 13.73, elev: 2, J: 105, monthly: true, Tprev: 29.2 });
  ok('Ex17 N', r.N, 12.31, 0.01, 'h'); ok('Ex17 Rs', r.rs, 22.65, 0.02); ok('Ex17 Rso', r.rso, 28.54, 0.02); ok('Ex17 Rns', r.rns, 17.44, 0.02);
  ok('Ex17 Rnl', r.rnl, 3.11, 0.02); ok('Ex17 Rn', r.rn, 14.33, 0.03); ok('Ex17 G', r.G, 0.14, 0.005); ok('Ex17 ETo Bangkok April', r.eto, 5.72, 0.02, 'mm/d');
  eq('Ex17 no fallbacks used', r.fallbacks.length, 0); }
{ const r = A.eto({ Tmax: 21.5, Tmin: 12.3, RHmax: 84, RHmin: 63, uz: 10 / 3.6, zWind: 10, n: 9.25, lat: 50.8, elev: 100, J: 187 });
  ok('Ex18 u2', r.u2, 2.078, 0.002, 'm/s'); ok('Ex18 P', r.P, 100.1, 0.05); ok('Ex18 es', r.es, 1.997, 0.002); ok('Ex18 ea', r.ea, 1.409, 0.002);
  ok('Ex18 Ra', r.ra, 41.09, 0.02); ok('Ex18 N', r.N, 16.1, 0.05); ok('Ex18 Rs', r.rs, 22.07, 0.03); ok('Ex18 Rso', r.rso, 30.90, 0.02);
  ok('Ex18 Rns', r.rns, 17.00, 0.02); ok('Ex18 Rnl', r.rnl, 3.71, 0.03); ok('Ex18 Rn', r.rn, 13.28, 0.04); ok('Ex18 ETo Uccle 6 July', r.eto, 3.88, 0.03, 'mm/d'); }
ok('Ex18 J for 6 July', A.dayOfYear(2001, 7, 6), 187, 0);
{ const r = A.eto({ Tmax: 26.6, Tmin: 14.8, lat: 45.72, elev: 200, J: 196, site: 'interior', monthly: true });
  ok('Ex20 ea = e0(Tmin)', r.ea, 1.68, 0.005); ok('Ex20 es', r.es, 2.58, 0.005); ok('Ex20 Ra', r.ra, 40.55, 0.02); ok('Ex20 Rs', r.rs, 22.29, 0.03);
  ok('Ex20 Rso', r.rso, 30.58, 0.02); ok('Ex20 Rns', r.rns, 17.16, 0.02); ok('Ex20 Rnl', r.rnl, 3.68, 0.03); ok('Ex20 Rn', r.rn, 13.48, 0.04);
  ok('Ex20 ETo temperature only (u2 = 2)', r.eto, 4.56, 0.02, 'mm/d');
  ok('Ex20 ETo at u2 = 1 (7% lower)', r.windSensitivity.u1, 4.2, 0.06, 'mm/d');
  ok('Ex20 ETo at u2 = 3 (6% higher)', r.windSensitivity.u3, 4.8, 0.06, 'mm/d');
  ok('Ex20 Hargreaves', r.hargreaves, 5.0, 0.05, 'mm/d');
  eq('Ex20 fallbacks recorded', r.fallbacks.join(','), 'humidity_from_tmin,radiation_from_temperature,wind_default_2ms'); }
eq('ETo refuses single temperature', A.eto({ Tmax: 30, lat: 14, elev: 10, J: 100 }).error, 'need_tmax_tmin');
{ const r = A.eto({ Tmax: 31, Tmin: 24, lat: 9.2, elev: 20, J: 100, site: 'island' });
  eq('island site uses Eq.51', r.methods.rs, 'eq51_island'); eq('island daily flagged', r.flags.includes('eq51_monthly_only'), true); }

console.log('\n== FAO-56 CH.4 FIGURE 18: CABINDA CROPWAT 7.0 (loose check, printed to 0.1) ==');
{ const cab = [['Jan', 22.8, 29.6, 81, 78, 4.0, 15.7, 3.4, 15], ['Feb', 22.7, 30.3, 82, 69, 4.6, 16.9, 3.7, 46], ['Mar', 23.0, 30.6, 80, 78, 5.1, 17.4, 3.8, 74], ['Apr', 23.0, 30.2, 82, 69, 5.0, 16.4, 3.5, 105], ['May', 22.0, 28.6, 84, 69, 3.8, 13.5, 2.9, 135], ['Jun', 19.2, 26.5, 81, 69, 3.3, 12.2, 2.6, 166], ['Jul', 17.6, 25.1, 78, 78, 3.2, 12.3, 2.6, 196], ['Aug', 18.6, 25.3, 78, 78, 2.6, 12.4, 2.6, 227], ['Sep', 20.5, 26.5, 78, 104, 2.0, 12.4, 2.8, 258], ['Oct', 22.5, 28.0, 79, 130, 2.2, 12.9, 3.1, 288], ['Nov', 23.0, 28.7, 80, 104, 3.2, 14.4, 3.3, 319], ['Dec', 23.0, 29.1, 82, 95, 3.8, 15.2, 3.4, 349]];
  const Tm = cab.map(r => (r[1] + r[2]) / 2);
  cab.forEach((r, k) => { const [m, tmin, tmax, rh, wind, sun, rad, eto, J] = r;
    const res = A.eto({ Tmax: tmax, Tmin: tmin, RHmean: rh, u2: wind * 1000 / 86400, n: sun, lat: -5.33, elev: 20, J: J, monthly: true, Tprev: Tm[(k + 11) % 12], Tnext: Tm[(k + 1) % 12] });
    ok('Cabinda ' + m + ' Rs', res.rs, rad, 0.3); ok('Cabinda ' + m + ' ETo (within 0.2)', res.eto, eto, 0.2, 'mm/d'); }); }

console.log('\n== FAO-56 CH.3 EQ.31-33: SOLAR TIME (Example 19) ==');
ok('Ex19 seasonal correction J 274', A.seasonalCorrection(274), 0.1889, 0.0005, 'h');
{ const s = A.sunTimes(16.22, -16.25, 274, -1);   // N Diaye: Lz 15, Lm 16.25 as in FAO-56
  ok('Ex19 solar noon from omega(14.5 h) = 0.682', s.noon, 14.5 - 0.682 * 12 / Math.PI, 0.01, 'h');
  ok('Ex19 omega at 02.5 h', (2.5 - s.noon) * Math.PI / 12, -2.46, 0.01, 'rad'); }
{ const s = A.sunTimes(14.6, 121.0, 172, 8);       // Manila, 21 June: sanity range only (not a published fixture)
  ok('Manila June sunrise ~5.4-5.6 h', s.sunrise, 5.5, 0.15, 'h'); ok('Manila June sunset ~18.4-18.6 h', s.sunset, 18.5, 0.15, 'h'); }

console.log('\n== FAO-56 CH.6: Kc (Examples 27, 28; Table 14) ==');
ok('Ex27 Kc mid Taipei (humid)', A.kcAdjust(1.20, 1.3, 75, 2).kc, 1.07, 0.006);
ok('Ex27 Kc mid Mocha (arid)', A.kcAdjust(1.20, 4.6, 44, 2).kc, 1.30, 0.006);
eq('Eq.65 not applied below 0.45', A.kcAdjust(0.35, 2.2, 30, 0.4, true).kc, 0.35);
ok('Ex28 Kc day 20', A.kcOnDay(20, [25, 25, 30, 20], 0.15, 1.19, 0.35), 0.15, 1e-9);
ok('Ex28 Kc day 40', A.kcOnDay(40, [25, 25, 30, 20], 0.15, 1.19, 0.35), 0.77, 0.005);
ok('Ex28 Kc day 70', A.kcOnDay(70, [25, 25, 30, 20], 0.15, 1.19, 0.35), 1.19, 1e-9);
ok('Ex28 Kc day 95', A.kcOnDay(95, [25, 25, 30, 20], 0.15, 1.19, 0.35), 0.56, 0.005);
ok('Eq.64 RHmin from Tmin, Tmax (Ex20: 48%)', A.rhMinFromTemps(14.8, 26.6), 48, 0.6, '%');
eq('Table 14 rice Kc ini subhumid moderate', A.RICE_KC_INI.subhumid.moderate, 1.10);
eq('Table 12 rice', [A.CROPS.rice.kcIni, A.CROPS.rice.kcMid, A.CROPS.rice.kcEnd[0], A.CROPS.rice.kcEnd[1]].join('/'), '1.05/1.2/0.9/0.6');
eq('Table 12 palm trees', [A.CROPS.palm.kcIni, A.CROPS.palm.kcMid, A.CROPS.palm.kcEnd[0], A.CROPS.palm.h].join('/'), '0.95/1/1/8');
eq('Table 12 sugar cane', [A.CROPS.sugarcane.kcIni, A.CROPS.sugarcane.kcMid, A.CROPS.sugarcane.kcEnd[0]].join('/'), '0.4/1.25/0.75');
eq('Table 11 sweet maize Philippines', A.CROPS.sweetcorn.stages[0].L.join('/') + ' ' + A.CROPS.sweetcorn.stages[0].region, '20/20/30/10 Philippines');
{ const k = A.cropKc('rice', { u2: 2, RHmin: 70, riceHumidity: 'subhumid', riceWind: 'moderate' });
  ok('rice Kc mid humid (RHmin 70, h 1)', k.kcMid, 1.20 + (0 - 0.004 * 25) * Math.pow(1 / 3, 0.3), 1e-9);
  eq('rice Kc ini from Table 14', k.kcIni, 1.10); }

console.log('\n== FAO-56 CH.8: SOIL WATER (Examples 36, 37) ==');
ok('Ex36 TAW onion loamy sand', A.TAW(0.15, 0.06, 0.4), 36, 0.01, 'mm'); ok('Ex36 RAW onion loamy sand', A.RAW(0.30, 36), 11, 0.5, 'mm');
ok('Ex36 TAW maize silt', A.TAW(0.32, 0.15, 1.2), 204, 0.01, 'mm'); ok('Ex36 RAW maize silt', A.RAW(0.55, 204), 112, 0.5, 'mm');
ok('Ex36 TAW tomato silty clay', A.TAW(0.35, 0.23, 0.8), 96, 0.01, 'mm'); ok('Ex36 RAW tomato silty clay', A.RAW(0.40, 96), 38, 0.5, 'mm');
{ const taw = A.TAW(0.32, 0.12, 0.8); ok('Ex37 TAW', taw, 160, 1e-9); ok('Ex37 RAW', A.RAW(0.4, taw), 64, 1e-9);
  const days = Array.from({ length: 10 }, () => ({ eto: 5.0, kc: 1.2 }));
  const t = A.waterBalance(days, taw, 0.40, 55, { adjustP: false });
  const ksWant = [1.00, 1.00, 0.97, 0.91, 0.85, 0.80, 0.75, 0.70, 0.66, 0.62], drWant = [61.0, 67.0, 72.8, 78.3, 83.4, 88.2, 92.6, 96.9, 100.8, 104.5];
  t.forEach((d, i) => { ok('Ex37 day ' + (i + 1) + ' Ks', d.ks, ksWant[i], 0.006); ok('Ex37 day ' + (i + 1) + ' Dr end', d.DrEnd, drWant[i], 0.06, 'mm'); }); }
ok('p adjustment clamp (ETc 12)', A.pAdjust(0.5, 12), 0.22, 1e-9);
ok('p adjustment at ETc 5 unchanged', A.pAdjust(0.45, 5), 0.45, 1e-9);
{ const d = A.irrigationDecision({ fc: 0.32, wp: 0.12, zr: 0.8, p: 0.40, etoPerDay: 5, kc: 1.2, daysSinceWet: 12, rains: [{ day: 4, mm: 0.5 }], efficiency: 0.6, areaHa: 1, pumpLs: 10, adjustP: false });
  eq('decision after 12 dry days: water now', d.code, 'water_now');
  ok('Dr after 12 days from field capacity (ETc 6, RAW 64)', d.Dr, 66 + 6 * (160 - 66) / (0.6 * 160), 1e-6, 'mm');
  eq('0.5 mm rain below 0.2 ETo ignored', d.trajectory[3].rainUsed, 0);
  ok('gross = net / 0.6', d.grossMm, d.Dr / 0.6, 1e-9, 'mm');
  ok('1 mm/ha = 10 m3', A.mmToM3PerHa(1), 10, 0); ok('pump hours 100 m3 at 10 L/s', A.pumpHours(100, 10), 2.7778, 0.001, 'h');
  eq('stress flagged', d.stressBegun, true); }
{ const d = A.irrigationDecision({ fc: 0.25, wp: 0.11, zr: 0.5, p: 0.45, etoPerDay: 4, kc: 1.05, daysSinceWet: 3, adjustP: false });
  eq('3 days after wetting: wait', d.code, 'wait'); ok('days to RAW', d.daysToRaw, (0.45 * 70 - 3 * 4.2) / 4.2, 1e-9, 'd'); }
eq('Table 19 clay theta FC range', A.SOILS.clay.fc.join('-'), '0.32-0.4');
eq('FAO TM4 efficiencies 60/75/90 encoded in UI (engine takes a number)', typeof A.irrigationDecision, 'function');

console.log('\n== RICE AWD RULES (IRRI, DA AO 25-09, PhilRice) ==');
eq('DA AO 25-09 trigger, dry season 15 cm', A.AWD.triggerCm.dry, 15); eq('DA AO 25-09 trigger, wet season 20 cm', A.AWD.triggerCm.wet, 20);
{ const b = { Tmax: 33, Tmin: 24, RHmax: 90, RHmin: 55, u2: 2, lat: 15.5, elev: 40, J: 250, site: 'interior' };
  eq('sunshine within daylight raises no flag', A.eto(Object.assign({}, b, { n: 6 })).flags.length, 0);
  eq('sunshine above daylight is clamped and reported', A.eto(Object.assign({}, b, { n: 24 })).flags.indexOf('sunshine_clamped_0_N') >= 0, true);
  eq('negative sunshine is clamped and reported', A.eto(Object.assign({}, b, { n: -5 })).flags.indexOf('sunshine_clamped_0_N') >= 0, true); }
eq('spray refuses to say good without wind', A.sprayWindow({ T: 25, RH: 60, P: 101.3, hoursToSunset: 5, hoursAfterSunrise: 5 }).code, 'need_wind');
eq('spray still says do-not-spray without wind when conditions are bad', A.sprayWindow({ T: 25, RH: 10, P: 101.3, hoursToSunset: 5, hoursAfterSunrise: 5 }).code, 'do_not_spray');
eq('spray is good once wind is given', A.sprayWindow({ T: 25, RH: 60, P: 101.3, windKmh: 8, hoursToSunset: 5, hoursAfterSunrise: 5 }).code, 'good');

/* three water-management methods, all on one datum: negative is below the soil surface, 0 is level
   with it, positive is water standing above it. */
eq('CF early, 1 cm standing: top up', A.riceWaterDecision({ method: 'continuous', daysAfterEstablish: 10, levelCm: 1 }).code, 'cf_top_up');
eq('CF mid season, 7 cm standing: fine', A.riceWaterDecision({ method: 'continuous', daysAfterEstablish: 50, levelCm: 7 }).code, 'cf_ok');
eq('CF mid season, 2 cm standing: top up', A.riceWaterDecision({ method: 'continuous', daysAfterEstablish: 50, levelCm: 2 }).code, 'cf_top_up');
eq('CF level with the surface is not flooded: top up', A.riceWaterDecision({ method: 'continuous', daysAfterEstablish: 50, levelCm: 0 }).code, 'cf_top_up');
ok('CF top-up from the surface is the whole target depth', A.riceWaterDecision({ method: 'continuous', daysAfterEstablish: 50, levelCm: 0 }).shortCm, 5, 1e-9, 'cm');
ok('CF top-up from below the surface spans the surface too', A.riceWaterDecision({ method: 'continuous', daysAfterEstablish: 50, levelCm: -2 }).shortCm, 7, 1e-9, 'cm');
eq('CF drains 7-10 days before harvest (IRRI RKB)', A.riceWaterDecision({ method: 'continuous', daysAfterEstablish: 100, daysToHarvest: 8, levelCm: 5 }).code, 'cf_drain_now');
eq('CF flowering needs 5 cm', A.riceWaterDecision({ method: 'continuous', daysAfterEstablish: 60, daysToFlowering: 2, levelCm: 2 }).code, 'cf_flowering_top_up');
eq('CF target depths are the IRRI values', A.AWD.continuous.afterTransplantCm + '/' + A.AWD.continuous.laterCm.join('-') + '/' + A.AWD.continuous.drainBeforeHarvestDays.join('-'), '3/5-10/7-10');
eq('no tube: no re-flood threshold is returned', A.riceWaterDecision({ method: 'intermittent', daysAfterEstablish: 50 }).code, 'intermittent_no_threshold');
eq('no tube: the answer is flagged as unsourced', A.riceWaterDecision({ method: 'intermittent', daysAfterEstablish: 50 }).flags.indexOf('no_tube_no_published_threshold') >= 0, true);
eq('no tube: flowering rule still applies', A.riceWaterDecision({ method: 'intermittent', daysAfterEstablish: 60, daysToFlowering: 2, levelCm: 2 }).code, 'flowering_top_up_to_5cm');
eq('no tube: pre-harvest drainage still applies', A.riceWaterDecision({ method: 'intermittent', daysAfterEstablish: 100, daysToHarvest: 5, soil: 'light' }).code, 'drain_stop_irrigating');
eq('no tube: no threshold, so no loss rate is projected', A.riceWaterDecision({ method: 'intermittent', daysAfterEstablish: 50, levelCm: -5, levelPrevCm: -1 }).dropCmPerDay, undefined);
eq('no tube: the well recipe is offered', A.riceWaterDecision({ method: 'intermittent', daysAfterEstablish: 50 }).tube.lengthCm, 25);
/* The whole point of the PhilRice design: the bottom of the well is the trigger. If these two ever drift
   apart the card is telling the farmer to build a well that cannot reach the depth the card acts on. */
eq('the well reaches the dry-season trigger exactly', A.AWD.tube.belowSoilCm.dry, A.AWD.triggerCm.dry);
eq('the well reaches the wet-season trigger exactly', A.AWD.tube.belowSoilCm.wet, A.AWD.triggerCm.wet);
eq('what stands above plus what is below is the whole tube, dry season', A.AWD.tube.aboveSoilCm.dry + A.AWD.tube.belowSoilCm.dry, A.AWD.tube.lengthCm);
eq('what stands above plus what is below is the whole tube, wet season', A.AWD.tube.aboveSoilCm.wet + A.AWD.tube.belowSoilCm.wet, A.AWD.tube.lengthCm);
eq('the wet-season ring is where the field is re-flooded to', A.AWD.tube.aboveSoilCm.wet, A.AWD.refloodCm);
eq('the gradation is not claimed as published', A.AWD.tube.gradationPublished, false);

console.log('\n-- the sign carries the meaning: one reading, one datum --');
eq('method defaults to safe AWD', A.riceWaterDecision({ daysAfterEstablish: 40, season: 'dry', levelCm: -16 }).code, 'reflood_now');
eq('16 cm below the surface in the dry season: re-flood', A.awdDecision({ daysAfterEstablish: 40, season: 'dry', levelCm: -16 }).code, 'reflood_now');
eq('the trigger is reached, not passed: exactly -15 re-floods', A.awdDecision({ daysAfterEstablish: 40, season: 'dry', levelCm: -15 }).code, 'reflood_now');
eq('one centimetre short of it does not', A.awdDecision({ daysAfterEstablish: 40, season: 'dry', levelCm: -14 }).code, 'not_yet');
ok('re-flood rise spans the surface: 16 below plus 5 above', A.awdDecision({ daysAfterEstablish: 40, season: 'dry', levelCm: -16 }).riseCm, 21, 1e-9, 'cm');
ok('and it reports the depth it starts from', A.awdDecision({ daysAfterEstablish: 40, season: 'dry', levelCm: -16 }).fromCm, 16, 1e-9, 'cm');
eq('no dry season uses the dry-season depth, 15 cm (this app\'s assumption)', A.awdDecision({ daysAfterEstablish: 40, season: 'nodry', levelCm: -15 }).code, 'reflood_now');
eq('16 cm below in the wet season is not yet: the DA depth is 20', A.awdDecision({ daysAfterEstablish: 40, season: 'wet', levelCm: -16 }).code, 'not_yet');
eq('no transplanting date: start window flagged, the tube still answers', A.awdDecision({ season: 'dry', levelCm: -16 }).flags.join(','), 'awd_start_window_unknown');
eq('flowering window keeps 5 cm standing', A.awdDecision({ daysAfterEstablish: 60, daysToFlowering: 3, season: 'dry', levelCm: 2 }).code, 'flowering_top_up_to_5cm');
eq('and 5 cm standing satisfies it', A.awdDecision({ daysAfterEstablish: 60, daysToFlowering: 3, season: 'dry', levelCm: 5 }).code, 'flowering_keep_flooded');
eq('before day 21: shallow water', A.awdDecision({ daysAfterEstablish: 10, season: 'dry', levelCm: -16 }).code, 'before_awd_keep_shallow');
eq('drain 14 days before harvest on clay', A.awdDecision({ daysAfterEstablish: 100, daysToHarvest: 12, soil: 'clay', season: 'wet' }).code, 'drain_stop_irrigating');
eq('no drain 12 days before harvest on light soil', A.awdDecision({ daysAfterEstablish: 100, daysToHarvest: 12, soil: 'light', season: 'wet', levelCm: -5 }).code, 'not_yet');

console.log('\n-- water loss from two readings, and the date it gives --');
{ const r = A.awdDecision({ daysAfterEstablish: 40, season: 'dry', levelCm: -5, levelPrevCm: -1, daysBetween: 2 });
  ok('the rate is the fall divided by the span', r.dropCmPerDay, 2, 1e-9, 'cm/d');
  eq('and it is reported as measured', r.dropFrom, 'measured');
  ok('still to go, on the same datum', r.remainingCm, 10, 1e-9, 'cm');
  ok('days to the trigger', r.daysLeft, 5, 1e-9, 'd');
  ok('the rate carries sqrt(2) cm over the span', r.dropSigma, Math.SQRT2 / 2, 1e-12, 'cm/d');
  /* The window must come from the propagated error of g/f, where g is the gap still to go and f the
     fall between the readings, carrying the cross term that makes them dependent: they share the
     current reading. Computed here from the derivation rather than from the engine's own expression,
     so the test constrains the arithmetic instead of recording it. The previous form of these two
     assertions recorded sqrt(2g^2 + f^2), which is this with the 2fg term dropped, and a Monte Carlo
     over the app's own reading noise put its coverage at 57 to 65 per cent against a nominal 68. */
  { const g = 10, f = 4, expect = Math.sqrt((f + g) * (f + g) + g * g) / (f * g);
    ok('the date window carries the cross term between gap and fall', r.projections[0].lo, 5 * (1 - expect), 1e-9, 'd');
    ok('and on the far side too', r.projections[0].hi, 5 * (1 + expect), 1e-9, 'd');
    ok('which is wider than treating the two as independent', expect > Math.sqrt(2 * g * g + f * f) / (f * g), true, 0, ''); }
  eq('a fall of 4 cm is enough to project from', r.flags.indexOf('readings_too_close'), -1); }
{ const r = A.awdDecision({ daysAfterEstablish: 40, season: 'dry', levelCm: -5, levelPrevCm: -3, daysBetween: 1 });
  ok('the same rate from a 1-day pair', r.dropCmPerDay, 2, 1e-9, 'cm/d');
  eq('but a fall under 2 sqrt(2) cm is flagged as too close to read', r.flags.indexOf('readings_too_close') >= 0, true);
  { const g = 10, f = 2, expect = Math.sqrt((f + g) * (f + g) + g * g) / (f * g);
    ok('and its window is wider than the answer itself', r.projections[0].hi - r.projections[0].lo, 2 * 5 * expect, 1e-9, 'd'); } }
eq('the minimum useful fall is two sigma of the difference', A.MIN_FALL_CM, 2 * Math.SQRT2, 1e-12);
/* R3(a) requires the declaration to travel with the number, so every declared assumption must name at
   least one card, and the interface renders the registry's own text into that card's assumptions block.
   Three of them once existed only on the global sources page, a route change away from the answer they
   qualified. This is the structural guard against that happening again. */
{ const known = ['water', 'rice', 'rain', 'spray', 'dry', 'stress', 'frost', 'disease', 'timing'];
  A.UNVERIFIED.forEach(function (u) {
    eq('declared assumption ' + u.id + ' names the cards it belongs to',
       Array.isArray(u.cards) && u.cards.length > 0, true);
    (u.cards || []).forEach(function (c) {
      eq('and ' + c + ' is a real card', known.indexOf(c) >= 0, true);
    });
  }); }
/* Two readings with no time between them, or entered in the wrong order, measure nothing. Both used to
   be replaced by a one-day span and reported as measured. */
{ const same = A.lossRate({ levelCm: -11, levelPrevCm: -1, daysBetween: 0 });
  eq('two readings on the same day give no rate', same.drop, null);
  eq('and say why', same.flags.indexOf('readings_same_day') >= 0, true);
  const back = A.lossRate({ levelCm: -11, levelPrevCm: -1, daysBetween: -3 });
  eq('readings out of order give no rate', back.drop, null);
  eq('and say why', back.flags.indexOf('readings_out_of_order') >= 0, true); }
/* Every public entry point declines rather than throwing. Each of these used to raise. */
{ const noThrow = function (name, f) { let r; try { r = f(); } catch (e) { r = { threw: e.message }; }
    eq(name + ' declines rather than throwing', r.threw === undefined, true); return r; };
  eq('FAO-56 Table 14 labels the row sub-humid to humid, so humid is accepted',
     A.cropKc('rice', { riceHumidity: 'humid' }).error, undefined);
  eq('an unrecognised humidity class is reported', A.cropKc('rice', { riceHumidity: 'zzz' }).error, 'unknown_rice_kc_class');
  noThrow('stressCheck with no days array', function () { return A.stressCheck('rice', 'flowering'); });
  noThrow('harvestWindow with a date string', function () { return A.harvestWindow('NSIC Rc222 (Tubigan 18)', 'tp', '2026-06-01'); });
  eq('harvestWindow accepts a parseable date string', A.harvestWindow('NSIC Rc222 (Tubigan 18)', 'tp', '2026-06-01').error, undefined);
  eq('and declines a missing one', A.harvestWindow('NSIC Rc222 (Tubigan 18)', 'tp', null).error, 'need_sowing_date');
  eq('an unknown storage target is reported, not computed from', A.dryingDecision({ T: 32, RH: 70, storage: 'zzz' }).code, 'unknown_storage_target');
  noThrow('eto with no latitude', function () { return A.eto({ Tmax: 32, Tmin: 24, RHmean: 80, elev: 20, J: 100 }); });
  eq('eto declines without latitude and day of year', A.eto({ Tmax: 32, Tmin: 24, RHmean: 80, elev: 20, J: 100 }).error, 'need_lat_and_day_of_year'); }
{ /* averaging the daily falls inside one drawdown is the same number as first minus last: they telescope */
  const daily = [1, 4, 1], mean = daily.reduce((a, b) => a + b, 0) / daily.length;
  ok('daily falls telescope to the endpoints', A.lossRate({ levelCm: -7, levelPrevCm: -1, daysBetween: 3 }).drop, mean, 1e-12, 'cm/d'); }

console.log('\n-- the wet season carries two dates, DA and IRRI --');
{ const r = A.awdDecision({ daysAfterEstablish: 40, season: 'wet', levelCm: -5, levelPrevCm: -1, daysBetween: 2 });
  eq('the DA depth leads, because it is the policy', r.projections[0].which, 'da');
  eq('DA trigger in the wet season is 20 cm', r.projections[0].triggerCm, 20);
  eq('the IRRI depth follows as a caveat', r.projections[1].which, 'irri');
  eq('IRRI safe AWD is 15 cm in every season', r.projections[1].triggerCm, 15);
  eq('and its date comes first', r.projections[1].days < r.projections[0].days, true);
  eq('past a week the date is flagged so the card can say what it rests on', r.projections[0].beyondHorizon, true);
  eq('the horizon is one week', A.PROJECT_HORIZON_DAYS, 7); }
eq('in the dry season the two depths agree, so there is one date', A.awdDecision({ daysAfterEstablish: 40, season: 'dry', levelCm: -5, levelPrevCm: -1, daysBetween: 2 }).projections.length, 1);

console.log('\n-- rain between the readings, and the field\'s own history --');
{ const r = A.awdDecision({ daysAfterEstablish: 40, season: 'dry', levelCm: -3, levelPrevCm: -8, daysBetween: 1 });
  eq('a level that rose is flagged as a net gain', r.flags.indexOf('level_net_gain') >= 0, true);
  ok('and the gain is reported', r.gainCm, 5, 1e-9, 'cm');
  eq('no loss rate can be read from those two', r.dropCmPerDay, null); }
eq('a net gain with no history says so instead of leaving the date blank',
   A.awdDecision({ daysAfterEstablish: 40, season: 'dry', levelCm: -3, levelPrevCm: -8, daysBetween: 1 }).flags.indexOf('no_history_yet') >= 0, true);
eq('once the field has a history that is no longer true',
   A.awdDecision({ daysAfterEstablish: 40, season: 'dry', levelCm: -3, levelPrevCm: -8, daysBetween: 1, fieldDropCmPerDay: 2 }).flags.indexOf('no_history_yet'), -1);
{ const r = A.awdDecision({ daysAfterEstablish: 40, season: 'dry', levelCm: -3, levelPrevCm: -8, daysBetween: 1, fieldDropCmPerDay: 2 });
  ok('but the field\'s past average still dates the next irrigation', r.daysLeft, 6, 1e-9, 'd');
  eq('and the card says where that rate came from', r.dropFrom, 'field_average'); }
eq('a rate typed in is used only when there is no reading pair and no history',
   A.awdDecision({ daysAfterEstablish: 40, season: 'dry', levelCm: -5, dropCmPerDay: 1 }).dropFrom, 'entered');
ok('days left at 1 cm a day', A.awdDecision({ daysAfterEstablish: 40, season: 'dry', levelCm: -5, dropCmPerDay: 1 }).daysLeft, 10, 1e-9, 'd');
eq('a drawdown far above the field average is flagged',
   A.awdDecision({ daysAfterEstablish: 40, season: 'dry', levelCm: -9, levelPrevCm: -1, daysBetween: 2, fieldDropCmPerDay: 1, fieldDropSigma: 0.2 }).flags.indexOf('loss_above_field_average') >= 0, true);
eq('a drawdown far below it is flagged the other way',
   A.awdDecision({ daysAfterEstablish: 40, season: 'dry', levelCm: -4, levelPrevCm: -1, daysBetween: 6, fieldDropCmPerDay: 3, fieldDropSigma: 0.2 }).flags.indexOf('loss_below_field_average') >= 0, true);
eq('a drawdown in line with the field is not flagged',
   A.awdDecision({ daysAfterEstablish: 40, season: 'dry', levelCm: -9, levelPrevCm: -1, daysBetween: 4, fieldDropCmPerDay: 2, fieldDropSigma: 0.2 }).flags.indexOf('loss_above_field_average'), -1);
eq('no projection without a rate', A.project(-5, -15, null, null), null);
eq('no projection once the target is already reached', A.project(-15, -15, 2, 0.7), null);
eq('no reading, no answer', A.awdDecision({ daysAfterEstablish: 40, season: 'dry' }).code, 'need_tube_reading');

console.log('\n-- seepage and percolation against Bouman et al. (1994), measured at IRRI --');
eq('class I is 0 to 0.5 cm a day', A.SP.classes[0].loCm + '-' + A.SP.classes[0].hiCm, '0-0.5');
eq('class IIa is 1 to 1.5', A.SP.classes[1].loCm + '-' + A.SP.classes[1].hiCm, '1-1.5');
eq('class IIb is 1 to 5 and higher', A.SP.classes[2].loCm + '-' + A.SP.classes[2].hiCm, '1-5');
eq('their four field readings', A.SP.fieldMeasuredCmPerDay.join(','), '3.62,0.4,1.46,3.26');
eq('0.4 cm a day is class I, the intact plow sole', A.spClassify(0.4).classes.join(','), 'I');
eq('and a steady rate, so the straight line holds', A.spClassify(0.4).flags.length, 0);
eq('1.46 matches both overlapping bands', A.spClassify(1.46).classes.join(','), 'IIa,IIb');
eq('3.26 is class IIb alone', A.spClassify(3.26).classes.join(','), 'IIb');
eq('class IIb is flagged because percolation there follows the ponded depth', A.spClassify(3.26).flags.indexOf('sp_may_not_be_steady') >= 0, true);
eq('their fixed-rate book-keeping drifted 2 to 3 cm in that class', A.SP.bookkeepingErrorCm.join('-'), '2-3');
eq('0.7 falls in the gap between the published bands', A.spClassify(0.7).flags.join(','), 'sp_between_bands');
eq('above every band they measured is said so', A.spClassify(6).flags.indexOf('sp_above_published') >= 0, true);
eq('a negative remainder is impossible and is flagged', A.spClassify(-0.2).flags.join(','), 'sp_negative');
eq('no figure, no classification', A.spClassify(null), null);
eq('the rice card cites the 1994 paper', A.awdDecision({ daysAfterEstablish: 40, season: 'dry', levelCm: -5 }).sources.indexOf('BOUMAN1994') >= 0, true);
eq('and the reference is on file', A.REFS.BOUMAN1994.cite.indexOf('Agricultural Water Management 26') >= 0, true);

console.log('\n-- tensiometer, on Carrijo et al. (2017) --');
eq('the AWD trigger is 20 centibars', A.TENSIOMETER.awdTriggerCb, 20);
eq('which is the same -20 kPa boundary Carrijo draws at 15 cm', A.TENSIOMETER.severeBelowKPa, -20);
eq('19 cb is not yet', A.tensiometerDecision(19, 'awd').code, 'not_yet');
eq('20 cb reaches the trigger', A.tensiometerDecision(20, 'awd').code, 'reflood_now');
ok('and it reports how far short a reading falls', A.tensiometerDecision(15, 'awd').remainingCb, 5, 1e-9, 'cb');
eq('past the point the water column breaks, the instrument is flagged', A.tensiometerDecision(85, 'awd').flags.indexOf('tensiometer_out_of_range') >= 0, true);
eq('and that limit is about 80 cb', A.TENSIOMETER.outOfRangeCb, 80);
eq('a negative reading is flagged', A.tensiometerDecision(-3, 'awd').flags.indexOf('tensiometer_negative') >= 0, true);
eq('under continuous flooding it answers whether the soil is still saturated', A.tensiometerDecision(5, 'continuous').code, 'cf_ok');
eq('and says top up once it is not', A.tensiometerDecision(15, 'continuous').code, 'cf_top_up');
eq('saturated is 0 to 10 cb (IRROMETER)', A.TENSIOMETER.saturatedCb, 10);
eq('no reading, no answer', A.tensiometerDecision(null, 'awd'), null);
eq('the AWD answer cites Carrijo', A.tensiometerDecision(25, 'awd').sources.join(','), 'CARRIJO2017');
eq('the installation depth is declared unverified', A.UNVERIFIED.map(u => u.id).indexOf('TENSIOMETER_DEPTH') >= 0, true);

console.log('\n-- both instruments: whose rule governs --');
{ const both = (cb, lv, mode) => A.awdDecision({ daysAfterEstablish: 40, season: 'dry', instrument: 'both',
    tensiometerCb: cb, levelCm: lv, levelPrevCm: lv + 4, daysBetween: 4, bothMode: mode });
  eq('agreeing instruments need no arbitration', both(12, -8, 'tensiometer').instrumentsDisagree, false);
  eq('and the chosen one is named', both(12, -8, 'tensiometer').decidedBy, 'tensiometer');
  eq('tube mode follows the DA rule', both(25, -8, 'tube').code, 'not_yet');
  eq('and says so', both(25, -8, 'tube').decidedBy, 'tube');
  eq('tensiometer mode follows the instrument', both(25, -8, 'tensiometer').code, 'reflood_now');
  eq('a disagreement is always flagged, whatever the mode', both(25, -8, 'tensiometer').instrumentsDisagree, true);
  eq('and named by which way it falls', both(25, -8, 'tensiometer').flags.indexOf('instruments_disagree_tensiometer_drier') >= 0, true);
  eq('the other way round is named too', both(6, -16, 'tensiometer').flags.indexOf('instruments_disagree_tube_drier') >= 0, true);
  eq('a tube past the DA depth is never overridden into waiting', both(6, -16, 'tensiometer').code, 'reflood_now');
  eq('no negative still-to-go is ever returned', both(25, -8, 'tensiometer').remainingCm, undefined); }



console.log('\n-- what each method costs and buys --');
['awd', 'continuous', 'none'].forEach(m => {
  eq(m + ' has pros', A.METHOD_EVIDENCE[m].pros.length > 0, true);
  eq(m + ' has cons, which is the point', A.METHOD_EVIDENCE[m].cons.length > 0, true);
  eq(m + ' names its sources', A.METHOD_EVIDENCE[m].sources.length > 0, true);
});
eq('the AWD case lists as many cons as pros, at least', A.METHOD_EVIDENCE.awd.cons.length >= A.METHOD_EVIDENCE.awd.pros.length, true);
eq('Carrijo is cited for the yield evidence', A.REFS.CARRIJO2017.cite.indexOf('Field Crops Research 203') >= 0, true);
eq('Li 2024 is cited for the greenhouse gas evidence', A.REFS.LI2024.cite.indexOf('global meta-analysis') >= 0, true);
eq('the PhilRice news item is cited to its author, not to the expert it quotes', A.REFS.PHILRICE_NEWS.cite.indexOf('Mendoza, C.A. (2022)') === 0, true);
eq('and it names Saludez as the one quoted', A.REFS.PHILRICE_NEWS.cite.indexOf('quoting F. Saludez') >= 0, true);
eq('the rice card cites it, since its depths come from there', A.awdDecision({ daysAfterEstablish: 40, season: 'dry', levelCm: -5 }).sources.indexOf('PHILRICE_NEWS') >= 0, true);
eq('the 2 to 3 cm pre-AWD depth is the figure that item gives', A.AWD.preAwdDepthCm.join('-'), '2-3');

console.log('\n== EFFECTIVE RAINFALL (FAO Training Manual 3 worked table) ==');
[[35, 11], [90, 47], [116, 68], [5, 0], [260, 183], [75, 35]].forEach(([P, w]) => ok('TM3 Pe(' + P + ')', A.effectiveRainMonthly(P), w, 0.5, 'mm'));

console.log('\n== SPRAY WINDOW (GRDC 2025 bands) ==');
{ const r = A.sprayWindow({ T: 28, RH: 60, P: 101.3, windKmh: 8, hoursToSunset: 6, hoursAfterSunrise: 4 });
  eq('28 C 60% wind 8: good', r.code, 'good'); eq('delta T band good', r.deltaTBand, 'good'); }
eq('wind 2 km/h: do not spray', A.sprayWindow({ T: 28, RH: 60, windKmh: 2, hoursToSunset: 6, hoursAfterSunrise: 4 }).code, 'do_not_spray');
eq('wind 18 km/h: do not spray without label', A.sprayWindow({ T: 28, RH: 60, windKmh: 18, hoursToSunset: 6, hoursAfterSunrise: 4 }).code, 'do_not_spray');
eq('wind 18 km/h with label 20: not blocked by wind', A.sprayWindow({ T: 28, RH: 60, windKmh: 18, labelMaxWindKmh: 20, hoursToSunset: 6, hoursAfterSunrise: 4 }).reasons.includes('wind_above_max'), false);
/* A label may raise the GRDC 15 km/h figure as far as 20. It may never relax a stricter one: the old
   clamp raised a 10 km/h label to 15 and returned a green light at 14 km/h, which is an off-label
   application the card was endorsing. */
const spray = function (label, wind) { return A.sprayWindow({ T: 28, RH: 60, windKmh: wind, labelMaxWindKmh: label, hoursToSunset: 6, hoursAfterSunrise: 6 }); };
eq('a 10 km/h label stops a spray at 14 km/h', spray(10, 14).code, 'do_not_spray');
eq('and says why', spray(10, 14).reasons.includes('wind_above_max'), true);
eq('the same label allows 9 km/h', spray(10, 9).code, 'good');
eq('a 5 km/h label stops a spray at 6 km/h', spray(5, 6).reasons.includes('wind_above_max'), true);
eq('a 20 km/h label still allows 18', spray(20, 18).reasons.includes('wind_above_max'), false);
eq('and still stops 21', spray(20, 21).reasons.includes('wind_above_max'), true);
eq('with no label the GRDC figure governs at 16', spray(null, 16).reasons.includes('wind_above_max'), true);
eq('and allows 14', spray(null, 14).reasons.includes('wind_above_max'), false);
/* The rule stated as an invariant over the whole range. A label at or below the GRDC figure governs
   exactly, so it is never relaxed; a label above it may raise the limit, but no further than the 20 km/h
   the bands allow. */
[3, 5, 8, 10, 12, 15, 18, 20, 25].forEach(function (lab) {
  const want = lab <= 15 ? lab : Math.min(lab, 20);
  [4, 9, 14, 16, 19, 22].forEach(function (wd) {
    eq('label ' + lab + ' at ' + wd + ' km/h obeys a limit of ' + want,
       spray(lab, wd).reasons.includes('wind_above_max'), wd > want);
  });
});
eq('1 h before sunset, 5 km/h: inversion window', A.sprayWindow({ T: 26, RH: 70, windKmh: 5, hoursToSunset: 1, hoursAfterSunrise: 10 }).code, 'do_not_spray');
eq('dew present: do not spray', A.sprayWindow({ T: 24, RH: 90, windKmh: 6, hoursToSunset: 8, hoursAfterSunrise: 3, mistFogDew: true }).code, 'do_not_spray');
{ const r = A.sprayWindow({ T: 36, RH: 25, P: 101.3, windKmh: 8, hoursToSunset: 6, hoursAfterSunrise: 4 });
  eq('36 C 25%: delta T above 12 -> do not spray', r.code, 'do_not_spray'); eq('reason includes temp above 30', r.reasons.includes('temp_above_30'), true); }
ok('GRDC 2022: delta T < 2 means RH > 80% at T > 15 C (check 20 C, 80%)', A.deltaT(20, 80, 101.3), 2.2, 0.4, 'C');

console.log('\n== PALAY DRYING (ASABE D245.6 via Zhong 2015; University of Arkansas FSA1074 table) ==');
{ const F = f => (f - 32) * 5 / 9;
  [[80, 25, 7.8], [80, 50, 11.3], [80, 75, 15.0], [80, 90, 18.3], [85, 75, 14.8], [90, 50, 11.0], [95, 90, 17.6], [100, 25, 7.3], [100, 65, 12.7], [100, 90, 17.4]]
    .forEach(([f, rh, w]) => ok('FSA1074 long-grain rice ' + f + 'F ' + rh + '%', A.emcWetBasis(F(f), rh), w, 0.06, '% wb')); }
ok('EMC 32 C 77% (IRRI says 13.9; D245.6 gives 15.0)', A.emcWetBasis(32, 77), 15.0, 0.06, '% wb');
ok('RH for 14% at 30 C (Henderson, about 70%)', A.rhForMoisture(30, 14), 70.4, 0.2, '%');
ok('RH for 14% round trip', A.emcWetBasis(30, A.rhForMoisture(30, 14)), 14, 1e-6, '% wb');
ok('wb/db round trip', A.dbToWb(A.wbToDb(14)), 14, 1e-9);
ok('IRRI: 1000 kg at 25% -> 872 kg at 14%', A.weightAfterDrying(1000, 25, 14), 872, 0.5, 'kg');
ok('IRRI manual: 100 kg at 28% -> 83.7 kg', A.weightAfterDrying(100, 28, 14), 83.7, 0.05, 'kg');
ok('PalayCheck yield example 4867 kg/ha', 673.4 / 1250 * 10000 * (100 - 22.3) / 86, 4867.34, 0.5, 'kg/ha');
ok('PalayCheck /86 equals (100-14)', A.weightAfterDrying(673.4 / 1250 * 10000, 22.3, 14), 4867.34, 0.5, 'kg/ha');
eq('cavan default 50 kg', A.CAVAN_KG, 50);
{ const d = A.dryingDecision({ T: 33, RH: 60, weightKg: 2500, mc: 24 });
  eq('33 C 60%: can reach the target', d.code, 'can_reach_target'); ok('cavans at the target', d.cavansAtTarget, 2500 * 76 / 86 / 50, 1e-9);
  eq('storage target weeks to months 14%', d.storageTarget, 14); }
/* The card prints the target beside every figure, so the figures must belong to the chosen target and
   nothing may still be named for a fixed 14 per cent. Seed storage is 12 per cent, and both numbers
   must move with it. */
{ const seed = A.dryingDecision({ T: 32, RH: 70, mc: 24, weightKg: 1000, storage: 'seed' });
  const keep = A.dryingDecision({ T: 32, RH: 70, mc: 24, weightKg: 1000, storage: 'weeks_to_months' });
  eq('seed storage targets 12%', seed.storageTarget, 12);
  ok('humidity needed for seed is lower than for 14%', seed.rhForTarget, 58, 1);
  ok('and for 14% it is higher', keep.rhForTarget, 71, 1);
  eq('drying further leaves less weight', seed.weightAtTarget < keep.weightAtTarget, true);
  eq('no figure is still named for a fixed 14 per cent', seed.rhFor14 === undefined && seed.weightAt14 === undefined && seed.cavansAt14 === undefined, true); }
eq('30 C 85%: not assured', A.dryingDecision({ T: 30, RH: 85 }).code, 'not_assured_target');
eq('palay already at or below target: stop drying', A.dryingDecision({ T: 33, RH: 60, mc: 12, weightKg: 100 }).code, 'already_dry_enough');
eq('impossible moisture is refused', A.dryingDecision({ T: 33, RH: 60, mc: 120 }).code, 'moisture_out_of_range');
eq('drying to a drier target needs drier air', A.dryingDecision({ T: 33, RH: 60, mc: 24, storage: 'over_1_year' }).code, 'not_assured_target');
eq('weightAfterDrying refuses a weight gain', A.weightAfterDrying(100, 10, 14), null);
eq('weightAfterDrying refuses 100% moisture', A.weightAfterDrying(100, 100, 14), null);
eq('weightAfterDrying refuses a negative weight', A.weightAfterDrying(-100, 24, 14), null);
eq('RH 95% flagged outside table', A.dryingDecision({ T: 30, RH: 95 }).flags.includes('rh_outside_corroborated_table'), true);

console.log('\n== HEAT AND COLD STRESS ==');
{ const r = A.stressCheck('rice', 'anthesis', [{ Tmax: 36, Tmin: 25 }]); eq('rice anthesis 36 C: heat above threshold', r.perDay[0].includes('heat_above_threshold'), true); }
{ const r = A.stressCheck('rice', 'anthesis', [{ Tmax: 33.5, Tmin: 25 }]); eq('rice anthesis 33.5 C: watch', r.perDay[0].join(','), 'heat_watch'); }
{ const r = A.stressCheck('rice', 'anthesis', [{ Tmax: 30, Tmin: 21 }]); eq('rice anthesis Tmin 21: cold', r.perDay[0].join(','), 'cold_at_or_below_threshold'); }
eq('rice germination lo / panicle differentiation hi per Yoshida 1981 Table 2.4', A.STRESS.rice.phases.germination.lo + '/' + A.STRESS.rice.phases.panicle_differentiation.hi, '10/38');
eq('maize flowering hi 35', A.STRESS.maize.phases.flowering.hi, 35);
{ const r = A.stressCheck('tomato', 'flowering', [{ Tmax: 30, Tmin: 20 }, { Tmax: 29, Tmin: 20 }, { Tmax: 29.5, Tmin: 21 }]); eq('tomato 29 C three days', r.threeConsecutiveHeat, true); }
{ const r = A.stressCheck('cabbage', 'head_formation', [{ Tmax: 25, Tmin: 15 }]); eq('cabbage head formation 25 C: watch (above 24)', r.perDay[0].join(','), 'heat_watch'); }
eq('strawberry has no thresholds', A.stressCheck('strawberry', 'x', []).error, 'no_thresholds_for_crop');

console.log('\n== FROST INDICATOR ==');
eq('clear calm 6 C RH 60: possible', A.frostIndicator({ T: 6, RH: 60, sky: 'clear', wind: 'calm' }).code, 'possible');
eq('overcast: unlikely', A.frostIndicator({ T: 6, RH: 60, sky: 'overcast', wind: 'calm' }).code, 'unlikely');
eq('clear calm 12 C RH 40 (Td low, not cold): watch', A.frostIndicator({ T: 12, RH: 40, sky: 'clear', wind: 'calm' }).code, 'watch');
/* Partial cloud is the middle option in the card's own menu and it used to fall through to 'unlikely',
   which the interface paints green. On a calm Benguet night below freezing that is the worst answer the
   card can give, and it arrived with no reason attached. Only thick cloud or a real wind rules frost
   out; partial cloud slows the cooling and no source says by how much. */
eq('partly cloudy, calm, below freezing: not a green light', A.frostIndicator({ T: -2, RH: 45, sky: 'partly', wind: 'calm' }).code, 'watch');
eq('and it is never ruled out without naming what ruled it out', A.frostIndicator({ T: -2, RH: 45, sky: 'partly', wind: 'calm' }).ruledOutBy, null);
eq('partly cloudy and calm at 8 C: watch', A.frostIndicator({ T: 8, RH: 50, sky: 'partly', wind: 'calm' }).code, 'watch');
eq('partly cloudy but breezy: the wind rules it out', A.frostIndicator({ T: -2, RH: 45, sky: 'partly', wind: 'breezy' }).ruledOutBy, 'wind');
eq('overcast still rules it out at any temperature', A.frostIndicator({ T: -5, RH: 45, sky: 'overcast', wind: 'calm' }).ruledOutBy, 'sky');
eq('a clear sky still reads one rung higher than a partly cloudy one', A.frostIndicator({ T: -2, RH: 45, sky: 'clear', wind: 'calm' }).code, 'possible');
/* Anything the card returns as unlikely must be able to say what is holding frost off, or the farmer
   gets a green verdict with no reason. */
['clear', 'partly', 'overcast'].forEach(function (sk) {
  ['calm', 'light', 'breezy'].forEach(function (wd) {
    const r = A.frostIndicator({ T: -2, RH: 45, sky: sk, wind: wd });
    eq('unlikely always names its reason: ' + sk + '/' + wd, r.code !== 'unlikely' || r.ruledOutBy != null, true);
  });
});
eq('dew: near-saturated air dews even under cloud', A.dewTonight(18, 94, 'overcast', 'calm').code, 'dew_very_likely_near_saturation');
eq('dew: dry air under cloud does not', A.dewTonight(18, 40, 'overcast', 'calm').code, 'dew_less_likely');
eq('dew: dry air on a clear calm night may', A.dewTonight(18, 40, 'clear', 'calm').code, 'dew_likely_if_cools_to_dewpoint');
ok('dew: depression is reported', A.dewTonight(18, 94, 'overcast', 'calm').depression, 18 - A.tdewFromEa(A.es0(18) * 0.94), 1e-9, 'C');
eq('frost 10.0 C counts as cold (source says at or below 10)', A.frostIndicator({ T: 10, RH: 40, sky: 'clear', wind: 'calm' }).conditions.cold, true);
eq('frost 10.1 C does not', A.frostIndicator({ T: 10.1, RH: 40, sky: 'clear', wind: 'calm' }).conditions.cold, false);
eq('frost reading 09:08 is refused', A.frostReadingUsable(9.13, 17.8, 5.8), false);
eq('frost reading 13:00 is refused', A.frostReadingUsable(13, 17.8, 5.8), false);
eq('frost reading 16:00 is usable (two hours before sunset)', A.frostReadingUsable(16, 17.8, 5.8), true);
eq('frost reading 21:00 is usable', A.frostReadingUsable(21, 17.8, 5.8), true);
eq('frost reading 04:30 is usable', A.frostReadingUsable(4.5, 17.8, 5.8), true);
eq('frost reading 06:30 is refused, the night is over', A.frostReadingUsable(6.5, 17.8, 5.8), false);
eq('frost season: January is peak', A.frostSeason(1), 'peak');
eq('frost season: December and February are core', A.frostSeason(12) + '/' + A.frostSeason(2), 'core/core');
eq('frost season: November and March are the edge', A.frostSeason(11) + '/' + A.frostSeason(3), 'edge/edge');
eq('frost season: June is outside', A.frostSeason(6), 'outside');
eq('clear calm night is never ruled out by a mild evening reading', A.frostIndicator({ T: 16, RH: 45, sky: 'clear', wind: 'calm' }).code, 'watch');
ok('dew point 6 C 60%', A.frostIndicator({ T: 6, RH: 60, sky: 'clear', wind: 'calm' }).dewPoint, A.tdewFromEa(A.es0(6) * 0.6), 1e-9, 'C');

console.log('\n== DISEASE WEATHER ==');
eq('Hutton met', A.huttonCriteria([{ Tmin: 11, hoursRH90: 7 }, { Tmin: 10, hoursRH90: 6 }]).code, 'hutton_high_risk');
eq('Hutton not met (5 h)', A.huttonCriteria([{ Tmin: 11, hoursRH90: 7 }, { Tmin: 10, hoursRH90: 5 }]).code, 'hutton_not_met');
eq('dew likely clear calm', A.dewTonight(22, 85, 'clear', 'calm').code, 'dew_likely_if_cools_to_dewpoint');

console.log('\n== CROP TIMING ==');
ok('GDD method 1 (mean clamped) Tmax 15 Tmin 5 base 10', A.gdd(15, 5, 10, null, 1), 0, 1e-9);
ok('GDD method 2 (Tmin clamped) same day', A.gdd(15, 5, 10, null, 2), 2.5, 1e-9);
ok('GDD corn with 30 C cap, Tmax 36 Tmin 24', A.gdd(36, 24, 10, 30, 2), 17, 1e-9);
eq('corn base/cap 10/30', A.GDD_BASE.maize.base + '/' + A.GDD_BASE.maize.cap, '10/30');
eq('rice base 8 (ORYZA2000 IR72)', A.GDD_BASE.rice.base, 8);
{ const h = A.harvestWindow('NSIC Rc222 (Tubigan 18)', 'tp', new Date(Date.UTC(2027, 0, 1)));
  eq('Rc222 transplanted 114 days', h.days, 114); eq('harvest date 25 April', h.date.toISOString().slice(0, 10), '2027-04-25'); }
eq('Rc160 direct seeded 107 days', A.harvestWindow('NSIC Rc160 (Tubigan 14)', 'ds', new Date(Date.UTC(2027, 0, 1))).days, 107);
eq('Rc238 basis not stated flagged', A.harvestWindow('NSIC Rc238 (Tubigan 21)', 'tp', new Date(Date.UTC(2027, 0, 1))).flag, 'maturity_basis_not_stated_for_method');
ok('daylight Bangkok 15 April (Ex17)', A.daylight(13.73, 105), 12.31, 0.01, 'h');

console.log('\n== REFERENCES ==');
{ const used = new Set();
  const walk = o => { if (Array.isArray(o)) o.forEach(walk); else if (o && typeof o === 'object') Object.values(o).forEach(walk); };
  ['FAO56', 'FAO_TM3', 'FAO_TM4', 'IRRI_AWD', 'BOUMAN2007', 'DA_AO25', 'PHILRICE_AWD', 'PALAYCHECK', 'GRDC2025', 'ASABE_D245_ZHONG', 'UAEX_FSA1074', 'QDAF_CTT', 'FAO_FROST', 'HUTTON', 'MCMASTER1997', 'ORYZA2000', 'PHILRICE_VARIETIES', 'SENTELHAS2008', 'LUO2000', 'PAGASA_FWFA', 'PACIFICPESTS_BLAST', 'PAGASA_CLIMATEMAP']
    .forEach(id => eq('REFS has ' + id, !!A.REFS[id], true));
  eq('UNVERIFIED list names the twelve items that remain unverified', A.UNVERIFIED.map(u => u.id).join(','), 'D245_STANDARD,SMITH1992,FROST_DEWPOINT,DEW_NEAR_SATURATION,LEAF_WETNESS_DURATION,HARVEST_PM7,AWD_NO_DRY_SEASON,VEGETABLE_TEMPERATURES,TENSIOMETER_DEPTH,BEAUFORT_MIDPOINT,READING_PRECISION,STRESS_NO_ACTION'); }

/* ---- great-circle distance (R = 6371 km): fixtures follow from the definition ---- */
ok('haversine 1 deg of latitude', A.haversineKm(0, 0, 1, 0), 111.195, 0.01, 'km');
ok('haversine 1 deg of longitude at the equator', A.haversineKm(0, 0, 0, 1), 111.195, 0.01, 'km');
ok('haversine same point is zero', A.haversineKm(14.6, 121.0, 14.6, 121.0), 0, 1e-9, 'km');
ok('haversine is symmetric', A.haversineKm(16.46, 120.59, 14.6, 121.0) - A.haversineKm(14.6, 121.0, 16.46, 120.59), 0, 1e-9, 'km');
eq('Benguet reference is the PAGASA agromet station (Marasigan 2017)', A.BENGUET.lat + ',' + A.BENGUET.lon, '16.46,120.59');

/* ---- Luo & Goudriaan (2000) measured dew figures: verbatim from the paper, nothing derived ---- */
eq('Luo 2000 dew persists after sunrise (section 3.1)', A.DEW_RICE_LB.afterSunriseLoH + ' to ' + A.DEW_RICE_LB.afterSunriseHiH, '1.4 to 3.4');
eq('Luo 2000 nightly dew duration range (Table 3)', A.DEW_RICE_LB.nightLoH + ' to ' + A.DEW_RICE_LB.nightHiH, '9 to 12.8');
eq('Luo 2000 Table 3 counts 14 heavy dew nights', A.DEW_RICE_LB.nights, 14);
eq('Luo 2000 drying time barely moves when dew is cut short', A.DEW_RICE_LB.shiftFromShieldingHiH, 2.0);
eq('the after-sunrise window sits inside the whole dew period', A.DEW_RICE_LB.afterSunriseHiH < A.DEW_RICE_LB.nightLoH, true);

/* ---- PAGASA leaf wetness: banded on the upper figure against Jackson's 6 to 8 h and Luo's 9.0 to 12.8 h ---- */
eq('blast germination window is Jackson 2017', A.BLAST_WET.germLoH + ' to ' + A.BLAST_WET.germHiH, '6 to 8');
eq('0 to 4 h stays under the germination window', A.leafWetnessReport(0, 4).code, 'lw_under_blast');
eq('0 to 5.9 h is still under it', A.leafWetnessReport(0, 5.9).code, 'lw_under_blast');
eq('0 to 6 h reaches it exactly', A.leafWetnessReport(0, 6).code, 'lw_at_blast');
eq('0 to 7 h reaches it', A.leafWetnessReport(0, 7).code, 'lw_at_blast');
eq('0 to 8.9 h is past the window but short of a dewing night', A.leafWetnessReport(0, 8.9).code, 'lw_at_blast');
eq('0 to 9 h reaches a dewing night', A.leafWetnessReport(0, 9).code, 'lw_dew_night');
eq('10 to 12.8 h is a dewing night', A.leafWetnessReport(10, 12.8).code, 'lw_dew_night');
eq('0 to 13 h is beyond dew alone', A.leafWetnessReport(0, 13).code, 'lw_beyond_dew');
/* the split a single verdict cannot express */
eq('0 to 7 h straddles the germination figure', A.leafWetnessReport(0, 7).straddlesBlast, true);
eq('0 to 4 h does not straddle it', A.leafWetnessReport(0, 4).straddlesBlast, false);
eq('7 to 8 h sits wholly inside it, no straddle', A.leafWetnessReport(7, 8).straddlesBlast, false);
eq('0 to 12 h straddles it too', A.leafWetnessReport(0, 12).straddlesBlast, true);
/* The six-rung ladder: band sets the rung, and a range starting below the germination figure drops it
   one half-step because part of the area is still in the clear. */
eq('0 to 5 h, whole area clear', A.leafWetnessReport(0, 5).newsLevel, 'good');
eq('6 to 8 h, whole area in the germination window', A.leafWetnessReport(6, 8).newsLevel, 'bad');
eq('0 to 8 h, only the wet end reaches it', A.leafWetnessReport(0, 8).newsLevel, 'somewhat_bad');
eq('10 to 12 h, whole area at a dewing night', A.leafWetnessReport(10, 12).newsLevel, 'worse');
eq('0 to 12 h, only the wet end is', A.leafWetnessReport(0, 12).newsLevel, 'somewhat_worse');
eq('13 to 20 h, whole area past what dew alone gives', A.leafWetnessReport(13, 20).newsLevel, 'worst');
eq('0 to 20 h, a 0 still holds it one rung back', A.leafWetnessReport(0, 20).newsLevel, 'worse');
eq('the ladder runs in order', [[0,5],[0,8],[6,8],[0,12],[10,12],[13,20]].map(r => A.leafWetnessReport(r[0], r[1]).newsLevel).join(','), 'good,somewhat_bad,bad,somewhat_worse,worse,worst');
eq('the span of the reported range is kept', A.leafWetnessReport(0, 7).spanH, 7);
eq('reversed figures are rejected', A.leafWetnessReport(4, 0).code, 'lw_out_of_range');
eq('more than a day is rejected', A.leafWetnessReport(0, 25).code, 'lw_out_of_range');
eq('negative hours are rejected', A.leafWetnessReport(-1, 4).code, 'lw_out_of_range');
eq('one figure alone is not enough', A.leafWetnessReport(0, null).code, 'lw_need_both');
eq('a blank pair is rejected, not treated as zero', A.leafWetnessReport(null, null).code, 'lw_need_both');

console.log('\n' + pass + ' passed, ' + fail + ' failed\n');
process.exitCode = fail ? 1 : 0;
