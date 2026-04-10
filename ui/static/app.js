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
const activeAgents = new Set();  // tracks currently running agents
const dynamicAgents = {};  // dynamically spawned agents { id: {name, status} }

// === INITIALIZATION ===

// Pending image paths for prompt and plan areas
const pendingImages = { prompt: [] };

document.addEventListener('DOMContentLoaded', () => {
  gameMap = new GameMap('map-canvas');
  connectSSE();
  setupPromptInput();
  setupImageAttach('attach-btn', 'attach-input', 'prompt-images', 'prompt');
  setupContinueButton();
  setupCopyLogs();
  setupTabs();
  setupHistory();
  setupGitHub();
  drawPixelIcons();
  restoreSession();
  checkForCheckpoint();
  renderWarRoom(null);
});

// === SESSION RESTORE ===

async function restoreSession() {
  try {
    const res = await fetch('/api/session');
    const session = await res.json();

    resetGrouping();
    // Restore timeline events
    if (session.timeline && session.timeline.length) {
      for (const evt of session.timeline) {
        const agent = evt.agent || 'superx';
        const type = evt.type || 'info';
        const msg = evt.message || '';
        const isMono = evt.useMono || msg.startsWith('$') || msg.startsWith('Task:');
        const md = evt.markdown || false;
        if (msg) addTimelineEvent(type, agent, msg, isMono, md);
      }
    }

    // Restore terminal/logs
    if (session.terminal && session.terminal.length) {
      for (const line of session.terminal) {
        window.terminalAPI.appendTerminalLine(line);
      }
    }

    // Restore UI state
    if (session.running) {
      document.getElementById('status-badge').className = 'status-badge running';
      document.getElementById('status-badge').textContent = 'RUNNING';
      if (window._showLoading) window._showLoading(true);
    }

    if (session.phase === 'awaiting_user_input') {
      window._currentPhase = 'awaiting_user_input';
      if (window._setAwaitingState) {
        window._setAwaitingState(true, session.awaiting_prompt || '');
      }
      const badge = document.getElementById('status-badge');
      badge.className = 'status-badge';
      badge.textContent = 'AWAITING INPUT';
    }
  } catch (e) {
    // First load, no session yet
    console.log('No session to restore');
  }
}

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
      const md = data.markdown || false;
      if (msg) {
        const isMono = msg.startsWith('$') || msg.startsWith('Write:') || msg.startsWith('Edit:');
        addTimelineEvent(type, agent, msg, isMono, md);
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
        document.getElementById('status-badge').className = 'status-badge running';
        document.getElementById('status-badge').textContent = 'RUNNING';
        if (window._showLoading) window._showLoading(true);
      } else if (data.status === 'exited') {
        const success = data.code === 0;
        // If we're waiting for the user to reply, don't claim the task is done.
        // The awaiting_user_input event arrives just before this and sets the
        // phase + badge appropriately.
        if (window._currentPhase !== 'awaiting_user_input') {
          addTimelineEvent(success ? 'success' : 'error', 'superx',
            success ? 'Task completed successfully' : 'Exited with code ' + data.code);
          document.getElementById('status-badge').className = 'status-badge' + (success ? '' : ' error');
          document.getElementById('status-badge').textContent = success ? 'IDLE' : 'ERROR';
        }
        if (window._showLoading) window._showLoading(false);
        resetAllAgents();
      } else if (data.status === 'stopped') {
        addTimelineEvent('warning', 'superx', 'Process stopped by user');
        document.getElementById('status-badge').className = 'status-badge';
        document.getElementById('status-badge').textContent = 'IDLE';
        if (window._showLoading) window._showLoading(false);
        resetAllAgents();
      }
    } catch (err) {
      console.error('Process parse error:', err);
    }
  });

  eventSource.addEventListener('agent_status', (e) => {
    try {
      const payload = JSON.parse(e.data);
      const data = payload.data || payload;
      if (data.status === 'running') activeAgents.add(data.agent);
      else activeAgents.delete(data.agent);
      updateAgentCard(data.agent, data.status);
      if (gameMap) gameMap.setActiveAgents(activeAgents);
    } catch (err) {}
  });

  eventSource.addEventListener('agent_spawn', (e) => {
    try {
      const payload = JSON.parse(e.data);
      const data = payload.data || payload;
      const id = data.id || data.name || ('agent-' + Object.keys(dynamicAgents).length);
      dynamicAgents[id] = { name: data.name || id, status: 'running', desc: data.desc || '' };
      activeAgents.add(id);
      addDynamicAgentCard(id, data.name || id, data.desc || '');
    } catch (err) {}
  });

  eventSource.addEventListener('awaiting_user_input', (e) => {
    let questionText = '';
    try {
      const payload = JSON.parse(e.data);
      questionText = (payload.data && payload.data.prompt) || '';
    } catch (_) {}
    if (window._setAwaitingState) window._setAwaitingState(true, questionText);
    if (window._showLoading) window._showLoading(false);
    const badge = document.getElementById('status-badge');
    badge.className = 'status-badge';
    badge.textContent = 'AWAITING INPUT';
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

function isMarkdown(text) {
  return /^#{1,3}\s|^\*\*|\n-\s|\n\d+\.\s|\n#{1,3}\s|\|.*\|/.test(text);
}

function renderMarkdown(text) {
  if (typeof marked !== 'undefined' && typeof DOMPurify !== 'undefined') {
    let html = DOMPurify.sanitize(marked.parse(text));
    // Post-process: add pixel art icons to file tree lines
    html = addFileTreeIcons(html);
    return html;
  }
  return null;
}

function addFileTreeIcons(html) {
  // Replace folder patterns — use colored text markers instead of emojis
  // Folders end with /
  html = html.replace(/(├──|└──|│\s+├──|│\s+└──)(\s*)([a-zA-Z0-9._-]+\/)/g,
    '$1$2<span style="color:#f1c40f;font-weight:bold">[+]</span> <span style="color:#f1c40f">$3</span>');
  // Files with extensions
  html = html.replace(/(├──|└──|│\s+├──|│\s+└──)(\s*)([a-zA-Z0-9._-]+\.\w+)/g, (match, tree, space, file) => {
    if (match.includes('[+]')) return match;
    const ext = file.split('.').pop().toLowerCase();
    let marker = '*';
    let color = '#6bcbef';
    if (['ts', 'tsx', 'js', 'jsx'].includes(ext)) { marker = '>'; color = '#f1c40f'; }
    else if (['json', 'yaml', 'yml', 'toml'].includes(ext)) { marker = '#'; color = '#e67e22'; }
    else if (['md', 'mdx', 'txt'].includes(ext)) { marker = '~'; color = '#4ecca3'; }
    else if (['css', 'scss'].includes(ext)) { marker = '@'; color = '#e056a0'; }
    else if (['png', 'jpg', 'svg', 'ico'].includes(ext)) { marker = '%'; color = '#9b59b6'; }
    return tree + space + '<span style="color:' + color + '">[' + marker + ']</span> <span style="color:' + color + '">' + file + '</span>';
  });
  return html;
}

// Grouping state for consecutive same-agent events
let _group = null; // { agent, el, count, hiddenEl, toggleEl }

function resetGrouping() { _group = null; }

function _createEventEl(type, agent, message, useMono, markdown) {
  const time = new Date().toLocaleTimeString('en', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const el = document.createElement('div');
  el.className = 'event ' + type;

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
  el.appendChild(leftCol);
  // Timestamp stored as data attribute, rendered on right side of message
  el.dataset.time = time;

  const msgSpan = document.createElement('div');
  const hasMd = markdown || (isMarkdown(message) && message.length > 80);

  if (hasMd) {
    const html = renderMarkdown(message);
    if (html) {
      msgSpan.className = 'msg md';
      const contentDiv = document.createElement('div');
      contentDiv.className = 'md-content';
      contentDiv.innerHTML = html;
      msgSpan.appendChild(contentDiv);
      const expandBar = document.createElement('div');
      expandBar.className = 'expand-bar';
      expandBar.textContent = '▼ click to expand';
      msgSpan.appendChild(expandBar);
      // Only show expand bar if content overflows
      requestAnimationFrame(() => {
        if (contentDiv.scrollHeight <= contentDiv.clientHeight + 2) {
          expandBar.style.display = 'none';
          msgSpan.style.cursor = 'default';
        }
      });
      msgSpan.addEventListener('click', () => {
        if (expandBar.style.display === 'none') return;
        const isExpanded = msgSpan.classList.toggle('expanded');
        expandBar.textContent = isExpanded ? '▲ click to collapse' : '▼ click to expand';
      });
    } else {
      msgSpan.className = 'msg';
      msgSpan.textContent = message;
    }
  } else {
    msgSpan.className = 'msg' + (useMono ? ' mono' : '');
    msgSpan.textContent = message;
    if (message.length > 100) {
      msgSpan.classList.add('collapsible');
      const hint = document.createElement('span');
      hint.className = 'collapse-hint';
      hint.textContent = ' ▼';
      msgSpan.appendChild(hint);
      msgSpan.addEventListener('click', () => {
        const isExpanded = msgSpan.classList.toggle('expanded');
        hint.textContent = isExpanded ? ' ▲' : ' ▼';
      });
    }
  }
  el.appendChild(msgSpan);

  // Timestamp on the right
  const timeEl = document.createElement('span');
  timeEl.className = 'msg-time';
  timeEl.textContent = time;
  el.appendChild(timeEl);

  return el;
}

function addTimelineEvent(type, agent, message, useMono, markdown) {
  const event = {
    type, agent, message,
    useMono: useMono || false,
    markdown: markdown || false,
    time: new Date().toLocaleTimeString('en', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
  };
  timelineEvents.unshift(event);
  if (timelineEvents.length > MAX_EVENTS) timelineEvents.pop();

  // Notify map of file writes
  if (gameMap && message && (message.startsWith('Write:') || message.startsWith('Edit:'))) {
    gameMap.onFileWrite(message);
  }

  const container = document.getElementById('timeline-events');
  const el = _createEventEl(type, agent, message, useMono, markdown);

  // Markdown events always break grouping (they're major events)
  const isMajor = markdown || (isMarkdown(message) && message.length > 80);

  if (!isMajor && _group && _group.agent === agent) {
    // Continue current group — rolling window of 3 visible
    _group.count++;
    el.classList.add('grouped');

    // All events go into the allEvents list
    if (!_group.allEvents) _group.allEvents = [];
    _group.allEvents.push(el);

    // The visible area holds the latest 3
    if (!_group.visibleEl) {
      _group.visibleEl = document.createElement('div');
      _group.visibleEl.className = 'group-visible';
      _group.el.appendChild(_group.visibleEl);
    }
    _group.visibleEl.appendChild(el);

    // If more than 3 visible, move oldest to hidden
    while (_group.visibleEl.children.length > 3) {
      const oldest = _group.visibleEl.firstChild;
      if (!_group.hiddenEl) {
        _group.hiddenEl = document.createElement('div');
        _group.hiddenEl.className = 'group-hidden';
        // Insert hidden container before visible
        _group.el.insertBefore(_group.hiddenEl, _group.visibleEl);
      }
      _group.hiddenEl.appendChild(oldest);
    }

    // Update or create the "see all" toggle
    if (_group.count > 3) {
      if (!_group.toggleEl) {
        const toggle = document.createElement('div');
        toggle.className = 'group-toggle';
        _group.toggleEl = toggle;
        // Insert toggle before visible area
        _group.el.insertBefore(toggle, _group.visibleEl);
        const grp = _group;
        toggle.addEventListener('click', () => {
          const expanded = grp.hiddenEl.classList.toggle('expanded');
          grp.toggleEl.textContent = expanded
            ? '- collapse'
            : '+ see all ' + grp.count + ' actions';
        });
      }
      _group.toggleEl.textContent = '+ see all ' + _group.count + ' actions';
    }
  } else {
    // Start new group
    const groupEl = document.createElement('div');
    groupEl.className = 'event-group';
    groupEl.appendChild(el);
    container.appendChild(groupEl);
    _group = { agent, el: groupEl, count: 1, hiddenEl: null, toggleEl: null };
  }

  while (container.children.length > MAX_EVENTS) {
    container.removeChild(container.firstChild);
  }

  container.scrollTop = container.scrollHeight;
  document.getElementById('event-count').textContent = timelineEvents.length;
}

// === WAR ROOM ===

const AGENT_TYPES = ['superx', 'architect', 'coder', 'design', 'test-runner', 'lint-quality', 'docs-writer', 'reviewer'];

function renderWarRoom(state) {
  const grid = document.getElementById('agent-grid');
  grid.textContent = '';

  // Core agents
  for (const type of AGENT_TYPES) {
    const isActive = activeAgents.has(type);
    _createAgentCard(grid, type, type, window.SPRITES[type], isActive);
  }

  // Dynamic spawned agents
  for (const [id, info] of Object.entries(dynamicAgents)) {
    const isActive = activeAgents.has(id);
    _createAgentCard(grid, id, info.name, getVariantSprite(id), isActive, info.desc);
  }
}

function _createAgentCard(grid, id, label, sprite, isActive, desc) {
  const card = document.createElement('div');
  card.className = 'agent-card ' + (isActive ? 'active' : 'idle') + ' pixel-border';
  card.dataset.agentId = id;

  const dot = document.createElement('div');
  dot.className = 'status-dot ' + (isActive ? 'running' : 'idle');
  card.appendChild(dot);

  if (sprite) {
    const img = document.createElement('img');
    img.className = 'sprite';
    img.src = sprite;
    img.alt = label;
    card.appendChild(img);
  }

  const info = document.createElement('div');
  info.className = 'card-info';
  const nameEl = document.createElement('div');
  nameEl.className = 'name';
  nameEl.textContent = label;
  info.appendChild(nameEl);
  const taskEl = document.createElement('div');
  taskEl.className = 'task';
  taskEl.textContent = isActive ? (desc || 'working...') : 'idle';
  info.appendChild(taskEl);
  card.appendChild(info);

  const grad = window.GRADIENTS[id] || window.GRADIENTS.coder;
  if (grad) card.style.background = 'linear-gradient(135deg, ' + grad[0] + ', ' + grad[1] + '44)';
  grid.appendChild(card);
}

function addDynamicAgentCard(id, name, desc) {
  const grid = document.getElementById('agent-grid');
  _createAgentCard(grid, id, name, getVariantSprite(id), true, desc);
}

// Variant coder sprites with different suit/tie colors
const _variantCache = {};
const VARIANT_COLORS = [
  { suit: '#2c3e50', tie: '#e74c3c' },
  { suit: '#1a5276', tie: '#f39c12' },
  { suit: '#4a235a', tie: '#2ecc71' },
  { suit: '#0e6251', tie: '#e056a0' },
  { suit: '#7b241c', tie: '#3498db' },
  { suit: '#154360', tie: '#f1c40f' },
  { suit: '#512e5f', tie: '#1abc9c' },
  { suit: '#1a1a2e', tie: '#ff6b6b' },
];

function getVariantSprite(id) {
  if (_variantCache[id]) return _variantCache[id];
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  const v = VARIANT_COLORS[Math.abs(hash) % VARIANT_COLORS.length];
  const work = document.createElement('canvas');
  work.width = 32; work.height = 32;
  const w = work.getContext('2d');
  // BG gradient
  for (let y = 0; y < 32; y++) {
    w.fillStyle = `rgb(${5+Math.round(40*y/32)},${10+Math.round(20*y/32)},${10+Math.round(30*y/32)})`;
    w.fillRect(0, y, 32, 1);
  }
  // Fox head
  const f='#d2691e',f2='#a0522d';
  w.fillStyle=f; w.fillRect(12,5,8,8); w.fillRect(11,6,10,6);
  w.fillStyle=f; w.fillRect(11,2,3,4); w.fillRect(18,2,3,4);
  w.fillStyle=f2; w.fillRect(12,3,1,1); w.fillRect(19,3,1,1);
  w.fillStyle='#fff'; w.fillRect(14,9,4,3); w.fillRect(13,7,2,2); w.fillRect(17,7,2,2);
  w.fillStyle='#111'; w.fillRect(14,8,1,1); w.fillRect(18,8,1,1); w.fillRect(15,10,2,1);
  // Suit body
  w.fillStyle=v.suit; w.fillRect(10,14,12,12); w.fillRect(9,16,14,8);
  w.fillRect(7,16,3,7); w.fillRect(22,16,3,7);
  w.fillStyle='#fff'; w.fillRect(15,14,2,4);
  w.fillStyle=v.tie; w.fillRect(15,14,2,1); w.fillRect(15,15,1,1);
  w.fillRect(16,16,1,1); w.fillRect(15,17,1,1);
  w.fillStyle=f; w.fillRect(7,22,3,2); w.fillRect(22,22,3,2);
  w.fillStyle=v.suit; w.fillRect(11,25,4,5); w.fillRect(17,25,4,5);
  w.fillStyle='#111'; w.fillRect(11,29,4,2); w.fillRect(17,29,4,2);
  // Scale up
  const c = document.createElement('canvas');
  c.width=96; c.height=96;
  const ctx=c.getContext('2d'); ctx.imageSmoothingEnabled=false;
  ctx.drawImage(work,0,0,96,96);
  _variantCache[id]=c.toDataURL();
  return _variantCache[id];
}

// === STATUS BADGE ===

function updateStatusBadge(state) {
  if (!state) return;
  const phase = state.project?.phase || 'idle';
  const level = state.project?.autonomy_level || 2;
  document.getElementById('phase-info').textContent = phase + ' | L' + level;
}

// === PROMPT INPUT ===

const promptHistory = [];
let historyIndex = -1;
const AUTONOMY_LEVELS = ['L1 Guided', 'L2 Checkpoint', 'L3 Full Auto'];
let autonomyLevel = 1; // 0-based index, default L2

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
    const images = pendingImages.prompt.slice();
    if (!prompt && images.length === 0) return;

    // Save to prompt history
    if (prompt) {
      promptHistory.unshift(prompt);
      if (promptHistory.length > 50) promptHistory.pop();
      historyIndex = -1;
    }

    // If no project directory is set, buffer the prompt and pop the project
    // modal. The modal save handler will auto-submit the buffered task once
    // the path is in place. Avoids the user having to type their task twice.
    if (!window._projectPath) {
      window._pendingTask = { prompt, images };
      input.value = '';
      input.style.height = 'auto';
      pendingImages.prompt = [];
      updateImagePreview('prompt-images', 'prompt');
      if (window._openProjectModal) {
        window._openProjectModal('Pick a project directory before running this task. Plans, code, and research will all be written there.');
      }
      return;
    }

    input.value = '';
    input.style.height = 'auto';
    const shortPrompt = prompt.length > 80 ? prompt.substring(0, 80) + '...' : prompt;
    const imgNote = images.length ? ' [' + images.length + ' img]' : '';
    addTimelineEvent('info', 'superx', 'Task: ' + shortPrompt + imgNote, true);
    showLoading(true);

    // Clear images
    pendingImages.prompt = [];
    updateImagePreview('prompt-images', 'prompt');

    try {
      const res = await fetch('/api/prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, images }),
      });
      const data = await res.json();
      if (data.error) {
        // Server says we still need a project directory — buffer + open modal.
        if (data.needs_project) {
          window._pendingTask = { prompt, images };
          showLoading(false);
          if (window._openProjectModal) {
            window._openProjectModal('Pick a project directory before running this task. Plans, code, and research will all be written there.');
          }
          return;
        }
        addTimelineEvent('error', 'superx', data.error);
        showLoading(false);
      }
    } catch (err) {
      addTimelineEvent('error', 'superx', 'Failed to send prompt');
      showLoading(false);
    }
  }

  // Show / hide the awaiting-input panel and populate it with the question.
  // Detects multiple-choice options like "(A) ...", "(B) ..." and renders
  // them as quick-pick buttons in addition to the free-form text input.
  function setAwaitingState(awaiting, questionText) {
    window._currentPhase = awaiting ? 'awaiting_user_input' : 'idle';
    const panel = document.getElementById('awaiting-panel');
    if (!panel) return;
    if (awaiting) {
      panel.classList.add('visible');
      const qEl = document.getElementById('awaiting-question');
      const optsEl = document.getElementById('awaiting-options');
      const text = questionText || 'Claude is waiting for your input';
      qEl.textContent = text;
      optsEl.textContent = '';

      // Detect (A), (B), (C), (D) option patterns. Also picks up bold like **(A)**.
      const optionRegex = /\*{0,2}\(([A-Z])\)\*{0,2}/g;
      const seen = new Set();
      const matches = [];
      let m;
      while ((m = optionRegex.exec(text)) !== null) {
        if (seen.has(m[1])) continue;
        seen.add(m[1]);
        const after = text.substring(m.index + m[0].length, m.index + m[0].length + 60);
        const desc = after.replace(/^\s*[-:.]?\s*/, '').split(/\n/)[0].trim().substring(0, 40);
        matches.push({ letter: m[1], desc });
      }

      // Also detect a yes/no question — simple heuristic on the last sentence.
      const lastSentence = text.split(/[.!?]/).filter(s => s.trim()).pop() || '';
      const lower = lastSentence.toLowerCase();
      const looksLikeYesNo =
        matches.length === 0 && (
          /\b(should|do|does|did|are|is|can|will|would|shall|may|have|has|want)\b/.test(lower) ||
          lower.includes('yes or no') || lower.includes('y/n')
        );

      if (matches.length >= 2) {
        for (const opt of matches) {
          const btn = document.createElement('button');
          btn.className = 'btn-awaiting-option';
          btn.title = opt.desc;
          btn.innerHTML = '<span class="opt-letter">(' + opt.letter + ')</span>' +
                          (opt.desc ? '<span class="opt-desc">' + opt.desc + '</span>' : '');
          btn.addEventListener('click', () => sendAwaitingReply(opt.letter));
          optsEl.appendChild(btn);
        }
      } else if (looksLikeYesNo) {
        for (const choice of ['yes', 'no']) {
          const btn = document.createElement('button');
          btn.className = 'btn-awaiting-option';
          btn.innerHTML = '<span class="opt-letter">' + choice.toUpperCase() + '</span>';
          btn.addEventListener('click', () => sendAwaitingReply(choice));
          optsEl.appendChild(btn);
        }
      }
      // Focus the text input for free-form replies
      const ta = document.getElementById('awaiting-input');
      if (ta) ta.focus();
    } else {
      panel.classList.remove('visible');
      const ta = document.getElementById('awaiting-input');
      if (ta) ta.value = '';
      const optsEl = document.getElementById('awaiting-options');
      if (optsEl) optsEl.textContent = '';
    }
  }
  // Expose so SSE handlers can call it
  window._setAwaitingState = setAwaitingState;

  // Send a reply to /api/reply (used by both option buttons and the SEND button)
  async function sendAwaitingReply(replyText) {
    const text = (replyText || '').trim();
    if (!text) return;
    const shortPrompt = text.length > 80 ? text.substring(0, 80) + '...' : text;
    addTimelineEvent('info', 'superx', 'Reply: ' + shortPrompt, true);
    showLoading(true);
    setAwaitingState(false);
    try {
      const res = await fetch('/api/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reply: text, images: [] }),
      });
      const data = await res.json();
      if (data.error) {
        addTimelineEvent('error', 'superx', data.error);
        showLoading(false);
      }
    } catch (err) {
      addTimelineEvent('error', 'superx', 'Failed to send reply');
      showLoading(false);
    }
  }
  // Expose for option buttons inside setAwaitingState
  window._sendAwaitingReply = sendAwaitingReply;

  // Wire up the SEND button + Enter on the awaiting input
  const awaitingSendBtn = document.getElementById('awaiting-send');
  const awaitingInput = document.getElementById('awaiting-input');
  if (awaitingSendBtn && awaitingInput) {
    awaitingSendBtn.addEventListener('click', () => {
      sendAwaitingReply(awaitingInput.value);
    });
    awaitingInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendAwaitingReply(awaitingInput.value);
      }
    });
  }

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendPrompt();
      return;
    }

    // Arrow Up — cycle through prompt history
    if (e.key === 'ArrowUp' && input.value.indexOf('\n') === -1) {
      if (promptHistory.length > 0 && historyIndex < promptHistory.length - 1) {
        e.preventDefault();
        historyIndex++;
        input.value = promptHistory[historyIndex];
        autoGrow();
      }
      return;
    }

    // Arrow Down — cycle forward in prompt history
    if (e.key === 'ArrowDown' && input.value.indexOf('\n') === -1) {
      e.preventDefault();
      if (historyIndex > 0) {
        historyIndex--;
        input.value = promptHistory[historyIndex];
      } else {
        historyIndex = -1;
        input.value = '';
      }
      autoGrow();
      return;
    }

    // Arrow Left/Right — cycle autonomy level (only when input is empty)
    if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !input.value) {
      e.preventDefault();
      if (e.key === 'ArrowLeft') autonomyLevel = Math.max(0, autonomyLevel - 1);
      else autonomyLevel = Math.min(2, autonomyLevel + 1);
      const label = AUTONOMY_LEVELS[autonomyLevel];
      document.getElementById('phase-info').textContent = label;
      // Flash the badge to show the change
      const badge = document.getElementById('status-badge');
      badge.textContent = label;
      badge.className = 'status-badge running';
      setTimeout(() => {
        badge.textContent = badge.dataset.lastStatus || 'IDLE';
        badge.className = 'status-badge';
      }, 1200);
      return;
    }
  });

  sendBtn.addEventListener('click', sendPrompt);

  stopBtn.addEventListener('click', async () => {
    try {
      await fetch('/api/stop', { method: 'POST' });
      showLoading(false);
      if (window._setAwaitingState) window._setAwaitingState(false);
      // Clear frontend
      document.getElementById('timeline-events').textContent = '';
      document.getElementById('event-count').textContent = '0';
      timelineEvents.length = 0;
      resetGrouping();
      window.terminalAPI.clearTerminal();
      document.getElementById('status-badge').className = 'status-badge';
      document.getElementById('status-badge').textContent = 'IDLE';
    } catch (err) {
      addTimelineEvent('error', 'superx', 'Failed to stop process');
    }
  });

  // Store showLoading globally so process events can use it
  window._showLoading = showLoading;
}

