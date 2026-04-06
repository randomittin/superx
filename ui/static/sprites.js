/**
 * NFT-style pixel art sprites — upper body portraits (bust style).
 * superx is a human Buddhist monk, all others are cool bipedal animals.
 * Characters face ~30 degrees right. Each has personality accessories
 * (chains, shades, tattoos, cigarette, etc).
 *
 * 16x16 grid, rendered at 2x (32x32).
 * Color map: 0=transparent, 1=body/clothing, 2=accent, 3=skin/fur, 4=detail/accessory, 5=dark/black, 6=white, 7=eye/highlight
 */

const SPRITE_SIZE = 16;
const SCALE = 2;

const PALETTES = {
  // Human monk — orange robe, bald, gold chain, third eye
  superx:         { body: '#e67e22', accent: '#d35400', skin: '#deb887', detail: '#f1c40f', eye: '#222' },
  // Owl architect — blue jacket, gold-rim glasses, monocle chain
  architect:      { body: '#2c3e50', accent: '#3498db', skin: '#b8cce0', detail: '#f1c40f', eye: '#f39c12' },
  // Fox coder — green hoodie, dark shades, headphones
  coder:          { body: '#1a472a', accent: '#2ecc71', skin: '#e67e22', detail: '#333', eye: '#2ecc71' },
  // Unicorn designer — magenta jacket, rainbow horn, piercing
  design:         { body: '#8e44ad', accent: '#e056a0', skin: '#f5f5f5', detail: '#f1c40f', eye: '#e056a0' },
  // Rabbit test-runner — yellow vest, bandana, scar
  'test-runner':  { body: '#d4ac0d', accent: '#f1c40f', skin: '#f5e6ca', detail: '#e74c3c', eye: '#c0392b' },
  // Bear lint-quality — brown fur, gold chain, cigarette
  'lint-quality': { body: '#5d4037', accent: '#795548', skin: '#8d6e63', detail: '#f1c40f', eye: '#fff' },
  // Cat docs-writer — teal turtleneck, reading glasses, earring
  'docs-writer':  { body: '#0e6655', accent: '#1abc9c', skin: '#c4c4c4', detail: '#f1c40f', eye: '#1abc9c' },
  // Dragon reviewer — red scales, gold crown, fire breath
  reviewer:       { body: '#922b21', accent: '#e74c3c', skin: '#f1948a', detail: '#f1c40f', eye: '#f39c12' },
};

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

