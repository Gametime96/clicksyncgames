/* =========================================================
   Field Goal 101 Madness - ClickSyncGames
   ========================================================= */

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// HUD Elements
const arenaDisplay = document.getElementById("arena-display");
const levelDisplay = document.getElementById("level-display");
const yardDisplay = document.getElementById("yard-display");
const windDisplay = document.getElementById("wind-display");
const attemptsDisplay = document.getElementById("attempts-display");
const pauseBtn = document.getElementById("pause-btn");

// Controls Elements
const aimGaugeContainer = document.getElementById("aim-gauge-container");
const powerGaugeContainer = document.getElementById("power-gauge-container");
const aimNeedle = document.getElementById("aim-needle");
const powerIndicator = document.getElementById("power-indicator");
const lockAimBtn = document.getElementById("lock-aim-btn");
const lockPowerBtn = document.getElementById("lock-power-btn");

// Modals
const arenaSelectModal = document.getElementById("arena-select-modal");
const selectLevelNum = document.getElementById("select-level-num");
const arenaCards = document.querySelectorAll(".arena-card");
const pauseModal = document.getElementById("pause-modal");
const continueGameBtn = document.getElementById("continue-game-btn");
const statusModal = document.getElementById("status-modal");
const statusTitle = document.getElementById("status-title");
const statusMessage = document.getElementById("status-message");
const statusBtn = document.getElementById("status-btn");

// Arena Configurations
const ARENAS = {
  northernStadium: {
    name: "Northern Stadium",
    yardLine: 30,
    wind: 2, // Positive = Right
    windText: "2 mph →",
    snow: true,
    dome: false,
    skyGrad: ["#2d4154", "#778d9e", "#b0c4de"]
  },
  southernStadium: {
    name: "Southern Stadium",
    yardLine: 25,
    wind: -10, // Negative = Left
    windText: "10 mph ←",
    snow: false,
    dome: false,
    skyGrad: ["#0284c7", "#38bdf8", "#bae6fd"]
  },
  northernDome: {
    name: "Northern Dome",
    yardLine: 40,
    wind: 0,
    windText: "0 mph (Calm)",
    snow: false,
    dome: true,
    skyGrad: ["#0f172a", "#1e293b", "#334155"]
  },
  southernDome: {
    name: "Southern Dome",
    yardLine: 35,
    wind: 0,
    windText: "0 mph (Calm)",
    snow: false,
    dome: true,
    skyGrad: ["#0f172a", "#1e293b", "#334155"]
  }
};

// Game State Matrices
let currentLevel = 1;
const MAX_LEVELS = 5;
let attemptsLeft = 3;
let selectedArenaKey = "northernStadium";
let currentArena = ARENAS.northernStadium;

let gameState = "SELECT"; // "SELECT", "AIMING", "POWER", "FLYING", "RESOLVED"
let isPaused = false;
let animationFrameId = null;

// Gauges Mechanics
let aimPos = 0; // -1 to 1
let aimDir = 1;
let aimSpeed = 0.035;

let powerVal = 0; // 0 to 100
let powerDir = 1;
let powerSpeed = 2.4;

let lockedAim = 0;
let lockedPower = 0;

// Levitating Red Ring Target
let targetRing = {
  x: canvas.width / 2,
  y: 250,
  radiusX: 42,
  radiusY: 42,
  minX: 290,
  maxX: 670,
  speed: 1.5,
  dir: 1,
  passedThrough: false
};

// Football 3D Perspective Physics
let ball = {
  x: canvas.width / 2,
  y: 490,
  z: 0,
  vx: 0,
  vy: 0,
  vz: 0,
  scale: 1,
  rotation: 0,
  passedPosts: false
};

// Weather Particles
let snowflakes = [];
for (let i = 0; i < 150; i++) {
  snowflakes.push({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    radius: 1 + Math.random() * 2.5,
    speedY: 1 + Math.random() * 2,
    speedX: 0.5 + Math.random() * 1.5
  });
}

/* =========================================================
   Perspective Mini Stadium Preview Generator
   ========================================================= */