// === AGENT STATUS ===

function resetAllAgents() {
  // Set all agents to idle when process exits
  for (const id of activeAgents) {
    updateAgentCard(id, 'idle');
  }
  activeAgents.clear();
  // Also reset dynamic agents
  for (const id of Object.keys(dynamicAgents)) {
    dynamicAgents[id].status = 'idle';
    updateAgentCard(id, 'idle');
  }
  if (gameMap) gameMap.setActiveAgents(activeAgents);
}

function updateAgentCard(agentId, status) {
  // Find by data-agentId or by name text
  const cards = document.querySelectorAll('.agent-card');
  for (const card of cards) {
    const id = card.dataset.agentId;
    const nameEl = card.querySelector('.name');
    if (id === agentId || (nameEl && nameEl.textContent === agentId)) {
      card.className = 'agent-card ' + (status === 'running' ? 'active' : 'idle') + ' pixel-border';
      const dot = card.querySelector('.status-dot');
      if (dot) dot.className = 'status-dot ' + (status === 'running' ? 'running' : 'idle');
      const taskEl = card.querySelector('.task');
      if (taskEl) taskEl.textContent = status === 'running' ? 'working...' : 'idle';
      return;
    }
  }
}

// === HISTORY DRAWER ===

function setupHistory() {
  const btn = document.getElementById('history-btn');
  const overlay = document.getElementById('history-overlay');
  const closeBtn = document.getElementById('history-close');

  btn.addEventListener('click', () => {
    overlay.classList.add('open');
    loadHistory();
  });

  closeBtn.addEventListener('click', () => {
    overlay.classList.remove('open');
  });

  // Close on overlay click (outside drawer)
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.classList.remove('open');
  });
}

