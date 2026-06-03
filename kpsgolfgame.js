document.addEventListener("DOMContentLoaded", () => {
    const suits = ['♠', '♥', '♣', '♦'];
    const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    let deck = [];
    
    // Game State
    let gameState = {
        playerGrid: new Array(9).fill(null),
        computerGrid: new Array(9).fill(null),
        drawPile: [],
        discardPile: [],
        turn: 'player', 
        phase: 'intro', 
        flipsRemaining: 2,
        endTriggeredBy: null 
    };

    let isPaused = false;
    let selectedSource = null; // Used for tap-to-move functionality

    const uiMessage = document.getElementById("message-board");
    const presentationArea = document.getElementById("presentation-area");
    const playArea = document.getElementById("play-area");
    const playerGridDOM = document.getElementById("player-grid");
    const computerGridDOM = document.getElementById("computer-grid");
    const drawPileDOM = document.getElementById("draw-pile");
    const discardPileDOM = document.getElementById("discard-pile");

    // Pause Controls
    const pauseBtn = document.getElementById("pause-btn");
    const resumeBtn = document.getElementById("resume-btn");
    const pauseModal = document.getElementById("pause-modal");

    function togglePause() {
        if (gameState.phase === 'intro') return; 
        isPaused = !isPaused;
        if (isPaused) {
            pauseModal.classList.remove('hidden');
        } else {
            pauseModal.classList.add('hidden');
        }
    }

    pauseBtn.onclick = togglePause;
    resumeBtn.onclick = togglePause;
    document.addEventListener('keydown', (e) => {
        if (e.key === 'p' || e.key === 'P') togglePause();
    });

    // --- Core Functions ---
    function buildDeck() {
        deck = [];
        for(let i=0; i<4; i++) deck.push({ id: `joker-${i}`, suit: 'Joker', value: 'Joker', color: 'black' });
        for(let d=0; d<2; d++) {
            for(let s of suits) {
                let color = (s === '♥' || s === '♦') ? 'red' : 'black';
                for(let v of values) deck.push({ id: `${d}-${s}-${v}`, suit: s, value: v, color: color });
            }
        }
    }

    function createCardElement(cardData) {
        const card = document.createElement("div");
        card.className = `card ${cardData.color} is-flipped`; 
        card.dataset.id = cardData.id;
        card.dataset.value = cardData.value;
        
        const front = document.createElement("div");
        front.className = "card-face card-front";
        front.innerText = cardData.value === 'Joker' ? '🤡' : `${cardData.value}${cardData.suit}`;
        
        const back = document.createElement("div");
        back.className = "card-face card-back";
        
        card.appendChild(front);
        card.appendChild(back);
        return card;
    }

    function updateRunningScores() {
        let pScore = 0;
        let cScore = 0;

        gameState.playerGrid.forEach(card => {
            if (card && card.element.classList.contains('is-flipped')) {
                pScore += getCardPointValue(card.value);
            }
        });

        gameState.computerGrid.forEach(card => {
            if (card && card.element.classList.contains('is-flipped')) {
                cScore += getCardPointValue(card.value);
            }
        });

        document.getElementById('player-running-score').innerText = pScore;
        document.getElementById('computer-running-score').innerText = cScore;
    }

    function clearSelection() {
        selectedSource = null;
        document.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
    }

    // --- Interaction Logic (Drag & Drop + Tap) ---
    function makeInteractable(cardObj, sourceId, pileElement) {
        if (!cardObj || !cardObj.element) return;
        
        // Native Drag
        cardObj.element.draggable = true;
        cardObj.element.classList.add('draggable');
        cardObj.element.ondragstart = (e) => {
            if (isPaused || gameState.turn !== 'player' || gameState.phase !== 'playing') {
                e.preventDefault();
                return;
            }
            clearSelection();
            e.dataTransfer.setData('text/plain', sourceId);
            e.dataTransfer.effectAllowed = 'move';
        };

        // Tap/Click support for mobile & desktop ease
        const clickTarget = pileElement || cardObj.element;
        clickTarget.onclick = (e) => {
            if (isPaused || gameState.turn !== 'player' || gameState.phase !== 'playing') return;
            e.stopPropagation();
            
            // If dropping selected card onto discard pile
            if (sourceId === 'discard' && selectedSource && selectedSource !== 'discard') {
                handleDiscardDrop(selectedSource);
                clearSelection();
                return;
            }

            // Selecting a source card
            if (sourceId === 'draw' || sourceId === 'discard' || sourceId.startsWith('grid-')) {
                clearSelection();
                selectedSource = sourceId;
                cardObj.element.classList.add('selected');
            }
        };
    }

    function setupGridCellInteraction(element, gridIndex) {
        // Drag over support
        element.ondragover = (e) => {
            e.preventDefault(); 
            if (gameState.turn === 'player' && !isPaused) element.classList.add('drag-over');
        };
        element.ondragleave = () => { element.classList.remove('drag-over'); };
        
        // Drop support
        element.ondrop = (e) => {
            e.preventDefault();
            element.classList.remove('drag-over');
            if (isPaused || gameState.turn !== 'player') return;
            const sourceId = e.dataTransfer.getData('text/plain');
            handleGridDrop(sourceId, gridIndex);
        };

        // Tap/Click drop support
        element.onclick = (e) => {
            if (isPaused || gameState.turn !== 'player') return;
            if (selectedSource && !selectedSource.startsWith('grid-')) {
                handleGridDrop(selectedSource, gridIndex);
                clearSelection();
            } else if (selectedSource && selectedSource.startsWith('grid-')) {
                 clearSelection(); // Cancel selection if tapping another grid slot
            }
        };
    }

    // --- UI Rendering ---
    function updatePileUI() {
        drawPileDOM.innerHTML = '';
        if (gameState.drawPile.length > 0) {
            const topCard = gameState.drawPile[gameState.drawPile.length - 1];
            topCard.element.classList.remove('is-flipped'); 
            makeInteractable(topCard, 'draw', drawPileDOM);
            drawPileDOM.appendChild(topCard.element);
        } else {
            drawPileDOM.onclick = null;
        }

        discardPileDOM.innerHTML = '';
        if (gameState.discardPile.length > 0) {
            const topCard = gameState.discardPile[gameState.discardPile.length - 1];
            topCard.element.classList.add('is-flipped'); 
            makeInteractable(topCard, 'discard', discardPileDOM);
            discardPileDOM.appendChild(topCard.element);
        } else {
            discardPileDOM.onclick = null;
        }
        
        // Ensure discard pile can act as a drop zone for tap-to-move
        discardPileDOM.ondragover = (e) => { e.preventDefault(); };
        discardPileDOM.ondrop = (e) => {
            e.preventDefault();
            if (isPaused || gameState.turn !== 'player') return;
            const sourceId = e.dataTransfer.getData('text/plain');
            handleDiscardDrop(sourceId);
        };
    }

    function renderGrid(gridArray, gridDOM, isPlayer) {
        gridDOM.innerHTML = '';
        for(let i = 0; i < 9; i++) {
            let cell = document.createElement('div');
            cell.className = 'grid-cell';
            
            if (isPlayer) {
                cell.classList.add('drop-zone');
                setupGridCellInteraction(cell, i);
            }

            const card = gridArray[i];
            if (card) {
                card.element.classList.remove('clickable-card', 'selectable', 'selected');

                if (isPlayer && gameState.phase === 'playing' && gameState.turn === 'player' && !card.element.classList.contains('is-flipped')) {
                    card.element.classList.add('clickable-card');
                    card.element.onclick = (e) => {
                        if (isPaused) return;
                        e.stopPropagation(); // Prevent trigger tap-drop logic
                        if (selectedSource) {
                            handleGridDrop(selectedSource, i);
                            clearSelection();
                        } else if (gameState.turn === 'player') {
                            card.element.classList.remove('clickable-card');
                            card.element.classList.add('is-flipped');
                            endPlayerTurn();
                        }
                    };
                } else if (isPlayer && gameState.phase === 'playing' && gameState.turn === 'player' && card.element.classList.contains('is-flipped')) {
                    makeInteractable(card, `grid-${i}`, null);
                } else {
                    card.element.draggable = false;
                    card.element.classList.remove('draggable');
                    card.element.onclick = null;
                }
                
                cell.appendChild(card.element);
            } else {
                const emptySlot = document.createElement("div");
                emptySlot.className = "card collapsed";
                cell.appendChild(emptySlot);
            }
            gridDOM.appendChild(cell);
        }
        updateRunningScores();
    }

    // --- Game Phases ---
    async function runIntroSequence() {
        buildDeck();
        uiMessage.innerText = "Displaying 2 full decks and 4 Jokers in order...";
        deck.forEach(cardData => {
            const el = createCardElement(cardData);
            cardData.element = el;
            presentationArea.appendChild(el);
        });

        await new Promise(r => setTimeout(r, 2000));
        const cards = document.querySelectorAll('#presentation-area .card');
        cards.forEach((card, index) => setTimeout(() => card.classList.remove('is-flipped'), index * 10));

        await new Promise(r => setTimeout(r, 1000));
        uiMessage.innerText = "Shuffling...";
        cards.forEach(card => {
            card.style.position = 'absolute';
            card.style.setProperty('--rx', Math.random() > 0.5 ? 1 : -1);
            card.style.setProperty('--ry', Math.random() > 0.5 ? 1 : -1);
            card.style.setProperty('--rr', Math.random());
            card.classList.add('shuffling');
        });

        await new Promise(r => setTimeout(r, 3000));
        cards.forEach(card => card.classList.remove('shuffling'));
        presentationArea.innerHTML = ''; 
        presentationArea.classList.add('hidden');
        playArea.classList.remove('hidden');

        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }
        
        gameState.drawPile = [...deck];
        startDealPhase();
    }

    async function startDealPhase() {
        uiMessage.innerText = "Dealing 9 cards to each player...";
        renderGrid(gameState.playerGrid, playerGridDOM, true); 
        renderGrid(gameState.computerGrid, computerGridDOM, false);

        for(let i=0; i<9; i++) {
            gameState.playerGrid[i] = gameState.drawPile.pop();
            renderGrid(gameState.playerGrid, playerGridDOM, true);
            await new Promise(r => setTimeout(r, 100));

            gameState.computerGrid[i] = gameState.drawPile.pop();
            renderGrid(gameState.computerGrid, computerGridDOM, false);
            await new Promise(r => setTimeout(r, 100));
        }

        let startDiscard = gameState.drawPile.pop();
        gameState.discardPile.push(startDiscard);
        updatePileUI();
        promptInitialFlips();
    }

    function promptInitialFlips() {
        gameState.phase = 'setup';
        uiMessage.innerText = "Setup: Click 2 of your face-down cards to flip them face up.";
        
        const cells = document.querySelectorAll('#player-grid .grid-cell');
        cells.forEach((cell, index) => {
            const card = gameState.playerGrid[index];
            if (card) {
                card.element.classList.add('selectable');
                card.element.onclick = () => {
                    if (isPaused) return;
                    if(gameState.phase === 'setup' && !card.element.classList.contains('is-flipped')) {
                        card.element.classList.add('is-flipped');
                        card.element.classList.remove('selectable');
                        gameState.flipsRemaining--;
                        updateRunningScores();
                        
                        if(gameState.flipsRemaining === 0) {
                            gameState.playerGrid.forEach(c => {
                                if(c) { 
                                    c.element.classList.remove('selectable'); 
                                    c.element.onclick = null; 
                                }
                            });
                            
                            let cIndices = [0,1,2,3,4,5,6,7,8];
                            let c1 = cIndices.splice(Math.floor(Math.random() * cIndices.length), 1)[0];
                            let c2 = cIndices.splice(Math.floor(Math.random() * cIndices.length), 1)[0];
                            gameState.computerGrid[c1].element.classList.add('is-flipped');
                            gameState.computerGrid[c2].element.classList.add('is-flipped');
                            updateRunningScores();
                            
                            startMainGameplay();
                        }
                    }
                };
            }
        });
    }

    // --- Play Actions ---
    function startMainGameplay() {
        gameState.phase = 'playing';
        playerTurn();
    }

    function playerTurn() {
        gameState.turn = 'player';
        uiMessage.innerText = "Your Turn: Click a card to flip, or swap with Draw/Discard.";
        clearSelection();
        updatePileUI();
        renderGrid(gameState.playerGrid, playerGridDOM, true);
    }

    function handleGridDrop(sourceId, targetGridIndex) {
        if (!sourceId || sourceId.startsWith('grid-')) return; 
        const oldGridCard = gameState.playerGrid[targetGridIndex];
        if (!oldGridCard) return; 

        let newCard;
        if (sourceId === 'draw') newCard = gameState.drawPile.pop();
        else if (sourceId === 'discard') newCard = gameState.discardPile.pop();

        newCard.element.classList.add('is-flipped'); 
        gameState.playerGrid[targetGridIndex] = newCard;
        
        oldGridCard.element.classList.add('is-flipped'); 
        gameState.discardPile.push(oldGridCard);

        endPlayerTurn();
    }

    function handleDiscardDrop(sourceId) {
        if (!sourceId) return;

        if (sourceId === 'draw') {
            const drawnCard = gameState.drawPile.pop();
            drawnCard.element.classList.add('is-flipped');
            gameState.discardPile.push(drawnCard);
            endPlayerTurn();
        } 
        else if (sourceId.startsWith('grid-')) {
            const gridIndex = parseInt(sourceId.split('-')[1]);
            const gridCard = gameState.playerGrid[gridIndex];
            
            gameState.discardPile.pop(); 
            gameState.discardPile.push(gridCard); 
            
            const newDrawnCard = gameState.drawPile.pop();
            newDrawnCard.element.classList.remove('is-flipped'); 
            gameState.playerGrid[gridIndex] = newDrawnCard;
            
            endPlayerTurn();
        }
    }

    // --- Turn Transitions & Endgame Logic ---
    function isGridFullyFlipped(grid) {
        return grid.every(card => card === null || card.element.classList.contains('is-flipped'));
    }

    function endPlayerTurn() {
        clearSelection();
        checkForCollapse(gameState.playerGrid, playerGridDOM, true);
        renderGrid(gameState.playerGrid, playerGridDOM, true);
        updatePileUI();
        checkTurnProgression('player');
    }

    function endComputerTurn() {
        checkForCollapse(gameState.computerGrid, computerGridDOM, false);
        renderGrid(gameState.computerGrid, computerGridDOM, false);
        updatePileUI();
        checkTurnProgression('computer');
    }

    function checkTurnProgression(justFinishedPlayer) {
        if (gameState.endTriggeredBy) {
            calculateFinalScores();
            return;
        }

        const pDone = isGridFullyFlipped(gameState.playerGrid);
        const cDone = isGridFullyFlipped(gameState.computerGrid);

        if (justFinishedPlayer === 'player' && pDone) {
            gameState.endTriggeredBy = 'player';
            uiMessage.innerText = "You flipped all your cards! Computer gets one final turn.";
            gameState.turn = 'computer';
            executeComputerTurnWhenUnpaused(2000);
            return;
        } else if (justFinishedPlayer === 'computer' && cDone) {
            gameState.endTriggeredBy = 'computer';
            uiMessage.innerText = "Computer flipped all its cards! You get one final turn.";
            playerTurn();
            return;
        }

        if (justFinishedPlayer === 'player') {
            gameState.turn = 'computer';
            uiMessage.innerText = "Computer's turn...";
            executeComputerTurnWhenUnpaused(1500);
        } else {
            playerTurn();
        }
    }

    function executeComputerTurnWhenUnpaused(delay) {
        setTimeout(() => {
            if (isPaused) {
                executeComputerTurnWhenUnpaused(500); // Check again if still paused
                return;
            }
            computerTurn();
        }, delay);
    }

    // --- Collapses and AI ---
    function checkForCollapse(gridArray, gridDOM, isPlayer) {
        const lines = [[0,1,2], [3,4,5], [6,7,8], [0,3,6], [1,4,7], [2,5,8]];
        let collapseOccurred = false;

        lines.forEach(line => {
            const [a, b, c] = line;
            if(gridArray[a] && gridArray[b] && gridArray[c]) {
                const isFaceUpA = gridArray[a].element.classList.contains('is-flipped');
                const isFaceUpB = gridArray[b].element.classList.contains('is-flipped');
                const isFaceUpC = gridArray[c].element.classList.contains('is-flipped');

                if(isFaceUpA && isFaceUpB && isFaceUpC) {
                    let vals = [gridArray[a].value, gridArray[b].value, gridArray[c].value];
                    let jokersCount = vals.filter(v => v === 'Joker').length;
                    let nonJokers = vals.filter(v => v !== 'Joker');
                    let shouldCollapse = false;

                    if (jokersCount >= 2) {
                        shouldCollapse = true;
                    } else if (jokersCount === 1) {
                        if (nonJokers[0] === nonJokers[1]) shouldCollapse = true;
                    } else {
                        if (vals[0] === vals[1] && vals[1] === vals[2]) shouldCollapse = true;
                    }

                    if (shouldCollapse) {
                        [a, b, c].forEach(index => {
                            gridArray[index].element.classList.remove('is-flipped');
                            gridArray[index].element.classList.add('collapsed');
                            gridArray[index] = null; 
                        });
                        collapseOccurred = true;
                    }
                }
            }
        });

        if (collapseOccurred) {
            uiMessage.innerText = "Row collapsed!";
            updateRunningScores();
        }
    }

    function computerTurn() {
        let faceDownIndices = [];
        let highFaceUpIndices = [];
        gameState.computerGrid.forEach((c, index) => {
            if (c) {
                if (!c.element.classList.contains('is-flipped')) faceDownIndices.push(index);
                else if (getCardPointValue(c.value) > 5) highFaceUpIndices.push(index);
            }
        });

        let topDiscard = gameState.discardPile.length > 0 ? gameState.discardPile[gameState.discardPile.length - 1] : null;
        
        if (topDiscard && getCardPointValue(topDiscard.value) <= 2) {
            let target = highFaceUpIndices.length > 0 ? highFaceUpIndices[0] : (faceDownIndices.length > 0 ? faceDownIndices[0] : null);
            if (target !== null) {
                let discarded = gameState.computerGrid[target];
                gameState.computerGrid[target] = gameState.discardPile.pop();
                discarded.element.classList.add('is-flipped');
                gameState.discardPile.push(discarded);
                endComputerTurn();
                return;
            }
        }

        if (gameState.drawPile.length > 0) {
            let drawn = gameState.drawPile.pop();
            drawn.element.classList.add('is-flipped');

            if (getCardPointValue(drawn.value) <= 5) { 
                let target = highFaceUpIndices.length > 0 ? highFaceUpIndices[0] : (faceDownIndices.length > 0 ? faceDownIndices[0] : null);
                if (target !== null) {
                    let discarded = gameState.computerGrid[target];
                    gameState.computerGrid[target] = drawn;
                    discarded.element.classList.add('is-flipped');
                    gameState.discardPile.push(discarded);
                    endComputerTurn();
                    return;
                }
            }

            gameState.discardPile.push(drawn);
            if (faceDownIndices.length > 0) {
                let flipTarget = faceDownIndices[Math.floor(Math.random() * faceDownIndices.length)];
                gameState.computerGrid[flipTarget].element.classList.add('is-flipped');
            }
            
            endComputerTurn();
        }
    }

    // --- Scoring Logic ---
    function getCardPointValue(val) {
        if (val === 'K') return 0;
        if (val === 'A') return 1;
        if (val === 'J' || val === 'Q') return 10;
        if (val === 'Joker') return -2;
        return parseInt(val);
    }

    function calculateFinalScores() {
        gameState.playerGrid.forEach(c => { if(c) c.element.classList.add('is-flipped'); });
        gameState.computerGrid.forEach(c => { if(c) c.element.classList.add('is-flipped'); });
        
        renderGrid(gameState.playerGrid, playerGridDOM, true);
        renderGrid(gameState.computerGrid, computerGridDOM, false);
        updateRunningScores();

        let pScore = parseInt(document.getElementById('player-running-score').innerText);
        let cScore = parseInt(document.getElementById('computer-running-score').innerText);

        document.getElementById('player-score-text').innerText = pScore;
        document.getElementById('computer-score-text').innerText = cScore;
        
        const winnerText = document.getElementById('winner-text');
        if (pScore < cScore) {
            winnerText.innerText = "You Win!";
            winnerText.style.color = "#4CAF50";
        } else if (cScore < pScore) {
            winnerText.innerText = "Computer Wins!";
            winnerText.style.color = "#F44336";
        } else {
            winnerText.innerText = "It's a Tie!";
            winnerText.style.color = "#d4af37";
        }

        document.getElementById('score-modal').classList.remove('hidden');
    }

    runIntroSequence();
});
