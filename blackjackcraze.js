/**
 * Blackjack Craze Engine
 * Click Sync Games - 6-Deck Hi-Lo Shoe Engine with Dynamic Viewport,
 * Bottom Chip Win Animations, Insurance/Even Money, Peek Logic, Single-Split,
 * Variable Double Down (up to hand bet, post-split DDAS on 2 cards),
 * Clean On-Screen Discard Tray, and Game Over Out-of-Funds System.
 */

const SUITS = [
  { name: 'spades', symbol: '♠', color: 'black' },
  { name: 'hearts', symbol: '♥', color: 'red' },
  { name: 'diamonds', symbol: '♦', color: 'red' },
  { name: 'clubs', symbol: '♣', color: 'black' }
];

const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

// 1. Audio Synthesizer
let audioCtx = null;
let isMuted = false;

function initAudioContext() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) audioCtx = new AudioContext();
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

function playButtonSound() {
  if (isMuted || !audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(640, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(320, audioCtx.currentTime + 0.05);
  gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
  gain.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.05);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.05);
}

function playCardDealSound() {
  if (isMuted || !audioCtx) return;
  const now = audioCtx.currentTime;
  const bufferSize = audioCtx.sampleRate * 0.08;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

  const noise = audioCtx.createBufferSource();
  noise.buffer = buffer;
  const filter = audioCtx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(1200, now);
  filter.Q.setValueAtTime(2.5, now);

  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.15, now);
  gain.gain.exponentialRampToValueAtTime(0.01, now + 0.07);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(audioCtx.destination);
  noise.start(now);
}

function playChipSound() {
  if (isMuted || !audioCtx) return;
  const now = audioCtx.currentTime;
  [1150, 1750].forEach((freq, idx) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now + idx * 0.03);
    gain.gain.setValueAtTime(0.14, now + idx * 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.03 + 0.09);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now + idx * 0.03);
    osc.stop(now + idx * 0.03 + 0.09);
  });
}

function playShuffleSound() {
  if (isMuted || !audioCtx) return;
  const now = audioCtx.currentTime;
  for (let i = 0; i < 14; i++) {
    const t = now + i * 0.065;
    const bufferSize = audioCtx.sampleRate * 0.04;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let j = 0; j < bufferSize; j++) data[j] = Math.random() * 2 - 1;

    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(800 + (i % 3) * 260, t);
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.04);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);
    noise.start(t);
  }
}

// 2. Responsive Table Resizing
function adjustTableScale() {
  const container = document.querySelector('.table-container');
  const scaler = document.getElementById('table-scale-root');
  if (!container || !scaler) return;

  const baseW = 1000;
  const baseH = 650;
  const availableW = container.clientWidth;
  const availableH = container.clientHeight;

  const scale = Math.min(availableW / baseW, availableH / baseH);
  scaler.style.transform = `scale(${scale})`;
}

window.addEventListener('resize', adjustTableScale);
window.addEventListener('orientationchange', () => setTimeout(adjustTableScale, 150));

// 3. Game State
let shoe = [];
let cutCardIndex = -1;
let cutCardReached = false;
let runningCount = 0;
let roundCounter = 0;
let bankroll = 1000;
let currentBet = 0;

let dealerCards = [];
let dealerHoleRevealed = false;
let playerHands = [];
let currentHandIdx = 0;
let roundSettling = false;
let discardCount = 0;
let hasSplit = false;
let insuranceBet = 0;

// DOM Selectors
const introScreen = document.getElementById('intro-screen');
const shoeCountEl = document.getElementById('shoe-count');
const runningCountEl = document.getElementById('running-count');
const trueCountEl = document.getElementById('true-count');
const countDrawer = document.getElementById('count-drawer');
const countToggleBtn = document.getElementById('count-toggle-btn');
const bankrollEl = document.getElementById('bankroll');
const currentBetEl = document.getElementById('current-bet');
const gameStatusEl = document.getElementById('game-status');
const dealerScoreEl = document.getElementById('dealer-score');
const dealerCardsEl = document.getElementById('dealer-cards');
const playerHandsContainerEl = document.getElementById('player-hands-container');
const playerScoreEl = document.getElementById('player-score');
const dealingShoeEl = document.getElementById('dealing-shoe');
const discardStackEl = document.getElementById('discard-stack');
const burnCardContainer = document.getElementById('burn-card-container');

