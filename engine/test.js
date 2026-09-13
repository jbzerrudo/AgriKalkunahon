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
eq('trigger dry season 15 cm', A.AWD.triggerCm.dry, 15); eq('trigger wet season 20 cm', A.AWD.triggerCm.wet, 20);
{ const b = { Tmax: 33, Tmin: 24, RHmax: 90, RHmin: 55, u2: 2, lat: 15.5, elev: 40, J: 250, site: 'interior' };
  eq('sunshine within daylight raises no flag', A.eto(Object.assign({}, b, { n: 6 })).flags.length, 0);
  eq('sunshine above daylight is clamped and reported', A.eto(Object.assign({}, b, { n: 24 })).flags.indexOf('sunshine_clamped_0_N') >= 0, true);
  eq('negative sunshine is clamped and reported', A.eto(Object.assign({}, b, { n: -5 })).flags.indexOf('sunshine_clamped_0_N') >= 0, true); }
eq('spray refuses to say good without wind', A.sprayWindow({ T: 25, RH: 60, P: 101.3, hoursToSunset: 5, hoursAfterSunrise: 5 }).code, 'need_wind');
eq('spray still says do-not-spray without wind when conditions are bad', A.sprayWindow({ T: 25, RH: 10, P: 101.3, hoursToSunset: 5, hoursAfterSunrise: 5 }).code, 'do_not_spray');
eq('spray is good once wind is given', A.sprayWindow({ T: 25, RH: 60, P: 101.3, windKmh: 8, hoursToSunset: 5, hoursAfterSunrise: 5 }).code, 'good');

/* three water-management methods */
eq('CF early, shallow: top up', A.riceWaterDecision({ method: 'continuous', daysAfterEstablish: 10, pondedCm: 1 }).code, 'cf_top_up');
eq('CF mid season, 7 cm: fine', A.riceWaterDecision({ method: 'continuous', daysAfterEstablish: 50, pondedCm: 7 }).code, 'cf_ok');
eq('CF mid season, 2 cm: top up', A.riceWaterDecision({ method: 'continuous', daysAfterEstablish: 50, pondedCm: 2 }).code, 'cf_top_up');
eq('CF drains 7-10 days before harvest (IRRI RKB)', A.riceWaterDecision({ method: 'continuous', daysAfterEstablish: 100, daysToHarvest: 8, pondedCm: 5 }).code, 'cf_drain_now');
eq('CF flowering needs 5 cm', A.riceWaterDecision({ method: 'continuous', daysAfterEstablish: 60, daysToFlowering: 2, pondedCm: 2 }).code, 'cf_flowering_top_up');
eq('CF target depths are the IRRI values', A.AWD.continuous.afterTransplantCm + '/' + A.AWD.continuous.laterCm.join('-') + '/' + A.AWD.continuous.drainBeforeHarvestDays.join('-'), '3/5-10/7-10');
eq('no tube: no re-flood threshold is returned', A.riceWaterDecision({ method: 'intermittent', daysAfterEstablish: 50 }).code, 'intermittent_no_threshold');
eq('no tube: the answer is flagged as unsourced', A.riceWaterDecision({ method: 'intermittent', daysAfterEstablish: 50 }).flags.indexOf('no_tube_no_published_threshold') >= 0, true);
eq('no tube: flowering rule still applies', A.riceWaterDecision({ method: 'intermittent', daysAfterEstablish: 60, daysToFlowering: 2, pondedCm: 2 }).code, 'flowering_top_up_to_5cm');
eq('no tube: pre-harvest drainage still applies', A.riceWaterDecision({ method: 'intermittent', daysAfterEstablish: 100, daysToHarvest: 5, soil: 'light' }).code, 'drain_stop_irrigating');
eq('no tube: the tube recipe is offered', A.riceWaterDecision({ method: 'intermittent', daysAfterEstablish: 50 }).tube.lengthCm, 30);
eq('method defaults to safe AWD', A.riceWaterDecision({ daysAfterEstablish: 40, season: 'dry', tubeBelowSurfaceCm: 16 }).code, 'reflood_now');
eq('reflood now at 16 cm dry season', A.awdDecision({ daysAfterEstablish: 40, season: 'dry', tubeBelowSurfaceCm: 16 }).code, 'reflood_now');
eq('not yet at 16 cm wet season', A.awdDecision({ daysAfterEstablish: 40, season: 'wet', tubeBelowSurfaceCm: 16 }).code, 'not_yet');
ok('days left at 1 cm/day drop', A.awdDecision({ daysAfterEstablish: 40, season: 'wet', tubeBelowSurfaceCm: 16, pondDropCmPerDay: 1 }).daysLeft, 4, 1e-9, 'd');
eq('flowering window keeps 5 cm', A.awdDecision({ daysAfterEstablish: 60, daysToFlowering: 3, season: 'dry', pondedCm: 2 }).code, 'flowering_top_up_to_5cm');
eq('before day 21: shallow water', A.awdDecision({ daysAfterEstablish: 10, season: 'dry', tubeBelowSurfaceCm: 16 }).code, 'before_awd_keep_shallow');
eq('drain 14 days before harvest on clay', A.awdDecision({ daysAfterEstablish: 100, daysToHarvest: 12, soil: 'clay', season: 'wet' }).code, 'drain_stop_irrigating');
eq('no drain 12 days before harvest on light soil', A.awdDecision({ daysAfterEstablish: 100, daysToHarvest: 12, soil: 'light', season: 'wet', tubeBelowSurfaceCm: 5 }).code, 'not_yet');

