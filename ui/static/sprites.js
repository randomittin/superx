/**
 * superx pixel art sprites — 32x32 full-body characters.
 * Drawn programmatically for crisp pixel art at any scale.
 *
 * superx = human monk (orange robe, bald, prayer pose)
 * Animals: owl, fox, cat, rabbit, panda, dog, bear
 * Each has professional accessories matching their agent role.
 */

const SPRITE_SIZE = 32;
const SCALE = 3;

// Short helpers
function _b(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }
function _p(ctx, x, y, c) { ctx.fillStyle = c; ctx.fillRect(x, y, 1, 1); }

const GRADIENTS = {
  superx:         ['#1a0a00', '#e67e22'],
  architect:      ['#0a1225', '#3498db'],
  coder:          ['#051a0a', '#2ecc71'],
  design:         ['#1a0520', '#e056a0'],
  'test-runner':  ['#1a1500', '#f1c40f'],
  'lint-quality': ['#1a0e08', '#795548'],
  'docs-writer':  ['#051a15', '#1abc9c'],
  reviewer:       ['#1a0505', '#e74c3c'],
};

// Color palettes per character
const CP = {
  superx:    { skin:'#deb887', sk2:'#c4a26e', robe:'#e67e22', robe2:'#d35400', gold:'#f1c40f', dk:'#1a1a1a', wh:'#ffffff', eye:'#222222' },
  architect: { fur:'#8B6914', fur2:'#5C4033', gls:'#f1c40f', wh:'#ffffff', dk:'#1a1a1a', beak:'#e67e22', clip:'#f1c40f', body:'#3498db' },
  coder:     { fur:'#d2691e', fur2:'#a0522d', suit:'#1a2a4a', suit2:'#2c3e6d', tie:'#e74c3c', wh:'#ffffff', dk:'#1a1a1a', eye:'#2ecc71', nose:'#111' },
  design:    { fur:'#e8a040', fur2:'#c88030', shirt:'#5b3a8c', shirt2:'#8e44ad', wh:'#ffffff', dk:'#1a1a1a', eye:'#e056a0', lap:'#b0b0b0', lap2:'#888' },
  'test-runner': { fur:'#f5e6ca', fur2:'#dcc8a0', ear:'#ffb6c1', shirt:'#5dade2', shirt2:'#3498db', wh:'#ffffff', dk:'#1a1a1a', eye:'#c0392b', cup:'#8B4513', cof:'#3e2723' },
  'lint-quality':{ fur:'#f0f0f0', fur2:'#222', dk:'#1a1a1a', wh:'#ffffff', eye:'#333', desk:'#8B5E3C', desk2:'#6d4930' },
  'docs-writer': { fur:'#b0805a', fur2:'#8B6040', coat:'#e8e8e8', coat2:'#ccc', tie:'#27ae60', wh:'#ffffff', dk:'#1a1a1a', eye:'#333', doc:'#f5f5dc' },
  reviewer:  { fur:'#5C4033', fur2:'#3E2723', vest:'#922b21', vest2:'#c0392b', wh:'#ffffff', dk:'#1a1a1a', eye:'#ff4500', gls:'#6bcbef', mag:'#f1c40f' },
};

// === CHARACTER DRAWING FUNCTIONS ===

