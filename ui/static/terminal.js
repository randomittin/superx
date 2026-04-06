/**
 * Terminal panel — shows raw claude output with pixel font styling.
 */

const terminalEl = document.getElementById('terminal-output');
let autoScroll = true;

function appendTerminalLine(line) {
  if (!terminalEl) return;
  terminalEl.textContent += line + '\n';
  if (autoScroll) {
    terminalEl.scrollTop = terminalEl.scrollHeight;
  }
}

function clearTerminal() {
  if (terminalEl) terminalEl.textContent = '';
}

// Load existing terminal buffer on init
async function loadTerminalBuffer() {
  try {
    const res = await fetch('/api/terminal');
    const data = await res.json();
    if (data.lines && data.lines.length) {
      terminalEl.textContent = data.lines.join('\n') + '\n';
      if (autoScroll) terminalEl.scrollTop = terminalEl.scrollHeight;
    }
  } catch (e) {
    // Server not ready yet
  }
}

// Detect if user scrolled up (disable auto-scroll)
if (terminalEl) {
  terminalEl.addEventListener('scroll', () => {
    const atBottom = terminalEl.scrollHeight - terminalEl.scrollTop - terminalEl.clientHeight < 30;
    autoScroll = atBottom;
  });
}

window.terminalAPI = { appendTerminalLine, clearTerminal, loadTerminalBuffer };
