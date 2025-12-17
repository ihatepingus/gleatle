/**
 * CONFIGURAZIONE E LISTA MEME
 * ---------------------------
 * Come modificare la lista:
 * 1. Aggiungi le tue frasi nell'array MEMES.
 * 2. Non preoccuparti di maiuscole/minuscole o spazi extra, vengono normalizzati.
 * 3. Evita numeri e punteggiatura se possibile (verranno rimossi).
 */
const MEMES = [
  "cristoteca",
  "almeno mille",
  "io palla",
  "penicillina",
  "skimited",
  "spicchia",
  "shampoo",
  "pasta al pesto",
  "dittatrice",
  "trapano",
  "zaya mbriaca",
  "lumaca",
  "brainrot",
  "pingu",
  "salsa alle alici",
  "professori pakistani",
  "twei",
  "suvvia",
  "davide",
  "gigabatta",
  "shuttle bus",
  "creppine",
  "forrok",
  "orlando",
  "obbligo o verita",
  "labubu",
  "fantasma di otabek",
  "cameriera della mensa",
  "cinque chili di cereali",
  "caffe di mika",
  "pollice di tomi",
  "taipei",
  "uova grado uno",
  "fermentazione",
  "smascellatore",
  "insomma",
  "ha fatto vicino a me",
  "giovanni two",
  "gleatz",
  "flaxia",
  "giorgida",
  "banconota da duemila won",
  "ola ha la centoquattro",
  "porridge nel microonde",
  "shahzoda",
  "bunny bunny",
  "doccia di toma",
  "camminata grissinbon",
  "concerto di flauti",
  "caffe onion"
];

const EPOCH = new Date(2025, 11, 17); // 17 Dicembre 2025 (Mese 0 = Gennaio)

/* --- LOGICA DI GIOCO --- */

let currentMeme = "";
let normalizedTarget = ""; // La stringa "pulita" senza spazi per il confronto
let displayTarget = "";    // La stringa originale per la griglia
let maxAttempts = 6;
let currentRow = 0;
let currentGuess = []; // Array di lettere inserite per la riga attuale
let isGameOver = false;

// Mappa tastiera QWERTY/Italiana semplificata
const KEYBOARD_LAYOUT = [
    "QWERTYUIOP",
    "ASDFGHJKL",
    "ZXCVBNM"
];

// Stato iniziale
let gameState = {
    lastPlayedDate: null,
    guesses: [], // Array di stringhe normalizzate
    gameStatus: 'IN_PROGRESS', // 'IN_PROGRESS', 'WIN', 'FAIL'
    stats: {
        played: 0,
        wins: 0,
        streak: 0,
        lastWinDate: null
    }
};

document.addEventListener('DOMContentLoaded', () => {
    initGame();
    
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            applyResponsiveTileSizing();
        }, 100);
    });

    setupKeyboard();
    setupModals();
});

