import * as THREE from 'three';

// Every surface in the game is painted here on canvases at start-up, so the
// build ships no image files.

/** Small seeded generator so textures look the same on every load. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  return [cv, cv.getContext('2d')!];
}

function finish(cv: HTMLCanvasElement, repeat = true, srgb = true): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(cv);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  if (repeat) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

/** Draw something so that it also appears wrapped round the edges, for seamless tiling. */
function tiled(size: number, x: number, y: number, r: number, draw: (x: number, y: number) => void): void {
  for (const ox of [-size, 0, size]) {
    for (const oy of [-size, 0, size]) {
      if (x + ox + r < 0 || x + ox - r > size || y + oy + r < 0 || y + oy - r > size) continue;
      draw(x + ox, y + oy);
    }
  }
}

/**
 * Artificial turf, near white so the mesh's vertex colour sets the green.
 * Thousands of short blades in slightly different shades, a few worn scuffs.
 */
export function turfTexture(): THREE.CanvasTexture {
  const size = 1024;
  const [cv, g] = canvas(size, size);
  const r = rng(11);
  g.fillStyle = '#c9d2c4';
  g.fillRect(0, 0, size, size);

  // Soft blotches: the pile lies differently from patch to patch.
  for (let i = 0; i < 90; i++) {
    const x = r() * size;
    const y = r() * size;
    const rad = 40 + r() * 110;
    const light = r() > 0.5;
    tiled(size, x, y, rad, (px, py) => {
      const grad = g.createRadialGradient(px, py, 0, px, py, rad);
      grad.addColorStop(0, light ? 'rgba(255,255,255,0.10)' : 'rgba(60,80,60,0.10)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      g.fillRect(px - rad, py - rad, rad * 2, rad * 2);
    });
  }

  g.lineCap = 'round';
  for (let i = 0; i < 26000; i++) {
    const x = r() * size;
    const y = r() * size;
    const len = 3 + r() * 6;
    const a = -Math.PI / 2 + (r() - 0.5) * 1.5;
    const v = 150 + Math.floor(r() * 105);
    g.strokeStyle = `rgba(${v - 18},${v},${v - 26},${0.35 + r() * 0.4})`;
    g.lineWidth = 0.8 + r() * 1.1;
    tiled(size, x, y, len, (px, py) => {
      g.beginPath();
      g.moveTo(px, py);
      g.lineTo(px + Math.cos(a) * len, py + Math.sin(a) * len);
      g.stroke();
    });
  }

  // Black rubber crumb that works its way up through artificial turf.
  for (let i = 0; i < 2200; i++) {
    g.fillStyle = `rgba(20,26,22,${0.15 + r() * 0.3})`;
    g.fillRect(r() * size, r() * size, 1 + r() * 1.6, 1 + r() * 1.6);
  }
  return finish(cv);
}

/** Poured concrete: speckle, board marks from the formwork, rain streaks, a few chips. */
export function concreteTexture(): THREE.CanvasTexture {
  const size = 512;
  const [cv, g] = canvas(size, size);
  const r = rng(23);
  g.fillStyle = '#8b90a0';
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < 16000; i++) {
    const v = 110 + Math.floor(r() * 80);
    g.fillStyle = `rgba(${v},${v + 3},${v + 12},${0.12 + r() * 0.25})`;
    g.fillRect(r() * size, r() * size, 1 + r() * 2.5, 1 + r() * 2.5);
  }
  // Formwork seams.
  for (let y = 0; y < size; y += 128) {
    g.fillStyle = 'rgba(30,34,48,0.35)';
    g.fillRect(0, y + r() * 3, size, 2);
    g.fillStyle = 'rgba(255,255,255,0.10)';
    g.fillRect(0, y + 3, size, 1);
  }
  // Streaks where water runs down.
  for (let i = 0; i < 46; i++) {
    const x = r() * size;
    const w = 2 + r() * 9;
    const len = 60 + r() * 260;
    const y0 = r() * size;
    const grad = g.createLinearGradient(0, y0, 0, y0 + len);
    grad.addColorStop(0, `rgba(24,28,40,${0.10 + r() * 0.16})`);
    grad.addColorStop(1, 'rgba(24,28,40,0)');
    g.fillStyle = grad;
    for (const oy of [0, -size]) g.fillRect(x, y0 + oy, w, len);
  }
  for (let i = 0; i < 30; i++) {
    g.fillStyle = `rgba(40,44,58,${0.2 + r() * 0.3})`;
    g.beginPath();
    g.ellipse(r() * size, r() * size, 1 + r() * 4, 1 + r() * 2.5, r() * 3, 0, Math.PI * 2);
    g.fill();
  }
  return finish(cv);
}

