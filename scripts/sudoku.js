// ─── DAILY SEED UTILITIES ─────────────────────────────────────────────────

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function dateToSeed(dateStr) {
  return dateStr.split("-").reduce((acc, v) => acc * 1000 + parseInt(v), 0);
}

function seededShuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function generateSolvedBoardSeeded(rng) {
  const board = Array.from({ length: 9 }, () => Array(9).fill(0));
  solveSudokuSeeded(board, rng);
  return board;
}

function solveSudokuSeeded(board, rng) {
  const empty = findEmpty(board);
  if (!empty) return true;
  const [r, c] = empty;
  const nums = seededShuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], rng);
  for (const n of nums) {
    if (isValid(board, r, c, n)) {
      board[r][c] = n;
      if (solveSudokuSeeded(board, rng)) return true;
      board[r][c] = 0;
    }
  }
  return false;
}

function createPuzzleSeeded(solution, difficulty, rng) {
  const clues = { easy: 38, medium: 28, hard: 22 };
  const numClues = clues[difficulty] || 28;
  const puzzle = solution.map((r) => [...r]);
  const positions = seededShuffle([...Array(81).keys()], rng);
  let removed = 0;
  for (const pos of positions) {
    if (removed >= 81 - numClues) break;
    const r = Math.floor(pos / 9),
      c = pos % 9;
    puzzle[r][c] = 0;
    removed++;
  }
  return puzzle;
}

// ─── LEADERBOARD STORAGE ──────────────────────────────────────────────────

function lbKey(dateStr) {
  return "sudoku_lb_" + dateStr;
}

function loadLeaderboard(dateStr) {
  try {
    return JSON.parse(localStorage.getItem(lbKey(dateStr)) || "[]");
  } catch {
    return [];
  }
}

function saveLeaderboard(dateStr, entries) {
  try {
    localStorage.setItem(lbKey(dateStr), JSON.stringify(entries));
  } catch {}
}

function hasPlayedToday() {
  return !!localStorage.getItem("sudoku_daily_played_" + todayKey());
}

function markPlayedToday() {
  localStorage.setItem("sudoku_daily_played_" + todayKey(), "1");
}

function addLeaderboardEntry(dateStr, name, timeSeconds, difficulty) {
  const entries = loadLeaderboard(dateStr);
  const entry = {
    name: name.trim().toUpperCase() || "ANON",
    time: timeSeconds,
    diff: difficulty,
    ts: Date.now(),
  };
  entries.push(entry);
  entries.sort((a, b) => a.time - b.time);
  saveLeaderboard(dateStr, entries);
  return { entries, entry };
}

function escHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Render win overlay leaderboard
function renderOverlayLeaderboard(entries, myEntry) {
  const lbRows = document.getElementById("lb-rows");
  lbRows.innerHTML = "";
  if (!entries.length) {
    lbRows.innerHTML =
      '<div class="leaderboard-empty">No entries yet — be the first!</div>';
    return;
  }
  entries.slice(0, 10).forEach((e, i) => {
    const isYou = myEntry && e.ts === myEntry.ts;
    const row = document.createElement("div");
    row.className = "leaderboard-row" + (isYou ? " you" : "");
    row.innerHTML = `<span class="rank">${i + 1}</span><span class="name">${escHtml(e.name)}${isYou ? " ◀" : ""}</span><span class="time-val">${formatTime(e.time)}</span><span class="diff-val">${escHtml(e.diff)}</span>`;
    lbRows.appendChild(row);
  });
}

// Render permanent page leaderboard
function renderPageLeaderboard(myEntry) {
  const dateStr = todayKey();
  const entries = loadLeaderboard(dateStr);
  const section = document.getElementById("page-leaderboard-section");
  const rowsEl = document.getElementById("lb-page-rows");
  document.getElementById("lb-page-date").textContent = dateStr;

  if (!entries.length) {
    rowsEl.innerHTML =
      '<div class="lb-empty-msg">No entries yet. Complete the daily to be first!</div>';
  } else {
    rowsEl.innerHTML = "";
    entries.slice(0, 10).forEach((e, i) => {
      const isYou = myEntry && e.ts === myEntry.ts;
      const row = document.createElement("div");
      row.className = "lb-page-row" + (isYou ? " you" : "");
      row.innerHTML = `<span class="r">${i + 1}</span><span class="n">${escHtml(e.name)}${isYou ? " ◀" : ""}</span><span class="t">${formatTime(e.time)}</span><span>${escHtml(e.diff)}</span>`;
      rowsEl.appendChild(row);
    });
  }
  section.classList.add("visible");
}