function initGame() {
    loadState();
    
    // 1. Selezione Daily
    const today = new Date();
    today.setHours(0,0,0,0);
    const dayIndex = getDayIndex(today);
    
    // Seleziona meme (loop se finiscono)
    const memeRaw = MEMES[dayIndex % MEMES.length];
    
    // 2. Normalizzazione
    displayTarget = memeRaw.toUpperCase().replace(/\s+/g, ' '); // Singolo spazio per display
    normalizedTarget = normalizeForCompare(memeRaw);
    
    // 3. Calcolo Tentativi: formula clamp(ceil(L/2)+2, 4, 10)
    const L = normalizedTarget.length;
    maxAttempts = clamp(Math.ceil(L * 0.6) + 2, 5, 12);
    
    document.getElementById('attempts-left').textContent = maxAttempts;

    // 4. Controllo Reset Giornaliero
    const savedDate = gameState.lastPlayedDate;
    const todayStr = today.toISOString().split('T')[0];

    if (savedDate !== todayStr) {
        // Nuovo giorno, reset partita ma mantieni stats
        gameState.lastPlayedDate = todayStr;
        gameState.guesses = [];
        gameState.gameStatus = 'IN_PROGRESS';
        gameState.rowIndex = 0;
        currentRow = 0;
        isGameOver = false;
        saveState();
    } else {
        // Ripristina stato odierno
        currentRow = gameState.guesses.length;
        isGameOver = gameState.gameStatus !== 'IN_PROGRESS';
    }

    // Aggiorna il contatore visivo sottraendo i tentativi già fatti
    document.getElementById('attempts-left').textContent = maxAttempts - currentRow;

    // 5. Costruzione Griglia
    createGrid();
    applyResponsiveTileSizing();

    // 6. Ripristino visuale tentativi precedenti (MODIFICA QUI)
    gameState.guesses.forEach((guess, index) => {
        // Ricolora le righe già inviate
        applyColorLogic(guess, index, false); 
        
        // Se stiamo ricaricando le lettere inviate, dobbiamo anche popolare
        // visivamente il testo dentro le celle (che applyColorLogic usa ma non scriveva esplicitamente nel DOM se vuote)
        const rowDiv = document.querySelector(`.board-row[data-row="${index}"]`);
        const tiles = Array.from(rowDiv.querySelectorAll('.tile:not(.space)'));
        guess.split('').forEach((char, charIndex) => {
            tiles[charIndex].textContent = char;
        });
    });

    // Se la partita è finita, mostra il messaggio
    if (isGameOver) {
        if(gameState.gameStatus === 'WIN') showMessage("Bentornato! Hai già vinto oggi.");
        else showMessage("Meme di oggi: " + displayTarget, 5000);
    }
}


/* --- FUNZIONI CORE --- */

function normalizeForCompare(str) {
    return str
        .normalize("NFD") // Scompone accenti
        .replace(/[\u0300-\u036f]/g, "") // Rimuove diacritici
        .replace(/[^a-zA-Z]/g, "") // Rimuove tutto tranne lettere
        .toUpperCase();
}

function getDayIndex(dateObj) {
    const epochMidnight = new Date(EPOCH).setHours(0,0,0,0);
    const todayMidnight = dateObj.getTime();
    const diffTime = todayMidnight - epochMidnight;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays); // Evita indici negativi
}

/* --- UI & GRID --- */

function createGrid() {
    const board = document.getElementById('board-container');
    board.innerHTML = '';

    for (let r = 0; r < maxAttempts; r++) {
        const rowDiv = document.createElement('div');
        rowDiv.className = 'board-row';
        rowDiv.dataset.row = r;

        // Iteriamo sulla stringa DISPLAY (spazi inclusi)
        for (let i = 0; i < displayTarget.length; i++) {
            const char = displayTarget[i];
            const tile = document.createElement('div');
            tile.className = 'tile';
            
            if (char === ' ') {
                tile.classList.add('space');
            } else {
                // Per le lettere, usiamo l'attributo data-index per mappare
                // l'input utente (che non ha spazi) alla griglia visiva
                tile.dataset.state = 'empty';
            }
            rowDiv.appendChild(tile);
        }
        board.appendChild(rowDiv);
    }
}

function updateActiveRow() {
    if (isGameOver) return;
    
    const rowDiv = document.querySelector(`.board-row[data-row="${currentRow}"]`);
    const tiles = Array.from(rowDiv.children);
    
    // Indice per scorrere currentGuess (che non ha spazi)
    let guessIdx = 0;

    tiles.forEach(tile => {
        if (tile.classList.contains('space')) return;

        const letter = currentGuess[guessIdx] || '';
        tile.textContent = letter;
        tile.dataset.state = letter ? 'active' : 'empty';
        if (letter) guessIdx++;
    });
}

/* --- INPUT HANDLING --- */

function handleKey(key) {
    if (isGameOver) return;

    if (key === 'ENTER') {
        submitGuess();
    } else if (key === 'BACKSPACE' || key === 'DELETE') {
        if (currentGuess.length > 0) {
            currentGuess.pop();
            updateActiveRow();
        }
    } else if (/^[A-Z]$/.test(key)) {
        if (currentGuess.length < normalizedTarget.length) {
            currentGuess.push(key);
            updateActiveRow();
        }
    }
}

function clamp(val, min, max) {
    return Math.min(Math.max(val, min), max);
}

