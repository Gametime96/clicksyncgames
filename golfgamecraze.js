/**
 * Golf Game Craze - Core Engine Script
 * Built with full 3D Orbit Perspective Tracking Camera System
 */

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// Interface DOM Bindings
const levelNumEl = document.getElementById("level-num");
const strokeCountEl = document.getElementById("stroke-count");
const powerBarContainer = document.getElementById("power-bar-container");
const powerBarFill = document.getElementById("power-bar-fill");
const pauseBtn = document.getElementById("pause-btn");

const introSplash = document.getElementById("intro-splash");
const instructionsScreen = document.getElementById("instructions-screen");
const startGameBtn = document.getElementById("start-game-btn");

const popupOverlay = document.getElementById("popup-overlay");
const popupTitle = document.getElementById("popup-title");
const popupDesc = document.getElementById("popup-desc");
const popupActionBtn = document.getElementById("popup-action-btn");

// Engine Mechanics Constraints
const STATE_LAUNCHING = "launching";
const STATE_AIMING = "aiming";
const STATE_POWER = "power";
const STATE_ROLLING = "rolling";
const STATE_PAUSED = "paused";
let gameState = STATE_LAUNCHING;
let alternatePrevState = STATE_AIMING; // Cache state for system pauses

let currentLevel = 1;
let levelStrokes = 0;
let totalStrokes = 0;

// Aim Tracker Vectors
let aimAngle = -Math.PI / 2; // Look forward natively
let cursorTrackerX = 0;
let cursorTrackerY = 0;

// Swing Power Metrics
let powerValue = 0;
let powerDirection = 1;
const POWER_SWING_SPEED = 3.8;

// Simulated Physical Properties
const CRITICAL_FRICTION = 0.988;
const SAND_TRAP_FRICTION = 0.89;
const CUP_CAPTURE_RADIUS = 13;
const CUP_PULL_RADIUS = 26;

// Level Map Topology Grid Map (True 2D Plane Space coordinates scaled dynamically)
const levelConfigurations = {
    1: { name: "Green Valley Fields", ballStart: { x: 400, y: 700 }, hole: { x: 400, y: 150 }, theme: "classic", obstacles: [{ type: "sand", x: 300, y: 450, rx: 70, ry: 45 }, { type: "sand", x: 500, y: 450, rx: 70, ry: 45 }, { type: "water", x: 400, y: 350, rx: 80, ry: 50 }] },
    2: { name: "Techno Grid Nexus", ballStart: { x: 400, y: 750 }, hole: { x: 400, y: 120 }, theme: "techno", obstacles: [{ type: "water", x: 400, y: 420, rx: 220, ry: 45 }, { type: "sand", x: 220, y: 250, rx: 60, ry: 35 }, { type: "sand", x: 580, y: 250, rx: 60, ry: 35 }] },
    3: { name: "Mirage Dunes", ballStart: { x: 200, y: 750 }, hole: { x: 600, y: 150 }, theme: "desert", obstacles: [{ type: "sand", x: 400, y: 450, rx: 160, ry: 75 }, { type: "water", x: 600, y: 300, rx: 65, ry: 40 }] },
    4: { name: "Whispering Pines Dawn", ballStart: { x: 400, y: 800 }, hole: { x: 400, y: 100 }, theme: "dawn", obstacles: [{ type: "water", x: 220, y: 450, rx: 110, ry: 60 }, { type: "water", x: 580, y: 450, rx: 110, ry: 60 }, { type: "sand", x: 400, y: 300, rx: 85, ry: 40 }] },
    5: { name: "Neon Glow Matrix", ballStart: { x: 600, y: 750 }, hole: { x: 200, y: 150 }, theme: "neon", obstacles: [{ type: "water", x: 400, y: 450, rx: 140, ry: 70 }, { type: "sand", x: 250, y: 550, rx: 80, ry: 45 }] },
    6: { name: "The Monochrome Link", ballStart: { x: 400, y: 850 }, hole: { x: 400, y: 80 }, theme: "monochrome", obstacles: [{ type: "water", x: 400, y: 500, rx: 180, ry: 50 }, { type: "sand", x: 250, y: 300, rx: 90, ry: 45 }, { type: "water", x: 400, y: 220, rx: 60, ry: 30 }] }
};

class PhysicsBall {
    constructor() {
        this.x = 0;
        this.y = 0;
        this.vx = 0;
        this.vy = 0;
        this.radius = 12;
        this.isSunk = false;
    }
    
    reset() {
        const config = levelConfigurations[currentLevel];
        this.x = config.ballStart.x;
        this.y = config.ballStart.y;
        this.vx = 0;
        this.vy = 0;
        this.isSunk = false;
    }