function renderMiniStadiumPreviews() {
  Object.keys(ARENAS).forEach((key) => {
    const pCanvas = document.getElementById(`preview-${key}`);
    if (!pCanvas) return;
    const pctx = pCanvas.getContext("2d");
    const arenaData = ARENAS[key];
    const pw = pCanvas.width;
    const ph = pCanvas.height;

    pctx.clearRect(0, 0, pw, ph);

    // Sky
    const sky = pctx.createLinearGradient(0, 0, 0, ph * 0.55);
    sky.addColorStop(0, arenaData.skyGrad[0]);
    sky.addColorStop(1, arenaData.skyGrad[2]);
    pctx.fillStyle = sky;
    pctx.fillRect(0, 0, pw, ph * 0.55);

    if (arenaData.dome) {
      // Dome Ceiling Trusses
      pctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
      pctx.lineWidth = 1;
      for (let x = 0; x < pw; x += 20) {
        pctx.beginPath();
        pctx.moveTo(x, 0);
        pctx.lineTo(pw / 2, ph * 0.35);
        pctx.stroke();
      }
    } else {
      // Stadium Bleachers
      pctx.fillStyle = "#1e293b";
      pctx.beginPath();
      pctx.moveTo(0, ph * 0.52);
      pctx.lineTo(pw * 0.25, ph * 0.38);
      pctx.lineTo(pw * 0.75, ph * 0.38);
      pctx.lineTo(pw, ph * 0.52);
      pctx.lineTo(pw, ph * 0.55);
      pctx.lineTo(0, ph * 0.55);
      pctx.closePath();
      pctx.fill();

      // Stadium Floodlights
      pctx.fillStyle = "#ffffff";
      pctx.fillRect(pw * 0.15, ph * 0.25, 4, 4);
      pctx.fillRect(pw * 0.82, ph * 0.25, 4, 4);
    }

    // Turf
    const turf = pctx.createLinearGradient(0, ph * 0.5, 0, ph);
    turf.addColorStop(0, "#166534");
    turf.addColorStop(1, "#14532d");
    pctx.fillStyle = turf;
    pctx.fillRect(0, ph * 0.5, pw, ph * 0.5);

    // Yard Lines
    pctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
    pctx.lineWidth = 1;
    pctx.beginPath();
    pctx.moveTo(0, ph * 0.65);
    pctx.lineTo(pw, ph * 0.65);
    pctx.moveTo(0, ph * 0.82);
    pctx.lineTo(pw, ph * 0.82);
    pctx.stroke();

    // Goal Post Uprights
    pctx.fillStyle = "#facc15";
    pctx.fillRect(pw * 0.48, ph * 0.42, 3, 14); // Base post
    pctx.fillRect(pw * 0.35, ph * 0.42, pw * 0.3, 2); // Crossbar
    pctx.fillRect(pw * 0.35, ph * 0.18, 2, ph * 0.24); // Left upright
    pctx.fillRect(pw * 0.63, ph * 0.18, 2, ph * 0.24); // Right upright

    // Levitating Ring
    pctx.beginPath();
    pctx.ellipse(pw / 2, ph * 0.4, 10, 10, 0, 0, Math.PI * 2);
    pctx.strokeStyle = "#ef4444";
    pctx.lineWidth = 1.5;
    pctx.stroke();

    // Snow Weather in Northern Stadium
    if (arenaData.snow) {
      pctx.fillStyle = "rgba(255, 255, 255, 0.8)";
      for (let s = 0; s < 25; s++) {
        pctx.fillRect(Math.random() * pw, Math.random() * ph, 1.5, 1.5);
      }
    }

    // Mini Football at Kicker's Feet
    pctx.beginPath();
    pctx.ellipse(pw / 2, ph * 0.88, 5, 8, 0, 0, Math.PI * 2);
    pctx.fillStyle = "#78350f";
    pctx.fill();
    pctx.strokeStyle = "#ffffff";
    pctx.lineWidth = 0.5;
    pctx.stroke();
  });
}