async function loadHistory() {
  const list = document.getElementById('history-list');
  list.innerHTML = '';

  try {
    const res = await fetch('/api/history');
    const data = await res.json();
    const sessions = data.sessions || [];

    if (sessions.length === 0) {
      list.innerHTML = '<div class="history-empty">No past sessions yet</div>';
      return;
    }

    for (const session of sessions) {
      const ts = new Date(session.timestamp * 1000)
        .toLocaleString('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      const taskText = session.task || 'Untitled session';
      const evtCount = session.event_count || 0;
      const idx = session.index;

      const card = document.createElement('div');
      card.className = 'history-session';
      card.dataset.index = idx;
      card.innerHTML =
        '<div class="session-time">' + ts + '</div>' +
        '<div class="session-task-row">' +
          '<span class="session-task">' + taskText.substring(0, 120) + '</span>' +
          '<button class="session-rename-btn" title="Rename">&#9998;</button>' +
        '</div>' +
        '<div class="session-count">' + evtCount + ' events</div>';
      // Click card body to view session
      card.addEventListener('click', (e) => {
        if (e.target.closest('.session-rename-btn') || e.target.closest('.session-rename-input')) return;
        viewPastSession(idx);
      });
      // Rename button
      card.querySelector('.session-rename-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        const taskRow = card.querySelector('.session-task-row');
        const taskSpan = card.querySelector('.session-task');
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'session-rename-input';
        input.value = taskSpan.textContent;
        taskRow.replaceChild(input, taskSpan);
        card.querySelector('.session-rename-btn').style.display = 'none';
        input.focus();
        input.select();
        const save = async () => {
          const newName = input.value.trim();
          if (newName && newName !== taskSpan.textContent) {
            try {
              await fetch('/api/history/' + idx + '/rename', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newName }),
              });
              taskSpan.textContent = newName;
            } catch (err) { console.error('Rename failed:', err); }
          }
          taskRow.replaceChild(taskSpan, input);
          card.querySelector('.session-rename-btn').style.display = '';
        };
        input.addEventListener('blur', save);
        input.addEventListener('keydown', (ke) => {
          if (ke.key === 'Enter') { ke.preventDefault(); input.blur(); }
          if (ke.key === 'Escape') { taskRow.replaceChild(taskSpan, input); card.querySelector('.session-rename-btn').style.display = ''; }
        });
      });
      list.appendChild(card);
    }
  } catch (err) {
    list.innerHTML = '<div class="history-empty">Failed to load history: ' + err.message + '</div>';
  }
}

