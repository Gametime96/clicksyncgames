const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.style.border = 'none';
canvas.style.outline = 'none';
canvas.style.boxShadow = 'none';

let gameState = 'MENU'; 
let gameMode = 'PvP';   
let aiDifficulty = 'Mediocre'; 
let currentPlayer = 1;  
let shotActive = false;
let turnTimerTriggered = false;
let aiThinking = false;

let isBreakShot = true;  
let player1Suite = null; 
let player2Suite = null; 
let firstBallHit = null; 
let pocketedThisTurn = []; 
let transientMessage = "";
let messageTimer = 0;

const TABLE_X = 20;
const TABLE_Y = 60; 

const INNER_WIDTH = 760;
const INNER_HEIGHT = 380;
const BORDER = 40; 

const TABLE_WIDTH = INNER_WIDTH + 2 * BORDER;   
const TABLE_HEIGHT = INNER_HEIGHT + 2 * BORDER; 

canvas.width = 880;  
canvas.height = 640; 

const INNER_LEFT = TABLE_X + BORDER;
const INNER_RIGHT = TABLE_X + TABLE_WIDTH - BORDER;
const INNER_TOP = TABLE_Y + BORDER;
const INNER_BOTTOM = TABLE_Y + TABLE_HEIGHT - BORDER;
const CUSHION_WIDTH = 12;

const FRICTION = 0.985; 
const BOUNCE = 0.9;     
const BALL_RADIUS = 14;  
const POCKET_RADIUS = 32; 

const CUE_START_X = 250;
const CUE_START_Y = 290; 
const RACK_START_X = 630;
const RACK_START_Y = 290;

const BALL_COLORS = {
    1: '#facc15', 9: '#facc15',   
    2: '#2563eb', 10: '#2563eb',  
    3: '#dc2626', 11: '#dc2626',  
    4: '#7e22ce', 12: '#7e22ce',  
    5: '#ea580c', 13: '#ea580c',  
    6: '#16a34a', 14: '#16a34a',  
    7: '#78350f', 15: '#78350f',  
    8: '#111111'                  
};

const rackNumbers = [
    [1],
    [9, 2],
    [10, 8, 3],
    [11, 4, 12, 5],
    [6, 13, 14, 7, 15]
];

const pockets = [
    { x: INNER_LEFT, y: INNER_TOP },                               
    { x: INNER_LEFT + INNER_WIDTH / 2, y: INNER_TOP },                 
    { x: INNER_RIGHT, y: INNER_TOP },                    
    { x: INNER_LEFT, y: INNER_BOTTOM },                  
    { x: INNER_LEFT + INNER_WIDTH / 2, y: INNER_BOTTOM },    
    { x: INNER_RIGHT, y: INNER_BOTTOM }         
];

class Ball {
    constructor(x, y, color, number, type) {
        this.x = x; this.y = y; this.color = color; this.number = number;
        this.type = type; this.vx = 0; this.vy = 0; this.state = 'active'; 
        this.chuteAngle = 0; this.pole = { x: 0, y: 0, z: 1 };
    }