/* =========================================================
   Event Listeners & Input Handlers
   ========================================================= */

arenaCards.forEach((card) => {
  card.querySelector(".select-btn").addEventListener("click", () => {
    selectedArenaKey = card.getAttribute("data-arena");
    currentArena = ARENAS[selectedArenaKey];
    arenaSelectModal.classList.add("hidden");
    startLevelSession();
  });
});

window.addEventListener("keydown", (e) => {
  if (e.key === "p" || e.key === "P") {
    if (gameState !== "SELECT") {
      togglePause();
    }
    return;
  }

  if (e.code === "Space" || e.code === "Enter") {
    if (!isPaused && gameState !== "SELECT") {
      handleActionButton();
    }
  }
});

lockAimBtn.addEventListener("click", handleActionButton);
lockPowerBtn.addEventListener("click", handleActionButton);

pauseBtn.addEventListener("click", () => {
  if (gameState !== "SELECT") togglePause();
});

continueGameBtn.addEventListener("click", () => {
  togglePause();
});

function togglePause() {
  isPaused = !isPaused;
  if (isPaused) {
    pauseModal.classList.remove("hidden");
  } else {
    pauseModal.classList.add("hidden");
    lastTime = performance.now();
    requestAnimationFrame(gameLoop);
  }
}

function handleActionButton() {
  if (gameState === "AIMING") {
    lockedAim = aimPos;
    gameState = "POWER";
    aimGaugeContainer.classList.add("hidden");
    powerGaugeContainer.classList.remove("hidden");
  } else if (gameState === "POWER") {
    lockedPower = powerVal;
    gameState = "FLYING";
    powerGaugeContainer.classList.add("hidden");
    launchBall();
  }
}

/* =========================================================
   Game Session & Level Setup
   ========================================================= */

function promptArenaSelection() {
  gameState = "SELECT";
  isPaused = false;
  selectLevelNum.textContent = currentLevel;
  arenaSelectModal.classList.remove("hidden");
  statusModal.classList.add("hidden");
  pauseModal.classList.add("hidden");
  aimGaugeContainer.classList.add("hidden");
  powerGaugeContainer.classList.add("hidden");

  renderMiniStadiumPreviews();
}

function startLevelSession() {
  // Set Ring Speed based on Level
  const ringSpeeds = [1.2, 2.2, 3.4, 4.8, 6.2];
  targetRing.speed = ringSpeeds[currentLevel - 1];
  targetRing.x = canvas.width / 2;
  targetRing.dir = 1;
  targetRing.passedThrough = false;

  resetBallPosition();

  aimPos = 0;
  aimDir = 1;
  powerVal = 0;
  powerDir = 1;

  updateHUD();

  gameState = "AIMING";
  isPaused = false;
  aimGaugeContainer.classList.remove("hidden");
  powerGaugeContainer.classList.add("hidden");
  statusModal.classList.add("hidden");

  if (!animationFrameId) {
    animationFrameId = requestAnimationFrame(gameLoop);
  }
}

function resetBallPosition() {
  ball.x = canvas.width / 2;
  ball.y = 490;
  ball.z = 0;
  ball.vx = 0;
  ball.vy = 0;
  ball.vz = 0;
  ball.scale = 1;
  ball.rotation = 0;
  ball.passedPosts = false;
}

function updateHUD() {
  arenaDisplay.textContent = currentArena.name;
  levelDisplay.textContent = `${currentLevel}/${MAX_LEVELS}`;
  yardDisplay.textContent = `${currentArena.yardLine} YDS`;
  windDisplay.textContent = currentArena.windText;
  attemptsDisplay.textContent = `${attemptsLeft}/3`;
}

/* =========================================================
   Ball Launch & 3D Trajectory Mechanics
   ========================================================= */

function launchBall() {
  const distanceFactor = currentArena.yardLine / 30;
  ball.vz = (lockedPower / 100) * (18 / distanceFactor);
  ball.vy = -((lockedPower / 100) * 11);
  ball.vx = (lockedAim * 5.5) + (currentArena.wind * 0.22);
}