async function viewPastSession(index) {
  try {
    const res = await fetch('/api/history/' + index);
    const session = await res.json();

    // Clear current timeline and logs
    const container = document.getElementById('timeline-events');
    container.textContent = '';
    timelineEvents.length = 0;
    resetGrouping();
    window.terminalAPI.clearTerminal();
    document.getElementById('event-count').textContent = '0';

    // Populate with past session
    if (session.timeline) {
      for (const evt of session.timeline) {
        const agent = evt.agent || 'superx';
        const type = evt.type || 'info';
        const msg = evt.message || '';
        if (msg) addTimelineEvent(type, agent, msg, evt.useMono || false);
      }
    }
    if (session.terminal) {
      for (const line of session.terminal) {
        window.terminalAPI.appendTerminalLine(line);
      }
    }

    // Close drawer
    document.getElementById('history-overlay').classList.remove('open');

    // Mark as viewing history
    document.getElementById('status-badge').className = 'status-badge';
    document.getElementById('status-badge').textContent = 'HISTORY';
  } catch (err) {
    console.error('Failed to load session:', err);
  }
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
        gameMap.fetchStructure();
      }
    });
  });

  // Fullscreen map toggle
  const fsBtn = document.getElementById('fullscreen-btn');
  if (fsBtn) {
    fsBtn.addEventListener('click', () => {
      const dashboard = document.querySelector('.dashboard');
      dashboard.classList.toggle('map-fullscreen');

      // Switch to map tab when entering fullscreen
      if (dashboard.classList.contains('map-fullscreen')) {
        tabs.forEach(t => t.classList.remove('active'));
        document.querySelector('[data-tab="map"]').classList.add('active');
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        document.getElementById('tab-map').classList.add('active');
      }

      setTimeout(() => gameMap.resize(), 50);
      setTimeout(() => gameMap.resize(), 200);
      setTimeout(() => gameMap.resize(), 500);
    });
  }
}

