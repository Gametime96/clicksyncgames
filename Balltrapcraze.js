// --- DOM Elements ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const uiLives = document.getElementById('val-lives');
const uiLevel = document.getElementById('val-level');
const uiLevelLabel = document.getElementById('val-level-label');
const uiArea = document.getElementById('val-area');
const btnPause = document.getElementById('btn-pause');
const btnToggleDir = document.getElementById('btn-toggle-dir');
const dirArrow = document.getElementById('dir-arrow');

const overlays = {
    menu: document.getElementById('overlay-menu'),
    pause: document.getElementById('overlay-pause'),
    gameover: document.getElementById('overlay-gameover'),
    levelcomplete: document.getElementById('overlay-levelcomplete')
};

// --- Game Constants & Variables ---
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 500;
const GOAL_PERCENTAGE = 75;
const MAX_LEVELS = 15;
const WALL_THICKNESS = 6;
const BALL_RADIUS = 7; 

let gameState = 'INIT'; // INIT, INTRO, TUTORIAL, MENU, TRANSITION, PLAYING, PAUSED, GAMEOVER, LEVELCOMPLETE, VICTORY
let theme = 'bw'; 
let difficulty = 'medium'; 

let lives = 3;
let level = 1;
let totalArea = CANVAS_WIDTH * CANVAS_HEIGHT;
let clearedArea = 0;

let balls = [];
let playableRects = [];
let filledRects = [];
let builtWalls = [];
let activeWall = null; 
let buildDirection = 'H'; 

let ballSpeed = 4;
let wallSpeed = 5;

let lastTime = 0;
let reqAnimationId;
let hasSeenGametime = false; // Prevents "Gametime" screen from showing after deaths

// Tutorial Variables
let tutTime = 0;
let tutPhase = 0;
let tutText = "";
let fakeCursor = { x: -100, y: -100, dir: 'H' };
let tutorialFlash = 0;

const diffConfig = {
    easy: { bSpeed: 2.5, wSpeed: 9 },
    medium: { bSpeed: 4.5, wSpeed: 6 },
    hard: { bSpeed: 6.5, wSpeed: 3 }
};

// --- Classes ---
class PlayableRect {
    constructor(x, y, w, h) {
        this.x = x; this.y = y; this.w = w; this.h = h;
    }
}

class Ball {
    constructor(x, y, dx, dy, rect) {
        this.x = x; this.y = y;
        this.dx = dx; this.dy = dy;
        this.rect = rect;
        this.radius = BALL_RADIUS;
    }
    
    update(dt) {
        let stepX = this.dx * ballSpeed * (dt / 16.6);
        let stepY = this.dy * ballSpeed * (dt / 16.6);
        
        this.x += stepX;
        this.y += stepY;

        if (this.x - this.radius < this.rect.x) {
            this.x = this.rect.x + this.radius;
            this.dx *= -1;
        } else if (this.x + this.radius > this.rect.x + this.rect.w) {
            this.x = this.rect.x + this.rect.w - this.radius;
            this.dx *= -1;
        }

        if (this.y - this.radius < this.rect.y) {
            this.y = this.rect.y + this.radius;
            this.dy *= -1;
        } else if (this.y + this.radius > this.rect.y + this.rect.h) {
            this.y = this.rect.y + this.rect.h - this.radius;
            this.dy *= -1;
        }
    }

    draw(ctx) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--ball-color').trim();
        ctx.fill();
        ctx.closePath();
    }
}

class Wall {
    constructor(x, y, dir, rect) {
        this.x = x; this.y = y;
        this.dir = dir;
        this.rect = rect;
        this.len1 = 0; 
        this.len2 = 0; 
        this.done1 = false;
        this.done2 = false;
    }

