/**
 * SenseStreet Hazard Detector
 *
 * Pure, framework-free event classifier (no browser APIs), so it can be unit
 * tested in Node. It replaces the old fixed "magnitude > 18" rules with:
 *
 *   1. Gravity removal      – slow EMA of the raw accelerometer vector.
 *   2. Adaptive thresholds  – thresholds scale with the vibration level the
 *                             vehicle normally produces (learned / calibrated),
 *                             with a per-profile floor so they never get silly.
 *   3. Motion state         – "moving" vs "stopped" from vibration energy, so
 *                             GPS speed is not required (toy cars!).
 *   4. Signal shape         – crash = big impact followed by stillness,
 *                             pothole = short vertical spike while moving,
 *                             sudden brake = sustained backwards push along
 *                             the vehicle's forward axis.
 *
 * Mounting assumption: the TOP EDGE of the phone points toward the FRONT of
 * the vehicle. Any tilt is fine (e.g. propped up); only the heading matters.
 *
 * Units: accelerations in m/s², time in milliseconds.
 */

export const PROFILES = {
  car: {
    label: 'Car',
    calSeconds: 20,
    sigma0: 0.6, // default normal-driving vibration (RMS of |linear accel|)
    idle: 0.25, // RMS below this = stopped
    pothole: { floor: 5, k: 5 },
    crash: { floor: 20, k: 9 },
    brake: { floor: 3.5, k: 3 },
    dedupeMeters: 15,
    maxGpsAccuracy: 100,
    mapZoom: 14,
  },
  toy: {
    label: 'Toy car',
    calSeconds: 7, // short: a hand-pushed toy only needs a few seconds of rolling
    sigma0: 1.6, // measured on a real hand-pushed toy car (rolling vibration 1.5-2.1 m/s² RMS)
    sigmaF0: 0.5, // ...of which only ~0.5 is along the forward axis (the rest is the car rattling up and down)
    idle: 0.25,
    pothole: { floor: 4, k: 5 },
    crash: { floor: 12, k: 9 },
    // Judged against FORWARD-axis noise: a 150 ms backward push on plain rolling never exceeded 0.3 m/s²
    brake: { floor: 1.4, k: 3, forward: true },
    dedupeMeters: 6,
    maxGpsAccuracy: 25,
    mapZoom: 18,
  },
};

const EPISODE_GAP_MS = 350; // spikes closer together than this are ONE impact (a crash bounces)
const CRASH_STILL_MS = 1500; // car must be still this long after a crash spike
const STILL_CHECK_MS = 800; // ...judged over the last this-many ms
const TAP_IGNORE_MS = 700; // jolt from tapping the phone's screen
const BRAKE_MIN_MS = 150; // braking must be sustained at least this long
const COOLDOWN_MS = 1500; // per event type
const GRAVITY_TAU_MS = 1500;
const MOTION_TAU_MS = 700;
const BRAKE_SMOOTH_MS = 50; // low-pass on the forward axis before judging braking
const GRAVITY_GATE_RELEASE_MS = 2000; // if the phone is genuinely re-oriented, relearn gravity
const LOOKBACK_MS = 300; // "was the car moving just before the spike?"
const BRAKE_LOOKBACK_MS = 700; // braking needs the car to have been moving a while (a shove on a parked car isn't braking)

const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const norm = (a) => Math.sqrt(dot(a, a));
const scale = (a, s) => ({ x: a.x * s, y: a.y * s, z: a.z * s });
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const alphaFor = (dt, tau) => 1 - Math.exp(-dt / tau);

export class HazardDetector {
  /**
   * @param {'car'|'toy'} profileName
   * @param {{ sigma?: number, fwdSign?: 1|-1 }} [calibration] saved calibration
   */
  constructor(profileName = 'car', calibration = null) {
    this.profileName = PROFILES[profileName] ? profileName : 'car';
    this.profile = PROFILES[this.profileName];

    this.sigma = calibration?.sigma > 0 ? calibration.sigma : this.profile.sigma0;
    this.sigmaF = calibration?.sigmaF > 0 ? calibration.sigmaF : this.profile.sigmaF0 ?? this.sigma;
    this.fwdSign = calibration?.fwdSign === -1 ? -1 : 1;

    this.calibrating = false;
    this._cal = null;

    this._g = null; // gravity estimate
    this._lastT = null;
    this._rms2 = 0; // EMA of |lin|²
    this._moving = false;
    this._movHist = []; // [{t, moving}]
    this._l2Hist = []; // [{t, l2}] for stillness checks

    this._impact = null; // {t0, lastSpike, peakLin, peakV, wasMoving, preRms}
    this._crashPending = null; // {deadline, peak, peakV, preRms}
    this._brakeRun = null; // {t0, sum, n}
    this._fs = 0; // smoothed forward acceleration
    this._gateMs = 0; // how long gravity learning has been frozen
    this._suppressUntil = -Infinity; // ignore new events until this time (screen taps)
    this._lastImpactEnd = -Infinity;
    this._lastEmit = {};
  }