    update() {
        if (this.isSunk) return;

        let currentFriction = CRITICAL_FRICTION;
        const obstacle = checkObstacleCollision(this.x, this.y);

        if (obstacle) {
            if (obstacle.type === "sand") {
                currentFriction = SAND_TRAP_FRICTION;
            } else if (obstacle.type === "water") {
                // Instantly crash level progress out
                this.vx = 0;
                this.vy = 0;
                gameState = STATE_PAUSED;
                showPopupModal("Water Hazard!", "Your golf ball sank! Restarting level.", "Try Again", () => {
                    this.reset();
                    gameState = STATE_AIMING;
                    hidePopupModal();
                });
                return;
            }
        }

        this.vx *= currentFriction;
        this.vy *= currentFriction;

        // Attractor pull calculations toward target hole position
        const config = levelConfigurations[currentLevel];
        const dx = config.hole.x - this.x;
        const dy = config.hole.y - this.y;
        const targetDist = Math.hypot(dx, dy);

        if (targetDist < CUP_PULL_RADIUS) {
            const pullForce = (CUP_PULL_RADIUS - targetDist) / CUP_PULL_RADIUS;
            this.vx += (dx / targetDist) * pullForce * 0.45;
            this.vy += (dy / targetDist) * pullForce * 0.45;

            if (targetDist < CUP_CAPTURE_RADIUS && Math.hypot(this.vx, this.vy) < 4.0) {
                this.isSunk = true;
                this.vx = 0;
                this.vy = 0;
                this.x = config.hole.x;
                this.y = config.hole.y;
                handleHoleInSuccess();
                return;
            }
        }

        this.x += this.vx;
        this.y += this.vy;

        // Stop scanning velocity filter threshold
        if (Math.hypot(this.vx, this.vy) < 0.08) {
            this.vx = 0;
            this.vy = 0;
            gameState = STATE_AIMING;
        }
    }
}

const golfBall = new PhysicsBall();

function checkObstacleCollision(x, y) {
    const config = levelConfigurations[currentLevel];
    for (let obs of config.obstacles) {
        const dx = x - obs.x;
        const dy = y - obs.y;
        if ((dx * dx) / (obs.rx * obs.rx) + (dy * dy) / (obs.ry * obs.ry) <= 1) {
            return obs;
        }
    }
    return null;
}

// Global Camera Transform Matrix Properties (Updates to lock perspective behind ball pointing to cup target)
let Camera = {
    x: 0,
    y: 0,
    rotation: 0,
    zoomScale: 1
};

function updateCameraMatrix() {
    const config = levelConfigurations[currentLevel];
    
    // Position camera exactly tracking the ball coordinates
    Camera.x = golfBall.x;
    Camera.y = golfBall.y;
    
    // Calculate rotation angle to ensure target cup remains perfectly structured straight ahead ("up" on screen)
    const targetDx = config.hole.x - golfBall.x;
    const targetDy = config.hole.y - golfBall.y;
    
    // Lock default matrix projection axis perspective angle pointing upward natively
    Camera.rotation = Math.atan2(targetDy, targetDx) + Math.PI / 2;
}

// Projection Function: Dynamic 3D transformation system pipeline projecting 2D world spatial assets onto screen display viewport
function project3DWorldSpace(worldX, worldY) {
    // 1. Shift positions relatively centered directly over tracking Camera node matrix points
    let relX = worldX - Camera.x;
    let relY = worldY - Camera.y;

    // 2. Rotate tracking geometry nodes based on calculated Camera orbit parameters
    const cosR = Math.cos(-Camera.rotation);
    const sinR = Math.sin(-Camera.rotation);
    
    let rotatedX = relX * cosR - relY * sinR;
    let rotatedY = relX * sinR + relY * cosR;

    // 3. Apply 3D depth transformation matrix equations
    const horizonOffset = 260; 
    const depthScaleFactor = 320; 
    
    // Avoid coordinate computational failures behind viewing viewport matrices
    let relativeZ = rotatedY + depthScaleFactor;
    if (relativeZ <= 10) relativeZ = 10;

    const scale = depthScaleFactor / relativeZ;
    
    // Calculate final structural coordinates mapped safely over rendering context canvas dimensions
    const midCanvasX = canvas.width / 2;
    const baseHorizonLineY = canvas.height * 0.42;

    const projectedX = midCanvasX + rotatedX * scale;
    const projectedY = baseHorizonLineY + (rotatedY + horizonOffset) * scale;

    return {
        x: projectedX,
        y: projectedY,
        scale: scale * 1.1
    };
}