// === IMAGE ATTACHMENTS ===

function setupImageAttach(buttonId, inputId, previewId, key) {
  const btn = document.getElementById(buttonId);
  const input = document.getElementById(inputId);
  if (!btn || !input) return;

  btn.addEventListener('click', () => input.click());

  input.addEventListener('change', () => {
    for (const file of input.files) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const dataUrl = e.target.result;
        try {
          const res = await fetch('/api/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: file.name, data: dataUrl }),
          });
          const data = await res.json();
          if (data.path) {
            pendingImages[key].push(data.path);
            updateImagePreview(previewId, key, dataUrl);
          }
        } catch (err) {
          console.error('Upload failed:', err);
        }
      };
      reader.readAsDataURL(file);
    }
    input.value = '';
  });
}

function updateImagePreview(previewId, key, newDataUrl) {
  const container = document.getElementById(previewId);
  if (!container) return;

  // If called without newDataUrl, rebuild from scratch (after removal)
  if (!newDataUrl) {
    container.textContent = '';
    return;
  }

  // Add new thumbnail
  const thumb = document.createElement('div');
  thumb.className = 'image-thumb';
  const img = document.createElement('img');
  img.src = newDataUrl;
  thumb.appendChild(img);

  const removeBtn = document.createElement('div');
  removeBtn.className = 'remove-img';
  removeBtn.textContent = 'x';
  const idx = pendingImages[key].length - 1;
  removeBtn.addEventListener('click', () => {
    pendingImages[key].splice(idx, 1);
    thumb.remove();
  });
  thumb.appendChild(removeBtn);
  container.appendChild(thumb);
}

