window.addEventListener("load", function() {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    
    // Internal logical resolution for math consistency
    canvas.width = 800;
    canvas.height = 1000;

    let gameState = 'MENU'; 
    let isPaused = false;

    // Bubble Grid
    const ROW_COUNT = 16; 
    const COL_COUNT = 14; 
    const BUBBLE_RADIUS = 28; 
    const GRID_OFFSET_X = (canvas.width - (COL_COUNT * BUBBLE_RADIUS * 2)) / 2 + BUBBLE_RADIUS;
    const GRID_OFFSET_Y = BUBBLE_RADIUS + 10;
    const ROW_HEIGHT = BUBBLE_RADIUS * Math.sqrt(3); 

    // Mechanics
    const SHOOTER_X = canvas.width / 2;
    const SHOOTER_Y = canvas.height - 60;
    const BUBBLE_SPEED = 30; 
    
    // Solid uniform colors 
    const COLORS = [
        '#ef4444', // Red
        '#3b82f6', // Blue
        '#22c55e', // Green
        '#eab308', // Yellow
        '#a855f7', // Purple
        '#ec4899'  // Pink
    ];

    let activeColors = 3; 
    let grid = []; 
    let currentBubble = null;
    let nextBubbleColor = null;
    let score = 0;
    let level = 1;

    // Time-based dropping
    let lastDropTime = 0;
    const DROP_INTERVAL_MS = 6000; // 6 seconds

    let particles = [];
    
    // Pointer
    let pointerX = SHOOTER_X;
    let pointerY = SHOOTER_Y - 100;

    // DOM
    const menuOverlay = document.getElementById('menu-overlay');
    const pauseOverlay = document.getElementById('pause-overlay');
    const gameOverOverlay = document.getElementById('game-over-overlay');
    const hudScore = document.getElementById('hud-score');
    const hudLevel = document.getElementById('hud-level');
    const finalScoreVal = document.getElementById('final-score-val');
    const endTitle = document.getElementById('end-title');
    const endMessage = document.getElementById('end-message');

    class Bubble {
        constructor(x, y, row, col, color) {
            this.x = x; this.y = y;
            this.row = row; this.col = col;
            this.color = color;
            this.radius = BUBBLE_RADIUS;
            this.vx = 0; this.vy = 0;
            this.isMoving = false;
            this.dropVy = 0;
            this.isDropping = false;
        }

        draw(ctx) {
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.beginPath(); 
            ctx.arc(0, 0, this.radius - 1, 0, Math.PI * 2);
            ctx.fillStyle = this.color; 
            ctx.fill();
            ctx.lineWidth = 2; 
            ctx.strokeStyle = 'rgba(0,0,0,0.5)'; 
            ctx.stroke();
            ctx.restore();
        }

        update() {
            if (this.isMoving) {
                this.x += this.vx; this.y += this.vy;
                if (this.x - this.radius <= 0) { this.x = this.radius; this.vx *= -1; } 
                else if (this.x + this.radius >= canvas.width) { this.x = canvas.width - this.radius; this.vx *= -1; }

                if (this.y - this.radius <= 0) {
                    this.y = this.radius; this.snapToGrid();
                } else if (this.checkGridCollision()) {
                    this.snapToGrid();
                }
            } else if (this.isDropping) {
                this.dropVy += 0.5; this.y += this.dropVy;
            }
        }

        checkGridCollision() {
            for (let r = 0; r < grid.length; r++) {
                if(!grid[r]) continue;
                for (let c = 0; c < grid[r].length; c++) {
                    let b = grid[r][c];
                    if (b && !b.isDropping) {
                        let dist = Math.sqrt(Math.pow(this.x - b.x, 2) + Math.pow(this.y - b.y, 2));
                        if (dist < this.radius * 2 - 4) return true;
                    }
                }
            }
            return false;
        }

        snapToGrid() {
            this.isMoving = false;
            
            let gridY = this.y - GRID_OFFSET_Y;
            let row = Math.round(gridY / ROW_HEIGHT);
            if (row < 0) row = 0;

            let isOffsetRow = row % 2 !== 0;
            let rowStartX = isOffsetRow ? GRID_OFFSET_X + BUBBLE_RADIUS : GRID_OFFSET_X;
            let gridX = this.x - rowStartX;
            let col = Math.round(gridX / (BUBBLE_RADIUS * 2));
            
            let maxCols = isOffsetRow ? COL_COUNT - 1 : COL_COUNT;
            if (col < 0) col = 0;
            if (col >= maxCols) col = maxCols - 1;

            if (grid[row] && grid[row][col]) {
                let neighbors = getNeighbors(row, col, true);
                let emptyNeighbor = null;
                let minDist = Infinity;
                
                for(let n of neighbors) {
                    if(n.r >= 0 && n.c >= 0 && (!grid[n.r] || !grid[n.r][n.c])) {
                        let nx = getGridX(n.r, n.c); let ny = getGridY(n.r);
                        let d = Math.sqrt(Math.pow(this.x - nx, 2) + Math.pow(this.y - ny, 2));
                        if(d < minDist) { minDist = d; emptyNeighbor = n; }
                    }
                }
                
                if (emptyNeighbor) {
                    row = emptyNeighbor.r; col = emptyNeighbor.c;
                } else {
                    triggerGameOver(false); return;
                }
            }

            while (grid.length <= row) grid.push([]);

            this.row = row; this.col = col;
            this.x = getGridX(row, col); this.y = getGridY(row);
            grid[row][col] = this;

            gameState = 'ANIMATING';
            let cluster = findMatchCluster(row, col, this.color);
            
            if (cluster.length >= 3) {
                score += cluster.length * 10;
                updateHUD();
                cluster.forEach(b => { grid[b.row][b.col] = null; createExplosion(b.x, b.y, b.color); });
                dropFloaters();
            }

            checkDangerLine();

            if (gameState !== 'GAMEOVER') {
                if (isBoardEmpty()) {
                    level++; score += 1000 * level;
                    startLevel(); return;
                }

                setTimeout(() => { 
                    if(gameState !== 'GAMEOVER') { 
                        gameState = 'PLAYING'; 
                        prepareNextBubble(); // Process queue
                    } 
                }, cluster.length >= 3 ? 300 : 50);
            }
        }
    }

    class Particle {
        constructor(x, y, color) {
            this.x = x; this.y = y;
            let angle = Math.random() * Math.PI * 2;
            let speed = Math.random() * 8 + 2;
            this.vx = Math.cos(angle) * speed; this.vy = Math.sin(angle) * speed;
            this.color = color;
            this.life = 1.0;
            this.decay = Math.random() * 0.05 + 0.02;
            this.size = Math.random() * 6 + 4;
        }
        update() {
            this.x += this.vx; this.y += this.vy; this.vy += 0.2; this.life -= this.decay;
        }
        draw(ctx) {
            ctx.globalAlpha = this.life; ctx.fillStyle = this.color;
            ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI*2); ctx.fill();
            ctx.globalAlpha = 1.0;
        }
    }

    function getGridX(row, col) { return (row % 2 !== 0 ? GRID_OFFSET_X + BUBBLE_RADIUS : GRID_OFFSET_X) + (col * BUBBLE_RADIUS * 2); }
    function getGridY(row) { return GRID_OFFSET_Y + (row * ROW_HEIGHT); }
    function getRandomColor() { return COLORS[Math.floor(Math.random() * activeColors)]; }
    function getExistingColor() {
        let existingColors = new Set();
        for (let r = 0; r < grid.length; r++) {
            if(!grid[r]) continue;
            for (let c = 0; c < grid[r].length; c++) {
                if (grid[r][c] && !grid[r][c].isDropping) existingColors.add(grid[r][c].color);
            }
        }
        let arr = Array.from(existingColors);
        return arr.length === 0 ? getRandomColor() : arr[Math.floor(Math.random() * arr.length)];
    }

    function initGame(difficultyStr) {
        if(difficultyStr === 'easy') activeColors = 3;
        else if(difficultyStr === 'medium') activeColors = 4;
        else activeColors = 5;
        score = 0; level = 1; startLevel();
    }

    function startLevel() {
        grid = []; particles = [];
        let rowsToFill = 5 + Math.floor(level / 2);
        if(rowsToFill > 10) rowsToFill = 10;

        for (let r = 0; r < rowsToFill; r++) {
            grid[r] = [];
            let cols = (r % 2 !== 0) ? COL_COUNT - 1 : COL_COUNT;
            for (let c = 0; c < cols; c++) grid[r][c] = new Bubble(getGridX(r, c), getGridY(r), r, c, getRandomColor());
        }

        // Initialize the queue properly once per level
        nextBubbleColor = getExistingColor();
        prepareNextBubble();
        
        lastDropTime = performance.now(); // Reset drop timer
        
        updateHUD();
        menuOverlay.classList.add('hidden'); gameOverOverlay.classList.add('hidden'); pauseOverlay.classList.add('hidden');
        gameState = 'PLAYING';
    }

    function prepareNextBubble() {
        // Shift queue: current becomes next, next gets a new roll
        currentBubble = new Bubble(SHOOTER_X, SHOOTER_Y, -1, -1, nextBubbleColor);
        nextBubbleColor = getExistingColor();
    }

    function getNeighbors(row, col, includeBelow = false) {
        let isOffset = row % 2 !== 0;
        let neighbors = [{r: row, c: col - 1}, {r: row, c: col + 1}, {r: row - 1, c: col}];
        
        if (isOffset) neighbors.push({r: row - 1, c: col + 1}); 
        else neighbors.push({r: row - 1, c: col - 1}); 

        if (includeBelow) {
            neighbors.push({r: row + 1, c: col});
            if (isOffset) neighbors.push({r: row + 1, c: col + 1});
            else neighbors.push({r: row + 1, c: col - 1});
        }

        return neighbors.filter(n => n.r >= 0 && n.c >= 0 && n.c < ((n.r % 2 !== 0) ? COL_COUNT - 1 : COL_COUNT));
    }

    function findMatchCluster(startRow, startCol, targetColor) {
        let cluster = []; let visited = new Set(); let stack = [{r: startRow, c: startCol}];
        while (stack.length > 0) {
            let cur = stack.pop(); let key = `${cur.r},${cur.c}`;
            if (visited.has(key)) continue;
            visited.add(key);
            if (grid[cur.r] && grid[cur.r][cur.c] && grid[cur.r][cur.c].color === targetColor && !grid[cur.r][cur.c].isDropping) {
                cluster.push(grid[cur.r][cur.c]);
                stack.push(...getNeighbors(cur.r, cur.c, true));
            }
        }
        return cluster;
    }

    function dropFloaters() {
        let connected = new Set(); let stack = [];
        if (grid[0]) { for (let c = 0; c < grid[0].length; c++) { if (grid[0][c]) stack.push({r: 0, c: c}); } }

        while (stack.length > 0) {
            let cur = stack.pop(); let key = `${cur.r},${cur.c}`;
            if (connected.has(key)) continue;
            connected.add(key);
            getNeighbors(cur.r, cur.c, true).forEach(n => { if (grid[n.r] && grid[n.r][n.c] && !grid[n.r][n.c].isDropping) stack.push(n); });
        }

        let droppedCount = 0;
        for (let r = 0; r < grid.length; r++) {
            if(!grid[r]) continue;
            for (let c = 0; c < grid[r].length; c++) {
                let b = grid[r][c];
                if (b && !connected.has(`${r},${c}`)) {
                    b.isDropping = true; grid[r][c] = null;
                    droppedCount++; score += 20;
                }
            }
        }
        if(droppedCount > 0) updateHUD();
    }

    function addNewRow() {
        let newGrid = [];
        let newRow = [];
        for(let c=0; c < COL_COUNT; c++) newRow.push(new Bubble(getGridX(0, c), getGridY(0), 0, c, getRandomColor()));
        newGrid.push(newRow);

        for(let r=0; r<grid.length; r++) {
            let shiftedRow = [];
            if(!grid[r]) { newGrid.push(shiftedRow); continue; }
            let maxC = ((r+1) % 2 !== 0) ? COL_COUNT - 1 : COL_COUNT;

            for(let c=0; c<maxC; c++) {
                if(c >= grid[r].length) continue; 
                let b = grid[r][c];
                if(b) {
                    b.row = r + 1; b.col = c;
                    b.y = getGridY(r+1); b.x = getGridX(r+1, c);
                    shiftedRow.push(b);
                } else { shiftedRow.push(null); }
            }
            newGrid.push(shiftedRow);
        }
        grid = newGrid;
        
        checkDangerLine();
    }

    function checkDangerLine() {
        let dangerY = getGridY(ROW_COUNT - 1) + BUBBLE_RADIUS;
        for(let r=0; r<grid.length; r++) {
            if(!grid[r]) continue;
            for(let c=0; c<grid[r].length; c++) {
                let b = grid[r][c];
                if(b && !b.isDropping && (b.y + b.radius >= dangerY)) {
                    triggerGameOver(false);
                    return;
                }
            }
        }
    }

    function isBoardEmpty() {
        for(let r=0; r<grid.length; r++) {
            if(grid[r]) {
                for(let c=0; c<grid[r].length; c++) { if(grid[r][c] && !grid[r][c].isDropping) return false; }
            }
        }
        return true;
    }

    function createExplosion(x, y, color) {
        for(let i=0; i<10; i++) particles.push(new Particle(x, y, color));
    }

    function handlePointerMove(e) {
        if (gameState !== 'PLAYING') return;
        const rect = canvas.getBoundingClientRect();
        let clientX = e.clientX; let clientY = e.clientY;
        if (e.touches && e.touches.length > 0) { clientX = e.touches[0].clientX; clientY = e.touches[0].clientY; }
        
        pointerX = (clientX - rect.left) * (canvas.width / rect.width);
        pointerY = (clientY - rect.top) * (canvas.height / rect.height);
    }

    function handleShoot(e) {
        if (gameState !== 'PLAYING' || isPaused || currentBubble.isMoving) return;
        if (e.target.closest('.overlay:not(.hidden)') || e.target.closest('header')) return;

        let dx = pointerX - SHOOTER_X;
        let dy = pointerY - SHOOTER_Y;
        if (dy >= 0) return; 

        let dist = Math.sqrt(dx*dx + dy*dy);
        currentBubble.vx = (dx / dist) * BUBBLE_SPEED;
        currentBubble.vy = (dy / dist) * BUBBLE_SPEED;
        currentBubble.isMoving = true;
    }

    function togglePause() {
        if (gameState === 'MENU' || gameState === 'GAMEOVER') return;
        isPaused = !isPaused;
        pauseOverlay.classList.toggle('hidden', !isPaused);
        // Correct the timer so dropping doesn't happen instantly upon resume
        if(!isPaused) {
            lastDropTime = performance.now() - (lastDropTime > 0 ? performance.now() - lastDropTime : 0);
        }
    }

    document.addEventListener('keydown', (e) => {
        if (e.key.toLowerCase() === 'p') togglePause();
    });

    window.addEventListener('mousemove', handlePointerMove);
    canvas.addEventListener('touchmove', (e) => { e.preventDefault(); handlePointerMove(e); }, {passive: false});
    canvas.addEventListener('mousedown', handleShoot);
    canvas.addEventListener('touchstart', (e) => { e.preventDefault(); handlePointerMove(e); handleShoot(e); }, {passive: false});

    document.getElementById('start-game-btn').addEventListener('click', () => {
        let diff = document.querySelector('input[name="difficulty"]:checked').value;
        initGame(diff);
    });

    document.getElementById('pause-btn').addEventListener('click', togglePause);
    document.getElementById('resume-btn').addEventListener('click', togglePause);

    document.getElementById('restart-pause-btn').addEventListener('click', () => {
        let diff = document.querySelector('input[name="difficulty"]:checked').value;
        initGame(diff);
    });

    document.getElementById('restart-btn').addEventListener('click', () => {
        gameOverOverlay.classList.add('hidden'); menuOverlay.classList.remove('hidden');
    });

    document.getElementById('return-btn').addEventListener('click', () => {
        window.location.href = 'https://clicksyncgames.com';
    });

    function triggerGameOver(win) {
        gameState = 'GAMEOVER';
        endTitle.textContent = win ? "LEVEL CLEARED!" : "GAME OVER";
        endTitle.style.color = win ? "#facc15" : "#ef4444";
        endMessage.textContent = win ? "You cleared the board!" : "The bubbles reached the bottom line.";
        finalScoreVal.textContent = score;
        gameOverOverlay.classList.remove('hidden');
    }

    function updateHUD() {
        hudScore.textContent = score; hudLevel.textContent = level;
    }

    function drawShooter() {
        if (nextBubbleColor) {
            ctx.beginPath(); ctx.arc(SHOOTER_X - 80, SHOOTER_Y, BUBBLE_RADIUS * 0.5, 0, Math.PI*2);
            ctx.fillStyle = nextBubbleColor; ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2; ctx.stroke();
            
            ctx.fillStyle = '#94a3b8'; ctx.font = 'bold 16px Nunito'; ctx.textAlign = 'center';
            ctx.fillText("NEXT", SHOOTER_X - 80, SHOOTER_Y + 30);
        }

        ctx.save();
        ctx.translate(SHOOTER_X, SHOOTER_Y);
        let dx = pointerX - SHOOTER_X; let dy = pointerY - SHOOTER_Y;
        let angle = Math.atan2(dy, dx) + Math.PI/2;
        if (dy >= 0) angle = 0; 
        ctx.rotate(angle);
        
        ctx.fillStyle = '#334155'; ctx.beginPath(); ctx.roundRect(-25, -80, 50, 80, 8); ctx.fill();
        ctx.strokeStyle = '#8b5cf6'; ctx.lineWidth = 3; ctx.stroke();
        ctx.restore();

        ctx.beginPath(); ctx.arc(SHOOTER_X, SHOOTER_Y + 20, 60, Math.PI, 0);
        ctx.fillStyle = '#1e293b'; ctx.fill();
        ctx.strokeStyle = '#8b5cf6'; ctx.lineWidth = 4; ctx.stroke();

        if (currentBubble && !currentBubble.isMoving) {
            currentBubble.x = SHOOTER_X; currentBubble.y = SHOOTER_Y;
            currentBubble.draw(ctx);
        } else if (currentBubble && currentBubble.isMoving) {
            currentBubble.draw(ctx);
        }

        if (gameState === 'PLAYING' && !currentBubble.isMoving && dy < 0) {
            ctx.beginPath(); ctx.moveTo(SHOOTER_X, SHOOTER_Y - 60);
            let dist = 400;
            let lineX = SHOOTER_X + (dx / Math.sqrt(dx*dx + dy*dy)) * dist;
            let lineY = SHOOTER_Y + (dy / Math.sqrt(dx*dx + dy*dy)) * dist;

            ctx.lineTo(lineX, lineY);
            ctx.strokeStyle = 'rgba(139, 92, 246, 0.5)'; ctx.lineWidth = 3;
            ctx.setLineDash([10, 15]); ctx.stroke(); ctx.setLineDash([]);
        }
    }

    function update() {
        if (isPaused) return;

        // Check for time-based row drop
        if (gameState === 'PLAYING') {
            let now = performance.now();
            if (now - lastDropTime > DROP_INTERVAL_MS) {
                lastDropTime = now;
                addNewRow();
            }
        }

        if (currentBubble && currentBubble.isMoving) currentBubble.update();

        for (let r = 0; r < grid.length; r++) {
            if(!grid[r]) continue;
            for (let c = 0; c < grid[r].length; c++) {
                let b = grid[r][c];
                if (b && b.isDropping) {
                    b.update();
                    if (b.y > canvas.height + 50) grid[r][c] = null; 
                }
            }
        }

        for(let i = particles.length - 1; i >= 0; i--) {
            particles[i].update();
            if(particles[i].life <= 0) particles.splice(i, 1);
        }
    }

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        let dangerY = getGridY(ROW_COUNT - 1) + BUBBLE_RADIUS;
        ctx.beginPath(); ctx.moveTo(0, dangerY); ctx.lineTo(canvas.width, dangerY);
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)'; ctx.lineWidth = 4;
        ctx.setLineDash([20, 20]); ctx.stroke(); ctx.setLineDash([]);

        for (let r = 0; r < grid.length; r++) {
            if(!grid[r]) continue;
            for (let c = 0; c < grid[r].length; c++) {
                if (grid[r][c]) grid[r][c].draw(ctx);
            }
        }

        particles.forEach(p => p.draw(ctx));
        drawShooter();
    }

    function loop() {
        update(); draw(); requestAnimationFrame(loop);
    }

    loop();
});
