// --- Global Variables ---
let scene, camera, renderer, world, physicsMaterial;
let boardParts = [];
let playerBall;
let collectible;
let enemyBlocks = [];

// Game State
let gameState = 'start'; 
let currentRound = 0; 
const roundSettings = [
    { target: 2, time: 15, enemies: 0 },   // Tut
    { target: 5, time: 20, enemies: 0 },   // R1
    { target: 7, time: 20, enemies: 0 },   // R2
    { target: 10, time: 25, enemies: 1.5 },// R3 (Enemies spawn every 1.5s)
    { target: 12, time: 25, enemies: 1.2 },// R4
    { target: 15, time: 30, enemies: 1.0 },// R5
    { target: 18, time: 30, enemies: 0.9 },// R6
    { target: 20, time: 35, enemies: 0.8 },// R7
    { target: 22, time: 35, enemies: 0.7 },// R8
    { target: 25, time: 40, enemies: 0.6 },// R9
    { target: 30, time: 40, enemies: 0.5 } // R10
];

let timeRemaining = 0;
let score = 0;
let lastTimeUpdate = 0;
let gameTime = 0;
let lastEnemySpawnTime = 0;

// Inputs 
let targetTiltX = 0, targetTiltZ = 0;
let currentTiltX = 0, currentTiltZ = 0;
const maxTilt = 0.25; // Slightly less tilt so marble doesn't fly off instantly

// DOM Elements
const scoreEl = document.getElementById('score');
const targetEl = document.getElementById('target-score');
const timeEl = document.getElementById('time-display');
const roundEl = document.getElementById('round-display');
const uiEl = document.getElementById('ui');
const statusScreen = document.getElementById('status-screen');
const statusTitle = document.getElementById('status-title');
const statusDesc = document.getElementById('status-desc');
const tutorialText = document.getElementById('tutorial-text');
const tutMsg = document.getElementById('tut-msg');

const startBtn = document.getElementById('start-btn');
const resumeBtn = document.getElementById('resume-btn');
const pauseBtn = document.getElementById('pause-btn');
const nextRoundBtn = document.getElementById('next-round-btn');
const restartBtn = document.getElementById('restart-btn');

// --- Initialization ---
function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0c10);
    scene.fog = new THREE.Fog(0x0b0c10, 20, 60);

    const width = window.innerWidth;
    const height = window.innerHeight;
    camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 25, 30);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(10, 20, 10);
    dirLight.castShadow = true;
    scene.add(dirLight);

    initPhysics();
    setupInputs();
}

function initPhysics() {
    if (world) return;
    world = new CANNON.World();
    world.gravity.set(0, -15, 0); // Slightly heavier gravity for snappy rolling
    world.broadphase = new CANNON.NaiveBroadphase();
    world.solver.iterations = 10;

    physicsMaterial = new CANNON.Material("standard");
    const contactMaterial = new CANNON.ContactMaterial(
        physicsMaterial, physicsMaterial, { friction: 0.1, restitution: 0.5 }
    );
    world.addContactMaterial(contactMaterial);
}

function createBoardPart(w, h, d, x, y, z, isWall) {
    const geo = new THREE.BoxGeometry(w, h, d);
    // Dark grey body, glowing cyan walls
    const color = isWall ? 0x00ffff : 0x1f2833;
    const emissive = isWall ? 0x00ffff : 0x000000;
    const mat = new THREE.MeshStandardMaterial({ 
        color: color, emissive: emissive, emissiveIntensity: isWall ? 0.3 : 0, roughness: 0.7 
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true; mesh.receiveShadow = true;
    scene.add(mesh);

    const shape = new CANNON.Box(new CANNON.Vec3(w / 2, h / 2, d / 2));
    const body = new CANNON.Body({ mass: 0, material: physicsMaterial, type: CANNON.Body.KINEMATIC });
    body.addShape(shape);
    body.position.set(x, y, z);
    world.addBody(body);

    const part = { mesh, body, basePos: new THREE.Vector3(x, y, z) };
    boardParts.push(part);
}

function spawnCollectible() {
    if (collectible) {
        scene.remove(collectible.mesh);
    }
    
    // Glowing Yellow Cube
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffff00, emissive: 0xffff00, emissiveIntensity: 0.8 });
    const mesh = new THREE.Mesh(geo, mat);
    
    // Random position within the board walls (-6 to 6 roughly)
    const rx = (Math.random() - 0.5) * 12;
    const rz = (Math.random() - 0.5) * 12;
    mesh.position.set(rx, 1, rz);
    
    scene.add(mesh);
    collectible = { mesh, basePos: new THREE.Vector3(rx, 1, rz) };
}