function drawMonk(ctx) {
  const c = CP.superx;
  // Head (bald)
  _b(ctx, 12, 4, 8, 9, c.skin);
  _b(ctx, 11, 5, 10, 7, c.skin);
  _b(ctx, 13, 3, 6, 1, c.skin);
  // Shadow on head
  _b(ctx, 19, 5, 2, 6, c.sk2);
  _b(ctx, 18, 10, 1, 2, c.sk2);
  // Third eye dot
  _p(ctx, 16, 5, c.gold);
  // Eyes
  _b(ctx, 13, 7, 2, 2, c.dk); _b(ctx, 17, 7, 2, 2, c.dk);
  _p(ctx, 13, 7, c.wh); _p(ctx, 17, 7, c.wh);
  // Slight smile
  _b(ctx, 14, 10, 4, 1, c.sk2);
  _p(ctx, 15, 11, c.sk2); _p(ctx, 16, 11, c.sk2);
  // Gold chain/beads
  _b(ctx, 13, 13, 6, 1, c.gold);
  _p(ctx, 16, 14, c.gold);
  // Robe body
  _b(ctx, 10, 13, 12, 14, c.robe);
  _b(ctx, 9, 15, 14, 10, c.robe);
  _b(ctx, 11, 27, 10, 3, c.robe);
  // Robe shadow/fold
  _b(ctx, 18, 14, 4, 12, c.robe2);
  _b(ctx, 15, 14, 1, 12, c.robe2);
  // Robe V-neck
  _p(ctx, 15, 13, c.skin); _p(ctx, 16, 13, c.skin);
  _p(ctx, 15, 14, c.skin);
  // Arms — prayer pose (hands together)
  _b(ctx, 9, 17, 3, 6, c.robe);
  _b(ctx, 20, 17, 3, 6, c.robe);
  // Hands together at center
  _b(ctx, 13, 19, 2, 3, c.skin);
  _b(ctx, 17, 19, 2, 3, c.skin);
  _b(ctx, 15, 19, 2, 4, c.skin);
  // Feet
  _b(ctx, 12, 29, 3, 2, c.robe2);
  _b(ctx, 17, 29, 3, 2, c.robe2);
}

function drawOwl(ctx) {
  const c = CP.architect;
  // Body (round, brown)
  _b(ctx, 10, 16, 12, 10, c.fur);
  _b(ctx, 9, 18, 14, 6, c.fur);
  _b(ctx, 11, 26, 10, 3, c.fur);
  // Chest lighter
  _b(ctx, 13, 18, 6, 7, c.fur2);
  // Head (round)
  _b(ctx, 11, 4, 10, 10, c.fur);
  _b(ctx, 10, 5, 12, 8, c.fur);
  // Ear tufts
  _b(ctx, 10, 2, 2, 3, c.fur2); _b(ctx, 20, 2, 2, 3, c.fur2);
  // Glasses frames (gold circles)
  _b(ctx, 11, 6, 5, 5, c.gls); _b(ctx, 17, 6, 5, 5, c.gls);
  // Eye whites
  _b(ctx, 12, 7, 3, 3, c.wh); _b(ctx, 18, 7, 3, 3, c.wh);
  // Pupils
  _b(ctx, 13, 8, 2, 2, c.dk); _b(ctx, 19, 8, 2, 2, c.dk);
  _p(ctx, 13, 8, c.wh); _p(ctx, 19, 8, c.wh);
  // Glasses bridge
  _b(ctx, 16, 8, 1, 1, c.gls);
  // Beak
  _b(ctx, 15, 11, 2, 2, c.beak);
  _p(ctx, 15, 13, c.beak);
  // Wing/arm holding clipboard
  _b(ctx, 21, 16, 3, 7, c.fur2);
  // Clipboard
  _b(ctx, 23, 14, 6, 9, c.wh);
  _b(ctx, 23, 14, 6, 2, c.clip);
  _b(ctx, 25, 17, 3, 1, c.fur2);
  _b(ctx, 24, 19, 4, 1, c.fur2);
  _b(ctx, 25, 21, 3, 1, c.fur2);
  // Left wing
  _b(ctx, 8, 17, 3, 6, c.fur2);
  // Feet
  _b(ctx, 12, 28, 3, 2, c.beak);
  _b(ctx, 17, 28, 3, 2, c.beak);
}