// Convert screen tap event back into clean absolute true world vectors
function screenCoordsToWorldAngle(screenX, screenY) {
    const midX = canvas.width / 2;
    const targetVectorDx = screenX - midX;
    
    // Returns relative tracking adjustments offset by modern matrix alignments
    let screenAngle = Math.atan2(screenY - (canvas.height * 0.75), targetVectorDx);
    return screenAngle + Camera.rotation - Math.PI / 2;
}

// Primary Responsive Canvas Autoscaling Utility
function performScreenRescale() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener("resize", performScreenRescale);
performScreenRescale();

// App Lifecycle Kick-off Hooks (Automating Splash sequences)
window.addEventListener("DOMContentLoaded", () => {
    // Retain 4 second fade workflow sequence cleanly
    setTimeout(() => {
        introSplash.style.opacity = "0";
        setTimeout(() => {
            introSplash.classList.add("hidden");
            instructionsScreen.classList.remove("hidden");
        }, 500);
    }, 4000);
});

startGameBtn.addEventListener("click", () => {
    instructionsScreen.classList.add("hidden");
    golfBall.reset();
    gameState = STATE_AIMING;
});

// Primary Render Engine Architecture Pipeline Loops
function tickEngine() {
    if (gameState === STATE_ROLLING) {
        golfBall.update();
    } else if (gameState === STATE_POWER) {
        powerValue += powerDirection * POWER_SWING_SPEED;
        if (powerValue >= 100) { powerValue = 100; powerDirection = -1; }
        if (powerValue <= 0) { powerValue = 0; powerDirection = 1; }
        powerBarFill.style.height = `${powerValue}%`;
    }

    // Process camera updates every tick frames to guarantee seamless locking profiles
    updateCameraMatrix();
    drawWorldGraphics();

    requestAnimationFrame(tickEngine);
}

function drawWorldGraphics() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const currentTheme = levelConfigurations[currentLevel].theme;

    // 1. Draw Environment Skies / Horizon Backdrop fills
    drawHorizonBackdrop(currentTheme);

    // 2. Draw Floor Plane Grid matrices
    draw3DGridFloor(currentTheme);

    // 3. Draw Obstacles (Sand / Streams)
    draw3DObstacles();

    // 4. Draw Core Target Cup & Flag pins
    draw3DHolePin();

    // 5. Draw Dynamic Ball entity
    if (!golfBall.isSunk) {
        draw3DBallEntity(currentTheme);
    }

    // 6. Draw Directional Billiard Aim overlay vector lines
    if (gameState === STATE_AIMING) {
        drawAimGuideVector(currentTheme);
    }
}

function drawHorizonBackdrop(theme) {
    let skyGrad = ctx.createLinearGradient(0, 0, 0, canvas.height * 0.45);
    
    if (theme === "classic") { skyGrad.addColorStop(0, "#87ceeb"); skyGrad.addColorStop(1, "#c6eafb"); }
    else if (theme === "techno") { skyGrad.addColorStop(0, "#020205"); skyGrad.addColorStop(1, "#0d1117"); }
    else if (theme === "desert") { skyGrad.addColorStop(0, "#f5d0a9"); skyGrad.addColorStop(1, "#f9e7b9"); }
    else if (theme === "dawn") { skyGrad.addColorStop(0, "#1a1c2e"); skyGrad.addColorStop(1, "#fd746c"); }
    else if (theme === "neon") { skyGrad.addColorStop(0, "#000000"); skyGrad.addColorStop(1, "#050a05"); }
    else if (theme === "monochrome") { skyGrad.addColorStop(0, "#222"); skyGrad.addColorStop(1, "#777"); }

    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height * 0.45);
}

function draw3DGridFloor(theme) {
    ctx.lineWidth = 1.5;

    // Set styling colors matching standard configurations
    if (theme === "classic") ctx.strokeStyle = "rgba(76, 175, 80, 0.25)";
    else if (theme === "techno") ctx.strokeStyle = "rgba(0, 242, 254, 0.22)";
    else if (theme === "desert") ctx.strokeStyle = "rgba(194, 142, 78, 0.3)";
    else if (theme === "dawn") ctx.strokeStyle = "rgba(255, 193, 7, 0.15)";
    else if (theme === "neon") ctx.strokeStyle = "rgba(57, 255, 20, 0.25)";
    else if (theme === "monochrome") ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";

    // Render longitudinal floor tracking lines
    const startRangeX = Math.floor(golfBall.x - 600);
    const endRangeX = Math.floor(golfBall.x + 600);
    
    for (let wx = startRangeX; wx <= endRangeX; wx += 80) {
        ctx.beginPath();
        let p1 = project3DWorldSpace(wx, golfBall.y - 800);
        let p2 = project3DWorldSpace(wx, golfBall.y + 400);
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
    }

    // Render lateral depth segments
    const startRangeY = Math.floor(golfBall.y - 800);
    const endRangeY = Math.floor(golfBall.y + 400);
    for (let wy = startRangeY; wy <= endRangeY; wy += 80) {
        ctx.beginPath();
        let p1 = project3DWorldSpace(golfBall.x - 600, wy);
        let p2 = project3DWorldSpace(golfBall.x + 600, wy);
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
    }
}