function spawnEnemy() {
    // Red glowing falling blocks
    const size = 1.2;
    const geo = new THREE.BoxGeometry(size, size, size);
    const mat = new THREE.MeshStandardMaterial({ color: 0xff3366, emissive: 0xff3366, emissiveIntensity: 0.5 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    scene.add(mesh);

    const shape = new CANNON.Box(new CANNON.Vec3(size/2, size/2, size/2));
    const body = new CANNON.Body({ mass: 5, material: physicsMaterial });
    body.addShape(shape);
    
    body.position.set((Math.random() - 0.5) * 12, 15, (Math.random() - 0.5) * 12);
    world.addBody(body);
    
    enemyBlocks.push({ mesh, body });
}

function buildLevel() {
    // Cleanup old items
    boardParts.forEach(p => { scene.remove(p.mesh); world.removeBody(p.body); });
    boardParts = [];
    enemyBlocks.forEach(e => { scene.remove(e.mesh); world.removeBody(e.body); });
    enemyBlocks = [];
    if (playerBall) { scene.remove(playerBall.mesh); world.removeBody(playerBall.body); }

    currentTiltX = 0; currentTiltZ = 0; targetTiltX = 0; targetTiltZ = 0;

    // Floor
    createBoardPart(16, 0.5, 16, 0, -0.25, 0, false);
    // Neon Bumpers (Walls)
    createBoardPart(16, 1, 0.5, 0, 0.5, -7.75, true); 
    createBoardPart(16, 1, 0.5, 0, 0.5, 7.75, true);  
    createBoardPart(0.5, 1, 15, -7.75, 0.5, 0, true); 
    createBoardPart(0.5, 1, 15, 7.75, 0.5, 0, true);  

    // Player Ball (Glowing Pink)
    const ballGeo = new THREE.SphereGeometry(0.6, 32, 32);
    const ballMat = new THREE.MeshStandardMaterial({ color: 0xff33ff, emissive: 0xaa00aa, metalness: 0.3, roughness: 0.2 });
    const mesh = new THREE.Mesh(ballGeo, ballMat);
    mesh.castShadow = true; scene.add(mesh);

    const shape = new CANNON.Sphere(0.6);
    const body = new CANNON.Body({ mass: 1, material: physicsMaterial });
    body.addShape(shape);
    body.position.set(0, 3, 0); // Drop in center
    world.addBody(body);
    
    playerBall = { mesh, body };

    spawnCollectible();
}

// --- Inputs ---
function setupInputs() {
    window.addEventListener('keydown', (e) => {
        if (e.key.toLowerCase() === 'p') togglePause();
        if (gameState !== 'playing' && gameState !== 'tutorial') return;
        if (e.key === 'ArrowUp') targetTiltX = -maxTilt;
        if (e.key === 'ArrowDown') targetTiltX = maxTilt;
        if (e.key === 'ArrowLeft') targetTiltZ = -maxTilt;
        if (e.key === 'ArrowRight') targetTiltZ = maxTilt;
    });

    window.addEventListener('keyup', (e) => {
        if (gameState !== 'playing' && gameState !== 'tutorial') return;
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') targetTiltX = 0;
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') targetTiltZ = 0;
    });

    const addTouch = (id, tiltX, tiltZ) => {
        const btn = document.getElementById(id);
        btn.addEventListener('touchstart', (e) => { e.preventDefault(); if(gameState==='playing' || gameState==='tutorial'){ if(tiltX!==null) targetTiltX=tiltX; if(tiltZ!==null) targetTiltZ=tiltZ;} });
        btn.addEventListener('touchend', (e) => { e.preventDefault(); if(gameState==='playing' || gameState==='tutorial'){ if(tiltX!==null) targetTiltX=0; if(tiltZ!==null) targetTiltZ=0;} });
        btn.addEventListener('mousedown', () => { if(gameState==='playing' || gameState==='tutorial'){ if(tiltX!==null) targetTiltX=tiltX; if(tiltZ!==null) targetTiltZ=tiltZ;} });
        btn.addEventListener('mouseup', () => { if(gameState==='playing' || gameState==='tutorial'){ if(tiltX!==null) targetTiltX=0; if(tiltZ!==null) targetTiltZ=0;} });
    };

    addTouch('btn-up', -maxTilt, null);
    addTouch('btn-down', maxTilt, null);
    addTouch('btn-left', null, -maxTilt);
    addTouch('btn-right', null, maxTilt);

    window.addEventListener('resize', () => {
        const width = window.innerWidth;
        const height = window.innerHeight;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
    });
}

// --- Game Flow Control ---
function startRound(roundNum) {
    currentRound = roundNum;
    const settings = roundSettings[roundNum];
    
    timeRemaining = settings.time;
    score = 0;
    gameTime = 0; 
    lastEnemySpawnTime = 0;
    
    roundEl.innerText = roundNum === 0 ? "Tut" : roundNum;
    targetEl.innerText = settings.target;
    scoreEl.innerText = score;
    timeEl.innerText = timeRemaining;
    
    buildLevel();

    if (roundNum === 0) {
        gameState = 'tutorial';
        tutorialText.style.display = 'block';
        document.getElementById('on-screen-controls').style.display = 'flex';
    } else {
        gameState = 'playing';
        tutorialText.style.display = 'none';
    }
}

function processTutorial() {
    if (timeRemaining > 10) {
        tutMsg.innerText = "Roll to the Yellow Cube!";
        targetTiltX = maxTilt; targetTiltZ = maxTilt; // Auto roll
        document.getElementById('btn-down').classList.add('simulated-active');
        document.getElementById('btn-right').classList.add('simulated-active');
    } else if (timeRemaining > 5) {
        tutMsg.innerText = "Use arrows to balance!";
        targetTiltX = -maxTilt; targetTiltZ = -maxTilt;
        document.getElementById('btn-down').classList.remove('simulated-active');
        document.getElementById('btn-right').classList.remove('simulated-active');
        document.getElementById('btn-up').classList.add('simulated-active');
        document.getElementById('btn-left').classList.add('simulated-active');
    } else {
        tutMsg.innerText = "Get Ready!";
        targetTiltX = 0; targetTiltZ = 0;
        document.getElementById('btn-up').classList.remove('simulated-active');
        document.getElementById('btn-left').classList.remove('simulated-active');
    }
}

function triggerWinLoss(reason) {
    gameState = 'transition';
    const isWin = reason === 'win';
    
    if (!isWin) {
        gameState = 'gameover';
        statusTitle.innerText = "GAME OVER";
        statusTitle.style.color = "#ff3366"; // Red/Pink
        statusDesc.innerText = reason === 'time' ? "Time ran out!" : "You hit a toxic red block!";
        resumeBtn.style.display = "none"; nextRoundBtn.style.display = "none";
        restartBtn.style.display = "inline-block";
    } else {
        if (currentRound === 10) {
            statusTitle.innerText = "YOU WIN!";
            statusTitle.style.color = "#ffff00";
            statusDesc.innerText = "You survived all 10 levels. Incredible job!";
            resumeBtn.style.display = "none"; nextRoundBtn.style.display = "none";
            restartBtn.style.display = "inline-block";
        } else {
            statusTitle.innerText = currentRound === 0 ? "Tutorial Complete" : `Round ${currentRound} Passed!`;
            statusTitle.style.color = "#00ffff"; // Cyan
            statusDesc.innerText = `${score} targets reached. Ready for the next round?`;
            resumeBtn.style.display = "none"; restartBtn.style.display = "none";
            nextRoundBtn.style.display = "inline-block";
        }
    }
    statusScreen.style.display = 'flex';
}

function togglePause() {
    if (gameState === 'playing') {
        gameState = 'paused';
        statusTitle.innerText = "PAUSED";
        statusTitle.style.color = "#fff";
        statusDesc.innerText = "Press 'P' or click Resume to continue.";
        resumeBtn.style.display = "inline-block"; nextRoundBtn.style.display = "none";
        restartBtn.style.display = "none"; statusScreen.style.display = 'flex';
        pauseBtn.innerText = 'Resume (P)';
    } else if (gameState === 'paused') {
        gameState = 'playing';
        statusScreen.style.display = 'none';
        pauseBtn.innerText = 'Pause (P)';
        lastTimeUpdate = performance.now(); 
    }
}

// --- Animation Loop ---
function animate(time) {
    requestAnimationFrame(animate);

    if (gameState === 'playing' || gameState === 'tutorial') {
        if (lastTimeUpdate === 0) lastTimeUpdate = time;
        const dt = (time - lastTimeUpdate) / 1000;
        lastTimeUpdate = time;

        timeRemaining -= dt;
        if (timeRemaining < 0) timeRemaining = 0;
        timeEl.innerText = Math.ceil(timeRemaining);

        world.step(1 / 60);
        gameTime += 1 / 60;

        if (gameState === 'tutorial') {
            processTutorial();
            if (timeRemaining <= 0) triggerWinLoss('win');
        } else {
            // Check Time out
            if (timeRemaining <= 0) triggerWinLoss('time');

            // Enemy Spawning
            const spawnRate = roundSettings[currentRound].enemies;
            if (spawnRate > 0 && gameTime - lastEnemySpawnTime >= spawnRate) {
                spawnEnemy();
                lastEnemySpawnTime = gameTime;
            }
        }

        // Apply Tilts smoothly
        currentTiltX += (targetTiltX - currentTiltX) * 0.15;
        currentTiltZ += (targetTiltZ - currentTiltZ) * 0.15;
        const euler = new THREE.Euler(currentTiltX, 0, currentTiltZ);
        const quat = new THREE.Quaternion().setFromEuler(euler);

        // Update Board
        boardParts.forEach(part => {
            const pos = part.basePos.clone();
            pos.applyQuaternion(quat);
            part.body.position.copy(pos);
            part.body.quaternion.copy(quat);
            part.mesh.position.copy(part.body.position);
            part.mesh.quaternion.copy(part.body.quaternion);
        });

        // Update Collectible visually attaching to board
        if (collectible) {
            const cpos = collectible.basePos.clone();
            cpos.applyQuaternion(quat);
            collectible.mesh.position.copy(cpos);
            collectible.mesh.quaternion.copy(quat);

            // Spin it for visual effect
            collectible.mesh.rotation.y += 0.05;
            collectible.mesh.rotation.x += 0.02;

            // Check Collision with player ball
            const dist = playerBall.mesh.position.distanceTo(collectible.mesh.position);
            if (dist < 1.5) {
                score++;
                scoreEl.innerText = score;
                if (score >= roundSettings[currentRound].target) {
                    triggerWinLoss('win');
                } else {
                    spawnCollectible();
                }
            }
        }

        // Sync Player Ball visually and check bounds
        if (playerBall) {
            playerBall.mesh.position.copy(playerBall.body.position);
            playerBall.mesh.quaternion.copy(playerBall.body.quaternion);
            if (playerBall.body.position.y < -15) {
                triggerWinLoss('fell'); // Just in case it glitches out of the arena
            }
        }

        // Sync Enemies visually and check deadly collision
        for (let i = enemyBlocks.length - 1; i >= 0; i--) {
            const enemy = enemyBlocks[i];
            enemy.mesh.position.copy(enemy.body.position);
            enemy.mesh.quaternion.copy(enemy.body.quaternion);
            
            if (playerBall && enemy.body.position.y > -5) {
                const dist = playerBall.mesh.position.distanceTo(enemy.mesh.position);
                if (dist < 1.4) {
                    triggerWinLoss('enemy');
                }
            }

            // Cleanup fallen enemies
            if (enemy.body.position.y < -30) {
                world.removeBody(enemy.body); 
                scene.remove(enemy.mesh); 
                enemyBlocks.splice(i, 1);
            }
        }

    } else {
        lastTimeUpdate = time; 
    }

    renderer.render(scene, camera);
}

// --- Event Listeners ---
startBtn.addEventListener('click', () => {
    document.getElementById('start-screen').style.display = 'none';
    uiEl.style.display = 'flex';
    startRound(0); 
});

resumeBtn.addEventListener('click', togglePause);
pauseBtn.addEventListener('click', togglePause);
nextRoundBtn.addEventListener('click', () => { statusScreen.style.display = 'none'; startRound(currentRound + 1); });
restartBtn.addEventListener('click', () => { statusScreen.style.display = 'none'; startRound(1); });

init();
requestAnimationFrame(animate);
