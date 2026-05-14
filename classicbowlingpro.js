document.addEventListener("DOMContentLoaded", () => {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    
    // Internal resolution for 3D projection
    canvas.width = 800;
    canvas.height = 600;

    let isPaused = false;
    let gameState = 'MENU'; // MENU, COLORS, AIMING, POWER, ROLLING, RESOLVING, GAMEOVER

    // Pseudo-3D Physics Engine Constants
    const LANE_WIDTH = 40;
    const LANE_LENGTH = 600;
    const PIN_RADIUS = 2;
    const BALL_RADIUS = 3;
    const FRICTION = 0.99;
    const MIN_VELOCITY = 0.05;

    let ball = null;
    let pins = [];
    
    // Camera Settings (Trails the ball)
    let camera = { x: 0, y: 15, z: -50 };
    
    // Steering Lag Queue
    let steerEvents = [];

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
    const scoresContainer = document.getElementById('scores-container');
    
    // Control Sections
    const controlsArea = document.getElementById('controls-area');
    const aimSection = document.getElementById('aim-section');
    const powerSection = document.getElementById('power-section');
    const steerSection = document.getElementById('steer-section');
    
    // Inputs
    const aimSlider = document.getElementById('aim-slider');
    const lockAimBtn = document.getElementById('lock-aim-btn');
    const powerSlider = document.getElementById('power-slider');
    const powerVal = document.getElementById('power-val');
    const launchBtn = document.getElementById('launch-btn');
    const steerLeftBtn = document.getElementById('steer-left-btn');
    const steerRightBtn = document.getElementById('steer-right-btn');

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
            this.knockedOver = false;
        }

        update() {
            if (!this.isActive) return;
            this.x += this.vx;
            this.z += this.vz;
            this.vx *= FRICTION;
            this.vz *= FRICTION;

            if (Math.abs(this.vx) < MIN_VELOCITY) this.vx = 0;
            if (Math.abs(this.vz) < MIN_VELOCITY) this.vz = 0;

            // Gutter logic
            if (this.x < -LANE_WIDTH/2 || this.x > LANE_WIDTH/2) {
                if (this.isPin) this.isActive = false; // Pin falls off
                else {
                    // Ball falls in gutter
                    this.vx = 0; 
                    this.x = this.x < 0 ? -LANE_WIDTH/2 - 2 : LANE_WIDTH/2 + 2;
                }
            }
            // Back of lane
            if (this.z > LANE_LENGTH + 20) this.isActive = false;
        }
    }

    // --- 3D Projection Engine ---
    function project(x, y, z) {
        let relZ = z - camera.z;
        if (relZ <= 0) return null; // Behind camera
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
                    let pin = new Entity(x, z, PIN_RADIUS, 1, '#ffffff', true);
                    pin.id = id++;
                    pins.push(pin);
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

    function resetBallForAim() {
        let pColor = players[currentPlayerIndex].color;
        ball = new Entity(0, 0, BALL_RADIUS, 8, pColor, false);
        aimSlider.value = 0;
    }

    // --- Progression States ---
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
            // CPU gets black automatically, or we are done
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
        resetBallForAim();
        renderScoreboard();
        startAimPhase();
    }

    function startAimPhase() {
        steerEvents = [];
        gameState = 'AIMING';
        camera.x = 0; camera.z = -50; // Reset camera
        updateTurnInfo();
        
        if (players[currentPlayerIndex].isCPU) {
            controlsArea.classList.add('hidden');
            setTimeout(() => { ball.x = (Math.random() - 0.5) * 10; startPowerPhase(); }, 1000);
        } else {
            controlsArea.classList.remove('hidden');
            aimSection.classList.remove('hidden');
            powerSection.classList.add('hidden');
            steerSection.classList.add('hidden');
        }
    }

    lockAimBtn.addEventListener('click', startPowerPhase);

    function startPowerPhase() {
        gameState = 'POWER';
        if (players[currentPlayerIndex].isCPU) {
            setTimeout(() => { launchBall(70 + Math.random() * 20); }, 1000);
        } else {
            aimSection.classList.add('hidden');
            powerSection.classList.remove('hidden');
            powerSlider.value = 60; powerVal.textContent = 60;
        }
    }

    launchBtn.addEventListener('click', () => { launchBall(parseInt(powerSlider.value)); });

    function launchBall(power) {
        gameState = 'ROLLING';
        let speed = (power / 100) * 3 + 1.5; 
        ball.vz = speed;
        ball.vx = 0; // Starts straight

        if (!players[currentPlayerIndex].isCPU) {
            powerSection.classList.add('hidden');
            steerSection.classList.remove('hidden');
        }
    }

    // --- Steering & Lag Mechanics ---
    function queueSteer(direction) {
        if (gameState !== 'ROLLING') return;
        // Direction: -1 (left), 1 (right)
        // Add a steering event to happen 500ms in the future
        steerEvents.push({ executeAt: Date.now() + 500, force: direction * 0.15 });
    }

    steerLeftBtn.addEventListener('mousedown', () => queueSteer(-1));
    steerRightBtn.addEventListener('mousedown', () => queueSteer(1));
    window.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') queueSteer(-1);
        if (e.key === 'ArrowRight') queueSteer(1);
    });

    // --- Physics Update ---
    function updatePhysics() {
        if (gameState === 'AIMING') ball.x = parseFloat(aimSlider.value);

        if (gameState === 'ROLLING') {
            // Apply lagged steering
            let now = Date.now();
            steerEvents = steerEvents.filter(ev => {
                if (now >= ev.executeAt) {
                    ball.vx += ev.force;
                    return false; // Remove processed event
                }
                return true; // Keep in queue
            });

            // Update positions
            ball.update();
            pins.forEach(p => p.update());
            checkCollisions();

            // Camera trails ball until near pins
            camera.z = Math.min(ball.z - 50, LANE_LENGTH - 150);
            camera.x = ball.x * 0.5; // Slight pan

            // Check if movement stopped
            let anythingMoving = (ball.vz > 0.1 || Math.abs(ball.vx) > 0.1) || pins.some(p => Math.abs(p.vz) > 0.1 || Math.abs(p.vx) > 0.1);
            if (!anythingMoving && ball.z > 50) {
                gameState = 'RESOLVING';
                steerSection.classList.add('hidden');
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

        // Draw Lane (Wood floor)
        let tl = project(-LANE_WIDTH/2, 0, LANE_LENGTH);
        let tr = project(LANE_WIDTH/2, 0, LANE_LENGTH);
        let bl = project(-LANE_WIDTH/2, 0, 0);
        let br = project(LANE_WIDTH/2, 0, 0);

        if (tl && tr && bl && br) {
            ctx.fillStyle = '#d6a971'; // Wood
            ctx.beginPath();
            ctx.moveTo(bl.x, bl.y); ctx.lineTo(br.x, br.y); ctx.lineTo(tr.x, tr.y); ctx.lineTo(tl.x, tl.y);
            ctx.fill();
            
            // Gutters
            ctx.fillStyle = '#111';
            let gtl = project(-LANE_WIDTH/2 - 5, 0, LANE_LENGTH);
            let gbl = project(-LANE_WIDTH/2 - 5, 0, 0);
            ctx.beginPath(); ctx.moveTo(gbl.x, gbl.y); ctx.lineTo(bl.x, bl.y); ctx.lineTo(tl.x, tl.y); ctx.lineTo(gtl.x, gtl.y); ctx.fill();
            
            let gtr = project(LANE_WIDTH/2 + 5, 0, LANE_LENGTH);
            let gbr = project(LANE_WIDTH/2 + 5, 0, 0);
            ctx.beginPath(); ctx.moveTo(br.x, br.y); ctx.lineTo(gbr.x, gbr.y); ctx.lineTo(gtr.x, gtr.y); ctx.lineTo(tr.x, tr.y); ctx.fill();
        }

        // Draw Objects (Sorted by Z for proper overlap)
        let drawables = [...pins, ball].filter(obj => obj && obj.isActive);
        drawables.sort((a, b) => b.z - a.z);

        drawables.forEach(obj => {
            let p = project(obj.x, obj.radius, obj.z);
            if (p && p.scale > 0) {
                ctx.beginPath();
                ctx.arc(p.x, p.y, obj.radius * p.scale, 0, Math.PI * 2);
                ctx.fillStyle = obj.color;
                ctx.fill();
                
                // 3D Shading
                ctx.beginPath();
                ctx.arc(p.x - (obj.radius * p.scale * 0.3), p.y - (obj.radius * p.scale * 0.3), obj.radius * p.scale * 0.4, 0, Math.PI*2);
                ctx.fillStyle = 'rgba(255,255,255,0.4)';
                ctx.fill();

                if (obj.isPin) {
                    // Red stripes on pins
                    ctx.strokeStyle = 'red';
                    ctx.lineWidth = 1 * p.scale;
                    ctx.beginPath(); ctx.moveTo(p.x - obj.radius*p.scale, p.y); ctx.lineTo(p.x + obj.radius*p.scale, p.y); ctx.stroke();
                }
            }
        });
    }

    function gameLoop() {
        if (!isPaused) {
            updatePhysics();
            draw();
        }
        requestAnimationFrame(gameLoop);
    }

    // --- Scoring & Turn Logic ---
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
        renderScoreboard();

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

        resetBallForAim();
        startAimPhase();
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

    function updateTurnInfo() {
        let p = players[currentPlayerIndex];
        document.getElementById('current-player-name').textContent = `${p.name}'s Turn`;
        document.getElementById('frame-info').textContent = `Frame ${currentFrame + 1} - Roll ${currentRoll + 1}`;
    }

    function renderScoreboard() {
        scoresContainer.innerHTML = '';
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
            scoresContainer.innerHTML += html;
        });
    }

    function endGame() {
        gameState = 'GAMEOVER'; controlsArea.classList.add('hidden');
        let winner = players.reduce((prev, current) => (prev.totalScore > current.totalScore) ? prev : current);
        document.getElementById('winner-text').textContent = `${winner.name} Wins with ${winner.totalScore}!`;
        gameOverOverlay.classList.remove('hidden');
    }

    // Start Listeners
    document.querySelectorAll('.mode-btn').forEach(btn => btn.addEventListener('click', (e) => beginColorSelection(parseInt(e.target.dataset.players))));
    powerSlider.addEventListener('input', (e) => powerVal.textContent = e.target.value);
    document.getElementById('pause-btn').addEventListener('click', () => { if(gameState==='MENU') return; isPaused = !isPaused; pauseOverlay.classList.toggle('hidden', !isPaused); });
    document.getElementById('resume-btn').addEventListener('click', () => { isPaused = false; pauseOverlay.classList.add('hidden'); });
    document.getElementById('return-btn').addEventListener('click', () => window.location.href = 'https://clicksyncgames.com');
    document.getElementById('restart-btn').addEventListener('click', () => { gameOverOverlay.classList.add('hidden'); menuOverlay.classList.remove('hidden'); });

    gameLoop();
});