    update(dt) {
        let step = wallSpeed * (dt / 16.6);
        
        if (!this.done1) this.len1 += step;
        if (!this.done2) this.len2 += step;

        if (this.dir === 'H') {
            if (this.x - this.len1 <= this.rect.x) { this.len1 = this.x - this.rect.x; this.done1 = true; }
            if (this.x + this.len2 >= this.rect.x + this.rect.w) { this.len2 = (this.rect.x + this.rect.w) - this.x; this.done2 = true; }
        } else {
            if (this.y - this.len1 <= this.rect.y) { this.len1 = this.y - this.rect.y; this.done1 = true; }
            if (this.y + this.len2 >= this.rect.y + this.rect.h) { this.len2 = (this.rect.y + this.rect.h) - this.y; this.done2 = true; }
        }

        if (this.done1 && this.done2) {
            finishWall(this);
        }
    }

    draw(ctx) {
        ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--wall-building-color').trim();
        if (this.dir === 'H') {
            ctx.fillRect(this.x - this.len1, this.y - WALL_THICKNESS/2, this.len1 + this.len2, WALL_THICKNESS);
        } else {
            ctx.fillRect(this.x - WALL_THICKNESS/2, this.y - this.len1, WALL_THICKNESS, this.len1 + this.len2);
        }
    }
}

// --- Dynamic SVG Cursors ---
function updateCursor() {
    const svgH = `<svg width="48" height="48" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><path d="M 10 50 L 30 30 L 30 42 L 70 42 L 70 30 L 90 50 L 70 70 L 70 58 L 30 58 L 30 70 Z" fill="white" stroke="black" stroke-width="6" stroke-linejoin="round"/></svg>`;
    const svgV = `<svg width="48" height="48" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><path d="M 50 10 L 70 30 L 58 30 L 58 70 L 70 70 L 50 90 L 30 70 L 42 70 L 42 30 L 30 30 Z" fill="white" stroke="black" stroke-width="6" stroke-linejoin="round"/></svg>`;
    
    if (buildDirection === 'H') {
        canvas.style.cursor = `url('data:image/svg+xml;utf8,${encodeURIComponent(svgH)}') 24 24, auto`;
    } else {
        canvas.style.cursor = `url('data:image/svg+xml;utf8,${encodeURIComponent(svgV)}') 24 24, auto`;
    }
}

// --- Boot Sequence & Settings ---
function applySettings() {
    theme = document.getElementById('theme-select').value;
    difficulty = document.getElementById('diff-select').value;
    
    if (theme === 'bw') {
        document.body.classList.add('theme-bw');
    } else {
        document.body.classList.remove('theme-bw');
    }

    ballSpeed = diffConfig[difficulty].bSpeed;
    wallSpeed = diffConfig[difficulty].wSpeed;
    updateCursor();
}

window.onload = function() {
    applySettings();
    
    Object.values(overlays).forEach(o => {
        if(o) o.classList.add('hidden');
    });
    
    gameState = 'INTRO';
    const introScreen = document.getElementById('overlay-intro');
    const introText = document.getElementById('intro-text');
    
    // 0.5s absolute black screen delay -> Fade in Text
    setTimeout(() => { 
        introText.style.opacity = '1'; 
    }, 500);
    
    // Hold 2s (Total 3.5s) -> Fade out Text & Overlay
    setTimeout(() => { 
        introText.style.opacity = '0'; 
        introScreen.style.opacity = '0';
    }, 3500);

    // Enter Tutorial 
    setTimeout(() => {
        introScreen.style.display = 'none'; 
        runVisualTutorial();
    }, 4500);
};

// --- Live Visual Tutorial Logic ---
function runVisualTutorial() {
    gameState = 'TUTORIAL';
    tutTime = 0;
    tutPhase = 0;
    tutorialFlash = 0;

    playableRects = [new PlayableRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)];
    filledRects = [];
    builtWalls = [];
    activeWall = null;
    clearedArea = 0;
    
    balls = [new Ball(200, 250, 1, 0.8, playableRects[0])];
    
    updateUI();
    
    lastTime = performance.now();
    if (!reqAnimationId) reqAnimationId = requestAnimationFrame(gameLoop);
}

