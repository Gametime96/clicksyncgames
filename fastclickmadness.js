document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const gridBoard = document.getElementById('grid-board');
    const scoreDisplay = document.getElementById('score-display');
    const lifeDisplay = document.getElementById('life-display');
    const levelDisplay = document.getElementById('level-display');
    
    // Screens & Menus
    const overlayMenu = document.getElementById('overlay-menu');
    const introScreen = document.getElementById('intro-screen');
    const gameOverScreen = document.getElementById('game-over-screen');
    const pausedScreen = document.getElementById('paused-screen');
    const startButton = document.getElementById('start-button');
    const restartButton = document.getElementById('restart-button');
    const finalScore = document.getElementById('final-score');
    const finalLevel = document.getElementById('final-level');
    
    // Intro Specific Elements
    const introTitle = document.getElementById('intro-title');
    const tutorialContainer = document.getElementById('tutorial-container');
    const tutorialCursor = document.getElementById('tutorial-cursor');
    const tTiles = [
        document.getElementById('t-tile-0'),
        document.getElementById('t-tile-1'),
        document.getElementById('t-tile-2'),
        document.getElementById('t-tile-3')
    ];
    
    // Controls
    const pauseButton = document.getElementById('pause-button');
    const returnButton = document.getElementById('return-button');

    // Game State Variables
    let tiles = [];
    let score = 0;
    let life = 3;
    let level = 1;
    let currentGridSize = 3;
    
    let isPlaying = false;
    let isPaused = false;
    
    // --- THE FIXED FAILSAFE MEMORY VARIABLES ---
    let activeTileIndex = -1; 
    let lastTileIndex = -1; // Permanently stores the last lit tile 
    
    // Timers
    let gameInterval;
    let nodeSpawnTime = 0;
    let remainingTime = 0;

    // --- INTRO SEQUENCE ---
    function runIntro() {
        setTimeout(() => introTitle.classList.add('visible'), 100);
        
        setTimeout(() => {
            introTitle.classList.remove('visible');
        }, 3000);

        setTimeout(() => {
            introTitle.style.display = 'none';
            tutorialContainer.style.display = 'flex';
            
            // Bring cursor on screen
            setTimeout(() => { tutorialCursor.classList.add('visible'); }, 500);

            // Animate exact clicks on tiles
            setTimeout(() => simulateTutorialClick(0), 1500);
            setTimeout(() => simulateTutorialClick(3), 4000);
            setTimeout(() => simulateTutorialClick(1), 6500);

            setTimeout(() => {
                tutorialCursor.classList.remove('visible');
                tutorialContainer.style.display = 'none';
                startButton.style.display = 'inline-block';
            }, 9500); 

        }, 3500);
    }

    function simulateTutorialClick(tileIndex) {
        const targetTile = tTiles[tileIndex];
        tTiles[tileIndex].classList.add('sim-active');
        
        // Mathematically calculate the exact center of the tile
        const containerRect = tutorialContainer.getBoundingClientRect();
        const tileRect = targetTile.getBoundingClientRect();

        const centerTop = tileRect.top - containerRect.top + (tileRect.height / 2);
        const centerLeft = tileRect.left - containerRect.left + (tileRect.width / 2);

        tutorialCursor.style.top = `${centerTop}px`;
        tutorialCursor.style.left = `${centerLeft}px`;
        
        setTimeout(() => {
            tutorialCursor.classList.add('clicking');
            tTiles[tileIndex].classList.add('sim-click');
            
            setTimeout(() => {
                tutorialCursor.classList.remove('clicking');
                tTiles[tileIndex].classList.remove('sim-click');
                tTiles[tileIndex].classList.remove('sim-active');
            }, 200);
        }, 800); 
    }

    // --- GAME LOGIC ---
    function createBoard(size) {
        gridBoard.innerHTML = '';
        tiles = [];
        gridBoard.style.setProperty('--grid-size', size);
        
        for (let i = 0; i < size * size; i++) {
            const tile = document.createElement('div');
            tile.classList.add('tile');
            tile.dataset.index = i;
            tile.addEventListener('pointerdown', handleTileClick);
            
            gridBoard.appendChild(tile);
            tiles.push(tile);
        }
    }

    function getGridSizeForLevel(lvl) {
        if (lvl <= 5) return 3;  
        if (lvl <= 10) return 4; 
        if (lvl <= 15) return 5; 
        return 6;                
    }

    function getSpeedForLevel(lvl) {
        return 2000 - ((lvl - 1) * 60);
    }

    function startGame() {
        score = 0;
        life = 3;
        level = 1;
        currentGridSize = 3;
        isPlaying = true;
        isPaused = false;
        
        lastTileIndex = -1; // Reset memory at the start of a new game
        
        updateUI();
        overlayMenu.classList.remove('active');
        gameOverScreen.style.display = 'none';
        introScreen.style.display = 'none';
        pausedScreen.classList.remove('active');
        pauseButton.textContent = "Pause (P)";
        
        createBoard(currentGridSize);
        spawnNode();
    }

    function spawnNode() {
        if (!isPlaying || isPaused) return;

        // --- FIXED FAILSAFE LOGIC ---
        // It checks against `lastTileIndex` instead of `activeTileIndex`. 
        // This guarantees a repeat is impossible, even after a fast click.
        let newIndex;
        const totalTiles = currentGridSize * currentGridSize;
        do {
            newIndex = Math.floor(Math.random() * totalTiles);
        } while (newIndex === lastTileIndex);

        lastTileIndex = newIndex; // Update the memory bank to the new tile
        activeTileIndex = newIndex; 
        tiles[activeTileIndex].classList.add('active-node');

        const speed = getSpeedForLevel(level);
        remainingTime = speed;
        nodeSpawnTime = Date.now();

        gameInterval = setTimeout(missNode, speed);
    }

    function handleTileClick(e) {
        if (!isPlaying || isPaused) return;
        
        const clickedIndex = parseInt(e.target.dataset.index);

        if (clickedIndex === activeTileIndex) {
            // Success
            clearTimeout(gameInterval);
            
            // Instantly un-highlights the tile
            tiles[activeTileIndex].classList.remove('active-node'); 
            activeTileIndex = -1; 
            
            score += 10;
            checkLevelUp();
            updateUI();
            
            spawnNode(); 
        } else {
            // Wrong tile clicked
            triggerErrorVisual(clickedIndex);
            deductLife();
        }
    }

    function checkLevelUp() {
        const calculatedLevel = Math.floor(score / 120) + 1;
        const newLevel = Math.min(20, calculatedLevel);
        
        if (newLevel > level) {
            level = newLevel;
            
            const newSize = getGridSizeForLevel(level);
            if (newSize !== currentGridSize) {
                currentGridSize = newSize;
                createBoard(currentGridSize);
                lastTileIndex = -1; // Reset memory when board changes size
            }
        }
    }

    function missNode() {
        if (!isPlaying || isPaused) return;

        if (activeTileIndex !== -1 && tiles[activeTileIndex]) {
            tiles[activeTileIndex].classList.remove('active-node');
            activeTileIndex = -1;
        }
        
        deductLife();
        
        if (isPlaying) {
            spawnNode();
        }
    }

    function deductLife() {
        life--;
        updateUI();
        if (life <= 0) {
            endGame();
        }
    }

    function triggerErrorVisual(index) {
        const tile = tiles[index];
        if (tile) {
            tile.classList.add('error-node');
            setTimeout(() => tile.classList.remove('error-node'), 200);
        }
    }

    function updateUI() {
        scoreDisplay.textContent = score;
        lifeDisplay.textContent = life;
        levelDisplay.textContent = level;
    }

    function togglePause() {
        if (!isPlaying) return;
        isPaused = !isPaused;

        if (isPaused) {
            clearTimeout(gameInterval);
            const elapsedTime = Date.now() - nodeSpawnTime;
            remainingTime -= elapsedTime;
            
            pausedScreen.classList.add('active');
            pauseButton.textContent = "Resume (P)";
        } else {
            pausedScreen.classList.remove('active');
            pauseButton.textContent = "Pause (P)";
            
            nodeSpawnTime = Date.now();
            gameInterval = setTimeout(missNode, remainingTime);
        }
    }

    function endGame() {
        isPlaying = false;
        clearTimeout(gameInterval);
        activeTileIndex = -1;
        
        finalScore.textContent = score;
        finalLevel.textContent = level;
        
        introScreen.style.display = 'none';
        gameOverScreen.style.display = 'flex';
        gameOverScreen.style.flexDirection = 'column';
        gameOverScreen.style.alignItems = 'center';
        overlayMenu.classList.add('active');
    }

    // --- EVENT LISTENERS ---
    startButton.addEventListener('click', startGame);
    restartButton.addEventListener('click', startGame);
    pauseButton.addEventListener('click', togglePause);
    
    returnButton.addEventListener('click', () => {
        window.location.href = 'https://clicksyncgames.com';
    });

    document.addEventListener('keydown', (e) => {
        if (e.key.toLowerCase() === 'p') {
            togglePause();
        }
    });

    createBoard(currentGridSize);
    runIntro();
});
