/**
 * Logs panel — shows formatted log entries, one per line, horizontally scrollable.
 */

const terminalEl = document.getElementById('terminal-output');
let autoScroll = true;

function getLogClass(line) {
  if (line.startsWith('$')) return 'cmd';
  if (line.startsWith('[')) return 'tool';
  if (line.startsWith('  →') || line.startsWith('→')) return 'result';
  return 'text';
}

function appendTerminalLine(line) {
  if (!terminalEl) return;
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