// === CONTINUE ON TERMINAL ===

function setupContinueButton() {
  const btn = document.getElementById('continue-btn');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    addTimelineEvent('info', 'superx', 'Opening terminal...', true);
    try {
      await fetch('/api/continue', { method: 'POST' });
    } catch (err) {
      addTimelineEvent('error', 'superx', 'Failed to open terminal');
    }
  });
}

// === COPY LOGS ===

function setupCopyLogs() {
  const btn = document.getElementById('copy-logs-btn');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    try {
      const res = await fetch('/api/terminal');
      const data = await res.json();
      const logs = (data.lines || []).join('\n');
      await navigator.clipboard.writeText(logs);
      btn.textContent = 'COPIED';
      btn.classList.add('copied');
      setTimeout(() => {
        btn.textContent = 'COPY LOGS';
        btn.classList.remove('copied');
      }, 2000);
    } catch (err) {
      // Fallback: copy from DOM
      const terminal = document.getElementById('terminal-output');
      const text = terminal ? terminal.innerText : '';
      await navigator.clipboard.writeText(text);
      btn.textContent = 'COPIED';
      btn.classList.add('copied');
      setTimeout(() => {
        btn.textContent = 'COPY LOGS';
        btn.classList.remove('copied');
      }, 2000);
    }
  });
}