/* =========================================================
   Main Game Loop & Updates
   ========================================================= */

let lastTime = 0;

function gameLoop() {
  if (isPaused) {
    render();
    return;
  }

  update();
  render();
  animationFrameId = requestAnimationFrame(gameLoop);
}

function update() {
  if (gameState === "SELECT") return;

  // 1. Update Direction Aim Needle
  if (gameState === "AIMING") {
    aimPos += aimDir * aimSpeed;
    if (aimPos > 1) { aimPos = 1; aimDir = -1; }
    if (aimPos < -1) { aimPos = -1; aimDir = 1; }

    const needlePercent = ((aimPos + 1) / 2) * 100;
    aimNeedle.style.left = `${needlePercent}%`;
  }

  // 2. Update Power Meter
  if (gameState === "POWER") {
    powerVal += powerDir * powerSpeed;
    if (powerVal > 100) { powerVal = 100; powerDir = -1; }
    if (powerVal < 0) { powerVal = 0; powerDir = 1; }

    powerIndicator.style.width = `${powerVal}%`;
  }

  // 3. Update Levitating Red Ring
  targetRing.x += targetRing.dir * targetRing.speed;
  if (targetRing.x > targetRing.maxX) {
    targetRing.x = targetRing.maxX;
    targetRing.dir = -1;
  } else if (targetRing.x < targetRing.minX) {
    targetRing.x = targetRing.minX;
    targetRing.dir = 1;
  }

  // 4. Update Flying Ball Trajectory
  if (gameState === "FLYING") {
    ball.z += ball.vz;
    ball.x += ball.vx;
    ball.y += ball.vy;

    ball.vy += 0.22;
    ball.vx += currentArena.wind * 0.007;
    ball.rotation += 0.12;

    ball.scale = Math.max(0.2, 1 - (ball.z / 1100));

    // Ring Collision Check
    if (ball.z >= 420 && ball.z <= 560 && !targetRing.passedThrough) {
      const distToRing = Math.hypot(ball.x - targetRing.x, ball.y - targetRing.y);
      if (distToRing < targetRing.radiusX * 0.95) {
        targetRing.passedThrough = true;
      }
    }

    // Uprights Goal Check
    if (ball.z >= 900 && !ball.passedPosts) {
      ball.passedPosts = true;
      evaluateKickOutcome();
    }

    // Missed Short Check
    if (ball.y > 580 && !ball.passedPosts) {
      evaluateKickOutcome(true);
    }
  }

  // 5. Update Snowflakes
  if (currentArena.snow) {
    snowflakes.forEach((s) => {
      s.y += s.speedY;
      s.x += s.speedX + (currentArena.wind * 0.3);
      if (s.y > canvas.height) { s.y = -10; s.x = Math.random() * canvas.width; }
      if (s.x > canvas.width) s.x = 0;
      if (s.x < 0) s.x = canvas.width;
    });
  }
}

/* =========================================================
   Kick Evaluation & Progression
   ========================================================= */