function tutorialUpdate(dt) {
    tutTime += dt;
    balls.forEach(b => b.update(dt));
    if (activeWall) {
        activeWall.update(dt);
        checkWallCollision();
    }

    if (tutTime < 3000) {
        tutPhase = 0;
        tutText = "Goal: Trap the bouncing balls!";
    } else if (tutTime >= 3000 && tutTime < 4500) {
        if (tutPhase === 0) {
            tutPhase = 1;
            fakeCursor = { x: 400, y: 100, dir: 'H' };
            balls = [new Ball(600, 250, -1, 1, playableRects[0])]; 
        }
        tutText = "Tap/Click the board to build walls.";
        fakeCursor.y += (250 - fakeCursor.y) * 0.08; 
    } else if (tutTime >= 4500 && tutTime < 7000) {
        if (tutPhase === 1) {
            tutPhase = 2;
            activeWall = new Wall(400, 250, 'H', playableRects[0]);
        }
        tutText = "Trap them to clear 75% of the board.";
    } else if (tutTime >= 7000 && tutTime < 8500) {
        if (tutPhase === 2) {
            tutPhase = 3;
            playableRects = [new PlayableRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)];
            filledRects = [];
            builtWalls = [];
            activeWall = null;
            balls = [new Ball(150, 250, 1, 0, playableRects[0])]; 
            fakeCursor = { x: 400, y: 400, dir: 'V' };
        }
        tutText = "Danger: Balls break walls while building!";
        fakeCursor.y += (250 - fakeCursor.y) * 0.08;
    } else if (tutTime >= 8500 && tutTime < 10500) {
        if (tutPhase === 3) {
            tutPhase = 4;
            activeWall = new Wall(400, 250, 'V', playableRects[0]);
        }
    } else if (tutTime >= 10500 && tutTime < 13000) { 
        tutText = "Use the button to switch directions. Good luck!";
        fakeCursor.x = -100; 
    } else if (tutTime >= 13000) {
        endTutorial();
    }
}

function tutorialDraw() {
    draw(); 

    ctx.save();
    ctx.font = 'bold 120px "Segoe UI", Tahoma, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = theme === 'bw' ? 'rgba(0, 0, 0, 0.20)' : 'rgba(255, 255, 255, 0.25)';
    ctx.fillText("TUTORIAL", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
    ctx.restore();

    // Reduced font size to 24px to ensure it never gets cut off on smaller screens
    ctx.font = 'bold 24px "Segoe UI", Tahoma, sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 5;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'black';
    ctx.strokeText(tutText, CANVAS_WIDTH / 2, 60);
    ctx.fillStyle = 'white';
    ctx.fillText(tutText, CANVAS_WIDTH / 2, 60);

    if (fakeCursor.x > 0) {
        const pathH = new Path2D("M 10 50 L 30 30 L 30 42 L 70 42 L 70 30 L 90 50 L 70 70 L 70 58 L 30 58 L 30 70 Z");
        const pathV = new Path2D("M 50 10 L 70 30 L 58 30 L 58 70 L 70 70 L 50 90 L 30 70 L 42 70 L 42 30 L 30 30 Z");
        ctx.save();
        ctx.translate(fakeCursor.x - 24, fakeCursor.y - 24);
        ctx.scale(0.48, 0.48);
        ctx.fillStyle = 'white';
        ctx.lineWidth = 6;
        ctx.lineJoin = 'round';
        ctx.strokeStyle = 'black';
        ctx.fill(fakeCursor.dir === 'H' ? pathH : pathV);
        ctx.stroke(fakeCursor.dir === 'H' ? pathH : pathV);
        ctx.restore();
    }

    if (tutorialFlash > 0) {
        ctx.fillStyle = `rgba(255, 50, 50, ${tutorialFlash})`;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        tutorialFlash -= 0.02;
    }
}

function endTutorial() {
    gameState = 'MENU';
    cancelAnimationFrame(reqAnimationId);
    reqAnimationId = null;
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT); 
    showOverlay('menu');
}