// === PIXEL ART ICONS ===

function drawPixelIcons() {
  // Icons are now SVG/text — no canvas drawing needed
}

// === PROJECT SETTINGS & GITHUB ===

async function setupGitHub() {
  const btn = document.getElementById('github-btn');
  const modal = document.getElementById('github-modal');
  const closeBtn = document.getElementById('github-modal-close');
  const pushBtn = document.getElementById('github-save');
  const projectBtn = document.getElementById('project-save');
  const urlInput = document.getElementById('github-url');
  const pathInput = document.getElementById('github-path');
  const status = document.getElementById('github-status');
  const pathDisplay = document.getElementById('project-path');

  if (!btn || !modal) return;

  // Load saved config and pre-fill
  try {
    const res = await fetch('/api/project');
    const cfg = await res.json();
    if (cfg.path) {
      pathInput.value = cfg.path;
      window._projectPath = cfg.path;
      const short = cfg.path.split('/').slice(-2).join('/');
      pathDisplay.textContent = short;
      pathDisplay.title = cfg.path;
    }
    if (cfg.url) urlInput.value = cfg.url;
  } catch(e) {}

  // Expose a helper to open the modal from elsewhere (e.g. sendPrompt when
  // no project is set yet). Optional reason text is shown in the status row.
  window._openProjectModal = (reason) => {
    modal.classList.add('open');
    if (reason) {
      status.textContent = reason;
      status.style.color = 'var(--warning)';
    }
    setTimeout(() => pathInput.focus(), 50);
  };

  btn.addEventListener('click', () => modal.classList.add('open'));
  closeBtn.addEventListener('click', () => modal.classList.remove('open'));
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.remove('open');
  });

  // SET PROJECT directory
  projectBtn.addEventListener('click', async () => {
    const localPath = pathInput.value.trim();
    if (!localPath) {
      status.textContent = 'Enter a project directory path';
      status.style.color = 'var(--error)';
      return;
    }
    status.textContent = 'Setting project directory...';
    status.style.color = 'var(--warning)';
    projectBtn.disabled = true;
    try {
      const res = await fetch('/api/project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: localPath }),
      });
      const data = await res.json();
      if (data.error) {
        status.textContent = data.error;
        status.style.color = 'var(--error)';
      } else {
        status.textContent = 'Project set: ' + data.path;
        status.style.color = 'var(--success)';
        window._projectPath = data.path;
        const short = data.path.split('/').slice(-2).join('/');
        pathDisplay.textContent = short;
        pathDisplay.title = data.path;
        // If a task was buffered while waiting for the path, auto-submit it
        // and close the modal so the user doesn't have to retype.
        if (window._pendingTask) {
          const buffered = window._pendingTask;
          window._pendingTask = null;
          modal.classList.remove('open');
          try {
            const r = await fetch('/api/prompt', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(buffered),
            });
            const d = await r.json();
            if (d.error) {
              addTimelineEvent('error', 'superx', d.error);
            } else {
              const shortPrompt = buffered.prompt.length > 80
                ? buffered.prompt.substring(0, 80) + '...'
                : buffered.prompt;
              addTimelineEvent('info', 'superx', 'Task: ' + shortPrompt, true);
              if (window._showLoading) window._showLoading(true);
            }
          } catch (err) {
            addTimelineEvent('error', 'superx', 'Failed to start buffered task');
          }
        }
      }
    } catch (err) {
      status.textContent = 'Network error';
      status.style.color = 'var(--error)';
    }
    projectBtn.disabled = false;
  });

  // PUSH TO GIT
  pushBtn.addEventListener('click', async () => {
    const url = urlInput.value.trim();
    const localPath = pathInput.value.trim();
    if (!url) {
      status.textContent = 'Enter a GitHub repo URL to push';
      status.style.color = 'var(--error)';
      return;
    }
    if (!localPath) {
      status.textContent = 'Set a project directory first';
      status.style.color = 'var(--error)';
      return;
    }
    status.textContent = 'Committing and pushing...';
    status.style.color = 'var(--warning)';
    pushBtn.disabled = true;

    try {
      const res = await fetch('/api/github', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, path: localPath }),
      });
      const data = await res.json();
      if (data.error) {
        status.textContent = data.error;
        status.style.color = 'var(--error)';
      } else if (data.status === 'pushed') {
        status.textContent = 'Pushed successfully!';
        status.style.color = 'var(--success)';
        addTimelineEvent('success', 'superx', 'Code pushed to ' + url);
        setTimeout(() => modal.classList.remove('open'), 1500);
      } else if (data.status === 'nothing_to_push') {
        status.textContent = 'Nothing to push — no new changes';
        status.style.color = 'var(--warning)';
      } else {
        status.textContent = data.error || data.steps.join(' | ');
        status.style.color = 'var(--error)';
      }
    } catch (err) {
      status.textContent = 'Network error';
      status.style.color = 'var(--error)';
    }
    pushBtn.disabled = false;
  });
}

