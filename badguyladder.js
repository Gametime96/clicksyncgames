const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
    const container = document.getElementById('game-container');
    if (container) {
        canvas.width = container.clientWidth - 280;
        canvas.height = container.clientHeight;
    }
}
window.addEventListener('resize', resizeCanvas);
// Run once on load to establish size
setTimeout(resizeCanvas, 100);

// --- GAME CONFIG & STATE ---
let points = 50, level = 1, gameState = 'intro';
let slowActive = false, slowTimer = 0;
let isPaused = false;
let currentPlatformSpacing = 160; 
const GRAVITY = 0.4;
const PLAYER_JUMP = -7; 

const keys = { left: false, right: false, up: false, down: false };

// --- ENTITIES ---
const player = { x: 50, y: 0, w: 30, h: 50, vx: 0, vy: 0, grounded: false, onLadder: false, carrying: null };
let badGuys = [];
let termites = [];
let platforms = [], ladders = [], blocks = [], doors = [], deadPadlocks = [];
let coin = { x: 0, y: 0, active: false };

// --- ASSET DRAWING ---
function drawHuman(ctx, x, y, w, h, shirtColor, pantsColor, hasHammer = false, swingProgress = 0, alpha = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;
    
    ctx.fillStyle = "#ffdbac"; 
    ctx.fillRect(x + w*0.25, y, w*0.5, h*0.25);
    ctx.fillStyle = shirtColor;
    ctx.fillRect(x, y + h*0.25, w, h*0.4);
    ctx.fillStyle = pantsColor;
    ctx.fillRect(x + w*0.1, y + h*0.65, w*0.8, h*0.35);
    
    if(hasHammer) {
        ctx.save();
        ctx.translate(x + w/2, y + h*0.4); 
        let angle = swingProgress > 0 ? (Math.sin(swingProgress * Math.PI) * 1.5) : 0;
        ctx.rotate(-angle); 
        
        let scale = h / 55;
        ctx.scale(scale, scale);

        ctx.fillStyle = "#7f8c8d"; 
        ctx.fillRect(-20, -10, 20, 15);
        ctx.fillStyle = "#5d4037"; 
        ctx.fillRect(-10, -10, 5, 40);
        ctx.restore();
    }
    ctx.restore();
}