function evaluateKickOutcome(missedShort = false) {
  gameState = "RESOLVED";

  const leftPostX = 390;
  const rightPostX = 570;
  const crossbarY = 280;

  const insidePosts = ball.x > leftPostX && ball.x < rightPostX && ball.y < crossbarY;
  const throughRing = targetRing.passedThrough;

  setTimeout(() => {
    if (!missedShort && insidePosts && throughRing) {
      // SUCCESSFUL FIELD GOAL
      if (currentLevel < MAX_LEVELS) {
        statusTitle.textContent = "IT'S GOOD!";
        statusTitle.style.color = "#22c55e";
        statusMessage.textContent = `Clean kick through the red ring and uprights! Level ${currentLevel} cleared.`;
        statusBtn.textContent = `Select Stadium for Level ${currentLevel + 1}`;
        statusBtn.onclick = () => {
          currentLevel++;
          attemptsLeft = 3;
          promptArenaSelection();
        };
      } else {
        // Champion of all 5 Levels
        statusTitle.textContent = "CHAMPION!";
        statusTitle.style.color = "#facc15";
        statusMessage.textContent = "Incredible precision! You conquered all 5 levels of Field Goal 101 Madness!";
        statusBtn.textContent = "Play Again";
        statusBtn.onclick = () => {
          currentLevel = 1;
          attemptsLeft = 3;
          promptArenaSelection();
        };
      }
    } else {
      // MISSED KICK
      attemptsLeft--;
      updateHUD();

      let reason = "";
      if (!throughRing) reason = "Missed the levitating red ring. ";
      else if (!insidePosts) reason = "Kicked wide or under the crossbar. ";
      else if (missedShort) reason = "Kick fell short of the goal line. ";

      if (attemptsLeft <= 0) {
        // 3 Misses in a single level = Full Game Over
        statusTitle.textContent = "GAME OVER!";
        statusTitle.style.color = "#ef4444";
        statusMessage.textContent = `${reason}You used all 3 attempts. Returning to Arena Selection.`;
        statusBtn.textContent = "Restart Game";
        statusBtn.onclick = () => {
          currentLevel = 1;
          attemptsLeft = 3;
          promptArenaSelection();
        };
      } else {
        // Retry Level with remaining chances
        statusTitle.textContent = "NO GOOD!";
        statusTitle.style.color = "#f97316";
        statusMessage.textContent = `${reason}Chances remaining: ${attemptsLeft}/3.`;
        statusBtn.textContent = "Try Again";
        statusBtn.onclick = () => {
          startLevelSession();
        };
      }
    }
    statusModal.classList.remove("hidden");
  }, 600);
}

/* =========================================================
   High-Definition Visual Rendering Engine
   ========================================================= */

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 1. Sky & Horizon Architecture
  renderSkyAndStadium();

  // 2. 3D Football Field Grid
  renderField();

  // 3. Goal Posts (Uprights)
  renderGoalPosts();

  // 4. Levitating Red Ring Target
  renderTargetRing();

  // 5. Upright Football with Laces Facing Out
  renderFootball();

  // 6. Snow Flurries
  if (currentArena.snow) {
    renderSnow();
  }
}

function renderSkyAndStadium() {
  const skyGrad = ctx.createLinearGradient(0, 0, 0, 320);
  skyGrad.addColorStop(0, currentArena.skyGrad[0]);
  skyGrad.addColorStop(0.6, currentArena.skyGrad[1]);
  skyGrad.addColorStop(1, currentArena.skyGrad[2]);
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, canvas.width, 320);

  if (currentArena.dome) {
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = 2;
    for (let x = 0; x < canvas.width; x += 80) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(canvas.width / 2, 220);
      ctx.stroke();
    }
  } else {
    ctx.fillStyle = "#1e293b";
    ctx.beginPath();
    ctx.moveTo(0, 300);
    ctx.lineTo(200, 240);
    ctx.lineTo(760, 240);
    ctx.lineTo(canvas.width, 300);
    ctx.lineTo(canvas.width, 320);
    ctx.lineTo(0, 320);
    ctx.closePath();
    ctx.fill();

    renderStadiumLight(140, 160);
    renderStadiumLight(820, 160);
  }
}

function renderStadiumLight(x, y) {
  ctx.fillStyle = "#475569";
  ctx.fillRect(x - 6, y, 12, 100);
  ctx.fillStyle = "#f8fafc";
  ctx.beginPath();
  ctx.arc(x, y, 16, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
  ctx.beginPath();
  ctx.arc(x, y, 38, 0, Math.PI * 2);
  ctx.fill();
}

function renderField() {
  const turfGrad = ctx.createLinearGradient(0, 300, 0, canvas.height);
  turfGrad.addColorStop(0, "#166534");
  turfGrad.addColorStop(0.5, "#15803d");
  turfGrad.addColorStop(1, "#14532d");
  ctx.fillStyle = turfGrad;
  ctx.fillRect(0, 300, canvas.width, 300);

  ctx.strokeStyle = "rgba(255, 255, 255, 0.65)";
  ctx.lineWidth = 2;

  const yPositions = [315, 340, 375, 420, 480, 560];
  yPositions.forEach((y, idx) => {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();

    if (idx > 1) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(380, y - 6, 8, 3);
      ctx.fillRect(572, y - 6, 8, 3);
    }
  });

  ctx.fillStyle = "#fbbf24";
  ctx.font = "bold 16px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`FIELD GOAL DISTANCE: ${currentArena.yardLine} YARDS`, canvas.width / 2, 335);
}