function draw3DObstacles() {
    const config = levelConfigurations[currentLevel];
    config.obstacles.forEach(obs => {
        const segments = 40;
        ctx.beginPath();
        
        for (let i = 0; i <= segments; i++) {
            let ang = (i / segments) * Math.PI * 2;
            let wx = obs.x + Math.cos(ang) * obs.rx;
            let wy = obs.y + Math.sin(ang) * obs.ry;
            let screenP = project3DWorldSpace(wx, wy);
            
            if (i === 0) ctx.moveTo(screenP.x, screenP.y);
            else ctx.lineTo(screenP.x, screenP.y);
        }
        ctx.closePath();

        // Color profiles handling mappings
        if (obs.type === "sand") {
            if (config.theme === "neon") { ctx.fillStyle = "rgba(255, 0, 255, 0.15)"; ctx.strokeStyle = "#ff00ff"; ctx.fill(); ctx.stroke(); }
            else if (config.theme === "monochrome") { ctx.fillStyle = "#888"; ctx.fill(); }
            else { ctx.fillStyle = "#ffebad"; ctx.fill(); }
        } else if (obs.type === "water") {
            if (config.theme === "neon") { ctx.fillStyle = "rgba(0, 255, 255, 0.2)"; ctx.strokeStyle = "#00ffff"; ctx.fill(); ctx.stroke(); }
            else if (config.theme === "monochrome") { ctx.fillStyle = "#333"; ctx.fill(); }
            else { ctx.fillStyle = "#2a80b9"; ctx.fill(); }
        }
    });
}