// Bet Circles
const betCircle0 = document.getElementById('bet-circle');
const betBox1 = document.getElementById('bet-box-1');
const betCircleSplit = document.getElementById('bet-circle-split');
const placedChipsStack0 = document.getElementById('placed-chips-stack');
const payoutChipsStack0 = document.getElementById('payout-chips-stack');
const placedChipsStackSplit = document.getElementById('placed-chips-stack-split');
const payoutChipsStackSplit = document.getElementById('payout-chips-stack-split');

// Action Panels
const bettingPanel = document.getElementById('betting-panel');
const actionPanel = document.getElementById('action-panel');
const dealBtn = document.getElementById('deal-btn');
const hitBtn = document.getElementById('hit-btn');
const standBtn = document.getElementById('stand-btn');
const doubleBtn = document.getElementById('double-btn');
const splitBtn = document.getElementById('split-btn');
const clearBetBtn = document.getElementById('clear-bet-btn');

// Modals
const doubleModal = document.getElementById('double-modal');
const doubleRange = document.getElementById('double-range');
const doubleWagerDisplay = document.getElementById('double-wager-display');
const maxDoubleVal = document.getElementById('max-double-val');
const confirmDoubleBtn = document.getElementById('confirm-double-btn');
const cancelDoubleBtn = document.getElementById('cancel-double-btn');

const insuranceModal = document.getElementById('insurance-modal');
const insuranceRange = document.getElementById('insurance-range');
const insuranceWagerDisplay = document.getElementById('insurance-wager-display');
const maxInsuranceVal = document.getElementById('max-insurance-val');
const acceptInsuranceBtn = document.getElementById('accept-insurance-btn');
const declineInsuranceBtn = document.getElementById('decline-insurance-btn');

const evenMoneyModal = document.getElementById('even-money-modal');
const acceptEvenMoneyBtn = document.getElementById('accept-even-money-btn');
const declineEvenMoneyBtn = document.getElementById('decline-even-money-btn');

const gameOverModal = document.getElementById('game-over-modal');
const restartGameBtn = document.getElementById('restart-game-btn');

const cutShoeModal = document.getElementById('cut-shoe-modal');
const shoeCutSpread = document.getElementById('shoe-cut-spread');
const shuffleOverlay = document.getElementById('shuffle-overlay');
const rulesModal = document.getElementById('rules-modal');
const historyModal = document.getElementById('history-modal');
const rulesBtn = document.getElementById('rules-btn');
const historyBtn = document.getElementById('history-btn');
const historyList = document.getElementById('history-list');

const muteToggleBtn = document.getElementById('mute-toggle-btn');
const speakerOnIcon = document.getElementById('speaker-on-icon');
const speakerOffIcon = document.getElementById('speaker-off-icon');

// 4. Shoe Generation
function buildRawSixDeckShoe() {
  const newShoe = [];
  for (let deck = 0; deck < 6; deck++) {
    for (const suit of SUITS) {
      for (const val of VALUES) {
        newShoe.push({
          suit: suit.symbol,
          color: suit.color,
          value: val,
          pointValue: getCardPointValue(val),
          countVal: getHiLoValue(val)
        });
      }
    }
  }
  for (let i = newShoe.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newShoe[i], newShoe[j]] = [newShoe[j], newShoe[i]];
  }
  return newShoe;
}

function getCardPointValue(rank) {
  if (['10', 'J', 'Q', 'K'].includes(rank)) return 10;
  if (rank === 'A') return 11;
  return parseInt(rank, 10);
}

function getHiLoValue(rank) {
  if (['2', '3', '4', '5', '6'].includes(rank)) return 1;
  if (['7', '8', '9'].includes(rank)) return 0;
  return -1;
}

function triggerShuffle() {
  playShuffleSound();
  shuffleOverlay.classList.remove('hidden');
  discardStackEl.innerHTML = '';
  discardCount = 0;
  setTimeout(() => {
    shoe = buildRawSixDeckShoe();
    runningCount = 0;
    cutCardReached = false;
    updateCounts();
    shuffleOverlay.classList.add('hidden');
    openCutCardModal();
  }, 1600);
}