const SPRITE_MAPS = {
  // Human monk — bald, orange robe, gold chain necklace, third eye dot, serene face
  superx: [
    [0,0,0,0,0,3,3,3,3,3,0,0,0,0,0,0],
    [0,0,0,0,3,3,3,3,3,3,3,0,0,0,0,0],
    [0,0,0,3,3,3,3,3,3,3,3,3,0,0,0,0],
    [0,0,0,3,3,3,4,3,3,3,3,3,0,0,0,0],
    [0,0,0,3,3,5,7,3,5,7,3,3,0,0,0,0],
    [0,0,0,3,3,3,3,3,3,3,3,5,0,0,0,0],
    [0,0,0,0,3,3,3,5,3,3,3,0,0,0,0,0],
    [0,0,0,0,0,3,3,3,3,3,0,0,0,0,0,0],
    [0,0,0,0,0,1,1,1,1,1,0,0,0,0,0,0],
    [0,0,0,0,1,1,4,4,4,1,1,0,0,0,0,0],
    [0,0,0,0,1,4,1,1,1,4,1,0,0,0,0,0],
    [0,0,0,1,1,1,2,1,1,2,1,1,0,0,0,0],
    [0,0,0,1,2,2,2,2,2,2,2,1,0,0,0,0],
    [0,0,1,1,1,2,1,1,1,2,1,1,1,0,0,0],
    [0,0,1,1,1,1,1,1,1,1,1,1,1,0,0,0],
    [0,0,0,1,1,1,1,1,1,1,1,1,0,0,0,0],
  ],
  // Owl — gold-rim round glasses, blue suit jacket, monocle chain, wise look
  architect: [
    [0,0,0,0,3,3,3,3,3,3,3,0,0,0,0,0],
    [0,0,0,3,3,3,3,3,3,3,3,3,0,0,0,0],
    [0,0,0,3,4,4,3,3,4,4,3,3,0,0,0,0],
    [0,0,0,3,4,7,4,3,4,7,4,3,0,0,0,0],
    [0,0,0,3,4,4,3,3,4,4,3,5,0,0,0,0],
    [0,0,0,0,3,3,3,5,3,3,3,0,0,0,0,0],
    [0,0,0,0,0,3,5,5,5,3,0,0,0,0,0,0],
    [0,0,0,0,0,3,3,3,3,3,0,0,0,0,0,0],
    [0,0,0,0,0,1,1,1,1,1,0,0,0,0,0,0],
    [0,0,0,0,1,1,2,1,1,2,1,0,0,0,0,0],
    [0,0,0,0,1,2,2,2,2,2,1,0,0,0,0,0],
    [0,0,0,1,1,1,1,1,1,1,1,1,0,0,0,0],
    [0,0,0,1,1,1,2,1,2,1,1,1,0,0,0,0],
    [0,0,1,1,1,1,1,1,1,1,1,1,1,0,0,0],
    [0,0,1,1,1,1,1,1,1,1,1,1,1,0,0,0],
    [0,0,0,1,1,1,1,1,1,1,1,1,0,0,0,0],
  ],
  // Fox — dark shades across eyes, green hoodie with hood up, headphones around neck
  coder: [
    [0,0,0,0,3,3,1,1,1,3,3,0,0,0,0,0],
    [0,0,0,3,3,1,1,1,1,1,3,3,0,0,0,0],
    [0,0,0,3,3,3,3,3,3,3,3,3,0,0,0,0],
    [0,0,0,3,4,4,4,4,4,4,4,3,0,0,0,0],
    [0,0,0,3,4,5,5,4,5,5,4,5,0,0,0,0],
    [0,0,0,3,3,3,3,3,3,3,3,0,0,0,0,0],
    [0,0,0,0,3,3,3,5,3,3,0,0,0,0,0,0],
    [0,0,0,0,0,3,3,3,3,0,0,0,0,0,0,0],
    [0,0,0,0,5,5,1,1,1,5,5,0,0,0,0,0],
    [0,0,0,0,0,1,1,1,1,1,0,0,0,0,0,0],
    [0,0,0,0,1,1,2,1,2,1,1,0,0,0,0,0],
    [0,0,0,1,1,2,2,2,2,2,1,1,0,0,0,0],
    [0,0,0,1,1,1,1,1,1,1,1,1,0,0,0,0],
    [0,0,1,1,1,1,2,1,2,1,1,1,1,0,0,0],
    [0,0,1,1,1,1,1,1,1,1,1,1,1,0,0,0],
    [0,0,0,1,1,1,1,1,1,1,1,1,0,0,0,0],
  ],
  // Unicorn — rainbow-tipped horn, magenta jacket, lip piercing, creative vibe
  design: [
    [0,0,0,0,0,0,0,0,4,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,7,4,0,0,0,0,0,0,0],
    [0,0,0,0,3,3,3,3,3,3,3,0,0,0,0,0],
    [0,0,0,3,3,3,3,3,3,3,3,3,0,0,0,0],
    [0,0,0,3,7,5,3,3,7,5,3,3,0,0,0,0],
    [0,0,0,3,3,3,3,3,3,3,3,5,0,0,0,0],
    [0,0,0,0,3,3,3,5,3,4,3,0,0,0,0,0],
    [0,0,0,0,0,3,3,3,3,3,0,0,0,0,0,0],
    [0,0,0,0,0,1,1,1,1,1,0,0,0,0,0,0],
    [0,0,0,0,1,1,2,1,1,2,1,0,0,0,0,0],
    [0,0,0,0,1,2,2,2,2,2,1,0,0,0,0,0],
    [0,0,0,1,1,1,2,1,2,1,1,1,0,0,0,0],
    [0,0,0,1,1,1,1,1,1,1,1,1,0,0,0,0],
    [0,0,1,1,1,1,1,1,1,1,1,1,1,0,0,0],
    [0,0,1,1,1,1,1,1,1,1,1,1,1,0,0,0],
    [0,0,0,1,1,1,1,1,1,1,1,1,0,0,0,0],
  ],
  // Rabbit — tall ears, yellow vest, red bandana, battle scar across eye
  'test-runner': [
    [0,0,0,0,3,3,0,0,3,3,0,0,0,0,0,0],
    [0,0,0,0,3,3,0,0,3,3,0,0,0,0,0,0],
    [0,0,0,0,3,3,3,3,3,3,0,0,0,0,0,0],
    [0,0,0,3,3,3,3,3,3,3,3,0,0,0,0,0],
    [0,0,0,3,7,5,3,4,7,5,3,3,0,0,0,0],
    [0,0,0,3,3,3,4,3,3,3,3,5,0,0,0,0],
    [0,0,0,0,3,3,3,5,3,3,0,0,0,0,0,0],
    [0,0,0,0,4,4,4,4,4,4,4,0,0,0,0,0],
    [0,0,0,0,0,1,1,1,1,1,0,0,0,0,0,0],
    [0,0,0,0,1,1,2,1,2,1,1,0,0,0,0,0],
    [0,0,0,0,1,2,2,2,2,2,1,0,0,0,0,0],
    [0,0,0,1,1,1,1,1,1,1,1,1,0,0,0,0],
    [0,0,0,1,1,1,2,1,2,1,1,1,0,0,0,0],
    [0,0,1,1,1,1,1,1,1,1,1,1,1,0,0,0],
    [0,0,1,1,1,1,1,1,1,1,1,1,1,0,0,0],
    [0,0,0,1,1,1,1,1,1,1,1,1,0,0,0,0],
  ],
  // Bear — thick fur, gold chain necklace, cigarette in mouth, tough look
  'lint-quality': [
    [0,0,0,3,3,3,3,3,3,3,3,3,0,0,0,0],
    [0,0,3,3,2,3,3,3,3,2,3,3,0,0,0,0],
    [0,0,3,3,3,3,3,3,3,3,3,3,0,0,0,0],
    [0,0,3,6,5,3,3,3,6,5,3,3,0,0,0,0],
    [0,0,3,3,3,3,3,3,3,3,3,5,0,0,0,0],
    [0,0,0,3,3,3,5,3,3,3,0,5,6,0,0,0],
    [0,0,0,0,3,3,3,3,3,3,0,0,6,0,0,0],
    [0,0,0,0,0,3,3,3,3,0,0,0,4,0,0,0],
    [0,0,0,0,0,1,4,4,4,1,0,0,0,0,0,0],
    [0,0,0,0,1,4,1,1,1,4,1,0,0,0,0,0],
    [0,0,0,0,1,1,1,1,1,1,1,0,0,0,0,0],
    [0,0,0,1,1,1,2,1,2,1,1,1,0,0,0,0],
    [0,0,0,1,1,2,2,2,2,2,1,1,0,0,0,0],
    [0,0,1,1,1,1,1,1,1,1,1,1,1,0,0,0],
    [0,0,1,1,1,1,1,1,1,1,1,1,1,0,0,0],
    [0,0,0,1,1,1,1,1,1,1,1,1,0,0,0,0],
  ],
  // Cat — pointy ears, teal turtleneck, reading glasses low on nose, gold earring
  'docs-writer': [
    [0,0,0,3,3,0,0,0,0,3,3,0,0,0,0,0],
    [0,0,0,3,3,3,3,3,3,3,3,0,0,0,0,0],
    [0,0,3,3,3,3,3,3,3,3,3,3,0,0,0,0],
    [0,0,3,7,5,3,3,3,7,5,3,3,0,0,0,0],
    [0,0,3,3,3,3,3,3,3,3,3,5,0,0,0,0],
    [0,0,3,3,4,4,3,4,4,3,3,0,0,0,0,0],
    [0,0,0,3,3,3,3,5,3,3,5,4,0,0,0,0],
    [0,0,0,0,3,3,3,3,3,3,0,0,0,0,0,0],
    [0,0,0,0,1,1,1,1,1,1,0,0,0,0,0,0],
    [0,0,0,0,1,2,2,2,2,2,1,0,0,0,0,0],
    [0,0,0,0,1,2,1,1,1,2,1,0,0,0,0,0],
    [0,0,0,1,1,1,1,1,1,1,1,1,0,0,0,0],
    [0,0,0,1,1,1,1,1,1,1,1,1,0,0,0,0],
    [0,0,1,1,1,1,1,1,1,1,1,1,1,0,0,0],
    [0,0,1,1,1,1,1,1,1,1,1,1,1,0,0,0],
    [0,0,0,1,1,1,1,1,1,1,1,1,0,0,0,0],
  ],
  // Dragon — horns, red scales, gold crown, fire near mouth, intense eyes
  reviewer: [
    [0,0,4,0,0,0,0,0,0,4,0,0,0,0,0,0],
    [0,0,0,4,4,4,4,4,4,4,0,0,0,0,0,0],
    [0,0,0,3,3,3,3,3,3,3,3,0,0,0,0,0],
    [0,0,3,3,3,3,3,3,3,3,3,3,0,0,0,0],
    [0,0,3,7,5,3,3,3,7,5,3,3,0,0,0,0],
    [0,0,3,3,3,3,3,3,3,3,3,5,0,0,0,0],
    [0,0,0,3,3,3,5,5,3,3,0,4,7,0,0,0],
    [0,0,0,0,3,3,3,3,3,3,0,4,2,0,0,0],
    [0,0,0,0,0,1,1,1,1,1,0,0,0,0,0,0],
    [0,0,0,0,1,1,2,1,2,1,1,0,0,0,0,0],
    [0,0,0,0,1,2,2,2,2,2,1,0,0,0,0,0],
    [0,0,0,1,1,1,1,1,1,1,1,1,0,0,0,0],
    [0,0,0,1,1,1,2,1,2,1,1,1,0,0,0,0],
    [0,0,1,1,1,1,1,1,1,1,1,1,1,0,0,0],
    [0,0,1,1,1,1,1,1,1,1,1,1,1,0,0,0],
    [0,0,0,1,1,1,1,1,1,1,1,1,0,0,0,0],
  ],
};

