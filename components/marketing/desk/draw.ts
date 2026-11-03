// Canvas drawing for the desk homepage: the wood under the bid pages, the
// survey map of the First Coast, and the contour lines on the price band.
// Ported from the approved reference build (design-drafts/2026-11-02-desk-home).
// Every color is read from the page's tokens (desk.module.css), never a literal.

const tok = (el: Element, name: string) => getComputedStyle(el).getPropertyValue(name).trim();

const rng = (seed: number) => () => {
  let s = seed | 0;
  s = (s + 0x6d2b79f5) | 0;
  seed = s;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const makeNoise = (seed: number) => {
  const r = rng(seed);
  const G = 64;
  const g: number[] = [];
  for (let i = 0; i < G * G; i++) g.push(r());
  const at = (x: number, y: number) => g[(((y % G) + G) % G) * G + (((x % G) + G) % G)];
  const sm = (t: number) => t * t * (3 - 2 * t);
  return (x: number, y: number) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = sm(x - xi), yf = sm(y - yi);
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
  };
};

const n1 = makeNoise(904);
const n2 = makeNoise(1513);
const field = (x: number, y: number) => n1(x / 160, y / 160) * 0.7 + n2(x / 60, y / 60) * 0.3;

function contours(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  step: number,
  color: string,
  keep?: (x: number, y: number) => boolean
) {
  ctx.strokeStyle = color;
  for (let L = 1; L < 20; L++) {
    const lv = L / 20;
    ctx.lineWidth = (L - 1) % 5 === 4 ? 1.4 : 0.7;
    ctx.beginPath();
    for (let y = 0; y < h; y += step)
      for (let x = 0; x < w; x += step) {
        if (keep && !keep(x, y)) continue;
        const a = field(x, y), b = field(x + step, y), c = field(x + step, y + step), d = field(x, y + step);
        const pts: [number, number][] = [];
        const edge = (v1: number, v2: number, x1: number, y1: number, x2: number, y2: number) => {
          if (v1 < lv !== v2 < lv) {
            const t = (lv - v1) / (v2 - v1);
            pts.push([x1 + (x2 - x1) * t, y1 + (y2 - y1) * t]);
          }
        };
        edge(a, b, x, y, x + step, y);
        edge(b, c, x + step, y, x + step, y + step);
        edge(c, d, x + step, y + step, x, y + step);
        edge(d, a, x, y + step, x, y);
        for (let k = 0; k + 1 < pts.length; k += 2) {
          ctx.moveTo(pts[k][0], pts[k][1]);
          ctx.lineTo(pts[k + 1][0], pts[k + 1][1]);
        }
      }
    ctx.stroke();
  }
}

// Sizes the canvas backing store to its box; returns null when it has no size.
function prepare(cv: HTMLCanvasElement, fixed?: { w: number; h: number }) {
  const box = cv.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = fixed ? fixed.w : Math.round(box.width);
  const h = fixed ? fixed.h : Math.round(box.height);
  if (!w || !h) return null;
  cv.width = w * dpr;
  cv.height = h * dpr;
  const ctx = cv.getContext("2d");
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h };
}