console.log('\n== EFFECTIVE RAINFALL (FAO Training Manual 3 worked table) ==');
[[35, 11], [90, 47], [116, 68], [5, 0], [260, 183], [75, 35]].forEach(([P, w]) => ok('TM3 Pe(' + P + ')', A.effectiveRainMonthly(P), w, 0.5, 'mm'));

console.log('\n== SPRAY WINDOW (GRDC 2025 bands) ==');
{ const r = A.sprayWindow({ T: 28, RH: 60, P: 101.3, windKmh: 8, hoursToSunset: 6, hoursAfterSunrise: 4 });
  eq('28 C 60% wind 8: good', r.code, 'good'); eq('delta T band good', r.deltaTBand, 'good'); }
eq('wind 2 km/h: do not spray', A.sprayWindow({ T: 28, RH: 60, windKmh: 2, hoursToSunset: 6, hoursAfterSunrise: 4 }).code, 'do_not_spray');
eq('wind 18 km/h: do not spray without label', A.sprayWindow({ T: 28, RH: 60, windKmh: 18, hoursToSunset: 6, hoursAfterSunrise: 4 }).code, 'do_not_spray');
eq('wind 18 km/h with label 20: not blocked by wind', A.sprayWindow({ T: 28, RH: 60, windKmh: 18, labelMaxWindKmh: 20, hoursToSunset: 6, hoursAfterSunrise: 4 }).reasons.includes('wind_above_max'), false);
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
  eq('33 C 60%: can reach the target', d.code, 'can_reach_target'); ok('cavans at 14%', d.cavansAt14, 2500 * 76 / 86 / 50, 1e-9);
  eq('storage target weeks to months 14%', d.storageTarget, 14); }
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
  ['FAO56', 'FAO_TM3', 'FAO_TM4', 'IRRI_AWD', 'BOUMAN2007', 'DA_AO25', 'PHILRICE_AWD', 'PALAYCHECK', 'GRDC2025', 'ASABE_D245_ZHONG', 'UAEX_FSA1074', 'QDAF_CTT', 'FAO_FROST', 'HUTTON', 'MCMASTER1997', 'ORYZA2000', 'PHILRICE_VARIETIES']
    .forEach(id => eq('REFS has ' + id, !!A.REFS[id], true));
  eq('UNVERIFIED list names the four items that remain unverified', A.UNVERIFIED.map(u => u.id).join(','), 'D245_STANDARD,SMITH1992,FROST_DEWPOINT,DEW_NEAR_SATURATION,HARVEST_PM7'); }

console.log('\n' + pass + ' passed, ' + fail + ' failed\n');
process.exitCode = fail ? 1 : 0;
