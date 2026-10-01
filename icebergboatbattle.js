/* =========================================================
   Iceberg Boat Battle - ClickSyncGames
   ========================================================= */

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// DOM Elements
const levelDisplay = document.getElementById("level-display");
const timerDisplay = document.getElementById("timer-display");
const coinsDisplay = document.getElementById("coins-display");
const livesDisplay = document.getElementById("lives-left");
const pauseBtn = document.getElementById("pause-btn");
const pauseModal = document.getElementById("pause-modal");
const resumeBtn = document.getElementById("resume-btn");
const instructionsBtn = document.getElementById("instructions-btn");
const instructionsModal = document.getElementById("instructions-modal");
const closeInstructionsBtn = document.getElementById("close-instructions-btn");
const boatSelectModal = document.getElementById("boat-select-modal");
const selectLevelNum = document.getElementById("select-level-num");
const statusModal = document.getElementById("status-modal");
const statusTitle = document.getElementById("status-title");
const statusMessage = document.getElementById("status-message");
const statusBtn = document.getElementById("status-btn");
const boatCards = document.querySelectorAll(".boat-card");

// Audio Controls
const muteBtn = document.getElementById("mute-btn");
const soundWaves = document.getElementById("sound-waves");
const muteSlash = document.getElementById("mute-slash");

// On-screen D-Pad Buttons
const btnUp = document.getElementById("btn-up");
const btnDown = document.getElementById("btn-down");
const btnLeft = document.getElementById("btn-left");
const btnRight = document.getElementById("btn-right");

/* =========================================================
   Web Audio API Engine: Procedural Sound System
   ========================================================= */

let audioCtx = null;
let isMuted = false;
let engineOsc = null;
let engineGain = null;
let engineFilter = null;

function initAudio() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume();
  }
}

function startEngineSound() {
  if (!audioCtx || engineOsc) return;

  try {
    engineOsc = audioCtx.createOscillator();
    engineGain = audioCtx.createGain();
    engineFilter = audioCtx.createBiquadFilter();

    engineOsc.type = "sawtooth";
    engineOsc.frequency.setValueAtTime(45, audioCtx.currentTime);

    engineFilter.type = "lowpass";
    engineFilter.frequency.setValueAtTime(140, audioCtx.currentTime);

    engineGain.gain.setValueAtTime(isMuted ? 0 : 0.05, audioCtx.currentTime);

    engineOsc.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(audioCtx.destination);

    engineOsc.start();
  } catch (e) {
    console.warn("Audio initialization bypassed:", e);
  }
}

function updateEngineAudio(speedRatio, isThrusting) {
  if (!audioCtx || !engineOsc || !engineGain) return;
  if (isMuted) {
    engineGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.05);
    return;
  }

  const baseFreq = isThrusting ? 75 : 42;
  const targetFreq = baseFreq + speedRatio * 85;
  const targetGain = isThrusting ? 0.08 : (speedRatio > 0.05 ? 0.05 : 0.02);

  engineOsc.frequency.setTargetAtTime(targetFreq, audioCtx.currentTime, 0.1);
  engineGain.gain.setTargetAtTime(targetGain, audioCtx.currentTime, 0.1);
}

function stopEngineSound() {
  if (engineOsc) {
    try {
      engineOsc.stop();
      engineOsc.disconnect();
    } catch (e) {}
    engineOsc = null;
    engineGain = null;
    engineFilter = null;
  }
}

// Procedural Sound Effects
function playCrashSound() {
  if (isMuted || !audioCtx) return;
  initAudio();

  const bufferSize = audioCtx.sampleRate * 0.45;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (audioCtx.sampleRate * 0.1));
  }

  const noise = audioCtx.createBufferSource();
  noise.buffer = buffer;

  const filter = audioCtx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(260, audioCtx.currentTime);
  filter.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.4);

  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(audioCtx.destination);
  noise.start();
}