function openCutCardModal() {
  cutShoeModal.classList.remove('hidden');
  shoeCutSpread.innerHTML = '<div id="cut-guide-line" class="cut-guide-line"></div>';

  const count = 48;
  for (let i = 0; i < count; i++) {
    const cardEl = document.createElement('div');
    cardEl.className = 'cut-card-strip';
    cardEl.style.left = `${(i / count) * 94 + 2}%`;
    cardEl.style.transform = `rotate(${(i % 5) - 2}deg)`;
    shoeCutSpread.appendChild(cardEl);
  }

  const guide = document.getElementById('cut-guide-line');
  shoeCutSpread.onmousemove = (e) => {
    const rect = shoeCutSpread.getBoundingClientRect();
    const x = e.clientX - rect.left;
    guide.style.display = 'block';
    guide.style.left = `${x}px`;
  };

  shoeCutSpread.onmouseleave = () => {
    guide.style.display = 'none';
  };

  shoeCutSpread.onclick = (e) => {
    const rect = shoeCutSpread.getBoundingClientRect();
    const ratio = Math.max(0.1, Math.min(0.9, (e.clientX - rect.left) / rect.width));
    executeShoeCut(ratio);
  };
}

function executeShoeCut(ratio) {
  playButtonSound();
  playCardDealSound();
  cutShoeModal.classList.add('hidden');

  const cutIndex = Math.floor(shoe.length * ratio);
  const frontPortion = shoe.splice(0, cutIndex);
  shoe = shoe.concat(frontPortion);
  cutCardIndex = Math.floor(shoe.length * 0.10);

  executeBurnCard();
}

function executeBurnCard() {
  const burnCard = shoe.pop();
  runningCount += burnCard.countVal;
  updateCounts();

  gameStatusEl.textContent = 'Burn card';

  const shoeRect = dealingShoeEl.getBoundingClientRect();
  const discardTrayEl = document.getElementById('discard-tray');
  const discardRect = discardTrayEl.getBoundingClientRect();

  burnCardContainer.innerHTML = '';
  burnCardContainer.classList.remove('hidden');

  const cardEl = createCardElement(burnCard, false);
  burnCardContainer.appendChild(cardEl);

  burnCardContainer.style.transition = 'none';
  burnCardContainer.style.transform = `translate(${shoeRect.left}px, ${shoeRect.top}px) scale(0.9)`;
  burnCardContainer.style.opacity = '1';
  burnCardContainer.offsetHeight;

  playCardDealSound();

  burnCardContainer.style.transition = 'transform 4s cubic-bezier(0.2, 0.8, 0.25, 1), opacity 4s ease';
  burnCardContainer.style.transform = `translate(${discardRect.left + 10}px, ${discardRect.top + 10}px) scale(0.7) rotate(0deg)`;

  setTimeout(() => {
    burnCardContainer.classList.add('hidden');
    burnCardContainer.innerHTML = '';
    addFaceDownToDiscardTray();
    gameStatusEl.textContent = 'Place your chips in the circle to bet.';
  }, 4050);
}

// Discard Tray Card Stacking - Strictly centered on screen with bounded offset
function addFaceDownToDiscardTray() {
  discardCount++;
  const card = document.createElement('div');
  card.className = 'discard-card-item';
  const stackOffset = Math.min(discardCount, 16) * 1.2;
  card.style.transform = `translateY(-${stackOffset}px)`;
  discardStackEl.appendChild(card);
}

function updateCounts() {
  shoeCountEl.textContent = shoe.length;
  runningCountEl.textContent = runningCount;
  const remainingDecks = Math.max(shoe.length / 52, 0.5);
  trueCountEl.textContent = (runningCount / remainingDecks).toFixed(1);
}

function drawCard(recordCount = true) {
  if (shoe.length <= cutCardIndex && !cutCardReached) {
    cutCardReached = true;
    gameStatusEl.textContent = 'Cut card reached! Final round before shuffle.';
  }

  const card = shoe.pop();
  if (recordCount) runningCount += card.countVal;
  playCardDealSound();
  updateCounts();
  return card;
}

// 5. Chips Breakdown & Stacking
function breakDownBet(amount) {
  let remaining = Math.floor(amount);
  const chipValues = [100, 25, 10, 5, 1];
  const stack = [];
  chipValues.forEach(val => {
    while (remaining >= val && stack.length < 8) {
      stack.push(val);
      remaining -= val;
    }
  });
  return stack;
}

function renderStackInContainer(stack, container) {
  const chipColors = { 100: '#1a1a1a', 25: '#1e743a', 10: '#cc5200', 5: '#b82323', 1: '#ecd42e' };
  container.innerHTML = '';
  stack.forEach((val, idx) => {
    const chip = document.createElement('div');
    chip.className = 'chip-in-ring';
    chip.dataset.val = val;
    chip.style.backgroundColor = chipColors[val];
    chip.style.color = (val === 1) ? '#222' : '#fff';
    chip.style.border = '2px dashed #fff';
    chip.textContent = `$${val}`;
    chip.style.transform = `translateY(-${idx * 3}px) rotate(${idx * 6}deg)`;
    container.appendChild(chip);
  });
}

