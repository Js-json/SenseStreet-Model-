/**
 * SenseStreet Session Recorder
 *
 * Records a raw sensor session in memory and exports it as one CSV file, so the
 * hazard detector can be replayed offline and tuned against real runs.
 *
 * Framework-free: only download() touches the browser (document / Blob).
 *
 * CSV layout (one table, `kind` says what a row is):
 *
 *   kind    t_ms  ax ay az  rx ry rz   lat lon gps_acc gps_speed   name        value
 *   meta                                                             key         value
 *   phase   t                                                        calibrate | calibrate_end | scan | stop
 *   sample  t     ax ay az  rx ry rz                                 (raw accelerometer incl. gravity, m/s²; gyro in °/s)
 *   gps     t                          lat lon acc  speed (km/h)     (lat/lon blank unless location was included)
 *   event   t                                                        pothole|sudden_brake|crash   intensity   (what the detector decided live)
 *   label   t                                                        pothole|sudden_brake|crash|gentle   (what the user says really happened)
 *
 * All t_ms values are performance.now() milliseconds, so they share one clock.
 */

export const COLUMNS = ['kind', 't_ms', 'ax', 'ay', 'az', 'rx', 'ry', 'rz', 'lat', 'lon', 'gps_acc', 'gps_speed', 'name', 'value'];

/** Buttons the user can tap right after doing something on purpose. */
export const LABELS = {
  pothole: 'Bump',
  sudden_brake: 'Hard brake',
  crash: 'Crash',
  gentle: 'Gentle slow-down',
};

const MAX_SAMPLE_ROWS = 120000; // ~30 min at 60 Hz, about 5 MB

const num = (v, d = 2) => (v === null || v === undefined || Number.isNaN(v) ? '' : +Number(v).toFixed(d));

function csvCell(v) {
  if (v === '' || v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export class SessionRecorder {
  /**
   * @param {{ includeLocation?: boolean }} [opts]
   */
  constructor({ includeLocation = false } = {}) {
    this.includeLocation = includeLocation;
    this.rows = [];
    this.counts = { sample: 0, gps: 0, event: 0, label: 0 };
    this.full = false;
    this.createdAt = new Date();
  }

  _push(kind, t, fields = {}) {
    this.rows.push({ kind, t, ...fields });
  }

  meta(name, value) {
    this._push('meta', '', { name, value });
  }

  phase(name, t) {
    this._push('phase', num(t, 1), { name });
  }

  /** @param {{t:number, ax:number, ay:number, az:number, rotAlpha:number, rotBeta:number, rotGamma:number, hasAccel:boolean}} d */
  sample(d) {
    if (!d.hasAccel) return; // desktop browsers fire empty motion events
    if (this.counts.sample >= MAX_SAMPLE_ROWS) {
      this.full = true;
      return;
    }
    this.counts.sample += 1;
    this._push('sample', num(d.t, 1), {
      ax: num(d.ax), ay: num(d.ay), az: num(d.az),
      rx: num(d.rotBeta), ry: num(d.rotGamma), rz: num(d.rotAlpha),
    });
  }

  gps(t, pos) {
    this.counts.gps += 1;
    this._push('gps', num(t, 1), {
      lat: this.includeLocation ? num(pos.latitude, 6) : '',
      lon: this.includeLocation ? num(pos.longitude, 6) : '',
      gps_acc: num(pos.accuracy, 1),
      gps_speed: num(pos.speed, 1),
    });
  }

  event(t, type, intensity) {
    this.counts.event += 1;
    this._push('event', num(t, 1), { name: type, value: num(intensity) });
  }

  label(t, type) {
    this.counts.label += 1;
    this._push('label', num(t, 1), { name: type });
  }

  /** Remove the most recent label (mis-tap). Returns true if one was removed. */
  undoLabel() {
    for (let i = this.rows.length - 1; i >= 0; i--) {
      if (this.rows[i].kind === 'label') {
        this.rows.splice(i, 1);
        this.counts.label -= 1;
        return true;
      }
    }
    return false;
  }

  stats() {
    return { ...this.counts, rows: this.rows.length, full: this.full, approxKB: Math.round(this.rows.length * 0.05) };
  }

  toCSV() {
    // row field names differ from column names only for time
    const field = (col) => (col === 't_ms' ? 't' : col);
    const lines = [COLUMNS.join(',')];
    for (const r of this.rows) {
      lines.push(COLUMNS.map((c) => (c === 'kind' ? r.kind : csvCell(r[field(c)]))).join(','));
    }
    return lines.join('\n') + '\n';
  }

  filename(profile = 'run') {
    const d = this.createdAt;
    const p = (n) => String(n).padStart(2, '0');
    return `sensestreet-${profile}-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.csv`;
  }

  /** Browser only: save the CSV through a normal download. */
  download(profile = 'run') {
    const blob = new Blob([this.toCSV()], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = this.filename(profile);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
}
