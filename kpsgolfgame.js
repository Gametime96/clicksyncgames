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
        turn: 'player', // 'player' or 'computer'
        phase: 'intro', // intro, setup, playing
        flipsRemaining: 2,
        endTriggeredBy: null // Tracks who finished first for the final round logic
    };

    const uiMessage = document.getElementById("message-board");
    const presentationArea = document.getElementById("presentation-area");
    const playArea = document.getElementById("play-area");
    const playerGridDOM = document.getElementById("player-grid");
    const computerGridDOM = document.getElementById("computer-grid");
    const drawPileDOM = document.getElementById("draw-pile");
    const discardPileDOM = document.getElementById("discard-pile");

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

    // --- Drag and Drop Logic ---
    function makeDraggable(cardObj, sourceId) {
        if (!cardObj || !cardObj.element) return;
        cardObj.element.draggable = true;
        cardObj.element.classList.add('draggable');
        
        cardObj.element.ondragstart = (e) => {
            if (gameState.turn !== 'player' || gameState.phase !== 'playing') {
                e.preventDefault();
                return;
            }
            e.dataTransfer.setData('text/plain', sourceId);
            e.dataTransfer.effectAllowed = 'move';
        };
    }

    function setupDropZone(element, onDropCallback) {
        element.ondragover = (e) => {
            e.preventDefault(); 
            if (gameState.turn === 'player') element.classList.add('drag-over');
        };
        element.ondragleave = () => { element.classList.remove('drag-over'); };
        element.ondrop = (e) => {
            e.preventDefault();
            element.classList.remove('drag-over');
            if (gameState.turn !== 'player') return;
            const sourceId = e.dataTransfer.getData('text/plain');
            onDropCallback(sourceId);
        };
    }

    // --- UI Rendering ---
    function updatePileUI() {
        drawPileDOM.innerHTML = '';
        if (gameState.drawPile.length > 0) {
            const topCard = gameState.drawPile[gameState.drawPile.length - 1];
            topCard.element.classList.remove('is-flipped'); 
            makeDraggable(topCard, 'draw');
            drawPileDOM.appendChild(topCard.element);
        }

        discardPileDOM.innerHTML = '';
        if (gameState.discardPile.length > 0) {
            const topCard = gameState.discardPile[gameState.discardPile.length - 1];
            topCard.element.classList.add('is-flipped'); 
            makeDraggable(topCard, 'discard');
            discardPileDOM.appendChild(topCard.element);
        }
    }

    function renderGrid(gridArray, gridDOM, isPlayer) {
        gridDOM.innerHTML = '';
        for(let i = 0; i < 9; i++) {
            let cell = document.createElement('div');
            cell.className = 'grid-cell';
            
            if (isPlayer) {
                cell.classList.add('drop-zone');
                setupDropZone(cell, (sourceId) => handleGridDrop(sourceId, i));
            }

            const card = gridArray[i];
            if (card) {
                // Completely strip old event listeners and classes to prevent the "stuck" bug
                card.element.onclick = null; 
                card.element.classList.remove('clickable-card', 'selectable');

                // If it is the player's turn and the card is face down, make it clickable to flip
                if (isPlayer && gameState.phase === 'playing' && gameState.turn === 'player' && !card.element.classList.contains('is-flipped')) {
                    card.element.classList.add('clickable-card');
                    card.element.onclick = () => {
                        if (gameState.turn === 'player') {
                            card.element.classList.remove('clickable-card');
                            card.element.classList.add('is-flipped');
                            endPlayerTurn();
                        }
                    };
                }

                // If it is face up and it's the player's turn, allow dragging it to discard
                if (isPlayer && gameState.phase === 'playing' && gameState.turn === 'player' && card.element.classList.contains('is-flipped')) {
                    makeDraggable(card, `grid-${i}`);
                } else {
                    card.element.draggable = false;
                    card.element.classList.remove('draggable');
                }
                
                cell.appendChild(card.element);
            } else {
                const emptySlot = document.createElement("div");
                emptySlot.className = "card collapsed";
                cell.appendChild(emptySlot);
            }
            gridDOM.appendChild(cell);
        }
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
                    if(gameState.phase === 'setup' && !card.element.classList.contains('is-flipped')) {
                        card.element.classList.add('is-flipped');
                        card.element.classList.remove('selectable');
                        gameState.flipsRemaining--;
                        
                        if(gameState.flipsRemaining === 0) {
                            // Strip selectable class fully before starting game
                            gameState.playerGrid.forEach(c => {
                                if(c) { 
                                    c.element.classList.remove('selectable'); 
                                    c.element.onclick = null; 
                                }
                            });
                            
                            // Computer randomly flips 2 distinct cards
                            let cIndices = [0,1,2,3,4,5,6,7,8];
                            let c1 = cIndices.splice(Math.floor(Math.random() * cIndices.length), 1)[0];
                            let c2 = cIndices.splice(Math.floor(Math.random() * cIndices.length), 1)[0];
                            gameState.computerGrid[c1].element.classList.add('is-flipped');
                            gameState.computerGrid[c2].element.classList.add('is-flipped');
                            
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
        setupDropZone(discardPileDOM, handleDiscardDrop);
        playerTurn();
    }

    function playerTurn() {
        gameState.turn = 'player';
        uiMessage.innerText = "Your Turn: Click a card to flip, or swap with Draw/Discard.";
        updatePileUI();
        renderGrid(gameState.playerGrid, playerGridDOM, true);
    }

    // Drop from draw/discard onto any of your 9 grid slots
    function handleGridDrop(sourceId, targetGridIndex) {
        if (!sourceId || sourceId.startsWith('grid-')) return; 
        const oldGridCard = gameState.playerGrid[targetGridIndex];
        if (!oldGridCard) return; 

        let newCard;
        if (sourceId === 'draw') newCard = gameState.drawPile.pop();
        else if (sourceId === 'discard') newCard = gameState.discardPile.pop();

        newCard.element.classList.add('is-flipped'); 
        gameState.playerGrid[targetGridIndex] = newCard;
        
        // Replaced card goes to discard face up
        oldGridCard.element.classList.add('is-flipped'); 
        gameState.discardPile.push(oldGridCard);

        endPlayerTurn();
    }

    // Drop onto the discard pile
    function handleDiscardDrop(sourceId) {
        if (!sourceId) return;

        // Player drags draw to discard (draw & burn)
        if (sourceId === 'draw') {
            const drawnCard = gameState.drawPile.pop();
            drawnCard.element.classList.add('is-flipped');
            gameState.discardPile.push(drawnCard);
            endPlayerTurn();
        } 
        // Player drags a face-up grid card to discard (must draw a replacement)
        else if (sourceId.startsWith('grid-')) {
            const gridIndex = parseInt(sourceId.split('-')[1]);
            const gridCard = gameState.playerGrid[gridIndex];
            
            gameState.discardPile.pop(); // Remove old discard
            gameState.discardPile.push(gridCard); 
            
            const newDrawnCard = gameState.drawPile.pop();
            newDrawnCard.element.classList.remove('is-flipped'); // Replaced card stays face down
            gameState.playerGrid[gridIndex] = newDrawnCard;
            
            endPlayerTurn();
        }
    }

    // --- Turn Transitions & Endgame Logic ---
    function isGridFullyFlipped(grid) {
        return grid.every(card => card === null || card.element.classList.contains('is-flipped'));
    }

    function endPlayerTurn() {
        renderGrid(gameState.playerGrid, playerGridDOM, true);
        checkForCollapse(gameState.playerGrid, playerGridDOM, true);
        updatePileUI();
        checkTurnProgression('player');
    }

    function endComputerTurn() {
        renderGrid(gameState.computerGrid, computerGridDOM, false);
        checkForCollapse(gameState.computerGrid, computerGridDOM, false);
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
            setTimeout(computerTurn, 2000);
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
            setTimeout(computerTurn, 1500);
        } else {
            playerTurn();
        }
    }

    // --- Collapses and AI ---
    function checkForCollapse(gridArray, gridDOM, isPlayer) {
        const lines = [[0,1,2], [3,4,5], [6,7,8], [0,3,6], [1,4,7], [2,5,8]];
        let collapseOccurred = false;

        lines.forEach(line => {
            const [a, b, c] = line;
            if(gridArray[a] && gridArray[b] && gridArray[c]) {
                const valA = gridArray[a].value;
                const isFaceUpA = gridArray[a].element.classList.contains('is-flipped');
                const isFaceUpB = gridArray[b].element.classList.contains('is-flipped');
                const isFaceUpC = gridArray[c].element.classList.contains('is-flipped');

                if(isFaceUpA && isFaceUpB && isFaceUpC && valA === gridArray[b].value && valA === gridArray[c].value) {
                    [a, b, c].forEach(index => {
                        gridArray[index].element.classList.remove('is-flipped');
                        gridArray[index].element.classList.add('collapsed');
                        gridArray[index] = null; 
                    });
                    collapseOccurred = true;
                }
            }
        });

        if (collapseOccurred) {
            uiMessage.innerText = "3-in-a-row collapsed!";
            renderGrid(gridArray, gridDOM, isPlayer); 
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
        
        // Strategy: Take discard if it's 2 or lower
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

            // Strategy: Keep draw if 5 or lower
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

            // Burn draw and flip a face-down card
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

        let pScore = 0;
        let cScore = 0;

        gameState.playerGrid.forEach(card => {
            if (card) pScore += getCardPointValue(card.value);
        });

        gameState.computerGrid.forEach(card => {
            if (card) cScore += getCardPointValue(card.value);
        });

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
