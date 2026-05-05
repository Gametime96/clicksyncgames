// --- GAME STATE ---
let currentLevel = 1;
let timeRemaining = 60;
let phase = 'prep'; // 'prep', 'disaster', 'result'
let timerInterval = null;

let isTaskActive = false;
let currentTaskTime = 0;
let maxTaskTime = 0;
let taskInterval = null;

let selectedHouseIndex = null; // null means global (town) is selected

// Array of 5 houses. Floors: 0=Basement, 1=Ground, 2=Upstairs
let townState = {
    hasWall: false,
    houses: []
};

// --- LEVEL CONFIGURATIONS ---
const levels = [
    {
        id: 1,
        title: "Level 1",
        desc: "Survive the small tsunami!",
        disasterType: "tsunami",
        prepTime: 60
    },
    {
        id: 2,
        title: "Level 2",
        desc: "Survive the severe hail storm!",
        disasterType: "hail",
        prepTime: 60
    }
    // Add levels 3-20 here later (Twisters, Earthquakes, etc.)
];

// --- INITIALIZATION ---
function initTown() {
    townState.hasWall = false;
    townState.houses = [];
    for(let i=0; i<5; i++) {
        townState.houses.push({
            id: i,
            hasSandbags: false,
            hasRoof: false,
            floorsAlive: [true, true, true] // [Basement, Ground, Upstairs]
        });
    }
    renderTown();
}

function renderTown() {
    const townArea = document.getElementById('town-area');
    townArea.innerHTML = ''; // Clear existing

    townState.houses.forEach((house, index) => {
        const hDiv = document.createElement('div');
        hDiv.className = 'house';
        if (selectedHouseIndex === index) hDiv.classList.add('selected');
        
        // Click to select this house
        hDiv.onclick = () => selectHouse(index);

        // Visual Defenses
        const roofDef = document.createElement('div');
        roofDef.className = 'roof-defense';
        if (house.hasRoof) roofDef.style.display = 'block';

        const sandDef = document.createElement('div');
        sandDef.className = 'sandbag-defense';
        if (house.hasSandbags) sandDef.style.display = 'block';

        // Floors (Rendered top-down: Upstairs, Ground, Basement)
        const upstairs = document.createElement('div');
        upstairs.className = 'floor upstairs';
        upstairs.innerHTML = `<div class="person ${house.floorsAlive[2] ? '' : 'dead'}"></div>`;

        const ground = document.createElement('div');
        ground.className = 'floor ground';
        ground.innerHTML = `<div class="person ${house.floorsAlive[1] ? '' : 'dead'}"></div>`;

        const basement = document.createElement('div');
        basement.className = 'floor basement';
        basement.innerHTML = `<div class="person ${house.floorsAlive[0] ? '' : 'dead'}"></div>`;

        hDiv.appendChild(roofDef);
        hDiv.appendChild(upstairs);
        hDiv.appendChild(ground);
        hDiv.appendChild(basement);
        hDiv.appendChild(sandDef);

        townArea.appendChild(hDiv);
    });

    // Update Wall
    const wall = document.getElementById('defense-wall');
    wall.style.height = townState.hasWall ? '120%' : '0%';
}

function selectHouse(index) {
    if (phase !== 'prep' || isTaskActive) return;
    selectedHouseIndex = index;
    document.getElementById('selected-target-display').innerText = `House #${index + 1}`;
    renderTown();
    updateButtonStates();
}

// --- TIMER & PHASES ---
function loadLevel(levelNum) {
    let config = levels[levelNum - 1];
    document.getElementById('ui-level-title').innerText = config.title;
    document.getElementById('ui-level-desc').innerText = config.desc;
    
    timeRemaining = config.prepTime;
    phase = 'prep';
    selectedHouseIndex = null;
    document.getElementById('selected-target-display').innerText = "Town (Global)";
    
    document.getElementById('disaster-overlay').style.backgroundColor = "transparent";
    document.getElementById('post-level-panel').style.display = "none";
    
    initTown();
    updateButtonStates();
    updateTimerDisplay();

    timerInterval = setInterval(() => {
        timeRemaining--;
        updateTimerDisplay();
        if(timeRemaining <= 0) {
            clearInterval(timerInterval);
            triggerDisaster(config.disasterType);
        }
    }, 1000);
}

function updateTimerDisplay() {
    document.getElementById('time-text').innerText = timeRemaining;
}