  // ---------- thresholds ----------
  /**
   * RMS below which the vehicle counts as stopped. Follows the learned vibration
   * level, so a gently hand-pushed toy (low vibration) still registers as moving,
   * but never drops below what a phone sitting still produces (~0.04 m/s²).
   */
  get idle() {
    return Math.min(this.profile.idle, Math.max(0.1, 0.35 * this.sigma));
  }

  get thresholds() {
    const p = this.profile;
    return {
      pothole: Math.max(p.pothole.floor, p.pothole.k * this.sigma),
      crash: Math.max(p.crash.floor, p.crash.k * this.sigma),
      brake: Math.max(p.brake.floor, p.brake.k * (p.brake.forward ? this.sigmaF : this.sigma)),
    };
  }

  // ---------- calibration ----------
  startCalibration() {
    this.calibrating = true;
    this._cal = {
      s2: this.profile.sigma0 ** 2,
      s2F: (this.profile.sigmaF0 ?? this.profile.sigma0) ** 2,
      n: 0,
      stillSince: null,
      launchT: null,
      fHist: [],
      votes: 0,
      moveSamples: 0,
    };
  }

  /** Ends calibration and returns what to persist. */
  finishCalibration() {
    const c = this._cal;
    this.calibrating = false;
    this._cal = null;
    if (!c || c.moveSamples < 40) {
      return { ok: false, reason: 'Not enough movement detected. Drive the car for the full time.' };
    }
    this.sigma = Math.min(Math.max(Math.sqrt(c.s2), 0.1), 5);
    this.sigmaF = Math.min(Math.max(Math.sqrt(c.s2F), 0.1), 3);
    if (c.votes !== 0) this.fwdSign = c.votes > 0 ? 1 : -1;
    return {
      ok: true,
      sigma: +this.sigma.toFixed(3),
      sigmaF: +this.sigmaF.toFixed(3),
      fwdSign: this.fwdSign,
      learnedDirection: c.votes !== 0,
    };
  }

