/**
 * superx pixel art dashboard — main application logic.
 * Connects SSE, updates timeline, war room, game map, and terminal.
 *
 * Note: innerHTML is used with escapeHtml() sanitized content only.
 * All user input goes through escapeHtml before rendering.
 */

let currentState = null;
let eventSource = null;
let gameMap = null;
const timelineEvents = [];
const MAX_EVENTS = 100;

// === INITIALIZATION ===

document.addEventListener('DOMContentLoaded', () => {
  gameMap = new GameMap('map-canvas');
  connectSSE();
  setupPromptInput();
  setupPlanApproval();
  setupTabs();
  window.terminalAPI.loadTerminalBuffer();
  renderWarRoom(null);
});

// === SSE CONNECTION ===

function connectSSE() {
  eventSource = new EventSource('/api/events');

  eventSource.addEventListener('state', (e) => {
    try {
      const payload = JSON.parse(e.data);
      const state = payload.data || payload;
      currentState = state;
      renderWarRoom(state);
      gameMap.updateFromState(state);
      updateStatusBadge(state);
    } catch (err) {
      console.error('State parse error:', err);
    }
  });

  eventSource.addEventListener('terminal', (e) => {
    try {
      const payload = JSON.parse(e.data);
      const line = payload.data || payload;
      window.terminalAPI.appendTerminalLine(typeof line === 'string' ? line : JSON.stringify(line));
    } catch (err) {
      console.error('Terminal parse error:', err);
    }
  });

  eventSource.addEventListener('timeline', (e) => {
    try {
      const payload = JSON.parse(e.data);
      const data = payload.data || payload;
      const agent = data.agent || 'superx';
      const type = data.type || 'info';
      const msg = data.message || '';
      if (msg) {
        const isMono = msg.startsWith('$') || msg.startsWith('Write:') || msg.startsWith('Edit:');
        addTimelineEvent(type, agent, msg, isMono);
      }
    } catch (err) {
      console.error('Timeline parse error:', err);
    }
  });

  eventSource.addEventListener('process', (e) => {
    try {
      const payload = JSON.parse(e.data);
      const data = payload.data || payload;
      if (data.status === 'starting') {
        addTimelineEvent('info', 'superx', 'Starting: ' + data.prompt, true);
        document.getElementById('status-badge').className = 'status-badge running';
        document.getElementById('status-badge').textContent = 'RUNNING';
        window.terminalAPI.clearTerminal();
        if (window._showLoading) window._showLoading(true);
      } else if (data.status === 'exited') {
        const success = data.code === 0;
        addTimelineEvent(success ? 'success' : 'error', 'superx',
          success ? 'Task completed successfully' : 'Exited with code ' + data.code);
        document.getElementById('status-badge').className = 'status-badge' + (success ? '' : ' error');
        document.getElementById('status-badge').textContent = success ? 'IDLE' : 'ERROR';
        if (window._showLoading) window._showLoading(false);
      } else if (data.status === 'stopped') {
        addTimelineEvent('warning', 'superx', 'Process stopped by user');
        document.getElementById('status-badge').className = 'status-badge';
        document.getElementById('status-badge').textContent = 'IDLE';
        if (window._showLoading) window._showLoading(false);
      }
    } catch (err) {
      console.error('Process parse error:', err);
    }
  });

  eventSource.addEventListener('plan_ready', (e) => {
    showPlanApproval(true);
    if (window._showLoading) window._showLoading(false);
    document.getElementById('status-badge').className = 'status-badge';
    document.getElementById('status-badge').textContent = 'PLAN READY';
  });

  eventSource.addEventListener('error', (e) => {
    try {
      const payload = JSON.parse(e.data);
      addTimelineEvent('error', 'superx', payload.data || 'Unknown error');
    } catch {
      // SSE connection error — will auto-reconnect
    }
  });

  eventSource.onerror = () => {
    setTimeout(connectSSE, 3000);
  };
}

// === TIMELINE ===

