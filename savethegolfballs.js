// --- Global Variables ---
let scene, camera, renderer, world, physicsMaterial;
let balls = [], walls = [], fallenWalls = [];
let floorPart;
let exclamationTexture; // Reusable warning sprite texture

// Game State
let gameState = 'start'; // start, tutorial, playing, paused, transition, gameover
let currentRound = 0; // 0 = Tutorial
const roundTimes = [12, 10, 12, 14, 16, 18, 20, 22, 24, 26, 30]; // Index 0 is tutorial
let timeRemaining = 0;
let lastTimeUpdate = 0;

let gameTime = 0;
let lastQueueTime = 0;

// Inputs & Tilt
let targetTiltX = 0, targetTiltZ = 0;
let currentTiltX = 0, currentTiltZ = 0;
const maxTilt = 0.3;

// DOM
const scoreEl = document.getElementById('score');
const timeEl = document.getElementById('time-display');
const roundEl = document.getElementById('round-display');
const uiEl = document.getElementById('ui');
const statusScreen = document.getElementById('status-screen');
const statusTitle = document.getElementById('status-title');
const statusDesc = document.getElementById('status-desc');
const tutorialText = document.getElementById('tutorial-text');
const tutMsg = document.getElementById('tut-msg');

// Buttons
const startBtn = document.getElementById('start-btn');
const resumeBtn = document.getElementById('resume-btn');
const pauseBtn = document.getElementById('pause-btn');
const nextRoundBtn = document.getElementById('next-round-btn');
const restartBtn = document.getElementById('restart-btn');

// --- Initialization ---
function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xd3d3d3);
    scene.fog = new THREE.Fog(0xd3d3d3, 20, 60);

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 20, 24);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(10, 20, 10);
    dirLight.castShadow = true;
    scene.add(dirLight);

    createWarningTexture();
    initPhysics();
    setupInputs();
}

function initPhysics() {
    if (world) return;
    world = new CANNON.World();
    world.gravity.set(0, -9.82, 0);
    world.broadphase = new CANNON.NaiveBroadphase();
    world.solver.iterations = 10;

    physicsMaterial = new CANNON.Material("standard");
    const contactMaterial = new CANNON.ContactMaterial(
        physicsMaterial, physicsMaterial, { friction: 0.4, restitution: 0.3 }
    );
    world.addContactMaterial(contactMaterial);
}

// Generate the "!" Texture once
function createWarningTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.font = 'bold 200px Arial';
    ctx.fillStyle = '#ffff00'; // Yellow
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 15;
    ctx.strokeStyle = '#000000'; // Black outline
    ctx.strokeText('!', 128, 128);
    ctx.fillText('!', 128, 128);
    exclamationTexture = new THREE.CanvasTexture(canvas);
}