// ─── PUZZLE GENERATION ────────────────────────────────────────────────────

function generateSolvedBoard() {
  const board = Array.from({ length: 9 }, () => Array(9).fill(0));
  solveSudoku(board);
  return board;
}

function solveSudoku(board) {
  const empty = findEmpty(board);
  if (!empty) return true;
  const [r, c] = empty;
  const nums = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  for (const n of nums) {
    if (isValid(board, r, c, n)) {
      board[r][c] = n;
      if (solveSudoku(board)) return true;
      board[r][c] = 0;
    }
  }
  return false;
}

function findEmpty(board) {
  for (let r = 0; r < 9; r++)
    for (let c = 0; c < 9; c++) if (board[r][c] === 0) return [r, c];
  return null;
}

function isValid(board, row, col, num) {
  for (let i = 0; i < 9; i++) {
    if (board[row][i] === num) return false;
    if (board[i][col] === num) return false;
  }
  const br = Math.floor(row / 3) * 3;
  const bc = Math.floor(col / 3) * 3;
  for (let r = br; r < br + 3; r++)
    for (let c = bc; c < bc + 3; c++) if (board[r][c] === num) return false;
  return true;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function createPuzzle(solution, difficulty) {
  const clues = { easy: 38, medium: 28, hard: 22 };
  const numClues = clues[difficulty] || 30;
  const puzzle = solution.map((r) => [...r]);
  const positions = shuffle([...Array(81).keys()]);
  let removed = 0;
  for (const pos of positions) {
    if (removed >= 81 - numClues) break;
    const r = Math.floor(pos / 9),
      c = pos % 9;
    puzzle[r][c] = 0;
    removed++;
  }
  return puzzle;
}

// ─── STATE ────────────────────────────────────────────────────────────────

const MAX_HINTS = 3;
let solution = [];
let puzzle = [];
let userBoard = [];
let hintBoard = []; // tracks which cells were hint-filled
let notesBoard = Array.from({ length: 9 }, () =>
  Array.from({ length: 9 }, () => new Set()),
);
let notesMode = false;
let selectedCell = null;
let errors = 0;
let hintsUsed = 0;
let timerInterval = null;
let seconds = 0;
let currentDiff = "easy";
let gameActive = false;
let paused = false;
let started = false;
let isDailyMode = false;
let lastSubmittedEntry = null;

// ─── RENDER ───────────────────────────────────────────────────────────────

const boardEl = document.getElementById("sudoku-board");
const numpad = document.getElementById("numpad");

function renderBoard() {
  boardEl.innerHTML = "";
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.dataset.r = r;
      cell.dataset.c = c;
      if (puzzle[r][c] !== 0) {
        cell.classList.add("given");
        cell.textContent = puzzle[r][c];
      } else if (userBoard[r][c] !== 0) {
        if (hintBoard[r][c]) {
          cell.classList.add("hint-filled");
        } else {
          cell.classList.add("user-filled");
          if (userBoard[r][c] !== solution[r][c]) cell.classList.add("error");
        }
        cell.textContent = userBoard[r][c];
      } else if (notesBoard[r][c].size > 0) {
        // Render pencil notes as a 3×3 mini-grid
        const notesEl = document.createElement("div");
        notesEl.className = "cell-notes";
        for (let n = 1; n <= 9; n++) {
          const nd = document.createElement("div");
          nd.className = "note-digit" + (notesBoard[r][c].has(n) ? " set" : "");
          nd.textContent = n;
          notesEl.appendChild(nd);
        }
        cell.appendChild(notesEl);
      }
      cell.addEventListener("click", () => selectCell(r, c));
      boardEl.appendChild(cell);
    }
  }
  updateHighlights();
  updateStats();
}