function playCoinSound() {
  if (isMuted || !audioCtx) return;
  initAudio();

  const now = audioCtx.currentTime;
  const osc1 = audioCtx.createOscillator();
  const osc2 = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc1.type = "sine";
  osc2.type = "sine";

  osc1.frequency.setValueAtTime(880, now); // A5
  osc1.frequency.exponentialRampToValueAtTime(1760, now + 0.12); // A6

  osc2.frequency.setValueAtTime(1100, now);
  osc2.frequency.exponentialRampToValueAtTime(2200, now + 0.12);

  gain.gain.setValueAtTime(0.12, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

  osc1.connect(gain);
  osc2.connect(gain);
  gain.connect(audioCtx.destination);

  osc1.start(now);
  osc2.start(now);
  osc1.stop(now + 0.2);
  osc2.stop(now + 0.2);
}

function toggleMute() {
  initAudio();
  isMuted = !isMuted;
  if (isMuted) {
    soundWaves.style.display = "none";
    muteSlash.style.display = "inline";
    if (engineGain) engineGain.gain.setValueAtTime(0, audioCtx.currentTime);
  } else {
    soundWaves.style.display = "inline";
    muteSlash.style.display = "none";
  }
}

muteBtn.addEventListener("click", toggleMute);

/* =========================================================
   High-Definition Vector Boat Renderers (Scaled Up 10%)
   ========================================================= */

const BOAT_SPECS = {
  speedBoat: {
    name: "Red & White Speed Boat",
    speedRating: 8,
    durabilityRating: 6,
    maxSpeed: 3.2,
    accel: 0.08,
    turnSpeed: 0.042,
    length: 51,      // 46 * 1.10
    width: 24,       // 22 * 1.10
    radius: 18,      // 16 * 1.10
    draw(c) {
      c.save();
      c.scale(1.10, 1.10);
      c.shadowColor = "rgba(0, 15, 30, 0.6)";
      c.shadowBlur = 8;
      c.shadowOffsetX = 2;
      c.shadowOffsetY = 3;

      // Pointed V-Hull (Red)
      c.beginPath();
      c.moveTo(23, 0);
      c.quadraticCurveTo(8, -11, -21, -11);
      c.lineTo(-21, 11);
      c.quadraticCurveTo(8, 11, 23, 0);
      c.closePath();
      const hullGrad = c.createLinearGradient(0, -11, 0, 11);
      hullGrad.addColorStop(0, "#f44336");
      hullGrad.addColorStop(0.5, "#d32f2f");
      hullGrad.addColorStop(1, "#b71c1c");
      c.fillStyle = hullGrad;
      c.fill();
      c.shadowColor = "transparent";

      c.lineWidth = 1.5;
      c.strokeStyle = "#ffffff";
      c.stroke();

      // Sleek Center White Deck
      c.beginPath();
      c.moveTo(15, 0);
      c.quadraticCurveTo(5, -6, -13, -6);
      c.lineTo(-13, 6);
      c.quadraticCurveTo(5, 6, 15, 0);
      c.closePath();
      c.fillStyle = "#f8fafd";
      c.fill();
      c.strokeStyle = "#cfd8dc";
      c.lineWidth = 1;
      c.stroke();

      // Tinted Windshield
      c.fillStyle = "rgba(0, 229, 255, 0.85)";
      c.beginPath();
      c.moveTo(4, -5);
      c.lineTo(6, -5);
      c.lineTo(8, 0);
      c.lineTo(6, 5);
      c.lineTo(4, 5);
      c.closePath();
      c.fill();

      // Exhaust
      c.fillStyle = "#263238";
      c.fillRect(-20, -7, 4, 3);
      c.fillRect(-20, 4, 4, 3);
      c.restore();
    }
  },
  pontoon: {
    name: "Silver Pontoon Boat",
    speedRating: 6,
    durabilityRating: 7,
    maxSpeed: 2.6,
    accel: 0.06,
    turnSpeed: 0.034,
    length: 53,      // 48 * 1.10
    width: 29,       // 26 * 1.10
    radius: 19,      // 17 * 1.10
    draw(c) {
      c.save();
      c.scale(1.10, 1.10);
      c.shadowColor = "rgba(0, 15, 30, 0.6)";
      c.shadowBlur = 8;
      c.shadowOffsetX = 2;
      c.shadowOffsetY = 3;

      const tubeGrad = c.createLinearGradient(0, -13, 0, -5);
      tubeGrad.addColorStop(0, "#eceff1");
      tubeGrad.addColorStop(0.5, "#b0bec5");
      tubeGrad.addColorStop(1, "#78909c");

      c.fillStyle = tubeGrad;
      c.beginPath();
      c.roundRect(-23, -13, 46, 8, 4);
      c.fill();
      c.strokeStyle = "#ffffff";
      c.lineWidth = 1;
      c.stroke();

      const tubeGrad2 = c.createLinearGradient(0, 5, 0, 13);
      tubeGrad2.addColorStop(0, "#eceff1");
      tubeGrad2.addColorStop(0.5, "#b0bec5");
      tubeGrad2.addColorStop(1, "#78909c");
      c.fillStyle = tubeGrad2;
      c.beginPath();
      c.roundRect(-23, 5, 46, 8, 4);
      c.fill();
      c.stroke();

      c.shadowColor = "transparent";

      c.fillStyle = "#546e7a";
      c.fillRect(-17, -7, 34, 14);

      c.strokeStyle = "#cfd8dc";
      c.lineWidth = 1.5;
      c.strokeRect(-16, -6, 32, 12);

      const biminiGrad = c.createLinearGradient(-11, 0, 4, 0);
      biminiGrad.addColorStop(0, "#263238");
      biminiGrad.addColorStop(1, "#37474f");
      c.fillStyle = biminiGrad;
      c.beginPath();
      c.roundRect(-11, -5, 15, 10, 2);
      c.fill();
      c.restore();
    }
  },
  cruiseShip: {
    name: "Small Cruise Ship",
    speedRating: 5,
    durabilityRating: 8,
    maxSpeed: 2.2,
    accel: 0.05,
    turnSpeed: 0.028,
    length: 62,      // 56 * 1.10
    width: 31,       // 28 * 1.10
    radius: 21,      // 19 * 1.10
    draw(c) {
      c.save();
      c.scale(1.10, 1.10);
      c.shadowColor = "rgba(0, 15, 30, 0.6)";
      c.shadowBlur = 10;
      c.shadowOffsetX = 2;
      c.shadowOffsetY = 4;

      c.beginPath();
      c.moveTo(28, 0);
      c.quadraticCurveTo(12, -14, -26, -13);
      c.lineTo(-26, 13);
      c.quadraticCurveTo(12, 14, 28, 0);
      c.closePath();
      const hullGrad = c.createLinearGradient(0, -14, 0, 14);
      hullGrad.addColorStop(0, "#1a365d");
      hullGrad.addColorStop(0.5, "#0f2341");
      hullGrad.addColorStop(1, "#0a182e");
      c.fillStyle = hullGrad;
      c.fill();
      c.shadowColor = "transparent";

      c.strokeStyle = "#ffffff";
      c.lineWidth = 1.5;
      c.stroke();

      c.fillStyle = "#f8fafd";
      c.beginPath();
      c.roundRect(-19, -9, 32, 18, 3);
      c.fill();
      c.strokeStyle = "#cfd8dc";
      c.lineWidth = 1;
      c.stroke();

      c.fillStyle = "#e2e8f0";
      c.beginPath();
      c.roundRect(-12, -6, 20, 12, 2);
      c.fill();

      c.fillStyle = "rgba(0, 200, 255, 0.9)";
      c.fillRect(6, -4, 2, 8);

      c.fillStyle = "#e53935";
      c.beginPath();
      c.arc(-3, 0, 4, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#1e293b";
      c.beginPath();
      c.arc(-3, 0, 2, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }
  },
  doubleDeck: {
    name: "Double Deck Boat",
    speedRating: 6,
    durabilityRating: 7,
    maxSpeed: 2.6,
    accel: 0.06,
    turnSpeed: 0.034,
    length: 55,      // 50 * 1.10
    width: 29,       // 26 * 1.10
    radius: 20,      // 18 * 1.10
    draw(c) {
      c.save();
      c.scale(1.10, 1.10);
      c.shadowColor = "rgba(0, 15, 30, 0.6)";
      c.shadowBlur = 8;
      c.shadowOffsetX = 2;
      c.shadowOffsetY = 3;

      c.beginPath();
      c.moveTo(25, 0);
      c.quadraticCurveTo(10, -13, -23, -12);
      c.lineTo(-23, 12);
      c.quadraticCurveTo(10, 13, 25, 0);
      c.closePath();
      const hullGrad = c.createLinearGradient(0, -13, 0, 13);
      hullGrad.addColorStop(0, "#0288d1");
      hullGrad.addColorStop(0.5, "#0277bd");
      hullGrad.addColorStop(1, "#01579b");
      c.fillStyle = hullGrad;
      c.fill();
      c.shadowColor = "transparent";

      c.strokeStyle = "#ffffff";
      c.lineWidth = 1.5;
      c.stroke();

      c.fillStyle = "#ffffff";
      c.fillRect(-17, -8, 28, 16);

      c.fillStyle = "#e1f5fe";
      c.beginPath();
      c.roundRect(-15, -7, 22, 14, 2);
      c.fill();
      c.strokeStyle = "#0288d1";
      c.lineWidth = 1;
      c.stroke();

      c.fillStyle = "#ffb300";
      c.fillRect(-8, -4, 10, 8);
      c.restore();
    }
  }
};

// Level Configuration
const LEVEL_CONFIG = {
  1: { time: 60, coins: 3, icebergs: 8 },
  2: { time: 50, coins: 4, icebergs: 13 },
  3: { time: 40, coins: 5, icebergs: 18 }
};

// State Variables
let currentLevel = 1;
let lives = 3;
let selectedBoatType = "speedBoat";
let timeRemaining = 60;
let coinsCollected = 0;
let isPlaying = false;
let isPaused = false;
let wasPausedBeforeInstructions = false;
let timerInterval = null;
let animationFrameId = null;

// Controls
const keys = {
  forward: false,
  reverse: false,
  left: false,
  right: false
};

// Game Entities
let player = {
  x: 80,
  y: 300,
  angle: 0,
  speed: 0,
  wake: []
};

let icebergs = [];
let coins = [];
let particles = [];
let ambientWaves = [];

// Initialize Waves
for (let i = 0; i < 25; i++) {
  ambientWaves.push({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    length: 15 + Math.random() * 25,
    speed: 0.2 + Math.random() * 0.25,
    opacity: 0.1 + Math.random() * 0.2
  });
}

function renderBoatPreviews() {
  Object.keys(BOAT_SPECS).forEach((key) => {
    const previewCanvas = document.getElementById(`preview-${key}`);
    if (previewCanvas) {
      const pctx = previewCanvas.getContext("2d");
      pctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
      pctx.save();
      pctx.translate(previewCanvas.width / 2, previewCanvas.height / 2);
      pctx.scale(1.15, 1.15);
      BOAT_SPECS[key].draw(pctx);
      pctx.restore();
    }
  });
}

/* =========================================================
   Event Listeners: Strict Arrow Keys & P Only
   ========================================================= */

window.addEventListener("keydown", (e) => {
  initAudio();
  if (e.key === "p" || e.key === "P") {
    e.preventDefault();
    if (isPlaying && boatSelectModal.classList.contains("hidden")) {
      togglePause();
    }
    return;
  }

  if (!isPlaying || isPaused) return;

  if (e.key === "ArrowUp") {
    e.preventDefault();
    keys.forward = true;
    highlightButton(btnUp, true);
  } else if (e.key === "ArrowDown") {
    e.preventDefault();
    keys.reverse = true;
    highlightButton(btnDown, true);
  } else if (e.key === "ArrowLeft") {
    e.preventDefault();
    keys.left = true;
    highlightButton(btnLeft, true);
  } else if (e.key === "ArrowRight") {
    e.preventDefault();
    keys.right = true;
    highlightButton(btnRight, true);
  }
});

window.addEventListener("keyup", (e) => {
  if (e.key === "ArrowUp") {
    keys.forward = false;
    highlightButton(btnUp, false);
  } else if (e.key === "ArrowDown") {
    keys.reverse = false;
    highlightButton(btnDown, false);
  } else if (e.key === "ArrowLeft") {
    keys.left = false;
    highlightButton(btnLeft, false);
  } else if (e.key === "ArrowRight") {
    keys.right = false;
    highlightButton(btnRight, false);
  }
});

function highlightButton(btn, active) {
  if (btn) {
    if (active) btn.classList.add("active");
    else btn.classList.remove("active");
  }
}

// On-screen D-Pad Binding
function attachDPad(element, keyName) {
  const start = (e) => {
    e.preventDefault();
    initAudio();
    if (isPlaying && !isPaused) {
      keys[keyName] = true;
      element.classList.add("active");
    }
  };
  const end = (e) => {
    e.preventDefault();
    keys[keyName] = false;
    element.classList.remove("active");
  };

  element.addEventListener("touchstart", start, { passive: false });
  element.addEventListener("touchend", end, { passive: false });
  element.addEventListener("touchcancel", end, { passive: false });
  element.addEventListener("mousedown", start);
  element.addEventListener("mouseup", end);
  element.addEventListener("mouseleave", end);
}

attachDPad(btnUp, "forward");
attachDPad(btnDown, "reverse");
attachDPad(btnLeft, "left");
attachDPad(btnRight, "right");

// Pause & Resume Event Handlers
pauseBtn.addEventListener("click", () => {
  initAudio();
  if (isPlaying) togglePause();
});

resumeBtn.addEventListener("click", () => {
  initAudio();
  togglePause();
});

function togglePause() {
  if (!isPlaying) return;
  isPaused = !isPaused;

  if (isPaused) {
    clearInterval(timerInterval);
    if (engineGain) engineGain.gain.setValueAtTime(0, audioCtx.currentTime);
    pauseModal.classList.remove("hidden");
  } else {
    pauseModal.classList.add("hidden");
    startTimer();
    requestAnimationFrame(gameLoop);
  }
}

// Instructions Modal Handlers
instructionsBtn.addEventListener("click", () => {
  initAudio();
  if (isPlaying && !isPaused) {
    wasPausedBeforeInstructions = false;
    isPaused = true;
    clearInterval(timerInterval);
    if (engineGain) engineGain.gain.setValueAtTime(0, audioCtx.currentTime);
  } else {
    wasPausedBeforeInstructions = true;
  }
  instructionsModal.classList.remove("hidden");
});

closeInstructionsBtn.addEventListener("click", () => {
  instructionsModal.classList.add("hidden");
  if (isPlaying && !wasPausedBeforeInstructions) {
    isPaused = false;
    startTimer();
    requestAnimationFrame(gameLoop);
  }
});

function startTimer() {
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    if (!isPaused && isPlaying) {
      timeRemaining--;
      updateHUD();

      if (timeRemaining <= 0) {
        handleLevelFailure("Time Expired!", "You ran out of time to collect all coins.");
      }
    }
  }, 1000);
}

boatCards.forEach((card) => {
  card.querySelector(".select-btn").addEventListener("click", () => {
    initAudio();
    selectedBoatType = card.getAttribute("data-boat");
    boatSelectModal.classList.add("hidden");
    startLevelSession();
  });
});

/* =========================================================
   Level Setup & Flow Management
   ========================================================= */

function promptBoatSelection() {
  isPlaying = false;
  isPaused = false;
  clearInterval(timerInterval);
  cancelAnimationFrame(animationFrameId);
  stopEngineSound();

  selectLevelNum.textContent = currentLevel;
  boatSelectModal.classList.remove("hidden");
  statusModal.classList.add("hidden");
  pauseModal.classList.add("hidden");

  renderBoatPreviews();
}

function startLevelSession() {
  const config = LEVEL_CONFIG[currentLevel];
  timeRemaining = config.time;
  coinsCollected = 0;
  isPaused = false;

  player.x = 80;
  player.y = canvas.height / 2;
  player.angle = 0;
  player.speed = 0;
  player.wake = [];

  updateHUD();
  generateIcebergs(config.icebergs);
  generateCoins(config.coins);
  particles = [];

  startEngineSound();
  startTimer();
  isPlaying = true;
  requestAnimationFrame(gameLoop);
}

function updateHUD() {
  levelDisplay.textContent = currentLevel;
  timerDisplay.textContent = `${timeRemaining}s`;
  coinsDisplay.textContent = `${coinsCollected}/${LEVEL_CONFIG[currentLevel].coins}`;
  livesDisplay.textContent = lives;
}

/* =========================================================
   Entity Generation with Collision Buffering
   ========================================================= */

function generateIcebergs(count) {
  icebergs = [];
  for (let i = 0; i < count; i++) {
    let valid = false;
    let berg = null;
    let attempts = 0;

    while (!valid && attempts < 100) {
      attempts++;
      const radius = 22 + Math.random() * 24;
      const x = 180 + Math.random() * (canvas.width - 240);
      const y = 50 + Math.random() * (canvas.height - 100);

      const distToPlayer = Math.hypot(x - 80, y - canvas.height / 2);
      if (distToPlayer < 120) continue;

      let overlap = false;
      for (let existing of icebergs) {
        if (Math.hypot(x - existing.x, y - existing.y) < radius + existing.radius + 20) {
          overlap = true;
          break;
        }
      }

      if (!overlap) {
        const vertices = [];
        const numPoints = 7 + Math.floor(Math.random() * 4);
        for (let p = 0; p < numPoints; p++) {
          const angle = (p / numPoints) * Math.PI * 2;
          const variance = 0.75 + Math.random() * 0.5;
          vertices.push({
            x: Math.cos(angle) * radius * variance,
            y: Math.sin(angle) * radius * variance
          });
        }

        berg = {
          x,
          y,
          radius,
          vertices,
          driftAngle: Math.random() * Math.PI * 2,
          driftSpeed: 0.08 + Math.random() * 0.12,
          rot: 0,
          rotSpeed: (Math.random() - 0.5) * 0.003
        };
        valid = true;
      }
    }

    if (berg) icebergs.push(berg);
  }
}

function generateCoins(count) {
  coins = [];
  for (let i = 0; i < count; i++) {
    let valid = false;
    let coin = null;
    let attempts = 0;

    while (!valid && attempts < 100) {
      attempts++;
      const x = 160 + Math.random() * (canvas.width - 220);
      const y = 60 + Math.random() * (canvas.height - 120);

      if (Math.hypot(x - 80, y - canvas.height / 2) < 100) continue;

      let insideBerg = false;
      for (let berg of icebergs) {
        if (Math.hypot(x - berg.x, y - berg.y) < berg.radius + 25) {
          insideBerg = true;
          break;
        }
      }

      let overlapCoin = false;
      for (let c of coins) {
        if (Math.hypot(x - c.x, y - c.y) < 60) {
          overlapCoin = true;
          break;
        }
      }

      if (!insideBerg && !overlapCoin) {
        coin = {
          x,
          y,
          radius: 12,
          pulse: Math.random() * Math.PI * 2
        };
        valid = true;
      }
    }

    if (coin) coins.push(coin);
  }
}

/* =========================================================
   Failures, Game Over, and Progression
   ========================================================= */

function handleLevelFailure(title, msg) {
  isPlaying = false;
  isPaused = false;
  clearInterval(timerInterval);
  lives--;
  updateHUD();

  playCrashSound();
  stopEngineSound();
  createExplosion(player.x, player.y, 40);

  setTimeout(() => {
    if (lives <= 0) {
      statusTitle.textContent = "Game Over!";
      statusTitle.style.color = "#ff3333";
      statusMessage.textContent = "All 3 lives lost. You must restart from Level 1.";
      statusBtn.textContent = "Restart Game";
      statusBtn.onclick = () => {
        lives = 3;
        currentLevel = 1;
        promptBoatSelection();
      };
    } else {
      statusTitle.textContent = title;
      statusTitle.style.color = "#ffaa00";
      statusMessage.textContent = `${msg} Lives Remaining: ${lives}/3.`;
      statusBtn.textContent = `Retry Level ${currentLevel}`;
      statusBtn.onclick = () => {
        promptBoatSelection();
      };
    }
    statusModal.classList.remove("hidden");
  }, 400);
}

function handleLevelSuccess() {
  isPlaying = false;
  isPaused = false;
  clearInterval(timerInterval);
  stopEngineSound();

  if (currentLevel < 3) {
    statusTitle.textContent = `Level ${currentLevel} Complete!`;
    statusTitle.style.color = "#00f2fe";
    statusMessage.textContent = `Outstanding sailing! Prepare for Level ${currentLevel + 1}.`;
    statusBtn.textContent = `Proceed to Level ${currentLevel + 1}`;
    statusBtn.onclick = () => {
      currentLevel++;
      promptBoatSelection();
    };
  } else {
    statusTitle.textContent = "Victory!";
    statusTitle.style.color = "#4caf50";
    statusMessage.textContent = "You conquered all ice fields across all 3 levels!";
    statusBtn.textContent = "Play Again";
    statusBtn.onclick = () => {
      lives = 3;
      currentLevel = 1;
      promptBoatSelection();
    };
  }
  statusModal.classList.remove("hidden");
}

/* =========================================================
   Particles & Visual Effects
   ========================================================= */

function createExplosion(x, y, count) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1 + Math.random() * 4;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: 2 + Math.random() * 4,
      color: Math.random() > 0.5 ? "#00e5ff" : "#ffffff",
      alpha: 1,
      decay: 0.02 + Math.random() * 0.03
    });
  }
}