function draw3DHolePin() {
    const config = levelConfigurations[currentLevel];
    let holeP = project3DWorldSpace(config.hole.x, config.hole.y);
    let hr = 20 * holeP.scale;

    if (hr < 1) return;

    // Outer Target Rim
    ctx.beginPath();
    ctx.ellipse(holeP.x, holeP.y, hr, hr * 0.45, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#0c0f12";
    ctx.fill();

    // Vertical Pin Mast pole
    let poleH = 120 * holeP.scale;
    ctx.beginPath();
    ctx.moveTo(holeP.x, holeP.y);
    ctx.lineTo(holeP.x, holeP.y - poleH);
    ctx.lineWidth = 2.5 * holeP.scale;
    ctx.strokeStyle = config.theme === "neon" ? "#39ff14" : "#ffffff";
    ctx.stroke();

    // Render Flag Cloth Banner
    ctx.beginPath();
    ctx.moveTo(holeP.x, holeP.y - poleH);
    ctx.lineTo(holeP.x - (35 * holeP.scale), holeP.y - poleH + (12 * holeP.scale));
    ctx.lineTo(holeP.x, holeP.y - poleH + (24 * holeP.scale));
    ctx.closePath();
    ctx.fillStyle = config.theme === "neon" ? "#ff007f" : (config.theme === "monochrome" ? "#ffffff" : "#e74c3c");
    ctx.fill();
}

function draw3DBallEntity(theme) {
    let ballP = project3DWorldSpace(golfBall.x, golfBall.y);
    let br = golfBall.radius * ballP.scale;
    if (br < 1) return;

    // Ground shadows
    ctx.beginPath();
    ctx.ellipse(ballP.x, ballP.y + br * 0.35, br, br * 0.4, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fill();

    // Shading layers
    ctx.beginPath();
    ctx.arc(ballP.x, ballP.y, br, 0, Math.PI * 2);
    
    if (theme === "neon") {
        ctx.fillStyle = "#39ff14";
        ctx.fill();
    } else if (theme === "monochrome") {
        ctx.fillStyle = "#ffffff";
        ctx.fill();
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 1;
        ctx.stroke();
    } else {
        let radGrad = ctx.createRadialGradient(ballP.x - br*0.3, ballP.y - br*0.3, br*0.1, ballP.x, ballP.y, br);
        radGrad.addColorStop(0, "#ffffff");
        radGrad.addColorStop(0.85, "#dce2e6");
        radGrad.addColorStop(1, "#a6b1b9");
        ctx.fillStyle = radGrad;
        ctx.fill();
    }
}

function drawAimGuideVector(theme) {
    let ballP = project3DWorldSpace(golfBall.x, golfBall.y);
    
    // Convert current target calculations safely forward into world tracking coordinates
    let targetWorldX = golfBall.x + Math.cos(aimAngle) * 160;
    let targetWorldY = golfBall.y + Math.sin(aimAngle) * 160;
    
    let targetP = project3DWorldSpace(targetWorldX, targetWorldY);

    ctx.beginPath();
    ctx.setLineDash([8, 6]);
    ctx.moveTo(ballP.x, ballP.y);
    ctx.lineTo(targetP.x, targetP.y);
    
    ctx.strokeStyle = theme === "neon" ? "#39ff14" : (theme === "monochrome" ? "#ffffff" : "rgba(255,255,255,0.8)");
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.setLineDash([]); // Reset
}

// User Interaction Mapping Event Handlers
function recordPointerMovement(sx, sy) {
    if (gameState !== STATE_AIMING) return;
    aimAngle = screenCoordsToWorldAngle(sx, sy);
}

function processPointerAction() {
    if (gameState === STATE_AIMING) {
        // Toggle into swing power setup cycle
        gameState = STATE_POWER;
        powerValue = 0;
        powerDirection = 1;
        powerBarContainer.style.display = "flex";
    } else if (gameState === STATE_POWER) {
        // Lock power calculations and output immediate force impulse vectors
        gameState = STATE_ROLLING;
        powerBarContainer.style.display = "none";

        const relativeForce = (powerValue / 100) * 16.5;
        golfBall.vx = Math.cos(aimAngle) * relativeForce;
        golfBall.vy = Math.sin(aimAngle) * relativeForce;

        levelStrokes++;
        totalStrokes++;
        strokeCountEl.innerText = levelStrokes;
    }
}

// Handle Mouse inputs
window.addEventListener("mousemove", (e) => { recordPointerMovement(e.clientX, e.clientY); });
canvas.addEventListener("mousedown", (e) => { e.preventDefault(); processPointerAction(); });

// Handle Mobile Touch interfaces seamlessly
window.addEventListener("touchmove", (e) => {
    if (e.touches.length === 0) return;
    recordPointerMovement(e.touches[0].clientX, e.touches[0].clientY);
}, { passive: true });

canvas.addEventListener("touchstart", (e) => {
    e.preventDefault();
    processPointerAction();
});

// Pause Logic States Toggles
function updatePauseToggle() {
    if (gameState === STATE_LAUNCHING) return;
    
    if (gameState !== STATE_PAUSED) {
        alternatePrevState = gameState;
        gameState = STATE_PAUSED;
        pauseBtn.innerText = "Resume";
        showPopupModal("Game Paused", "Take a breather! Click below or press P to hop back into the action.", "Resume Game", () => {
            updatePauseToggle();
        });
    } else {
        gameState = alternatePrevState;
        pauseBtn.innerText = "Pause";
        hidePopupModal();
    }
}

pauseBtn.addEventListener("click", updatePauseToggle);
window.addEventListener("keydown", (e) => {
    if (e.key.toLowerCase() === "p") {
        updatePauseToggle();
    }
});

// Overlay Control wrappers
function showPopupModal(title, desc, btnTxt, callback) {
    popupTitle.innerText = title;
    popupDesc.innerText = desc;
    popupActionBtn.innerText = btnTxt;
    popupOverlay.classList.remove("hidden");
    popupActionBtn.onclick = callback;
}

function hidePopupModal() {
    popupOverlay.classList.add("hidden");
}

function handleHoleInSuccess() {
    gameState = STATE_PAUSED;
    let message = `Cleared Level ${currentLevel} using ${levelStrokes} stroke${levelStrokes > 1 ? 's' : ''}!`;
    let actionLabel = "Next Level";

    if (currentLevel === 6) {
        message = `Superb! You finished the entire run of Golf Game Craze with a score of ${totalStrokes} strokes!`;
        actionLabel = "Restart Game";
    }

    showPopupModal("Hole In One!", message, actionLabel, () => {
        if (currentLevel < 6) {
            currentLevel++;
        } else {
            currentLevel = 1;
            totalStrokes = 0;
        }
        levelStrokes = 0;
        levelNumEl.innerText = currentLevel;
        strokeCountEl.innerText = levelStrokes;
        golfBall.reset();
        gameState = STATE_AIMING;
        hidePopupModal();
    });
}

// Start Engine
tickEngine();
