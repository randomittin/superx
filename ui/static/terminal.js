/**
 * Logs panel — shows formatted log entries, one per line, horizontally scrollable.
 */

const terminalEl = document.getElementById('terminal-output');
let autoScroll = true;

// Dedup: track hashes of recently-appended lines to avoid double-posts
const _seenHashes = new Set();
const _seenOrder = []; // insertion order for eviction
const DEDUP_CAP = 500;

function hashLine(s) {
  // Fast 32-bit string hash (djb2-like) — good enough for exact-match dedup
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return h;
}

function getLogClass(line) {
  if (line.startsWith('$')) return 'cmd';
  if (line.startsWith('[')) return 'tool';
  if (line.startsWith('  →') || line.startsWith('→')) return 'result';
  return 'text';
}

function appendTerminalLine(line) {
  if (!terminalEl) return;
  // Dedup: skip if we've already posted this exact line
  const h = hashLine(line);
  if (_seenHashes.has(h)) return;
  _seenHashes.add(h);
  _seenOrder.push(h);
  // Evict oldest hash once over cap
  if (_seenOrder.length > DEDUP_CAP) {
    const old = _seenOrder.shift();
    _seenHashes.delete(old);
  }

  const el = document.createElement('div');
  el.className = 'log-line ' + getLogClass(line);
  el.textContent = line;
  terminalEl.appendChild(el);

  // Cap at 500 lines
  while (terminalEl.children.length > 500) {
    terminalEl.removeChild(terminalEl.firstChild);
  }

  if (autoScroll) {
    terminalEl.scrollTop = terminalEl.scrollHeight;
  }
}

function clearTerminal() {
  if (terminalEl) terminalEl.textContent = '';
  _seenHashes.clear();
  _seenOrder.length = 0;
}

async function loadTerminalBuffer() {
  try {
    const res = await fetch('/api/terminal');
    const data = await res.json();
    if (data.lines && data.lines.length) {
      for (const line of data.lines) {
        appendTerminalLine(line);
      }
    }
  } catch (e) {
    // Server not ready yet
  }
}

if (terminalEl) {
  terminalEl.addEventListener('scroll', () => {
    const atBottom = terminalEl.scrollHeight - terminalEl.scrollTop - terminalEl.clientHeight < 30;
    autoScroll = atBottom;
  });
}

window.terminalAPI = { appendTerminalLine, clearTerminal, loadTerminalBuffer };