function renderGoalPosts() {
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
  ctx.shadowBlur = 10;

  ctx.fillStyle = "#facc15";
  ctx.strokeStyle = "#eab308";
  ctx.lineWidth = 3;

  ctx.fillRect(475, 280, 10, 80);
  ctx.strokeRect(475, 280, 10, 80);

  ctx.fillRect(390, 280, 180, 8);
  ctx.strokeRect(390, 280, 180, 8);

  ctx.fillRect(390, 110, 8, 170);
  ctx.strokeRect(390, 110, 8, 170);

  ctx.fillRect(562, 110, 8, 170);
  ctx.strokeRect(562, 110, 8, 170);

  ctx.fillStyle = "#f97316";
  ctx.fillRect(390, 100, 8, 10);
  ctx.fillRect(562, 100, 8, 10);

  ctx.restore();
}

function renderTargetRing() {
  ctx.save();
  ctx.translate(targetRing.x, targetRing.y);

  ctx.beginPath();
  ctx.ellipse(0, 0, targetRing.radiusX * 1.25, targetRing.radiusY * 1.25, 0, 0, Math.PI * 2);
  ctx.fillStyle = targetRing.passedThrough ? "rgba(34, 197, 94, 0.3)" : "rgba(239, 68, 68, 0.28)";
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(0, 0, targetRing.radiusX, targetRing.radiusY, 0, 0, Math.PI * 2);
  ctx.lineWidth = 7;
  ctx.strokeStyle = targetRing.passedThrough ? "#22c55e" : "#ef4444";
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(0, 0, targetRing.radiusX, targetRing.radiusY, 0, 0, Math.PI * 2);
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = "#ffffff";
  ctx.stroke();

  ctx.restore();
}

function renderFootball() {
  ctx.save();
  ctx.translate(ball.x, ball.y);
  ctx.scale(ball.scale, ball.scale);
  ctx.rotate(ball.rotation);

  if (gameState !== "FLYING") {
    ctx.beginPath();
    ctx.ellipse(0, 52, 28, 9, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.fill();

    ctx.fillStyle = "#0f172a";
    ctx.beginPath();
    ctx.moveTo(-16, 50);
    ctx.lineTo(16, 50);
    ctx.lineTo(10, 36);
    ctx.lineTo(-10, 36);
    ctx.closePath();
    ctx.fill();
  }

  // Upright Football
  ctx.beginPath();
  ctx.ellipse(0, 0, 26, 44, 0, 0, Math.PI * 2);
  const leatherGrad = ctx.createRadialGradient(-6, -10, 4, 0, 0, 44);
  leatherGrad.addColorStop(0, "#b45309");
  leatherGrad.addColorStop(0.6, "#78350f");
  leatherGrad.addColorStop(1, "#451a03");
  ctx.fillStyle = leatherGrad;
  ctx.fill();
  ctx.strokeStyle = "#381503";
  ctx.lineWidth = 2;
  ctx.stroke();

  // White Stripes
  ctx.strokeStyle = "#f8fafc";
  ctx.lineWidth = 3.5;

  ctx.beginPath();
  ctx.ellipse(0, -26, 17, 5, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(0, 26, 17, 5, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Football Laces Facing Outward
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(-2.5, -18, 5, 36);

  for (let y = -14; y <= 14; y += 7) {
    ctx.fillRect(-8, y - 1.5, 16, 3);
  }

  ctx.restore();
}

function renderSnow() {
  ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
  snowflakes.forEach((s) => {
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
    ctx.fill();
  });
}

// Initial Boot
promptArenaSelection();