function addTimelineEvent(type, agent, message, useMono) {
  const event = {
    type,
    agent,
    message,
    useMono: useMono || false,
    time: new Date().toLocaleTimeString('en', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
  };

  timelineEvents.unshift(event);
  if (timelineEvents.length > MAX_EVENTS) timelineEvents.pop();

  const container = document.getElementById('timeline-events');
  const el = document.createElement('div');
  el.className = 'event ' + type;

  // Left column: avatar + time stacked
  const leftCol = document.createElement('div');
  leftCol.className = 'event-left';

  const sprite = window.SPRITES[agent];
  if (sprite) {
    const img = document.createElement('img');
    img.className = 'avatar';
    img.src = sprite;
    img.alt = agent;
    leftCol.appendChild(img);
  } else {
    const dot = document.createElement('div');
    dot.className = 'avatar';
    dot.style.background = 'var(--purple)';
    dot.style.borderRadius = '2px';
    leftCol.appendChild(dot);
  }

  const timeSpan = document.createElement('span');
  timeSpan.className = 'time';
  timeSpan.textContent = event.time;
  leftCol.appendChild(timeSpan);

  el.appendChild(leftCol);

  // Message
  const msgSpan = document.createElement('span');
  msgSpan.className = 'msg' + (event.useMono ? ' mono' : '');
  msgSpan.textContent = message;
  el.appendChild(msgSpan);

  container.insertBefore(el, container.firstChild);

  while (container.children.length > MAX_EVENTS) {
    container.removeChild(container.lastChild);
  }

  document.getElementById('event-count').textContent = timelineEvents.length;
}

// === WAR ROOM ===

const AGENT_TYPES = ['superx', 'architect', 'coder', 'design', 'test-runner', 'lint-quality', 'docs-writer', 'reviewer'];

function renderWarRoom(state) {
  const grid = document.getElementById('agent-grid');
  grid.textContent = '';

  const activeAgents = state?.agent_history?.filter(a => a.status === 'running') || [];
  const activeTypes = new Set(activeAgents.map(a => a.type));

  for (const type of AGENT_TYPES) {
    const isActive = activeTypes.has(type);
    const agent = activeAgents.find(a => a.type === type);
    const sprite = window.SPRITES[type];

    const card = document.createElement('div');
    card.className = 'agent-card ' + (isActive ? 'active' : 'idle') + ' pixel-border';

    // Status dot
    const dot = document.createElement('div');
    dot.className = 'status-dot ' + (isActive ? 'running' : 'idle');
    card.appendChild(dot);

    // Sprite
    if (sprite) {
      const img = document.createElement('img');
      img.className = 'sprite';
      img.src = sprite;
      img.alt = type;
      card.appendChild(img);
    } else {
      const placeholder = document.createElement('div');
      placeholder.className = 'sprite';
      card.appendChild(placeholder);
    }

    // Name
    const nameEl = document.createElement('div');
    nameEl.className = 'name';
    nameEl.textContent = type;
    card.appendChild(nameEl);

    // Task
    const taskEl = document.createElement('div');
    taskEl.className = 'task';
    taskEl.textContent = isActive ? (agent?.id || 'working...') : 'idle';
    card.appendChild(taskEl);

    grid.appendChild(card);
  }
}

// === STATUS BADGE ===

function updateStatusBadge(state) {
  if (!state) return;
  const phase = state.project?.phase || 'idle';
  const level = state.project?.autonomy_level || 2;
  document.getElementById('phase-info').textContent = phase + ' | L' + level;
}

// === PROMPT INPUT ===

function setupPromptInput() {
  const input = document.getElementById('prompt-input');
  const sendBtn = document.getElementById('send-btn');
  const stopBtn = document.getElementById('stop-btn');
  const loadingBar = document.getElementById('loading-bar');

  // Auto-grow textarea
  function autoGrow() {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
  }
  input.addEventListener('input', autoGrow);

  function showLoading(show) {
    if (loadingBar) {
      loadingBar.className = show ? 'loading-bar active' : 'loading-bar';
    }
  }

  async function sendPrompt() {
    const prompt = input.value.trim();
    if (!prompt) return;

    input.value = '';
    input.style.height = 'auto';
    addTimelineEvent('info', 'superx', 'Submitting: ' + prompt, true);
    showLoading(true);

    try {
      const res = await fetch('/api/prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (data.error) {
        addTimelineEvent('error', 'superx', data.error);
        showLoading(false);
      }
    } catch (err) {
      addTimelineEvent('error', 'superx', 'Failed to send prompt');
      showLoading(false);
    }
  }

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendPrompt();
    }
    // Shift+Enter inserts newline (default textarea behavior)
  });

  sendBtn.addEventListener('click', sendPrompt);

  stopBtn.addEventListener('click', async () => {
    try {
      await fetch('/api/stop', { method: 'POST' });
      showLoading(false);
    } catch (err) {
      addTimelineEvent('error', 'superx', 'Failed to stop process');
    }
  });

  // Store showLoading globally so process events can use it
  window._showLoading = showLoading;
}

// === PLAN APPROVAL ===

function showPlanApproval(visible) {
  const el = document.getElementById('plan-approval');
  if (el) el.className = visible ? 'plan-approval visible' : 'plan-approval';
}

function setupPlanApproval() {
  const approveBtn = document.getElementById('btn-approve');
  const reviseBtn = document.getElementById('btn-revise');
  const feedbackInput = document.getElementById('plan-feedback');

  approveBtn.addEventListener('click', async () => {
    showPlanApproval(false);
    addTimelineEvent('success', 'superx', 'Plan approved — executing...');
    try {
      await fetch('/api/approve', { method: 'POST' });
    } catch (err) {
      addTimelineEvent('error', 'superx', 'Failed to start execution');
    }
  });

  reviseBtn.addEventListener('click', async () => {
    const feedback = feedbackInput.value.trim();
    if (!feedback) {
      feedbackInput.focus();
      feedbackInput.style.borderColor = 'var(--error)';
      setTimeout(() => { feedbackInput.style.borderColor = ''; }, 1500);
      return;
    }
    showPlanApproval(false);
    addTimelineEvent('warning', 'superx', 'Revising plan: ' + feedback, true);
    feedbackInput.value = '';
    try {
      await fetch('/api/revise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback }),
      });
    } catch (err) {
      addTimelineEvent('error', 'superx', 'Failed to revise plan');
    }
  });

  feedbackInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      reviseBtn.click();
    }
  });
}

// === TABS ===

function setupTabs() {
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      const target = tab.dataset.tab;
      document.getElementById('tab-' + target).classList.add('active');

      if (target === 'map') {
        gameMap.resize();
      }
    });
  });

  // Fullscreen map toggle
  const fsBtn = document.getElementById('fullscreen-btn');
  if (fsBtn) {
    fsBtn.addEventListener('click', () => {
      const dashboard = document.querySelector('.dashboard');
      dashboard.classList.toggle('map-fullscreen');
      fsBtn.textContent = dashboard.classList.contains('map-fullscreen') ? '[x]' : '[ ]';

      // Switch to map tab when entering fullscreen
      if (dashboard.classList.contains('map-fullscreen')) {
        tabs.forEach(t => t.classList.remove('active'));
        document.querySelector('[data-tab="map"]').classList.add('active');
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        document.getElementById('tab-map').classList.add('active');
      }

      setTimeout(() => gameMap.resize(), 50);
    });
  }
}