    draw() {
        if (this.state === 'pocketed') return; 

        ctx.save();
        ctx.translate(this.x, this.y);

        ctx.beginPath();
        ctx.arc(0, 0, BALL_RADIUS, 0, Math.PI * 2);
        ctx.clip();

        let px = this.pole.x; let py = this.pole.y; let pz = this.pole.z;
        let angle = Math.atan2(py, px);

        ctx.beginPath();
        ctx.arc(0, 0, BALL_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = (this.type === 'stripe' || this.type === 'cue') ? '#ffffff' : this.color;
        ctx.fill();

        if (this.type === 'stripe') {
            ctx.save();
            ctx.rotate(angle);
            ctx.fillStyle = this.color;
            ctx.fillRect(-BALL_RADIUS * 2, -BALL_RADIUS * 0.45, BALL_RADIUS * 4, BALL_RADIUS * 0.9);
            ctx.restore();
        }

        let drawPoleDetails = (poleX, poleY, poleZ, isFront) => {
            if (poleZ > 0) {
                let drawX = poleX * BALL_RADIUS; let drawY = poleY * BALL_RADIUS;
                if (this.type === 'cue') {
                    if (isFront) { 
                        ctx.beginPath(); ctx.arc(drawX, drawY, BALL_RADIUS * 0.25, 0, Math.PI * 2);
                        ctx.fillStyle = '#dc2626'; ctx.fill();
                    }
                } else {
                    ctx.beginPath(); ctx.arc(drawX, drawY, BALL_RADIUS * 0.55, 0, Math.PI * 2);
                    ctx.fillStyle = '#ffffff'; ctx.fill();
                    ctx.save(); ctx.translate(drawX, drawY); ctx.fillStyle = '#111111';
                    ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                    ctx.fillText(this.number, 0, 1); ctx.restore();
                }
            }
        };

        drawPoleDetails(px, py, pz, true);
        drawPoleDetails(-px, -py, -pz, false);

        ctx.restore(); 

        ctx.beginPath();
        ctx.arc(this.x, this.y, BALL_RADIUS, 0, Math.PI * 2);
        ctx.lineWidth = 1.5; ctx.strokeStyle = "#111111"; ctx.stroke();
    }

    update() {
        if (this.state === 'pocketed') return;
        if (this.state === 'chute_drop') {
            this.y += 2;
            if (this.y >= 550) { this.y = 550; this.state = 'chute_curve'; this.chuteAngle = Math.PI; }
            return;
        }
        if (this.state === 'chute_curve') {
            this.chuteAngle -= 0.05; 
            if (this.chuteAngle <= Math.PI / 2) {
                this.state = 'tube'; this.x = 240; this.y = 590; 
            } else {
                this.x = 240 + 40 * Math.cos(this.chuteAngle); this.y = 550 + 40 * Math.sin(this.chuteAngle); 
            }
            this.update3DSpin(2, 0); return;
        }
        if (this.state === 'tube') {
            let previousX = this.x; this.x += 3; 
            let limitX = 840; 
            for (let other of balls) {
                if (other !== this && other.state === 'tube' && other.x > this.x) {
                    limitX = Math.min(limitX, other.x - (BALL_RADIUS * 2) - 1); 
                }
            }
            if (this.x + BALL_RADIUS > limitX) this.x = limitX - BALL_RADIUS;
            if (this.x - previousX > 0) this.update3DSpin(this.x - previousX, 0);
            return; 
        }

        this.vx *= FRICTION; this.vy *= FRICTION;
        if (Math.abs(this.vx) < 0.05) this.vx = 0;
        if (Math.abs(this.vy) < 0.05) this.vy = 0;

        this.x += this.vx; this.y += this.vy;
        this.update3DSpin(this.vx, this.vy);

        if (this.x - BALL_RADIUS < INNER_LEFT + CUSHION_WIDTH) { this.x = INNER_LEFT + CUSHION_WIDTH + BALL_RADIUS; this.vx = -this.vx * BOUNCE; } 
        else if (this.x + BALL_RADIUS > INNER_RIGHT - CUSHION_WIDTH) { this.x = INNER_RIGHT - CUSHION_WIDTH - BALL_RADIUS; this.vx = -this.vx * BOUNCE; }

        if (this.y - BALL_RADIUS < INNER_TOP + CUSHION_WIDTH) { this.y = INNER_TOP + CUSHION_WIDTH + BALL_RADIUS; this.vy = -this.vy * BOUNCE; } 
        else if (this.y + BALL_RADIUS > INNER_BOTTOM - CUSHION_WIDTH) { this.y = INNER_BOTTOM - CUSHION_WIDTH - BALL_RADIUS; this.vy = -this.vy * BOUNCE; }

        for (let pocket of pockets) {
            if (Math.hypot(this.x - pocket.x, this.y - pocket.y) < POCKET_RADIUS && this.state === 'active') {
                this.state = 'pocketed'; this.vx = 0; this.vy = 0;
                if (shotActive) pocketedThisTurn.push(this);
                if (this.type !== 'cue' && this.type !== '8ball') {
                    setTimeout(() => { this.state = 'chute_drop'; this.x = 200; this.y = TABLE_Y + TABLE_HEIGHT; }, 2000);
                }
            }
        }
    }

    update3DSpin(moveX, moveY) {
        let speed = Math.hypot(moveX, moveY);
        if (speed > 0.01) {
            let ax = moveY / speed; let ay = -moveX / speed; let az = 0;
            let theta = speed / BALL_RADIUS; let cosT = Math.cos(theta); let sinT = Math.sin(theta);
            let px = this.pole.x; let py = this.pole.y; let pz = this.pole.z;
            let dot = ax*px + ay*py + az*pz;
            let cx = ay*pz - az*py; let cy = az*px - ax*pz; let cz = ax*py - ay*px;

            this.pole.x = px * cosT + cx * sinT + ax * dot * (1 - cosT);
            this.pole.y = py * cosT + cy * sinT + ay * dot * (1 - cosT);
            this.pole.z = pz * cosT + cz * sinT + az * dot * (1 - cosT);

            let mag = Math.hypot(this.pole.x, this.pole.y, this.pole.z);
            this.pole.x /= mag; this.pole.y /= mag; this.pole.z /= mag;
        }
    }
}

let balls = [];
const cueBall = new Ball(CUE_START_X, CUE_START_Y, '#ffffff', 0, 'cue');
balls.push(cueBall);

const spacing = 1; 
for (let row = 0; row < 5; row++) {
    for (let col = 0; col <= row; col++) {
        const num = rackNumbers[row][col];
        let type = 'solid';
        if (num > 8) type = 'stripe';
        if (num === 8) type = '8ball';
        const color = BALL_COLORS[num];
        const x = RACK_START_X + (row * (BALL_RADIUS * 2 * 0.866)); 
        const y = RACK_START_Y - (row * BALL_RADIUS) + (col * (BALL_RADIUS * 2 + spacing));
        balls.push(new Ball(x, y, color, num, type));
    }
}

function checkCollisions() {
    for (let i = 0; i < balls.length; i++) {
        for (let j = i + 1; j < balls.length; j++) {
            let b0 = balls[i], b1 = balls[j];
            if (b0.state !== 'active' || b1.state !== 'active') continue;

            const dx = b1.x - b0.x, dy = b1.y - b0.y;
            const distance = Math.hypot(dx, dy); 
            const minAllowedDistance = (BALL_RADIUS * 2) + 1.2;

            if (distance < minAllowedDistance) {
                if (shotActive && !firstBallHit) {
                    if (b0.type === 'cue') firstBallHit = b1;
                    else if (b1.type === 'cue') firstBallHit = b0;
                }

                const overlap = minAllowedDistance - distance;
                const v0 = Math.hypot(b0.vx, b0.vy), v1 = Math.hypot(b1.vx, b1.vy);
                const totalV = v0 + v1;

                let ratio0 = 0.5, ratio1 = 0.5;
                if (totalV > 0) { ratio0 = v0 / totalV; ratio1 = v1 / totalV; }
                
                const nx = dx / distance, ny = dy / distance;
                b0.x -= nx * (overlap * ratio0); b0.y -= ny * (overlap * ratio0);
                b1.x += nx * (overlap * ratio1); b1.y += ny * (overlap * ratio1);

                const angle = Math.atan2(dy, dx);
                const sin = Math.sin(angle), cos = Math.cos(angle);

                const v0x = b0.vx * cos + b0.vy * sin, v0y = b0.vy * cos - b0.vx * sin;
                const v1x = b1.vx * cos + b1.vy * sin, v1y = b1.vy * cos - b1.vx * sin;

                const finalV0x = v1x * BOUNCE, finalV1x = v0x * BOUNCE;

                b0.vx = finalV0x * cos - v0y * sin; b0.vy = v0y * cos + finalV0x * sin;
                b1.vx = finalV1x * cos - v1y * sin; b1.vy = v1y * cos + finalV1x * sin;
            }
        }
    }
}

function areBallsMoving() {
    for (let b of balls) { if (b.state === 'active' && (Math.abs(b.vx) > 0 || Math.abs(b.vy) > 0)) return true; }
    return false;
}

function evaluateShot() {
    let foul = false, turnContinues = false, newlyAssigned = false;
    let mySuite = currentPlayer === 1 ? player1Suite : player2Suite;
    let playerStr = currentPlayer === 1 ? "Player 1" : (gameMode === 'PvP' ? "Player 2" : "Computer");
    
    if (pocketedThisTurn.some(b => b.type === 'cue')) foul = true;
    
    if (pocketedThisTurn.some(b => b.type === '8ball')) {
        if (isBreakShot) { alert(`WOW! ${playerStr} sunk the 8-Ball on the break and WINS THE GAME!`); window.location.reload(); return; } 
        else {
            let myBallsLeft = mySuite ? balls.filter(b => b.type === mySuite && b.state === 'active').length : 15;
            if (myBallsLeft === 0 && !foul) alert(`YOU WIN! ${playerStr} legally sunk the 8-Ball.`);
            else alert(`GAME OVER! ${playerStr} illegally sunk the 8-Ball.`);
            window.location.reload(); return;
        }
    }

    if (!firstBallHit) foul = true; 
    else {
        if (mySuite) {
            if (firstBallHit.type !== mySuite && firstBallHit.type !== '8ball') foul = true;
            if (firstBallHit.type === '8ball' && balls.filter(b => b.type === mySuite && b.state === 'active').length > 0) foul = true;
        } else {
            if (firstBallHit.type === '8ball') foul = true;
        }
    }
    
    for (let b of pocketedThisTurn) {
        if (b.type !== 'cue' && b.type !== '8ball') {
            if (!mySuite && !foul) {
                if (currentPlayer === 1) { player1Suite = b.type; player2Suite = b.type === 'solid' ? 'stripe' : 'solid'; } 
                else { player2Suite = b.type; player1Suite = b.type === 'solid' ? 'stripe' : 'solid'; }
                mySuite = b.type; newlyAssigned = true; turnContinues = true;
            } else if (b.type === mySuite && !foul) { turnContinues = true; }
        }
    }
    
    if (foul) {
        turnContinues = false; transientMessage = "FOUL! Opponent gets Cue Ball in Hand."; messageTimer = 180; 
        cueBall.state = 'active'; cueBall.x = CUE_START_X; cueBall.y = CUE_START_Y; cueBall.vx = 0; cueBall.vy = 0;
    } else if (newlyAssigned) { transientMessage = `${playerStr} is now ${mySuite.toUpperCase()}S!`; messageTimer = 150; } 
    else if (!turnContinues) { transientMessage = "Turn Ends."; messageTimer = 90; } 
    else { transientMessage = "Nice Shot! Keep going."; messageTimer = 90; }
    
    if (!turnContinues) currentPlayer = currentPlayer === 1 ? 2 : 1;
    
    shotActive = false; firstBallHit = null; isBreakShot = false; pocketedThisTurn = [];
    
    if (gameMode === 'PvC' && currentPlayer === 2) {
        aiThinking = true; setTimeout(takeComputerTurn, 1500);
    }
}

function takeComputerTurn() {
    if (gameState !== 'PLAYING') return;
    let mySuite = player2Suite, targets = [];
    if (!mySuite) targets = balls.filter(b => (b.type === 'solid' || b.type === 'stripe') && b.state === 'active');
    else targets = balls.filter(b => b.type === mySuite && b.state === 'active');
    if (targets.length === 0) targets = balls.filter(b => b.type === '8ball' && b.state === 'active');
    if (targets.length === 0) return; 

    let bestShot = null, minScore = Infinity;

    for (let t of targets) {
        for (let p of pockets) {
            let score = Math.hypot(t.x - p.x, t.y - p.y) + (Math.hypot(t.x - cueBall.x, t.y - cueBall.y) * 0.4);
            if (score < minScore) { minScore = score; bestShot = { target: t, pocket: p }; }
        }
    }

    if (bestShot) {
        let dx = bestShot.target.x - bestShot.pocket.x, dy = bestShot.target.y - bestShot.pocket.y;
        let mag = Math.hypot(dx, dy);
        let gx = bestShot.target.x + (dx / mag) * (BALL_RADIUS * 2), gy = bestShot.target.y + (dy / mag) * (BALL_RADIUS * 2);

        let shootDx = gx - cueBall.x, shootDy = gy - cueBall.y;
        let shootMag = Math.hypot(shootDx, shootDy);
        let power = Math.min(Math.max((Math.hypot(bestShot.target.x - bestShot.pocket.x, bestShot.target.y - bestShot.pocket.y) + Math.hypot(bestShot.target.x - cueBall.x, bestShot.target.y - cueBall.y)) * 0.03, 12), 30); 

        let errorAngle = (Math.random() - 0.5) * (aiDifficulty === 'Expert' ? 0.005 : (aiDifficulty === 'Beginner' ? 0.12 : 0.04)); 
        let finalDx = shootDx * Math.cos(errorAngle) - shootDy * Math.sin(errorAngle);
        let finalDy = shootDx * Math.sin(errorAngle) + shootDy * Math.cos(errorAngle);

        cueBall.vx = (finalDx / shootMag) * power; cueBall.vy = (finalDy / shootMag) * power;
    } else {
        cueBall.vx = 20; cueBall.vy = 5;
    }
    shotActive = true; turnTimerTriggered = false; aiThinking = false;
}


// --- NEW 3-STEP RESPONSIVE MOBILE AIMING CONTROLS ---
let aimState = 'idle'; // idle -> aiming -> power
let aimAngle = 0;
let powerLevel = 0;
let powerDir = 1;
let isDraggingAim = false;
const MAX_POWER = 35; 

// Exactly 1 second to reach MAX_POWER at 60 FPS
const POWER_SPEED = MAX_POWER / 60; 

function getMousePos(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    let clientX = e.clientX;
    let clientY = e.clientY;
    
    if (e.touches && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    } else if (e.changedTouches && e.changedTouches.length > 0) {
        clientX = e.changedTouches[0].clientX;
        clientY = e.changedTouches[0].clientY;
    }
    return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY
    };
}