// --- TASK SYSTEM ---
function updateButtonStates() {
    const btns = document.querySelectorAll('.action-btn');
    btns.forEach(btn => {
        if (phase !== 'prep' || isTaskActive) {
            btn.disabled = true;
            return;
        }
        
        // Context-aware enabling
        if (btn.classList.contains('local-btn')) {
            // Needs a house selected
            btn.disabled = (selectedHouseIndex === null);
        } else {
            // Global buttons always available if prep is active
            btn.disabled = false;
        }
    });
}

function startTask(taskName, durationInSeconds, targetType, effectCode) {
    if (isTaskActive || phase !== 'prep') return;
    if (targetType === 'local' && selectedHouseIndex === null) return;

    // Check if time remains
    if (timeRemaining < durationInSeconds) {
        alert("Not enough time left to build this!");
        return;
    }

    isTaskActive = true;
    maxTaskTime = durationInSeconds * 10; // *10 for smoother progress bar (100ms ticks)
    currentTaskTime = 0;
    
    document.getElementById('task-name').innerText = `Building ${taskName}...`;
    updateButtonStates();

    let savedTarget = selectedHouseIndex; // Cache target in case user clicks around

    taskInterval = setInterval(() => {
        currentTaskTime++;
        let pct = (currentTaskTime / maxTaskTime) * 100;
        document.getElementById('progress-bar-fill').style.width = pct + '%';

        if (currentTaskTime >= maxTaskTime) {
            clearInterval(taskInterval);
            finishTask(effectCode, savedTarget);
        }
    }, 100);
}

function finishTask(effectCode, targetIndex) {
    isTaskActive = false;
    document.getElementById('task-name').innerText = "Idle";
    document.getElementById('progress-bar-fill').style.width = '0%';

    // Apply Effects
    if (effectCode === 'wall') {
        townState.hasWall = true;
    } else if (effectCode === 'sandbags') {
        townState.houses[targetIndex].hasSandbags = true;
    } else if (effectCode === 'roof') {
        townState.houses[targetIndex].hasRoof = true;
    }

    renderTown();
    updateButtonStates();
}

// --- DISASTER LOGIC ---
function triggerDisaster(type) {
    phase = 'disaster';
    updateButtonStates();
    document.getElementById('task-name').innerText = "DISASTER STRIKING!";
    
    const overlay = document.getElementById('disaster-overlay');

    if (type === 'tsunami') {
        overlay.style.backgroundColor = "rgba(41, 128, 185, 0.6)"; // Blue wash
        
        setTimeout(() => {
            // Calculate Damage
            if (!townState.hasWall) {
                // Wave hits houses
                townState.houses.forEach(house => {
                    if (!house.hasSandbags) {
                        house.floorsAlive[0] = false; // Basement floods
                        house.floorsAlive[1] = false; // Ground floods
                    }
                });
            }
            resolveLevel();
        }, 2000);

    } else if (type === 'hail') {
        overlay.style.backgroundColor = "rgba(236, 240, 241, 0.6)"; // White/Ice wash
        
        setTimeout(() => {
            // Calculate Damage
            townState.houses.forEach(house => {
                if (!house.hasRoof) {
                    house.floorsAlive[2] = false; // Upstairs crushed by hail
                }
            });
            resolveLevel();
        }, 2000);
    }
}

function resolveLevel() {
    renderTown();
    
    // Count survivors
    let totalPeople = 15; // 5 houses * 3 people
    let survivors = 0;
    
    townState.houses.forEach(h => {
        if(h.floorsAlive[0]) survivors++;
        if(h.floorsAlive[1]) survivors++;
        if(h.floorsAlive[2]) survivors++;
    });

    phase = 'result';
    const panel = document.getElementById('post-level-panel');
    const desc = document.getElementById('result-desc');
    
    panel.style.display = "block";

    if (survivors > 0) {
        document.getElementById('result-title').innerText = "Town Survived!";
        desc.innerText = `${survivors} out of 15 people lived.`;
        document.getElementById('btn-next-level').innerText = "NEXT LEVEL";
        document.getElementById('btn-next-level').onclick = nextLevel;
    } else {
        document.getElementById('result-title').innerText = "Town Wiped Out!";
        desc.innerText = `Everyone perished. Game Over.`;
        document.getElementById('btn-next-level').innerText = "RESTART GAME";
        document.getElementById('btn-next-level').onclick = () => { currentLevel = 1; loadLevel(1); };
    }
}

function nextLevel() {
    currentLevel++;
    if (currentLevel > levels.length) {
        alert("You beat all available levels! You are a master of disasters!");
        currentLevel = 1;
    }
    loadLevel(currentLevel);
}

// Start Game
window.onload = () => {
    loadLevel(1);
};