function renderNumpad() {
  numpad.innerHTML = "";
  for (let n = 1; n <= 9; n++) {
    const btn = document.createElement("button");
    btn.className = "num-btn";
    btn.textContent = n;
    btn.addEventListener("click", () => enterNumber(n));
    numpad.appendChild(btn);
  }
}

function renderHintTokens() {
  const container = document.getElementById("hint-tokens");
  container.innerHTML = "";
  for (let i = 0; i < MAX_HINTS; i++) {
    const tok = document.createElement("div");
    tok.className = "hint-token" + (i < hintsUsed ? " used" : "");
    container.appendChild(tok);
  }
  document.getElementById("hints-remaining").textContent =
    MAX_HINTS - hintsUsed;
  const btn = document.getElementById("hint-btn");
  btn.disabled = hintsUsed >= MAX_HINTS || !gameActive || !started;
  btn.textContent =
    hintsUsed >= MAX_HINTS
      ? "No hints remaining"
      : selectedCell
        ? `Reveal cell (${hintsUsed + 1}/${MAX_HINTS})`
        : "Select a cell first";
}

function selectCell(r, c) {
  if (!started || paused) return;
  selectedCell = [r, c];
  updateHighlights();
  renderHintTokens();
}

function updateHighlights() {
  const cells = boardEl.querySelectorAll(".cell");
  cells.forEach((cell) =>
    cell.classList.remove("selected", "highlighted", "same-num"),
  );

  // Clear numpad active-num highlight
  document
    .querySelectorAll(".num-btn")
    .forEach((btn) => btn.classList.remove("active-num"));

  if (!selectedCell) return;
  const [sr, sc] = selectedCell;
  const selNum = userBoard[sr][sc] || puzzle[sr][sc];
  cells.forEach((cell) => {
    const r = parseInt(cell.dataset.r);
    const c = parseInt(cell.dataset.c);
    if (r === sr && c === sc) {
      cell.classList.add("selected");
      return;
    }
    if (
      r === sr ||
      c === sc ||
      (Math.floor(r / 3) === Math.floor(sr / 3) &&
        Math.floor(c / 3) === Math.floor(sc / 3))
    )
      cell.classList.add("highlighted");
    if (selNum !== 0 && (userBoard[r][c] || puzzle[r][c]) === selNum)
      cell.classList.add("same-num");
  });

  // Highlight the numpad button matching the selected cell's number
  if (selNum !== 0) {
    document.querySelectorAll(".num-btn").forEach((btn) => {
      if (
        parseInt(btn.textContent) === selNum &&
        !btn.classList.contains("complete")
      ) {
        btn.classList.add("active-num");
      }
    });
  }
}

function updateStats() {
  let filled = 0;
  for (let r = 0; r < 9; r++)
    for (let c = 0; c < 9; c++)
      if (puzzle[r][c] !== 0 || userBoard[r][c] !== 0) filled++;
  document.getElementById("filled-display").textContent = `${filled}/81`;
  document.getElementById("error-display").textContent = errors;
  updateNumpadCompletion();
}

function updateNumpadCompletion() {
  // Count correctly placed instances of each digit across the full board
  const counts = Array(10).fill(0);
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const placed = puzzle[r][c] !== 0 ? puzzle[r][c] : userBoard[r][c];
      if (placed !== 0 && placed === solution[r][c]) counts[placed]++;
    }
  }
  document.querySelectorAll(".num-btn").forEach((btn) => {
    const n = parseInt(btn.textContent);
    if (counts[n] === 9) {
      btn.classList.add("complete");
    } else {
      btn.classList.remove("complete");
    }
  });
}

// ─── INPUT ────────────────────────────────────────────────────────────────

function enterNumber(num) {
  if (!selectedCell || !gameActive || paused || !started) return;
  const [r, c] = selectedCell;
  if (puzzle[r][c] !== 0) return;
  if (hintBoard[r][c]) return; // can't overwrite a hint cell

  // ── NOTES MODE ──────────────────────────────────────────────────────────
  if (notesMode && num !== 0) {
    // Can't annotate a cell that already has a confirmed value
    if (userBoard[r][c] !== 0) return;
    if (notesBoard[r][c].has(num)) {
      notesBoard[r][c].delete(num);
    } else {
      notesBoard[r][c].add(num);
    }
    renderBoard();
    updateHighlights();
    return;
  }

  // ── NORMAL MODE ──────────────────────────────────────────────────────────
  const prev = userBoard[r][c];
  userBoard[r][c] = num;
  // Clear any pencil notes for this cell once a real value is committed
  if (num !== 0) notesBoard[r][c].clear();
  // Only count a NEW wrong entry as an error (not re-entering the same wrong one)
  if (num !== 0 && num !== solution[r][c] && prev !== num) errors++;
  renderBoard();
  updateHighlights();
  renderHintTokens();
  if (isBoardComplete()) winGame();
}

