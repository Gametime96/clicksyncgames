document.addEventListener("DOMContentLoaded", () => {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    
    // Locked high-res internal canvas for stable physics and crisp rendering
    canvas.width = 1200;
    canvas.height = 800;

    let isPaused = false;
    let gameState = 'MENU'; 

    // Re-tuned Pro Physics Constants
    const LANE_WIDTH = 120;
    const LANE_LENGTH = 1200;
    const PIN_RADIUS = 5;
    const PIN_HEIGHT = 20;
    const BALL_RADIUS = 10;
    const GRAVITY = 0.5;

    let ball = null;
    let pins = [];
    
    // Smooth 3D Camera
    let camera = { x: 0, y: 40, z: -150 };
    let targetCamZ = -150;

    // HUD Meters
    let meterValue = 0; 
    let meterDirection = 1;
    let meterSpeed = 0.02;
    
    let lockedPosition = 0;
    let lockedAngle = 0;
    let lockedPower = 0;
    let lockedSpin = 0;

    // Game Logic
    let players = [];
    let currentPlayerIndex = 0;
    let currentFrame = 0; 
    let currentRoll = 0; 
    let pinsStanding = 10;
    let selectingColorFor = 0;

    // DOM
    const menuOverlay = document.getElementById('menu-overlay');
    const colorOverlay = document.getElementById('color-overlay');
    const pauseOverlay = document.getElementById('pause-overlay');
    const gameOverOverlay = document.getElementById('game-over-overlay');
    const scoreboardModal = document.getElementById('scoreboard-modal');
    
    const hud = document.getElementById('hud');
    const meterContainer = document.getElementById('meter-container');
    const meterTrack = document.getElementById('meter-track');
    const meterFill = document.getElementById('meter-fill');
    const meterCursor = document.getElementById('meter-cursor');
    const meterInstruction = document.getElementById('meter-instruction');

    class Player {
        constructor(name, isCPU) {
            this.name = name;
            this.isCPU = isCPU;
            this.color = '#ffffff';
            this.frames = Array.from({ length: 10 }, () => ({ rolls: [], score: null }));
            this.totalScore = 0;
        }
    }

    class Entity {
        constructor(x, y, z, radius, mass, color, isPin = false) {
            this.x = x; this.y = y; this.z = z;
            this.vx = 0; this.vy = 0; this.vz = 0;
            this.radius = radius;
            this.mass = mass;
            this.color = color;
            this.isPin = isPin;
            this.isActive = true;
        }

        update() {
            if (!this.isActive) return;
            
            // Movement
            this.x += this.vx;
            this.y += this.vy;
            this.z += this.vz;

            // Friction (Air & Lane)
            this.vx *= 0.99;
            this.vz *= 0.996; // Less friction on Z for smooth, long glide

            // Gravity & Bouncing for realistic pin crashes
            if (this.y > this.radius) {
                this.vy -= GRAVITY;
            } else {
                this.y = this.radius;
                if (this.vy < -1) {
                    this.vy = -this.vy * 0.4; // Bounce
                    this.vx *= 0.8; // Friction on bounce
                    this.vz *= 0.8;
                } else {
                    this.vy = 0;
                }
            }

            if (Math.abs(this.vx) < 0.05) this.vx = 0;
            if (Math.abs(this.vz) < 0.05) this.vz = 0;

            // Curve (Spin)
            if (!this.isPin && gameState === 'ROLLING' && this.vz > 1) {
                this.vx += lockedSpin * 0.04;
            }

            // Gutters
            if (this.x < -LANE_WIDTH/2 || this.x > LANE_WIDTH/2) {
                if (this.isPin) this.isActive = false; 
                else {
                    this.vx = 0; 
                    this.x = this.x < 0 ? -LANE_WIDTH/2 - 2 : LANE_WIDTH/2 + 2;
                }
            }
            
            // Back Pit
            if (this.z > LANE_LENGTH + 50) this.isActive = false;
        }
    }

    // --- Upgraded 3D Projection Engine ---
    function project(x, y, z) {
        let relZ = z - camera.z;
        if (relZ <= 1) relZ = 1; // Prevent camera clipping inversion
        let fov = 800; // Wider FOV for cinematic feel
        let scale = fov / relZ;
        let screenX = (canvas.width / 2) + (x - camera.x) * scale;
        let screenY = (canvas.height / 2) + (camera.y - y) * scale;
        return { x: screenX, y: screenY, scale: scale, relZ: relZ };
    }

    function setupPins(fullReset = true) {
        if (fullReset) {
            pins = [];
            const pinZStart = LANE_LENGTH - 100;
            const spacing = 14;
            let id = 0;
            for (let row = 0; row < 4; row++) {
                for (let col = 0; col <= row; col++) {
                    let x = (col * spacing) - (row * spacing / 2);
                    let z = pinZStart + (row * spacing * 0.866);
                    pins.push(new Entity(x, PIN_RADIUS, z, PIN_RADIUS, 1.5, '#ffffff', true));
                }
            }
        } else {
            pins.forEach(p => {
                if (!p.isActive || p.z > LANE_LENGTH || Math.abs(p.x) > LANE_WIDTH/2) {
                    p.isActive = false;
                }
            });
        }
    }

    // --- Game Flow Methods ---
    function beginColorSelection(numPlayers) {
        players = [];
        if (numPlayers === 1) {
            players.push(new Player("Player 1", false));
            players.push(new Player("CPU", true));
        } else {
            for (let i = 1; i <= numPlayers; i++) players.push(new Player(`Player ${i}`, false));
        }
        selectingColorFor = 0;
        menuOverlay.classList.add('hidden');
        showColorPicker();
    }

    function showColorPicker() {
        if (selectingColorFor >= players.length || players[selectingColorFor].isCPU) {
            if(selectingColorFor < players.length && players[selectingColorFor].isCPU) {
                players[selectingColorFor].color = '#111111'; // CPU is black
            }
            colorOverlay.classList.add('hidden');
            startGame();
            return;
        }
        document.getElementById('color-title').textContent = `${players[selectingColorFor].name}: Select Ball Color`;
        colorOverlay.classList.remove('hidden');
    }

    document.querySelectorAll('.color-swatch').forEach(swatch => {
        swatch.addEventListener('click', (e) => {
            players[selectingColorFor].color = e.target.dataset.color;
            selectingColorFor++;
            showColorPicker();
        });
    });

    function startGame() {
        currentPlayerIndex = 0; currentFrame = 0; currentRoll = 0; pinsStanding = 10;
        setupPins(true);
        hud.classList.remove('hidden');
        startTurn();
    }

    function startTurn() {
        camera.x = 0; camera.y = 40; camera.z = -150; 
        targetCamZ = -150;
        lockedSpin = 0;
        
        let pColor = players[currentPlayerIndex].color;
        ball = new Entity(0, BALL_RADIUS, 0, BALL_RADIUS, 18, pColor, false);
        
        updateHUD();

        if (players[currentPlayerIndex].isCPU) {
            meterContainer.classList.add('hidden');
            gameState = 'CPU_WAIT';
            setTimeout(executeCPUTurn, 1500);
        } else {
            meterContainer.classList.remove('hidden');
            meterTrack.classList.add('hidden');
            meterInstruction.textContent = "1. Move Mouse to Position. Click to Lock.";
            gameState = 'POSITION';
        }
    }

    // --- On-Screen Input Sequence ---
    canvas.addEventListener('mousemove', (e) => {
        if (gameState === 'POSITION' && !isPaused) {
            const rect = canvas.getBoundingClientRect();
            let rawX = (e.clientX - rect.left) / rect.width; 
            ball.x = (rawX - 0.5) * (LANE_WIDTH - BALL_RADIUS*2);
        }
    });

    document.addEventListener('mousedown', (e) => {
        if (isPaused || e.target.tagName === 'BUTTON' || players[currentPlayerIndex].isCPU) return;

        if (gameState === 'POSITION') {
            lockedPosition = ball.x;
            gameState = 'ANGLE';
            meterValue = 0.5; meterDirection = 1; meterSpeed = 0.03;
            meterInstruction.textContent = "2. Click to Lock ANGLE";
            meterTrack.classList.remove('hidden');
            meterFill.style.width = '0%'; 
        } 
        else if (gameState === 'ANGLE') {
            lockedAngle = (meterValue - 0.5) * 0.4; // Narrower, realistic angle
            gameState = 'POWER';
            meterValue = 0; meterDirection = 1; meterSpeed = 0.04;
            meterInstruction.textContent = "3. Click to Lock POWER";
        }
        else if (gameState === 'POWER') {
            lockedPower = meterValue * 80 + 20;
            gameState = 'SPIN';
            meterValue = 0.5; meterDirection = 1; meterSpeed = 0.03;
            meterInstruction.textContent = "4. Click to Lock SPIN (Hook)";
            meterFill.style.width = '0%'; 
        }
        else if (gameState === 'SPIN') {
            lockedSpin = (meterValue - 0.5) * 2;
            launchBall();
        }
    });

    function executeCPUTurn() {
        ball.x = (Math.random() - 0.5) * 20;
        let targetX = 0;
        if (currentRoll > 0 && pins.length > 0) {
            let alive = pins.filter(p=>p.isActive);
            if(alive.length > 0) targetX = alive.reduce((s, p) => s + p.x, 0) / alive.length;
        }
        let dx = targetX - ball.x;
        lockedAngle = Math.atan2(dx, LANE_LENGTH) + (Math.random() - 0.5) * 0.02;
        lockedPower = 75 + Math.random() * 25;
        lockedSpin = (Math.random() - 0.5) * 0.4;
        launchBall();
    }

    function launchBall() {
        gameState = 'ROLLING';
        meterContainer.classList.add('hidden');
        
        // Power scaling
        let speed = (lockedPower / 100) * 15 + 10; 
        ball.vz = Math.cos(lockedAngle) * speed;
        ball.vx = Math.sin(lockedAngle) * speed;
    }

    // --- Core Update Loop ---
    function updatePhysics() {
        if (['ANGLE', 'POWER', 'SPIN'].includes(gameState)) {
            meterValue += meterSpeed * meterDirection;
            if (meterValue >= 1) { meterValue = 1; meterDirection = -1; }
            if (meterValue <= 0) { meterValue = 0; meterDirection = 1; }
            
            if (gameState === 'POWER') {
                meterFill.style.width = (meterValue * 100) + '%';
                meterCursor.style.left = '100%'; 
            } else {
                meterFill.style.width = '0%';
                meterCursor.style.left = (meterValue * 100) + '%'; 
            }
        }

        if (gameState === 'ROLLING') {
            ball.update();
            pins.forEach(p => p.update());
            checkCollisions();

            // Dynamic Camera Follow
            targetCamZ = ball.z - 150;
            if (targetCamZ > LANE_LENGTH - 250) targetCamZ = LANE_LENGTH - 250; // Stop tracking near pins
            camera.z += (targetCamZ - camera.z) * 0.1; // Smooth ease
            camera.x += ((ball.x * 0.3) - camera.x) * 0.1; // Slight pan

            let anythingMoving = (ball.vz > 0.1 || Math.abs(ball.vx) > 0.1) || pins.some(p => Math.abs(p.vz) > 0.5 || Math.abs(p.vx) > 0.5 || p.vy > 0.5);
            
            if (!anythingMoving && ball.z > 100) {
                gameState = 'RESOLVING';
                setTimeout(resolveRoll, 1500); // Give time to watch pins settle
            }
        }
    }

    function checkCollisions() {
        let objects = [ball, ...pins.filter(p => p.isActive)];
        for (let i = 0; i < objects.length; i++) {
            for (let j = i + 1; j < objects.length; j++) {
                let a = objects[i]; let b = objects[j];
                let dx = b.x - a.x; 
                let dy = b.y - a.y;
                let dz = b.z - a.z;
                let dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
                let minDist = a.radius + b.radius;
                
                if (dist < minDist) {
                    // Explode upward on impact for realism
                    if (!a.isPin && b.isPin && b.vy === 0) b.vy = Math.random() * 4 + 2; 
                    if (a.isPin && !b.isPin && a.vy === 0) a.vy = Math.random() * 4 + 2;

                    let nx = dx / dist; let ny = dy / dist; let nz = dz / dist;
                    let overlap = minDist - dist;
                    a.x -= nx * overlap * 0.5; a.y -= ny * overlap * 0.5; a.z -= nz * overlap * 0.5;
                    b.x += nx * overlap * 0.5; b.y += ny * overlap * 0.5; b.z += nz * overlap * 0.5;

                    let kx = a.vx - b.vx; let ky = a.vy - b.vy; let kz = a.vz - b.vz;
                    let p = 2.0 * (nx * kx + ny * ky + nz * kz) / (a.mass + b.mass);
                    
                    a.vx -= p * b.mass * nx; a.vy -= p * b.mass * ny; a.vz -= p * b.mass * nz;
                    b.vx += p * a.mass * nx; b.vy += p * a.mass * ny; b.vz += p * a.mass * nz;
                }
            }
        }
    }

    // --- Premium Rendering ---
    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw Lane Polygon dynamically based on camera
        let startZ = Math.max(0, camera.z - 50); 
        let endZ = LANE_LENGTH + 100;
        
        let tl = project(-LANE_WIDTH/2, 0, endZ);
        let tr = project(LANE_WIDTH/2, 0, endZ);
        let bl = project(-LANE_WIDTH/2, 0, startZ);
        let br = project(LANE_WIDTH/2, 0, startZ);

        if (tl && tr && bl && br) {
            // Wood Lane with Gradient Depth
            let laneGrad = ctx.createLinearGradient(canvas.width/2, bl.y, canvas.width/2, tl.y);
            laneGrad.addColorStop(0, '#f5deb3'); // Light wood close
            laneGrad.addColorStop(1, '#8b5a2b'); // Dark wood far
            ctx.fillStyle = laneGrad; 
            ctx.beginPath();
            ctx.moveTo(bl.x, bl.y); ctx.lineTo(br.x, br.y); ctx.lineTo(tr.x, tr.y); ctx.lineTo(tl.x, tl.y);
            ctx.fill();
            
            // Lane Boards (Lines)
            ctx.strokeStyle = 'rgba(0,0,0,0.1)';
            for(let i= -LANE_WIDTH/2 + 10; i < LANE_WIDTH/2; i+=10) {
                let p1 = project(i, 0, startZ); let p2 = project(i, 0, endZ);
                if(p1 && p2) { ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke(); }
            }

            // Neon Gutter Edges
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 3;
            ctx.shadowColor = '#38bdf8';
            ctx.shadowBlur = 10;
            ctx.beginPath(); ctx.moveTo(bl.x, bl.y); ctx.lineTo(tl.x, tl.y); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(br.x, br.y); ctx.lineTo(tr.x, tr.y); ctx.stroke();
            ctx.shadowBlur = 0;

            // Aiming Guide
            if (gameState === 'ANGLE' && !players[currentPlayerIndex].isCPU) {
                let tempAngle = (meterValue - 0.5) * 0.4;
                let guideZ = 300;
                let guideX = ball.x + Math.sin(tempAngle) * guideZ;
                let projGuide = project(guideX, 0, guideZ);
                let projBall = project(ball.x, ball.radius, ball.z);
                
                if (projGuide && projBall) {
                    ctx.beginPath();
                    ctx.moveTo(projBall.x, projBall.y);
                    ctx.lineTo(projGuide.x, projGuide.y);
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
                    ctx.lineWidth = 2;
                    ctx.setLineDash([10, 10]);
                    ctx.stroke();
                    ctx.setLineDash([]);
                }
            }
        }

        // Draw Objects
        let drawables = [...pins, ball].filter(obj => obj && obj.isActive);
        drawables.sort((a, b) => b.z - a.z);

        drawables.forEach(obj => {
            let p = project(obj.x, obj.y, obj.z);
            if (p && p.scale > 0) {
                let screenRadius = obj.radius * p.scale;
                
                // Drop Shadow
                if (obj.y > obj.radius) {
                    let shadowP = project(obj.x, 0, obj.z);
                    if (shadowP) {
                        ctx.fillStyle = 'rgba(0,0,0,0.5)';
                        ctx.beginPath();
                        ctx.ellipse(shadowP.x, shadowP.y, screenRadius, screenRadius*0.5, 0, 0, Math.PI*2);
                        ctx.fill();
                    }
                }

                // Object Body
                let grad = ctx.createRadialGradient(p.x - screenRadius*0.3, p.y - screenRadius*0.3, screenRadius*0.1, p.x, p.y, screenRadius);
                if (obj.isPin) {
                    grad.addColorStop(0, '#ffffff'); grad.addColorStop(1, '#cccccc');
                } else {
                    grad.addColorStop(0, '#ffffff'); grad.addColorStop(0.2, obj.color); grad.addColorStop(1, '#000000');
                }
                
                ctx.beginPath();
                ctx.arc(p.x, p.y, screenRadius, 0, Math.PI * 2);
                ctx.fillStyle = grad;
                ctx.fill();

                // Pin Details
                if (obj.isPin) {
                    ctx.strokeStyle = '#e74c3c'; 
                    ctx.lineWidth = screenRadius * 0.3;
                    ctx.beginPath(); 
                    ctx.moveTo(p.x - screenRadius*0.8, p.y - screenRadius*0.2); 
                    ctx.lineTo(p.x + screenRadius*0.8, p.y - screenRadius*0.2); 
                    ctx.stroke();
                }
            }
        });
    }

    function gameLoop() {
        if (!isPaused) { updatePhysics(); draw(); }
        requestAnimationFrame(gameLoop);
    }

    // --- Scoring & UI Logic ---
    function resolveRoll() {
        let player = players[currentPlayerIndex];
        let frame = player.frames[currentFrame];
        
        let alivePins = pins.filter(p => p.isActive && p.y <= PIN_RADIUS + 2); // Must be active and not flying
        let knockedDownThisRoll = pinsStanding - alivePins.length;
        pinsStanding = alivePins.length;

        frame.rolls.push(knockedDownThisRoll);
        let isStrike = knockedDownThisRoll === 10 && currentRoll === 0;
        let turnOver = false;
        
        if (currentFrame < 9) {
            if (isStrike || currentRoll === 1) turnOver = true; else currentRoll++;
        } else {
            if (currentRoll === 0) currentRoll++;
            else if (currentRoll === 1) {
                if (frame.rolls[0] + frame.rolls[1] >= 10) currentRoll++; else turnOver = true;
            } else turnOver = true;
        }

        calculateScores();

        if (turnOver) {
            currentPlayerIndex++;
            if (currentPlayerIndex >= players.length) { currentPlayerIndex = 0; currentFrame++; }
            currentRoll = 0; pinsStanding = 10;
            setupPins(true);
            if (currentFrame > 9) { endGame(); return; }
        } else {
            if (pinsStanding === 0 && currentFrame === 9) { pinsStanding = 10; setupPins(true); } 
            else setupPins(false);
        }

        startTurn();
    }

    function calculateScores() {
        players.forEach(p => {
            let total = 0;
            for (let i = 0; i < 10; i++) {
                let f = p.frames[i]; f.score = null;
                if (f.rolls.length === 0) continue;
                let fScore = f.rolls[0] + (f.rolls[1] || 0) + (f.rolls[2] || 0);

                if (f.rolls[0] === 10 && i < 9) {
                    let r2 = getRollAt(p, i + 1, 0); let r3 = getRollAt(p, i + 1, 1);
                    if (r2 === null) continue;
                    if (r3 !== null) fScore += r2 + r3;
                    else if (getRollAt(p, i + 2, 0) !== null) fScore += r2 + getRollAt(p, i + 2, 0);
                    else continue;
                } 
                else if (f.rolls[0] + (f.rolls[1] || 0) === 10 && i < 9 && f.rolls.length === 2) {
                    let r2 = getRollAt(p, i + 1, 0);
                    if (r2 === null) continue;
                    fScore += r2;
                }
                total += fScore; f.score = total;
            }
            p.totalScore = total;
        });
    }

    function getRollAt(p, fIdx, rIdx) {
        if (fIdx > 9) return null;
        let f = p.frames[fIdx];
        if (rIdx === 1 && f.rolls[0] === 10 && fIdx < 9) return null;
        return f.rolls.length > rIdx ? f.rolls[rIdx] : null;
    }

    function updateHUD() {
        let p = players[currentPlayerIndex];
        document.getElementById('hud-name').textContent = p.name;
        document.getElementById('hud-color-dot').style.background = p.color;
        document.getElementById('hud-score').textContent = p.totalScore;
        document.getElementById('hud-frame').textContent = currentFrame + 1;
        document.getElementById('hud-roll').textContent = currentRoll + 1;
    }

    function renderScoreboard(containerId) {
        const container = document.getElementById(containerId);
        container.innerHTML = '';
        players.forEach(p => {
            let html = `<div class="player-row-title"><div class="player-color-dot" style="background:${p.color};"></div>${p.name}: ${p.totalScore}</div><table class="score-table"><tr>`;
            for(let i=1; i<=10; i++) html += `<th>F${i}</th>`;
            html += `</tr><tr>`;
            for(let i=0; i<10; i++) {
                let r1 = p.frames[i].rolls[0] !== undefined ? (p.frames[i].rolls[0] === 10 ? 'X' : p.frames[i].rolls[0]) : '';
                let r2 = p.frames[i].rolls[1] !== undefined ? p.frames[i].rolls[1] : '';
                if (p.frames[i].rolls[0] !== 10 && p.frames[i].rolls[0] + p.frames[i].rolls[1] === 10) r2 = '/';
                let r3 = i === 9 && p.frames[i].rolls[2] !== undefined ? p.frames[i].rolls[2] : '';
                if (i === 9 && r1 === 'X' && r2 === 10) r2 = 'X';
                if (i === 9 && r3 === 10) r3 = 'X';
                html += `<td><div class="frame-boxes"><div class="frame-box">${r1}</div><div class="frame-box">${r2}</div>${i===9?`<div class="frame-box">${r3}</div>`:''}</div><div class="frame-score">${p.frames[i].score !== null ? p.frames[i].score : ''}</div></td>`;
            }
            html += `</tr></table>`;
            container.innerHTML += html;
        });
    }

    function endGame() {
        gameState = 'GAMEOVER'; hud.classList.add('hidden');
        let winner = players.reduce((prev, current) => (prev.totalScore > current.totalScore) ? prev : current);
        document.getElementById('winner-text').textContent = `${winner.name} WINS!`;
        renderScoreboard('final-scores-container');
        gameOverOverlay.classList.remove('hidden');
    }

    // --- Listeners ---
    document.querySelectorAll('.mode-btn').forEach(btn => btn.addEventListener('click', (e) => beginColorSelection(parseInt(e.target.dataset.players))));
    document.getElementById('show-score-btn').addEventListener('click', () => { isPaused = true; renderScoreboard('scores-container'); scoreboardModal.classList.remove('hidden'); });
    document.getElementById('close-score-btn').addEventListener('click', () => { scoreboardModal.classList.add('hidden'); isPaused = false; });
    document.getElementById('pause-btn').addEventListener('click', () => { if(gameState==='MENU' || gameState==='COLORS') return; isPaused = !isPaused; pauseOverlay.classList.toggle('hidden', !isPaused); });
    document.getElementById('resume-btn').addEventListener('click', () => { isPaused = false; pauseOverlay.classList.add('hidden'); });
    document.getElementById('return-btn').addEventListener('click', () => window.location.href = 'https://clicksyncgames.com');
    document.getElementById('restart-btn').addEventListener('click', () => { gameOverOverlay.classList.add('hidden'); menuOverlay.classList.remove('hidden'); });

    gameLoop();
});
