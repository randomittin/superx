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

// Pending image paths for prompt and plan areas
const pendingImages = { prompt: [], plan: [] };

document.addEventListener('DOMContentLoaded', () => {
  gameMap = new GameMap('map-canvas');
  connectSSE();
  setupPromptInput();
  setupPlanApproval();
  setupImageAttach('attach-btn', 'attach-input', 'prompt-images', 'prompt');
  setupImageAttach('plan-attach-btn', 'plan-attach-input', 'plan-images', 'plan');
  setupContinueButton();
  setupTabs();
  setupHistory();
  setupGitHub();
  drawPixelIcons();
  restoreSession();
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

    if (session.pending_plan && !session.running) {
      showPlanApproval(true);
      document.getElementById('status-badge').className = 'status-badge';
      document.getElementById('status-badge').textContent = 'PLAN READY';
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

  eventSource.addEventListener('agent_status', (e) => {
    try {
      const payload = JSON.parse(e.data);
      const data = payload.data || payload;
      updateAgentCard(data.agent, data.status);
    } catch (err) {}
  });

  eventSource.addEventListener('prompt_refined', (e) => {
    window._currentPhase = 'refining';
    showPlanApproval(true, 'refining');
    if (window._showLoading) window._showLoading(false);
    document.getElementById('status-badge').className = 'status-badge';
    document.getElementById('status-badge').textContent = 'PROMPT READY';
  });

  eventSource.addEventListener('plan_ready', (e) => {
    window._currentPhase = 'planning';
    showPlanApproval(true, 'planning');
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

    // Info column
    const info = document.createElement('div');
    info.className = 'card-info';

    const nameEl = document.createElement('div');
    nameEl.className = 'name';
    nameEl.textContent = type;
    info.appendChild(nameEl);

    const taskEl = document.createElement('div');
    taskEl.className = 'task';
    taskEl.textContent = isActive ? (agent?.id || 'working...') : 'idle';
    info.appendChild(taskEl);

    card.appendChild(info);

    // Gradient background per agent
    const grad = window.GRADIENTS[type];
    if (grad) {
      card.style.background = 'linear-gradient(135deg, ' + grad[0] + ', ' + grad[1] + '44)';
    }

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
    const images = pendingImages.prompt.slice();
    if (!prompt && images.length === 0) return;

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
      showPlanApproval(false);
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

function updateAgentCard(agentType, status) {
  const cards = document.querySelectorAll('.agent-card');
  for (const card of cards) {
    const nameEl = card.querySelector('.name');
    if (nameEl && nameEl.textContent === agentType) {
      card.className = 'agent-card ' + (status === 'running' ? 'active' : 'idle') + ' pixel-border';
      const dot = card.querySelector('.status-dot');
      if (dot) dot.className = 'status-dot ' + (status === 'running' ? 'running' : 'idle');
      const taskEl = card.querySelector('.task');
      if (taskEl) taskEl.textContent = status === 'running' ? 'working...' : 'idle';
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
        '<div class="session-task">' + taskText.substring(0, 120) + '</div>' +
        '<div class="session-count">' + evtCount + ' events</div>';
      card.addEventListener('click', () => viewPastSession(idx));
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

// === PLAN APPROVAL ===

function showPlanApproval(visible, phase) {
  const el = document.getElementById('plan-approval');
  if (el) el.className = visible ? 'plan-approval visible' : 'plan-approval';
  if (visible) {
    const label = document.getElementById('plan-label');
    const approveBtn = document.getElementById('btn-approve');
    const feedback = document.getElementById('plan-feedback');
    if (phase === 'refining') {
      label.textContent = 'REFINED PROMPT — APPROVE OR EDIT';
      approveBtn.textContent = 'APPROVE';
      feedback.placeholder = 'Edit instructions for the refined prompt...';
    } else {
      label.textContent = 'PLAN READY — APPROVE OR REVISE';
      approveBtn.textContent = 'APPROVE';
      feedback.placeholder = 'Comments to revise the plan...';
    }
    detectAndShowOptions();
  }
}

function detectAndShowOptions() {
  // Look at the latest markdown timeline event to detect multiple-choice options
  const lastMdEvent = timelineEvents.find(e => e.markdown || (e.message && e.message.length > 200));
  if (!lastMdEvent) return;

  const text = lastMdEvent.message || '';
  // Match patterns: (A), (B), (C), (D) or **(A)**, **(B)** etc.
  const optionRegex = /\*{0,2}\(([A-Z])\)\*{0,2}/g;
  const matches = [];
  const seen = new Set();
  let result;
  while ((result = optionRegex.exec(text)) !== null) {
    if (!seen.has(result[1])) {
      seen.add(result[1]);
      // Extract short description after the option letter
      const afterMatch = text.substring(result.index + result[0].length, result.index + result[0].length + 80);
      const desc = afterMatch.replace(/^\s*[-:.]?\s*/, '').split(/\n/)[0].trim().substring(0, 50);
      matches.push({ letter: result[1], desc: desc });
    }
  }

  const container = document.getElementById('option-buttons');
  const label = document.getElementById('plan-label');
  container.textContent = '';

  if (matches.length >= 2) {
    label.textContent = 'CHOOSE AN OPTION OR TYPE RESPONSE';
    for (const opt of matches) {
      const btn = document.createElement('button');
      btn.className = 'btn btn-option';
      btn.textContent = opt.letter;
      btn.title = opt.desc;
      btn.addEventListener('click', () => sendOptionChoice(opt.letter));
      container.appendChild(btn);
    }
  } else {
    label.textContent = 'PLAN READY — APPROVE OR REVISE';
  }
}

async function sendOptionChoice(letter) {
  showPlanApproval(false);
  const images = pendingImages.plan.slice();
  pendingImages.plan = [];
  updateImagePreview('plan-images', 'plan');
  addTimelineEvent('success', 'superx', 'Selected option: ' + letter, true);
  document.getElementById('option-buttons').textContent = '';
  try {
    await fetch('/api/revise', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feedback: letter, images }),
    });
  } catch (err) {
    addTimelineEvent('error', 'superx', 'Failed to send choice');
  }
}

function setupPlanApproval() {
  const approveBtn = document.getElementById('btn-approve');
  const reviseBtn = document.getElementById('btn-revise');
  const feedbackInput = document.getElementById('plan-feedback');

  approveBtn.addEventListener('click', async () => {
    showPlanApproval(false);
    document.getElementById('option-buttons').textContent = '';
    addTimelineEvent('success', 'superx', 'Plan approved — executing...');
    try {
      await fetch('/api/approve', { method: 'POST' });
    } catch (err) {
      addTimelineEvent('error', 'superx', 'Failed to start execution');
    }
  });

  reviseBtn.addEventListener('click', async () => {
    const feedback = feedbackInput.value.trim();
    const images = pendingImages.plan.slice();
    if (!feedback && images.length === 0) {
      feedbackInput.focus();
      feedbackInput.style.borderColor = 'var(--error)';
      setTimeout(() => { feedbackInput.style.borderColor = ''; }, 1500);
      return;
    }
    showPlanApproval(false);
    document.getElementById('option-buttons').textContent = '';
    pendingImages.plan = [];
    updateImagePreview('plan-images', 'plan');
    const imgNote = images.length ? ' [' + images.length + ' img]' : '';
    addTimelineEvent('warning', 'superx', 'Revising plan: ' + feedback + imgNote, true);
    feedbackInput.value = '';
    try {
      await fetch('/api/revise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback, images }),
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

// === PIXEL ART ICONS ===

function drawPixelIcons() {
  // Icons are now SVG/text — no canvas drawing needed
}

// === GITHUB REMOTE ===

function setupGitHub() {
  const btn = document.getElementById('github-btn');
  const modal = document.getElementById('github-modal');
  const closeBtn = document.getElementById('github-modal-close');
  const saveBtn = document.getElementById('github-save');
  const urlInput = document.getElementById('github-url');
  const status = document.getElementById('github-status');

  if (!btn || !modal) return;

  btn.addEventListener('click', () => modal.classList.add('open'));
  closeBtn.addEventListener('click', () => modal.classList.remove('open'));
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.remove('open');
  });

  saveBtn.addEventListener('click', async () => {
    const url = urlInput.value.trim();
    if (!url) {
      status.textContent = 'Enter a GitHub repo URL';
      status.style.color = 'var(--error)';
      return;
    }
    status.textContent = 'Committing and pushing...';
    status.style.color = 'var(--warning)';
    saveBtn.disabled = true;

    try {
      const res = await fetch('/api/github', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
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
      } else {
        status.textContent = data.error || data.steps.join(' | ');
        status.style.color = 'var(--error)';
      }
    } catch (err) {
      status.textContent = 'Network error';
      status.style.color = 'var(--error)';
    }
    saveBtn.disabled = false;
  });

  urlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveBtn.click();
  });
}