function createBoxPart(w, h, d, x, y, z, isWall) {
    const geo = new THREE.BoxGeometry(w, h, d);
    // MUST clone material so we can blink walls independently. Bright Red color.
    const mat = new THREE.MeshStandardMaterial({ color: 0xff0000, roughness: 0.8 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true; mesh.receiveShadow = true;
    scene.add(mesh);

    const shape = new CANNON.Box(new CANNON.Vec3(w / 2, h / 2, d / 2));
    const body = new CANNON.Body({ mass: 0, material: physicsMaterial });
    body.addShape(shape);
    body.position.set(x, y, z);
    body.type = CANNON.Body.KINEMATIC;
    world.addBody(body);

    let sprite = null;
    if (isWall) {
        const spriteMat = new THREE.SpriteMaterial({ map: exclamationTexture, depthTest: false });
        sprite = new THREE.Sprite(spriteMat);
        sprite.scale.set(4, 4, 1);
        sprite.position.set(0, 1.5, 0); // Hover above the wall
        sprite.visible = false;
        sprite.renderOrder = 999;
        mesh.add(sprite); // Attach sprite to the mesh so it moves/tilts with it
    }

    const part = { 
        mesh, body, sprite, 
        basePos: new THREE.Vector3(x, y, z), 
        dims: {w, h, d},
        warningQueued: false,
        warningStartTime: 0
    };
    if (isWall) walls.push(part);
    return part;
}

function buildLevel() {
    if (floorPart) { scene.remove(floorPart.mesh); world.removeBody(floorPart.body); }
    [...walls, ...fallenWalls].forEach(w => { scene.remove(w.mesh); world.removeBody(w.body); });
    balls.forEach(b => { scene.remove(b.mesh); world.removeBody(b.body); });
    
    walls = []; fallenWalls = []; balls = [];
    currentTiltX = 0; currentTiltZ = 0; targetTiltX = 0; targetTiltZ = 0;

    floorPart = createBoxPart(12, 0.5, 12, 0, -0.25, 0, false);
    createBoxPart(12, 2, 0.5, 0, 1, -5.75, true); // North
    createBoxPart(12, 2, 0.5, 0, 1, 5.75, true);  // South
    createBoxPart(0.5, 2, 11, -5.75, 1, 0, true); // West
    createBoxPart(0.5, 2, 11, 5.75, 1, 0, true);  // East

    const ballGeo = new THREE.SphereGeometry(0.4, 32, 32);
    const ballMat = new THREE.MeshStandardMaterial({ color: 0xccff00, roughness: 0.7 });

    for (let i = 0; i < 30; i++) {
        const mesh = new THREE.Mesh(ballGeo, ballMat);
        mesh.castShadow = true; scene.add(mesh);
        const shape = new CANNON.Sphere(0.4);
        const body = new CANNON.Body({ mass: 1, material: physicsMaterial });
        body.addShape(shape);
        body.position.set((Math.random()-0.5)*4, 3 + i*0.8, (Math.random()-0.5)*4);
        world.addBody(body);
        balls.push({ mesh, body });
    }
}

// --- Inputs & Device Tilt ---
function setupInputs() {
    window.addEventListener('keydown', (e) => {
        if (e.key.toLowerCase() === 'p') togglePause();
        if (gameState !== 'playing') return;

        if (e.key === 'ArrowUp') targetTiltX = -maxTilt;
        if (e.key === 'ArrowDown') targetTiltX = maxTilt;
        if (e.key === 'ArrowLeft') targetTiltZ = -maxTilt;
        if (e.key === 'ArrowRight') targetTiltZ = maxTilt;
    });

    window.addEventListener('keyup', (e) => {
        if (gameState !== 'playing') return;
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') targetTiltX = 0;
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') targetTiltZ = 0;
    });

    const addTouch = (id, tiltX, tiltZ) => {
        const btn = document.getElementById(id);
        btn.addEventListener('touchstart', (e) => { e.preventDefault(); if(gameState==='playing'){ if(tiltX!==null) targetTiltX=tiltX; if(tiltZ!==null) targetTiltZ=tiltZ;} });
        btn.addEventListener('touchend', (e) => { e.preventDefault(); if(gameState==='playing'){ if(tiltX!==null) targetTiltX=0; if(tiltZ!==null) targetTiltZ=0;} });
        btn.addEventListener('mousedown', () => { if(gameState==='playing'){ if(tiltX!==null) targetTiltX=tiltX; if(tiltZ!==null) targetTiltZ=tiltZ;} });
        btn.addEventListener('mouseup', () => { if(gameState==='playing'){ if(tiltX!==null) targetTiltX=0; if(tiltZ!==null) targetTiltZ=0;} });
    };

    addTouch('btn-up', -maxTilt, null);
    addTouch('btn-down', maxTilt, null);
    addTouch('btn-left', null, -maxTilt);
    addTouch('btn-right', null, maxTilt);

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}

function handleOrientation(event) {
    if (gameState !== 'playing') return;
    let x = event.beta;  let y = event.gamma; 
    if (x > 30) x = 30; if (x < -30) x = -30;
    if (y > 30) y = 30; if (y < -30) y = -30;
    targetTiltX = (x / 30) * maxTilt;
    targetTiltZ = (y / 30) * maxTilt;
}

function requestDeviceOrientation() {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission().then(state => {
            if (state === 'granted') window.addEventListener('deviceorientation', handleOrientation);
        }).catch(console.error);
    } else {
        window.addEventListener('deviceorientation', handleOrientation);
    }
}

// --- Game Flow Control ---
function startRound(roundNum) {
    currentRound = roundNum;
    timeRemaining = roundTimes[roundNum];
    gameTime = 0; lastQueueTime = 0;
    
    roundEl.innerText = roundNum === 0 ? "Tut" : roundNum;
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

function queueWallDrop() {
    const availableWalls = walls.filter(w => !w.warningQueued);
    if (availableWalls.length === 0 || gameState !== 'playing') return;
    if (currentRound === 1) return; // No drops round 1
    
    const wall = availableWalls[Math.floor(Math.random() * availableWalls.length)];
    wall.warningQueued = true;
    wall.warningStartTime = gameTime;
    wall.sprite.visible = true; // Show exclamation mark
}

function executePhysicalDrop(wall) {
    walls.splice(walls.indexOf(wall), 1);
    
    const pos = wall.body.position.clone();
    const quat = wall.body.quaternion.clone();

    world.removeBody(wall.body);
    const { w, h, d } = wall.dims;
    const newBody = new CANNON.Body({ mass: 5, material: physicsMaterial });
    newBody.addShape(new CANNON.Box(new CANNON.Vec3(w / 2, h / 2, d / 2)));
    newBody.position.copy(pos);
    newBody.quaternion.copy(quat);

    // Calculate outward direction locally based on where wall was originally spawned
    let localOutward = new CANNON.Vec3(0,0,0);
    if (w > d) { // North or South wall
        localOutward.set(0, 0, wall.basePos.z > 0 ? 1 : -1);
    } else { // East or West wall
        localOutward.set(wall.basePos.x > 0 ? 1 : -1, 0, 0);
    }

    // Apply an impulse at the top edge of the wall to tip it outwards like a door
    const forceMagn = 20;
    const localForce = localOutward.scale(forceMagn);
    const topCenterLocal = new CANNON.Vec3(0, h/2, 0); 
    
    world.addBody(newBody);
    newBody.applyLocalImpulse(localForce, topCenterLocal);

    wall.body = newBody;
    wall.sprite.visible = false;
    wall.mesh.material.color.setHex(0xff0000); // Ensure it resets to solid red
    fallenWalls.push(wall);
}

function processTutorial() {
    if (timeRemaining > 8) {
        tutMsg.innerText = "Keep balls inside the box!";
        targetTiltX = maxTilt; targetTiltZ = 0;
        document.getElementById('btn-down').classList.add('simulated-active');
    } else if (timeRemaining > 4) {
        tutMsg.innerText = "Tilt device or use arrows!";
        targetTiltX = 0; targetTiltZ = -maxTilt;
        document.getElementById('btn-down').classList.remove('simulated-active');
        document.getElementById('btn-left').classList.add('simulated-active');
    } else {
        tutMsg.innerText = "Get Ready!";
        targetTiltX = 0; targetTiltZ = 0;
        document.getElementById('btn-left').classList.remove('simulated-active');
    }
}

function checkWinLoss(activeBalls) {
    if (activeBalls === 0) {
        gameState = 'gameover';
        statusTitle.innerText = "GAME OVER";
        statusTitle.style.color = "red";
        statusDesc.innerText = `You lost all balls on Round ${currentRound}.`;
        resumeBtn.style.display = "none"; nextRoundBtn.style.display = "none";
        restartBtn.style.display = "inline-block";
        statusScreen.style.display = 'flex';
    } else if (timeRemaining <= 0) {
        gameState = 'transition';
        if (currentRound === 10) {
            statusTitle.innerText = "YOU WIN!";
            statusTitle.style.color = "#a4cc00";
            statusDesc.innerText = "You survived all 10 rounds. Incredible job!";
            resumeBtn.style.display = "none"; nextRoundBtn.style.display = "none";
            restartBtn.style.display = "inline-block";
        } else {
            statusTitle.innerText = currentRound === 0 ? "Tutorial Complete" : `Round ${currentRound} Passed!`;
            statusTitle.style.color = "white";
            statusDesc.innerText = `${activeBalls} balls saved. Ready for the next round?`;
            resumeBtn.style.display = "none"; restartBtn.style.display = "none";
            nextRoundBtn.style.display = "inline-block";
        }
        statusScreen.style.display = 'flex';
    }
}

function togglePause() {
    if (gameState === 'playing') {
        gameState = 'paused';
        statusTitle.innerText = "PAUSED";
        statusTitle.style.color = "white";
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
        } else {
            // Queue walls dropping
            let dropInterval = Math.max(7 - (currentRound * 0.5), 2.5); 
            if (currentRound === 2) dropInterval = 9; // Late drop
            
            if (currentRound > 1 && gameTime - lastQueueTime >= dropInterval) {
                queueWallDrop();
                lastQueueTime = gameTime;
            }

            // Process Queued Warning Walls
            for (let i = walls.length - 1; i >= 0; i--) {
                const w = walls[i];
                if (w.warningQueued) {
                    const elapsed = gameTime - w.warningStartTime;
                    if (elapsed >= 2.0) {
                        executePhysicalDrop(w);
                    } else {
                        // Blink logic: 3 full blinks in 2 seconds (6 phases)
                        const phase = Math.floor(elapsed / (2.0 / 6));
                        if (phase % 2 === 0) {
                            w.mesh.material.color.setHex(0xffffff); // White
                        } else {
                            w.mesh.material.color.setHex(0xff0000); // Red
                        }
                    }
                }
            }
        }

        currentTiltX += (targetTiltX - currentTiltX) * 0.1;
        currentTiltZ += (targetTiltZ - currentTiltZ) * 0.1;
        const swayX = Math.sin(gameTime * 0.8) * 0.05;
        const swayZ = Math.cos(gameTime * 1.2) * 0.05;
        const euler = new THREE.Euler(currentTiltX + swayX, 0, currentTiltZ + swayZ);
        const quat = new THREE.Quaternion().setFromEuler(euler);

        // Update Geometries
        [floorPart, ...walls].forEach(part => {
            if (!part) return;
            const pos = part.basePos.clone();
            pos.applyQuaternion(quat);
            part.body.position.copy(pos);
            part.body.quaternion.copy(quat);
            part.mesh.position.copy(part.body.position);
            part.mesh.quaternion.copy(part.body.quaternion);
        });

        for (let i = fallenWalls.length - 1; i >= 0; i--) {
            const fw = fallenWalls[i];
            fw.mesh.position.copy(fw.body.position);
            fw.mesh.quaternion.copy(fw.body.quaternion);
            if (fw.body.position.y < -30) {
                world.removeBody(fw.body); scene.remove(fw.mesh); fallenWalls.splice(i, 1);
            }
        }

        let activeBalls = 0;
        for (let i = balls.length - 1; i >= 0; i--) {
            const ball = balls[i];
            ball.mesh.position.copy(ball.body.position);
            ball.mesh.quaternion.copy(ball.body.quaternion);
            if (ball.body.position.y > -5) {
                activeBalls++;
            } else if (ball.body.position.y < -30) {
                world.removeBody(ball.body); scene.remove(ball.mesh); balls.splice(i, 1);
            }
        }
        scoreEl.innerText = activeBalls;
        checkWinLoss(activeBalls);
    } else {
        lastTimeUpdate = time; 
    }

    renderer.render(scene, camera);
}

// --- Event Listeners ---
startBtn.addEventListener('click', () => {
    document.getElementById('start-screen').style.display = 'none';
    uiEl.style.display = 'flex';
    requestDeviceOrientation(); 
    startRound(0); 
});

resumeBtn.addEventListener('click', togglePause);
pauseBtn.addEventListener('click', togglePause);
nextRoundBtn.addEventListener('click', () => { statusScreen.style.display = 'none'; startRound(currentRound + 1); });
restartBtn.addEventListener('click', () => { statusScreen.style.display = 'none'; startRound(1); });

init();
requestAnimationFrame(animate);
