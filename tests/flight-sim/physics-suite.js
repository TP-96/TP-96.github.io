// Physics & gameplay test suite for flight-sim.html (run inside the page with ?debug)
(() => {
  const F = window.__fs, s = F.s, R = [];
  const KT = 1.94384, FT = 3.28084, G = 9.80665;
  const ok = (name, pass, detail) => R.push({ name, pass: !!pass, detail });
  const within = (v, lo, hi) => v >= lo && v <= hi;
  const nan = () => [s.pos.x, s.pos.y, s.pos.z, s.vel.x, s.vel.y, s.vel.z, s.q.x, s.q.y, s.q.z, s.q.w].some(v => !Number.isFinite(v));
  const V = () => s.vel.length();
  const gamma = () => Math.asin(Math.max(-1, Math.min(1, s.vel.y / Math.max(V(), 1e-6))));
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const stepN = (n, fn) => { for (let i = 0; i < n; i++) { if (fn && fn(i) === false) return i; F.step(1 / 120); if (s.crashed || nan()) return i; } return n; };
  const reset = () => { F.keys.clear(); F.touch.x = F.touch.y = 0; F.touch.brake = false; };
  // put the aircraft in the air, wings level, heading north, at speed v (m/s) and altitude h (m), over the sea well south of the island
  function air(id, h, v, { assist = false, thr = 0, x = 0, z = 30000 } = {}) {
    reset(); F.setAircraft(id); F.settings.assist = assist; F.startFlight('free');
    s.grounded = false; s.pos.set(x, h, z); s.vel.set(0, 0, -v); s.q.identity(); s.throttle = thr; s.spool = thr;
    s.parkBrake = false; F.axes();
  }
  // analog-stick autopilot: hold a flight-path angle (rad) or a target speed via pitch, wings level / target bank
  // The inner loop is model-based: it works out how fast one unit of stick turns the flight path at the current
  // dynamic pressure (stick → angle-of-attack change → lift → path rate), so the same gains suit both aircraft.
  function stick({ gammaT = null, speedT = null, bank = 0, hT = null }) {
    F.axes();
    const AC = F.AC, v = Math.max(V(), 1), q = 0.5 * F.isaRho(s.pos.y) * v * v, veas = v * Math.sqrt(F.isaRho(s.pos.y) / 1.225);
    let gT = gammaT;
    if (hT !== null) gT = clamp((hT - s.pos.y) * 3 / Math.max(v, 30) * 0.05, -0.1, 0.1);
    if (speedT !== null) {                         // too slow → aim lower (PI on speed)
      s._sI = clamp((s._sI || 0) + (veas - speedT) / 120, -200, 200);    // speed targets are indicated (equivalent) airspeed
      gT = clamp(0.03 * (veas - speedT) + 0.004 * s._sI, -0.5, 0.6);
    }
    const e = gT - gamma(); s._gI = clamp((s._gI || 0) + e / 120, -0.5, 0.5);
    const cosB = Math.max(0.3, Math.cos(F.rollRad()));
    const perStick = Math.max(q * AC.S * AC.CLa * (AC.pitchK / AC.stab) / (AC.mass * v) * cosB, 0.02);   // rad/s of path per unit stick
    const nTurn = 1 / cosB - 1;                    // extra lift needed to stay level when banked
    const want = 1.2 * e + 0.4 * s._gI + nTurn * 9.80665 / v;
    F.touch.y = clamp(want / perStick, -1, 1);
    const r = F.rollRad();
    F.touch.x = clamp(2.5 * (bank - r) - 0.3 * (s._lastR !== undefined ? (r - s._lastR) * 120 : 0), -1, 1);
    s._lastR = r;
  }
  const clearAP = () => { s._gI = 0; s._sI = 0; s._lastR = undefined; s._lastV = undefined; };

  // ───────────────────────── 1. integrator & conservation ─────────────────────────
  for (const id of ['c172', 'f22']) {
    // ballistic: no lift, no drag, no thrust → a parabola
    air(id, 3000, 100); const save = { ...F.AC };
    Object.assign(F.AC, { CL0: 0, CLa: 0, CD0: 0, K: 0, cdWave: 0, CDprop: 0, idle: 0 });
    const y0 = s.pos.y, z0 = s.pos.z; stepN(360);
    const t = 3, dy = s.pos.y - y0, dz = s.pos.z - z0;
    ok(`${id}: ballistic drop over 3 s matches ½gt²`, Math.abs(dy + 0.5 * G * t * t) < 0.3 && Math.abs(dz + 100 * t) < 0.1 && Math.abs(s.vel.y + G * t) < 0.01,
      `drop ${(-dy).toFixed(2)} m (exact 44.13), vy ${s.vel.y.toFixed(3)} (exact −29.42)`);
    Object.assign(F.AC, save);
    // energy: lift does no work; with drag & thrust removed, total energy is conserved through hard manoeuvring
    air(id, 3000, id === 'f22' ? 250 : 55);
    Object.assign(F.AC, { CD0: 0, K: 0, cdWave: 0, CDprop: 0, idle: 0, CDbeta: 0, CYbeta: 0 });
    const E = () => s.pos.y + V() * V() / (2 * G), E0 = E();
    let worst = 0;
    stepN(120 * 40, i => { const t = i / 120; F.touch.y = Math.sin(t * 0.7) * 0.8; F.touch.x = Math.sin(t * 0.31) * 0.9; worst = Math.max(worst, Math.abs(E() - E0)); });
    ok(`${id}: total energy conserved with drag & thrust off (40 s of manoeuvring)`, worst / E0 < 0.002 && !nan(),
      `worst drift ${worst.toFixed(2)} m of ${E0.toFixed(0)} m energy height (${(100 * worst / E0).toFixed(3)} %)`);
    Object.assign(F.AC, save);
  }
  // convergence: halve and quarter the time step → same trajectory
  {
    const run = (sub) => {
      air('c172', 1000, 55, { thr: 0.8 });
      for (let i = 0; i < 120 * 20; i++) {
        const t = i / 120; F.touch.y = 0.4 * Math.sin(t); F.touch.x = 0.5 * Math.sin(0.5 * t);
        for (let k = 0; k < sub; k++) F.step(1 / (120 * sub));
      }
      return s.pos.clone();
    };
    const a = run(1), b = run(2), c = run(4);
    const e1 = a.distanceTo(c), e2 = b.distanceTo(c);
    ok('integrator converges as the time step shrinks (20 s manoeuvre)', e1 < 15 && e2 < e1, `|Δ| at dt: ${e1.toFixed(2)} m → dt/2: ${e2.toFixed(2)} m (vs dt/4)`);
  }
  // symmetry: a left manoeuvre mirrors a right one
  for (const id of ['c172', 'f22']) {
    const run = sgn => { air(id, 2000, id === 'f22' ? 200 : 55, { thr: 0.6 }); stepN(120 * 6, i => { F.touch.x = i < 240 ? sgn * 0.7 : 0; F.touch.y = 0.3; }); return [s.pos.x, s.pos.y, s.pos.z, F.rollRad()]; };
    const r = run(1), l = run(-1);
    ok(`${id}: left and right rolls are mirror images`, Math.abs(r[0] + l[0]) < 0.05 && Math.abs(r[1] - l[1]) < 0.05 && Math.abs(r[2] - l[2]) < 0.05 && Math.abs(r[3] + l[3]) < 1e-3,
      `x ${r[0].toFixed(2)} / ${l[0].toFixed(2)}, alt ${r[1].toFixed(2)} / ${l[1].toFixed(2)}`);
  }
  // sideslip in a full-deflection roll at high angle of attack
  {
    air('f22', 4000, 130, { thr: 0.9 }); let bmax = 0;
    stepN(120 * 4, i => { F.touch.y = 0.8; F.touch.x = i < 240 ? 1 : -1; F.axes();
      const r = new F.THREE.Vector3(1, 0, 0).applyQuaternion(s.q); bmax = Math.max(bmax, Math.abs(Math.asin(s.vel.dot(r) / V()))); });
    ok('F-22 rolls about the flight path: sideslip stays under 2° in full rolls at high AoA', bmax < 0.035, `max sideslip ${(bmax * 57.3).toFixed(2)}°`);
  }
  // atmosphere
  {
    const rho11a = F.isaRho(10999.9), rho11b = F.isaRho(11000.1);
    ok('ISA density continuous at the tropopause, matches tables', Math.abs(rho11a - rho11b) < 1e-4 && Math.abs(F.isaRho(5000) - 0.7364) < 0.002 && Math.abs(F.isaRho(20000) - 0.0889) < 0.002,
      `ρ(5 km) ${F.isaRho(5000).toFixed(4)} (0.7364), ρ(11 km) ${rho11a.toFixed(4)}/${rho11b.toFixed(4)}, ρ(20 km) ${F.isaRho(20000).toFixed(4)} (0.0889)`);
    // engine thrust must be continuous across the tropopause
    air('f22', 10999.5, 500, { thr: 1 }); const tA = F.engineThrust(500, F.isaRho(10999.99));
    const tB = F.engineThrust(500, F.isaRho(11000.01));
    ok('F-22 thrust is continuous across the tropopause', Math.abs(tA / tB - 1) < 1e-4, `${(tA / 1000).toFixed(2)} kN / ${(tB / 1000).toFixed(2)} kN`);
    ok('speed of sound matches ISA', Math.abs(F.isaA(0) - 340.3) < 0.3 && Math.abs(F.isaA(11000) - 295.1) < 0.3 && Math.abs(F.isaA(15000) - 295.1) < 0.3, `a(0) ${F.isaA(0).toFixed(1)}, a(11 km) ${F.isaA(11000).toFixed(1)}`);
  }

  // ───────────────────────── 2. Cessna 172S vs its handbook ─────────────────────────
  // stall: power off, hold altitude, slow down until the wing stalls
  {
    air('c172', 1000, 40); let vs = null;
    stepN(120 * 60, () => { stick({ hT: 1000 }); if (s.stalled && vs === null) { vs = s.ias; return false; } });
    ok('C172 clean stall speed ≈ 53 KCAS (POH)', vs && within(vs, 50, 56), `stalled at ${vs && vs.toFixed(1)} kt`);
  }
  // climb: full power at 74 KIAS, sea level and 8,000 ft
  for (const [h, lo, hi, poh] of [[150, 680, 790, 730], [2440, 345, 430, 385]]) {
    air('c172', h, 38, { thr: 1 }); clearAP();
    stepN(120 * 25, () => stick({ speedT: 38.1 }));
    const y0 = s.pos.y; stepN(120 * 10, () => stick({ speedT: 38.1 }));
    const roc = (s.pos.y - y0) / 10 * 196.85;
    ok(`C172 climb at 74 kt, ${Math.round(h * FT)} ft ≈ ${poh} fpm (POH)`, within(roc, lo, hi), `${roc.toFixed(0)} fpm at ${s.ias.toFixed(1)} kt`);
  }
  // glide: idle at 68 KIAS
  {
    air('c172', 1500, 35); clearAP(); stepN(120 * 30, () => stick({ speedT: 35 }));
    const p0 = s.pos.clone(); stepN(120 * 20, () => stick({ speedT: 35 }));
    const ratio = Math.hypot(s.pos.x - p0.x, s.pos.z - p0.z) / (p0.y - s.pos.y);
    ok('C172 best-glide ratio ≈ 9:1 at 68 kt (POH ~1.5 nm per 1,000 ft)', within(ratio, 8.3, 9.8), `${ratio.toFixed(2)} : 1 at ${s.ias.toFixed(1)} kt`);
  }
  // maximum level speed at sea level
  {
    air('c172', 150, 55, { thr: 1 }); clearAP(); stepN(120 * 150, () => stick({ hT: 150 }));
    const kt = V() * KT;
    ok('C172 max level speed at sea level ≈ 120–126 KTAS (POH)', within(kt, 114, 128), `${kt.toFixed(1)} KTAS, holding ${(s.pos.y * FT).toFixed(0)} ft`);
  }
  // service ceiling: climb until the rate falls below 100 fpm
  {
    air('c172', 3000, 40, { thr: 1 }); clearAP(); let last = s.pos.y, ceil = null;
    for (let k = 0; k < 200 && ceil === null; k++) {
      stepN(120 * 10, () => stick({ speedT: 38.1 - 0.0011 * s.pos.y }));     // Vy falls from 74 KIAS toward ~66 KIAS up high
      const roc = (s.pos.y - last) / 10 * 196.85; last = s.pos.y;
      if (roc < 100) ceil = s.pos.y;
    }
    ok('C172 service ceiling ≈ 14,000 ft (POH)', ceil && within(ceil * FT, 13300, 14700), `ROC < 100 fpm at ${ceil && (ceil * FT).toFixed(0)} ft`);
  }
  // coordinated level turn at a bank each aircraft can sustain: load = 1/cosφ, turn rate = g·tanφ/V
  // (a 172 can't hold a level 60° turn on 180 hp — it bleeds into the 2 g accelerated stall at 75 kt, as the real one does)
  for (const id of ['c172', 'f22']) {
    const v = id === 'f22' ? 180 : 50;
    air(id, 2000, v, { thr: id === 'f22' ? 0.75 : 1 }); clearAP();
    const bank = id === 'f22' ? Math.PI / 3 : Math.PI / 4;
    stepN(120 * 30, () => stick({ hT: 2000, bank }));
    F.axes(); const h0 = F.headingRad(); let gsum = 0, n = 0;
    stepN(120 * 5, () => { stick({ hT: 2000, bank }); gsum += s.gLoad; n++; });
    F.axes(); let dh = F.headingRad() - h0; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
    const rate = Math.abs(dh) / 5, theory = G * Math.tan(Math.abs(F.rollRad())) / V();
    const nTh = 1 / Math.cos(Math.abs(F.rollRad()));
    ok(`${id}: ${id === 'f22' ? 60 : 45}° banked level turn: load factor 1/cosφ and turn rate g·tanφ/V, hands-neutral bank hold`, Math.abs(gsum / n - nTh) < 0.1 && Math.abs(rate / theory - 1) < 0.04 && Math.abs(s.vel.y) < 1.5 && Math.abs(F.rollRad() - bank) < 0.07,
      `${(gsum / n).toFixed(2)} g, ${(rate * 57.3).toFixed(2)}°/s vs g·tanφ/V = ${(theory * 57.3).toFixed(2)}°/s, bank ${(F.rollRad() * 57.3).toFixed(1)}°`);
  }

  // ───────────────────────── 3. F-22 envelope ─────────────────────────
  {
    const top = (h, thr) => { air('f22', h, 300, { thr }); clearAP(); stepN(120 * 240, () => stick({ hT: h })); return s; };
    top(300, 1); ok('F-22 sea-level top speed held to ~800 KEAS (Mach 1.21–1.3)', within(s.ias, 780, 830) && within(s.mach, 1.18, 1.3), `${s.ias.toFixed(0)} KEAS, Mach ${s.mach.toFixed(2)}`);
    top(11000, 1); ok('F-22 top speed at 36,000 ft ≈ Mach 2.25', within(s.mach, 2.1, 2.35), `Mach ${s.mach.toFixed(2)}`);
    top(11000, 0.85); ok('F-22 supercruise (no afterburner) Mach 1.5–1.8', within(s.mach, 1.5, 1.8), `Mach ${s.mach.toFixed(2)}`);
    top(13000, 0.85); ok('F-22 supercruise at 43,000 ft still supersonic', s.mach > 1.4, `Mach ${s.mach.toFixed(2)}`);
  }
  {
    air('f22', 3000, 120); clearAP(); let vmin = 1e9; F.step(1 / 120);
    stepN(120 * 120, () => { stick({ hT: 3000 }); vmin = Math.min(vmin, s.ias); });
    ok('F-22 1 g minimum speed ≈ 110 kt (fly-by-wire holds max AoA, no stall)', within(vmin, 95, 125) && !s.crashed, `${vmin.toFixed(0)} kt, stalled flag ${s.stalled}`);
  }
  {
    air('f22', 3000, 231, { thr: 1 }); let gmax = 0, gmin = 0;
    stepN(120 * 5, () => { F.touch.y = 1; gmax = Math.max(gmax, s.gLoad); });
    air('f22', 3000, 231, { thr: 1 });
    stepN(120 * 3, () => { F.touch.y = -1; gmin = Math.min(gmin, s.gLoad); });
    ok('F-22 flight controls limit load to +9 / −3 g', gmax > 8.5 && gmax <= 9.15 && gmin < -2.6 && gmin >= -3.15 && !s.crashed, `max ${gmax.toFixed(2)} g, min ${gmin.toFixed(2)} g`);
  }
  {
    air('f22', 300, 230, { thr: 1 }); clearAP(); let t = 0;
    stepN(120 * 200, () => { stick({ speedT: 230 }); t += 1 / 120; if (s.pos.y > 10000) return false; });
    ok('F-22 afterburner climb at 450 KEAS, 1,000 → 33,000 ft in 45–90 s', !s.crashed && within(t, 45, 90), `${t.toFixed(1)} s, crashed ${s.crashed}`);
    // ceiling: a constant-Mach 1.6 afterburner climb from the tropopause
    air('f22', 11000, 1.6 * F.isaA(11000), { thr: 1 }); clearAP();
    const eas16 = () => 1.6 * F.isaA(s.pos.y) * Math.sqrt(F.isaRho(s.pos.y) / 1.225);
    let last = s.pos.y, ceil = null; stepN(120 * 10, () => stick({ speedT: eas16() })); last = s.pos.y;
    for (let k = 0; k < 120 && ceil === null; k++) {
      stepN(120 * 10, () => stick({ speedT: eas16() }));
      const roc = (s.pos.y - last) / 10 * 196.85; last = s.pos.y; if (roc < 500) ceil = s.pos.y;
    }
    ok('F-22 ceiling (ROC < 500 fpm) ≈ 60,000–70,000 ft', ceil && within(ceil * FT, 58000, 72000), `${ceil && (ceil * FT).toFixed(0)} ft at Mach ${s.mach.toFixed(2)}`);
  }
  {
    // energy bleed: idle level deceleration from Mach 1.5 at 30,000 ft should be gradual, with no thrust/drag discontinuity
    let jump = 0, crossed = 0;
    for (const [m0, thr] of [[1.5, 0], [0.8, 1]]) {
      air('f22', 9000, m0 * F.isaA(9000), { thr, assist: true }); stepN(120 * 2);     // let the teleported start settle
      let lastA = null, lastV = null; F.step(1 / 120); lastV = V();
      stepN(120 * 70, i => { if (i === 0) return; const a = (V() - lastV) * 120; lastV = V(); if (lastA !== null) jump = Math.max(jump, Math.abs(a - lastA)); lastA = a; });
      if ((m0 > 1) !== (s.mach > 1)) crossed++;
    }
    ok('F-22 accelerates and decelerates through Mach 1 smoothly (no force discontinuities)', jump < 0.3 && crossed === 2, `largest step-to-step change in acceleration ${jump.toFixed(3)} m/s², crossed Mach 1 ${crossed}/2 times`);
  }

  // ───────────────────────── 4. ground handling ─────────────────────────
  for (const id of ['c172', 'f22']) {
    reset(); F.setAircraft(id); F.startFlight('free'); const p0 = s.pos.clone();
    stepN(120 * 20);
    ok(`${id}: sits still on the runway at idle after spawning`, s.pos.distanceTo(p0) < 0.05 && s.grounded, `moved ${s.pos.distanceTo(p0).toFixed(3)} m`);
  }
  for (const id of ['c172', 'f22']) {
    reset(); F.setAircraft(id); F.startFlight('free'); s.throttle = 1; const z0 = s.pos.z; let lo = null, rot = id === 'f22' ? 125 : 55;
    stepN(120 * 60, () => { if (s.ias > rot) F.touch.y = 0.6; if (!s.grounded && !lo) lo = { kt: s.ias, d: z0 - s.pos.z }; if (lo && s.pos.y > F.RWY.h + 60) return false; });
    const rw = id === 'f22' ? 1400 : 680;
    ok(`${id}: takes off within the runway (${rw} m)`, lo && lo.d < rw - 60 && !s.crashed, lo ? `lift-off at ${lo.kt.toFixed(0)} kt after ${lo.d.toFixed(0)} m` : 'never lifted off');
    if (id === 'c172') ok('C172 ground roll ≈ 960 ft / 290 m (POH, sea level)', lo && within(lo.d, 250, 340), `${lo && lo.d.toFixed(0)} m`);
  }
  for (const [id, v0, lim] of [['c172', 25.7, 140], ['f22', 72, 820]]) {
    reset(); F.setAircraft(id); F.startFlight('free'); s.parkBrake = false; s.vel.set(0, 0, -v0); F.touch.brake = true; const z0 = s.pos.z;
    stepN(120 * 60, () => V() > 0.05);
    const d = z0 - s.pos.z, decel = v0 * v0 / (2 * d);
    ok(`${id}: braking from ${(v0 * KT).toFixed(0)} kt stops in ${d.toFixed(0)} m (≈0.3–0.4 g)`, d < lim && within(decel / G, 0.28, 0.42) && !s.crashed, `${(decel / G).toFixed(2)} g mean deceleration`);
  }
  {
    reset(); F.setAircraft('c172'); F.startFlight('free'); s.parkBrake = false; s.vel.set(0, 0, -8); s.throttle = 0.25;
    const h0 = F.headingRad(); let maxY = 0;
    stepN(120 * 6, () => { F.touch.x = 1; maxY = Math.max(maxY, Math.abs(s.pos.y - (F.RWY.h + 1.24))); });
    ok('C172 steers on the ground without leaving it', s.grounded && Math.abs(F.headingRad() - h0) > 0.3 && maxY < 0.01, `heading changed ${((F.headingRad() - h0) * 57.3).toFixed(0)}°`);
  }

  // ───────────────────────── 5. touchdowns ─────────────────────────
  const touchdown = (id, rw, kt, vsFpm, pitchDeg = 4, rollDeg = 0) => {
    reset(); F.setAircraft(id); F.startFlight('course');
    const v = kt / KT, vs = vsFpm / 196.85, r = rw === 'B' ? { x: -160, z: 1300, halfL: 700 } : { x: 0, z: 1500, halfL: 340 };
    s.grounded = false; s.parkBrake = false; s.nextRing = F.course.length;
    s.pos.set(r.x, F.RWY.h + F.AC.gearH + 0.03, r.z + r.halfL - 150);
    const gam = Math.atan2(-vs, v); s.vel.set(0, -vs, -v * Math.cos(gam));
    s.q.setFromEuler(new THREE.Euler(pitchDeg / 57.3, 0, -rollDeg / 57.3, 'YXZ')); s.throttle = 0; s.spool = 0;
    let td = null; stepN(120 * 5, () => { if (s.grounded && !td) td = true; if (td) return false; });
    return s.crashed ? (document.getElementById('crash-reason').textContent) : (s.grounded ? 'ok' : 'airborne');
  };
  const THREE = F.THREE;
  for (const [id, rw, kt] of [['c172', 'A', 60], ['f22', 'B', 145]]) {
    const good = touchdown(id, rw, kt, 300);
    ok(`${id}: normal ${kt} kt, 300 fpm touchdown is accepted`, good === 'ok', good);
    F.touch.brake = true; stepN(120 * 40, () => V() > 0.05);
    ok(`${id}: then brakes to a stop on the runway and the course finishes`, F.phase === 'finished', `phase ${F.phase}, rolled to z=${s.pos.z.toFixed(0)}`);
    const hard = touchdown(id, rw, kt, 1300);
    ok(`${id}: 1,300 fpm arrival is a hard-landing crash`, /Hard landing/.test(hard), hard);
    const wing = touchdown(id, rw, kt, 300, 4, 25);
    ok(`${id}: 25° bank at touchdown strikes a wingtip`, /wingtip/.test(wing), wing);
    const nose = touchdown(id, rw, kt, 300, -10);
    ok(`${id}: nose-low arrival is a nose-first crash`, /nose/.test(nose), nose);
  }

  // ───────────────────────── 6. robustness ─────────────────────────
  for (const id of ['c172', 'f22']) for (const assist of [true, false]) {
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    air(id, 6000, id === 'f22' ? 250 : 55, { assist, thr: 0.7 }); let bad = false, qerr = 0;
    for (let seg = 0; seg < 60; seg++) {
      const px = rnd() * 2 - 1, py = rnd() * 2 - 1, th = rnd();
      s.throttle = th;
      stepN(120 * 5, () => { F.touch.x = px; F.touch.y = py; qerr = Math.max(qerr, Math.abs(s.q.length() - 1)); });
      if (nan()) { bad = true; break; }
      if (s.crashed || s.pos.y < 1500) { air(id, 6000, id === 'f22' ? 250 : 55, { assist, thr: 0.7 }); }
    }
    ok(`${id}, assist ${assist ? 'on' : 'off'}: 5 min of random stick and throttle — no NaN, quaternion stays unit`, !bad && qerr < 1e-6, `max |q|−1 = ${qerr.toExponential(1)}`);
  }
  for (const id of ['c172', 'f22']) {
    // hands off: the Cessna recovers by its natural stability; the F-22 with flight assist on
    air(id, 5000, id === 'f22' ? 200 : 60, { thr: 0, assist: id === 'f22' }); let vmin = 1e9;
    s.q.setFromEuler(new F.THREE.Euler(Math.PI / 2 - 0.01, 0, 0, 'YXZ')); s.vel.set(0, id === 'f22' ? 200 : 60, 0);
    stepN(120 * 60, () => { F.touch.y = 0; vmin = Math.min(vmin, V()); });
    F.axes();
    ok(`${id}: vertical tail-slide recovers to normal flight without NaN`, !nan() && !s.crashed && V() > (id === 'f22' ? 60 : 30) && Math.abs(F.pitchRad()) < 0.6, `min speed ${vmin.toFixed(1)} m/s, then ${(V() * KT).toFixed(0)} kt, pitch ${(F.pitchRad() * 57.3).toFixed(0)}°`);
  }
  {
    air('f22', 20000, 600, { thr: 1 }); clearAP(); stepN(120 * 60, () => stick({ hT: 20000 }));
    ok('F-22 at 65,000 ft: stable, finite, Mach readout sensible', !nan() && within(s.mach, 1, 2.6), `Mach ${s.mach.toFixed(2)}, ${(s.pos.y * FT).toFixed(0)} ft`);
  }
  // rings: flying through the centre of the next ring counts it, flying beside it does not
  {
    const c = F.course[0], n = F.ringNormals[0];
    reset(); F.setAircraft('c172'); F.startFlight('course'); s.parkBrake = false;
    s.grounded = false; s.pos.copy(c).addScaledVector(n, -30); s.vel.copy(n).multiplyScalar(50); s.q.setFromUnitVectors(new F.THREE.Vector3(0, 0, -1), n);
    stepN(120 * 2);
    const hit = s.nextRing;
    reset(); F.startFlight('course'); s.parkBrake = false; s.grounded = false;
    s.pos.copy(c).addScaledVector(n, -30).add(new F.THREE.Vector3(0, 30, 0)); s.vel.copy(n).multiplyScalar(50); s.q.setFromUnitVectors(new F.THREE.Vector3(0, 0, -1), n);
    stepN(120 * 2);
    ok('ring detection: through the centre counts, 30 m above does not', hit === 1 && s.nextRing === 0, `centre → ${hit}, above → ${s.nextRing}`);
  }
  F.settings.assist = true; reset();
  return R;
})()