// === CHECKPOINT RESUME ===

async function checkForCheckpoint() {
  try {
    const res = await fetch('/api/checkpoint');
    const data = await res.json();
    if (data.resumable) {
      const bar = document.getElementById('resume-bar');
      const prompt = data.prompt || 'unknown task';
      const mins = data.minutes_ago || 0;
      const phase = data.phase || 'unknown';
      const timeAgo = mins < 60 ? mins + 'm ago' : Math.floor(mins/60) + 'h ago';

      bar.innerHTML =
        '<span class="resume-info">Checkpoint: "' + prompt + '..." (' + phase + ', ' + timeAgo + ')</span>' +
        '<button class="btn-resume" id="btn-resume">RESUME</button>' +
        '<button class="btn-dismiss" id="btn-dismiss">DISMISS</button>';
      bar.classList.add('visible');

      document.getElementById('btn-resume').addEventListener('click', async () => {
        bar.classList.remove('visible');
        addTimelineEvent('info', 'superx', 'Resuming from checkpoint...', true);
        if (window._showLoading) window._showLoading(true);
        try {
          await fetch('/api/resume', { method: 'POST' });
        } catch (err) {
          addTimelineEvent('error', 'superx', 'Failed to resume');
        }
      });

      document.getElementById('btn-dismiss').addEventListener('click', () => {
        bar.classList.remove('visible');
      });
    }
  } catch (e) {
    // No checkpoint or server not ready
  }
}