function drawFox(ctx) {
  const c = CP.coder;
  // Head
  _b(ctx, 12, 5, 8, 8, c.fur);
  _b(ctx, 11, 6, 10, 6, c.fur);
  // Pointed ears
  _b(ctx, 11, 2, 3, 4, c.fur); _b(ctx, 18, 2, 3, 4, c.fur);
  _p(ctx, 12, 3, c.fur2); _p(ctx, 19, 3, c.fur2);
  // White muzzle
  _b(ctx, 14, 9, 4, 3, c.wh);
  // Eyes
  _b(ctx, 13, 7, 2, 2, c.wh);
  _b(ctx, 17, 7, 2, 2, c.wh);
  _p(ctx, 14, 8, c.eye); _p(ctx, 18, 8, c.eye);
  // Nose
  _p(ctx, 15, 10, c.nose); _p(ctx, 16, 10, c.nose);
  // Shadow
  _b(ctx, 19, 6, 2, 5, c.fur2);
  // Suit body
  _b(ctx, 10, 14, 12, 12, c.suit);
  _b(ctx, 9, 16, 14, 8, c.suit);
  // Suit lapels
  _b(ctx, 14, 14, 1, 6, c.suit2); _b(ctx, 17, 14, 1, 6, c.suit2);
  // White shirt visible
  _b(ctx, 15, 14, 2, 4, c.wh);
  // Tie
  _b(ctx, 15, 14, 2, 1, c.tie);
  _p(ctx, 15, 15, c.tie); _p(ctx, 16, 15, c.tie);
  _p(ctx, 15, 16, c.tie);
  _p(ctx, 16, 17, c.tie);
  _p(ctx, 15, 18, c.tie);
  // Arms
  _b(ctx, 7, 16, 3, 7, c.suit);
  _b(ctx, 22, 16, 3, 7, c.suit);
  // Hands
  _b(ctx, 7, 22, 3, 2, c.fur);
  _b(ctx, 22, 22, 3, 2, c.fur);
  // Pants
  _b(ctx, 11, 25, 4, 5, c.suit2);
  _b(ctx, 17, 25, 4, 5, c.suit2);
  // Shoes
  _b(ctx, 11, 29, 4, 2, c.dk);
  _b(ctx, 17, 29, 4, 2, c.dk);
}

function drawCat(ctx) {
  const c = CP.design;
  // Head
  _b(ctx, 12, 5, 8, 8, c.fur);
  _b(ctx, 11, 6, 10, 6, c.fur);
  // Triangular ears
  _b(ctx, 11, 2, 3, 4, c.fur); _b(ctx, 18, 2, 3, 4, c.fur);
  _p(ctx, 12, 3, c.fur2); _p(ctx, 19, 3, c.fur2);
  // Eyes (big, cute)
  _b(ctx, 13, 7, 2, 2, c.wh);
  _b(ctx, 17, 7, 2, 2, c.wh);
  _p(ctx, 14, 8, c.eye); _p(ctx, 18, 8, c.eye);
  // Nose + mouth
  _p(ctx, 15, 10, c.eye); _p(ctx, 16, 10, c.eye);
  _p(ctx, 15, 11, c.fur2);
  // Whiskers (pixels extending from face)
  _p(ctx, 10, 9, c.fur2); _p(ctx, 11, 10, c.fur2);
  _p(ctx, 21, 9, c.fur2); _p(ctx, 20, 10, c.fur2);
  // Body — purple/blue shirt
  _b(ctx, 10, 14, 12, 10, c.shirt);
  _b(ctx, 9, 16, 14, 6, c.shirt);
  // Shirt collar
  _b(ctx, 14, 13, 4, 2, c.shirt2);
  // Arms extended to laptop
  _b(ctx, 8, 17, 3, 5, c.shirt);
  _b(ctx, 21, 17, 3, 5, c.shirt);
  // Paws on laptop
  _b(ctx, 10, 21, 3, 2, c.fur);
  _b(ctx, 19, 21, 3, 2, c.fur);
  // Laptop
  _b(ctx, 9, 23, 14, 2, c.lap2);   // base
  _b(ctx, 10, 20, 12, 3, c.lap);   // screen
  _b(ctx, 11, 20, 10, 2, c.shirt2); // screen glow
  // Legs/sitting
  _b(ctx, 11, 25, 4, 4, c.shirt);
  _b(ctx, 17, 25, 4, 4, c.shirt);
  // Feet
  _b(ctx, 11, 28, 4, 2, c.fur);
  _b(ctx, 17, 28, 4, 2, c.fur);
}

