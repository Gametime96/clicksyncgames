document.addEventListener("DOMContentLoaded", () => {
    // Game Setup & Constants
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    
    // Fixed Internal Resolution for stable physics
    const LANE_WIDTH = 400;
    const LANE_HEIGHT = 700;
    canvas.width = LANE_WIDTH;
    canvas.height = LANE_HEIGHT;

    let isPaused = false;
    let gameState = 'MENU'; // MENU, AIMING, ROLLING, RESOLVING, GAMEOVER

    // Physics & Map Constants
    const PIN_RADIUS = 8;
    const BALL_RADIUS = 14;
    const GUTTER_WIDTH = 15;
    const PIN_START_Y = 150;
    const PIN_START_X = LANE_WIDTH / 2;
    const FRICTION = 0.99;
    const MIN_VELOCITY = 0.1;

    // Entities
    let ball = null;
    let pins = [];
    let aimAngle = -Math.PI / 2; // Pointing straight up

    // Game Logic
    let players = [];
    let currentPlayerIndex = 0;
    let currentFrame = 0; // 0 to 9
    let currentRoll = 0; // 0 to 2 (for 10th frame)
    let pinsStanding = 10;

    // Elements
    const menuOverlay = document.getElementById('menu-overlay');
    const pauseOverlay = document.getElementById('pause-overlay');
    const gameOverOverlay = document.getElementById('game-over-overlay');
    const scoresContainer = document.getElementById('scores-container');
    const controlsArea = document.getElementById('controls-area');
    const powerSlider = document.getElementById('power-slider');
    const powerVal = document.getElementById('power-val');
    const bowlBtn = document.getElementById('bowl-btn');

    // --- Classes ---
    class Player {
        constructor(name, isCPU) {
            this.name = name;
            this.isCPU = isCPU;
            this.frames = Array.from({ length: 10 }, () => ({ rolls: [], score: null }));
            this.totalScore = 0;
        }
    }

    class PhysicsObject {
        constructor(x, y, radius, mass, color) {
            this.x = x; this.y = y;
            this.vx = 0; this.vy = 0;
            this.radius = radius;
            this.mass = mass;
            this.color = color;
            this.isActive = true;
        }
        update() {
            if (!this.isActive) return;
            this.x += this.vx;
            this.y += this.vy;
            this.vx *= FRICTION;
            this.vy *= FRICTION;

            if (Math.abs(this.vx) < MIN_VELOCITY) this.vx = 0;
            if (Math.abs(this.vy) < MIN_VELOCITY) this.vy = 0;

            // Gutter logic
            if (this.x - this.radius < GUTTER_WIDTH || this.x + this.radius > LANE_WIDTH - GUTTER_WIDTH) {
                this.isActive = false; 
            }
            // Fall off back
            if (this.y < -50) {
                this.isActive = false;
            }
        }
        draw(ctx) {
            if (!this.isActive) return;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fillStyle = this.color;
            ctx.fill();
            ctx.strokeStyle = '#000';
            ctx.stroke();
            
            // Add a little highlight for 3D effect
            ctx.beginPath();
            ctx.arc(this.x - this.radius*0.3, this.y - this.radius*0.3, this.radius*0.2, 0, Math.PI*2);
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.fill();
        }
        isMoving() {
            return this.isActive && (Math.abs(this.vx) > 0 || Math.abs(this.vy) > 0);
        }
    }

    // --- Initialization ---
    function setupPins(fullReset = true) {
        if (fullReset) {
            pins = [];
            const spacing = PIN_RADIUS * 3;
            let id = 0;
            for (let row = 0; row < 4; row++) {
                for (let col = 0; col <= row; col++) {
                    let x = PIN_START_X + (col * spacing) - (row * spacing / 2);
                    let y = PIN_START_Y - (row * spacing * 0.85); // Isometric offset
                    let pin = new PhysicsObject(x, y, PIN_RADIUS, 1, '#fff');
                    pin.id = id++;
                    pins.push(pin);
                }
            }
        } else {
            // Sweep dead pins
            pins.forEach(p => {
                if (!p.isActive || p.y < 0 || p.x < GUTTER_WIDTH || p.x > LANE_WIDTH-GUTTER_WIDTH) {
                    p.isActive = false;
                }
            });
        }
    }

    function resetBall() {
        ball = new PhysicsObject(LANE_WIDTH / 2, LANE_HEIGHT - 50, BALL_RADIUS, 5, '#e94560');
    }

    function startGame(numPlayers) {
        players = [];
        if (numPlayers === 1) {
            players.push(new Player("Player 1", false));
            players.push(new Player("CPU", true));
        } else {
            for (let i = 1; i <= numPlayers; i++) {
                players.push(new Player(`Player ${i}`, false));
            }
        }
        
        currentPlayerIndex = 0;
        currentFrame = 0;
        currentRoll = 0;
        pinsStanding = 10;
        
        gameState = 'AIMING';
        menuOverlay.classList.add('hidden');
        
        setupPins(true);
        resetBall();
        renderScoreboard();
        updateTurnInfo();
        checkCPU();
    }

    // --- Physics Engine ---
    function checkCollisions() {
        let objects = [ball, ...pins.filter(p => p.isActive)];
        
        for (let i = 0; i < objects.length; i++) {
            for (let j = i + 1; j < objects.length; j++) {
                let objA = objects[i];
                let objB = objects[j];
                
                let dx = objB.x - objA.x;
                let dy = objB.y - objA.y;
                let dist = Math.sqrt(dx * dx + dy * dy);
                
                if (dist < objA.radius + objB.radius) {
                    // Resolve collision
                    let nx = dx / dist;
                    let ny = dy / dist;
                    
                    let overlap = objA.radius + objB.radius - dist;
                    objA.x -= nx * overlap / 2;
                    objA.y -= ny * overlap / 2;
                    objB.x += nx * overlap / 2;
                    objB.y += ny * overlap / 2;

                    let kx = (objA.vx - objB.vx);
                    let ky = (objA.vy - objB.vy);
                    let p = 2.0 * (nx * kx + ny * ky) / (objA.mass + objB.mass);
                    
                    objA.vx -= p * objB.mass * nx;
                    objA.vy -= p * objB.mass * ny;
                    objB.vx += p * objA.mass * nx;
                    objB.vy += p * objA.mass * ny;
                }
            }
        }
    }

    // --- Game Loop ---
    function update() {
        if (isPaused) return;

        if (gameState === 'ROLLING') {
            ball.update();
            pins.forEach(p => p.update());
            checkCollisions();

            let anythingMoving = ball.isMoving() || pins.some(p => p.isMoving());
            if (!anythingMoving) {
                gameState = 'RESOLVING';
                setTimeout(resolveRoll, 1000); 
            }
        }
    }

    function draw() {
        ctx.clearRect(0, 0, LANE_WIDTH, LANE_HEIGHT);
        
        // Lane drawing
        ctx.strokeStyle = '#d6a971';
        ctx.lineWidth = 1;
        for(let i=15; i<LANE_WIDTH-15; i+=10) {
            ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, LANE_HEIGHT); ctx.stroke();
        }
        
        // Markers
        ctx.fillStyle = '#c0392b';
        ctx.beginPath(); ctx.arc(LANE_WIDTH/2, LANE_HEIGHT - 150, 4, 0, Math.PI*2); ctx.fill();

        // Draw Entities
        pins.forEach(p => p.draw(ctx));
        if (ball) ball.draw(ctx);

        // Draw Aiming Line
        if (gameState === 'AIMING' && players.length > 0 && !players[currentPlayerIndex].isCPU) {
            ctx.beginPath();
            ctx.moveTo(ball.x, ball.y);
            ctx.lineTo(ball.x + Math.cos(aimAngle) * 100, ball.y + Math.sin(aimAngle) * 100);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.stroke();
            ctx.setLineDash([]);
        }
    }

    function gameLoop() {
        update();
        draw();
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
            if (isStrike || currentRoll === 1) turnOver = true;
            else currentRoll++;
        } else {
            // 10th Frame
            if (currentRoll === 0) currentRoll++;
            else if (currentRoll === 1) {
                if (frame.rolls[0] + frame.rolls[1] >= 10) currentRoll++;
                else turnOver = true;
            } else {
                turnOver = true;
            }
        }

        calculateScores();
        renderScoreboard();

        if (turnOver) {
            currentPlayerIndex++;
            if (currentPlayerIndex >= players.length) {
                currentPlayerIndex = 0;
                currentFrame++;
            }
            currentRoll = 0;
            pinsStanding = 10;
            setupPins(true);

            if (currentFrame > 9) {
                endGame();
                return;
            }
        } else {
            if (pinsStanding === 0 && currentFrame === 9) {
                pinsStanding = 10;
                setupPins(true);
            } else {
                setupPins(false);
            }
        }

        resetBall();
        updateTurnInfo();
        gameState = 'AIMING';
        checkCPU();
    }

    function calculateScores() {
        players.forEach(p => {
            let runningTotal = 0;
            for (let i = 0; i < 10; i++) {
                let f = p.frames[i];
                f.score = null;
                if (f.rolls.length === 0) continue;

                let frameScore = f.rolls[0] + (f.rolls[1] || 0) + (f.rolls[2] || 0);

                if (f.rolls[0] === 10 && i < 9) {
                    let nextRoll = getRollAt(p, i + 1, 0);
                    let nextNextRoll = getRollAt(p, i + 1, 1);
                    if (nextRoll === null) continue;
                    
                    if (nextNextRoll !== null) {
                         frameScore += nextRoll + nextNextRoll;
                    } else if (getRollAt(p, i + 2, 0) !== null) {
                         frameScore += nextRoll + getRollAt(p, i + 2, 0);
                    } else { continue; }
                } 
                else if (f.rolls[0] + (f.rolls[1] || 0) === 10 && i < 9 && f.rolls.length === 2) {
                    let nextRoll = getRollAt(p, i + 1, 0);
                    if (nextRoll === null) continue;
                    frameScore += nextRoll;
                }

                runningTotal += frameScore;
                f.score = runningTotal;
            }
            p.totalScore = runningTotal;
        });
    }

    function getRollAt(player, frameIdx, rollIdx) {
        if (frameIdx > 9) return null;
        let frame = player.frames[frameIdx];
        if (rollIdx === 1 && frame.rolls[0] === 10 && frameIdx < 9) return null;
        return frame.rolls.length > rollIdx ? frame.rolls[rollIdx] : null;
    }

    // --- UI Updates ---
    function updateTurnInfo() {
        let p = players[currentPlayerIndex];
        document.getElementById('current-player-name').textContent = `${p.name}'s Turn`;
        document.getElementById('frame-info').textContent = `Frame ${currentFrame + 1} - Roll ${currentRoll + 1}`;
        
        if (p.isCPU) {
            controlsArea.classList.add('hidden');
        } else {
            controlsArea.classList.remove('hidden');
            aimAngle = -Math.PI / 2;
            powerSlider.value = 60;
            powerVal.textContent = 60;
            bowlBtn.disabled = false;
        }
    }

    function renderScoreboard() {
        scoresContainer.innerHTML = '';
        players.forEach(p => {
            let tableHTML = `<div class="player-row-title">${p.name}: ${p.totalScore}</div><table class="score-table"><tr>`;
            for(let i=1; i<=10; i++) tableHTML += `<th>F${i}</th>`;
            tableHTML += `</tr><tr>`;
            for(let i=0; i<10; i++) {
                let r1 = p.frames[i].rolls[0] !== undefined ? (p.frames[i].rolls[0] === 10 ? 'X' : p.frames[i].rolls[0]) : '';
                let r2 = p.frames[i].rolls[1] !== undefined ? p.frames[i].rolls[1] : '';
                if (p.frames[i].rolls[0] !== 10 && p.frames[i].rolls[0] + p.frames[i].rolls[1] === 10) r2 = '/';
                let r3 = i === 9 && p.frames[i].rolls[2] !== undefined ? p.frames[i].rolls[2] : '';
                if (i === 9 && r1 === 'X' && r2 === 10) r2 = 'X';
                if (i === 9 && r3 === 10) r3 = 'X';

                tableHTML += `<td>
                    <div class="frame-boxes">
                        <div class="frame-box">${r1}</div><div class="frame-box">${r2}</div>
                        ${i === 9 ? `<div class="frame-box">${r3}</div>` : ''}
                    </div>
                    <div class="frame-score">${p.frames[i].score !== null ? p.frames[i].score : ''}</div>
                </td>`;
            }
            tableHTML += `</tr></table>`;
            scoresContainer.innerHTML += tableHTML;
        });
    }

    function endGame() {
        gameState = 'GAMEOVER';
        controlsArea.classList.add('hidden');
        let winner = players.reduce((prev, current) => (prev.totalScore > current.totalScore) ? prev : current);
        document.getElementById('winner-text').textContent = `${winner.name} Wins with ${winner.totalScore}!`;
        gameOverOverlay.classList.remove('hidden');
    }

    // --- Inputs & CPU ---
    function throwBall(power) {
        if (gameState !== 'AIMING') return;
        gameState = 'ROLLING';
        bowlBtn.disabled = true;
        let speed = (power / 100) * 15 + 5; 
        ball.vx = Math.cos(aimAngle) * speed;
        ball.vy = Math.sin(aimAngle) * speed;
    }

    function checkCPU() {
        if (players[currentPlayerIndex].isCPU && gameState === 'AIMING') {
            setTimeout(() => {
                let targetX = PIN_START_X;
                let targetY = PIN_START_Y;
                
                if (currentRoll > 0 && pins.length > 0) {
                    let alive = pins.filter(p=>p.isActive);
                    if(alive.length > 0) {
                        let sumX = alive.reduce((sum, p) => sum + p.x, 0);
                        targetX = sumX / alive.length;
                    }
                }

                let dx = targetX - ball.x;
                let dy = targetY - ball.y;
                aimAngle = Math.atan2(dy, dx);
                aimAngle += (Math.random() - 0.5) * 0.05; // AI error
                let power = 70 + Math.random() * 20;
                throwBall(power);
            }, 1000); 
        }
    }

    // Listeners
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            startGame(parseInt(e.target.dataset.players));
        });
    });

    powerSlider.addEventListener('input', (e) => {
        powerVal.textContent = e.target.value;
    });

    bowlBtn.addEventListener('click', () => {
        throwBall(parseInt(powerSlider.value));
    });

    canvas.addEventListener('mousemove', (e) => {
        if (gameState === 'AIMING' && !players[currentPlayerIndex].isCPU) {
            const rect = canvas.getBoundingClientRect();
            // Scale mouse coordinates to match canvas internal resolution
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            
            const mx = (e.clientX - rect.left) * scaleX;
            const my = (e.clientY - rect.top) * scaleY;
            
            let dx = mx - ball.x;
            let dy = my - ball.y;
            
            if (dy < 0) { aimAngle = Math.atan2(dy, dx); }
        }
    });

    document.getElementById('pause-btn').addEventListener('click', () => {
        if (gameState === 'MENU' || gameState === 'GAMEOVER') return;
        isPaused = !isPaused;
        if (isPaused) pauseOverlay.classList.remove('hidden');
        else pauseOverlay.classList.add('hidden');
    });

    document.getElementById('resume-btn').addEventListener('click', () => {
        isPaused = false;
        pauseOverlay.classList.add('hidden');
    });

    document.getElementById('return-btn').addEventListener('click', () => {
        window.location.href = 'https://clicksyncgames.com';
    });

    document.getElementById('restart-btn').addEventListener('click', () => {
        gameOverOverlay.classList.add('hidden');
        menuOverlay.classList.remove('hidden');
    });

    // Start loop
    gameLoop();
});