function renderBetCircleChips() {
  placedChipsStack0.innerHTML = '';
  payoutChipsStack0.innerHTML = '';
  payoutChipsStack0.classList.add('hidden');
  placedChipsStack0.style.transform = 'none';
  placedChipsStack0.style.opacity = '1';

  if (currentBet <= 0) {
    betCircle0.classList.add('pulse-halo');
    return;
  }
  betCircle0.classList.remove('pulse-halo');

  const stack = breakDownBet(currentBet);
  renderStackInContainer(stack, placedChipsStack0);
}

function renderSplitCircleChips(amount) {
  betBox1.classList.remove('hidden');
  placedChipsStackSplit.innerHTML = '';
  payoutChipsStackSplit.innerHTML = '';
  payoutChipsStackSplit.classList.add('hidden');
  placedChipsStackSplit.style.transform = 'none';
  placedChipsStackSplit.style.opacity = '1';

  const stack = breakDownBet(amount);
  renderStackInContainer(stack, placedChipsStackSplit);
}

// 6. Card Rendering
function createCardElement(card, isFacedDown = false) {
  const wrapper = document.createElement('div');
  wrapper.className = `card-wrapper ${isFacedDown ? '' : 'flipped'}`;

  wrapper.innerHTML = `
    <div class="card-inner">
      <div class="card-face card-back"></div>
      <div class="card-face card-front ${card.color}">
        <div class="card-corner top">
          <span>${card.value}</span>
          <span>${card.suit}</span>
        </div>
        <div class="card-center">${card.suit}</div>
        <div class="card-corner bottom">
          <span>${card.value}</span>
          <span>${card.suit}</span>
        </div>
      </div>
    </div>
  `;
  return wrapper;
}

function calculateHandValue(cards) {
  let score = 0;
  let aces = 0;
  for (const c of cards) {
    if (c.value === 'A') {
      aces += 1;
      score += 11;
    } else {
      score += c.pointValue;
    }
  }
  while (score > 21 && aces > 0) {
    score -= 10;
    aces -= 1;
  }
  return { score, isSoft: (aces > 0 && score <= 21) };
}

function renderDealerCards() {
  dealerCardsEl.innerHTML = '';
  dealerCards.forEach((c, idx) => {
    const isHiddenHole = (idx === 1 && !dealerHoleRevealed);
    dealerCardsEl.appendChild(createCardElement(c, isHiddenHole));
  });

  if (!dealerHoleRevealed && dealerCards.length > 0) {
    dealerScoreEl.textContent = `${calculateHandValue([dealerCards[0]]).score} + ?`;
  } else {
    dealerScoreEl.textContent = calculateHandValue(dealerCards).score;
  }
}

function renderPlayerHands() {
  playerHandsContainerEl.innerHTML = '';
  playerHands.forEach((hand, idx) => {
    const handBox = document.createElement('div');
    handBox.className = `hand-box ${idx === currentHandIdx ? 'active-hand' : ''}`;

    const cardRow = document.createElement('div');
    cardRow.className = 'cards-holder';
    hand.cards.forEach(card => cardRow.appendChild(createCardElement(card, false)));

    const calc = calculateHandValue(hand.cards);
    const sub = document.createElement('div');
    sub.className = 'hand-subtext';
    sub.textContent = `Hand ${idx + 1} ($${hand.bet}) - Score: ${calc.score}`;

    handBox.appendChild(cardRow);
    handBox.appendChild(sub);
    playerHandsContainerEl.appendChild(handBox);
  });
  updatePlayerScoresDisplay();
}

function updatePlayerScoresDisplay() {
  if (playerHands[currentHandIdx]) {
    playerScoreEl.textContent = calculateHandValue(playerHands[currentHandIdx].cards).score;
  }
}