const COLOR_MAP = { 0: null, 1: 'body', 2: 'accent', 3: 'skin', 4: 'detail', 5: '#1a1a1a', 6: '#ffffff', 7: 'eye' };

function renderSprite(agentType) {
  const map = SPRITE_MAPS[agentType];
  const pal = PALETTES[agentType];
  if (!map || !pal) return null;

  const canvas = document.createElement('canvas');
  canvas.width = SPRITE_SIZE * SCALE;
  canvas.height = SPRITE_SIZE * SCALE;
  const ctx = canvas.getContext('2d');

  for (let y = 0; y < SPRITE_SIZE; y++) {
    for (let x = 0; x < SPRITE_SIZE; x++) {
      const val = map[y][x];
      if (val === 0) continue;
      const colorKey = COLOR_MAP[val];
      const color = colorKey && colorKey.startsWith('#') ? colorKey : pal[colorKey];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x * SCALE, y * SCALE, SCALE, SCALE);
    }
  }

  return canvas.toDataURL();
}

function generateAllSprites() {
  const sprites = {};
  for (const type of Object.keys(SPRITE_MAPS)) {
    sprites[type] = renderSprite(type);
  }
  return sprites;
}

window.SPRITES = generateAllSprites();
window.PALETTES = PALETTES;
window.GRADIENTS = GRADIENTS;
