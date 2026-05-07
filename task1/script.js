const DIFFICULTY_TIMES = { easy: 180, normal: 120, hard: 60 };
const DEFAULT_SETTINGS = { rows: 4, cols: 4, diff: 'easy', rounds: 1, mode: 1, p1: 'Гравець 1', p2: 'Гравець 2' };

const CARDS_DATA = [
    { emoji: '🐶', label: 'Собака' },
    { emoji: '😺', label: 'Кіт' },
    { emoji: '🐭', label: 'Миша' },
    { emoji: '🐹', label: 'Хом\'як' },
    { emoji: '🦊', label: 'Лис' },
    { emoji: '🐻', label: 'Ведмідь' },
    { emoji: '🐼', label: 'Панда' },
    { emoji: '🐨', label: 'Коала' },
    { emoji: '🦁', label: 'Лев' },
    { emoji: '🐯', label: 'Тигр' },
    { emoji: '🦄', label: 'Єдинорог' },
    { emoji: '🐸', label: 'Жаба' },
    { emoji: '🐙', label: 'Восьминіг' },
    { emoji: '🦋', label: 'Метелик' },
    { emoji: '🐬', label: 'Дельфін' },
    { emoji: '🦉', label: 'Сова' },
    { emoji: '🦕', label: 'Динозавр' },
    { emoji: '🦖', label: 'Тиранозавр' },
];


const shuffleArray = arr =>
    [...arr].reduce((shuffled, _, i) => {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        return shuffled;
    }, [...arr]);

const createDeck = (rows, cols) => {
    const total = rows * cols;
    const pairs = total / 2;
    const selected = shuffleArray(CARDS_DATA).slice(0, pairs);
    return shuffleArray([...selected, ...selected].map((card, i) => ({
        id: i,
        emoji: card.emoji,
        label: card.label,
        flipped: false,
        matched: false,
    })));
};

const formatTime = seconds => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
};

const getEl = id => document.getElementById(id);
const showEl = id => getEl(id).classList.remove('hidden');
const hideEl = id => getEl(id).classList.add('hidden');

const getSettings = () => ({
    rows: parseInt(getEl('rowsSelect').value),
    cols: parseInt(getEl('colsSelect').value),
    diff: getEl('diffSelect').value,
    rounds: parseInt(getEl('roundsInput').value),
    mode: state.mode,
    p1: getEl('p1name').value.trim() || DEFAULT_SETTINGS.p1,
    p2: getEl('p2name').value.trim() || DEFAULT_SETTINGS.p2,
});

const getPlayerName = (playerIdx, settings) =>
    playerIdx === 0 ? settings.p1 : settings.p2;

const buildRoundStats = (roundHistory) =>
    roundHistory.map((round, i) => `
    <div class="stats-player">
      <div class="stats-player-name">Раунд ${i + 1}</div>
      ${round.map(p => `
        <div class="stats-row"><span>${p.name}</span><span>${p.moves} ходів, ${formatTime(p.time)}</span></div>
      `).join('')}
    </div>
  `).join('');

const determineWinner = (roundHistory, settings) => {
    if (settings.mode === 1) return null;
    const scores = [0, 0];
    roundHistory.forEach(round => {
        const [p1, p2] = round;
        if (p1.moves < p2.moves) scores[0]++;
        else if (p2.moves < p1.moves) scores[1]++;
        else {
            if (p1.time < p2.time) scores[0]++;
            else scores[1]++;
        }
    });
    if (scores[0] > scores[1]) return settings.p1;
    if (scores[1] > scores[0]) return settings.p2;
    return 'Нічия!';
};

let state = {
    mode: 1,
    settings: null,
    deck: [],
    flipped: [],
    matched: 0,
    moves: 0,
    timeLeft: 0,
    timerInterval: null,
    currentPlayer: 0, // 0 or 1
    playerMoves: [0, 0],
    playerStartTime: [0, 0],
    currentRound: 1,
    roundHistory: [], // [{name, moves, time}]
    currentRoundStats: [],
    locked: false,
    gameStartTime: 0,
};

const renderBoard = (deck, rows, cols) => {
    const board = getEl('board');
    board.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    board.innerHTML = '';
    deck.forEach((card) => {
        const el = document.createElement('div');
        el.className = 'card' + (card.flipped ? ' flipped' : '') + (card.matched ? ' matched' : '');
        el.dataset.id = card.id;
        el.innerHTML = `
      <div class="card-inner">
        <div class="card-face card-back"></div>
        <div class="card-face card-front">
          <div class="card-emoji">${card.emoji}</div>
          <div class="card-label">${card.label}</div>
        </div>
      </div>`;
        el.addEventListener('click', () => handleCardClick(card.id));
        board.appendChild(el);
    });
};

const updateCardDOM = (card) => {
    const el = document.querySelector(`.card[data-id="${card.id}"]`);
    if (!el) return;
    el.className = 'card' + (card.flipped ? ' flipped' : '') + (card.matched ? ' matched' : '');
};

const updateHUD = () => {
    getEl('timerDisplay').textContent = formatTime(state.timeLeft);
    getEl('movesDisplay').textContent = state.moves;
    getEl('pairsDisplay').textContent = state.matched;
    getEl('roundDisplay').textContent = `${state.currentRound}/${state.settings.rounds}`;

    const timerVal = getEl('timerDisplay');
    if (state.timeLeft <= 10) timerVal.classList.add('danger');
    else timerVal.classList.remove('danger');

    if (state.settings.mode === 2) {
        showEl('playerTurnBar');
        getEl('currentPlayerName').textContent = getPlayerName(state.currentPlayer, state.settings);
    } else {
        hideEl('playerTurnBar');
    }
};

