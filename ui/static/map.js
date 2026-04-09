/**
 * Isometric city map — sprite-based with proper road connections.
 * JP temples at center (core), modern buildings around (features).
 * All buildings connected by roads. Filler: trees, water, green blocks, pathways.
 * Day/night toggle. Pan with drag.
 */

const ISO_W = 120, ISO_H = 60;

// Road sprites + joint
const ROAD_FILES = { lbrt: 'road-lbrt.png', ltrb: 'road-ltrb.png', joint: 'road-joint.png' };
const ROAD_NATIVE = { w: 488, h: 287 };
const JOINT_NATIVE = { w: 354, h: 209 };
// (ROAD_SCALE removed — sizing is handled by SPRITES config)

// === SPRITE SIZE CONFIG ===
// 4 tiers: xlarge (landmark), large (2x2 grid), medium (1x1), small (0.5x)
// baseW = target rendering width in px at each tier
const SIZE = {
  xlarge: ISO_W * 2.2,  // ~264px — landmark buildings (jp2 pagoda)
  large:  ISO_W * 1.6,  // ~192px — big buildings
  medium: ISO_W * 0.9,  // ~108px — roads, small bldgs, cars
  small:  ISO_W * 0.55, // ~66px — trees, water, green blocks
};

// Sprite catalog with size tier assignments
const SPRITES = {
  // Buildings — large tier (occupy 2x2 visual space)
  'jp1.png':  { tier: 'large', nw: 800, nh: 800 },
  'jp2.png':  { tier: 'xlarge', nw: 800, nh: 800 },
  'jp3.png':  { tier: 'large', nw: 960, nh: 960 },
  'b1.png':   { tier: 'large', nw: 810, nh: 780 },
  'b3.png':   { tier: 'large', nw: 1200, nh: 1181 },
  'b5.png':   { tier: 'large', nw: 1120, nh: 1120 },
  'b6.png':   { tier: 'large', nw: 1120, nh: 1120 },
  'b8.png':   { tier: 'large', nw: 1200, nh: 1136 },
  'b9.png':   { tier: 'large', nw: 836, nh: 942 },
  'b10.png':  { tier: 'large', nw: 782, nh: 752 },
  'e1.png':   { tier: 'small', nw: 714, nh: 934 },
  'e2.png':   { tier: 'large', nw: 579, nh: 827 },
  'e3.png':   { tier: 'large', nw: 1536, nh: 912 },
  // Smaller building
  'b7.png':   { tier: 'large', nw: 791, nh: 597 },
  // Roads — medium tier
  'road-lbrt.png': { tier: 'medium', nw: 488, nh: 287, fixedW: 120 },
  'road-ltrb.png': { tier: 'medium', nw: 488, nh: 287, fixedW: 120 },
  'road-joint.png':{ tier: 'medium', nw: 354, nh: 209, fixedW: 92 }, // ~15% smaller than road
  // Cars — fixed 40px wide render (consistent size regardless of native res)
  'car1.png': { tier: 'small', nw: 664, nh: 910, fixedW: 40 },
  'car2.png': { tier: 'small', nw: 1029, nh: 929, fixedW: 40 },
  'car3.png': { tier: 'small', nw: 330, nh: 397, fixedW: 40 },
  'car4.png': { tier: 'small', nw: 430, nh: 353, fixedW: 40 },
  // Trees — small tier
  't1.png':   { tier: 'small', nw: 95, nh: 121 },
  't2.png':   { tier: 'small', nw: 89, nh: 125 },
  't3.png':   { tier: 'small', nw: 139, nh: 120 },
  't4.png':   { tier: 'small', nw: 86, nh: 99 },
  't5.png':   { tier: 'small', nw: 96, nh: 134 },
  // Water — small tier
  'wb1.png':  { tier: 'small', nw: 122, nh: 80 },
  'wb2.png':  { tier: 'small', nw: 171, nh: 115 },
  'wb3.png':  { tier: 'small', nw: 128, nh: 84 },
  'wb4.png':  { tier: 'medium', nw: 159, nh: 111 },
  'wb5.png':  { tier: 'small', nw: 123, nh: 76 },
  // Green blocks — small tier
  'gb1.png':  { tier: 'small', nw: 119, nh: 97 },
  'gb2.png':  { tier: 'small', nw: 133, nh: 84 },
  // Pathway — medium tier
  'pw.png':   { tier: 'medium', nw: 155, nh: 105 },
  // Wall
  'wall1.png':{ tier: 'small', nw: 644, nh: 779 },
};

