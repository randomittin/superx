/**
 * Game map — renders project directory structure as a pixel art town.
 * Directories are buildings, agents are sprites walking between them.
 */

const MAP_COLORS = {
  ground: '#2d5016',
  path: '#8b7355',
  building: '#4a3728',
  roof: '#8b4513',
  window: '#ffd700',
  door: '#654321',
  tree: '#228b22',
  sky: '#1a1a2e',
  complete: '#4ecca3',
  active: '#ffd93d',
};

class GameMap {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.buildings = [];
    this.agents = [];
    this.frame = 0;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;
    this.draw();
  }

  updateFromState(state) {
    if (!state || !state.plan) return;

    const subs = state.plan.sub_projects || [];
    this.buildings = subs.map((sub, i) => ({
      id: sub.id,
      name: sub.id,
      status: sub.status || 'pending',
      x: 40 + (i % 4) * 70,
      y: 60 + Math.floor(i / 4) * 80,
    }));

    this.agents = (state.agent_history || [])
      .filter(a => a.status === 'running')
      .map((a, i) => ({
        type: a.type,
        x: 50 + (i % 4) * 70,
        y: 40 + Math.floor(i / 4) * 80,
      }));

    this.draw();
  }

  draw() {
    const { ctx, canvas } = this;
    const w = canvas.width;
    const h = canvas.height;

    // Sky
    ctx.fillStyle = MAP_COLORS.sky;
    ctx.fillRect(0, 0, w, h);

    // Ground
    ctx.fillStyle = MAP_COLORS.ground;
    ctx.fillRect(0, h * 0.4, w, h * 0.6);

    // Path
    ctx.fillStyle = MAP_COLORS.path;
    ctx.fillRect(20, h * 0.55, w - 40, 12);

    if (this.buildings.length === 0) {
      // Empty state — show welcome
      ctx.fillStyle = '#8888aa';
      ctx.font = '10px "Press Start 2P"';
      ctx.textAlign = 'center';
      ctx.fillText('No sub-projects yet', w / 2, h / 2 - 10);
      ctx.fillText('Submit a task to build the town', w / 2, h / 2 + 10);
      this.drawTrees(w, h);
      return;
    }

    // Draw paths between buildings
    ctx.strokeStyle = MAP_COLORS.path;
    ctx.lineWidth = 4;
    for (let i = 1; i < this.buildings.length; i++) {
      const a = this.buildings[i - 1];
      const b = this.buildings[i];
      ctx.beginPath();
      ctx.moveTo(a.x + 20, a.y + 40);
      ctx.lineTo(b.x + 20, b.y + 40);
      ctx.stroke();
    }

    // Draw buildings
    for (const bld of this.buildings) {
      this.drawBuilding(bld);
    }

    // Draw agents
    for (const agent of this.agents) {
      this.drawAgent(agent);
    }

    this.drawTrees(w, h);
  }

  drawBuilding(bld) {
    const { ctx } = this;
    const x = bld.x;
    const y = bld.y;
    const w = 40;
    const bh = 35;

    // Glow for complete
    if (bld.status === 'complete') {
      ctx.shadowColor = MAP_COLORS.complete;
      ctx.shadowBlur = 10;
    } else if (bld.status === 'in_progress') {
      ctx.shadowColor = MAP_COLORS.active;
      ctx.shadowBlur = 8;
    }

    // Building body
    ctx.fillStyle = MAP_COLORS.building;
    ctx.fillRect(x, y, w, bh);

    // Roof
    ctx.fillStyle = bld.status === 'complete' ? MAP_COLORS.complete : MAP_COLORS.roof;
    ctx.beginPath();
    ctx.moveTo(x - 4, y);
    ctx.lineTo(x + w / 2, y - 12);
    ctx.lineTo(x + w + 4, y);
    ctx.fill();

    ctx.shadowBlur = 0;

    // Window
    ctx.fillStyle = bld.status === 'complete' ? MAP_COLORS.complete :
                    bld.status === 'in_progress' ? MAP_COLORS.active : '#333';
    ctx.fillRect(x + 8, y + 8, 10, 8);
    ctx.fillRect(x + 22, y + 8, 10, 8);

    // Door
    ctx.fillStyle = MAP_COLORS.door;
    ctx.fillRect(x + 15, y + 20, 10, 15);

    // Label
    ctx.fillStyle = '#eee';
    ctx.font = '6px "Press Start 2P"';
    ctx.textAlign = 'center';
    const label = bld.name.length > 8 ? bld.name.substring(0, 8) : bld.name;
    ctx.fillText(label, x + w / 2, y + bh + 10);
  }

  drawAgent(agent) {
    const { ctx } = this;
    const sprite = window.SPRITES[agent.type];
    if (sprite) {
      const img = new Image();
      img.src = sprite;
      ctx.drawImage(img, agent.x, agent.y - 20, 20, 20);
    } else {
      // Fallback: colored dot
      ctx.fillStyle = PALETTES[agent.type]?.body || '#fff';
      ctx.beginPath();
      ctx.arc(agent.x + 10, agent.y - 10, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawTrees(w, h) {
    const { ctx } = this;
    const treePositions = [10, w - 30, w * 0.3, w * 0.7];
    for (const tx of treePositions) {
      const ty = h * 0.4 - 5;
      // Trunk
      ctx.fillStyle = '#654321';
      ctx.fillRect(tx + 4, ty, 4, 12);
      // Canopy
      ctx.fillStyle = MAP_COLORS.tree;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(tx + 6, ty - 16);
      ctx.lineTo(tx + 12, ty);
      ctx.fill();
    }
  }

  animate() {
    this.frame++;
    this.draw();
    requestAnimationFrame(() => this.animate());
  }
}

window.GameMap = GameMap;