  // ---------- main entry ----------
  /**
   * @param {{t:number, ax:number, ay:number, az:number}} s raw accelerometer INCLUDING gravity
   * @returns {Array<{type:string, intensity:number}>}
   */
  update(s) {
    const t = s.t;
    const a = { x: s.ax, y: s.ay, z: s.az };

    if (this._lastT === null) {
      this._g = { ...a };
      this._lastT = t;
      return [];
    }
    const dt = Math.max(1, Math.min(t - this._lastT, 250));
    this._lastT = t;

    // 1) gravity + linear acceleration
    // Freeze gravity learning while a big push/impact is happening, otherwise the
    // spike leaks into the estimate and the vehicle looks "not still" afterwards.
    const prevLin = norm(sub(a, this._g));
    const gate = Math.max(1.5, 3 * this.sigma);
    if (prevLin > gate && this._gateMs < GRAVITY_GATE_RELEASE_MS) {
      this._gateMs += dt;
    } else {
      this._gateMs = prevLin > gate ? this._gateMs : 0;
      const ag = alphaFor(dt, this._gateMs >= GRAVITY_GATE_RELEASE_MS ? 200 : GRAVITY_TAU_MS);
      this._g = {
        x: this._g.x + ag * (a.x - this._g.x),
        y: this._g.y + ag * (a.y - this._g.y),
        z: this._g.z + ag * (a.z - this._g.z),
      };
      if (this._gateMs >= GRAVITY_GATE_RELEASE_MS && prevLin < gate) this._gateMs = 0;
    }
    const lin = sub(a, this._g);
    const l = norm(lin);
    const gMag = norm(this._g) || 1;
    const up = scale(this._g, 1 / gMag); // unit vector along gravity reading
    const v = dot(lin, up); // vertical component

    // forward axis = device Y projected perpendicular to gravity
    const yDev = { x: 0, y: 1, z: 0 };
    let fwd = sub(yDev, scale(up, dot(yDev, up)));
    const fn = norm(fwd);
    fwd = fn > 0.2 ? scale(fwd, 1 / fn) : { x: 0, y: 0, z: 0 }; // phone upright → no forward axis
    const f = dot(lin, fwd) * this.fwdSign;
    this._fs += alphaFor(dt, BRAKE_SMOOTH_MS) * (f - this._fs);

    // 2) motion state (RMS of |lin| over ~0.7 s, with hysteresis)
    this._rms2 += alphaFor(dt, MOTION_TAU_MS) * (l * l - this._rms2);
    const rms = Math.sqrt(this._rms2);
    if (!this._moving && rms > this.idle) this._moving = true;
    else if (this._moving && rms < this.idle * 0.6) this._moving = false;

    this._movHist.push({ t, moving: this._moving });
    while (this._movHist.length > 1 && this._movHist[0].t < t - 1000) this._movHist.shift();
    this._l2Hist.push({ t, l2: l * l });
    while (this._l2Hist.length && this._l2Hist[0].t < t - 2000) this._l2Hist.shift();

    if (this.calibrating) {
      this._calibrate(t, dt, l, f, rms);
      return [];
    }

    const th = this.thresholds;
    const out = [];

    // 3) impact episodes (pothole / crash share one spike detector).
    // A real crash is several bounces (hit, rebound, hit again), so spikes closer
    // than EPISODE_GAP_MS belong to one episode, judged once it is over.
    const isSpike = Math.abs(v) > th.pothole || l > th.crash;
    if (!this._impact && !this._crashPending && isSpike && t >= this._suppressUntil) {
      this._impact = {
        t0: t,
        lastSpike: t,
        peakLin: l,
        peakV: Math.abs(v),
        wasMoving: this._wasMoving(t - LOOKBACK_MS),
        preRms: this._rmsBetween(t - 1200, t - 150),
      };
    } else if (this._impact) {
      this._impact.peakLin = Math.max(this._impact.peakLin, l);
      this._impact.peakV = Math.max(this._impact.peakV, Math.abs(v));
      if (isSpike) this._impact.lastSpike = t;
      if (t - this._impact.lastSpike >= EPISODE_GAP_MS) {
        const im = this._impact;
        this._impact = null;
        this._lastImpactEnd = t;
        if (im.wasMoving) {
          if (im.peakLin > th.crash) {
            this._crashPending = {
              deadline: im.lastSpike + CRASH_STILL_MS,
              peak: im.peakLin,
              peakV: im.peakV,
              preRms: im.preRms,
            };
          } else if (im.peakV > th.pothole) {
            this._emit(out, 'pothole', im.peakV, t);
          }
        }
      }
    }

    // crash = big impact AND the vehicle has (nearly) stopped afterwards
    if (this._crashPending && t >= this._crashPending.deadline) {
      const cp = this._crashPending;
      this._crashPending = null;
      this._lastImpactEnd = t;
      if (this._hasStopped(t, cp.preRms)) this._emit(out, 'crash', cp.peak, t);
      else if (cp.peakV > th.pothole) this._emit(out, 'pothole', cp.peakV, t); // just a big bump
    }

    // 4) sudden brake: sustained backward push on the forward axis
    const impactBusy = this._impact || this._crashPending || t - this._lastImpactEnd < 500;
    if (impactBusy || t < this._suppressUntil || !this._wasMoving(t - BRAKE_LOOKBACK_MS) || fn <= 0.2) {
      this._brakeRun = null;
    } else if (this._fs < -th.brake) {
      if (!this._brakeRun) this._brakeRun = { t0: t, sum: 0, n: 0, fired: false };
      this._brakeRun.sum += -this._fs;
      this._brakeRun.n += 1;
      if (!this._brakeRun.fired && t - this._brakeRun.t0 >= BRAKE_MIN_MS) {
        this._brakeRun.fired = true;
        this._emit(out, 'sudden_brake', this._brakeRun.sum / this._brakeRun.n, t);
      }
    } else {
      this._brakeRun = null;
    }

    // 5) learn what "normal" vibration looks like (only while moving, outside events)
    if (this._moving && !this._impact && !this._crashPending && !this._brakeRun && Math.abs(this._fs) < 1.5 * this.sigma && t - this._lastImpactEnd > 1000) {
      const clamp = 4 * this.sigma;
      const lc = Math.min(l, clamp);
      const s2 = this.sigma * this.sigma;
      // adapt UP quickly (pushed faster than when calibrated), DOWN slowly (stops look quiet)
      this.sigma = Math.sqrt(s2 + alphaFor(dt, lc * lc > s2 ? 4000 : 20000) * (lc * lc - s2));
      if (fn > 0.2) {
        const fc = Math.min(Math.abs(f), 4 * this.sigmaF);
        const sF2 = this.sigmaF * this.sigmaF;
        this.sigmaF = Math.sqrt(sF2 + alphaFor(dt, fc * fc > sF2 ? 4000 : 20000) * (fc * fc - sF2));
      }
    }

    return out;
  }