const stopTimer = () => {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
};

const startTimer = () => {
    stopTimer();
    state.timerInterval = setInterval(() => {
        state.timeLeft--;
        updateHUD();
        if (state.timeLeft <= 0) {
            stopTimer();
            handleTimeout();
        }
    }, 1000);
};

const handleCardClick = (cardId) => {
    if (state.locked) return;
    const card = state.deck.find(c => c.id === cardId);
    if (!card || card.flipped || card.matched) return;
    if (state.flipped.length >= 2) return;

    card.flipped = true;
    state.flipped.push(card);
    updateCardDOM(card);

    if (state.flipped.length === 2) {
        state.moves++;
        if (state.settings.mode === 2) {
            state.playerMoves[state.currentPlayer]++;
        }
        updateHUD();
        checkPair();
    }
};

const checkPair = () => {
    const [a, b] = state.flipped;
    if (a.emoji === b.emoji) {
        a.matched = true;
        b.matched = true;
        state.matched++;
        state.flipped = [];
        updateCardDOM(a);
        updateCardDOM(b);
        updateHUD();

        if (state.matched === state.deck.length / 2) {
            stopTimer();
            setTimeout(handleRoundWin, 600);
        }
    } else {
        state.locked = true;
        setTimeout(() => {
            a.flipped = false;
            b.flipped = false;
            state.flipped = [];
            updateCardDOM(a);
            updateCardDOM(b);
            state.locked = false;
            // Switch player in 2-player mode after failed pair
            if (state.settings.mode === 2) {
                state.currentPlayer = state.currentPlayer === 0 ? 1 : 0;
                updateHUD();
            }
        }, 900);
    }
};

const handleRoundWin = () => {
    const elapsed = Math.floor((Date.now() - state.gameStartTime) / 1000);
    const totalTime = DIFFICULTY_TIMES[state.settings.diff] - state.timeLeft;

    if (state.settings.mode === 1) {
        state.currentRoundStats = [{ name: state.settings.p1, moves: state.moves, time: totalTime }];
    } else {
        state.currentRoundStats = [
            { name: state.settings.p1, moves: state.playerMoves[0], time: totalTime },
            { name: state.settings.p2, moves: state.playerMoves[1], time: totalTime },
        ];
    }
    state.roundHistory.push(state.currentRoundStats);

    if (state.currentRound < state.settings.rounds) {
        showModal('🎉', `Раунд ${state.currentRound} завершено!`,
            `Переходимо до наступного раунду.`, state.currentRoundStats, false);
    } else {
        const winner = determineWinner(state.roundHistory, state.settings);
        const title = winner ? `🏆 Переможець: ${winner}` : '🎉 Гру завершено!';
        const msg = state.settings.mode === 1
            ? `Ти завершив гру за ${formatTime(totalTime)} та ${state.moves} ходів!`
            : `Всі раунди зіграно!`;
        showModal('🏆', title, msg, null, true, state.roundHistory);
    }
};

const handleTimeout = () => {
    showModal('⏰', 'Час вийшов!', 'На жаль, ви не встигли завершити гру.', null, true);
};

const showModal = (icon, title, msg, roundStats, isFinal, allHistory) => {
    getEl('modalIcon').textContent = icon;
    getEl('modalTitle').textContent = title;
    getEl('modalMessage').textContent = msg;

    const statsContainer = getEl('statsContainer');
    if (allHistory && allHistory.length) {
        statsContainer.innerHTML = `<div class="stats-grid">${buildRoundStats(allHistory)}</div>`;
    } else if (roundStats) {
        statsContainer.innerHTML = `<div class="stats-grid">${buildRoundStats([roundStats])}</div>`;
    } else {
        statsContainer.innerHTML = '';
    }

    if (isFinal) {
        showEl('playAgainBtn');
        hideEl('nextRoundBtn');
    } else {
        hideEl('playAgainBtn');
        showEl('nextRoundBtn');
    }
    showEl('modalOverlay');
};

const hideModal = () => hideEl('modalOverlay');

const initRound = () => {
    const { rows, cols, diff } = state.settings;
    state.deck = createDeck(rows, cols);
    state.flipped = [];
    state.matched = 0;
    state.moves = 0;
    state.playerMoves = [0, 0];
    state.timeLeft = DIFFICULTY_TIMES[diff];
    state.locked = false;
    state.currentPlayer = 0;
    state.gameStartTime = Date.now();

    renderBoard(state.deck, rows, cols);
    updateHUD();
    startTimer();
};

const setMode = (mode) => {
    state.mode = mode;
    getEl('mode1p').classList.toggle('active', mode === 1);
    getEl('mode2p').classList.toggle('active', mode === 2);
    getEl('p2row').classList.toggle('hidden', mode === 1);
};

const resetSettings = () => {
    getEl('rowsSelect').value = DEFAULT_SETTINGS.rows;
    getEl('colsSelect').value = DEFAULT_SETTINGS.cols;
    getEl('diffSelect').value = DEFAULT_SETTINGS.diff;
    getEl('roundsInput').value = DEFAULT_SETTINGS.rounds;
    getEl('p1name').value = '';
    getEl('p2name').value = '';
    setMode(1);
};

const startGame = () => {
    stopTimer();
    hideModal();
    state.settings = getSettings();
    state.currentRound = 1;
    state.roundHistory = [];

    hideEl('settingsPanel');
    showEl('gameArea');
    initRound();
};

const nextRound = () => {
    hideModal();
    state.currentRound++;
    initRound();
};

const restartRound = () => {
    stopTimer();
    hideModal();
    initRound();
};

const showSettings = () => {
    stopTimer();
    hideModal();
    hideEl('gameArea');
    showEl('settingsPanel');
};