document.addEventListener("keydown", (e) => {
  if (!started || paused) return;
  if (e.key === "n" || e.key === "N") {
    toggleNotesMode();
    return;
  }
  if (e.key >= "1" && e.key <= "9") enterNumber(parseInt(e.key));
  if (e.key === "Backspace" || e.key === "Delete" || e.key === "0")
    enterNumber(0);
  if (!selectedCell) return;
  const [r, c] = selectedCell;
  if (e.key === "ArrowUp" && r > 0) selectCell(r - 1, c);
  if (e.key === "ArrowDown" && r < 8) selectCell(r + 1, c);
  if (e.key === "ArrowLeft" && c > 0) selectCell(r, c - 1);
  if (e.key === "ArrowRight" && c < 8) selectCell(r, c + 1);
});

// ─── HINTS ────────────────────────────────────────────────────────────────

function useHint() {
  const msgEl = document.getElementById("hint-message");

  if (!started) {
    msgEl.textContent = "Start the game first.";
    msgEl.className = "hint-message";
    return;
  }
  if (!gameActive) {
    msgEl.textContent = "Game is not active.";
    msgEl.className = "hint-message";
    return;
  }
  if (hintsUsed >= MAX_HINTS) {
    msgEl.textContent = "No hints remaining.";
    msgEl.className = "hint-message";
    return;
  }
  if (!selectedCell) {
    msgEl.textContent = "Click a cell on the board first.";
    msgEl.className = "hint-message";
    return;
  }

  const [r, c] = selectedCell;

  if (puzzle[r][c] !== 0) {
    msgEl.textContent = "That's a given clue — already correct!";
    msgEl.className = "hint-message";
    return;
  }
  if (hintBoard[r][c]) {
    msgEl.textContent = "Cell already revealed by hint.";
    msgEl.className = "hint-message";
    return;
  }
  if (userBoard[r][c] !== 0 && userBoard[r][c] === solution[r][c]) {
    msgEl.textContent = `Row ${r + 1}, col ${c + 1} is already correct!`;
    msgEl.className = "hint-message good";
    return;
  }

  // Consume the hint
  hintsUsed++;
  userBoard[r][c] = solution[r][c];
  hintBoard[r][c] = true;

  msgEl.textContent = `Revealed: row ${r + 1}, col ${c + 1} = ${solution[r][c]}`;
  msgEl.className = "hint-message good";

  renderBoard();
  updateHighlights();
  renderHintTokens();

  if (isBoardComplete()) winGame();
}

// ─── GAME FLOW ────────────────────────────────────────────────────────────

function newGame() {
  isDailyMode = false;
  solution = generateSolvedBoard();
  puzzle = createPuzzle(solution, currentDiff);
  userBoard = Array.from({ length: 9 }, () => Array(9).fill(0));
  hintBoard = Array.from({ length: 9 }, () => Array(9).fill(false));
  notesBoard = Array.from({ length: 9 }, () =>
    Array.from({ length: 9 }, () => new Set()),
  );
  notesMode = false;
  selectedCell = null;
  errors = 0;
  hintsUsed = 0;
  gameActive = true;
  paused = false;
  started = false;
  lastSubmittedEntry = null;

  resetTimer();
  renderBoard();
  renderHintTokens();
  updateNotesToggleBtn();

  document.getElementById("hint-message").textContent = "";
  document.getElementById("hint-message").className = "hint-message";
  document.getElementById("start-overlay").classList.remove("hidden");
  document.getElementById("pause-overlay").classList.remove("show");
  document.getElementById("win-overlay").classList.remove("show");
  document.getElementById("pause-btn").innerHTML = "⏸ Pause";
  document.getElementById("pause-btn").classList.remove("active");
  document.getElementById("board-status").textContent = "Ready to play";
}