function handleInputStart(e) {
    if (e.cancelable) e.preventDefault();
    const pos = getMousePos(e);
    
    if (gameState === 'MENU') {
        if (pos.x > (canvas.width / 2 - 140) && pos.x < (canvas.width / 2 + 140)) {
            if (pos.y > 200 && pos.y < 250) { gameMode = 'PvP'; gameState = 'PLAYING'; cueBall.pole = { x: -1, y: 0, z: 0.1 }; } 
            else if (pos.y > 270 && pos.y < 320) { gameMode = 'PvC'; aiDifficulty = 'Beginner'; gameState = 'PLAYING'; cueBall.pole = { x: -1, y: 0, z: 0.1 }; } 
            else if (pos.y > 340 && pos.y < 390) { gameMode = 'PvC'; aiDifficulty = 'Mediocre'; gameState = 'PLAYING'; cueBall.pole = { x: -1, y: 0, z: 0.1 }; } 
            else if (pos.y > 410 && pos.y < 460) { gameMode = 'PvC'; aiDifficulty = 'Expert'; gameState = 'PLAYING'; cueBall.pole = { x: -1, y: 0, z: 0.1 }; }
        }
        return;
    }

    let isHumanTurn = (currentPlayer === 1) || (gameMode === 'PvP' && currentPlayer === 2);
    if (gameState === 'PLAYING' && isHumanTurn && cueBall.vx === 0 && cueBall.vy === 0 && cueBall.state === 'active' && !shotActive) {
        
        // 3. Third Click: Shoot
        if (aimState === 'power') {
            // Check Cancel Button
            if (pos.x > canvas.width - 140 && pos.x < canvas.width - 20 && pos.y > 15 && pos.y < 55) {
                aimState = 'idle'; powerLevel = 0; return;
            }

            let finalPower = Math.max(powerLevel, 2);
            cueBall.vx = Math.cos(aimAngle) * finalPower;
            cueBall.vy = Math.sin(aimAngle) * finalPower;
            shotActive = true; turnTimerTriggered = false; aimState = 'idle'; powerLevel = 0;
            return;
        }

        // 1. First Click: Start Aiming
        if (aimState === 'idle') {
            aimState = 'aiming';
            isDraggingAim = true;
            aimAngle = Math.atan2(pos.y - cueBall.y, pos.x - cueBall.x);
            return;
        }

        // 2. Second Click: Lock Aim, Start Power Meter
        if (aimState === 'aiming') {
            aimState = 'power';
            powerLevel = 0; 
            powerDir = 1;
            isDraggingAim = false;
            return;
        }
    }
}