// --- Cinematic Sequences ---
function showGametimeTransition(callback) {
    const overlay = document.getElementById('overlay-gametime');
    const txt = document.getElementById('gametime-text');
    overlay.classList.remove('hidden');
    
    setTimeout(() => { 
        overlay.style.opacity = '1';
        txt.style.opacity = '1';
    }, 50);
    
    setTimeout(() => {
        overlay.style.opacity = '0';
        txt.style.opacity = '0';
    }, 2000);
    
    setTimeout(() => {
        overlay.classList.add('hidden');
        callback();
    }, 2500);
}

function showLevelTransition(levelNum) {
    gameState = 'TRANSITION';
    hideAllOverlays();
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const overlay = document.getElementById('overlay-level-transition');
    const p1 = document.getElementById('trans-part1');
    const p2 = document.getElementById('trans-part2');
    
    p1.style.opacity = '0';
    p2.style.opacity = '0';
    overlay.classList.remove('hidden');
    
    // Appear as instant black screen
    overlay.style.opacity = '1';

    // 1 second black screen before "Entering:"
    setTimeout(() => {
        p1.style.opacity = '1';

        // Wait 0.5s before Part 2
        setTimeout(() => {
            if (levelNum === 15) {
                p2.innerText = "Level 15 ... The Final Level";
            } else {
                p2.innerText = `Level ${levelNum} of Level 15`;
            }
            p2.style.opacity = '1';

            // Hold on screen for 2s
            setTimeout(() => {
                overlay.style.opacity = '0';
                
                // Fade out delay
                setTimeout(() => {
                    overlay.classList.add('hidden');
                    startLevel(); // Begin actual gameplay
                }, 500);
            }, 2000);
        }, 500);
    }, 1000);
}

function showVictorySequence() {
    gameState = 'VICTORY';
    hideAllOverlays();
    
    const overlay = document.getElementById('overlay-victory-seq');
    const txt = document.getElementById('victory-text');
    
    overlay.classList.remove('hidden');
    overlay.style.opacity = '1';
    txt.style.opacity = '0';
    
    // Hold black for 500ms then fade in text
    setTimeout(() => {
        txt.style.opacity = '1';
        
        // Hold for 2s
        setTimeout(() => {
            txt.style.opacity = '0';
            overlay.style.opacity = '0';
            
            setTimeout(() => {
                overlay.classList.add('hidden');
                gameState = 'MENU';
                showOverlay('menu'); // Loop back to menu decision
            }, 1000);
        }, 2000);
    }, 500);
}

// --- Regular Game Logic ---
function startLevel() {
    playableRects = [new PlayableRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)];
    filledRects = [];
    builtWalls = [];
    activeWall = null;
    balls = [];
    clearedArea = 0;
    
    let mainRect = playableRects[0];
    for (let i = 0; i < level; i++) {
        let bx = mainRect.x + 50 + Math.random() * (mainRect.w - 100);
        let by = mainRect.y + 50 + Math.random() * (mainRect.h - 100);
        let angle = Math.random() * Math.PI * 2;
        let dx = Math.cos(angle);
        let dy = Math.sin(angle);
        balls.push(new Ball(bx, by, dx, dy, mainRect));
    }

    updateUI();
    hideAllOverlays();
    gameState = 'PLAYING';
    lastTime = performance.now();
    
    // Only kick off a new animation frame if not already running
    if (!reqAnimationId) {
        reqAnimationId = requestAnimationFrame(gameLoop);
    }
}