function startDailyChallenge() {
  if (hasPlayedToday()) {
    renderPageLeaderboard(null);
    // scroll to it
    document
      .getElementById("page-leaderboard-section")
      .scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  isDailyMode = true;
  const dateStr = todayKey();
  const rng = mulberry32(dateToSeed(dateStr));
  solution = generateSolvedBoardSeeded(rng);
  puzzle = createPuzzleSeeded(solution, "medium", rng);
  userBoard = Array.from({ length: 9 }, () => Array(9).fill(0));
  hintBoard = Array.from({ length: 9 }, () => Array(9).fill(false));
  notesBoard = Array.from({ length: 9 }, () =>
    Array.from({ length: 9 }, () => new Set()),
  );
  notesMode = false;
  selectedCell = null;
  errors = 0;
  hintsUsed = 0;
  gameActive = true;
  paused = false;
  started = false;
  lastSubmittedEntry = null;

  document
    .querySelectorAll(".diff-btn")
    .forEach((b) => b.classList.remove("active"));
  document.querySelector('[data-diff="medium"]').classList.add("active");
  currentDiff = "medium";

  resetTimer();
  renderBoard();
  renderHintTokens();
  updateNotesToggleBtn();

  document.getElementById("hint-message").textContent =
    "Daily puzzle — same board for everyone today!";
  document.getElementById("hint-message").className = "hint-message good";
  document.getElementById("start-overlay").classList.remove("hidden");
  document.getElementById("pause-overlay").classList.remove("show");
  document.getElementById("win-overlay").classList.remove("show");
  document.getElementById("pause-btn").innerHTML = "⏸ Pause";
  document.getElementById("pause-btn").classList.remove("active");
  document.getElementById("board-status").textContent = "◆ Daily Challenge";
}

function updateDailyBtn() {
  const btn = document.getElementById("daily-btn");
  if (hasPlayedToday()) {
    btn.textContent = "View Leaderboard ◆";
  } else {
    btn.textContent = "Play ◆";
    btn.disabled = false;
  }
}

function startGame() {
  started = true;
  document.getElementById("start-overlay").classList.add("hidden");
  document.getElementById("board-status").textContent = isDailyMode
    ? "◆ Daily — In progress"
    : "In progress";
  startTimer();
  renderHintTokens();
}

function isBoardComplete() {
  for (let r = 0; r < 9; r++)
    for (let c = 0; c < 9; c++) {
      const val = puzzle[r][c] !== 0 ? puzzle[r][c] : userBoard[r][c];
      if (val !== solution[r][c]) return false;
    }
  return true;
}

function winGame() {
  gameActive = false;
  stopTimer();
  document.getElementById("board-status").textContent = "Solved!";
  document.getElementById("win-time").textContent = formatTime(seconds);

  if (isDailyMode) {
    markPlayedToday();
    updateDailyBtn();
    document.getElementById("win-sub").textContent =
      "Daily Challenge — Completed in";
    document.getElementById("daily-win-section").style.display = "flex";
    document.getElementById("lb-submit-area").style.display = "flex";
    document.getElementById("lb-name-input").value = "";
    document.getElementById("lb-section-label").textContent =
      `Today's Leaderboard — ${todayKey()}`;
    renderOverlayLeaderboard(loadLeaderboard(todayKey()), null);
    // Also show the permanent leaderboard section
    renderPageLeaderboard(null);
  } else {
    document.getElementById("win-sub").textContent = "Completed in";
    document.getElementById("daily-win-section").style.display = "none";
  }

  setTimeout(
    () => document.getElementById("win-overlay").classList.add("show"),
    400,
  );
}

function submitLeaderboardEntry() {
  const nameInput = document.getElementById("lb-name-input");
  const name = (nameInput.value.trim() || "ANON").toUpperCase();
  const { entries, entry } = addLeaderboardEntry(
    todayKey(),
    name,
    seconds,
    currentDiff,
  );
  lastSubmittedEntry = entry;

  document.getElementById("lb-submit-area").innerHTML =
    `<div class="submitted-msg">✓ Submitted as ${escHtml(name)}</div>`;
  renderOverlayLeaderboard(entries, entry);
  // Refresh the permanent leaderboard with your row highlighted
  renderPageLeaderboard(entry);
}

function checkBoard() {
  if (!gameActive || !started) return;
  renderBoard(); // re-render forces error highlights to update
}

function revealSolution() {
  gameActive = false;
  stopTimer();
  // Fill all cells as hint-fills (dimmed orange) so it's clear it was revealed
  for (let r = 0; r < 9; r++)
    for (let c = 0; c < 9; c++) {
      if (puzzle[r][c] === 0) {
        userBoard[r][c] = solution[r][c];
        hintBoard[r][c] = true;
      }
    }
  document.getElementById("board-status").textContent = "Solution revealed";
  renderBoard();
}

// ─── PAUSE ────────────────────────────────────────────────────────────────

function pauseGame() {
  if (!gameActive || paused || !started) return;
  paused = true;
  stopTimer();
  document.getElementById("pause-overlay").classList.add("show");
  document.getElementById("pause-btn").innerHTML = "▶ Resume";
  document.getElementById("pause-btn").classList.add("active");
  document.getElementById("board-status").textContent = "Paused";
}

function resumeGame() {
  if (!paused) return;
  paused = false;
  startTimer();
  document.getElementById("pause-overlay").classList.remove("show");
  document.getElementById("pause-btn").innerHTML = "⏸ Pause";
  document.getElementById("pause-btn").classList.remove("active");
  document.getElementById("board-status").textContent = isDailyMode
    ? "◆ Daily — In progress"
    : "In progress";
}

// ─── TIMER ────────────────────────────────────────────────────────────────

function startTimer() {
  timerInterval = setInterval(() => {
    seconds++;
    document.getElementById("timer-display").textContent = formatTime(seconds);
  }, 1000);
}
function stopTimer() {
  clearInterval(timerInterval);
}
function resetTimer() {
  stopTimer();
  seconds = 0;
  document.getElementById("timer-display").textContent = "00:00";
}
function formatTime(s) {
  return `${Math.floor(s / 60)
    .toString()
    .padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
}

// ─── NOTES MODE ───────────────────────────────────────────────────────────

function toggleNotesMode() {
  if (!gameActive || !started) return;
  notesMode = !notesMode;
  updateNotesToggleBtn();
}

function updateNotesToggleBtn() {
  const btn = document.getElementById("notes-toggle-btn");
  const label = document.getElementById("notes-mode-label");
  if (notesMode) {
    btn.classList.add("active");
    label.textContent = "On";
  } else {
    btn.classList.remove("active");
    label.textContent = "Off";
  }
}

// ─── EVENT LISTENERS ──────────────────────────────────────────────────────

document.getElementById("start-btn").addEventListener("click", startGame);
document
  .getElementById("pause-btn")
  .addEventListener("click", () => (paused ? resumeGame() : pauseGame()));
document.getElementById("resume-btn").addEventListener("click", resumeGame);
document.getElementById("new-game-btn").addEventListener("click", newGame);
document.getElementById("hint-btn").addEventListener("click", useHint);
document.getElementById("check-btn").addEventListener("click", checkBoard);
document.getElementById("solve-btn").addEventListener("click", revealSolution);
document.getElementById("win-new-btn").addEventListener("click", newGame);
document
  .getElementById("daily-btn")
  .addEventListener("click", startDailyChallenge);
document
  .getElementById("lb-submit-btn")
  .addEventListener("click", submitLeaderboardEntry);
document
  .getElementById("notes-toggle-btn")
  .addEventListener("click", toggleNotesMode);
document.getElementById("lb-name-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") submitLeaderboardEntry();
});

document.querySelectorAll(".diff-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document
      .querySelectorAll(".diff-btn")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentDiff = btn.dataset.diff;
    newGame();
  });
});

// ─── INIT ─────────────────────────────────────────────────────────────────

// Set daily card date
document.getElementById("daily-card-date").textContent = todayKey();

renderNumpad();
newGame();
updateDailyBtn();

// If already played today, show the leaderboard on load
if (hasPlayedToday()) {
  renderPageLeaderboard(null);
}