function applyResponsiveTileSizing() {
    const board = document.getElementById('board-container');
    if (!board) return;

    const cols = displayTarget.length;
    if (!cols) return;

    const gap = 4; // deve combaciare con --tile-gap in CSS
    const spaceCount = (displayTarget.match(/ /g) || []).length;
    const letterCount = cols - spaceCount;

    const available = board.clientWidth - gap * (cols - 1);
    // Spazi ~45% di una tile lettera (semplice e modificabile)
    const denom = Math.max(1, letterCount + spaceCount * 0.45);

    let tile = Math.floor(available / denom);
    tile = clamp(tile, 18, 50);

    const space = Math.max(10, Math.floor(tile * 0.45));
    const fontPx = Math.max(12, Math.floor(tile * 0.55));

    board.style.setProperty('--tile-size', `${tile}px`);
    board.style.setProperty('--space-size', `${space}px`);
    board.style.setProperty('--tile-font', `${fontPx}px`);
    board.style.setProperty('--tile-gap', `${gap}px`);
}


document.addEventListener('keydown', (e) => {
    const key = e.key.toUpperCase();
    if (key === 'ENTER' || key === 'BACKSPACE' || /^[A-Z]$/.test(key)) {
        handleKey(key);
    }
});

function setupKeyboard() {
    const keyboard = document.getElementById('keyboard');
    
    KEYBOARD_LAYOUT.forEach(rowString => {
        const rowDiv = document.createElement('div');
        rowDiv.className = 'keyboard-row';
        
        rowString.split('').forEach(char => {
            const btn = createKeyBtn(char);
            rowDiv.appendChild(btn);
        });
        
        // Aggiungi Backspace e Enter nell'ultima riga
        if (rowString === KEYBOARD_LAYOUT[2]) {
            const enter = createKeyBtn('ENTER', 'wide');
            enter.innerHTML = '<i class="fas fa-check"></i>';
            rowDiv.prepend(enter); // Enter a sinistra
            
            const back = createKeyBtn('BACKSPACE', 'wide');
            back.innerHTML = '<i class="fas fa-backspace"></i>';
            rowDiv.appendChild(back); // Backspace a destra
        }
        
        keyboard.appendChild(rowDiv);
    });
}

function createKeyBtn(keyVal, extraClass = '') {
    const btn = document.createElement('button');
    btn.className = `key ${extraClass}`;
    btn.textContent = keyVal.length > 1 ? '' : keyVal; // Icone per tasti speciali
    btn.dataset.key = keyVal;
    btn.onclick = () => handleKey(keyVal);
    return btn;
}

/* --- GAME LOGIC --- */

function submitGuess() {
    if (currentGuess.length !== normalizedTarget.length) {
        showMessage("Non abbastanza lettere!");
        shakeRow();
        return;
    }

    const guessString = currentGuess.join('');
    
    // 1. Aggiorna stato
    gameState.guesses.push(guessString);
    saveState();

    // 2. Colora Griglia
    applyColorLogic(guessString, currentRow, true);

    // 3. Controlla vittoria/sconfitta
    if (guessString === normalizedTarget) {
        handleWin();
    } else if (currentRow + 1 >= maxAttempts) {
        handleLoss();
    } else {
        currentRow++;
        currentGuess = [];
        document.getElementById('attempts-left').textContent = maxAttempts - currentRow;
    }
}

function applyColorLogic(guessStr, rowIndex, animate) {
    const rowDiv = document.querySelector(`.board-row[data-row="${rowIndex}"]`);
    const tiles = Array.from(rowDiv.querySelectorAll('.tile:not(.space)'));
    const targetArr = normalizedTarget.split('');
    const guessArr = guessStr.split('');
    
    // Stati per ogni cella (default: absent)
    const resultColors = new Array(guessArr.length).fill('absent');
    
    // Conteggio lettere nel target per gestire duplicati
    const letterCounts = {};
    targetArr.forEach(l => letterCounts[l] = (letterCounts[l] || 0) + 1);

    // Pass 1: Trova i VERDI (Corretti)
    guessArr.forEach((letter, i) => {
        if (letter === targetArr[i]) {
            resultColors[i] = 'correct';
            letterCounts[letter]--;
        }
    });

    // Pass 2: Trova i GIALLI (Presenti)
    guessArr.forEach((letter, i) => {
        if (resultColors[i] === 'absent' && letterCounts[letter] > 0) {
            resultColors[i] = 'present';
            letterCounts[letter]--;
        }
    });

    // Applica colori alla UI
    tiles.forEach((tile, i) => {
        const colorClass = resultColors[i];
        const letter = guessArr[i];
        
        setTimeout(() => {
            tile.classList.add('flip');
            tile.dataset.state = colorClass;
            tile.style.borderColor = 'transparent'; // Remove border color for filled tiles
            
            // Aggiorna tastiera
            updateKeyColor(letter, colorClass);
        }, animate ? i * 250 : 0);
    });
}