/** A goalmouth after ninety minutes: wet earth, stud marks, tufts hanging on. */
export function mudTexture(): THREE.CanvasTexture {
  const size = 512;
  const [cv, g] = canvas(size, size);
  const r = rng(37);
  g.fillStyle = '#5b3f29';
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < 240; i++) {
    const x = r() * size;
    const y = r() * size;
    const rad = 10 + r() * 46;
    const dark = r() > 0.45;
    tiled(size, x, y, rad, (px, py) => {
      const grad = g.createRadialGradient(px, py, 0, px, py, rad);
      grad.addColorStop(0, dark ? 'rgba(38,24,14,0.5)' : 'rgba(132,98,62,0.4)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      g.fillRect(px - rad, py - rad, rad * 2, rad * 2);
    });
  }
  // Stud marks in rows of three.
  for (let i = 0; i < 70; i++) {
    const x = r() * size;
    const y = r() * size;
    const a = r() * Math.PI;
    for (let k = -1; k <= 1; k++) {
      const px = x + Math.cos(a) * k * 9;
      const py = y + Math.sin(a) * k * 9;
      g.fillStyle = 'rgba(26,16,9,0.7)';
      g.beginPath();
      g.arc(px, py, 2.6, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgba(190,160,120,0.35)';
      g.beginPath();
      g.arc(px - 1, py - 1.2, 1.1, 0, Math.PI * 2);
      g.fill();
    }
  }
  // Wet glints.
  for (let i = 0; i < 500; i++) {
    g.fillStyle = `rgba(230,215,190,${0.08 + r() * 0.22})`;
    g.fillRect(r() * size, r() * size, 1 + r() * 3, 1);
  }
  for (let i = 0; i < 500; i++) {
    g.strokeStyle = `rgba(70,140,80,${0.3 + r() * 0.4})`;
    g.lineWidth = 1.2;
    const x = r() * size;
    const y = r() * size;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (r() - 0.5) * 5, y - 3 - r() * 5);
    g.stroke();
  }
  return finish(cv);
}

/** Tartan running track: red rubber granules and a painted lane line down each side. */
export function trackTexture(): THREE.CanvasTexture {
  const size = 256;
  const [cv, g] = canvas(size, size);
  const r = rng(41);
  g.fillStyle = '#c2452f';
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < 9000; i++) {
    const v = r();
    g.fillStyle = v > 0.5 ? `rgba(235,120,90,${0.2 + r() * 0.3})` : `rgba(110,30,22,${0.2 + r() * 0.35})`;
    g.fillRect(r() * size, r() * size, 1 + r() * 2, 1 + r() * 2);
  }
  return finish(cv);
}

/** White chevrons on clear, scrolled over the track so it reads as moving. */
export function chevronTexture(): THREE.CanvasTexture {
  const size = 256;
  const [cv, g] = canvas(size, size);
  g.clearRect(0, 0, size, size);
  g.strokeStyle = 'rgba(255,255,255,0.95)';
  g.lineWidth = 26;
  g.lineJoin = 'miter';
  for (const x of [-64, 64, 192]) {
    g.beginPath();
    g.moveTo(x, 38);
    g.lineTo(x + 78, 128);
    g.lineTo(x, 218);
    g.stroke();
  }
  return finish(cv);
}

/**
 * The LED boards. Greyscale: white is fully lit and takes the board's colour
 * from the mesh, near black is unlit. Panels alternate between lit with dark
 * lettering and dark with lit lettering, the way cheap perimeter boards cycle.
 * The words are the hand-painted signs of any Javanese roadside.
 */