function drawRabbit(ctx) {
  const c = CP['test-runner'];
  // TALL ears (distinctive feature!)
  _b(ctx, 12, 0, 3, 7, c.fur);  _b(ctx, 17, 0, 3, 7, c.fur);
  _b(ctx, 13, 1, 1, 5, c.ear);  _b(ctx, 18, 1, 1, 5, c.ear);
  // Head
  _b(ctx, 11, 6, 10, 8, c.fur);
  _b(ctx, 12, 5, 8, 1, c.fur);
  // Eyes
  _b(ctx, 13, 8, 2, 2, c.wh);
  _b(ctx, 17, 8, 2, 2, c.wh);
  _p(ctx, 14, 9, c.eye); _p(ctx, 18, 9, c.eye);
  // Nose + mouth
  _p(ctx, 15, 11, c.ear); _p(ctx, 16, 11, c.ear);
  _p(ctx, 15, 12, c.fur2);
  // Cheeks
  _p(ctx, 12, 10, c.ear); _p(ctx, 19, 10, c.ear);
  // Shirt body (light blue)
  _b(ctx, 10, 14, 12, 12, c.shirt);
  _b(ctx, 9, 16, 14, 8, c.shirt);
  // Shirt collar
  _b(ctx, 14, 14, 4, 1, c.shirt2);
  // Shadow
  _b(ctx, 18, 14, 4, 10, c.shirt2);
  // Left arm
  _b(ctx, 7, 16, 3, 7, c.shirt);
  _p(ctx, 7, 22, c.fur); _p(ctx, 8, 22, c.fur);
  // Right arm holding coffee
  _b(ctx, 22, 16, 3, 5, c.shirt);
  _b(ctx, 22, 20, 3, 2, c.fur);
  // Coffee cup
  _b(ctx, 24, 17, 4, 5, c.cup);
  _b(ctx, 25, 18, 2, 3, c.cof);
  _p(ctx, 28, 19, c.cup); // handle
  _p(ctx, 28, 20, c.cup);
  // Pants
  _b(ctx, 11, 25, 4, 4, c.shirt2);
  _b(ctx, 17, 25, 4, 4, c.shirt2);
  // Feet
  _b(ctx, 10, 28, 5, 2, c.fur);
  _b(ctx, 17, 28, 5, 2, c.fur);
}

function drawPanda(ctx) {
  const c = CP['lint-quality'];
  // Head (white)
  _b(ctx, 11, 3, 10, 9, c.fur);
  _b(ctx, 12, 2, 8, 1, c.fur);
  // Black ears
  _b(ctx, 10, 1, 3, 3, c.fur2); _b(ctx, 19, 1, 3, 3, c.fur2);
  // Black eye patches
  _b(ctx, 12, 6, 3, 3, c.fur2); _b(ctx, 17, 6, 3, 3, c.fur2);
  // Eyes (white dot in black patch)
  _p(ctx, 13, 7, c.wh); _p(ctx, 18, 7, c.wh);
  // Nose
  _p(ctx, 15, 9, c.dk); _p(ctx, 16, 9, c.dk);
  // Mouth
  _p(ctx, 15, 10, c.dk);
  // Body (white with black arms)
  _b(ctx, 10, 12, 12, 10, c.fur);
  _b(ctx, 9, 14, 14, 6, c.fur);
  // Black shoulders/arms
  _b(ctx, 8, 13, 4, 7, c.fur2);
  _b(ctx, 20, 13, 4, 7, c.fur2);
  // Paws on desk
  _b(ctx, 9, 19, 3, 2, c.fur2);
  _b(ctx, 20, 19, 3, 2, c.fur2);
  // Desk
  _b(ctx, 4, 21, 24, 2, c.desk);
  _b(ctx, 5, 23, 3, 7, c.desk2);
  _b(ctx, 24, 23, 3, 7, c.desk2);
  // Belly visible above desk
  _b(ctx, 13, 15, 6, 5, c.fur);
  // Legs (hidden behind desk, show feet)
  _b(ctx, 12, 28, 3, 2, c.fur2);
  _b(ctx, 17, 28, 3, 2, c.fur2);
}

