/* ========================================================
   CLICK SYNC GAMES - CASINO BACCARAT ENGINE
   - Baccarat Card Counting System:
     * Ace, 2, 3 = +1
     * 5, 7, 8 = -1
     * 6 = -2
     * 9, 10, J, Q, K = 0
     * Count changes strictly upon cards being flipped face-up
   - Modal-Driven Game History:
     * Permanent left board removed
     * "HISTORY" button placed beneath "HOW TO COUNT"
     * Dedicated modal displays round number, scores, and outcome
   - Phase-Focus Camera System for Mobile Landscape
   - Zero-Latency Web Audio Engine (Instant Attacks, No Ambience)
   ======================================================== */

(function () {
  'use strict';

  // Bankroll & Table State
  let bankroll = 1000;
  let activeChipValue = 1;
  let bets = { player: 0, tie: 0, banker: 0 };
  let isDealing = false;
  let isPaused = false;
  let soundEnabled = true;

  // Card Counting State
  let runningCount = 0;
  let isCountVisible = false;

  // History State
  const historyList = [];
  let roundCounter = 0;

  const MAX_BETS = { player: 500, banker: 500, tie: 100 };

  // 8-Deck Shoe Setup
  const TOTAL_DECKS = 8;
  let shoe = [];
  const suits = ['♠', '♥', '♦', '♣'];
  const ranks = [
    { rank: 'A', val: 1, count: 1 },
    { rank: '2', val: 2, count: 1 },
    { rank: '3', val: 3, count: 1 },
    { rank: '4', val: 4, count: 0 },
    { rank: '5', val: 5, count: -1 },
    { rank: '6', val: 6, count: -2 },
    { rank: '7', val: 7, count: -1 },
    { rank: '8', val: 8, count: -1 },
    { rank: '9', val: 9, count: 0 },
    { rank: '10', val: 0, count: 0 },
    { rank: 'J', val: 0, count: 0 },
    { rank: 'Q', val: 0, count: 0 },
    { rank: 'K', val: 0, count: 0 }
  ];

  // DOM Elements
  const casinoStage = document.getElementById('casino-stage');
  const elBankroll = document.getElementById('bankroll-display');
  const elTotalWager = document.getElementById('total-wager-amount');
  const elStatusBanner = document.getElementById('game-status-banner');
  const winnerDropBanner = document.getElementById('winner-drop-banner');
  const tableFelt = document.getElementById('table-felt');
  const cardShoe = document.getElementById('card-shoe');

  // Count UI Elements
  const btnRunningCount = document.getElementById('btn-running-count');
  const rcValueDisplay = document.getElementById('rc-value-display');
  const btnHowToCount = document.getElementById('btn-how-to-count');
  const countModal = document.getElementById('count-modal');
  const btnCloseCount = document.getElementById('btn-close-count');

  // History UI Elements
  const btnHistory = document.getElementById('btn-history');
  const historyModal = document.getElementById('history-modal');
  const btnCloseHistory = document.getElementById('btn-close-history');
  const historyModalTbody = document.getElementById('history-modal-tbody');

  const btnDeal = document.getElementById('btn-deal');
  const btnClear = document.getElementById('btn-clear-bets');
  const btnSound = document.getElementById('btn-sound-toggle');
  const btnPause = document.getElementById('btn-pause');
  const btnContinue = document.getElementById('btn-continue');

  const pauseModal = document.getElementById('pause-modal');
  const instructionsModal = document.getElementById('instructions-modal');
  const btnInstructions = document.getElementById('btn-instructions');
  const btnCloseInstructions = document.getElementById('btn-close-instructions');

  const shuffleOverlay = document.getElementById('shuffle-overlay');
  const shuffleContainer = document.getElementById('shuffle-cards-container');

  const elPlayerBadge = document.getElementById('player-score-badge');
  const elBankerBadge = document.getElementById('banker-score-badge');

  const slots = {
    p1: document.getElementById('player-card-1'),
    p2: document.getElementById('player-card-2'),
    p3: document.getElementById('player-card-3'),
    b1: document.getElementById('banker-card-1'),
    b2: document.getElementById('banker-card-2'),
    b3: document.getElementById('banker-card-3')
  };

  const spots = {
    player: document.getElementById('spot-player'),
    tie: document.getElementById('spot-tie'),
    banker: document.getElementById('spot-banker')
  };

  const tags = {
    player: document.getElementById('tag-player'),
    tie: document.getElementById('tag-tie'),
    banker: document.getElementById('tag-banker')
  };

  const placedSockets = {
    player: document.getElementById('placed-chip-player'),
    tie: document.getElementById('placed-chip-tie'),
    banker: document.getElementById('placed-chip-banker')
  };

  const chipButtons = document.querySelectorAll('.chip-piece');

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  // Phase Camera Setter
  function setGamePhase(phase) {
    if (phase === 'betting') {
      casinoStage.classList.remove('phase-dealing');
      casinoStage.classList.add('phase-betting');
    } else if (phase === 'dealing') {
      casinoStage.classList.remove('phase-betting');
      casinoStage.classList.add('phase-dealing');
    }
  }

  // ========================================================
  // ZERO-LATENCY WEB AUDIO ENGINE
  // ========================================================
  const AudioEngine = {
    ctx: null,
    masterGain: null,

    init() {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx({ latencyHint: 'interactive' });
          this.masterGain = this.ctx.createGain();
          this.masterGain.gain.setValueAtTime(soundEnabled ? 1.0 : 0.0, this.ctx.currentTime);
          this.masterGain.connect(this.ctx.destination);
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    },

    toggleSound(enabled) {
      if (!this.masterGain || !this.ctx) return;
      this.masterGain.gain.setValueAtTime(enabled ? 1.0 : 0.0, this.ctx.currentTime);
    },

    // Instant ceramic chip clack
    playChip() {
      if (!soundEnabled || !this.ctx) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();

      const t0 = this.ctx.currentTime;
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(1400, t0);
      osc1.frequency.exponentialRampToValueAtTime(700, t0 + 0.025);

      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(2200, t0);
      osc2.frequency.exponentialRampToValueAtTime(1100, t0 + 0.015);

      gain.gain.setValueAtTime(0.24, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.03);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.masterGain);

      osc1.start(t0);
      osc2.start(t0);
      osc1.stop(t0 + 0.03);
      osc2.stop(t0 + 0.03);
    },

    // Fast felt card slide / deal flick
    playCardSlide() {
      if (!soundEnabled || !this.ctx) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();

      const t0 = this.ctx.currentTime;
      // Filtered white noise burst for real card friction
      const bufferSize = Math.floor(this.ctx.sampleRate * 0.06);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const whiteNoise = this.ctx.createBufferSource();
      whiteNoise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1100, t0);
      filter.frequency.exponentialRampToValueAtTime(450, t0 + 0.06);
      filter.Q.setValueAtTime(1.5, t0);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.22, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.06);

      whiteNoise.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      whiteNoise.start(t0);
      whiteNoise.stop(t0 + 0.06);
    },

    // Sharp card snap / flip
    playFlip() {
      if (!soundEnabled || !this.ctx) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();

      const t0 = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(650, t0);
      osc.frequency.exponentialRampToValueAtTime(1250, t0 + 0.035);

      gain.gain.setValueAtTime(0.18, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.04);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t0);
      osc.stop(t0 + 0.04);
    },

    // Rapid riffling shuffle wash
    playShuffle() {
      if (!soundEnabled || !this.ctx) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();

      const baseTime = this.ctx.currentTime;
      for (let i = 0; i < 22; i++) {
        const t = baseTime + (i * 0.16);
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(200 + Math.random() * 220, t);
        osc.frequency.exponentialRampToValueAtTime(80, t + 0.045);

        gain.gain.setValueAtTime(0.08, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.045);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(t);
        osc.stop(t + 0.045);
      }
    },

    // Clean, crisp victory chime (no droning tail)
    playWin() {
      if (!soundEnabled || !this.ctx) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();

      const t0 = this.ctx.currentTime;
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t0 + idx * 0.06);

        const noteStart = t0 + idx * 0.06;
        gain.gain.setValueAtTime(0.16, noteStart);
        gain.gain.exponentialRampToValueAtTime(0.001, noteStart + 0.18);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(noteStart);
        osc.stop(noteStart + 0.18);
      });
    }
  };

  // Pre-unlock AudioContext on initial tap/click
  const unlockAudio = () => {
    AudioEngine.init();
    window.removeEventListener('pointerdown', unlockAudio);
    window.removeEventListener('keydown', unlockAudio);
  };
  window.addEventListener('pointerdown', unlockAudio, { passive: true });
  window.addEventListener('keydown', unlockAudio, { passive: true });

  // Running Count Update Display
  function renderRunningCount() {
    const formatted = runningCount > 0 ? `+${runningCount}` : `${runningCount}`;
    rcValueDisplay.textContent = `RC: ${formatted}`;
  }

  // Running Count Toggle
  btnRunningCount.addEventListener('click', () => {
    AudioEngine.playChip();
    isCountVisible = !isCountVisible;
    if (isCountVisible) {
      btnRunningCount.classList.add('depressed');
      rcValueDisplay.classList.remove('hidden');
      renderRunningCount();
    } else {
      btnRunningCount.classList.remove('depressed');
      rcValueDisplay.classList.add('hidden');
    }
  });

  // How to Count Modal
  btnHowToCount.addEventListener('click', () => {
    AudioEngine.playChip();
    countModal.classList.add('open');
  });

  btnCloseCount.addEventListener('click', () => {
    countModal.classList.remove('open');
  });

  countModal.addEventListener('click', (e) => {
    if (e.target === countModal) countModal.classList.remove('open');
  });

  // History Modal Handlers
  function renderHistoryModal() {
    if (historyList.length === 0) {
      historyModalTbody.innerHTML = '<tr><td colspan="4" class="no-history-cell">No hands dealt yet in this shoe.</td></tr>';
      return;
    }

    historyModalTbody.innerHTML = '';
    historyList.slice().reverse().forEach(item => {
      const row = document.createElement('tr');
      let outcomeClass = 'hist-out-player';
      if (item.outcome === 'Banker') outcomeClass = 'hist-out-banker';
      if (item.outcome === 'Tie') outcomeClass = 'hist-out-tie';

      row.innerHTML = `
        <td><strong>#${item.round}</strong></td>
        <td>${item.pScore}</td>
        <td>${item.bScore}</td>
        <td class="${outcomeClass}">${item.outcome}</td>
      `;
      historyModalTbody.appendChild(row);
    });
  }

  btnHistory.addEventListener('click', () => {
    AudioEngine.playChip();
    renderHistoryModal();
    historyModal.classList.add('open');
  });

  btnCloseHistory.addEventListener('click', () => {
    historyModal.classList.remove('open');
  });

  historyModal.addEventListener('click', (e) => {
    if (e.target === historyModal) historyModal.classList.remove('open');
  });

  // 4-Second Animated Shuffle
  async function perform4SecondShuffle() {
    isDealing = true;
    btnDeal.disabled = true;
    btnClear.disabled = true;

    AudioEngine.playShuffle();

    shuffleContainer.innerHTML = '';
    const cards = [];
    for (let i = 0; i < 28; i++) {
      const c = document.createElement('div');
      c.className = 'swirl-card';
      c.style.left = '50%';
      c.style.top = '50%';
      shuffleContainer.appendChild(c);
      cards.push(c);
    }

    shuffleOverlay.classList.add('active');

    const interval = setInterval(() => {
      cards.forEach(c => {
        const rad = Math.random() * Math.PI * 2;
        const dist = 30 + Math.random() * 220;
        const x = Math.cos(rad) * dist;
        const y = Math.sin(rad) * dist * 0.45;
        const rot = (Math.random() - 0.5) * 160;
        c.style.transform = `translate(${x}px, ${y}px) rotate(${rot}deg)`;
      });
    }, 350);

    await sleep(4000);
    clearInterval(interval);

    cards.forEach(c => {
      c.style.transition = 'all 0.4s ease-in';
      c.style.transform = 'translate(320px, -120px) scale(0.2)';
      c.style.opacity = '0';
    });

    await sleep(450);
    shuffleOverlay.classList.remove('active');
    shuffleContainer.innerHTML = '';

    shoe = [];
    for (let d = 0; d < TOTAL_DECKS; d++) {
      for (const suit of suits) {
        for (const r of ranks) {
          shoe.push({
            rank: r.rank,
            suit: suit,
            val: r.val,
            count: r.count,
            isRed: suit === '♥' || suit === '♦'
          });
        }
      }
    }

    for (let i = shoe.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shoe[i], shoe[j]] = [shoe[j], shoe[i]];
    }

    runningCount = 0;
    renderRunningCount();

    // Reset history for fresh shoe
    historyList.length = 0;
    roundCounter = 0;

    const burn = shoe.pop();
    const count = burn.val === 0 ? 10 : burn.val;
    for (let b = 0; b < count; b++) {
      if (shoe.length > 0) shoe.pop();
    }

    isDealing = false;
    updateUI();
    setGamePhase('betting');
    elStatusBanner.textContent = '8-Deck Shoe loaded. Place your bets.';
  }

  function drawCard() {
    if (shoe.length < 15) perform4SecondShuffle();
    return shoe.pop();
  }

  function createCardFlipper(card, isPerpendicular = false) {
    const flipper = document.createElement('div');
    flipper.className = `card-flipper ${isPerpendicular ? 'perpendicular' : ''}`;

    const back = document.createElement('div');
    back.className = 'card-face card-face-back';

    const front = document.createElement('div');
    front.className = `card-face card-face-front ${card.isRed ? 'red' : 'black'}`;
    front.innerHTML = `
      <div class="card-rank">${card.rank}</div>
      <div class="card-suit-center">${card.suit}</div>
      <div class="card-rank card-rank-bottom">${card.rank}</div>
    `;

    flipper.appendChild(back);
    flipper.appendChild(front);
    return flipper;
  }

  function calcTotal(hand) {
    const sum = hand.reduce((a, c) => a + c.val, 0);
    return sum % 10;
  }

  function updateUI() {
    elBankroll.textContent = bankroll.toLocaleString();
    const totalWager = bets.player + bets.tie + bets.banker;
    elTotalWager.textContent = totalWager;

    Object.keys(bets).forEach(t => {
      tags[t].textContent = `$${bets[t]}`;
      placedSockets[t].innerHTML = '';
      if (bets[t] > 0) {
        const mini = document.createElement('div');
        mini.className = `mini-placed-chip chip-${getChipClass(bets[t])}`;
        mini.textContent = bets[t];
        placedSockets[t].appendChild(mini);
      }
    });

    btnDeal.disabled = totalWager === 0 || isDealing;
  }

  function getChipClass(amt) {
    if (amt >= 100) return '100';
    if (amt >= 25) return '25';
    if (amt >= 5) return '5';
    return '1';
  }

  function recordHistory(pScore, bScore) {
    roundCounter += 1;
    let outcome = 'Tie';
    if (pScore > bScore) outcome = 'Player';
    if (bScore > pScore) outcome = 'Banker';

    historyList.push({
      round: roundCounter,
      pScore: pScore,
      bScore: bScore,
      outcome: outcome
    });
  }

  chipButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      AudioEngine.playChip();
      chipButtons.forEach(b => b.classList.remove('active-chip'));
      btn.classList.add('active-chip');
      activeChipValue = parseInt(btn.getAttribute('data-amount'), 10);
    });
  });

  // Betting Spots Interaction (Instant audio & UI response)
  Object.keys(spots).forEach(t => {
    spots[t].addEventListener('pointerdown', (e) => {
      if (isDealing || isPaused) return;

      if (bets[t] + activeChipValue > MAX_BETS[t]) {
        elStatusBanner.textContent = `MAX BET FOR ${t.toUpperCase()} IS $${MAX_BETS[t]}`;
        return;
      }

      if (bankroll < activeChipValue) {
        elStatusBanner.textContent = 'INSUFFICIENT BANKROLL';
        return;
      }

      // Fire audio immediately on touch/click contact
      AudioEngine.playChip();

      bankroll -= activeChipValue;
      bets[t] += activeChipValue;
      updateUI();
    });
  });

  btnClear.addEventListener('click', () => {
    if (isDealing || isPaused) return;
    const totalWager = bets.player + bets.tie + bets.banker;
    if (totalWager === 0) return;

    AudioEngine.playChip();
    bankroll += totalWager;
    bets = { player: 0, tie: 0, banker: 0 };
    updateUI();
    elStatusBanner.textContent = 'BETS CLEARED';
  });

  btnSound.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    AudioEngine.toggleSound(soundEnabled);
    btnSound.textContent = soundEnabled ? '🔊' : '🔇';
  });

  function togglePause() {
    isPaused = !isPaused;
    if (isPaused) {
      pauseModal.classList.add('open');
    } else {
      pauseModal.classList.remove('open');
    }
  }

  btnPause.addEventListener('click', togglePause);
  btnContinue.addEventListener('click', togglePause);

  window.addEventListener('keydown', (e) => {
    if (e.key === 'p' || e.key === 'P') togglePause();
  });

  btnInstructions.addEventListener('click', () => {
    instructionsModal.classList.add('open');
  });

  btnCloseInstructions.addEventListener('click', () => {
    instructionsModal.classList.remove('open');
  });

  instructionsModal.addEventListener('click', (e) => {
    if (e.target === instructionsModal) instructionsModal.classList.remove('open');
  });

  // Deal Sequencing
  btnDeal.addEventListener('click', async () => {
    const totalWager = bets.player + bets.tie + bets.banker;
    if (totalWager === 0 || isDealing || isPaused) return;

    isDealing = true;
    btnDeal.disabled = true;
    btnClear.disabled = true;

    setGamePhase('dealing');

    // Reset card slots & classes
    Object.values(slots).forEach(slot => {
      slot.innerHTML = '';
      slot.className = 'card-slot';
    });
    slots.p3.classList.add('slot-outer-player');
    slots.b3.classList.add('slot-outer-banker');

    elPlayerBadge.style.display = 'none';
    elBankerBadge.style.display = 'none';
    winnerDropBanner.className = 'winner-drop-banner';
    elStatusBanner.textContent = 'DEALING...';

    const pHand = [];
    const bHand = [];

    const feltRect = tableFelt.getBoundingClientRect();
    const shoeRect = cardShoe ? cardShoe.getBoundingClientRect() : { left: feltRect.right - 80, top: feltRect.top + 70 };

    const shoeX = shoeRect.left - feltRect.left + 5;
    const shoeY = shoeRect.top - feltRect.top + 10;

    function spawnStagingCard(card, offsetX, offsetY, rot) {
      const flipper = createCardFlipper(card);
      flipper.style.position = 'absolute';
      flipper.style.width = `${slots.p1.offsetWidth || 44}px`;
      flipper.style.height = `${slots.p1.offsetHeight || 64}px`;
      flipper.style.left = `${shoeX - 85 + offsetX}px`;
      flipper.style.top = `${shoeY + offsetY}px`;
      flipper.style.transform = `rotate(${rot}deg)`;
      flipper.style.zIndex = '35';
      flipper.style.transition = 'all 0.35s ease';
      tableFelt.appendChild(flipper);
      return flipper;
    }

    // Step 1: Draw card 1 (Player)
    await sleep(150);
    pHand.push(drawCard());
    AudioEngine.playCardSlide();
    const c1 = spawnStagingCard(pHand[0], 0, 0, -8);

    // Step 2: Draw card 2 (Banker)
    await sleep(220);
    bHand.push(drawCard());
    AudioEngine.playCardSlide();
    const c2 = spawnStagingCard(bHand[0], 0, 60, 4);

    // Step 3: Draw card 3 (Player)
    await sleep(220);
    pHand.push(drawCard());
    AudioEngine.playCardSlide();
    const c3 = spawnStagingCard(pHand[1], 18, 0, -8);

    // Step 4: Draw card 4 (Banker)
    await sleep(220);
    bHand.push(drawCard());
    AudioEngine.playCardSlide();
    const c4 = spawnStagingCard(bHand[1], 18, 60, 4);

    await sleep(300);

    // Glide pairs to Player & Banker spots
    const p1Rect = slots.p1.getBoundingClientRect();
    const p2Rect = slots.p2.getBoundingClientRect();
    const b1Rect = slots.b1.getBoundingClientRect();
    const b2Rect = slots.b2.getBoundingClientRect();

    AudioEngine.playCardSlide();
    c1.style.left = `${p1Rect.left - feltRect.left}px`;
    c1.style.top = `${p1Rect.top - feltRect.top}px`;
    c1.style.transform = 'rotate(0deg)';

    c3.style.left = `${p2Rect.left - feltRect.left}px`;
    c3.style.top = `${p2Rect.top - feltRect.top}px`;
    c3.style.transform = 'rotate(0deg)';

    c2.style.left = `${b1Rect.left - feltRect.left}px`;
    c2.style.top = `${b1Rect.top - feltRect.top}px`;
    c2.style.transform = 'rotate(0deg)';

    c4.style.left = `${b2Rect.left - feltRect.left}px`;
    c4.style.top = `${b2Rect.top - feltRect.top}px`;
    c4.style.transform = 'rotate(0deg)';

    await sleep(360);

    c1.remove();
    c2.remove();
    c3.remove();
    c4.remove();

    const flipperP1 = createCardFlipper(pHand[0]);
    const flipperP2 = createCardFlipper(pHand[1]);
    const flipperB1 = createCardFlipper(bHand[0]);
    const flipperB2 = createCardFlipper(bHand[1]);

    slots.p1.appendChild(flipperP1);
    slots.p2.appendChild(flipperP2);
    slots.b1.appendChild(flipperB1);
    slots.b2.appendChild(flipperB2);

    void flipperP1.offsetHeight;

    // Flip face-up immediately with snappy audio
    AudioEngine.playFlip();
    flipperP1.classList.add('flipped');
    flipperP2.classList.add('flipped');
    flipperB1.classList.add('flipped');
    flipperB2.classList.add('flipped');

    // Update count immediately as cards flip face-up
    runningCount += (pHand[0].count + pHand[1].count + bHand[0].count + bHand[1].count);
    renderRunningCount();

    let pScore = calcTotal(pHand);
    let bScore = calcTotal(bHand);
    elPlayerBadge.style.display = 'block';
    elBankerBadge.style.display = 'block';
    elPlayerBadge.textContent = pScore;
    elBankerBadge.textContent = bScore;

    await sleep(650);

    // Natural 8 or 9 Check
    if (pScore >= 8 || bScore >= 8) {
      elStatusBanner.textContent = `NATURAL! (${pScore} - ${bScore})`;
      await sleep(500);
      concludeHand(pHand, bHand);
      return;
    }

    // Step 7: Player 3rd Card Rule
    let playerThird = null;
    if (pScore <= 5) {
      elStatusBanner.textContent = 'PLAYER DRAWS 3RD CARD...';
      await sleep(250);
      playerThird = drawCard();
      pHand.push(playerThird);

      AudioEngine.playCardSlide();
      const p3Flipper = createCardFlipper(playerThird, true);
      slots.p3.appendChild(p3Flipper);

      void p3Flipper.offsetHeight;
      await sleep(250);

      AudioEngine.playFlip();
      p3Flipper.classList.add('flipped');

      runningCount += playerThird.count;
      renderRunningCount();

      pScore = calcTotal(pHand);
      elPlayerBadge.textContent = pScore;
      await sleep(550);
    }

    // Step 8: Banker 3rd Card Rule
    let bankerDraws = false;
    if (!playerThird) {
      if (bScore <= 5) bankerDraws = true;
    } else {
      const p3Val = playerThird.val;
      if (bScore <= 2) bankerDraws = true;
      else if (bScore === 3) bankerDraws = (p3Val !== 8);
      else if (bScore === 4) bankerDraws = (p3Val >= 2 && p3Val <= 7);
      else if (bScore === 5) bankerDraws = (p3Val >= 4 && p3Val <= 7);
      else if (bScore === 6) bankerDraws = (p3Val === 6 || p3Val === 7);
      else bankerDraws = false;
    }

    if (bankerDraws) {
      elStatusBanner.textContent = 'BANKER DRAWS 3RD CARD...';
      await sleep(250);
      const bankerThird = drawCard();
      bHand.push(bankerThird);

      AudioEngine.playCardSlide();
      const b3Flipper = createCardFlipper(bankerThird, true);
      slots.b3.appendChild(b3Flipper);

      void b3Flipper.offsetHeight;
      await sleep(250);

      AudioEngine.playFlip();
      b3Flipper.classList.add('flipped');

      runningCount += bankerThird.count;
      renderRunningCount();

      bScore = calcTotal(bHand);
      elBankerBadge.textContent = bScore;
      await sleep(550);
    }

    concludeHand(pHand, bHand);
  });

  // Hand Conclusion
  async function concludeHand(pHand, bHand) {
    const pScore = calcTotal(pHand);
    const bScore = calcTotal(bHand);

    recordHistory(pScore, bScore);

    let roundReturn = 0;
    const isTie = (pScore === bScore);
    const pWin = (pScore > bScore);
    const bWin = (bScore > pScore);

    let outcomeText = '';

    if (!isTie) {
      if (pWin) {
        slots.p1.classList.add('winning-slide');
        slots.p2.classList.add('winning-slide');
      } else if (bWin) {
        slots.b1.classList.add('winning-slide');
        slots.b2.classList.add('winning-slide');
      }
      await sleep(800);
    } else {
      await sleep(250);
    }

    if (isTie) {
      outcomeText = 'TIE';
      if (bets.tie > 0) roundReturn += (bets.tie * 8) + bets.tie;
      roundReturn += bets.player + bets.banker;
    } else if (pWin) {
      outcomeText = 'PLAYER WINS';
      if (bets.player > 0) roundReturn += bets.player * 2;
    } else if (bWin) {
      outcomeText = 'BANKER WINS';
      if (bets.banker > 0) roundReturn += bets.banker + (bets.banker * 0.95);
    }

    winnerDropBanner.textContent = outcomeText;
    winnerDropBanner.classList.add('dropped');

    bankroll += roundReturn;
    const totalWager = bets.player + bets.tie + bets.banker;
    const net = roundReturn - totalWager;

    if (net > 0) {
      AudioEngine.playWin();
      elStatusBanner.textContent = `${outcomeText} | WON +$${net.toFixed(0)}`;
    } else {
      elStatusBanner.textContent = outcomeText;
    }

    await sleep(2000);

    winnerDropBanner.classList.remove('dropped');

    // Swipe all dealt cards to the left
    Object.values(slots).forEach(slot => {
      if (slot.children.length > 0) {
        slot.classList.remove('winning-slide');
        slot.classList.add('discard-left');
      }
    });

    await sleep(700);

    Object.values(slots).forEach(slot => {
      slot.innerHTML = '';
      slot.className = 'card-slot';
    });
    slots.p3.classList.add('slot-outer-player');
    slots.b3.classList.add('slot-outer-banker');

    elPlayerBadge.style.display = 'none';
    elBankerBadge.style.display = 'none';

    bets = { player: 0, tie: 0, banker: 0 };
    updateUI();

    setGamePhase('betting');

    isDealing = false;
    btnClear.disabled = false;
  }

  // Initial Launch
  perform4SecondShuffle();
})();