function finishWall(wall) {
    let r = wall.rect;
    let idx = playableRects.indexOf(r);
    if (idx > -1) playableRects.splice(idx, 1);

    let r1, r2;
    if (wall.dir === 'H') {
        r1 = new PlayableRect(r.x, r.y, r.w, wall.y - r.y - WALL_THICKNESS/2);
        r2 = new PlayableRect(r.x, wall.y + WALL_THICKNESS/2, r.w, r.y + r.h - wall.y - WALL_THICKNESS/2);
        
        balls.forEach(b => {
            if (b.rect === r) {
                b.rect = (b.y < wall.y) ? r1 : r2;
            }
        });
    } else {
        r1 = new PlayableRect(r.x, r.y, wall.x - r.x - WALL_THICKNESS/2, r.h);
        r2 = new PlayableRect(wall.x + WALL_THICKNESS/2, r.y, r.x + r.w - wall.x - WALL_THICKNESS/2, r.h);
        
        balls.forEach(b => {
            if (b.rect === r) {
                b.rect = (b.x < wall.x) ? r1 : r2;
            }
        });
    }

    let b1 = balls.filter(b => b.rect === r1).length;
    let b2 = balls.filter(b => b.rect === r2).length;

    if (b1 > 0) playableRects.push(r1); else { fillRect(r1); }
    if (b2 > 0) playableRects.push(r2); else { fillRect(r2); }

    builtWalls.push(wall);
    activeWall = null;

    checkLevelProgress();
}

function fillRect(rect) {
    filledRects.push(rect);
    clearedArea += (rect.w * rect.h);
}

function loseLife() {
    if (gameState === 'TUTORIAL') return;
    
    activeWall = null;
    lives--;
    updateUI();
    if (lives <= 0) {
        gameState = 'GAMEOVER';
        showOverlay('gameover');
    }
}

function checkLevelProgress() {
    if (gameState === 'TUTORIAL') return; 

    let pct = (clearedArea / totalArea) * 100;
    updateUI();
    if (pct >= GOAL_PERCENTAGE) {
        gameState = 'LEVELCOMPLETE';
        if (level >= MAX_LEVELS) {
            // Short delay to let player see the final wall complete before triggering ending
            setTimeout(() => { showVictorySequence(); }, 800);
        } else {
            showOverlay('levelcomplete');
        }
    }
}

function checkWallCollision() {
    if (!activeWall) return;

    for (let b of balls) {
        if (b.rect === activeWall.rect) {
            let hit = false;
            if (activeWall.dir === 'H') {
                let leftEdge = activeWall.x - activeWall.len1;
                let rightEdge = activeWall.x + activeWall.len2;
                if (b.y + b.radius > activeWall.y - WALL_THICKNESS/2 && b.y - b.radius < activeWall.y + WALL_THICKNESS/2) {
                    if (b.x > leftEdge - b.radius && b.x < rightEdge + b.radius) { hit = true; }
                }
            } else {
                let topEdge = activeWall.y - activeWall.len1;
                let bottomEdge = activeWall.y + activeWall.len2;
                if (b.x + b.radius > activeWall.x - WALL_THICKNESS/2 && b.x - b.radius < activeWall.x + WALL_THICKNESS/2) {
                    if (b.y > topEdge - b.radius && b.y < bottomEdge + b.radius) { hit = true; }
                }
            }

            if (hit) {
                if (gameState === 'TUTORIAL') {
                    activeWall = null; 
                    tutorialFlash = 0.6; 
                } else {
                    loseLife();
                }
                break;
            }
        }
    }
}

function gameLoop(timestamp) {
    let dt = timestamp - lastTime;
    lastTime = timestamp;

    if (gameState === 'PLAYING') {
        update(dt);
        draw();
    } else if (gameState === 'TUTORIAL') {
        tutorialUpdate(dt);
        if (gameState === 'TUTORIAL') { 
            tutorialDraw();
        }
    } else if (gameState === 'PAUSED') {
        draw();
    }

    if (reqAnimationId) {
        reqAnimationId = requestAnimationFrame(gameLoop);
    }
}

function update(dt) {
    balls.forEach(b => b.update(dt));
    if (activeWall) {
        activeWall.update(dt);
        checkWallCollision();
    }
}