function handleInputMove(e) {
    if (e.cancelable) e.preventDefault();
    if (aimState === 'aiming' && isDraggingAim) {
        const pos = getMousePos(e);
        aimAngle = Math.atan2(pos.y - cueBall.y, pos.x - cueBall.x);
    }
}

function handleInputEnd(e) {
    if (e.cancelable) e.preventDefault();
    if (aimState === 'aiming' && isDraggingAim) {
        isDraggingAim = false;
    }
}

canvas.addEventListener('mousedown', handleInputStart);
canvas.addEventListener('mousemove', handleInputMove);
canvas.addEventListener('mouseup', handleInputEnd);
canvas.addEventListener('touchstart', handleInputStart, {passive: false});
canvas.addEventListener('touchmove', handleInputMove, {passive: false});
canvas.addEventListener('touchend', handleInputEnd);

// --- RENDER GRAPHICS ---
function drawMenu() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 50px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('2D BILLIARDS', canvas.width / 2, 130);

    ctx.fillStyle = '#2563eb'; ctx.fillRect(canvas.width / 2 - 140, 200, 280, 50); ctx.fillStyle = '#ffffff'; ctx.font = 'bold 20px sans-serif'; ctx.fillText('Player 1 vs Player 2', canvas.width / 2, 232);
    ctx.fillStyle = '#16a34a'; ctx.fillRect(canvas.width / 2 - 140, 270, 280, 50); ctx.fillStyle = '#ffffff'; ctx.fillText('PvC - Beginner', canvas.width / 2, 302);
    ctx.fillStyle = '#ea580c'; ctx.fillRect(canvas.width / 2 - 140, 340, 280, 50); ctx.fillStyle = '#ffffff'; ctx.fillText('PvC - Mediocre', canvas.width / 2, 372);
    ctx.fillStyle = '#dc2626'; ctx.fillRect(canvas.width / 2 - 140, 410, 280, 50); ctx.fillStyle = '#ffffff'; ctx.fillText('PvC - Expert', canvas.width / 2, 442);
}

