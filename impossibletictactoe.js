document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const setupMenu = document.getElementById('setup-menu');
    const modeSelection = document.getElementById('mode-selection');
    const pvcSetup = document.getElementById('pvc-setup');
    const pvpSetup = document.getElementById('pvp-setup');
    const gameInterface = document.getElementById('game-interface');
    
    const modeBtns = document.querySelectorAll('.mode-btn');
    const startPvcBtns = document.querySelectorAll('.start-btn');
    const startPvpBtn = document.getElementById('start-pvp-btn');
    const backBtns = document.querySelectorAll('.back-btn');
    
    const restartBtn = document.getElementById('restart-btn');
    const menuBtn = document.getElementById('menu-btn');
    const pauseBtn = document.getElementById('pause-btn');
    const resumeBtn = document.getElementById('resume-btn');
    const pauseOverlay = document.getElementById('pause-overlay');
    
    const statusText = document.getElementById('status-text');
    const cells = document.querySelectorAll('.cell');
    const winLineContainer = document.getElementById('win-line-container');
    const winLine = document.getElementById('win-line');

    const p1Input = document.getElementById('p1-name');
    const p2Input = document.getElementById('p2-name');

    // Game State
    let board = ["", "", "", "", "", "", "", "", ""];
    let currentPlayer = "X"; 
    let gameActive = false;
    let isPaused = false;
    let isProcessingTurn = false; 
    
    // Settings
    let isVsComputer = true;
    let aiDifficulty = "difficult";
    let humanPiece = "X";
    let aiPiece = "O";
    
    let player1Name = "Player 1";
    let player2Name = "Player 2";

    // Winning Combinations
    const winConditions = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
        [0, 3, 6], [1, 4, 7], [2, 5, 8], // Cols
        [0, 4, 8], [2, 4, 6]             // Diagonals
    ];

    // Responsive Coordinates for dashed line (0-100 percentage based)
    const lineCoords = [
        {x1: 5, y1: 16.6, x2: 95, y2: 16.6},   // Row 1
        {x1: 5, y1: 50, x2: 95, y2: 50},       // Row 2
        {x1: 5, y1: 83.3, x2: 95, y2: 83.3},   // Row 3
        {x1: 16.6, y1: 5, x2: 16.6, y2: 95},   // Col 1
        {x1: 50, y1: 5, x2: 50, y2: 95},       // Col 2
        {x1: 83.3, y1: 5, x2: 83.3, y2: 95},   // Col 3
        {x1: 5, y1: 5, x2: 95, y2: 95},        // Diag 1
        {x1: 95, y1: 5, x2: 5, y2: 95}         // Diag 2
    ];

    // Navigation Logic
    modeBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const mode = e.target.getAttribute('data-mode');
            modeSelection.classList.add('hidden');
            
            if (mode === 'pvp') {
                isVsComputer = false;
                pvpSetup.classList.remove('hidden');
            } else {
                isVsComputer = true;
                aiDifficulty = mode.split('-')[1];
                pvcSetup.classList.remove('hidden');
            }
        });
    });

    backBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            pvcSetup.classList.add('hidden');
            pvpSetup.classList.add('hidden');
            modeSelection.classList.remove('hidden');
        });
    });

    startPvcBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            humanPiece = e.target.getAttribute('data-piece');
            aiPiece = humanPiece === "X" ? "O" : "X";
            player1Name = "You";
            player2Name = "Computer";
            startGame();
        });
    });

    startPvpBtn.addEventListener('click', () => {
        player1Name = p1Input.value.trim() || "Player 1";
        player2Name = p2Input.value.trim() || "Player 2";
        startGame();
    });

    // Pause Logic
    pauseBtn.addEventListener('click', () => {
        if (!gameActive && !isPaused) return; 
        isPaused = true;
        pauseOverlay.classList.remove('hidden');
    });

    resumeBtn.addEventListener('click', () => {
        isPaused = false;
        pauseOverlay.classList.add('hidden');
    });

    menuBtn.addEventListener('click', () => {
        gameInterface.classList.add('hidden');
        setupMenu.classList.remove('hidden');
        pvcSetup.classList.add('hidden');
        pvpSetup.classList.add('hidden');
        modeSelection.classList.remove('hidden');
    });

    restartBtn.addEventListener('click', startGame);

    function startGame() {
        setupMenu.classList.add('hidden');
        gameInterface.classList.remove('hidden');
        winLineContainer.classList.add('hidden');
        restartBtn.classList.add('hidden');
        pauseOverlay.classList.add('hidden');
        
        board = ["", "", "", "", "", "", "", "", ""];
        currentPlayer = "X";
        gameActive = true;
        isPaused = false;
        isProcessingTurn = false;
        
        updateStatusText();

        cells.forEach(cell => {
            cell.innerHTML = "";
        });

        // If human chose O, computer (X) goes first
        if (isVsComputer && humanPiece === "O") {
            isProcessingTurn = true;
            setTimeout(computerMove, 600);
        }
    }

    function updateStatusText() {
        let name = "";
        if (isVsComputer) {
            name = currentPlayer === humanPiece ? "Your" : "Computer's";
            statusText.innerText = `${name} Turn (${currentPlayer})`;
        } else {
            name = currentPlayer === "X" ? player1Name : player2Name;
            statusText.innerText = `${name}'s Turn (${currentPlayer})`;
        }
    }

    // Cell Click Event
    cells.forEach(cell => {
        cell.addEventListener('click', () => handleCellClick(cell));
    });

    function handleCellClick(cell) {
        if (isProcessingTurn || isPaused || !gameActive) return;
        
        const index = cell.getAttribute('data-index');
        if (board[index] !== "") return;

        makeMove(index, currentPlayer);

        if (gameActive && isVsComputer && currentPlayer === aiPiece) {
            isProcessingTurn = true; 
            statusText.innerText = "Computer is thinking...";
            setTimeout(computerMove, 600); 
        }
    }

    function makeMove(index, player) {
        board[index] = player;
        
        const piece = document.createElement('div');
        piece.classList.add('piece', player.toLowerCase());
        piece.innerText = player;
        cells[index].appendChild(piece);
        
        checkWin(player);

        if (gameActive) {
            currentPlayer = currentPlayer === "X" ? "O" : "X";
            updateStatusText();
        }
    }

    function checkWin(player) {
        let roundWon = false;
        let winIndex = -1;

        for (let i = 0; i < winConditions.length; i++) {
            const [a, b, c] = winConditions[i];
            if (board[a] && board[a] === board[b] && board[a] === board[c]) {
                roundWon = true;
                winIndex = i;
                break;
            }
        }

        if (roundWon) {
            gameActive = false;
            statusText.innerText = `Drawing line...`;

            const coords = lineCoords[winIndex];
            winLine.setAttribute('x1', coords.x1);
            winLine.setAttribute('y1', coords.y1);
            winLine.setAttribute('x2', coords.x2);
            winLine.setAttribute('y2', coords.y2);

            winLineContainer.classList.remove('hidden');
            winLineContainer.style.animation = 'none';
            winLineContainer.offsetHeight; // force reflow
            winLineContainer.style.animation = null;

            setTimeout(() => {
                let winnerName = "";
                if (isVsComputer) {
                    winnerName = player === humanPiece ? "You Win!" : "Computer Wins!";
                } else {
                    winnerName = player === "X" ? `${player1Name} Wins!` : `${player2Name} Wins!`;
                }
                statusText.innerText = winnerName;
                restartBtn.classList.remove('hidden');
            }, 800);
            return;
        }

        if (!board.includes("")) {
            statusText.innerText = "It's a Draw!";
            gameActive = false;
            restartBtn.classList.remove('hidden');
            return;
        }
    }

    // AI Logic
    function computerMove() {
        if (!gameActive || isPaused) {
            isProcessingTurn = false;
            return;
        }

        let availableIndices = board.map((val, idx) => val === "" ? idx : null).filter(val => val !== null);
        let moveIndex;

        if (aiDifficulty === "easy") {
            moveIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
        } else if (aiDifficulty === "medium") {
            if (Math.random() > 0.4) {
                moveIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
            } else {
                moveIndex = minimax(board, aiPiece).index;
            }
        } else {
            moveIndex = minimax(board, aiPiece).index;
        }

        makeMove(moveIndex, aiPiece);
        isProcessingTurn = false; 
    }

    // Minimax Algorithm
    function minimax(newBoard, player) {
        let availSpots = newBoard.map((val, idx) => val === "" ? idx : null).filter(val => val !== null);

        if (checkWinForMinimax(newBoard, humanPiece)) {
            return { score: -10 };
        } else if (checkWinForMinimax(newBoard, aiPiece)) {
            return { score: 10 };
        } else if (availSpots.length === 0) {
            return { score: 0 };
        }

        let moves = [];

        for (let i = 0; i < availSpots.length; i++) {
            let move = {};
            move.index = availSpots[i];
            newBoard[availSpots[i]] = player;

            if (player === aiPiece) {
                let result = minimax(newBoard, humanPiece);
                move.score = result.score;
            } else {
                let result = minimax(newBoard, aiPiece);
                move.score = result.score;
            }

            newBoard[availSpots[i]] = "";
            moves.push(move);
        }

        let bestMove;
        if (player === aiPiece) {
            let bestScore = -10000;
            for (let i = 0; i < moves.length; i++) {
                if (moves[i].score > bestScore) {
                    bestScore = moves[i].score;
                    bestMove = i;
                }
            }
        } else {
            let bestScore = 10000;
            for (let i = 0; i < moves.length; i++) {
                if (moves[i].score < bestScore) {
                    bestScore = moves[i].score;
                    bestMove = i;
                }
            }
        }

        return moves[bestMove];
    }

    function checkWinForMinimax(boardToCheck, player) {
        for (let i = 0; i < winConditions.length; i++) {
            const [a, b, c] = winConditions[i];
            if (boardToCheck[a] === player && boardToCheck[b] === player && boardToCheck[c] === player) {
                return true;
            }
        }
        return false;
    }
});
