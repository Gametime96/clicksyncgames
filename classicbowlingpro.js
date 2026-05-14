document.addEventListener("DOMContentLoaded", () => {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    
    // Internal resolution for consistent 3D physics regardless of screen size
    canvas.width = 800;
    canvas.height = 600;

    let isPaused = false;
    // States: MENU, COLORS, POSITION, ANGLE, POWER, SPIN, ROLLING, RESOLVING, GAMEOVER
    let gameState = 'MENU'; 

    // Pseudo-3D Physics Engine Constants
    const LANE_WIDTH = 40;
    const LANE_LENGTH = 600;
    const PIN_RADIUS = 2;
    const BALL_RADIUS = 3;
    const FRICTION = 0.99;
    const MIN_VELOCITY = 0.05;

    let ball = null;
    let pins = [];
    
    // Camera Settings
    let camera = { x: 0, y: 15, z: -50 };
    
    // Mechanics Variables
    let meterValue = 0; // 0 to 1 for all meters
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

    // DOM Elements
    const menuOverlay = document.getElementById('menu-overlay');
    const colorOverlay = document.getElementById('color-overlay');
    const pauseOverlay = document.getElementById('pause-overlay');
    const gameOverOverlay = document.getElementById('game-over-overlay');
    const scoreboardModal = document.getElementById('scoreboard-modal');
    const scoresContainer = document.getElementById('scores-container');
    const finalScoresContainer = document.getElementById('final-scores-container');
    
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
            this.color = 'white';
            this.frames = Array.from({ length: 10 }, () => ({ rolls: [], score: null }));
            this.totalScore = 0;
        }
    }

    class Entity {
        constructor(x, z, radius, mass, color, isPin = false) {
            this.x = x; this.z = z;
            this.vx = 0; this.vz = 0;
            this.radius = radius;
            this.mass = mass;
            this.color = color;
            this.isPin = isPin;
            this.isActive = true;
        }

        update() {
            if (!this.isActive) return;
            this.x += this.vx;
            this.z += this.vz;
            this.vx *= FRICTION;
            this.vz *= FRICTION;

            if (Math.abs(this.vx) < MIN_VELOCITY) this.vx = 0;
            if (Math.abs(this.vz) < MIN_VELOCITY) this.vz = 0;

            // Apply locked spin (hook) while rolling
            if (!this.isPin && gameState === 'ROLLING' && this.vz > 0.5) {
                this.vx += lockedSpin * 0.005; // Gradual curve
            }

            // Gutter logic
            if (this.x < -LANE_WIDTH/2 || this.x > LANE_WIDTH/2) {
                if (this.isPin) this.isActive = false; 
                else {
                    this.vx = 0; 
                    this.x = this.x < 0 ? -LANE_WIDTH/2 - 2 : LANE_WIDTH/2 + 2;
                }
            }
            if (this.z > LANE_LENGTH + 20) this.isActive = false;
        }
    }

    // --- 3D Projection Engine ---
    function project(x, y, z) {
        let relZ = z - camera.z;
        if (relZ <= 0) return null; 
        let fov = 400;
        let scale = fov / relZ;
        let screenX = (canvas.width / 2) + (x - camera.x) * scale;
        let screenY = (canvas.height / 2) + (camera.y - y) * scale;
        return { x: screenX, y: screenY, scale: scale };
    }

    function setupPins(fullReset = true) {
        if (fullReset) {
            pins = [];
            const pinZStart = LANE_LENGTH - 50;
            const spacing = 4.5;
            let id = 0;
            for (let row = 0; row < 4; row++) {
                for (let col = 0; col <= row; col++) {
                    let x = (col * spacing) - (row * spacing / 2);
                    let z = pinZStart + (row * spacing * 0.866);
                    pins.push(new Entity(x, z, PIN_RADIUS, 1, '#ffffff', true));
                }
            }
        } else {
            pins.forEach(p => {
                if (!p.isActive || p.z > LANE_LENGTH || p.x < -LANE_WIDTH/2 || p.x > LANE_WIDTH/2) {
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
                players[selectingColorFor].color = 'black';
            }
            colorOverlay.classList.add('hidden');
            startGame();
            return;
        }
        document.getElementById('color-title').textContent = `${players[selectingColorFor].name}: Select Your Ball Color`;
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
        camera.x = 0; camera.z = -50; 
        lockedSpin = 0;
        let pColor = players[currentPlayerIndex].color;
        ball = new Entity(0, 0, BALL_RADIUS, 8, pColor, false);
        
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
            // Map mouse X to lane width (-20 to 20)
            let rawX = (e.clientX - rect.left) / rect.width; 
            ball.x = (rawX - 0.5) * (LANE_WIDTH - BALL_RADIUS*2);
        }
    });

    // Handle clicks for the sequence
    document.addEventListener('mousedown', (e) => {
        if (isPaused || e.target.tagName === 'BUTTON' || players[currentPlayerIndex].isCPU) return;

        if (gameState === 'POSITION') {
            lockedPosition = ball.x;
            gameState = 'ANGLE';
            meterValue = 0.5; meterDirection = 1; meterSpeed = 0.02;
            meterInstruction.textContent = "2. Click to Lock ANGLE";
            meterTrack.classList.remove('hidden');
            meterFill.style.width = '0%'; // Cursor mode
        } 
        else if (gameState === 'ANGLE') {
            // Map 0-1 to -0.3 to 0.3 radians
            lockedAngle = (meterValue - 0.5) * 0.6;
            gameState = 'POWER';
            meterValue = 0; meterDirection = 1; meterSpeed = 0.03;
            meterInstruction.textContent = "3. Click to Lock POWER";
        }
        else if (gameState === 'POWER') {
            // Map 0-1 to 20-100 power
            lockedPower = meterValue * 80 + 20;
            gameState = 'SPIN';
            meterValue = 0.5; meterDirection = 1; meterSpeed = 0.025;
            meterInstruction.textContent = "4. Click to Lock SPIN (Hook)";
            meterFill.style.width = '0%'; // Cursor mode
        }
        else if (gameState === 'SPIN') {
            // Map 0-1 to -1 to 1 hook factor
            lockedSpin = (meterValue - 0.5) * 2;
            launchBall();
        }
    });

    function executeCPUTurn() {
        ball.x = (Math.random() - 0.5) * 10;
        
        let targetX = 0;
        if (currentRoll > 0 && pins.length > 0) {
            let alive = pins.filter(p=>p.isActive);
            if(alive.length > 0) targetX = alive.reduce((s, p) => s + p.x, 0) / alive.length;
        }

        let dx = targetX - ball.x;
        lockedAngle = Math.atan2(dx, LANE_LENGTH) + (Math.random() - 0.5) * 0.05;
        lockedPower = 70 + Math.random() * 20;
        lockedSpin = (Math.random() - 0.5) * 0.5;
        
        launchBall();
    }

    function launchBall() {
        gameState = 'ROLLING';
        meterContainer.classList.add('hidden');
        
        let speed = (lockedPower / 100) * 3 + 1.5; 
        ball.vz = Math.cos(lockedAngle) * speed;
        ball.vx = Math.sin(lockedAngle) * speed;
    }

    // --- Core Update Loop ---
    function updatePhysics() {
        // Meter Animations
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

        // Action Updates
        if (gameState === 'ROLLING') {
            ball.update();
            pins.forEach(p => p.update());
            checkCollisions();

            camera.z = Math.min(ball.z - 50, LANE_LENGTH - 150);
            camera.x = ball.x * 0.5; 

            let anythingMoving = (ball.vz > 0.1 || Math.abs(ball.vx) > 0.1) || pins.some(p => Math.abs(p.vz) > 0.1 || Math.abs(p.vx) > 0.1);
            if (!anythingMoving && ball.z > 50) {
                gameState = 'RESOLVING';
                setTimeout(resolveRoll, 1000); 
            }
        }
    }

    function checkCollisions() {
        let objects = [ball, ...pins.filter(p => p.isActive)];
        for (let i = 0; i < objects.length; i++) {
            for (let j = i + 1; j < objects.length; j++) {
                let a = objects[i]; let b = objects[j];
                let dx = b.x - a.x; let dz = b.z - a.z;
                let dist = Math.sqrt(dx * dx + dz * dz);
                let minDist = a.radius + b.radius;
                
                if (dist < minDist) {
                    let nx = dx / dist; let nz = dz / dist;
                    let overlap = minDist - dist;
                    a.x -= nx * overlap * 0.5; a.z -= nz * overlap * 0.5;
                    b.x += nx * overlap * 0.5; b.z += nz * overlap * 0.5;

                    let kx = a.vx - b.vx; let kz = a.vz - b.vz;
                    let p = 2.0 * (nx * kx + nz * kz) / (a.mass + b.mass);
                    a.vx -= p * b.mass * nx; a.vz -= p * b.mass * nz;
                    b.vx += p * a.mass * nx; b.vz += p * a.mass * nz;
                }
            }
        }
    }

    // --- Drawing ---
    function draw() {
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        let tl = project(-LANE_WIDTH/2, 0, LANE_LENGTH);
        let tr = project(LANE_WIDTH/2, 0, LANE_LENGTH);
        let bl = project(-LANE_WIDTH/2, 0, 0);
        let br = project(LANE_WIDTH/2, 0, 0);

        if (tl && tr && bl && br) {
            // Wood floor
            ctx.fillStyle = '#d6a971'; 
            ctx.beginPath();
            ctx.moveTo(bl.x, bl.y); ctx.lineTo(br.x, br.y); ctx.lineTo(tr.x, tr.y); ctx.lineTo(tl.x, tl.y);
            ctx.fill();
            
            // Aiming Guide Line (Only during ANGLE state)
            if (gameState === 'ANGLE' && !players[currentPlayerIndex].isCPU) {
                let tempAngle = (meterValue - 0.5) * 0.6;
                let guideZ = 150;
                let guideX = ball.x + Math.sin(tempAngle) * guideZ;
                let projectedGuide = project(guideX, 0, guideZ);
                let projectedBall = project(ball.x, ball.radius, ball.z);
                
                if (projectedGuide && projectedBall) {
                    ctx.beginPath();
                    ctx.moveTo(projectedBall.x, projectedBall.y);
                    ctx.lineTo(projectedGuide.x, projectedGuide.y);
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
                    ctx.lineWidth = 2;
                    ctx.setLineDash([5, 10]);
                    ctx.stroke();
                    ctx.setLineDash([]);
                }
            }

            // Gutters
            ctx.fillStyle = '#111';
            let gtl = project(-LANE_WIDTH/2 - 5, 0, LANE_LENGTH); let gbl = project(-LANE_WIDTH/2 - 5, 0, 0);
            ctx.beginPath(); ctx.moveTo(gbl.x, gbl.y); ctx.lineTo(bl.x, bl.y); ctx.lineTo(tl.x, tl.y); ctx.lineTo(gtl.x, gtl.y); ctx.fill();
            
            let gtr = project(LANE_WIDTH/2 + 5, 0, LANE_LENGTH); let gbr = project(LANE_WIDTH/2 + 5, 0, 0);
            ctx.beginPath(); ctx.moveTo(br.x, br.y); ctx.lineTo(gbr.x, gbr.y); ctx.lineTo(gtr.x, gtr.y); ctx.lineTo(tr.x, tr.y); ctx.fill();
        }

        let drawables = [...pins, ball].filter(obj => obj && obj.isActive);
        drawables.sort((a, b) => b.z - a.z);

        drawables.forEach(obj => {
            let p = project(obj.x, obj.radius, obj.z);
            if (p && p.scale > 0) {
                ctx.beginPath();
                ctx.arc(p.x, p.y, obj.radius * p.scale, 0, Math.PI * 2);
                ctx.fillStyle = obj.color;
                ctx.fill();
                
                ctx.beginPath();
                ctx.arc(p.x - (obj.radius * p.scale * 0.3), p.y - (obj.radius * p.scale * 0.3), obj.radius * p.scale * 0.4, 0, Math.PI*2);
                ctx.fillStyle = 'rgba(255,255,255,0.4)';
                ctx.fill();

                if (obj.isPin) {
                    ctx.strokeStyle = 'red'; ctx.lineWidth = 1 * p.scale;
                    ctx.beginPath(); ctx.moveTo(p.x - obj.radius*p.scale, p.y); ctx.lineTo(p.x + obj.radius*p.scale, p.y); ctx.stroke();
                }
            }
        });
    }

    function gameLoop() {
        if (!isPaused) { updatePhysics(); draw(); }
        requestAnimationFrame(gameLoop);
    }

    // --- Game Logic ---
    function resolveRoll() {
        let player = players[currentPlayerIndex];
        let frame = player.frames[currentFrame];
        
        let alivePins = pins.filter(p => p.isActive);
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

    // --- UI Methods ---
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
        document.getElementById('winner-text').textContent = `${winner.name} Wins with ${winner.totalScore}!`;
        renderScoreboard('final-scores-container');
        gameOverOverlay.classList.remove('hidden');
    }

    // --- Event Listeners ---
    document.querySelectorAll('.mode-btn').forEach(btn => btn.addEventListener('click', (e) => beginColorSelection(parseInt(e.target.dataset.players))));
    
    document.getElementById('show-score-btn').addEventListener('click', () => {
        isPaused = true;
        renderScoreboard('scores-container');
        scoreboardModal.classList.remove('hidden');
    });
    
    document.getElementById('close-score-btn').addEventListener('click', () => {
        scoreboardModal.classList.add('hidden');
        isPaused = false;
    });

    document.getElementById('pause-btn').addEventListener('click', () => { 
        if(gameState==='MENU' || gameState==='COLORS') return; 
        isPaused = !isPaused; pauseOverlay.classList.toggle('hidden', !isPaused); 
    });
    document.getElementById('resume-btn').addEventListener('click', () => { isPaused = false; pauseOverlay.classList.add('hidden'); });
    document.getElementById('return-btn').addEventListener('click', () => window.location.href = 'https://clicksyncgames.com');
    document.getElementById('restart-btn').addEventListener('click', () => { gameOverOverlay.classList.add('hidden'); menuOverlay.classList.remove('hidden'); });

    gameLoop();
});