// 7. Deal & Round Logic
function startRound() {
  initAudioContext();
  playButtonSound();

  if (roundSettling) return;
  if (bankroll < 1) {
    triggerGameOver();
    return;
  }
  if (currentBet <= 0) {
    gameStatusEl.textContent = 'Place chips in the circle to bet!';
    return;
  }
  if (currentBet > bankroll) {
    gameStatusEl.textContent = 'Insufficient bankroll!';
    return;
  }

  betCircle0.classList.add('dimmed');
  gameStatusEl.textContent = '';
  hasSplit = false;
  insuranceBet = 0;
  betBox1.classList.add('hidden');

  bankroll -= currentBet;
  bankrollEl.textContent = `$${bankroll}`;

  dealerCards = [];
  dealerHoleRevealed = false;
  playerHands = [{
    cards: [],
    bet: currentBet,
    originalBet: currentBet,
    status: 'playing',
    isDoubled: false,
    isSplitAce: false
  }];
  currentHandIdx = 0;

  bettingPanel.classList.add('hidden');
  actionPanel.classList.remove('hidden');
  dealerCardsEl.innerHTML = '';
  playerHandsContainerEl.innerHTML = '';

  setTimeout(() => {
    playerHands[0].cards.push(drawCard(true));
    renderPlayerHands();

    setTimeout(() => {
      dealerCards.push(drawCard(true));
      renderDealerCards();

      setTimeout(() => {
        playerHands[0].cards.push(drawCard(true));
        renderPlayerHands();

        setTimeout(() => {
          dealerCards.push(drawCard(false));
          renderDealerCards();
          evaluateInitialDeal();
        }, 320);
      }, 320);
    }, 320);
  }, 320);
}

function evaluateInitialDeal() {
  const pScore = calculateHandValue(playerHands[0].cards).score;
  const isPlayerBJ = (pScore === 21 && playerHands[0].cards.length === 2);
  const dUpCard = dealerCards[0];
  const dHoleCard = dealerCards[1];

  // Case 1: Dealer Upcard has a 10 value (10, J, Q, K)
  if (dUpCard.pointValue === 10) {
    if (dHoleCard.value === 'A') {
      gameStatusEl.textContent = 'Dealer has Blackjack!';
      setTimeout(() => {
        resolveDealerTurn();
      }, 600);
      return;
    }
    checkPlayerInitialBlackjack(isPlayerBJ);
    return;
  }

  // Case 2: Dealer Upcard is an Ace
  if (dUpCard.value === 'A') {
    if (isPlayerBJ) {
      openEvenMoneyModal();
      return;
    } else {
      if (bankroll >= 1) {
        openInsuranceModal();
        return;
      }
    }
  }

  checkPlayerInitialBlackjack(isPlayerBJ);
}

function openEvenMoneyModal() {
  evenMoneyModal.classList.remove('hidden');
}

acceptEvenMoneyBtn.onclick = () => {
  initAudioContext();
  playButtonSound();
  evenMoneyModal.classList.add('hidden');
  gameStatusEl.textContent = 'Even Money Accepted (1:1 Payout).';

  bankroll += playerHands[0].bet * 2;
  bankrollEl.textContent = `$${bankroll}`;
  playerHands[0].status = 'even_money';

  dealerHoleRevealed = true;
  runningCount += dealerCards[1].countVal;
  updateCounts();
  renderDealerCards();

  setTimeout(() => {
    finishRoundWithEvenMoney();
  }, 1000);
};

declineEvenMoneyBtn.onclick = () => {
  initAudioContext();
  playButtonSound();
  evenMoneyModal.classList.add('hidden');
  checkPlayerInitialBlackjack(true);
};

function openInsuranceModal() {
  const maxAllowed = Math.min(Math.floor(playerHands[0].bet / 2), bankroll);
  if (maxAllowed < 1) {
    checkPlayerInitialBlackjack(false);
    return;
  }
  maxInsuranceVal.textContent = maxAllowed;
  insuranceRange.max = maxAllowed;
  insuranceRange.value = maxAllowed;
  insuranceWagerDisplay.textContent = maxAllowed;
  insuranceModal.classList.remove('hidden');
}

insuranceRange.oninput = () => {
  insuranceWagerDisplay.textContent = insuranceRange.value;
};

acceptInsuranceBtn.onclick = () => {
  initAudioContext();
  playButtonSound();
  const wager = parseInt(insuranceRange.value, 10);
  insuranceBet = wager;
  bankroll -= wager;
  bankrollEl.textContent = `$${bankroll}`;
  insuranceModal.classList.add('hidden');

  verifyDealerBlackjackAfterInsurance();
};

declineInsuranceBtn.onclick = () => {
  initAudioContext();
  playButtonSound();
  insuranceBet = 0;
  insuranceModal.classList.add('hidden');
  verifyDealerBlackjackAfterInsurance();
};