function createCoinSparkle(x, y) {
  for (let i = 0; i < 15; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1 + Math.random() * 3;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: 1.5 + Math.random() * 2.5,
      color: "#ffd700",
      alpha: 1,
      decay: 0.03 + Math.random() * 0.03
    });
  }
}

/* =========================================================
   Main Game Loop & Rendering Engine
   ========================================================= */

function gameLoop() {
  if (!isPlaying || isPaused) {
    if (isPaused) render();
    return;
  }

  update();
  render();
  animationFrameId = requestAnimationFrame(gameLoop);
}

function update() {
  const spec = BOAT_SPECS[selectedBoatType];

  // Rotation
  if (keys.left) player.angle -= spec.turnSpeed;
  if (keys.right) player.angle += spec.turnSpeed;

  // Acceleration & Braking
  if (keys.forward) {
    player.speed += spec.accel;
    if (player.speed > spec.maxSpeed) player.speed = spec.maxSpeed;

    if (Math.random() < 0.5) {
      const backX = player.x - Math.cos(player.angle) * (spec.length / 2);
      const backY = player.y - Math.sin(player.angle) * (spec.length / 2);
      player.wake.push({
        x: backX + (Math.random() - 0.5) * 6,
        y: backY + (Math.random() - 0.5) * 6,
        alpha: 0.5,
        radius: 3 + Math.random() * 3
      });
    }
  } else if (keys.reverse) {
    player.speed -= spec.accel * 0.6;
    if (player.speed < -spec.maxSpeed * 0.4) player.speed = -spec.maxSpeed * 0.4;
  } else {
    player.speed *= 0.965;
    if (Math.abs(player.speed) < 0.02) player.speed = 0;
  }

  // Audio Update
  const speedRatio = Math.abs(player.speed) / spec.maxSpeed;
  updateEngineAudio(speedRatio, keys.forward);

  player.x += Math.cos(player.angle) * player.speed;
  player.y += Math.sin(player.angle) * player.speed;

  const pad = spec.radius;
  if (player.x < pad) { player.x = pad; player.speed = 0; }
  if (player.x > canvas.width - pad) { player.x = canvas.width - pad; player.speed = 0; }
  if (player.y < pad) { player.y = pad; player.speed = 0; }
  if (player.y > canvas.height - pad) { player.y = canvas.height - pad; player.speed = 0; }

  for (let i = player.wake.length - 1; i >= 0; i--) {
    player.wake[i].alpha -= 0.02;
    player.wake[i].radius += 0.25;
    if (player.wake[i].alpha <= 0) {
      player.wake.splice(i, 1);
    }
  }

  icebergs.forEach((berg) => {
    berg.x += Math.cos(berg.driftAngle) * berg.driftSpeed;
    berg.y += Math.sin(berg.driftAngle) * berg.driftSpeed;
    berg.rot += berg.rotSpeed;

    if (berg.x < berg.radius || berg.x > canvas.width - berg.radius) {
      berg.driftAngle = Math.PI - berg.driftAngle;
    }
    if (berg.y < berg.radius || berg.y > canvas.height - berg.radius) {
      berg.driftAngle = -berg.driftAngle;
    }

    const distToBerg = Math.hypot(player.x - berg.x, player.y - berg.y);
    if (distToBerg < spec.radius + berg.radius * 0.85) {
      handleLevelFailure("Collision!", "Your boat crashed into an iceberg.");
    }
  });

  for (let i = coins.length - 1; i >= 0; i--) {
    const coin = coins[i];
    coin.pulse += 0.05;

    const distToCoin = Math.hypot(player.x - coin.x, player.y - coin.y);
    if (distToCoin < spec.radius + coin.radius) {
      playCoinSound();
      createCoinSparkle(coin.x, coin.y);
      coins.splice(i, 1);
      coinsCollected++;
      updateHUD();

      if (coinsCollected >= LEVEL_CONFIG[currentLevel].coins) {
        handleLevelSuccess();
      }
    }
  }

  ambientWaves.forEach((wave) => {
    wave.x += wave.speed;
    if (wave.x > canvas.width + 40) {
      wave.x = -40;
      wave.y = Math.random() * canvas.height;
    }
  });

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.alpha -= p.decay;
    if (p.alpha <= 0) particles.splice(i, 1);
  }
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Ocean Gradient
  const oceanGrad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  oceanGrad.addColorStop(0, "#061d38");
  oceanGrad.addColorStop(0.5, "#041529");
  oceanGrad.addColorStop(1, "#020b16");
  ctx.fillStyle = oceanGrad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Reflections
  ctx.save();
  ambientWaves.forEach((wave) => {
    ctx.strokeStyle = `rgba(100, 220, 255, ${wave.opacity})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(wave.x, wave.y);
    ctx.quadraticCurveTo(wave.x + wave.length / 2, wave.y - 3, wave.x + wave.length, wave.y);
    ctx.stroke();
  });
  ctx.restore();

  // Wakes
  player.wake.forEach((w) => {
    ctx.beginPath();
    ctx.arc(w.x, w.y, w.radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(200, 240, 255, ${w.alpha})`;
    ctx.fill();
  });

  // Icebergs
  icebergs.forEach((berg) => {
    ctx.save();
    ctx.translate(berg.x, berg.y);
    ctx.rotate(berg.rot);

    ctx.beginPath();
    ctx.arc(0, 0, berg.radius * 1.25, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0, 180, 216, 0.12)";
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(berg.vertices[0].x, berg.vertices[0].y);
    for (let v = 1; v < berg.vertices.length; v++) {
      ctx.lineTo(berg.vertices[v].x, berg.vertices[v].y);
    }
    ctx.closePath();

    const iceGrad = ctx.createLinearGradient(-berg.radius, -berg.radius, berg.radius, berg.radius);
    iceGrad.addColorStop(0, "#ffffff");
    iceGrad.addColorStop(0.4, "#d8f3dc");
    iceGrad.addColorStop(0.8, "#90e0ef");
    iceGrad.addColorStop(1, "#0077b6");
    ctx.fillStyle = iceGrad;
    ctx.fill();

    ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(berg.vertices[0].x, berg.vertices[0].y);
    ctx.lineTo(0, 0);
    ctx.lineTo(berg.vertices[Math.floor(berg.vertices.length / 2)].x, berg.vertices[Math.floor(berg.vertices.length / 2)].y);
    ctx.strokeStyle = "rgba(0, 119, 182, 0.4)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.restore();
  });

  // Collectible Coins
  coins.forEach((coin) => {
    ctx.save();
    ctx.translate(coin.x, coin.y);

    const scale = 1 + Math.sin(coin.pulse) * 0.12;
    ctx.scale(scale, scale);

    ctx.beginPath();
    ctx.arc(0, 0, coin.radius * 1.5, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 215, 0, 0.25)";
    ctx.fill();

    ctx.beginPath();
    ctx.arc(0, 0, coin.radius, 0, Math.PI * 2);
    const coinGrad = ctx.createRadialGradient(0, -3, 2, 0, 0, coin.radius);
    coinGrad.addColorStop(0, "#fff59d");
    coinGrad.addColorStop(0.6, "#fbc02d");
    coinGrad.addColorStop(1, "#f57f17");
    ctx.fillStyle = coinGrad;
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("★", 0, 0.5);

    ctx.restore();
  });

  // Boat
  if (isPlaying) {
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.angle);
    BOAT_SPECS[selectedBoatType].draw(ctx);
    ctx.restore();
  }

  // Particles
  particles.forEach((p) => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.globalAlpha = p.alpha;
    ctx.fill();
    ctx.globalAlpha = 1.0;
  });
}

// Initial Boot
promptBoatSelection();