function updateKeyColor(letter, newState) {
    const btn = document.querySelector(`.key[data-key="${letter}"]`);
    if (!btn) return;

    const currentState = btn.dataset.state || '';
    
    // Gerarchia colori: correct > present > absent
    if (newState === 'correct') {
        btn.style.backgroundColor = 'var(--color-correct)';
        btn.dataset.state = 'correct';
    } else if (newState === 'present' && currentState !== 'correct') {
        btn.style.backgroundColor = 'var(--color-present)';
        btn.dataset.state = 'present';
    } else if (newState === 'absent' && currentState !== 'correct' && currentState !== 'present') {
        btn.style.backgroundColor = 'var(--color-absent)';
        btn.dataset.state = 'absent';
    }
}

/* --- END GAME & UTILS --- */

function handleWin() {
    isGameOver = true;
    gameState.gameStatus = 'WIN';
    updateStats(true);
    showMessage("Grande! Meme indovinato!", 2000);
    saveState();
    setTimeout(() => {
        const modal = new bootstrap.Modal(document.getElementById('statsModal'));
        modal.show();
    }, 1500);
}

function handleLoss() {
    isGameOver = true;
    gameState.gameStatus = 'FAIL';
    updateStats(false);
    showMessage(displayTarget, -1); // Mostra per sempre
    saveState();
    setTimeout(() => {
        const modal = new bootstrap.Modal(document.getElementById('statsModal'));
        modal.show();
    }, 1500);
}

function showMessage(msg, duration = 2000) {
    const container = document.getElementById('message-container');
    const toastEl = document.createElement('div');
    toastEl.className = 'toast show align-items-center text-white bg-secondary border-0';
    toastEl.innerHTML = `<div class="d-flex"><div class="toast-body">${msg}</div></div>`;
    
    container.appendChild(toastEl);
    
    if (duration > 0) {
        setTimeout(() => {
            toastEl.remove();
        }, duration);
    }
}

function shakeRow() {
    const row = document.querySelector(`.board-row[data-row="${currentRow}"]`);
    row.animate([
        { transform: 'translateX(0)' },
        { transform: 'translateX(-5px)' },
        { transform: 'translateX(5px)' },
        { transform: 'translateX(0)' }
    ], { duration: 300 });
}

/* --- STATS & STORAGE --- */

function loadState() {
    const stored = localStorage.getItem('memeWordle_state');
    if (stored) {
        const parsed = JSON.parse(stored);
        // Merge shallow per evitare errori se aggiungi campi in futuro
        gameState = { ...gameState, ...parsed, stats: { ...gameState.stats, ...parsed.stats } };
    }
    updateStatsUI();
}

function saveState() {
    localStorage.setItem('memeWordle_state', JSON.stringify(gameState));
    updateStatsUI();
}

function updateStats(isWin) {
    gameState.stats.played++;
    if (isWin) {
        gameState.stats.wins++;
        gameState.stats.streak++;
    } else {
        gameState.stats.streak = 0;
    }
}

function updateStatsUI() {
    document.getElementById('stat-played').textContent = gameState.stats.played;
    const pct = gameState.stats.played > 0 
        ? Math.round((gameState.stats.wins / gameState.stats.played) * 100) 
        : 0;
    document.getElementById('stat-win-pct').textContent = pct + '%';
    document.getElementById('stat-streak').textContent = gameState.stats.streak;
}

function setupModals() {
    // Timer per il prossimo meme
    setInterval(() => {
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setHours(24, 0, 0, 0);
        const diff = tomorrow - now;
        
        const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((diff % (1000 * 60)) / 1000);
        
        document.getElementById('countdown').textContent = 
            `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
    }, 1000);
}