function drawUI() {
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 20px sans-serif'; ctx.textAlign = 'center';
    let p1Str = player1Suite ? `(${player1Suite.toUpperCase()}S)` : '';
    let p2Str = player2Suite ? `(${player2Suite.toUpperCase()}S)` : '';
    ctx.fillText(`Player 1 ${p1Str} vs ${gameMode === 'PvC' ? `Computer ${p2Str}` : `Player 2 ${p2Str}`}`, canvas.width / 2, 25);
    ctx.fillStyle = '#facc15'; ctx.fillText(currentPlayer === 1 ? "Player 1's Turn" : (gameMode === 'PvC' ? "Computer is Thinking..." : "Player 2's Turn"), canvas.width / 2, 50);

    if (messageTimer > 0) {
        ctx.fillStyle = '#ff3333'; ctx.fillText(transientMessage, canvas.width / 2, TABLE_Y + TABLE_HEIGHT + 25); messageTimer--;
    }

    if (aimState === 'power') {
        ctx.fillStyle = '#e74c3c';
        ctx.fillRect(canvas.width - 140, 15, 120, 40);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px sans-serif';
        ctx.fillText('Cancel Aim', canvas.width - 80, 41);
    }
}

function drawTable() {
    ctx.fillStyle = '#5c4033'; ctx.fillRect(TABLE_X, TABLE_Y, TABLE_WIDTH, TABLE_HEIGHT);
    ctx.strokeStyle = '#2b1a10'; ctx.lineWidth = 4; ctx.strokeRect(TABLE_X, TABLE_Y, TABLE_WIDTH, TABLE_HEIGHT);
    ctx.fillStyle = '#ffffff';
    let markers = []; const segment = INNER_WIDTH / 8; 
    
    for (let i = 1; i <= 7; i++) {
        if (i === 4) continue; 
        markers.push([INNER_LEFT + i * segment, TABLE_Y + BORDER / 2]); markers.push([INNER_LEFT + i * segment, INNER_BOTTOM + BORDER / 2]); 
    }
    for (let i = 1; i <= 3; i++) {
        if (i === 2) continue;
        markers.push([TABLE_X + BORDER / 2, INNER_TOP + i * segment * 2]); markers.push([INNER_RIGHT + BORDER / 2, INNER_TOP + i * segment * 2]); 
    }
    for (let m of markers) { ctx.beginPath(); ctx.arc(m[0], m[1], 4, 0, Math.PI * 2); ctx.fill(); }

    ctx.fillStyle = '#0f5e1e'; ctx.fillRect(INNER_LEFT, INNER_TOP, INNER_WIDTH, INNER_HEIGHT);
    ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    for (let i = 1; i <= CUSHION_WIDTH; i+=1.5) ctx.strokeRect(INNER_LEFT + i, INNER_TOP + i, INNER_WIDTH - 2*i, INNER_HEIGHT - 2*i);

    for (let pocket of pockets) {
        ctx.save(); ctx.translate(pocket.x, pocket.y); ctx.fillStyle = '#111111'; ctx.beginPath();
        ctx.arc(0, 0, POCKET_RADIUS, 0, Math.PI * 2); ctx.fill(); ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#2b1a10'; ctx.stroke(); ctx.closePath(); ctx.restore();
    }
}