function verifyDealerBlackjackAfterInsurance() {
  const dHoleCard = dealerCards[1];
  const dealerHasBJ = (dHoleCard.pointValue === 10);

  if (insuranceBet > 0) {
    if (dealerHasBJ) {
      const payout = insuranceBet * 3;
      bankroll += payout;
      bankrollEl.textContent = `$${bankroll}`;
      gameStatusEl.textContent = `Insurance Won! (+$${insuranceBet * 2})`;
      playChipSound();
    } else {
      gameStatusEl.textContent = 'Insurance Lost.';
    }
  }

  if (dealerHasBJ) {
    setTimeout(() => {
      resolveDealerTurn();
    }, 600);
  } else {
    checkPlayerInitialBlackjack(false);
  }
}

function checkPlayerInitialBlackjack(isPlayerBJ) {
  if (isPlayerBJ) {
    playerHands[0].status = 'blackjack';
    resolveDealerTurn();
    return;
  }

  updateActionButtons();
  updatePlayerScoresDisplay();
}

function updateActionButtons() {
  const currentH = playerHands[currentHandIdx];
  if (!currentH) return;

  // Split eligibility: must have 2 cards of equal point value, bankroll sufficient, and not split before
  const canSplit = (!hasSplit && playerHands.length === 1 && currentH.cards.length === 2 && currentH.cards[0].pointValue === currentH.cards[1].pointValue && bankroll >= currentH.bet);
  splitBtn.classList.toggle('hidden', !canSplit);

  // Doubling eligibility: hand must have strictly 2 cards, bankroll >= 1, and not split-aces
  const canDouble = (currentH.cards.length === 2 && !currentH.isSplitAce && bankroll >= 1);
  doubleBtn.classList.toggle('hidden', !canDouble);
}

// 8. Player Actions
function handleHit() {
  playButtonSound();
  splitBtn.classList.add('hidden');

  const hand = playerHands[currentHandIdx];
  if (hand.isSplitAce) return;

  hand.cards.push(drawCard(true));
  renderPlayerHands();

  // Once hit, card count > 2, so cannot double
  doubleBtn.classList.add('hidden');

  const calc = calculateHandValue(hand.cards);
  if (calc.score >= 21) {
    hand.status = calc.score > 21 ? 'busted' : 'stood';
    advancePlayerHand();
  }
}

function handleStand() {
  playButtonSound();
  playerHands[currentHandIdx].status = 'stood';
  advancePlayerHand();
}

function handleDoublePrompt() {
  playButtonSound();
  const hand = playerHands[currentHandIdx];
  if (hand.cards.length !== 2 || hand.isSplitAce || bankroll < 1) return;

  // Max double is up to that hand's original wager, capped by bankroll
  const maxWager = Math.min(hand.originalBet, bankroll);
  maxDoubleVal.textContent = maxWager;
  doubleRange.min = 1;
  doubleRange.max = maxWager;
  doubleRange.value = maxWager;
  doubleWagerDisplay.textContent = maxWager;
  doubleModal.classList.remove('hidden');
}

doubleRange.oninput = () => {
  doubleWagerDisplay.textContent = doubleRange.value;
};

cancelDoubleBtn.onclick = () => {
  initAudioContext();
  playButtonSound();
  doubleModal.classList.add('hidden');
};

confirmDoubleBtn.onclick = () => {
  initAudioContext();
  playButtonSound();
  doubleModal.classList.add('hidden');

  const addWager = parseInt(doubleRange.value, 10);
  executeDoubleDown(addWager);
};

function executeDoubleDown(addedAmount) {
  const hand = playerHands[currentHandIdx];
  playChipSound();

  bankroll -= addedAmount;
  hand.bet += addedAmount;
  hand.isDoubled = true;
  bankrollEl.textContent = `$${bankroll}`;

  // Reflect bet visually in the active hand's bet circle
  if (currentHandIdx === 0) {
    renderStackInContainer(breakDownBet(hand.bet), placedChipsStack0);
  } else {
    renderStackInContainer(breakDownBet(hand.bet), placedChipsStackSplit);
  }

  hand.cards.push(drawCard(true));
  renderPlayerHands();

  hand.status = calculateHandValue(hand.cards).score > 21 ? 'busted' : 'stood';
  advancePlayerHand();
}