export function boardTexture(): THREE.CanvasTexture {
  const w = 4096;
  const h = 128;
  const [cv, g] = canvas(w, h);
  const words = [
    'TAMBAL BAN',
    'ES TEH',
    'FOTOKOPI',
    'PULSA 24 JAM',
    'WARUNG KOPI',
    'SOTO AYAM',
    'BENGKEL',
    'PARKIR',
  ];
  g.fillStyle = '#0c0c0c';
  g.fillRect(0, 0, w, h);
  g.textBaseline = 'middle';
  g.textAlign = 'center';
  const panel = w / words.length;
  words.forEach((word, i) => {
    const x0 = i * panel;
    const lit = i % 3 !== 1;
    g.fillStyle = lit ? '#f4f4f4' : '#101010';
    g.fillRect(x0 + 6, 10, panel - 12, h - 20);
    g.fillStyle = lit ? '#0d0d0d' : '#ffffff';
    g.font = 'italic 800 84px "Barlow Condensed", "Arial Narrow", sans-serif';
    const width = g.measureText(word).width;
    const squeeze = Math.min(1, (panel - 70) / width);
    g.save();
    g.translate(x0 + panel / 2, h / 2 + 4);
    g.scale(squeeze, 1);
    g.fillText(word, 0, 0);
    g.restore();
  });
  // The gaps between LEDs.
  g.fillStyle = 'rgba(0,0,0,0.22)';
  for (let x = 0; x < w; x += 4) g.fillRect(x, 0, 1, h);
  for (let y = 0; y < h; y += 4) g.fillRect(0, y, w, 1);
  const tex = finish(cv);
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

/** Top of a board: a moulded plastic cap with a dark seam round each panel and a row of vents. */
export function lidTexture(): THREE.CanvasTexture {
  const size = 128;
  const [cv, g] = canvas(size, size);
  g.fillStyle = '#e9e9e9';
  g.fillRect(0, 0, size, size);
  g.strokeStyle = '#1c1c1c';
  g.lineWidth = 7;
  g.strokeRect(0, 0, size, size);
  g.strokeStyle = 'rgba(255,255,255,0.9)';
  g.lineWidth = 2;
  g.strokeRect(9, 9, size - 18, size - 18);
  g.fillStyle = 'rgba(20,20,20,0.55)';
  for (let i = 0; i < 5; i++) g.fillRect(34 + i * 13, 54, 7, 20);
  return finish(cv);
}

/** A ball in the player's colour with a white band and two caps, so you can see it roll. */
export function ballTexture(color: number): THREE.CanvasTexture {
  const w = 256;
  const h = 128;
  const [cv, g] = canvas(w, h);
  const hex = `#${color.toString(16).padStart(6, '0')}`;
  g.fillStyle = hex;
  g.fillRect(0, 0, w, h);
  // Band round the equator with a dark pinstripe each side.
  g.fillStyle = '#ffffff';
  g.fillRect(0, h * 0.4, w, h * 0.2);
  g.fillStyle = 'rgba(10,12,18,0.85)';
  g.fillRect(0, h * 0.4 - 3, w, 3);
  g.fillRect(0, h * 0.6, w, 3);
  // Number-style dots on the band so spin about the vertical axis shows too.
  for (let i = 0; i < 4; i++) {
    g.beginPath();
    g.arc((i + 0.5) * (w / 4), h / 2, 7, 0, Math.PI * 2);
    g.fill();
  }
  // Caps.
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, w, h * 0.13);
  g.fillRect(0, h * 0.87, w, h * 0.13);
  return finish(cv, false);
}

/** Dimples, as a bump map shared by every ball. */
export function dimpleTexture(): THREE.CanvasTexture {
  const w = 256;
  const h = 128;
  const [cv, g] = canvas(w, h);
  g.fillStyle = '#808080';
  g.fillRect(0, 0, w, h);
  for (let row = 0; row < 12; row++) {
    const y = (row + 0.5) * (h / 12);
    // Fewer dimples near the poles, where the map pinches together.
    const n = Math.max(4, Math.round(26 * Math.sin((Math.PI * (row + 0.5)) / 12)));
    for (let i = 0; i < n; i++) {
      const x = ((i + (row % 2) * 0.5) / n) * w;
      const rx = (w / n) * 0.3;
      const grad = g.createRadialGradient(x, y, 0, x, y, 4.5);
      grad.addColorStop(0, '#303030');
      grad.addColorStop(1, '#808080');
      g.fillStyle = grad;
      g.beginPath();
      g.ellipse(x, y, rx, 4, 0, 0, Math.PI * 2);
      g.fill();
    }
  }
  return finish(cv, true, false);
}

/** Ripples for the puddles: light lines on clear, drawn twice at different speeds. */
export function rippleTexture(): THREE.CanvasTexture {
  const size = 256;
  const [cv, g] = canvas(size, size);
  const r = rng(53);
  g.clearRect(0, 0, size, size);
  for (let i = 0; i < 46; i++) {
    const x = r() * size;
    const y = r() * size;
    const len = 18 + r() * 50;
    g.strokeStyle = `rgba(210,240,255,${0.12 + r() * 0.3})`;
    g.lineWidth = 1 + r() * 1.6;
    tiled(size, x, y, len, (px, py) => {
      g.beginPath();
      g.moveTo(px - len / 2, py);
      g.quadraticCurveTo(px, py + (r() - 0.5) * 12, px + len / 2, py);
      g.stroke();
    });
  }
  return finish(cv);
}

/** Soft round dot for particles. */
export function sparkTexture(): THREE.CanvasTexture {
  const size = 64;
  const [cv, g] = canvas(size, size);
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.45, 'rgba(255,255,255,0.85)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return finish(cv, false);
}
