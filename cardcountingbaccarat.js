/* ========================================================
   CLICK SYNC GAMES - CASINO BACCARAT ENGINE
   - Immediate Face-Up Flip upon reaching designated areas
   - Winning Hand 2 original cards slowly slide 8% downward
   - 1-second delay before winner display is presented
   - Winner Drop Banner positioned cleanly below dealt cards
   - Board Clear: ALL dealt cards slide off-screen to the left
   - Ambience removed; interactive procedural audio intact
   - Dynamic Max Bet Enforcement (Player 500, Banker 500, Tie 100)
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

  const MAX_BETS = { player: 500, banker: 500, tie: 100 };

  // 8-Deck Shoe Setup
  const TOTAL_DECKS = 8;
  let shoe = [];
  const suits = ['♠', '♥', '♦', '♣'];
  const ranks = [
    { rank: 'A', val: 1 },
    { rank: '2', val: 2 },
    { rank: '3', val: 3 },
    { rank: '4', val: 4 },
    { rank: '5', val: 5 },
    { rank: '6', val: 6 },
    { rank: '7', val: 7 },
    { rank: '8', val: 8 },
    { rank: '9', val: 9 },
    { rank: '10', val: 0 },
    { rank: 'J', val: 0 },
    { rank: 'Q', val: 0 },
    { rank: 'K', val: 0 }
  ];

  // DOM Elements
  const elBankroll = document.getElementById('bankroll-display');
  const elTotalWager = document.getElementById('total-wager-amount');
  const elStatusBanner = document.getElementById('game-status-banner');
  const winnerDropBanner = document.getElementById('winner-drop-banner');
  const tableFelt = document.getElementById('table-felt');
  const cardShoe = document.getElementById('card-shoe');

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
  const elHistoryGrid = document.getElementById('history-grid');

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

  // Synthesized Web Audio (Interactive noises only, no ambient background)
  const AudioEngine = {
    ctx: null,
    init() {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) this.ctx = new AudioCtx();
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    },
    playChip() {
      if (!soundEnabled || !this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(950, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1600, this.ctx.currentTime + 0.03);
      gain.gain.setValueAtTime(0.18, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.04);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.04);
    },
    playCardSlide() {
      if (!soundEnabled || !this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(280, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(120, this.ctx.currentTime + 0.06);
      gain.gain.setValueAtTime(0.14, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.07);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.07);
    },
    playFlip() {
      if (!soundEnabled || !this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(450, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(800, this.ctx.currentTime + 0.04);
      gain.gain.setValueAtTime(0.14, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.05);
    },
    playShuffle() {
      if (!soundEnabled || !this.ctx) return;
      const now = this.ctx.currentTime;
      for (let i = 0; i < 26; i++) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 170 + Math.random() * 240;
        const t = now + (i * 0.15);
        gain.gain.setValueAtTime(0.05, t);
        gain.gain.linearRampToValueAtTime(0.001, t + 0.05);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.05);
      }
    },
    playWin() {
      if (!soundEnabled || !this.ctx) return;
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const t = this.ctx.currentTime + idx * 0.08;
        gain.gain.setValueAtTime(0.12, t);
        gain.gain.linearRampToValueAtTime(0.001, t + 0.28);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.28);
      });
    }
  };

  // 4-Second Animated Shuffle
  async function perform4SecondShuffle() {
    isDealing = true;
    btnDeal.disabled = true;
    btnClear.disabled = true;

    AudioEngine.init();
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
            isRed: suit === '♥' || suit === '♦'
          });
        }
      }
    }

    for (let i = shoe.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shoe[i], shoe[j]] = [shoe[j], shoe[i]];
    }

    const burn = shoe.pop();
    const count = burn.val === 0 ? 10 : burn.val;
    for (let b = 0; b < count; b++) {
      if (shoe.length > 0) shoe.pop();
    }

    isDealing = false;
    updateUI();
    elStatusBanner.textContent = '8-Deck Shoe loaded. Place your bets.';
  }

  function drawCard() {
    if (shoe.length < 15) perform4SecondShuffle();
    AudioEngine.playCardSlide();
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

  function addHistory(pScore, bScore) {
    const row = document.createElement('div');
    row.className = 'hist-row';
    row.innerHTML = `<span>${pScore}</span><span>${bScore}</span>`;
    elHistoryGrid.insertBefore(row, elHistoryGrid.firstChild);
    if (elHistoryGrid.children.length > 5) {
      elHistoryGrid.removeChild(elHistoryGrid.lastChild);
    }
  }

  chipButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      AudioEngine.init();
      AudioEngine.playChip();
      chipButtons.forEach(b => b.classList.remove('active-chip'));
      btn.classList.add('active-chip');
      activeChipValue = parseInt(btn.getAttribute('data-amount'), 10);
    });
  });

  // Betting Spots Interaction with Dynamic Max Bet Warnings
  Object.keys(spots).forEach(t => {
    spots[t].addEventListener('click', () => {
      if (isDealing || isPaused) return;
      AudioEngine.init();

      if (bets[t] + activeChipValue > MAX_BETS[t]) {
        elStatusBanner.textContent = `MAX BET FOR ${t.toUpperCase()} IS $${MAX_BETS[t]}`;
        return;
      }

      if (bankroll < activeChipValue) {
        elStatusBanner.textContent = 'INSUFFICIENT BANKROLL';
        return;
      }

      bankroll -= activeChipValue;
      bets[t] += activeChipValue;
      AudioEngine.playChip();
      updateUI();
    });
  });

  btnClear.addEventListener('click', () => {
    if (isDealing || isPaused) return;
    AudioEngine.init();
    const totalWager = bets.player + bets.tie + bets.banker;
    if (totalWager === 0) return;

    bankroll += totalWager;
    bets = { player: 0, tie: 0, banker: 0 };
    AudioEngine.playChip();
    updateUI();
    elStatusBanner.textContent = 'BETS CLEARED';
  });

  btnSound.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
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

    AudioEngine.init();
    isDealing = true;
    btnDeal.disabled = true;
    btnClear.disabled = true;

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

    const shoeX = shoeRect.left - feltRect.left + 10;
    const shoeY = shoeRect.top - feltRect.top + 20;

    function spawnStagingCard(card, offsetX, offsetY, rot) {
      const flipper = createCardFlipper(card);
      flipper.style.position = 'absolute';
      flipper.style.width = `${slots.p1.offsetWidth || 62}px`;
      flipper.style.height = `${slots.p1.offsetHeight || 92}px`;
      flipper.style.left = `${shoeX - 110 + offsetX}px`;
      flipper.style.top = `${shoeY + offsetY}px`;
      flipper.style.transform = `rotate(${rot}deg)`;
      flipper.style.zIndex = '35';
      flipper.style.transition = 'all 0.45s ease';
      tableFelt.appendChild(flipper);
      return flipper;
    }

    // Step 1: Draw card 1 (Player) - angle to left of shoe
    await sleep(300);
    pHand.push(drawCard());
    const c1 = spawnStagingCard(pHand[0], 0, 0, -8);

    // Step 2: Draw card 2 (Banker) - directly beneath
    await sleep(300);
    bHand.push(drawCard());
    const c2 = spawnStagingCard(bHand[0], 0, 100, 4);

    // Step 3: Draw card 3 (Player) - overlaps card 1
    await sleep(300);
    pHand.push(drawCard());
    const c3 = spawnStagingCard(pHand[1], 25, 0, -8);

    // Step 4: Draw card 4 (Banker) - overlaps card 2
    await sleep(300);
    bHand.push(drawCard());
    const c4 = spawnStagingCard(bHand[1], 25, 100, 4);

    await sleep(400);

    // Step 5: Both pairs glide smoothly left across the felt to Player & Banker spots
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

    await sleep(450);

    // Clean up staging cards and snap directly into slot DOM
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

    // Immediately flip face-up once positioned in designated areas
    AudioEngine.playFlip();
    flipperP1.classList.add('flipped');
    flipperP2.classList.add('flipped');
    flipperB1.classList.add('flipped');
    flipperB2.classList.add('flipped');

    let pScore = calcTotal(pHand);
    let bScore = calcTotal(bHand);
    elPlayerBadge.style.display = 'block';
    elBankerBadge.style.display = 'block';
    elPlayerBadge.textContent = pScore;
    elBankerBadge.textContent = bScore;

    await sleep(700);

    // Natural 8 or 9 Check
    if (pScore >= 8 || bScore >= 8) {
      elStatusBanner.textContent = `NATURAL! (${pScore} - ${bScore})`;
      await sleep(500);
      concludeHand(pHand, bHand);
      return;
    }

    // Step 7: Player 3rd Card Rule (0-5 draws, 6-7 stands) - Non-overlapping perpendicular slot
    let playerThird = null;
    if (pScore <= 5) {
      elStatusBanner.textContent = 'PLAYER DRAWS 3RD CARD...';
      await sleep(400);
      playerThird = drawCard();
      pHand.push(playerThird);

      const p3Flipper = createCardFlipper(playerThird, true);
      slots.p3.appendChild(p3Flipper);

      await sleep(500);
      AudioEngine.playFlip();
      p3Flipper.classList.add('flipped');

      pScore = calcTotal(pHand);
      elPlayerBadge.textContent = pScore;
      await sleep(650);
    }

    // Step 8: Banker 3rd Card Rule (Tableau) - Non-overlapping perpendicular slot
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
      await sleep(400);
      const bankerThird = drawCard();
      bHand.push(bankerThird);

      const b3Flipper = createCardFlipper(bankerThird, true);
      slots.b3.appendChild(b3Flipper);

      await sleep(500);
      AudioEngine.playFlip();
      b3Flipper.classList.add('flipped');

      bScore = calcTotal(bHand);
      elBankerBadge.textContent = bScore;
      await sleep(650);
    }

    concludeHand(pHand, bHand);
  });

  // Hand Conclusion: 8% Downward Slide for Winners -> 1s Delay -> Outcome Drop (Below Cards) -> Board Discard to Left
  async function concludeHand(pHand, bHand) {
    const pScore = calcTotal(pHand);
    const bScore = calcTotal(bHand);

    addHistory(pScore, bScore);

    let roundReturn = 0;
    const isTie = (pScore === bScore);
    const pWin = (pScore > bScore);
    const bWin = (bScore > pScore);

    let outcomeText = '';

    // If player or banker wins, slide the 2 original cards slowly 8% downward
    // If there is a tie, no cards move downward
    if (!isTie) {
      if (pWin) {
        slots.p1.classList.add('winning-slide');
        slots.p2.classList.add('winning-slide');
      } else if (bWin) {
        slots.b1.classList.add('winning-slide');
        slots.b2.classList.add('winning-slide');
      }
      // Exactly 1 second delay before displaying who won
      await sleep(1000);
    } else {
      await sleep(300);
    }

    // Set payouts and outcome label
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

    // Drop the centered outcome banner (positioned at top: 54% to clear cards)
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

    // Hold outcome on screen for 2.2 seconds before transition
    await sleep(2200);

    // Retract outcome banner
    winnerDropBanner.classList.remove('dropped');

    // Remove ALL dealt cards to the left direction (shoe stack remains untouched)
    Object.values(slots).forEach(slot => {
      if (slot.children.length > 0) {
        slot.classList.remove('winning-slide');
        slot.classList.add('discard-left');
      }
    });

    // Allow swipe-left animation to finish completely
    await sleep(800);

    // Clear dealt card slots
    Object.values(slots).forEach(slot => {
      slot.innerHTML = '';
      slot.className = 'card-slot';
    });
    slots.p3.classList.add('slot-outer-player');
    slots.b3.classList.add('slot-outer-banker');

    elPlayerBadge.style.display = 'none';
    elBankerBadge.style.display = 'none';

    // Reset bets and table for next hand
    bets = { player: 0, tie: 0, banker: 0 };
    updateUI();

    isDealing = false;
    btnClear.disabled = false;
  }

  // Initial Launch
  perform4SecondShuffle();
})();