function draw() {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--filled-color').trim();
    filledRects.forEach(r => {
        ctx.fillRect(r.x, r.y, r.w, r.h);
    });

    ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--wall-color').trim();
    builtWalls.forEach(w => {
        if (w.dir === 'H') {
            ctx.fillRect(w.rect.x, w.y - WALL_THICKNESS/2, w.rect.w, WALL_THICKNESS);
        } else {
            ctx.fillRect(w.x - WALL_THICKNESS/2, w.rect.y, WALL_THICKNESS, w.rect.h);
        }
    });

    if (activeWall) activeWall.draw(ctx);

    balls.forEach(b => b.draw(ctx));
}

// --- UI Helpers ---
function updateUI() {
    if (gameState === 'TUTORIAL') {
        uiLevelLabel.style.display = 'none'; 
        uiLevel.innerText = 'Tutorial';      
        uiLives.innerText = '-';
        uiArea.innerText = '0';
    } else {
        uiLevelLabel.style.display = 'inline';
        uiLevel.innerText = level;
        uiLives.innerText = lives;
        uiArea.innerText = Math.floor((clearedArea / totalArea) * 100);
    }
}

function toggleDirection() {
    buildDirection = buildDirection === 'H' ? 'V' : 'H';
    updateCursor(); 
    
    if (buildDirection === 'H') {
        dirArrow.style.transform = 'rotate(0deg)';
    } else {
        dirArrow.style.transform = 'rotate(90deg)';
    }
}

function showOverlay(id) {
    Object.values(overlays).forEach(o => {
        if(o) o.classList.add('hidden');
    });
    if(overlays[id]) overlays[id].classList.remove('hidden');
}

function hideAllOverlays() {
    Object.values(overlays).forEach(o => {
        if(o) o.classList.add('hidden');
    });
}

function togglePause() {
    if (gameState === 'PLAYING') {
        gameState = 'PAUSED';
        showOverlay('pause');
    } else if (gameState === 'PAUSED') {
        gameState = 'PLAYING';
        hideAllOverlays();
        lastTime = performance.now();
    }
}

// --- Player Input Handling ---
function handleInput(clientX, clientY) {
    if (gameState !== 'PLAYING' || activeWall) return;

    let rect = canvas.getBoundingClientRect();
    let scaleX = canvas.width / rect.width;
    let scaleY = canvas.height / rect.height;
    let x = (clientX - rect.left) * scaleX;
    let y = (clientY - rect.top) * scaleY;

    let targetRect = playableRects.find(r => 
        x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h
    );

    if (targetRect) {
        activeWall = new Wall(x, y, buildDirection, targetRect);
    }
}

// --- Event Listeners ---
document.getElementById('btn-start').addEventListener('click', () => {
    applySettings();
    hideAllOverlays();
    
    lives = 3;
    level = 1;
    
    if (!hasSeenGametime) {
        hasSeenGametime = true;
        showGametimeTransition(() => {
            showLevelTransition(level);
        });
    } else {
        showLevelTransition(level);
    }
});

document.getElementById('btn-restart').addEventListener('click', () => {
    gameState = 'MENU';
    showOverlay('menu');
});

document.getElementById('btn-nextlevel').addEventListener('click', () => {
    level++;
    showLevelTransition(level);
});

btnPause.addEventListener('click', togglePause);
document.getElementById('btn-resume').addEventListener('click', togglePause);

window.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'p') {
        togglePause();
    }
});

btnToggleDir.addEventListener('click', toggleDirection);

canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    toggleDirection();
});

// Desktop Click
canvas.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    handleInput(e.clientX, e.clientY);
});

// Mobile Touch handling
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault(); // Stop mobile scrolling/zooming when tapping the canvas
    if (e.touches.length > 0) {
        let touch = e.touches[0];
        handleInput(touch.clientX, touch.clientY);
    }
}, { passive: false });