function drawTermite(ctx, t) {
    let x = t.x || 0;
    let y = t.y || 0;
    let w = t.w || 60;
    let h = t.h || 30;
    let bitingFrameCount = t.bitingFrameCount || 0;
    
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    ctx.scale(0.8, 0.8); 
    
    let progressFactor = bitingFrameCount > 0 ? bitingFrameCount / 20 : 0;
    let biteFactor = Math.sin(progressFactor * Math.PI); 
    
    ctx.fillStyle = "#d35400"; ctx.beginPath(); ctx.ellipse(-w * 0.15, 0, w * 0.35, h * 0.35, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#e67e22"; ctx.beginPath(); ctx.ellipse(-w * 0.25, 0, w * 0.25, h * 0.25, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#f39c12"; ctx.beginPath(); ctx.ellipse(-w * 0.35, 0, w * 0.15, h * 0.15, 0, 0, Math.PI * 2); ctx.fill();
    
    ctx.strokeStyle = "#5d4037"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-w*0.1, h*0.2); ctx.lineTo(-w*0.2, h*0.6); ctx.lineTo(-w*0.3, h*0.8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, h*0.3); ctx.lineTo(0, h*0.7); ctx.lineTo(-w*0.05, h*0.9); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(w*0.1, h*0.2); ctx.lineTo(w*0.2, h*0.6); ctx.lineTo(w*0.25, h*0.8); ctx.stroke();
    
    ctx.beginPath(); ctx.moveTo(-w*0.1, -h*0.2); ctx.lineTo(-w*0.2, -h*0.6); ctx.lineTo(-w*0.3, -h*0.8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -h*0.3); ctx.lineTo(0, -h*0.7); ctx.lineTo(-w*0.05, -h*0.9); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(w*0.1, -h*0.2); ctx.lineTo(w*0.2, -h*0.6); ctx.lineTo(w*0.25, -h*0.8); ctx.stroke();

    ctx.fillStyle = "#a04000"; ctx.beginPath(); ctx.ellipse(w * 0.2, 0, w * 0.25, h * 0.4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#8b4513"; ctx.beginPath(); ctx.ellipse(w * 0.3, 0, w * 0.2, h * 0.35, 0, 0, Math.PI * 2); ctx.fill();
    
    ctx.strokeStyle = "#f5b041"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(w * 0.4, -h * 0.15); ctx.lineTo(w * 0.6, -h * 0.4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(w * 0.4, h * 0.15); ctx.lineTo(w * 0.6, h * 0.4); ctx.stroke();

    ctx.fillStyle = "#000"; 
    ctx.beginPath(); ctx.arc(w * 0.35, -h * 0.2, 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(w * 0.35, h * 0.2, 2, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = "#211"; 
    ctx.save(); ctx.translate(w * 0.45, -h * 0.15); ctx.rotate(biteFactor * -0.7); 
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(w * 0.25, -h * 0.2, w * 0.3, h * 0.15); ctx.quadraticCurveTo(w * 0.15, -h * 0.05, 0, h * 0.1); ctx.fill(); ctx.restore();

    ctx.save(); ctx.translate(w * 0.45, h * 0.15); ctx.rotate(biteFactor * 0.7); 
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(w * 0.25, h * 0.2, w * 0.3, -h * 0.15); ctx.quadraticCurveTo(w * 0.15, h * 0.05, 0, -h * 0.1); ctx.fill(); ctx.restore();

    ctx.restore();
}

// --- INTRO & TRANSITIONS ---
window.onload = () => {
    setTimeout(() => {
        resizeCanvas();
        if(document.getElementById('preview-red')) drawHuman(document.getElementById('preview-red').getContext('2d'), 12, 10, 35, 55, "#c0392b", "#000", true, 0, 1);
        if(document.getElementById('preview-green')) drawHuman(document.getElementById('preview-green').getContext('2d'), 7, 5, 45, 65, "#27ae60", "#000", true, 0, 1);
        if(document.getElementById('preview-termite')) drawTermite(document.getElementById('preview-termite').getContext('2d'), {x: 5, y: 25, w: 45, h: 25, bitingFrameCount: 0});
    }, 100);
};

function nextIntro(step) {
    document.querySelectorAll('.intro-box').forEach(b => b.style.display = 'none');
    document.getElementById('intro-step-' + step).style.display = 'block';
}

function startLevelTransition(nextLevel) {
    if (nextLevel > 7) {
        alert("YOU WIN! YOU BEAT ALL 7 LEVELS!");
        location.reload();
        return;
    }
    
    level = nextLevel;
    gameState = 'transition';
    
    let numEnemyPlatforms = (2 + level) - 1; 
    let redCount = 1;
    let greenCount = 0;
    let termiteCount = 0;

    if (level === 2) greenCount = 1;
    else if (level === 3) greenCount = 3;
    else if (level === 4) { greenCount = 4; termiteCount = 2; }
    else if (level === 5) { greenCount = 5; termiteCount = 4; }
    else if (level === 6) { greenCount = 6; termiteCount = 6; }
    else if (level === 7) { 
        greenCount = numEnemyPlatforms * 2; 
        termiteCount = numEnemyPlatforms * 2; 
    }

    window.lvlRed = redCount;
    window.lvlGreen = greenCount;
    window.lvlTermite = termiteCount;

    document.getElementById('trans-lvl-text').innerText = "LEVEL " + level;
    
    let descHtml = "";
    if (redCount > 0) descHtml += `<h2 style="color:#e74c3c; font-size: 1.5em;">${redCount} Standard Bad Guy${redCount>1?'s':''}</h2>`;
    if (greenCount > 0) descHtml += `<h2 style="color:#2ecc71; font-size: 1.5em;">${greenCount} Elite Bad Guy${greenCount>1?'s':''}</h2>`;
    if (termiteCount > 0) descHtml += `<h2 style="color:#8d6e63; font-size: 1.5em;">${termiteCount} Termite${termiteCount>1?'s':''}</h2>`;
    
    document.getElementById('trans-badguy-text').innerHTML = descHtml;

    let previewContainer = document.getElementById('trans-enemies-preview');
    previewContainer.innerHTML = ''; 

    function addPreviewCanvas(type) {
        let c = document.createElement('canvas');
        c.width = 60; c.height = 80;
        let ctxP = c.getContext('2d');
        if (type === 'red') drawHuman(ctxP, 12, 10, 35, 55, "#c0392b", "#000", true, 0, 1);
        if (type === 'green') drawHuman(ctxP, 7, 5, 45, 65, "#27ae60", "#000", true, 0, 1);
        if (type === 'termite') drawTermite(ctxP, {x: 5, y: 35, w: 45, h: 25, bitingFrameCount: 0});
        previewContainer.appendChild(c);
    }

    for(let i=0; i<redCount; i++) addPreviewCanvas('red');
    for(let i=0; i<greenCount; i++) addPreviewCanvas('green');
    for(let i=0; i<termiteCount; i++) addPreviewCanvas('termite');

    let overlay = document.getElementById('transition-overlay');
    overlay.style.display = 'flex';
    setTimeout(() => { overlay.style.opacity = 1; }, 50);
}

function proceedToLevel() {
    let overlay = document.getElementById('transition-overlay');
    overlay.style.opacity = 0; 
    setTimeout(() => {
        overlay.style.display = 'none';
        initLevel();
        gameState = 'playing';
        updateUI();
    }, 500);
}

function startGame() { document.getElementById('intro-overlay').style.display = 'none'; startLevelTransition(1); }
function advanceLevel() { startLevelTransition(level + 1); }

// --- INITIALIZATION ---
function initLevel() {
    points = 50; 
    platforms = []; ladders = []; blocks = []; doors = []; deadPadlocks = []; termites = []; badGuys = [];
    player.x = 100; player.y = canvas.height - 150; player.carrying = null;

    let numFloors = 2 + level;
    currentPlatformSpacing = (canvas.height - 120) / numFloors;
    if (currentPlatformSpacing < 75) currentPlatformSpacing = 75;

    platforms.push({ x: 0, y: canvas.height - 40, w: canvas.width, h: 40, isGround: true }); 
    doors.push({ x: canvas.width * 0.85 - 40, y: canvas.height - 100, w: 40, h: 60, hp: 5, max: 5, hasPadlock: true, shake: 0 });
    
    for(let i=1; i <= numFloors; i++) {
        let py = canvas.height - 40 - (i * currentPlatformSpacing);
        platforms.push({ x: canvas.width * 0.25, y: py, w: canvas.width * 0.6, h: 15, isGround: false });
        
        if (i < numFloors) {
            doors.push({ x: canvas.width * 0.85 - 40, y: py - 60, w: 40, h: 60, hp: 5, max: 5, hasPadlock: true, shake: 0 });
        } else {
            coin = { x: canvas.width * 0.55, y: py - 40, active: true };
        }
    }

    if (level >= 7) {
        doors.sort((a, b) => b.y - a.y);
        if(doors.length > 0) { doors[0].hasPadlock = false; doors[0].hp = 0; doors[0].max = 0; }
        if(doors.length > 1) { doors[1].hasPadlock = false; doors[1].hp = 0; doors[1].max = 0; }
        if(doors.length > 2) { doors[doors.length - 1].hasPadlock = false; doors[doors.length - 1].hp = 0; doors[doors.length - 1].max = 0; }
        if(doors.length > 3) { doors[doors.length - 2].hasPadlock = false; doors[doors.length - 2].hp = 0; doors[doors.length - 2].max = 0; }
    }

    spawnBadGuys();
    spawnTermites();
    spawnMissingBlocks();
    updateUI();
}

function spawnBadGuys() {
    badGuys = [];
    
    for(let i=0; i<window.lvlRed; i++) {
        badGuys.push({
            x: canvas.width - 100 - (i*40), y: canvas.height - 150, w: 35, h: 55, vx: 0, vy: 0,
            hitCooldown: 0, swingProgress: 0, swingCount: 0, state: 'hunting', currentDoor: null, 
            shirt: "#c0392b", dmgMult: 1, cooldownMult: 1.0, insideTimer: 0
        });
    }

    for(let i=0; i<window.lvlGreen; i++) {
        let platIndex = (i % (platforms.length - 1)) + 1; 
        let plat = platforms[platIndex] || platforms[0];
        
        badGuys.push({
            x: plat.x + 50 + Math.random()*(plat.w - 100), y: plat.y - 70, w: 45, h: 65, vx: 0, vy: 0,
            hitCooldown: 0, swingProgress: 0, swingCount: 0, state: 'hunting', currentDoor: null, 
            shirt: "#27ae60", dmgMult: 2, cooldownMult: 0.7, insideTimer: 0
        });
    }
}

function spawnTermites() {
    termites = [];
    for(let i=0; i < window.lvlTermite; i++) {
        let platIndex = (i % (platforms.length - 1)) + 1; 
        let plat = platforms[platIndex] || platforms[0];
        
        termites.push({
            x: plat.x + 20 + Math.random()*(plat.w - 60),
            y: plat.y - 20,
            w: 40, h: 20,
            vx: 1.5 * (Math.random() > 0.5 ? 1 : -1),
            hitCooldown: 0, bitingFrameCount: 0, plat: plat
        });
    }
}

function spawnMissingBlocks() {
    let spawnY = canvas.height - 100;
    let hasR = blocks.some(b => b.type === 'R' && b.x < 250);
    let hasC = blocks.some(b => b.type === 'C' && b.x < 250);
    let hasL = blocks.some(b => b.type === 'L' && b.x < 250);

    if (!hasR) blocks.push({ x: 50, y: spawnY, type: 'R', vy: 0 });
    if (!hasC) blocks.push({ x: 110, y: spawnY, type: 'C', vy: 0 });
    if (!hasL) blocks.push({ x: 170, y: spawnY, type: 'L', vy: 0 });
}

// --- CORE LOGIC ---
function togglePause() {
    if (gameState !== 'playing') return;
    isPaused = !isPaused;
    document.getElementById('pause-overlay').style.display = isPaused ? 'flex' : 'none';
}

function update() {
    if(gameState !== 'playing' || isPaused) return;

    if(keys.left) player.vx = -4;
    else if(keys.right) player.vx = 4;
    else player.vx = 0;

    applyPhysics(player);
    if(player.onLadder && keys.up) { player.y -= 5; player.vy = 0; }
    if(player.onLadder && keys.down) { player.y += 5; player.vy = 0; }

    if (coin.active && player.x < coin.x + 20 && player.x + player.w > coin.x - 20 && 
        player.y < coin.y + 20 && player.y + player.h > coin.y - 20) {
        coin.active = false; advanceLevel(); return;
    }

    blocks.forEach(b => applyPhysics(b, true));
    deadPadlocks.forEach(p => { p.vy += GRAVITY; p.x += p.vx; p.y += p.vy; p.angle += 0.1; });
    deadPadlocks = deadPadlocks.filter(p => p.y < canvas.height + 100);
    
    updateBadGuys();
    updateTermites();

    if(slowActive) {
        slowTimer--; document.getElementById('slow-bar').style.width = (slowTimer / 1800 * 100) + "%";
        if(slowTimer <= 0) slowActive = false;
    }
    updateUI(); 
}

function applyPhysics(obj, isBlock = false) {
    obj.vy += GRAVITY; obj.y += obj.vy; obj.x += (obj.vx || 0);

    let objWidth = isBlock ? 40 : obj.w;
    if(obj.x < 0) { obj.x = 0; obj.vx = 0; }
    if(obj.x + objWidth > canvas.width) { obj.x = canvas.width - objWidth; obj.vx = 0; }

    let wasOnLadder = false;
    ladders.forEach(lad => {
        if(obj.x + 30 > lad.x && obj.x < lad.x + lad.w && obj.y + obj.h > lad.y && obj.y < lad.y + lad.h) {
            if(!isBlock) wasOnLadder = true;
        }
    });
    obj.onLadder = wasOnLadder;

    platforms.forEach(p => {
        if (!isBlock && keys.down && !p.isGround && !obj.onLadder) return; 
        let objHeight = isBlock ? 40 : obj.h;
        if(obj.vy > 0 && obj.x + (isBlock?40:20) > p.x && obj.x < p.x + p.w && obj.y + objHeight >= p.y && obj.y + objHeight <= p.y + p.h) {
            obj.y = p.y - objHeight; obj.vy = 0; if(!isBlock) obj.grounded = true;
        }
    });

    let groundCheck = isBlock ? 40 : obj.h;
    if(obj.y + groundCheck > canvas.height) { obj.y = canvas.height - groundCheck; obj.vy = 0; if(!isBlock) obj.grounded = true; }
}

function updateBadGuys() {
    for(let i=0; i<badGuys.length; i++) {
        for(let j=i+1; j<badGuys.length; j++) {
            let b1 = badGuys[i], b2 = badGuys[j];
            if (b1.state === 'hunting' && b2.state === 'hunting' && Math.abs(b1.y - b2.y) < 20) {
                let dx = b1.x - b2.x; let minDist = 40; 
                if (Math.abs(dx) < minDist) {
                    let push = (minDist - Math.abs(dx)) / 2;
                    if (dx > 0) { b1.x += push; b2.x -= push; } else { b1.x -= push; b2.x += push; }
                }
            }
        }
    }

    badGuys.forEach(bg => {
        let speed = slowActive ? 0.75 : 1.5; 
        if(bg.swingProgress > 0) { bg.swingProgress -= (0.05 / bg.cooldownMult); if(bg.swingProgress < 0) bg.swingProgress = 0; }
        if(bg.hitCooldown > 0) { bg.hitCooldown--; return; }

        if (bg.state === 'hunting') {
            applyPhysics(bg);
            let lowestLadder = null;
            ladders.forEach(l => { if (!lowestLadder || l.y > lowestLadder.y) lowestLadder = l; });

            let targetDoor = null, targetLadder = null;
            if (lowestLadder && Math.abs((lowestLadder.y + lowestLadder.h) - (bg.y + bg.h)) < 50) targetLadder = lowestLadder;
            if (!targetLadder) doors.forEach(d => { if (Math.abs((d.y + d.h) - (bg.y + bg.h)) < 50) targetDoor = d; });

            if (targetLadder) {
                if(bg.x < targetLadder.x - 20) bg.x += speed;
                else if(bg.x > targetLadder.x + targetLadder.w + 20) bg.x -= speed;
                else {
                    bg.swingProgress = 1; targetLadder.health -= (5 * bg.dmgMult); triggerBadGuyCooldown(bg);
                    if(targetLadder.health <= 0) ladders = ladders.filter(l => l !== targetLadder);
                }
            } else if (targetDoor) {
                if(bg.x < targetDoor.x - 20) bg.x += speed;
                else if(bg.x > targetDoor.x + targetDoor.w) bg.x -= speed;
                else {
                    if (targetDoor.hasPadlock && targetDoor.hp > 0) {
                        bg.swingProgress = 1; targetDoor.hp -= (1 * bg.dmgMult); targetDoor.shake = 15; triggerBadGuyCooldown(bg);
                        if(targetDoor.hp <= 0) snapPadlock(targetDoor);
                    } else {
                        bg.state = 'inside'; let otherDoors = doors.filter(d => d !== targetDoor);
                        if (otherDoors.length > 0) {
                            let nextDoor = otherDoors[Math.floor(Math.random() * otherDoors.length)];
                            bg.y = nextDoor.y + nextDoor.h - bg.h; bg.x = nextDoor.x; bg.currentDoor = nextDoor;
                        } else { bg.state = 'hunting'; }
                    }
                }
            }
        } else if (bg.state === 'inside') {
            let d = bg.currentDoor;
            if (d && d.hasPadlock && d.hp > 0) {
                bg.swingProgress = 1; d.hp -= (1 * bg.dmgMult); d.shake = 15; triggerBadGuyCooldown(bg);
                if(d.hp <= 0) snapPadlock(d);
            } else {
                if (!bg.insideTimer) bg.insideTimer = 15; bg.insideTimer--;
                if(bg.insideTimer <= 0) { bg.x -= 40; bg.state = 'hunting'; bg.insideTimer = 0; }
            }
        }
    });
}

function updateTermites() {
    termites.forEach(t => {
        if (t.hitCooldown > 0) t.hitCooldown--;
        if (t.bitingFrameCount > 0) t.bitingFrameCount--;

        let touchingLadder = null;
        ladders.forEach(l => {
            if (t.y + t.h >= l.y && t.y <= l.y + l.h && t.x + t.w > l.x && t.x < l.x + l.w) { touchingLadder = l; }
        });

        if (touchingLadder) {
            if (t.hitCooldown <= 0) {
                touchingLadder.health -= 5; t.hitCooldown = 120; t.bitingFrameCount = 20; 
                if (touchingLadder.health <= 0) ladders = ladders.filter(l => l !== touchingLadder);
            }
        } else {
            t.x += t.vx;
            if (t.x < t.plat.x || t.x + t.w > t.plat.x + t.plat.w) { t.vx *= -1; t.x += t.vx * 2; }
        }
    });
}

function triggerBadGuyCooldown(bg) {
    let baseSwingSecs = Math.max(1, 9 - level); 
    let currentCooldownSecs = (level === 1) ? 8 : ((bg.swingCount % 2 === 0) ? baseSwingSecs : 8);
    bg.swingCount++; bg.hitCooldown = (slowActive ? currentCooldownSecs * 2 : currentCooldownSecs) * 60 * bg.cooldownMult; 
}

function snapPadlock(d) { deadPadlocks.push({ x: d.x + 10, y: d.y + 20, vx: Math.random()*4 - 2, vy: -4, angle: 0 }); }

function handleAction() {
    if(player.carrying) {
        let b = player.carrying;
        b.x = player.x; b.y = player.y;
        player.carrying = null;
        
        let snapped = false;
        blocks.forEach(other => {
            if(!snapped && other.x > 220 && Math.abs(b.x - other.x) < 80 && Math.abs(b.y - other.y) < 40) {
                b.y = other.y; 
                if(b.type === 'L') b.x = (other.type === 'C') ? other.x - 45 : (other.type === 'R' ? other.x - 90 : b.x);
                else if(b.type === 'C') b.x = (other.type === 'L') ? other.x + 45 : (other.type === 'R' ? other.x - 45 : b.x);
                else if(b.type === 'R') b.x = (other.type === 'L') ? other.x + 90 : (other.type === 'C' ? other.x + 45 : b.x);
                snapped = true;
            }
        });
        blocks.push(b); checkLadders();
    } else {
        for(let i=0; i<blocks.length; i++) {
            let b = blocks[i];
            if(Math.abs(b.x - player.x) < 50 && Math.abs(b.y - player.y) < 50) {
                player.carrying = blocks.splice(i, 1)[0]; spawnMissingBlocks(); break;
            }
        }
    }
}

function checkLadders() {
    let ladderFormed = false;
    for (let i = 0; i < blocks.length; i++) {
        let l = blocks[i];
        if (l.type === 'L') {
            let c = blocks.find(b => b.type === 'C' && Math.abs(b.x - (l.x + 45)) < 20 && Math.abs(b.y - l.y) < 20);
            if (c) {
                let r = blocks.find(b => b.type === 'R' && Math.abs(b.x - (c.x + 45)) < 20 && Math.abs(b.y - c.y) < 20);
                if (r) {
                    ladders.push({ x: l.x, y: l.y + 40 - currentPlatformSpacing, w: 130, h: currentPlatformSpacing, health: 100 });
                    blocks = blocks.filter(b => b !== l && b !== c && b !== r);
                    points += 100; spawnMissingBlocks(); ladderFormed = true; break; 
                }
            }
        }
    }
}

function triggerSlow() { if(points >= 50 && !slowActive) { points -= 50; slowActive = true; slowTimer = 1800; } }
function triggerFix() { if(points >= 50) { points -= 50; doors.forEach(d => { if(d.hasPadlock) d.hp = d.max; }); } }

function draw() {
    ctx.clearRect(0,0, canvas.width, canvas.height);
    platforms.forEach(p => { ctx.fillStyle = "#111"; ctx.fillRect(p.x, p.y, p.w, p.h); });

    if (coin.active) {
        let width = Math.abs(Math.sin(Date.now() / 200)) * 15 + 2;
        ctx.fillStyle = "gold"; ctx.beginPath(); ctx.ellipse(coin.x, coin.y, width, 20, 0, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = "#b8860b"; ctx.lineWidth = 2; ctx.stroke();
    }

    doors.forEach(d => {
        ctx.fillStyle = "#5d4037"; ctx.fillRect(d.x, d.y, d.w, d.h); ctx.fillStyle = "black"; ctx.fillRect(d.x + 5, d.y + 5, d.w - 10, d.h - 10); 
        if (d.hasPadlock && d.hp > 0) {
            let px = d.x - 5, py = d.y + 20;
            if (d.shake && d.shake > 0) { px += (Math.random() * 4 - 2); py += (Math.random() * 4 - 2); d.shake--; }
            ctx.fillStyle = "#f1c40f"; ctx.fillRect(px, py, 25, 20); ctx.strokeStyle = "silver"; ctx.lineWidth = 4;
            ctx.beginPath(); ctx.arc(px + 12.5, py, 8, Math.PI, 0); ctx.stroke();
            ctx.fillStyle = "black"; ctx.beginPath(); ctx.arc(px + 12.5, py + 7, 3, 0, Math.PI*2); ctx.fill(); ctx.fillRect(px + 11, py + 8, 3, 5);
            let pct = Math.max(0, Math.ceil((d.hp / d.max) * 100)); ctx.fillStyle = "red"; ctx.font = "bold 14px Arial"; ctx.fillText(pct + "%", px - 35, py + 15);
        }
    });

    deadPadlocks.forEach(p => {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.angle); ctx.fillStyle = "#f1c40f"; ctx.fillRect(-12.5, 0, 25, 20);
        ctx.strokeStyle = "silver"; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, 8, Math.PI, 0); ctx.stroke(); ctx.restore();
    });

    ladders.forEach(l => {
        ctx.strokeStyle = "#8B4513"; ctx.lineWidth = 8; ctx.strokeRect(l.x, l.y, l.w, l.h);
        for(let i=15; i<l.h; i+=25) { ctx.beginPath(); ctx.moveTo(l.x, l.y + i); ctx.lineTo(l.x + l.w, l.y + i); ctx.stroke(); }
        ctx.fillStyle = "red"; ctx.font = "bold 16px Arial"; ctx.fillText(l.health + "%", l.x - 45, l.y + l.h/2);
    });

    blocks.forEach(b => {
        ctx.fillStyle = b.type === 'L' ? "#f1c40f" : (b.type === 'C' ? "#e67e22" : "#e91e63");
        ctx.fillRect(b.x, b.y, 40, 40); ctx.strokeStyle = "#222"; ctx.lineWidth = 2; ctx.strokeRect(b.x, b.y, 40, 40);
        ctx.fillStyle = "white"; ctx.font = "bold 20px Arial"; ctx.fillText(b.type, b.x+12, b.y+28);
    });

    termites.forEach(t => { drawTermite(ctx, t); });

    badGuys.forEach(bg => { if (bg.state !== 'inside') { drawHuman(ctx, bg.x, bg.y, bg.w, bg.h, bg.shirt, "#000", true, bg.swingProgress, 1); } });

    drawHuman(ctx, player.x, player.y, player.w, player.h, "#3498db", "#2c3e50");
    if(player.carrying) {
        let b = player.carrying; ctx.fillStyle = b.type === 'L' ? "#f1c40f" : (b.type === 'C' ? "#e67e22" : "#e91e63");
        ctx.fillRect(player.x - 5, player.y - 45, 40, 40); ctx.strokeStyle = "#222"; ctx.lineWidth = 2; ctx.strokeRect(player.x - 5, player.y - 45, 40, 40);
        ctx.fillStyle = "white"; ctx.font = "bold 20px Arial"; ctx.fillText(b.type, player.x + 7, player.y - 17);
    }
}

// --- SYSTEM & JUMP FIX ---
function updateUI() {
    document.getElementById('pts').innerText = points;
    let lvlSpan = document.getElementById('lvl');
    if (lvlSpan && lvlSpan.parentNode) lvlSpan.parentNode.innerHTML = `Level: <span id="lvl">${level}</span> / 7`;
    document.getElementById('slow-trigger').disabled = (points < 50 || slowActive);
    document.getElementById('fix-trigger').disabled = (points < 50);
}

function handleJump() {
    if(!isPaused && player.grounded && !player.onLadder) {
        player.vy = PLAYER_JUMP;
        player.grounded = false;
    }
}

window.addEventListener('keydown', e => {
    // This is the new crucial line: Stops browser from scrolling when using arrow keys
    if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) {
        e.preventDefault();
    }
    
    if(e.code === 'KeyP') togglePause();
    if(isPaused) return;
    if(e.code === 'ArrowLeft') keys.left = true;
    if(e.code === 'ArrowRight') keys.right = true;
    if(e.code === 'ArrowUp') { keys.up = true; handleJump(); }
    if(e.code === 'ArrowDown') keys.down = true;
    if(e.code === 'Space') handleAction();
});

window.addEventListener('keyup', e => {
    if(e.code === 'ArrowLeft') keys.left = false;
    if(e.code === 'ArrowRight') keys.right = false;
    if(e.code === 'ArrowUp') keys.up = false;
    if(e.code === 'ArrowDown') keys.down = false;
});

// UI Buttons
const releaseU = (e) => { e?.preventDefault(); keys.up = false; };
const releaseL = (e) => { e?.preventDefault(); keys.left = false; };
const releaseR = (e) => { e?.preventDefault(); keys.right = false; };
const releaseD = (e) => { e?.preventDefault(); keys.down = false; };

document.getElementById('btn-up').onmousedown = (e) => { e.preventDefault(); keys.up = true; handleJump(); };
document.getElementById('btn-up').onmouseup = releaseU;
document.getElementById('btn-up').onmouseleave = releaseU;

document.getElementById('btn-left').onmousedown = () => keys.left = true;
document.getElementById('btn-left').onmouseup = releaseL;
document.getElementById('btn-left').onmouseleave = releaseL;

document.getElementById('btn-right').onmousedown = () => keys.right = true;
document.getElementById('btn-right').onmouseup = releaseR;
document.getElementById('btn-right').onmouseleave = releaseR;

document.getElementById('btn-down').onmousedown = () => keys.down = true;
document.getElementById('btn-down').onmouseup = releaseD;
document.getElementById('btn-down').onmouseleave = releaseD;

document.getElementById('btn-action').onclick = () => { if(!isPaused) handleAction(); };

document.getElementById('btn-up').ontouchstart = (e) => { e.preventDefault(); keys.up = true; handleJump(); };
document.getElementById('btn-up').ontouchend = releaseU;
document.getElementById('btn-up').ontouchcancel = releaseU;

document.getElementById('btn-left').ontouchstart = (e) => { e.preventDefault(); keys.left = true; };
document.getElementById('btn-left').ontouchend = releaseL;
document.getElementById('btn-left').ontouchcancel = releaseL;

document.getElementById('btn-right').ontouchstart = (e) => { e.preventDefault(); keys.right = true; };
document.getElementById('btn-right').ontouchend = releaseR;
document.getElementById('btn-right').ontouchcancel = releaseR;

document.getElementById('btn-down').ontouchstart = (e) => { e.preventDefault(); keys.down = true; };
document.getElementById('btn-down').ontouchend = releaseD;
document.getElementById('btn-down').ontouchcancel = releaseD;

// --- MAIN SAFARI 60FPS LOOP ---
let lastTime = performance.now();
const fpsInterval = 1000 / 60; 

function gameLoop(currentTime) {
    requestAnimationFrame(gameLoop);
    let deltaTime = currentTime - lastTime;
    if (deltaTime >= fpsInterval) {
        lastTime = currentTime - (deltaTime % fpsInterval);
        update(); draw();
    }
}
requestAnimationFrame(gameLoop);