function handleSplit() {
  if (hasSplit) return;
  playButtonSound();
  const hand = playerHands[currentHandIdx];
  if (bankroll < hand.bet) return;

  hasSplit = true;
  playChipSound();
  bankroll -= hand.bet;
  bankrollEl.textContent = `$${bankroll}`;

  const isAceSplit = (hand.cards[0].value === 'A' && hand.cards[1].value === 'A');
  const card2 = hand.cards.pop();
  const newHand = {
    cards: [card2],
    bet: hand.bet,
    originalBet: hand.bet,
    status: 'playing',
    isDoubled: false,
    isSplitAce: isAceSplit
  };

  hand.isSplitAce = isAceSplit;

  // Deal 1 card to each hand
  hand.cards.push(drawCard(true));
  newHand.cards.push(drawCard(true));
  playerHands.push(newHand);

  renderSplitCircleChips(newHand.bet);
  splitBtn.classList.add('hidden');
  renderPlayerHands();

  if (isAceSplit) {
    hand.status = 'stood';
    newHand.status = 'stood';
    setTimeout(() => {
      resolveDealerTurn();
    }, 600);
  } else {
    updateActionButtons();
  }
}

function advancePlayerHand() {
  if (currentHandIdx < playerHands.length - 1) {
    currentHandIdx++;
    renderPlayerHands();
    const currentH = playerHands[currentHandIdx];
    if (currentH.isSplitAce) {
      currentH.status = 'stood';
      advancePlayerHand();
    } else {
      updateActionButtons();
    }
  } else {
    resolveDealerTurn();
  }
}

// 9. Dealer Turn & Settlement
function resolveDealerTurn() {
  actionPanel.classList.add('hidden');

  dealerHoleRevealed = true;
  runningCount += dealerCards[1].countVal;
  updateCounts();
  renderDealerCards();

  const allBusted = playerHands.every(h => h.status === 'busted');
  if (allBusted) {
    finishRound();
    return;
  }

  const dealerInterval = setInterval(() => {
    const dVal = calculateHandValue(dealerCards);
    if (dVal.score < 17 || (dVal.score === 17 && dVal.isSoft)) {
      dealerCards.push(drawCard(true));
      renderDealerCards();
    } else {
      clearInterval(dealerInterval);
      finishRound();
    }
  }, 550);
}

function finishRoundWithEvenMoney() {
  roundSettling = true;
  betCircle0.classList.remove('dimmed');

  const winStack = breakDownBet(playerHands[0].bet);
  renderStackInContainer(winStack, payoutChipsStack0);
  payoutChipsStack0.classList.remove('hidden');

  setTimeout(() => {
    playChipSound();
    animateChipsDownwards([placedChipsStack0, payoutChipsStack0]);
    postHandCleanup(1400);
  }, 1000);
}

function finishRound() {
  roundSettling = true;
  const dVal = calculateHandValue(dealerCards).score;
  let totalWinnings = 0;
  let summary = '';

  playerHands.forEach((hand, idx) => {
    const pVal = calculateHandValue(hand.cards).score;
    let outcome = '';
    let handWin = 0;

    if (hand.status === 'busted') {
      outcome = 'Loss (Bust)';
    } else if (hand.status === 'blackjack') {
      if (dVal === 21 && dealerCards.length === 2) {
        outcome = 'Push';
        handWin = hand.bet;
      } else {
        outcome = 'Blackjack!';
        handWin = hand.bet + (hand.bet * 1.5);
      }
    } else if (dVal > 21 || pVal > dVal) {
      outcome = 'Win';
      handWin = hand.bet * 2;
    } else if (pVal === dVal) {
      outcome = 'Push';
      handWin = hand.bet;
    } else {
      outcome = 'Loss';
    }

    totalWinnings += handWin;
    summary += `Hand ${idx + 1}: ${outcome}. `;
    logRoundHistory(idx + 1, pVal, dVal, outcome);

    // Show winning chips in corresponding bet circle
    if (handWin > hand.bet) {
      const profitStack = breakDownBet(handWin - hand.bet);
      if (idx === 0) {
        renderStackInContainer(profitStack, payoutChipsStack0);
        payoutChipsStack0.classList.remove('hidden');
      } else {
        renderStackInContainer(profitStack, payoutChipsStackSplit);
        payoutChipsStackSplit.classList.remove('hidden');
      }
    }
  });

  bankroll += totalWinnings;
  bankrollEl.textContent = `$${bankroll}`;
  gameStatusEl.textContent = summary;

  setTimeout(() => {
    betCircle0.classList.remove('dimmed');

    if (totalWinnings > 0) {
      playChipSound();
      const stacksToAnimate = [placedChipsStack0, payoutChipsStack0];
      if (hasSplit) {
        stacksToAnimate.push(placedChipsStackSplit, payoutChipsStackSplit);
      }
      animateChipsDownwards(stacksToAnimate);
      postHandCleanup(1400);
    } else {
      playChipSound();
      placedChipsStack0.style.transform = 'translateY(-140px)';
      placedChipsStack0.style.opacity = '0';
      if (hasSplit) {
        placedChipsStackSplit.style.transform = 'translateY(-140px)';
        placedChipsStackSplit.style.opacity = '0';
      }
      postHandCleanup(1400);
    }
  }, 1000);
}

