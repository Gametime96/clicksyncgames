/**
 * Blackjack Craze Engine
 * Click Sync Games - 6-Deck Hi-Lo Shoe Engine with Burn Card, Split Values, and Split Aces Rule
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

// 2. State
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

const betCircle = document.getElementById('bet-circle');
const placedChipsStack = document.getElementById('placed-chips-stack');
const payoutChipsStack = document.getElementById('payout-chips-stack');

const bettingPanel = document.getElementById('betting-panel');
const actionPanel = document.getElementById('action-panel');
const dealBtn = document.getElementById('deal-btn');
const hitBtn = document.getElementById('hit-btn');
const standBtn = document.getElementById('stand-btn');
const doubleBtn = document.getElementById('double-btn');
const splitBtn = document.getElementById('split-btn');
const insuranceBtn = document.getElementById('insurance-btn');
const clearBetBtn = document.getElementById('clear-bet-btn');

const muteToggleBtn = document.getElementById('mute-toggle-btn');
const speakerOnIcon = document.getElementById('speaker-on-icon');
const speakerOffIcon = document.getElementById('speaker-off-icon');

const cutShoeModal = document.getElementById('cut-shoe-modal');
const shoeCutSpread = document.getElementById('shoe-cut-spread');
const cutGuideLine = document.getElementById('cut-guide-line');
const shuffleOverlay = document.getElementById('shuffle-overlay');
const rulesModal = document.getElementById('rules-modal');
const historyModal = document.getElementById('history-modal');
const rulesBtn = document.getElementById('rules-btn');
const historyBtn = document.getElementById('history-btn');
const historyList = document.getElementById('history-list');

// 3. Shoe Generation & Interactive Cut
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

  // Hidden cut point at approximately 10% from bottom
  cutCardIndex = Math.floor(shoe.length * 0.10);

  // Trigger 4-Second Burn Card Sequence
  executeBurnCard();
}

// 4. Burn Card Animation
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

  // Force reflow
  burnCardContainer.offsetHeight;

  playCardDealSound();

  // Glide slowly over 4 seconds into discard tray
  burnCardContainer.style.transition = 'transform 4s cubic-bezier(0.2, 0.8, 0.25, 1), opacity 4s ease';
  burnCardContainer.style.transform = `translate(${discardRect.left + 8}px, ${discardRect.top + 8}px) scale(0.75) rotate(-15deg)`;

  setTimeout(() => {
    burnCardContainer.classList.add('hidden');
    burnCardContainer.innerHTML = '';
    addFaceDownToDiscardTray();
    gameStatusEl.textContent = 'Place your chips in the circle to bet.';
  }, 4050);
}

function addFaceDownToDiscardTray() {
  discardCount++;
  const card = document.createElement('div');
  card.className = 'discard-card-item';
  card.style.transform = `rotate(${(discardCount % 7) * 4 - 12}deg) translateY(-${Math.min(discardCount, 15) * 1.5}px)`;
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

// 5. Bet Circle Rendering & Chip Layout
function renderBetCircleChips() {
  placedChipsStack.innerHTML = '';
  payoutChipsStack.innerHTML = '';
  payoutChipsStack.classList.add('hidden');
  placedChipsStack.style.transform = 'none';
  placedChipsStack.style.opacity = '1';

  if (currentBet <= 0) {
    betCircle.classList.add('pulse-halo');
    return;
  }
  betCircle.classList.remove('pulse-halo');

  const stack = breakDownBet(currentBet);
  renderStackInContainer(stack, placedChipsStack);
}

function breakDownBet(amount) {
  let remaining = amount;
  const chipValues = [100, 25, 10, 5, 1];
  const stack = [];
  chipValues.forEach(val => {
    while (remaining >= val && stack.length < 6) {
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
    chip.style.transform = `translateY(-${idx * 3}px) rotate(${idx * 8}deg)`;
    container.appendChild(chip);
  });
}

// 6. 3D Card Elements & Dealing
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

function startRound() {
  initAudioContext();
  playButtonSound();

  if (roundSettling) return;
  if (currentBet <= 0) {
    gameStatusEl.textContent = 'Place chips in the circle to bet!';
    return;
  }
  if (currentBet > bankroll) {
    gameStatusEl.textContent = 'Insufficient bankroll!';
    return;
  }

  betCircle.classList.add('dimmed');
  gameStatusEl.textContent = '';

  bankroll -= currentBet;
  bankrollEl.textContent = `$${bankroll}`;

  dealerCards = [];
  dealerHoleRevealed = false;
  playerHands = [{
    cards: [],
    bet: currentBet,
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
  const dUpCard = dealerCards[0];

  insuranceBtn.classList.toggle('hidden', !(dUpCard.value === 'A' && bankroll >= playerHands[0].bet / 2));
  
  // Can split if cards share the same point value (e.g. Jack & Queen, 10 & King, or matching pairs)
  const canSplit = (playerHands[0].cards[0].pointValue === playerHands[0].cards[1].pointValue) && (bankroll >= currentBet);
  splitBtn.classList.toggle('hidden', !canSplit);
  doubleBtn.classList.remove('hidden');

  if (pScore === 21) {
    playerHands[0].status = 'blackjack';
    resolveDealerTurn();
    return;
  }
  updatePlayerScoresDisplay();
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
    const cardEl = createCardElement(c, isHiddenHole);
    dealerCardsEl.appendChild(cardEl);
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

// 7. Player Actions & Split Rules
function handleHit() {
  playButtonSound();
  insuranceBtn.classList.add('hidden');
  doubleBtn.classList.add('hidden');
  splitBtn.classList.add('hidden');

  const hand = playerHands[currentHandIdx];
  if (hand.isSplitAce) return; // Split Aces receive strictly 1 card

  hand.cards.push(drawCard(true));
  renderPlayerHands();

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

function handleDouble() {
  playButtonSound();
  const hand = playerHands[currentHandIdx];
  if (bankroll < hand.bet || hand.isSplitAce) return;

  playChipSound();
  bankroll -= hand.bet;
  hand.bet *= 2;
  hand.isDoubled = true;
  bankrollEl.textContent = `$${bankroll}`;

  hand.cards.push(drawCard(true));
  renderPlayerHands();

  hand.status = calculateHandValue(hand.cards).score > 21 ? 'busted' : 'stood';
  advancePlayerHand();
}

function handleSplit() {
  playButtonSound();
  const hand = playerHands[currentHandIdx];
  if (bankroll < hand.bet) return;

  playChipSound();
  bankroll -= hand.bet;
  bankrollEl.textContent = `$${bankroll}`;

  const isAceSplit = (hand.cards[0].value === 'A' && hand.cards[1].value === 'A');

  const card2 = hand.cards.pop();
  const newHand = {
    cards: [card2],
    bet: hand.bet,
    status: 'playing',
    isDoubled: false,
    isSplitAce: isAceSplit
  };

  hand.isSplitAce = isAceSplit;

  // Deal 1 card to each hand
  hand.cards.push(drawCard(true));
  newHand.cards.push(drawCard(true));
  playerHands.push(newHand);

  splitBtn.classList.add('hidden');
  doubleBtn.classList.add('hidden');
  renderPlayerHands();

  // If Aces split, both hands stand immediately with 1 card only
  if (isAceSplit) {
    hand.status = 'stood';
    newHand.status = 'stood';
    setTimeout(() => {
      resolveDealerTurn();
    }, 600);
  }
}

function handleInsurance() {
  playButtonSound();
  const cost = playerHands[0].bet / 2;
  bankroll -= cost;
  bankrollEl.textContent = `$${bankroll}`;
  insuranceBtn.classList.add('hidden');

  if (['10', 'J', 'Q', 'K'].includes(dealerCards[1].value)) {
    bankroll += cost * 3;
    playChipSound();
    gameStatusEl.textContent = 'Insurance Won!';
  } else {
    gameStatusEl.textContent = 'Insurance Lost.';
  }
  bankrollEl.textContent = `$${bankroll}`;
}

function advancePlayerHand() {
  if (currentHandIdx < playerHands.length - 1) {
    currentHandIdx++;
    renderPlayerHands();
    const currentH = playerHands[currentHandIdx];
    if (currentH.isSplitAce) {
      currentH.status = 'stood';
      advancePlayerHand();
    }
  } else {
    resolveDealerTurn();
  }
}

// 8. Dealer Turn & Settlement
function resolveDealerTurn() {
  actionPanel.classList.add('hidden');

  dealerHoleRevealed = true;
  runningCount += dealerCards[1].countVal;
  updateCounts();

  const holeCardWrapper = dealerCardsEl.children[1];
  if (holeCardWrapper) {
    holeCardWrapper.classList.add('flipped');
  }
  dealerScoreEl.textContent = calculateHandValue(dealerCards).score;

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

function finishRound() {
  roundSettling = true;
  const dVal = calculateHandValue(dealerCards).score;
  let totalWinnings = 0;
  let netPnl = 0;
  let summary = '';

  playerHands.forEach((hand, idx) => {
    const pVal = calculateHandValue(hand.cards).score;
    let outcome = '';

    if (hand.status === 'busted') {
      outcome = 'Loss (Bust)';
      netPnl -= hand.bet;
    } else if (hand.status === 'blackjack') {
      if (dVal === 21 && dealerCards.length === 2) {
        outcome = 'Push';
        totalWinnings += hand.bet;
      } else {
        outcome = 'Blackjack!';
        totalWinnings += hand.bet + (hand.bet * 1.5);
        netPnl += hand.bet * 1.5;
      }
    } else if (dVal > 21 || pVal > dVal) {
      outcome = 'Win';
      totalWinnings += hand.bet * 2;
      netPnl += hand.bet;
    } else if (pVal === dVal) {
      outcome = 'Push';
      totalWinnings += hand.bet;
    } else {
      outcome = 'Loss';
      netPnl -= hand.bet;
    }

    summary += `Hand ${idx + 1}: ${outcome}. `;
    logRoundHistory(idx + 1, pVal, dVal, outcome);
  });

  bankroll += totalWinnings;
  bankrollEl.textContent = `$${bankroll}`;
  gameStatusEl.textContent = summary;

  setTimeout(() => {
    betCircle.classList.remove('dimmed');

    if (netPnl < 0) {
      playChipSound();
      placedChipsStack.style.transform = 'translateY(-140px)';
      placedChipsStack.style.opacity = '0';
      postHandCleanup(1400);
    } else if (netPnl > 0) {
      playChipSound();
      const winStack = breakDownBet(totalWinnings - playerHands[0].bet);
      renderStackInContainer(winStack, payoutChipsStack);
      payoutChipsStack.classList.remove('hidden');

      setTimeout(() => {
        playChipSound();
        animateChipsToBottom();
        postHandCleanup(1400);
      }, 2000);
    } else {
      postHandCleanup(800);
    }

  }, 1000);
}

function animateChipsToBottom() {
  const chips = document.querySelectorAll('.chip-in-ring');
  chips.forEach(chip => {
    const val = chip.dataset.val;
    const targetBtn = document.getElementById(`chip-btn-${val}`);
    if (targetBtn) {
      const chipRect = chip.getBoundingClientRect();
      const targetRect = targetBtn.getBoundingClientRect();
      const deltaX = targetRect.left - chipRect.left;
      const deltaY = targetRect.top - chipRect.top;
      chip.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(0.6)`;
      chip.style.opacity = '0';
    } else {
      chip.style.transform = 'translateY(160px)';
      chip.style.opacity = '0';
    }
  });
}

function postHandCleanup(delayMs) {
  setTimeout(() => {
    const allCards = document.querySelectorAll('.card-wrapper');
    allCards.forEach(el => el.classList.add('discarding'));

    setTimeout(() => {
      // Add one visual card back into discard tray for each discarded card
      allCards.forEach(() => addFaceDownToDiscardTray());

      dealerCardsEl.innerHTML = '';
      playerHandsContainerEl.innerHTML = '';
      dealerScoreEl.textContent = '0';
      playerScoreEl.textContent = '0';
      gameStatusEl.textContent = '';

      currentBet = 0;
      currentBetEl.textContent = '0';
      renderBetCircleChips();

      roundSettling = false;
      bettingPanel.classList.remove('hidden');

      if (cutCardReached) {
        triggerShuffle();
      }
    }, 700);

  }, delayMs);
}

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

// 9. Event Wiring
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
doubleBtn.addEventListener('click', handleDouble);
splitBtn.addEventListener('click', handleSplit);
insuranceBtn.addEventListener('click', handleInsurance);

rulesBtn.addEventListener('click', () => { initAudioContext(); playButtonSound(); rulesModal.classList.remove('hidden'); });
historyBtn.addEventListener('click', () => { initAudioContext(); playButtonSound(); historyModal.classList.remove('hidden'); });

document.querySelectorAll('.dialog-close').forEach(btn => {
  btn.addEventListener('click', () => {
    initAudioContext();
    playButtonSound();
    document.getElementById(btn.getAttribute('data-close')).classList.add('hidden');
  });
});

// App Startup
window.addEventListener('DOMContentLoaded', () => {
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