  // ---------- helpers ----------
  _wasMoving(tAgo) {
    // moving state at ~tAgo (oldest sample not older than the lookback)
    for (const h of this._movHist) if (h.t >= tAgo) return h.moving;
    return this._movHist.length ? this._movHist[this._movHist.length - 1].moving : false;
  }

  _rmsBetween(a, b) {
    const xs = this._l2Hist.filter((h) => h.t >= a && h.t < b);
    return xs.length ? Math.sqrt(xs.reduce((sum, h) => sum + h.l2, 0) / xs.length) : 0;
  }

  /**
   * Has the vehicle stopped? Judged against how much it vibrated while rolling,
   * not an absolute number: after a real crash there is still some wobble and
   * handling (about 0.5 m/s² on a toy car) that is far below rolling vibration.
   */
  _hasStopped(t, preRms = 0) {
    const post = this._rmsBetween(t - STILL_CHECK_MS, t + 1);
    const limit = Math.max(this.idle * 1.5, 0.3 * Math.max(preRms, this.sigma));
    return post < limit;
  }

  /** Ignore new events for a short while (call right after the user taps the screen). */
  ignoreFor(ms = TAP_IGNORE_MS, t = this._lastT ?? 0) {
    this._suppressUntil = Math.max(this._suppressUntil, t + ms);
    this._brakeRun = null;
  }

  _emit(out, type, intensity, t) {
    if (t - (this._lastEmit[type] ?? -Infinity) < COOLDOWN_MS) return;
    this._lastEmit[type] = t;
    out.push({ type, intensity: +intensity.toFixed(2) });
  }

  _calibrate(t, dt, l, f, rms) {
    const c = this._cal;
    if (this._moving) {
      c.moveSamples += 1;
      // fast, winsorised estimates of normal vibration (total, and along the forward axis)
      const clamp = 4 * Math.sqrt(c.s2);
      const lc = Math.min(l, clamp);
      c.s2 += alphaFor(dt, 1200) * (lc * lc - c.s2);
      const fc = Math.min(Math.abs(f), 4 * Math.sqrt(c.s2F));
      c.s2F += alphaFor(dt, 1200) * (fc * fc - c.s2F);
    }

    // Learn which way is forward from the launch: the first sustained push after the
    // car has been sitting still. The raw (unsigned) forward component is kept so the
    // vote does not depend on the sign currently assumed.
    c.fHist.push({ t, f: f / this.fwdSign, l });
    while (c.fHist.length && c.fHist[0].t < t - 2500) c.fHist.shift();
    if (!this._moving) {
      c.stillSince = c.stillSince ?? t;
    } else {
      if (c.stillSince !== null && t - c.stillSince > 200 && !c.launchT) c.launchT = t;
      c.stillSince = null;
    }
    if (c.launchT && t - c.launchT >= 500) {
      let quiet = 0;
      let seenQuiet = false;
      let run = 0;
      let dir = 0;
      let vote = 0;
      for (const h of c.fHist) {
        if (h.t < c.launchT - 1500) continue;
        if (!seenQuiet) {
          // wait until we have seen the car genuinely at rest (~130 ms of near-zero readings)
          if (Math.abs(h.f) < 0.25 && h.l < 0.4) {
            quiet += 1;
            if (quiet >= 8) seenQuiet = true;
          } else quiet = 0;
          continue;
        }
        // first run of 4 same-direction forward readings after the rest = the launch push
        const sgn = Math.abs(h.f) > 0.3 ? Math.sign(h.f) : 0;
        if (sgn !== 0 && sgn === dir) run += 1;
        else {
          dir = sgn;
          run = sgn !== 0 ? 1 : 0;
        }
        if (run >= 4) {
          vote = dir;
          break;
        }
      }
      if (vote !== 0) c.votes += vote;
      c.launchT = null;
    }
  }
}