// Helper: get draw dimensions for a sprite
function spriteSize(file) {
  const s = SPRITES[file];
  if (!s) return { w: SIZE.medium, h: SIZE.medium };
  const targetW = s.fixedW || SIZE[s.tier];
  const scale = targetW / s.nw;
  return { w: s.nw * scale, h: s.nh * scale };
}

// Building list (all unique)
const ALL_BUILDINGS = [
  'jp1.png','jp2.png','jp3.png',
  'b1.png','b3.png','b5.png','b6.png',
  'b7.png','b8.png','b9.png','b10.png',
  'e1.png','e2.png','e3.png',
];

// Filler elements
const FILLERS = {
  trees:  ['t1.png','t2.png','t3.png','t4.png','t5.png'],
  water:  ['wb1.png','wb2.png','wb3.png','wb4.png','wb5.png'],
  green:  ['gb1.png','gb2.png'],
  path:   ['pw.png'],
  cars:   ['car1.png','car2.png','car3.png','car4.png'],
};

const BB_COLORS = ['#e04050','#3090d0','#d0a020','#40b870','#b050d0','#e07030','#30a0a0','#d06090','#5080e0','#80b030','#e0a060','#4060c0','#50b0b0','#c06050'];

function toIso(c, r) { return { x: (c - r) * (ISO_W / 2), y: (c + r) * (ISO_H / 2) }; }
function hashStr(s) { let h=0; for(let i=0;i<s.length;i++) h=Math.imul(31,h)+s.charCodeAt(i)|0; return Math.abs(h); }

let _forcePhase = null; // null = auto (follows system clock)
const _phases = [null,'day','dawn','dusk','night']; // auto first so refresh starts there
let _phaseIdx = 0;
function getDayPhase() {
  if (_forcePhase) return _forcePhase;
  const h = new Date().getHours();
  if (h >= 5 && h < 7) return 'dawn';
  if (h >= 7 && h < 17) return 'day';
  if (h >= 17 && h < 20) return 'dusk';
  return 'night';
}
function getAmbience() {
  const p = getDayPhase();
  switch (p) {
    case 'dawn':  return { amb: 0.6,  sky: ['#1e1030','#5a3060','#e08040'], lights: false };
    case 'day':   return { amb: 1.0,  sky: ['#5898c8','#88c0e0','#c8e8f8'], lights: false };
    case 'dusk':  return { amb: 0.5,  sky: ['#181028','#803858','#e06838'], lights: true };
    case 'night': return { amb: 0.2,  sky: ['#04040c','#08081a','#0c1020'], lights: true };
  }
}
// Zoom level
let _mapZoom = 1.0;

document.addEventListener('DOMContentLoaded', () => {
  const dnBtn = document.getElementById('daynight-btn');
  if (dnBtn) {
    dnBtn.title = 'AUTO';
    dnBtn.addEventListener('click', () => {
      _phaseIdx = (_phaseIdx + 1) % _phases.length;
      _forcePhase = _phases[_phaseIdx];
      const label = _forcePhase ? _forcePhase.toUpperCase() : 'AUTO';
      dnBtn.title = label;
    });
  }
  const ziBtn = document.getElementById('zoom-in-btn');
  const zoBtn = document.getElementById('zoom-out-btn');
  if (ziBtn) ziBtn.addEventListener('click', () => { _mapZoom = Math.min(2.0, _mapZoom + 0.15); });
  if (zoBtn) zoBtn.addEventListener('click', () => { _mapZoom = Math.max(0.3, _mapZoom - 0.15); });
});