// Winning and original wager chips slide toward the bottom of the screen
function animateChipsDownwards(stackContainers) {
  stackContainers.forEach(container => {
    const chips = container.querySelectorAll('.chip-in-ring');
    chips.forEach(chip => {
      chip.style.transform = 'translateY(220px) scale(0.7)';
      chip.style.opacity = '0';
    });
  });
}

function postHandCleanup(delayMs) {
  setTimeout(() => {
    const allCards = document.querySelectorAll('.card-wrapper');
    allCards.forEach(el => el.classList.add('discarding'));

    setTimeout(() => {
      allCards.forEach(() => addFaceDownToDiscardTray());

      dealerCardsEl.innerHTML = '';
      playerHandsContainerEl.innerHTML = '';
      dealerScoreEl.textContent = '0';
      playerScoreEl.textContent = '0';
      gameStatusEl.textContent = '';

      currentBet = 0;
      currentBetEl.textContent = '0';
      betBox1.classList.add('hidden');
      hasSplit = false;
      renderBetCircleChips();

      roundSettling = false;
      bettingPanel.classList.remove('hidden');

      // Check if player has run out of adequate funds (< $1)
      if (bankroll < 1) {
        triggerGameOver();
        return;
      }

      if (cutCardReached) {
        triggerShuffle();
      }
    }, 700);

  }, delayMs);
}

function triggerGameOver() {
  gameOverModal.classList.remove('hidden');
}

restartGameBtn.onclick = () => {
  window.location.reload();
};

function logRoundHistory(handNum, pVal, dVal, outcome) {
  roundCounter++;
  const row = document.createElement('tr');
  const remainingDecks = Math.max(shoe.length / 52, 0.5);
  row.innerHTML = `
    <td>${roundCounter}</td>
    <td>${pVal}</td>
    <td>${dVal}</td>
    <td>${outcome}</td>
    <td>${runningCount} / ${(runningCount / remainingDecks).toFixed(1)}</td>
  `;
  historyList.prepend(row);
}

// 10. Event Listeners
document.querySelectorAll('.casino-chip').forEach(btn => {
  btn.addEventListener('click', () => {
    initAudioContext();
    playButtonSound();
    playChipSound();

    const val = parseInt(btn.dataset.val, 10);
    if (currentBet + val <= bankroll) {
      currentBet += val;
      currentBetEl.textContent = currentBet;
      renderBetCircleChips();
    }
  });
});

clearBetBtn.addEventListener('click', () => {
  initAudioContext();
  playButtonSound();
  currentBet = 0;
  currentBetEl.textContent = '0';
  renderBetCircleChips();
});

countToggleBtn.addEventListener('click', () => {
  initAudioContext();
  playButtonSound();
  countDrawer.classList.toggle('hidden');
  countToggleBtn.textContent = countDrawer.classList.contains('hidden') ? 'COUNT ▾' : 'COUNT ▴';
});

muteToggleBtn.addEventListener('click', () => {
  initAudioContext();
  isMuted = !isMuted;
  speakerOnIcon.classList.toggle('hidden', isMuted);
  speakerOffIcon.classList.toggle('hidden', !isMuted);
  if (!isMuted) playButtonSound();
});

dealBtn.addEventListener('click', startRound);
hitBtn.addEventListener('click', handleHit);
standBtn.addEventListener('click', handleStand);
doubleBtn.addEventListener('click', handleDoublePrompt);
splitBtn.addEventListener('click', handleSplit);

rulesBtn.addEventListener('click', () => { initAudioContext(); playButtonSound(); rulesModal.classList.remove('hidden'); });
historyBtn.addEventListener('click', () => { initAudioContext(); playButtonSound(); historyModal.classList.remove('hidden'); });

document.querySelectorAll('.dialog-close').forEach(btn => {
  btn.addEventListener('click', () => {
    initAudioContext();
    playButtonSound();
    document.getElementById(btn.getAttribute('data-close')).classList.add('hidden');
  });
});

// Startup
window.addEventListener('DOMContentLoaded', () => {
  adjustTableScale();
  renderBetCircleChips();

  setTimeout(() => {
    if (introScreen) {
      introScreen.style.opacity = '0';
      setTimeout(() => {
        introScreen.remove();
        triggerShuffle();
      }, 800);
    }
  }, 2600);
});