// The desk is 1040 x 640 wide and a portrait 620 x 900 on a phone; it is
// drawn at its untransformed size (the tilt and scale are CSS). Three planks,
// each its own tone, grain that bends around a few knots, bevelled seams, the
// lamp's pool, a coffee ring, and the edges falling off into the dark.
export function drawWood(cv: HTMLCanvasElement) {
  const p = prepare(cv, { w: cv.offsetWidth || 1040, h: cv.offsetHeight || 640 });
  if (!p) return;
  const { ctx, w: W, h: H } = p;
  const portrait = H > W;
  const dark = tok(cv, "--color-wood-dark"), light = tok(cv, "--color-wood-light"), night = tok(cv, "--color-night");
  ctx.fillStyle = tok(cv, "--color-wood");
  ctx.fillRect(0, 0, W, H);

  const seams = [Math.round(H / 3), Math.round((H * 2) / 3)];
  const planks = [0, ...seams, H];
  // each plank a shade apart, as boards cut from different trees
  [0.1, 0, 0.16].forEach((a, i) => {
    ctx.globalAlpha = a;
    ctx.fillStyle = i === 1 ? light : dark;
    ctx.fillRect(0, planks[i], W, planks[i + 1] - planks[i]);
  });
  ctx.globalAlpha = 1;

  // knots: a few per plank, the grain lines bend around them
  const r = rng(42), n = makeNoise(77);
  const knots: { x: number; y: number; a: number; sx: number; sy: number }[] = [];
  for (let i = 0; i < 3; i++) {
    const count = i === 1 ? 1 : 2;
    for (let k = 0; k < count; k++)
      knots.push({
        x: W * (0.12 + r() * 0.76),
        y: planks[i] + (planks[i + 1] - planks[i]) * (0.3 + r() * 0.4),
        a: 10 + r() * 8,
        sx: 50 + r() * 40,
        sy: 18 + r() * 10,
      });
  }
  const bend = (x: number, y: number) =>
    knots.reduce((d, k) => {
      const ex = Math.exp(-((x - k.x) ** 2) / (k.sx * k.sx)), ey = Math.exp(-((y - k.y) ** 2) / (k.sy * k.sy * 4));
      return d + Math.sign(y - k.y || 1) * k.a * ex * ey;
    }, 0);

  ctx.lineWidth = 1;
  const lines = Math.round(H / 3);
  for (let k = 0; k < lines; k++) {
    const y0 = (k / lines) * H;
    ctx.strokeStyle = k % 3 ? dark : light;
    ctx.globalAlpha = 0.16 + r() * 0.26;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 6) {
      const y = y0 + (n(x / 140, k / 6) - 0.5) * 22 + bend(x, y0);
      if (x) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.stroke();
  }
  knots.forEach((k) => {
    ctx.strokeStyle = dark;
    for (let ring = 0; ring < 5; ring++) {
      ctx.globalAlpha = 0.5 - ring * 0.08;
      ctx.lineWidth = ring ? 1 : 2.5;
      ctx.beginPath();
      ctx.ellipse(k.x, k.y, 4 + ring * 5, 2 + ring * 2.2, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.ellipse(k.x, k.y, 3.5, 1.8, 0, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;

  // a coffee ring, left from some earlier late night
  const ring = portrait ? { x: W * 0.86, y: H * 0.56, r: 30 } : { x: W * 0.9, y: H * 0.16, r: 34 };
  ctx.strokeStyle = night;
  ctx.globalAlpha = 0.28;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(ring.x, ring.y, ring.r, 0.3, Math.PI * 1.85);
  ctx.stroke();
  ctx.globalAlpha = 0.14;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(ring.x + 2, ring.y + 1, ring.r - 4, 1.2, Math.PI * 2.4);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // the lamp's pool of light
  const lx = W * 0.48, ly = H * 0.45;
  const g = ctx.createRadialGradient(lx, ly, 20, lx, ly, Math.max(W, H) * 0.5);
  g.addColorStop(0, tok(cv, "--color-lamp-pool"));
  g.addColorStop(1, "transparent");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // plank seams: a dark gap with a lit lip on the board below it
  seams.forEach((y) => {
    ctx.globalAlpha = 0.6;
    ctx.strokeStyle = night;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = light;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y + 2);
    ctx.lineTo(W, y + 2);
    ctx.stroke();
  });
  ctx.globalAlpha = 1;

  // the edges fall off into the dark, away from the lamp
  const v = ctx.createRadialGradient(lx, ly, Math.min(W, H) * 0.35, lx, ly, Math.max(W, H) * 0.78);
  v.addColorStop(0, "transparent");
  v.addColorStop(1, night);
  ctx.globalAlpha = 0.7;
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 1;
}

type Buyer = { kind: "city" | "county" | "school"; name: string; x: number; y: number; left: boolean };

export const BUYERS: Buyer[] = [
  { kind: "county", name: "Nassau County", x: 0.8, y: 0.1, left: true },
  { kind: "city", name: "City of Jacksonville", x: 0.615, y: 0.37, left: false },
  { kind: "school", name: "Duval County Public Schools", x: 0.57, y: 0.33, left: true },
  { kind: "county", name: "Clay County", x: 0.47, y: 0.75, left: false },
  { kind: "county", name: "St. Johns County", x: 0.79, y: 0.89, left: true },
];

export function drawLand(cv: HTMLCanvasElement) {
  const p = prepare(cv);
  if (!p) return;
  const { ctx, w, h } = p;
  const P = (x: number, y: number): [number, number] => [x * w, y * h];
  const coast = (y: number) => w * (0.9 + 0.018 * Math.sin((y / h) * 7) + 0.008 * Math.sin((y / h) * 23));
  const paper = tok(cv, "--color-paper-2"), water = tok(cv, "--color-water"), contour = tok(cv, "--color-contour");
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, w, h);

  // grain, on the map only
  const r = rng(7);
  ctx.fillStyle = contour;
  ctx.globalAlpha = 0.07;
  for (let i = 0; i < (w * h) / 90; i++) ctx.fillRect(r() * w, r() * h, 1, 1);
  ctx.globalAlpha = 1;

  // contours on land
  contours(ctx, w, h, 7, contour, (x) => x < coast(0) - 4);

  // the sea
  ctx.beginPath();
  ctx.moveTo(w, 0);
  ctx.lineTo(coast(0), 0);
  for (let y = 0; y <= h; y += 4) ctx.lineTo(coast(y), y);
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fillStyle = paper;
  ctx.fill();
  ctx.strokeStyle = water;
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.lineWidth = 0.7;
  ctx.globalAlpha = 0.6;
  for (let k = 1; k < 9; k++) {
    ctx.beginPath();
    for (let y = 0; y <= h; y += 4) {
      const x = coast(y) + k * 9 + Math.sin((y + k * 30) / 40) * 2;
      if (y === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // St. Johns River, south to north, then east to the sea at Mayport
  const river = (
    [[0.44, 1.02], [0.46, 0.86], [0.49, 0.72], [0.51, 0.6], [0.54, 0.5], [0.6, 0.43], [0.68, 0.41], [0.78, 0.39], [0.92, 0.38]] as const
  ).map(([x, y]) => P(x, y));
  const trace = () => {
    ctx.beginPath();
    ctx.moveTo(river[0][0], river[0][1]);
    for (let i = 1; i < river.length - 1; i++) {
      const mx = (river[i][0] + river[i + 1][0]) / 2, my = (river[i][1] + river[i + 1][1]) / 2;
      ctx.quadraticCurveTo(river[i][0], river[i][1], mx, my);
    }
    ctx.lineTo(river[river.length - 1][0], river[river.length - 1][1]);
  };
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  trace(); ctx.strokeStyle = water; ctx.lineWidth = 9; ctx.stroke();
  trace(); ctx.strokeStyle = paper; ctx.lineWidth = 5; ctx.stroke();
  trace(); ctx.strokeStyle = water; ctx.globalAlpha = 0.35; ctx.lineWidth = 5; ctx.stroke(); ctx.globalAlpha = 1;

  // the road, dotted like a hedge line: I-95 roughly north to south
  ctx.setLineDash([2, 5]);
  ctx.strokeStyle = tok(cv, "--color-hedge");
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  (
    [[0.7, 0], [0.66, 0.2], [0.63, 0.38], [0.66, 0.6], [0.72, 0.8], [0.76, 1]] as const
  ).map(([x, y]) => P(x, y)).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
  ctx.setLineDash([]);

  // the territory, edged like a title plan
  ctx.beginPath();
  ctx.moveTo(w * 0.36, h * 0.03);
  for (let y = h * 0.03; y <= h * 0.97; y += 6) ctx.lineTo(coast(y) - 10, y);
  ctx.lineTo(w * 0.36, h * 0.97);
  ctx.closePath();
  ctx.strokeStyle = tok(cv, "--color-accent");
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // towns and buyers
  const ink = tok(cv, "--color-ink"), acc = tok(cv, "--color-accent"), mut = tok(cv, "--color-muted");
  const font = `500 ${w < 520 ? 11 : 13}px ${tok(cv, "--font-body")}`;
  const small = w < 520 ? 11 : 13;
  const narrow = w < 520;
  ctx.textBaseline = "middle";
  ctx.font = font;
  ctx.fillStyle = mut;
  // On a narrow map the City of Jacksonville tag sits under its pin, where
  // the town's own name would be, so the town name is left off there.
  const towns: [string, number, number][] = [["Fernandina Beach", 0.8, narrow ? 0.155 : 0.145], ["Orange Park", 0.53, 0.57], ["St. Augustine", 0.78, 0.935]];
  if (!narrow) towns.push(["Jacksonville", 0.6, 0.43]);
  towns.forEach(
    ([t, x, y]) => {
      ctx.textAlign = "center";
      ctx.fillText(t, x * w, y * h);
    }
  );
  const shape = (k: Buyer["kind"], x: number, y: number) => {
    ctx.beginPath();
    ctx.lineWidth = 2;
    if (k === "city") {
      ctx.arc(x, y, 7.5, 0, Math.PI * 2);
      ctx.fillStyle = acc;
      ctx.strokeStyle = ink;
    } else if (k === "county") {
      ctx.moveTo(x, y - 8); ctx.lineTo(x + 8, y); ctx.lineTo(x, y + 8); ctx.lineTo(x - 8, y); ctx.closePath();
      ctx.fillStyle = ink;
      ctx.strokeStyle = paper;
    } else {
      ctx.moveTo(x, y - 8); ctx.lineTo(x + 8, y + 7); ctx.lineTo(x - 8, y + 7); ctx.closePath();
      ctx.fillStyle = ink;
      ctx.strokeStyle = paper;
    }
    ctx.fill();
    ctx.stroke();
  };
  const tag = (t: string, x: number, y: number, left: boolean, below = false) => {
    ctx.font = font;
    const tw = ctx.measureText(t).width, pw = tw + 16, ph = small + 10;
    let bx = below ? x - pw / 2 : left ? x - 14 - pw : x + 14;
    if (below) y += ph / 2 + 12;
    bx = Math.max(4, Math.min(bx, w - pw - 4)); // never past the map's edge
    ctx.fillStyle = ink;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(bx, y - ph / 2, pw, ph, 4);
    else ctx.rect(bx, y - ph / 2, pw, ph);
    ctx.fill();
    ctx.fillStyle = paper;
    ctx.textAlign = "left";
    ctx.fillText(t, bx + 8, y + 0.5);
  };
  BUYERS.forEach((b) => {
    shape(b.kind, b.x * w, b.y * h);
    tag(b.name, b.x * w, b.y * h, b.left, narrow && b.kind === "city");
  });

  // two fold creases
  ctx.globalAlpha = 0.5;
  ctx.strokeStyle = tok(cv, "--color-sheet");
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

export function drawBand(cv: HTMLCanvasElement) {
  const p = prepare(cv);
  if (!p) return;
  contours(p.ctx, p.w, p.h, 8, tok(cv, "--color-accent-ink"));
}