class GameMap {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.buildings = [];
    this._items = null;
    this.agentPositions = {};
    this.frame = 0;
    this.lastFetch = 0;
    this.images = {};
    this.imagesLoaded = false;
    this.grid = [];
    this.gridW = 0; this.gridH = 0;
    this.panX = 0; this.panY = 0;
    this._dragging = false;
    this.resize();
    this._setupPan();
    this._loadImages();
    window.addEventListener('resize', () => this.resize());
    this.fetchStructure();
    this.animate();
  }

  _setupPan() {
    const c = this.canvas;
    c.addEventListener('mousedown', e => {
      this._dragging = true; this._ds = {x:e.clientX,y:e.clientY}; this._ps = {x:this.panX,y:this.panY};
      c.style.cursor = 'grabbing';
    });
    window.addEventListener('mousemove', e => {
      if (!this._dragging) return;
      this.panX = this._ps.x + (e.clientX - this._ds.x);
      this.panY = this._ps.y + (e.clientY - this._ds.y);
    });
    window.addEventListener('mouseup', () => { this._dragging = false; this.canvas.style.cursor = 'grab'; });
    c.style.cursor = 'grab';
  }

  _loadImages() {
    const allFiles = new Set();
    Object.values(ROAD_FILES).forEach(f => allFiles.add(f));
    ALL_BUILDINGS.forEach(f => allFiles.add(f));
    Object.values(FILLERS).forEach(arr => arr.forEach(f => allFiles.add(f)));

    let loaded = 0;
    const total = allFiles.size;
    for (const f of allFiles) {
      const img = new Image();
      img.onload = () => { loaded++; if (loaded >= total) this.imagesLoaded = true; };
      img.onerror = () => { loaded++; if (loaded >= total) this.imagesLoaded = true; };
      img.src = 'tiles/' + f;
      this.images[f] = img;
    }
  }

  resize() {
    // Try parent, then right-panel, then window as fallback
    let w = 0, h = 0;
    const parent = this.canvas.parentElement;
    if (parent) {
      const rect = parent.getBoundingClientRect();
      w = rect.width; h = rect.height;
    }
    if (w < 10 || h < 10) {
      const panel = document.querySelector('.right-panel');
      if (panel) { const r = panel.getBoundingClientRect(); w = r.width; h = r.height - 40; }
    }
    if (w < 10 || h < 10) { w = window.innerWidth; h = window.innerHeight - 50; }
    this.canvas.width = w;
    this.canvas.height = h;
  }

  async fetchStructure() {
    try {
      const r = await fetch('/api/project-structure');
      const d = await r.json();
      if (d.items && d.items.length > 0) { this._items = d.items; this._buildLayout(d.items); }
    } catch(e) {}
    this.lastFetch = Date.now();
  }

  // === TIC-TAC-TOE LAYOUT ===
  // Grid is divided into a 3x3 (or 4x4) block grid with road lines between blocks.
  // Buildings sit in block centers. Roads are the dividing lines.
  _buildLayout(items) {
    const n = items.length;
    // Block grid: at least 3x3, expand if more items
    const blockCount = Math.max(3, Math.ceil(Math.sqrt(n)));
    const cellsPerBlock = 3; // each block is 3x3 cells
    const gs = blockCount * cellsPerBlock + (blockCount + 1); // blocks + road lines + borders
    this.gridW = gs; this.gridH = gs;
    this.grid = Array.from({length:gs}, () => Array(gs).fill('empty'));

    // Road lines: every (cellsPerBlock+1) cells starting at 0
    const roadLines = [];
    for (let i = 0; i <= blockCount; i++) {
      roadLines.push(i * (cellsPerBlock + 1));
    }

    // Draw horizontal road lines (LTRB — constant row)
    for (const row of roadLines) {
      if (row >= gs) continue;
      for (let c = 0; c < gs; c++) this.grid[row][c] = 'road_ltrb';
    }
    // Draw vertical road lines (LBRT — constant col)
    for (const col of roadLines) {
      if (col >= gs) continue;
      for (let r = 0; r < gs; r++) {
        if (this.grid[r][col] === 'road_ltrb') {
          this.grid[r][col] = 'road_joint'; // intersection
        } else {
          this.grid[r][col] = 'road_lbrt';
        }
      }
    }

    // Block centers: where buildings go
    const blockCenters = [];
    for (let br = 0; br < blockCount; br++) {
      for (let bc = 0; bc < blockCount; bc++) {
        const r = br * (cellsPerBlock + 1) + 1 + Math.floor(cellsPerBlock / 2);
        const c = bc * (cellsPerBlock + 1) + 1 + Math.floor(cellsPerBlock / 2);
        if (r < gs && c < gs) blockCenters.push({ r, c, br, bc });
      }
    }

    // Separate core vs feature items
    const coreNames = ['auth','api','brand-config','config','ui'];
    const coreItems = items.filter(it => coreNames.includes(it.name) || it.category === 'root');
    const featureItems = items.filter(it => !coreItems.includes(it));

    // Sort block centers: center blocks first (for core), edges for features
    const midBlock = Math.floor(blockCount / 2);
    blockCenters.sort((a, b) => {
      const da = Math.abs(a.br - midBlock) + Math.abs(a.bc - midBlock);
      const db = Math.abs(b.br - midBlock) + Math.abs(b.bc - midBlock);
      return da - db;
    });

    this.buildings = [];
    const allItems = [...coreItems, ...featureItems];

    allItems.forEach((item, i) => {
      if (i >= blockCenters.length) return; // no room
      const pos = blockCenters[i];
      const isCore = i < coreItems.length;
      this.buildings.push({
        ...item, row: pos.r, col: pos.c,
        sprite: ALL_BUILDINGS[i % ALL_BUILDINGS.length],
        flip: i >= ALL_BUILDINGS.length,
        bbColor: BB_COLORS[i % BB_COLORS.length],
        scaleVar: 0.95 + (hashStr(item.name) % 8) * 0.01,
        zone: isCore ? 'core' : 'feature',
      });
      this.grid[pos.r][pos.c] = 'building';
    });

    // === FILLERS in empty cells (not roads, not buildings) ===
    this._fillerItems = [];
    for (let r = 0; r < gs; r++) {
      for (let c = 0; c < gs; c++) {
        if (this.grid[r][c] !== 'empty') continue;
        const h = hashStr(`fill${r},${c}`);
        let file;
        if (h % 4 === 0)      file = FILLERS.trees[h % FILLERS.trees.length];
        else if (h % 9 === 0)  file = FILLERS.water[h % FILLERS.water.length];
        else if (h % 6 === 0)  file = FILLERS.green[h % FILLERS.green.length];
        else if (h % 11 === 0) file = FILLERS.path[0];
        else continue;
        this._fillerItems.push({ r, c, file });
      }
    }

    // === CARS on road cells ===
    this._carItems = [];
    let carCount = 0;
    for (let r = 0; r < gs && carCount < 5; r++) {
      for (let c = 0; c < gs && carCount < 5; c++) {
        const t = this.grid[r][c];
        if ((t === 'road_lbrt' || t === 'road_ltrb') && hashStr(`car${r}${c}`) % 12 === 0) {
          this._carItems.push({ r, c, file: FILLERS.cars[carCount % FILLERS.cars.length], direction: t });
          carCount++;
        }
      }
    }
  }

  updateFromState() {
    if (this.buildings.length === 0 || Date.now() - this.lastFetch > 10000) this.fetchStructure();
  }
  setActiveAgents(agentSet) {
    let i = 0;
    const alive = new Set();
    for (const id of agentSet) {
      alive.add(id);
      if (!this.agentPositions[id] && this.buildings.length > 0) {
        const b = this.buildings[i % this.buildings.length];
        this.agentPositions[id] = { col: b.col + 0.4, row: b.row + 0.8, active: true };
      } else if (this.agentPositions[id]) this.agentPositions[id].active = true;
      i++;
    }
    for (const id of Object.keys(this.agentPositions)) {
      if (!alive.has(id)) this.agentPositions[id].active = false;
    }
  }
  onFileWrite(fn) {
    for (const b of this.buildings) {
      if (fn.toLowerCase().includes(b.name.toLowerCase())) { b.glow = 40; break; }
    }
    if (Date.now() - this.lastFetch > 5000) this.fetchStructure();
  }

  // === DRAW ===
  draw() {
    const { ctx, canvas: cv } = this;
    const w = cv.width, h = cv.height;
    const env = getAmbience();
    const a = env.amb;

    // Sky
    const sg = ctx.createLinearGradient(0, 0, 0, h * 0.45);
    sg.addColorStop(0, env.sky[0]); sg.addColorStop(0.5, env.sky[1]); sg.addColorStop(1, env.sky[2]);
    ctx.fillStyle = sg; ctx.fillRect(0, 0, w, h);

    if (a < 0.5) {
      ctx.fillStyle = `rgba(255,245,230,${a < 0.25 ? 0.8 : 0.3})`;
      for (let i = 0; i < 30; i++) {
        const sx = (i*73+17)%w, sy = (i*37+11)%(h*0.35);
        ctx.fillRect(sx, sy, Math.sin(this.frame*0.04+i)>0.3?2:1, 1);
      }
    }
    if (getDayPhase() === 'day') {
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      for (let i = 0; i < 3; i++) {
        const cx = ((this.frame*0.12+i*200)%(w+100))-50;
        ctx.beginPath(); ctx.ellipse(cx, 25+i*20, 20+i*4, 6, 0, 0, Math.PI*2); ctx.fill();
      }
    }

    // Apply zoom
    ctx.save();
    ctx.translate(w/2, h/2);
    ctx.scale(_mapZoom, _mapZoom);
    ctx.translate(-w/2, -h/2);

    const ox = w/2 + this.panX, oy = h*0.15 + this.panY;

    if (!this.imagesLoaded || this.gridW === 0) {
      ctx.fillStyle = '#aaa'; ctx.font = '10px "Press Start 2P"'; ctx.textAlign = 'center';
      ctx.fillText(this.imagesLoaded ? 'Awaiting first task...' : 'Loading...', w/2, h/2);
      return;
    }

    // Isometric ground plane
    const tp = toIso(0,0), lp = toIso(0,this.gridH), bp = toIso(this.gridW,this.gridH), rp = toIso(this.gridW,0);
    ctx.fillStyle = getDayPhase() === 'day' ? '#EAF0F6' : '#D2D8DE';
    ctx.beginPath();
    ctx.moveTo(ox+tp.x, oy+tp.y);
    ctx.lineTo(ox+rp.x+ISO_W/2, oy+rp.y+ISO_H);
    ctx.lineTo(ox+bp.x, oy+bp.y+ISO_H*2);
    ctx.lineTo(ox+lp.x-ISO_W/2, oy+lp.y+ISO_H);
    ctx.closePath(); ctx.fill();

    // Draw roads
    this._drawRoads(ctx, ox, oy, a);

    // Sort drawables back-to-front
    const drawables = [];
    for (const b of this.buildings) drawables.push({type:'bld', d:b, r:b.row, c:b.col});
    for (const f of (this._fillerItems||[])) drawables.push({type:'fill', d:f, r:f.r, c:f.c});
    for (const car of (this._carItems||[])) drawables.push({type:'car', d:car, r:car.r, c:car.c});
    drawables.sort((a,b) => (a.r+a.c)-(b.r+b.c));

    for (const d of drawables) {
      if (d.type === 'bld') this._drawBuilding(ctx, d.d, ox, oy, env);
      else if (d.type === 'fill') this._drawFiller(ctx, d.d, ox, oy, a);
      else if (d.type === 'car') this._drawCar(ctx, d.d, ox, oy, a);
    }

    // Agents
    for (const [id, pos] of Object.entries(this.agentPositions)) {
      if (pos.active) this._drawAgent(ctx, id, pos, ox, oy);
    }

    ctx.restore(); // end zoom transform

    // Night overlay (AFTER zoom restore so it covers full canvas, not a transformed box)
    if (a < 0.5) { ctx.fillStyle = `rgba(6,8,24,${0.25 - a*0.4})`; ctx.fillRect(0,0,w,h); }
    if (getDayPhase() === 'dusk') { ctx.fillStyle = 'rgba(255,140,60,0.06)'; ctx.fillRect(0,0,w,h); }
    if (getDayPhase() === 'dawn') { ctx.fillStyle = 'rgba(255,180,100,0.04)'; ctx.fillRect(0,0,w,h); }
  }

  _drawRoads(ctx, ox, oy, a) {
    const roadLBRT = this.images[ROAD_FILES.lbrt];
    const roadLTRB = this.images[ROAD_FILES.ltrb];
    const roadJoint = this.images[ROAD_FILES.joint];

    // Use standardized sizes from SPRITES config
    const rs = spriteSize('road-lbrt.png');
    const js = spriteSize('road-joint.png');

    for (let r = 0; r < this.gridH; r++) {
      for (let c = 0; c < this.gridW; c++) {
        const t = this.grid[r][c];
        if (t !== 'road_lbrt' && t !== 'road_ltrb' && t !== 'road_joint') continue;

        const p = toIso(c, r);
        const roadYBase = (this.gridW - 1) * 2; // half of total topmost road shift
        const cx = ox + p.x, cy = oy + p.y + ISO_H + (r + c) * 4 - roadYBase;

        if (t === 'road_ltrb' && roadLTRB && roadLTRB.complete) {
          ctx.drawImage(roadLTRB, cx - rs.w/2, cy - rs.h/2, rs.w, rs.h);
        } else if (t === 'road_lbrt' && roadLBRT && roadLBRT.complete) {
          ctx.drawImage(roadLBRT, cx - rs.w/2, cy - rs.h/2, rs.w, rs.h);
        } else if (t === 'road_joint' && roadJoint && roadJoint.complete) {
          ctx.drawImage(roadJoint, cx - js.w/2, cy - js.h/2, js.w, js.h);
        }
      }
    }
  }

  _drawBuilding(ctx, b, ox, oy, env) {
    const p = toIso(b.col, b.row);
    const gridYOff = (b.row + b.col) * 4 - (this.gridW - 1) * 2;
    const x = ox + p.x, y = oy + p.y + gridYOff;
    const img = this.images[b.sprite];
    if (!img || !img.complete) return;
    const a = env.amb; // used for billboard dimming

    const sz = spriteSize(b.sprite);
    const sw = sz.w * (b.scaleVar || 1);
    const sh = sz.h * (b.scaleVar || 1);
    const drawX = x - sw/2, drawY = y - sh + ISO_H * 1.4;

    if (b.glow && b.glow > 0) { b.glow--; ctx.shadowColor = '#ffd060'; ctx.shadowBlur = b.glow/2; }

    if (b.flip) {
      ctx.save(); ctx.translate(x, 0); ctx.scale(-1, 1);
      ctx.drawImage(img, -sw/2, drawY, sw, sh); ctx.restore();
    } else {
      ctx.drawImage(img, drawX, drawY, sw, sh);
    }
    ctx.shadowBlur = 0;

    // Night window glow
    if (env.lights) {
      ctx.fillStyle = 'rgba(255,220,100,0.1)';
      for (let i = 0; i < 3; i++) {
        ctx.fillRect(drawX + sw*0.3 + (i%2)*sw*0.18, drawY + sh*0.2 + Math.floor(i/2)*sh*0.18, sw*0.1, sh*0.06);
      }
    }

    // Billboard
    const name = b.name.toUpperCase();
    const color = b.bbColor;
    const signX = x + sw*0.15, signY = drawY + sh*0.08;
    ctx.fillStyle = this._dim('#505050', a);
    ctx.fillRect(signX-1, signY, 2, 16);
    const nl = Math.min(name.length, 11);
    const sW = Math.max(26, nl*5.5+6), sH = 12;
    const sx = signX - sW/2, sy = signY - sH;
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(sx+2, sy+2, sW, sH);
    ctx.fillStyle = this._dim(color, Math.max(0.5, a)); ctx.fillRect(sx, sy, sW, sH);
    ctx.strokeStyle = this._dim('#1a1a2a', Math.max(0.4, a)); ctx.lineWidth = 0.8; ctx.strokeRect(sx, sy, sW, sH);
    ctx.fillStyle = '#fff'; ctx.font = '5px "Press Start 2P"'; ctx.textAlign = 'center';
    ctx.fillText(name.length > 11 ? name.substring(0,10)+'..' : name, sx+sW/2, sy+sH-3);
    if (env.lights) {
      ctx.shadowColor = color; ctx.shadowBlur = 5;
      ctx.fillStyle = color; ctx.globalAlpha = 0.25;
      ctx.fillRect(sx-1, sy-1, sW+2, sH+2);
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    }

    // Status dot + file count
    if (b.status === 'complete') { ctx.fillStyle='#4ecca3'; ctx.beginPath(); ctx.arc(x,drawY-4,3,0,Math.PI*2); ctx.fill(); }
    else if (b.status === 'in_progress') {
      ctx.fillStyle='#ffd93d'; ctx.beginPath(); ctx.arc(x,drawY-4,3,0,Math.PI*2); ctx.fill();
      ctx.globalAlpha=0.3+Math.sin(this.frame*0.1)*0.2; ctx.beginPath(); ctx.arc(x,drawY-4,6,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1;
    }
    if (b.files > 0) {
      ctx.fillStyle='rgba(0,0,0,0.65)'; ctx.fillRect(x+sw*0.22, drawY+2, 16, 11);
      ctx.fillStyle='#fff'; ctx.font='6px "Press Start 2P"'; ctx.textAlign='center';
      ctx.fillText(String(b.files), x+sw*0.22+8, drawY+11);
    }
  }

  _drawFiller(ctx, f, ox, oy, a) {
    const img = this.images[f.file];
    if (!img || !img.complete) return;
    const p = toIso(f.c, f.r);
    const gridYOff = (f.r + f.c) * 4 - (this.gridW - 1) * 2;
    const sz = spriteSize(f.file);
    ctx.drawImage(img, ox + p.x - sz.w/2, oy + p.y + gridYOff + ISO_H - sz.h*0.7, sz.w, sz.h);
  }

  _drawCar(ctx, car, ox, oy, a) {
    const img = this.images[car.file];
    if (!img || !img.complete) return;
    const p = toIso(car.c, car.r);
    const gridYOff = (car.r + car.c) * 4 - (this.gridW - 1) * 2;
    const sz = spriteSize(car.file);
    const cx = ox + p.x, cy = oy + p.y + gridYOff + ISO_H;
    if (car.direction === 'road_ltrb') {
      ctx.save(); ctx.translate(cx, 0); ctx.scale(-1, 1);
      ctx.drawImage(img, -sz.w/2, cy - sz.h/2, sz.w, sz.h); ctx.restore();
    } else {
      ctx.drawImage(img, cx - sz.w/2, cy - sz.h/2, sz.w, sz.h);
    }
  }

  _drawAgent(ctx, id, pos, ox, oy) {
    const p = toIso(pos.col, pos.row);
    const bounce = Math.sin(this.frame*0.12+pos.col*3)*3;
    const sx = ox+p.x, sy = oy+p.y+bounce;
    const type = id==='coder'||id.includes('code')?'coder':id==='superx'?'superx':id.includes('archi')?'architect':id.includes('design')?'design':id.includes('test')?'test-runner':id.includes('doc')?'docs-writer':'coder';
    const img = window.SPRITE_CACHE?.[type];
    if (img && img.complete) ctx.drawImage(img, sx-14, sy-36, 28, 28);
    else { ctx.fillStyle='#e06060'; ctx.fillRect(sx-4,sy-26,8,8); ctx.fillStyle='#ffd040'; ctx.fillRect(sx-3,sy-32,6,6); }
  }

  _dim(hex, a) {
    const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
    return `rgb(${(r*a)|0},${(g*a)|0},${(b*a)|0})`;
  }

  animate() { this.frame++; this.draw(); requestAnimationFrame(() => this.animate()); }
}

window.GameMap = GameMap;
