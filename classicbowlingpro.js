window.addEventListener("load", function() {
    const canvasContainer = document.getElementById('canvas-container');
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    
    function resizeCanvas() {
        canvas.width = canvasContainer.clientWidth;
        canvas.height = canvasContainer.clientHeight;
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    let isPaused = false;
    let gameState = 'MENU'; 

    // Physics Constants
    const LANE_WIDTH = 100;
    const LANE_LENGTH = 1200;
    const PIN_RADIUS = 5;
    const BALL_RADIUS = 10;
    const GRAVITY = 0.8; 
    const RESTITUTION = 0.4; 

    let ball = null;
    let pins = []; 
    let backgroundPins = []; 
    
    let camera = { x: 0, y: 50, z: -150 };
    let targetCamZ = -150;
    let resolvingTimer = 0; 

    // Meters
    let meterValue = 0; 
    let meterDirection = 1;
    let meterSpeed = 0.02;
    
    let lockedPosition = 0;
    let lockedAngle = 0;
    let lockedPower = 0;
    let lockedSpin = 0;
    
    // Steering mechanics
    let isSteeringLeft = false;
    let isSteeringRight = false;
    let steerHoldDuration = 0;
    let selectedPinStyle = 1;

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
    
    const hud = document.getElementById('hud');
    const meterContainer = document.getElementById('meter-container');
    const meterTrack = document.getElementById('meter-track');
    const meterFill = document.getElementById('meter-fill');
    const meterCursor = document.getElementById('meter-cursor');
    const meterInstruction = document.getElementById('meter-instruction');
    const steerControls = document.getElementById('steer-controls');
    const btnLeft = document.getElementById('steer-left');
    const btnRight = document.getElementById('steer-right');

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
            this.wobble = 0; 
            this.knocked = false; 
        }

        update() {
            if (!this.isActive) return;
            
            let currentFloor = this.radius;
            let inGutter = false;

            // Strict Gutter Logic Check
            if (!this.isPin && (this.x < -LANE_WIDTH/2 || this.x > LANE_WIDTH/2)) {
                inGutter = true;
                currentFloor = -5; // Drop the ball into the gutter trench
            }

            this.x += this.vx;
            this.y += this.vy;
            this.z += this.vz;

            this.vx *= 0.98;
            this.vz *= 0.995; 

            // Floor Collision & Gravity
            if (this.y > currentFloor) {
                this.vy -= GRAVITY;
                if(this.isPin) this.wobble += 0.2;
            } else {
                this.y = currentFloor;
                if (this.vy < -2) {
                    this.vy = -this.vy * RESTITUTION; 
                    if (!inGutter) {
                        this.vx *= 0.7; 
                        this.vz *= 0.7;
                    }
                } else {
                    this.vy = 0;
                }
            }
            
            // Pin knocking logic
            if (this.isPin && !this.knocked) {
                if (Math.abs(this.vx) > 1 || Math.abs(this.vz) > 1 || this.y > this.radius * 2) {
                    this.knocked = true;
                }
            }

            if (Math.abs(this.vx) < 0.05) this.vx = 0;
            if (Math.abs(this.vz) < 0.05) this.vz = 0;

            if (!this.isPin && gameState === 'ROLLING' && this.vz > 1 && !inGutter) {
                this.vx += lockedSpin * 0.06;
            }

            // Gutter Physics
            if (inGutter) {
                this.vx *= 0.8; 
                let gutterCenter = this.x < 0 ? -(LANE_WIDTH/2) - 10 : (LANE_WIDTH/2) + 10;
                this.x += (gutterCenter - this.x) * 0.2; 
                if (this.vz < 4) this.vz = 4; // Prevent ball from stopping entirely in the gutter
            }

            // Pin out-of-bounds bounds
            if (this.isPin && (this.x < -LANE_WIDTH/2 - 20 || this.x > LANE_WIDTH/2 + 20)) {
                this.y = -10; this.vx = 0; this.vz = 0; this.knocked = true;
            }
            
            if (this.z > LANE_LENGTH + 150) {
                this.isActive = false;
                if (this.isPin) this.knocked = true;
            }
        }
    }

    function project(x, y, z) {
        let relZ = z - camera.z;
        if (relZ <= 1) relZ = 1; 
        
        // MOBILE ZOOM FIX: Zooms out slightly on narrow screens to prevent cutoff
        let fovMultiplier = canvas.width < 600 ? 0.75 : 0.85; 
        let fov = Math.min(canvas.width, canvas.height) * fovMultiplier; 
        let scale = fov / relZ;
        
        let screenX = (canvas.width / 2) + (x - camera.x) * scale;
        
        // MOBILE PAN FIX: Shifts the projection center slightly upward on mobile
        let screenCenterY = canvas.width < 600 ? canvas.height * 0.45 : canvas.height / 2;
        let screenY = screenCenterY + (camera.y - y) * scale;
        
        return { x: screenX, y: screenY, scale: scale, relZ: relZ };
    }

    function setupPins(fullReset = true) {
        if (fullReset) {
            pins = [];
            const pinZStart = LANE_LENGTH - 100;
            const spacing = 20; 
            for (let row = 0; row < 4; row++) {
                for (let col = 0; col <= row; col++) {
                    let x = (col * spacing) - (row * spacing / 2);
                    let z = pinZStart + (row * spacing * 0.866);
                    pins.push(new Entity(x, PIN_RADIUS, z, PIN_RADIUS, 1.2, '#ffffff', true));
                }
            }
            
            backgroundPins = [];
            let laneOffsets = [-LANE_WIDTH*3 - 40, -LANE_WIDTH*1.5 - 20, LANE_WIDTH*1.5 + 20, LANE_WIDTH*3 + 40];
            laneOffsets.forEach(offsetX => {
                for (let row = 0; row < 4; row++) {
                    for (let col = 0; col <= row; col++) {
                        let x = offsetX + (col * spacing) - (row * spacing / 2);
                        let z = pinZStart + (row * spacing * 0.866);
                        backgroundPins.push(new Entity(x, PIN_RADIUS, z, PIN_RADIUS, 1.2, '#ffffff', true));
                    }
                }
            });

        } else {
            pins = pins.filter(p => p.isActive && !p.knocked);
        }
    }

    // --- Core Flow ---
    function beginColorSelection(numPlayers) {
        let radios = document.getElementsByName('pinstyle');
        for (let i = 0; i < radios.length; i++) {
            if (radios[i].checked) { selectedPinStyle = parseInt(radios[i].value); break; }
        }

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
                players[selectingColorFor].color = '#111111'; 
            }
            colorOverlay.classList.add('hidden');
            startGame();
            return;
        }
        document.getElementById('color-title').textContent = `${players[selectingColorFor].name}: Select Ball Color`;
        colorOverlay.classList.remove('hidden');
    }

    function startGame() {
        currentPlayerIndex = 0; currentFrame = 0; currentRoll = 0; pinsStanding = 10;
        setupPins(true);
        hud.classList.remove('hidden');
        startTurn();
    }

    function startTurn() {
        camera.x = 0; camera.y = 50; camera.z = -150; 
        targetCamZ = -150;
        lockedSpin = 0;
        resolvingTimer = 0;
        steerHoldDuration = 0;
        isSteeringLeft = false;
        isSteeringRight = false;
        steerControls.classList.add('hidden');
        btnLeft.classList.remove('active');
        btnRight.classList.remove('active');
        
        let pColor = players[currentPlayerIndex].color;
        ball = new Entity(0, BALL_RADIUS, 0, BALL_RADIUS, 20, pColor, false); 
        
        updateHUD();

        if (players[currentPlayerIndex].isCPU) {
            meterContainer.classList.add('hidden');
            gameState = 'CPU_WAIT';
            setTimeout(executeCPUTurn, 1500);
        } else {
            meterContainer.classList.remove('hidden');
            meterTrack.classList.add('hidden');
            meterInstruction.textContent = "1. Move to Position. Tap to Lock.";
            gameState = 'POSITION';
        }
    }

    // --- Inputs ---
    const swatches = document.querySelectorAll('.color-swatch');
    swatches.forEach(swatch => {
        swatch.addEventListener('click', function() {
            players[selectingColorFor].color = this.dataset.color;
            selectingColorFor++;
            showColorPicker();
        });
    });

    const modeBtns = document.querySelectorAll('.mode-btn');
    modeBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            let num = parseInt(this.dataset.players);
            if(num > 0) beginColorSelection(num);
        });
    });

    document.getElementById('return-btn').addEventListener('click', () => { window.location.href = 'https://clicksyncgames.com'; });
    document.getElementById('show-score-btn').addEventListener('click', () => { isPaused = true; renderScoreboard('scores-container'); scoreboardModal.classList.remove('hidden'); });
    document.getElementById('close-score-btn').addEventListener('click', () => { scoreboardModal.classList.add('hidden'); isPaused = false; });
    document.getElementById('pause-btn').addEventListener('click', () => { if(gameState==='MENU' || gameState==='COLORS') return; isPaused = !isPaused; pauseOverlay.classList.toggle('hidden', !isPaused); });
    document.getElementById('resume-btn').addEventListener('click', () => { isPaused = false; pauseOverlay.classList.add('hidden'); });
    document.getElementById('restart-btn').addEventListener('click', () => { gameOverOverlay.classList.add('hidden'); menuOverlay.classList.remove('hidden'); });

    // Aiming Interaction
    const handleMove = (clientX) => {
        if (gameState === 'POSITION' && !isPaused) {
            const rect = canvas.getBoundingClientRect();
            let rawX = (clientX - rect.left) / rect.width; 
            ball.x = (rawX - 0.5) * (LANE_WIDTH - BALL_RADIUS*2);
        }
    };
    canvas.addEventListener('mousemove', (e) => handleMove(e.clientX));
    canvas.addEventListener('touchmove', (e) => handleMove(e.touches[0].clientX));

    // Universal Click/Tap on Canvas & Meter
    function handleCanvasClick(e) {
        if (e.type === 'touchstart') e.preventDefault(); 
        if (isPaused || players.length === 0 || players[currentPlayerIndex].isCPU) return;
        
        if (gameState === 'POSITION') {
            lockedPosition = ball.x;
            gameState = 'ANGLE';
            meterValue = 0.5; meterDirection = 1; meterSpeed = 0.03;
            meterInstruction.textContent = "2. Tap to Lock ANGLE";
            meterTrack.classList.remove('hidden');
            meterFill.style.width = '0%'; 
        } 
        else if (gameState === 'ANGLE') {
            lockedAngle = (meterValue - 0.5) * 0.3; 
            gameState = 'POWER';
            meterValue = 0; meterDirection = 1; meterSpeed = 0.04;
            meterInstruction.textContent = "3. Tap to Lock POWER";
        }
        else if (gameState === 'POWER') {
            lockedPower = meterValue * 80 + 20;
            gameState = 'SPIN';
            meterValue = 0.5; meterDirection = 1; meterSpeed = 0.03;
            meterInstruction.textContent = "4. Tap to Lock SPIN (Hook)";
            meterFill.style.width = '0%'; 
        }
        else if (gameState === 'SPIN') {
            lockedSpin = (meterValue - 0.5) * 2;
            launchBall();
        }
    }

    canvas.addEventListener('mousedown', handleCanvasClick);
    canvas.addEventListener('touchstart', handleCanvasClick, {passive: false});
    meterContainer.addEventListener('mousedown', handleCanvasClick);
    meterContainer.addEventListener('touchstart', handleCanvasClick, {passive: false});
    
    // Steering Controls Handlers
    const steerLeftOn = (e) => { if(e) e.preventDefault(); isSteeringLeft = true; btnLeft.classList.add('active'); };
    const steerLeftOff = (e) => { if(e) e.preventDefault(); isSteeringLeft = false; btnLeft.classList.remove('active'); };
    const steerRightOn = (e) => { if(e) e.preventDefault(); isSteeringRight = true; btnRight.classList.add('active'); };
    const steerRightOff = (e) => { if(e) e.preventDefault(); isSteeringRight = false; btnRight.classList.remove('active'); };

    btnLeft.addEventListener('mousedown', steerLeftOn);
    btnLeft.addEventListener('touchstart', steerLeftOn, {passive: false});
    btnLeft.addEventListener('mouseup', steerLeftOff);
    btnLeft.addEventListener('mouseleave', steerLeftOff);
    btnLeft.addEventListener('touchend', steerLeftOff);

    btnRight.addEventListener('mousedown', steerRightOn);
    btnRight.addEventListener('touchstart', steerRightOn, {passive: false});
    btnRight.addEventListener('mouseup', steerRightOff);
    btnRight.addEventListener('mouseleave', steerRightOff);
    btnRight.addEventListener('touchend', steerRightOff);

    document.addEventListener('keydown', (e) => {
        if(e.key === 'ArrowLeft') steerLeftOn();
        if(e.key === 'ArrowRight') steerRightOn();
    });
    document.addEventListener('keyup', (e) => {
        if(e.key === 'ArrowLeft') steerLeftOff();
        if(e.key === 'ArrowRight') steerRightOff();
    });

    // --- Action Methods ---
    function executeCPUTurn() {
        ball.x = (Math.random() - 0.5) * 15;
        let targetX = 0;
        if (currentRoll > 0 && pins.length > 0) {
            let alive = pins.filter(p=>!p.knocked);
            if(alive.length > 0) targetX = alive.reduce((s, p) => s + p.x, 0) / alive.length;
        }
        let dx = targetX - ball.x;
        lockedAngle = Math.atan2(dx, LANE_LENGTH) + (Math.random() - 0.5) * 0.02;
        lockedPower = 60 + Math.random() * 20;
        lockedSpin = (Math.random() - 0.5) * 0.4;
        launchBall();
    }

    function launchBall() {
        gameState = 'ROLLING';
        meterContainer.classList.add('hidden');
        if (!players[currentPlayerIndex].isCPU) {
            steerControls.classList.remove('hidden');
        }
        let speed = (lockedPower / 100) * 8 + 4; 
        ball.vz = Math.cos(lockedAngle) * speed;
        ball.vx = Math.sin(lockedAngle) * speed;
    }

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
            
            let steerDirection = 0;
            if (isSteeringLeft) {
                steerDirection = -1;
                steerHoldDuration += 16;
            } else if (isSteeringRight) {
                steerDirection = 1;
                steerHoldDuration += 16;
            } else {
                steerHoldDuration = 0; 
            }

            if (steerDirection !== 0) {
                if (steerHoldDuration > 250) { 
                    let activeTime = steerHoldDuration - 250;
                    let steerForce = Math.min(activeTime * 0.0001, 0.08);
                    ball.vx += steerForce * steerDirection;
                }
            } else {
                let centerPull = -ball.x * 0.0015; 
                ball.vx += centerPull;
                ball.vx *= 0.985;
            }

            ball.update();
            pins.forEach(p => p.update());
            checkCollisions();

            targetCamZ = ball.z - 150;
            if (targetCamZ > LANE_LENGTH - 200) targetCamZ = LANE_LENGTH - 200; 
            camera.z += (targetCamZ - camera.z) * 0.1; 
            camera.x += ((ball.x * 0.3) - camera.x) * 0.1; 

            // Strict resolving logic
            let rollEnded = false;
            if (ball.z > LANE_LENGTH + 50) rollEnded = true; 
            if (ball.vz < 0.1 && ball.z > 50) rollEnded = true; 

            if (rollEnded) {
                if (resolvingTimer === 0) resolvingTimer = Date.now();
                if (Date.now() - resolvingTimer > 2500) { 
                    gameState = 'RESOLVING';
                    steerControls.classList.add('hidden');
                    resolveRoll();
                }
            }
        }
    }

    function checkCollisions() {
        let objects = [ball, ...pins.filter(p => p.isActive)];
        for (let i = 0; i < objects.length; i++) {
            for (let j = i + 1; j < objects.length; j++) {
                let a = objects[i]; let b = objects[j];
                let dx = b.x - a.x; let dy = b.y - a.y; let dz = b.z - a.z;
                let dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
                
                if (dist === 0) { dx = 0.01; dist = 0.01; }
                
                let minDist = a.radius + b.radius;
                
                if (dist < minDist) {
                    if (!a.isPin && b.isPin && b.vy === 0) b.vy = Math.random() * 3 + 1; 
                    if (a.isPin && !b.isPin && a.vy === 0) a.vy = Math.random() * 3 + 1;

                    let nx = dx / dist; let ny = dy / dist; let nz = dz / dist;
                    let overlap = minDist - dist;
                    a.x -= nx * overlap * 0.5; a.y -= ny * overlap * 0.5; a.z -= nz * overlap * 0.5;
                    b.x += nx * overlap * 0.5; b.y += ny * overlap * 0.5; b.z += nz * overlap * 0.5;

                    let kx = a.vx - b.vx; let ky = a.vy - b.vy; let kz = a.vz - b.vz;
                    let p = 2.0 * (nx * kx + ny * ky + nz * kz) / (a.mass + b.mass);
                    
                    let dampener = 0.7;
                    a.vx -= p * b.mass * nx * dampener; a.vy -= p * b.mass * ny * dampener; a.vz -= p * b.mass * nz * dampener;
                    b.vx += p * a.mass * nx * dampener; b.vy += p * a.mass * ny * dampener; b.vz += p * a.mass * nz * dampener;
                }
            }
        }
    }

    // --- Rendering ---
    function drawPin(x, y, scale, knocked, wobble, style) {
        ctx.save();
        ctx.translate(x, y);
        
        if(knocked) {
             ctx.rotate(Math.PI/2 + wobble);
             y = y + 10*scale; 
        } else {
             ctx.rotate(wobble*0.1);
        }

        let w = 8 * scale;
        let h = 24 * scale;

        if(!knocked) {
            ctx.fillStyle = 'rgba(0,0,0,0.4)';
            ctx.beginPath(); ctx.ellipse(0, h/2, w*0.8, w*0.3, 0, 0, Math.PI*2); ctx.fill();
        }

        ctx.fillStyle = '#f8f9fa';
        ctx.beginPath();
        
        if (style === 1) { 
            ctx.arc(0, -h*0.35, w*0.35, Math.PI, 0); 
            ctx.bezierCurveTo(w*0.2, -h*0.1, w*0.8, h*0.2, w*0.55, h*0.48); 
            ctx.quadraticCurveTo(w*0.5, h*0.5, w*0.3, h*0.5); 
            ctx.lineTo(-w*0.3, h*0.5); 
            ctx.quadraticCurveTo(-w*0.5, h*0.5, -w*0.55, h*0.48); 
            ctx.bezierCurveTo(-w*0.8, h*0.2, -w*0.2, -h*0.1, -w*0.35, -h*0.35); 
        } else { 
            ctx.arc(0, -h*0.35, w*0.45, Math.PI, 0); 
            ctx.bezierCurveTo(w*0.4, -h*0.1, w*0.6, h*0.2, w*0.6, h*0.45); 
            ctx.lineTo(w*0.4, h*0.5); ctx.lineTo(-w*0.4, h*0.5); ctx.lineTo(-w*0.6, h*0.45);
            ctx.bezierCurveTo(-w*0.6, h*0.2, -w*0.4, -h*0.1, -w*0.45, -h*0.35); 
        }
        ctx.closePath();
        ctx.fill();

        let grad = ctx.createLinearGradient(-w, 0, w, 0);
        grad.addColorStop(0, 'rgba(0,0,0,0.3)'); grad.addColorStop(0.3, 'rgba(255,255,255,0.8)'); grad.addColorStop(1, 'rgba(0,0,0,0.5)');
        ctx.fillStyle = grad; ctx.fill();

        ctx.strokeStyle = '#e74c3c'; ctx.lineWidth = 1.5 * scale;
        ctx.beginPath(); ctx.moveTo(-w*0.4, -h*0.2); ctx.lineTo(w*0.4, -h*0.2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-w*0.45, -h*0.05); ctx.lineTo(w*0.45, -h*0.05); ctx.stroke();

        ctx.restore();
    }

    function draw() {
        let bgGrad = ctx.createRadialGradient(canvas.width/2, canvas.height/4, 100, canvas.width/2, canvas.height/2, canvas.width);
        bgGrad.addColorStop(0, '#1e293b'); bgGrad.addColorStop(1, '#020617');
        ctx.fillStyle = bgGrad; ctx.fillRect(0, 0, canvas.width, canvas.height);

        const laneOffsets = [-LANE_WIDTH*3 - 40, -LANE_WIDTH*1.5 - 20, 0, LANE_WIDTH*1.5 + 20, LANE_WIDTH*3 + 40];
        let startZ = Math.max(0, camera.z - 100); 
        let endZ = LANE_LENGTH + 100;

        laneOffsets.forEach((offsetX) => {
            let tl = project(offsetX - LANE_WIDTH/2, 0, endZ); let tr = project(offsetX + LANE_WIDTH/2, 0, endZ);
            let bl = project(offsetX - LANE_WIDTH/2, 0, startZ); let br = project(offsetX + LANE_WIDTH/2, 0, startZ);

            if (tl && tr && bl && br) {
                let laneGrad = ctx.createLinearGradient(bl.x, bl.y, tl.x, tl.y);
                laneGrad.addColorStop(0, '#cda270'); laneGrad.addColorStop(1, '#6b4c2a'); 
                
                if (offsetX !== 0) {
                     laneGrad.addColorStop(0, '#a5825a'); laneGrad.addColorStop(1, '#4d361d');
                }

                ctx.fillStyle = laneGrad; 
                ctx.beginPath(); ctx.moveTo(bl.x, bl.y); ctx.lineTo(br.x, br.y); ctx.lineTo(tr.x, tr.y); ctx.lineTo(tl.x, tl.y); ctx.fill();
                
                ctx.strokeStyle = 'rgba(0,0,0,0.15)';
                for(let i= -LANE_WIDTH/2 + 10; i < LANE_WIDTH/2; i+=10) {
                    let p1 = project(offsetX + i, 0, startZ); let p2 = project(offsetX + i, 0, endZ);
                    if(p1 && p2) { ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke(); }
                }

                ctx.fillStyle = '#111827';
                let gtl = project(offsetX - LANE_WIDTH/2 - 10, 0, endZ); let gbl = project(offsetX - LANE_WIDTH/2 - 10, 0, startZ);
                if(gtl && gbl) { ctx.beginPath(); ctx.moveTo(gbl.x, gbl.y); ctx.lineTo(bl.x, bl.y); ctx.lineTo(tl.x, tl.y); ctx.lineTo(gtl.x, gtl.y); ctx.fill(); }
                
                let gtr = project(offsetX + LANE_WIDTH/2 + 10, 0, endZ); let gbr = project(offsetX + LANE_WIDTH/2 + 10, 0, startZ);
                if(gtr && gbr) { ctx.beginPath(); ctx.moveTo(br.x, br.y); ctx.lineTo(gbr.x, gbr.y); ctx.lineTo(gtr.x, gtr.y); ctx.lineTo(tr.x, tr.y); ctx.fill(); }

                if (offsetX === 0) {
                    ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 2; ctx.shadowColor = '#38bdf8'; ctx.shadowBlur = 15;
                    ctx.beginPath(); ctx.moveTo(bl.x, bl.y); ctx.lineTo(tl.x, tl.y); ctx.stroke();
                    ctx.beginPath(); ctx.moveTo(br.x, br.y); ctx.lineTo(tr.x, tr.y); ctx.stroke();
                    ctx.shadowBlur = 0;
                }
            }
        });

        if (gameState === 'ANGLE' && !players[currentPlayerIndex].isCPU) {
            let tempAngle = (meterValue - 0.5) * 0.3;
            let guideZ = 400; let guideX = ball.x + Math.sin(tempAngle) * guideZ;
            let projGuide = project(guideX, 0, guideZ); let projBall = project(ball.x, ball.radius, ball.z);
            
            if (projGuide && projBall) {
                ctx.beginPath(); ctx.moveTo(projBall.x, projBall.y); ctx.lineTo(projGuide.x, projGuide.y);
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'; ctx.lineWidth = 2; ctx.setLineDash([15, 15]); ctx.stroke(); ctx.setLineDash([]);
            }
        }

        let drawables = [...backgroundPins, ...pins, ball].filter(obj => obj && obj.isActive);
        drawables.sort((a, b) => b.z - a.z);

        drawables.forEach(obj => {
            let p = project(obj.x, obj.y, obj.z);
            if (p && p.scale > 0) {
                if (obj.isPin) {
                    drawPin(p.x, p.y, p.scale, obj.knocked, obj.wobble, selectedPinStyle);
                } else {
                    let screenRadius = obj.radius * p.scale;
                    
                    if (obj.y > obj.radius) {
                        let shadowP = project(obj.x, 0, obj.z);
                        if (shadowP) {
                            ctx.fillStyle = 'rgba(0,0,0,0.6)';
                            ctx.beginPath(); ctx.ellipse(shadowP.x, shadowP.y, screenRadius, screenRadius*0.4, 0, 0, Math.PI*2); ctx.fill();
                        }
                    }

                    let gradX = p.x - screenRadius*0.3;
                    let gradY = p.y - screenRadius*0.3;
                    let grad = ctx.createRadialGradient(gradX, gradY, screenRadius*0.05, p.x, p.y, screenRadius);
                    grad.addColorStop(0, '#ffffff'); 
                    grad.addColorStop(0.15, obj.color); 
                    grad.addColorStop(0.75, obj.color); 
                    grad.addColorStop(1, '#000000');
                    
                    ctx.beginPath(); 
                    ctx.arc(p.x, p.y, screenRadius, 0, Math.PI * 2); 
                    ctx.fillStyle = grad; 
                    ctx.fill();

                    let rollAngle = (obj.z / obj.radius) % (Math.PI * 2); 
                    let faceZ = Math.cos(rollAngle); 
                    let faceY = Math.sin(rollAngle); 
                    
                    if (faceZ > 0) {
                        let cx = p.x;
                        let cy = p.y - (faceY * screenRadius * 0.7);
                        let holeRadius = screenRadius * 0.15 * faceZ; 
                        
                        let thumbY = cy + (screenRadius * 0.25 * faceZ);
                        let fingersY = cy - (screenRadius * 0.15 * faceZ);
                        let f1x = cx - (screenRadius * 0.22 * faceZ);
                        let f2x = cx + (screenRadius * 0.22 * faceZ);
                        
                        const drawHole = (hx, hy, hr) => {
                            ctx.fillStyle = `rgba(0,0,0,${faceZ})`;
                            ctx.beginPath(); ctx.arc(hx, hy, hr, 0, Math.PI*2); ctx.fill();
                            ctx.fillStyle = `rgba(255,255,255,${faceZ * 0.15})`;
                            ctx.beginPath(); ctx.arc(hx, hy - hr*0.2, hr*0.8, 0, Math.PI*2); ctx.fill();
                        };

                        drawHole(cx, thumbY, holeRadius * 1.2);
                        drawHole(f1x, fingersY, holeRadius);
                        drawHole(f2x, fingersY, holeRadius);
                    }
                }
            }
        });
        
        let backWallY = project(0, 50, LANE_LENGTH + 20);
        let backWallFloor = project(0, 0, LANE_LENGTH + 50);
        if(backWallY && backWallFloor) {
            ctx.fillStyle = '#0f172a'; ctx.fillRect(0, 0, canvas.width, backWallY.y);
            ctx.fillStyle = '#e11d48'; ctx.fillRect(0, backWallY.y-10, canvas.width, 10);
        }
    }

    function gameLoop() {
        if (!isPaused) { updatePhysics(); draw(); }
        requestAnimationFrame(gameLoop);
    }

    function resolveRoll() {
        let player = players[currentPlayerIndex];
        let frame = player.frames[currentFrame];
        
        let alivePins = pins.filter(p => !p.knocked); 
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

    gameLoop();
});