function drawDog(ctx) {
  const c = CP['docs-writer'];
  // Head
  _b(ctx, 12, 5, 8, 8, c.fur);
  _b(ctx, 11, 6, 10, 6, c.fur);
  // Floppy ears (distinctive! hang down from sides)
  _b(ctx, 9, 4, 3, 8, c.fur2); _b(ctx, 20, 4, 3, 8, c.fur2);
  // Eyes
  _b(ctx, 13, 7, 2, 2, c.wh);
  _b(ctx, 17, 7, 2, 2, c.wh);
  _p(ctx, 14, 8, c.eye); _p(ctx, 18, 8, c.eye);
  // Nose
  _b(ctx, 15, 10, 2, 1, c.dk);
  // Mouth
  _p(ctx, 15, 11, c.fur2); _p(ctx, 16, 11, c.fur2);
  // Muzzle (lighter)
  _b(ctx, 14, 9, 4, 2, c.coat);
  _b(ctx, 15, 10, 2, 1, c.dk);
  // White lab coat
  _b(ctx, 9, 14, 14, 12, c.coat);
  _b(ctx, 10, 13, 12, 1, c.coat);
  // Coat shadow
  _b(ctx, 19, 14, 4, 10, c.coat2);
  // Green tie
  _b(ctx, 15, 14, 2, 1, c.tie);
  _p(ctx, 15, 15, c.tie); _p(ctx, 16, 15, c.tie);
  _p(ctx, 15, 16, c.tie);
  _p(ctx, 16, 17, c.tie);
  _p(ctx, 15, 18, c.tie);
  // Arms in coat
  _b(ctx, 7, 16, 3, 7, c.coat);
  _b(ctx, 22, 16, 3, 7, c.coat);
  // Paws
  _b(ctx, 7, 22, 3, 2, c.fur);
  _b(ctx, 22, 22, 3, 2, c.fur);
  // Document in hand
  _b(ctx, 23, 18, 5, 6, c.doc);
  _b(ctx, 24, 19, 3, 1, c.fur2);
  _b(ctx, 24, 21, 3, 1, c.fur2);
  // Pants
  _b(ctx, 11, 25, 4, 4, c.fur2);
  _b(ctx, 17, 25, 4, 4, c.fur2);
  // Shoes
  _b(ctx, 11, 29, 4, 2, c.dk);
  _b(ctx, 17, 29, 4, 2, c.dk);
}