function drawExternalReturnSystemBase() {
    ctx.fillStyle = '#1a1a1a'; ctx.fillRect(0, TABLE_Y + TABLE_HEIGHT + 2, canvas.width, canvas.height - (TABLE_Y + TABLE_HEIGHT));
    ctx.beginPath(); ctx.moveTo(170, 520); ctx.lineTo(170, 550); ctx.arcTo(170, 620, 240, 620, 70); 
    ctx.lineTo(860, 620); ctx.lineTo(860, 560); ctx.lineTo(240, 560); ctx.arcTo(230, 560, 230, 550, 10); 
    ctx.lineTo(230, 520); ctx.closePath();
    ctx.fillStyle = '#111111'; ctx.fill(); ctx.strokeStyle = '#333333'; ctx.lineWidth = 2; ctx.stroke();
}

function drawExternalReturnSystemGlass() {
    ctx.beginPath(); ctx.moveTo(170, 520); ctx.lineTo(170, 550); ctx.arcTo(170, 620, 240, 620, 70); 
    ctx.lineTo(860, 620); ctx.lineTo(860, 560); ctx.lineTo(240, 560); ctx.arcTo(230, 560, 230, 550, 10); 
    ctx.lineTo(230, 520); ctx.closePath(); ctx.fillStyle = 'rgba(255, 255, 255, 0.05)'; ctx.fill();
}

