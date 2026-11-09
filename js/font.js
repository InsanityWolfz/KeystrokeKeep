/* Keystroke Keep — 3x5 bitmap pixel font, drawn into the low-res game buffer. */
(function () {
  'use strict';
  const KK = window.KK;
  const G = {
    A: ['.#.', '#.#', '###', '#.#', '#.#'], B: ['##.', '#.#', '##.', '#.#', '##.'],
    C: ['.##', '#..', '#..', '#..', '.##'], D: ['##.', '#.#', '#.#', '#.#', '##.'],
    E: ['###', '#..', '##.', '#..', '###'], F: ['###', '#..', '##.', '#..', '#..'],
    G: ['.##', '#..', '#.#', '#.#', '.##'], H: ['#.#', '#.#', '###', '#.#', '#.#'],
    I: ['###', '.#.', '.#.', '.#.', '###'], J: ['..#', '..#', '..#', '#.#', '.#.'],
    K: ['#.#', '#.#', '##.', '#.#', '#.#'], L: ['#..', '#..', '#..', '#..', '###'],
    M: ['#.#', '###', '###', '#.#', '#.#'], N: ['##.', '#.#', '#.#', '#.#', '#.#'],
    O: ['.#.', '#.#', '#.#', '#.#', '.#.'], P: ['##.', '#.#', '##.', '#..', '#..'],
    Q: ['.#.', '#.#', '#.#', '##.', '.##'], R: ['##.', '#.#', '##.', '#.#', '#.#'],
    S: ['.##', '#..', '.#.', '..#', '##.'], T: ['###', '.#.', '.#.', '.#.', '.#.'],
    U: ['#.#', '#.#', '#.#', '#.#', '###'], V: ['#.#', '#.#', '#.#', '#.#', '.#.'],
    W: ['#.#', '#.#', '###', '###', '#.#'], X: ['#.#', '#.#', '.#.', '#.#', '#.#'],
    Y: ['#.#', '#.#', '.#.', '.#.', '.#.'], Z: ['###', '..#', '.#.', '#..', '###'],
    0: ['###', '#.#', '#.#', '#.#', '###'], 1: ['.#.', '##.', '.#.', '.#.', '###'],
    2: ['##.', '..#', '.#.', '#..', '###'], 3: ['##.', '..#', '.#.', '..#', '##.'],
    4: ['#.#', '#.#', '###', '..#', '..#'], 5: ['###', '#..', '##.', '..#', '##.'],
    6: ['.##', '#..', '###', '#.#', '###'], 7: ['###', '..#', '.#.', '.#.', '.#.'],
    8: ['###', '#.#', '###', '#.#', '###'], 9: ['###', '#.#', '###', '..#', '##.'],
    '.': ['...', '...', '...', '...', '.#.'], ',': ['...', '...', '...', '.#.', '#..'],
    '!': ['.#.', '.#.', '.#.', '...', '.#.'], '?': ['##.', '..#', '.#.', '...', '.#.'],
    ':': ['...', '.#.', '...', '.#.', '...'], '-': ['...', '...', '###', '...', '...'],
    '+': ['...', '.#.', '###', '.#.', '...'], '%': ['#.#', '..#', '.#.', '#..', '#.#'],
    '/': ['..#', '..#', '.#.', '#..', '#..'], "'": ['.#.', '.#.', '...', '...', '...'],
    'x': ['...', '#.#', '.#.', '#.#', '...'], ' ': ['...', '...', '...', '...', '...'],
    '<': ['..#', '.#.', '#..', '.#.', '..#'], '>': ['#..', '.#.', '..#', '.#.', '#..'],
    '(': ['.#.', '#..', '#..', '#..', '.#.'], ')': ['.#.', '..#', '..#', '..#', '.#.'],
  };
  const glyph = (ch) => G[ch] || G[ch.toUpperCase()] || G['?'];

  const cache = new Map();
  /** Renders text (with a 1px dark outline) to a cached canvas. Returns {c, w, h}. */
  function textCanvas(str, color, outline = '#120a18', scale = 1) {
    const key = str + '|' + color + '|' + outline + '|' + scale;
    let hit = cache.get(key);
    if (hit) return hit;
    if (cache.size > 400) cache.clear();
    str = String(str);
    const gw = 4 * str.length - 1; // 3px glyph + 1px gap
    const w = (gw + 2) * scale, h = 7 * scale;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    const plot = (col) => {
      g.fillStyle = col;
      for (let i = 0; i < str.length; i++) {
        const gl = glyph(str[i]);
        for (let y = 0; y < 5; y++) for (let x = 0; x < 3; x++) {
          if (gl[y][x] === '#') g.fillRect((1 + i * 4 + x) * scale, (1 + y) * scale, scale, scale);
        }
      }
    };
    if (outline) {
      g.save();
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]]) {
        g.translate(dx * scale, dy * scale); plot(outline); g.translate(-dx * scale, -dy * scale);
      }
      g.restore();
    }
    plot(color);
    hit = { c, w, h };
    cache.set(key, hit);
    return hit;
  }

  KK.font = {
    textCanvas,
    width: (str, scale = 1) => (4 * String(str).length + 1) * scale,
    /** Draw text centered at (x, y) where y is the vertical center. */
    draw(ctx, str, x, y, color = '#fff', scale = 1, align = 'center', outline) {
      const t = textCanvas(str, color, outline === undefined ? '#120a18' : outline, scale);
      let dx = x;
      if (align === 'center') dx = x - t.w / 2;
      else if (align === 'right') dx = x - t.w;
      ctx.drawImage(t.c, Math.round(dx), Math.round(y - t.h / 2));
      return t.w;
    },
  };
})();