function drawBear(ctx) {
  const c = CP.reviewer;
  // Head (wide, brown)
  _b(ctx, 11, 4, 10, 9, c.fur);
  _b(ctx, 10, 5, 12, 7, c.fur);
  // Round ears
  _b(ctx, 10, 2, 3, 3, c.fur); _b(ctx, 19, 2, 3, 3, c.fur);
  _p(ctx, 11, 3, c.fur2); _p(ctx, 20, 3, c.fur2);
  // Glasses
  _b(ctx, 12, 6, 3, 3, c.gls); _b(ctx, 17, 6, 3, 3, c.gls);
  _b(ctx, 13, 7, 1, 1, c.wh); _b(ctx, 18, 7, 1, 1, c.wh);
  _p(ctx, 13, 7, c.eye); _p(ctx, 18, 7, c.eye);
  _p(ctx, 15, 7, c.gls); // bridge
  // Snout
  _b(ctx, 14, 9, 4, 2, c.fur2);
  _p(ctx, 15, 9, c.dk); _p(ctx, 16, 9, c.dk);
  _p(ctx, 15, 10, c.dk);
  // Vest body
  _b(ctx, 10, 14, 12, 12, c.vest);
  _b(ctx, 9, 16, 14, 8, c.vest);
  // Vest highlight
  _b(ctx, 14, 14, 4, 2, c.vest2);
  // Arms
  _b(ctx, 7, 16, 3, 7, c.vest);
  _b(ctx, 22, 16, 3, 7, c.vest);
  // Paws
  _b(ctx, 7, 22, 3, 2, c.fur);
  _b(ctx, 22, 22, 3, 2, c.fur);
  // Magnifying glass in right hand
  _b(ctx, 24, 17, 4, 4, c.mag);
  _b(ctx, 25, 18, 2, 2, c.gls);
  _p(ctx, 26, 21, c.mag);
  _p(ctx, 27, 22, c.mag);
  // Pants
  _b(ctx, 11, 25, 4, 4, c.fur2);
  _b(ctx, 17, 25, 4, 4, c.fur2);
  // Feet
  _b(ctx, 11, 29, 4, 2, c.dk);
  _b(ctx, 17, 29, 4, 2, c.dk);
}

// Character draw function map
const CHARACTERS = {
  superx:         drawMonk,
  architect:      drawOwl,
  coder:          drawFox,
  design:         drawCat,
  'test-runner':  drawRabbit,
  'lint-quality': drawPanda,
  'docs-writer':  drawDog,
  reviewer:       drawBear,
};

// === RENDERING ===

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1,3), 16);
  const g = parseInt(hex.slice(3,5), 16);
  const b = parseInt(hex.slice(5,7), 16);
  return [r, g, b];
}

function renderSprite(agentType) {
  const drawFn = CHARACTERS[agentType];
  if (!drawFn) return null;

  // Draw at native 32x32
  const work = document.createElement('canvas');
  work.width = SPRITE_SIZE;
  work.height = SPRITE_SIZE;
  const wctx = work.getContext('2d');

  // Dithered gradient background
  const grad = GRADIENTS[agentType];
  if (grad) {
    const [r1,g1,b1] = hexToRgb(grad[0]);
    const [r2,g2,b2] = hexToRgb(grad[1]);
    for (let y = 0; y < SPRITE_SIZE; y++) {
      const t = y / SPRITE_SIZE;
      for (let x = 0; x < SPRITE_SIZE; x++) {
        const d = ((x + y) % 3 === 0) ? 12 : 0;
        const r = Math.min(255, Math.round(r1 + (r2-r1)*t) + d);
        const g = Math.min(255, Math.round(g1 + (g2-g1)*t) + d);
        const b = Math.min(255, Math.round(b1 + (b2-b1)*t) + d);
        wctx.fillStyle = `rgb(${r},${g},${b})`;
        wctx.fillRect(x, y, 1, 1);
      }
    }
  }

  // Draw character
  drawFn(wctx);

  // Scale up to final size
  const canvas = document.createElement('canvas');
  canvas.width = SPRITE_SIZE * SCALE;
  canvas.height = SPRITE_SIZE * SCALE;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(work, 0, 0, SPRITE_SIZE * SCALE, SPRITE_SIZE * SCALE);

  return canvas.toDataURL();
}

function generateAllSprites() {
  const sprites = {};
  for (const type of Object.keys(CHARACTERS)) {
    sprites[type] = renderSprite(type);
  }
  return sprites;
}

window.SPRITES = generateAllSprites();
window.GRADIENTS = GRADIENTS;