function drawAimingTrajectory() {
    if (aimState === 'idle') return;
    let isHumanTurn = (currentPlayer === 1) || (gameMode === 'PvP' && currentPlayer === 2);
    if (!isHumanTurn) return;

    if (aimState === 'aiming') {
        ctx.beginPath();
        ctx.arc(cueBall.x, cueBall.y, BALL_RADIUS * 6, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(128, 128, 128, 0.5)';
        ctx.fill();
    }

    let dirX = Math.cos(aimAngle);
    let dirY = Math.sin(aimAngle);
    
    // Limits dashed line to 30% of table width
    const maxLength = INNER_WIDTH * 0.3; 
    let simX = cueBall.x; let simY = cueBall.y; let traveled = 0;
    const DASH_LEN = 12; const GAP_LEN = 8;

    ctx.lineCap = 'round';
    let breakOuter = false;

    while (traveled < maxLength && !breakOuter) {
        let drawDist = 0;
        
        ctx.beginPath();
        ctx.moveTo(simX, simY);

        while (drawDist < DASH_LEN && traveled < maxLength) {
            simX += dirX; simY += dirY; traveled++; drawDist++;

            for (let pocket of pockets) { if (Math.hypot(simX - pocket.x, simY - pocket.y) < POCKET_RADIUS) breakOuter = true; }
            if (simX - BALL_RADIUS <= INNER_LEFT + CUSHION_WIDTH || simX + BALL_RADIUS >= INNER_RIGHT - CUSHION_WIDTH || 
                simY - BALL_RADIUS <= INNER_TOP + CUSHION_WIDTH || simY + BALL_RADIUS >= INNER_BOTTOM - CUSHION_WIDTH) { breakOuter = true; }
            
            for (let ball of balls) {
                if (ball.state !== 'active' || ball === cueBall) continue;
                if (Math.hypot(simX - ball.x, simY - ball.y) <= (BALL_RADIUS * 2)) breakOuter = true;
            }
            
            ctx.lineTo(simX, simY);
            if (breakOuter) break; 
        }

        ctx.strokeStyle = `rgba(255, 255, 255, 0.8)`; 
        ctx.lineWidth = 3; 
        ctx.stroke();

        if (breakOuter) break;

        let gapDist = 0;
        while (gapDist < GAP_LEN && traveled < maxLength) {
            simX += dirX; simY += dirY; traveled++; gapDist++;
            for (let pocket of pockets) { if (Math.hypot(simX - pocket.x, simY - pocket.y) < POCKET_RADIUS) breakOuter = true; }
            if (simX - BALL_RADIUS <= INNER_LEFT + CUSHION_WIDTH || simX + BALL_RADIUS >= INNER_RIGHT - CUSHION_WIDTH || 
                simY - BALL_RADIUS <= INNER_TOP + CUSHION_WIDTH || simY + BALL_RADIUS >= INNER_BOTTOM - CUSHION_WIDTH) { breakOuter = true; }
            for (let ball of balls) {
                if (ball.state !== 'active' || ball === cueBall) continue;
                if (Math.hypot(simX - ball.x, simY - ball.y) <= (BALL_RADIUS * 2)) breakOuter = true;
            }
            if (breakOuter) break;
        }
    }
}

function drawCueStick() {
    if (aimState === 'idle') return;
    let isHumanTurn = (currentPlayer === 1) || (gameMode === 'PvP' && currentPlayer === 2);
    if (!isHumanTurn) return;

    let pullBack = aimState === 'aiming' ? 20 : 20 + (powerLevel / MAX_POWER) * 150; 

    ctx.save(); 
    ctx.translate(cueBall.x, cueBall.y); 
    ctx.rotate(aimAngle + Math.PI); 

    ctx.beginPath(); ctx.moveTo(BALL_RADIUS + pullBack, 0); ctx.lineTo(BALL_RADIUS + 200 + pullBack, 0);
    ctx.strokeStyle = '#d4a373'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.stroke();
    
    ctx.beginPath(); ctx.moveTo(BALL_RADIUS + pullBack, 0); ctx.lineTo(BALL_RADIUS + 10 + pullBack, 0);
    ctx.strokeStyle = '#333333'; ctx.lineWidth = 6; ctx.stroke();
    ctx.restore(); 
}

function drawPowerMeter() {
    if (aimState === 'power') {
        const width = 20; const height = 150; const x = INNER_LEFT + 20; const y = INNER_BOTTOM - height - 20;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'; ctx.fillRect(x, y, width, height);
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.strokeRect(x, y, width, height);

        const fillHeight = (powerLevel / MAX_POWER) * height; const ratio = powerLevel / MAX_POWER;
        ctx.fillStyle = `rgb(${Math.min(255, ratio * 2 * 255)}, ${Math.min(255, (1 - ratio) * 2 * 255)}, 0)`;
        ctx.fillRect(x, y + height - fillHeight, width, fillHeight);
        ctx.fillStyle = '#ffffff'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('MAX', x + width / 2, y - 10); ctx.fillText('POWER', x + width / 2, y + height + 16);
    }
}

let lastTime = performance.now();
const fpsInterval = 1000 / 60; 

function gameLoop(currentTime) {
    requestAnimationFrame(gameLoop);
    let deltaTime = currentTime - lastTime;
    
    if (deltaTime >= fpsInterval) {
        lastTime = currentTime - (deltaTime % fpsInterval);

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (gameState === 'MENU') { drawMenu(); return; }

        if (aimState === 'power') {
            powerLevel += powerDir * POWER_SPEED;
            if (powerLevel >= MAX_POWER) { powerLevel = MAX_POWER; powerDir = -1; } 
            else if (powerLevel <= 0) { powerLevel = 0; powerDir = 1; }
        }

        if (shotActive && !areBallsMoving() && !turnTimerTriggered) {
            turnTimerTriggered = true; setTimeout(() => { evaluateShot(); }, 1000);
        }

        drawUI(); drawExternalReturnSystemBase(); drawTable(); drawAimingTrajectory();
        
        for (let ball of balls) { ball.update(); } checkCollisions();
        for (let ball of [...balls].sort((a, b) => a.type === 'cue' ? 1 : -1)) { ball.draw(); }
        
        drawExternalReturnSystemGlass(); drawCueStick(); drawPowerMeter();
    }
}

requestAnimationFrame(gameLoop);
