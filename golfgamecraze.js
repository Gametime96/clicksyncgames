// --- GAME ENGINE & STATE ---
let scene, camera, renderer;
let ball, hole, flag, aimingLine;
let courseGroup, wallGroup;
let isPaused = false;
let isGameStarted = false;
let isTransitioning = false;
let strokes = 0;
let currentLevel = 1;

// Ball Physics State
let ballVel = new THREE.Vector3(0, 0, 0);
let isMoving = false;
let isAiming = true;
let isPowering = false;
let cameraAngle = 0;
let power = 0;
let powerDir = 1;
let powerInterval = null;

// --- 12 PROGRESSIVE LEVEL DEFINITIONS ---
const LEVELS_DATA = [
    {
        level: 1,
        bounds: { xMin: -8, xMax: 8, zMin: -20, zMax: 20 },
        tee: { x: 0, z: 17 },
        hole: { x: 0, z: -16 },
        water: { x: 0, z: 1, radius: 3 },
        sand: [{ xMin: -6, xMax: -2, zMin: -9, zMax: -6 }]
    },
    {
        level: 2,
        bounds: { xMin: -9, xMax: 9, zMin: -25, zMax: 25 },
        tee: { x: 0, z: 22 },
        hole: { x: 2, z: -21 },
        water: { x: 0, z: 2.5, radius: 4 },
        sand: [{ xMin: 2, xMax: 7, zMin: -12, zMax: -7 }]
    },
    {
        level: 3,
        bounds: { xMin: -10, xMax: 10, zMin: -30, zMax: 30 },
        tee: { x: -3, z: 26 },
        hole: { x: 4, z: -26 },
        water: { x: 0, z: 0, radius: 5 },
        sand: [{ xMin: -8, xMax: -3, zMin: 10, zMax: 15 }]
    },
    // Level 4+: Hole is centered on a small hill
    {
        level: 4,
        bounds: { xMin: -11, xMax: 11, zMin: -35, zMax: 35 },
        tee: { x: 0, z: 31 },
        hole: { x: -5, z: -30 },
        water: { x: -2, z: 3, radius: 4 },
        sand: [{ xMin: 1, xMax: 8, zMin: -18, zMax: -12 }]
    },
    {
        level: 5,
        bounds: { xMin: -12, xMax: 12, zMin: -40, zMax: 40 },
        tee: { x: 4, z: 35 },
        hole: { x: 0, z: -35 },
        water: { x: 0, z: 0, radius: 7 },
        sand: [{ xMin: -9, xMax: -2, zMin: 12, zMax: 20 }]
    },
    {
        level: 6,
        bounds: { xMin: -13, xMax: 13, zMin: -45, zMax: 45 },
        tee: { x: -5, z: 40 },
        hole: { x: 6, z: -40 },
        water: { x: 0, z: -3, radius: 8 },
        sand: [{ xMin: -5, xMax: 5, zMin: 15, zMax: 24 }]
    },
    // Level 7+: 2 Sand Areas & Circular Body of Water
    {
        level: 7,
        bounds: { xMin: -14, xMax: 14, zMin: -50, zMax: 50 },
        tee: { x: 0, z: 45 },
        hole: { x: -7, z: -45 },
        water: { x: 0, z: -4, radius: 8.5 },
        sand: [
            { xMin: -11, xMax: -3, zMin: -28, zMax: -18 },
            { xMin: 2, xMax: 10, zMin: 10, zMax: 22 }
        ]
    },
    {
        level: 8,
        bounds: { xMin: -15, xMax: 15, zMin: -58, zMax: 58 },
        tee: { x: 0, z: 52 },
        hole: { x: 0, z: -52 },
        water: { x: 0, z: -3, radius: 10 },
        sand: [
            { xMin: -12, xMax: -2, zMin: 18, zMax: 30 },
            { xMin: 3, xMax: 13, zMin: -32, zMax: -20 }
        ]
    },
    // Levels 9-12: Massive Length Courses
    {
        level: 9,
        bounds: { xMin: -16, xMax: 16, zMin: -110, zMax: 110 },
        tee: { x: 0, z: 100 },
        hole: { x: -5, z: -100 },
        water: { x: 0, z: 5, radius: 12 },
        sand: [
            { xMin: -10, xMax: -1, zMin: 35, zMax: 60 },
            { xMin: 2, xMax: 11, zMin: -65, zMax: -40 }
        ]
    },
    {
        level: 10,
        bounds: { xMin: -18, xMax: 18, zMin: -210, zMax: 210 },
        tee: { x: 5, z: 195 },
        hole: { x: -8, z: -195 },
        water: { x: 0, z: 0, radius: 14 },
        sand: [
            { xMin: -12, xMax: -1, zMin: 70, zMax: 110 },
            { xMin: 2, xMax: 13, zMin: -130, zMax: -80 }
        ]
    },
    {
        level: 11,
        bounds: { xMin: -20, xMax: 20, zMin: -400, zMax: 400 },
        tee: { x: -6, z: 380 },
        hole: { x: 10, z: -380 },
        water: { x: 0, z: 0, radius: 16 },
        sand: [
            { xMin: -15, xMax: -2, zMin: 120, zMax: 200 },
            { xMin: 2, xMax: 15, zMin: -250, zMax: -160 }
        ]
    },
    {
        level: 12, // Ultimate Challenge Course
        bounds: { xMin: -22, xMax: 22, zMin: -800, zMax: 800 },
        tee: { x: 0, z: 760 },
        hole: { x: 0, z: -760 },
        water: { x: 0, z: 0, radius: 18 },
        sand: [
            { xMin: -18, xMax: -2, zMin: 250, zMax: 450 },
            { xMin: 2, xMax: 18, zMin: -500, zMax: -280 }
        ]
    }
];

function getCurrentConfig() {
    return LEVELS_DATA[currentLevel - 1];
}

function init3D() {
    const container = document.getElementById('game-container');
    const canvas = document.getElementById('webgl-canvas');

    // 1. Scene & Camera Setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.FogExp2(0x87ceeb, 0.008);

    camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 2500);

    // 2. Renderer Setup
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = true;

    // 3. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 0.85);
    sunLight.position.set(25, 45, 25);
    sunLight.castShadow = true;
    scene.add(sunLight);

    // 4. Container Groups for Level Swapping
    courseGroup = new THREE.Group();
    wallGroup = new THREE.Group();
    scene.add(courseGroup);
    scene.add(wallGroup);

    // 5. Ball Mesh
    const ballGeo = new THREE.SphereGeometry(0.35, 32, 32);
    const ballMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });
    ball = new THREE.Mesh(ballGeo, ballMat);
    ball.castShadow = true;
    scene.add(ball);

    // 6. Aim Guide Line
    const lineMat = new THREE.LineDashedMaterial({
        color: 0xffff00,
        dashSize: 0.5,
        gapSize: 0.25,
        linewidth: 2
    });
    const lineGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, -8)
    ]);
    aimingLine = new THREE.Line(lineGeo, lineMat);
    aimingLine.computeLineDistances();
    scene.add(aimingLine);

    loadLevel(currentLevel);
    setupJoystick();

    // Event Listeners
    window.addEventListener('resize', onWindowResize);
    window.addEventListener('keydown', (e) => {
        if ((e.key === 'p' || e.key === 'P') && isGameStarted && !isTransitioning) togglePause();
    });
    
    document.getElementById('pause-btn').addEventListener('click', () => { if (isGameStarted && !isTransitioning) togglePause(); });
    document.getElementById('resume-btn').addEventListener('click', togglePause);
    document.getElementById('start-game-btn').addEventListener('click', startGame);
    canvas.addEventListener('click', handleCanvasClick);

    // Start Game Loop
    animate();
}

function startGame() {
    isGameStarted = true;
    document.getElementById('instruction-overlay').style.display = 'none';
}

function loadLevel(lvlNum) {
    currentLevel = lvlNum;
    document.getElementById('level-num').innerText = currentLevel;

    // Clear previous course geometries
    while (courseGroup.children.length > 0) courseGroup.remove(courseGroup.children[0]);
    while (wallGroup.children.length > 0) wallGroup.remove(wallGroup.children[0]);

    const cfg = getCurrentConfig();

    // Build Fairway Ground
    const fairwayWidth = cfg.bounds.xMax - cfg.bounds.xMin;
    const fairwayDepth = cfg.bounds.zMax - cfg.bounds.zMin;
    const fairwayGeo = new THREE.BoxGeometry(fairwayWidth, 1, fairwayDepth);
    const fairwayMat = new THREE.MeshStandardMaterial({ color: 0x2e7d32, roughness: 0.8 });
    const fairway = new THREE.Mesh(fairwayGeo, fairwayMat);
    fairway.position.set(0, -0.5, 0);
    fairway.receiveShadow = true;
    courseGroup.add(fairway);

    // Build Tee Marker
    const teeGeo = new THREE.CylinderGeometry(1.2, 1.2, 0.05, 32);
    const teeMat = new THREE.MeshStandardMaterial({ color: 0x81c784 });
    const teeMesh = new THREE.Mesh(teeGeo, teeMat);
    teeMesh.position.set(cfg.tee.x, 0.02, cfg.tee.z);
    courseGroup.add(teeMesh);

    // Build Circular Water Pit
    const rWater = cfg.water.radius;
    const waterGeo = new THREE.CylinderGeometry(rWater, rWater, 0.1, 48);
    const waterMat = new THREE.MeshStandardMaterial({ color: 0x0288d1, roughness: 0.1, transparent: true, opacity: 0.85 });
    const water = new THREE.Mesh(waterGeo, waterMat);
    water.position.set(cfg.water.x, 0.01, cfg.water.z);
    courseGroup.add(water);

    // Build Sand Traps (1 trap for Lvl 1-6; 2 traps for Lvl 7+)
    cfg.sand.forEach(s => {
        const sWidth = s.xMax - s.xMin;
        const sDepth = s.zMax - s.zMin;
        const sandGeo = new THREE.BoxGeometry(sWidth, 0.08, sDepth);
        const sandMat = new THREE.MeshStandardMaterial({ color: 0xd7ccc8, roughness: 1.0 });
        const sand = new THREE.Mesh(sandGeo, sandMat);
        sand.position.set((s.xMin + s.xMax) / 2, 0.02, (s.zMin + s.zMax) / 2);
        courseGroup.add(sand);
    });

    // Levels 4+: Build Small Hill with Hole Exactly in Center
    let holeYPosition = 0.02;
    if (currentLevel >= 4) {
        holeYPosition = 0.52; // Elevation top of mound
        const hillGeo = new THREE.CylinderGeometry(2.5, 5.0, 0.5, 32);
        const hillMat = new THREE.MeshStandardMaterial({ color: 0x388e3c, roughness: 0.75 });
        const hill = new THREE.Mesh(hillGeo, hillMat);
        hill.position.set(cfg.hole.x, 0.25, cfg.hole.z);
        hill.receiveShadow = true;
        courseGroup.add(hill);
    }

    // Build Hole Cup & Flag
    const holeGeo = new THREE.CylinderGeometry(0.7, 0.7, 0.2, 32);
    const holeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
    hole = new THREE.Mesh(holeGeo, holeMat);
    hole.position.set(cfg.hole.x, holeYPosition, cfg.hole.z);
    courseGroup.add(hole);

    const poleGeo = new THREE.CylinderGeometry(0.05, 0.05, 4, 16);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0xdddddd });
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.set(cfg.hole.x, holeYPosition + 2, cfg.hole.z);
    courseGroup.add(pole);

    const flagGeo = new THREE.BoxGeometry(1.2, 0.8, 0.05);
    const flagMat = new THREE.MeshStandardMaterial({ color: 0xd32f2f });
    flag = new THREE.Mesh(flagGeo, flagMat);
    flag.position.set(cfg.hole.x + 0.6, holeYPosition + 3.5, cfg.hole.z);
    courseGroup.add(flag);

    buildSemiTransparentWalls(cfg);
    resetBall();
}

function buildSemiTransparentWalls(cfg) {
    const wallMat = new THREE.MeshStandardMaterial({ 
        color: 0x1b5e20, 
        roughness: 0.9,
        transparent: true,
        opacity: 0.35,
        depthWrite: false
    });

    const wallHeight = 2.2;
    const wallThickness = 1.0;
    const width = cfg.bounds.xMax - cfg.bounds.xMin;
    const depth = cfg.bounds.zMax - cfg.bounds.zMin;

    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(wallThickness, wallHeight, depth), wallMat);
    leftWall.position.set(cfg.bounds.xMin - wallThickness / 2, wallHeight / 2, 0);
    wallGroup.add(leftWall);

    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(wallThickness, wallHeight, depth), wallMat);
    rightWall.position.set(cfg.bounds.xMax + wallThickness / 2, wallHeight / 2, 0);
    wallGroup.add(rightWall);

    const backWall = new THREE.Mesh(new THREE.BoxGeometry(width + 2, wallHeight, wallThickness), wallMat);
    backWall.position.set(0, wallHeight / 2, cfg.bounds.zMin - wallThickness / 2);
    wallGroup.add(backWall);

    const frontWall = new THREE.Mesh(new THREE.BoxGeometry(width + 2, wallHeight, wallThickness), wallMat);
    frontWall.position.set(0, wallHeight / 2, cfg.bounds.zMax + wallThickness / 2);
    wallGroup.add(frontWall);
}

function resetBall() {
    const cfg = getCurrentConfig();
    ball.position.set(cfg.tee.x, 0.35, cfg.tee.z);
    ballVel.set(0, 0, 0);
    isMoving = false;
    isAiming = true;
    cameraAngle = 0;
    aimingLine.visible = true;
    document.getElementById('power-bar-fill').style.width = '0%';
    updateCameraPosition();
}

function updateCameraPosition() {
    const distance = 9;
    const cameraHeight = 4.5;

    camera.position.x = ball.position.x + Math.sin(cameraAngle) * distance;
    camera.position.y = ball.position.y + cameraHeight;
    camera.position.z = ball.position.z + Math.cos(cameraAngle) * distance;

    camera.lookAt(ball.position);

    if (aimingLine) {
        aimingLine.position.copy(ball.position);
        aimingLine.rotation.y = cameraAngle;
    }
}

// --- DIRECTIONAL JOYSTICK TOGGLE ---
function setupJoystick() {
    const base = document.getElementById('joystick-base');
    const thumb = document.getElementById('joystick-thumb');
    let isDragging = false;
    let startX = 0;

    function handleStart(clientX) {
        isDragging = true;
        startX = clientX;
    }

    function handleMove(clientX) {
        if (!isDragging || isPaused || !isGameStarted || isTransitioning) return;
        const deltaX = clientX - startX;
        
        cameraAngle -= deltaX * 0.015;
        updateCameraPosition();

        const clampedX = Math.max(-25, Math.min(25, deltaX));
        thumb.style.transform = `translate(calc(-50% + ${clampedX}px), -50%)`;
        startX = clientX;
    }

    function handleEnd() {
        isDragging = false;
        thumb.style.transform = `translate(-50%, -50%)`;
    }

    base.addEventListener('touchstart', (e) => handleStart(e.touches[0].clientX));
    window.addEventListener('touchmove', (e) => { if (isDragging) handleMove(e.touches[0].clientX); });
    window.addEventListener('touchend', handleEnd);

    base.addEventListener('mousedown', (e) => handleStart(e.clientX));
    window.addEventListener('mousemove', (e) => { if (isDragging) handleMove(e.clientX); });
    window.addEventListener('mouseup', handleEnd);
}

// --- SHOOTING CONTROLS ---
function handleCanvasClick(e) {
    if (!isGameStarted || isMoving || isPaused || isTransitioning || e.target.closest('#joystick-container')) return;

    if (isAiming) {
        isAiming = false;
        isPowering = true;
        startPowerMeter();
    } else if (isPowering) {
        isPowering = false;
        stopPowerMeter();
        shootBall();
    }
}

function startPowerMeter() {
    power = 0;
    powerDir = 1;
    powerInterval = setInterval(() => {
        power += 2.5 * powerDir;
        if (power >= 100 || power <= 0) powerDir *= -1;
        document.getElementById('power-bar-fill').style.width = power + '%';
    }, 16);
}

function stopPowerMeter() {
    clearInterval(powerInterval);
}

function shootBall() {
    aimingLine.visible = false;
    const impulse = (power / 100) * 1.6;

    ballVel.x = -Math.sin(cameraAngle) * impulse;
    ballVel.z = -Math.cos(cameraAngle) * impulse;
    isMoving = true;

    strokes++;
    document.getElementById('stroke-num').innerText = strokes;
}

function togglePause() {
    isPaused = !isPaused;
    document.getElementById('pause-overlay').style.display = isPaused ? 'flex' : 'none';
}

// Modern Level Transition Sequence
function triggerModernLevelTransition(nextLvl) {
    isTransitioning = true;
    const overlay = document.getElementById('transition-overlay');
    const labelText = document.getElementById('next-level-text');
    const labelNum = document.getElementById('next-level-num');

    labelNum.innerText = nextLvl;
    labelText.style.opacity = '0';
    labelNum.style.opacity = '0';
    overlay.style.display = 'flex';

    // Step 1: Blackout screen for 0.5s, then show "Next Level"
    setTimeout(() => {
        labelText.style.opacity = '1';

        // Step 2: Show level number 0.5s later
        setTimeout(() => {
            labelNum.style.opacity = '1';

            // Step 3: Transition to next level after ~2s total
            setTimeout(() => {
                overlay.style.display = 'none';
                strokes = 0;
                document.getElementById('stroke-num').innerText = strokes;
                loadLevel(nextLvl);
                isTransitioning = false;
            }, 1000);
        }, 500);
    }, 500);
}

function triggerCompletionSequence() {
    isGameStarted = false;
    document.getElementById('completion-overlay').style.display = 'flex';
    launchCartoonFireworks(4000);
}

// 2D Cartoon Particle Fireworks Generator
function launchCartoonFireworks(duration) {
    const canvas = document.getElementById('fireworks-canvas');
    const ctx = canvas.getContext('2d');
    const container = document.getElementById('game-container');

    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;

    let particles = [];
    const colors = ['#ff5252', '#ff4081', '#e040fb', '#7c4dff', '#53d2dc', '#69f0ae', '#ffd740', '#ff6e40'];

    function createExplosion(x, y) {
        const count = 35;
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 / count) * i;
            const speed = Math.random() * 5 + 3;
            particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                radius: Math.random() * 6 + 4,
                color: colors[Math.floor(Math.random() * colors.length)],
                alpha: 1,
                decay: Math.random() * 0.02 + 0.015
            });
        }
    }

    let interval = setInterval(() => {
        const rx = Math.random() * (canvas.width * 0.8) + (canvas.width * 0.1);
        const ry = Math.random() * (canvas.height * 0.5) + (canvas.height * 0.1);
        createExplosion(rx, ry);
    }, 350);

    let animationFrame;
    function renderFireworks() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        for (let i = particles.length - 1; i >= 0; i--) {
            let p = particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.08;
            p.alpha -= p.decay;

            if (p.alpha <= 0) {
                particles.splice(i, 1);
                continue;
            }

            ctx.globalAlpha = p.alpha;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }

        animationFrame = requestAnimationFrame(renderFireworks);
    }

    renderFireworks();

    setTimeout(() => {
        clearInterval(interval);
        setTimeout(() => {
            cancelAnimationFrame(animationFrame);
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }, 1500);
    }, duration);
}

function onWindowResize() {
    const container = document.getElementById('game-container');
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
}

// --- PHYSICS ENGINE & ANIMATION LOOP ---
function animate() {
    requestAnimationFrame(animate);

    if (!isPaused && isGameStarted && !isTransitioning) {
        if (flag) flag.rotation.y = Math.sin(Date.now() * 0.003) * 0.2;

        if (isMoving) {
            const cfg = getCurrentConfig();
            ball.position.add(ballVel);
            let currentFriction = 0.985;

            // Sand Traps Collision
            cfg.sand.forEach(s => {
                if (ball.position.x >= s.xMin && ball.position.x <= s.xMax &&
                    ball.position.z >= s.zMin && ball.position.z <= s.zMax) {
                    currentFriction = 0.88;
                }
            });

            // Hill Elevation Slope Physics (Levels 4+)
            if (currentLevel >= 4) {
                const distToHillCenter = Math.hypot(ball.position.x - cfg.hole.x, ball.position.z - cfg.hole.z);
                if (distToHillCenter < 5.0) {
                    // Smooth mound height adjustment
                    const hillFactor = (1 - distToHillCenter / 5.0);
                    ball.position.y = 0.35 + (hillFactor * 0.5);

                    // Gravity push down hill if velocity is low
                    if (ballVel.length() < 0.25) {
                        const pushAngle = Math.atan2(ball.position.z - cfg.hole.z, ball.position.x - cfg.hole.x);
                        ballVel.x += Math.cos(pushAngle) * 0.015;
                        ballVel.z += Math.sin(pushAngle) * 0.015;
                    }
                } else {
                    ball.position.y = 0.35;
                }
            }

            // Circular Water Hazard Collision
            const distToWaterCenter = Math.hypot(ball.position.x - cfg.water.x, ball.position.z - cfg.water.z);
            if (distToWaterCenter < cfg.water.radius) {
                if (ballVel.length() < 0.45) {
                    alert("Water Hazard! Resetting ball...");
                    resetBall();
                    return;
                }
            }

            // Wall Collision Physics
            const r = 0.35;
            if (ball.position.x - r < cfg.bounds.xMin || ball.position.x + r > cfg.bounds.xMax) {
                ballVel.x *= -0.7;
                ball.position.x = Math.max(cfg.bounds.xMin + r, Math.min(cfg.bounds.xMax - r, ball.position.x));
            }
            if (ball.position.z - r < cfg.bounds.zMin || ball.position.z + r > cfg.bounds.zMax) {
                ballVel.z *= -0.7;
                ball.position.z = Math.max(cfg.bounds.zMin + r, Math.min(cfg.bounds.zMax - r, ball.position.z));
            }

            ballVel.multiplyScalar(currentFriction);

            // Ball Stopping Threshold
            if (ballVel.length() < 0.01) {
                ballVel.set(0, 0, 0);
                isMoving = false;
                isAiming = true;
                aimingLine.visible = true;
                document.getElementById('power-bar-fill').style.width = '0%';
            }

            // Hole Completion Detection
            const holeY = (currentLevel >= 4) ? 0.85 : 0.35;
            const holeVec = new THREE.Vector3(cfg.hole.x, holeY, cfg.hole.z);
            if (ball.position.distanceTo(holeVec) < 0.85 && ballVel.length() < 0.5) {
                ballVel.set(0, 0, 0);
                isMoving = false;

                if (currentLevel < LEVELS_DATA.length) {
                    triggerModernLevelTransition(currentLevel + 1);
                } else {
                    triggerCompletionSequence();
                }
                return;
            }

            updateCameraPosition();
        }
    }

    renderer.render(scene, camera);
}

window.addEventListener('DOMContentLoaded', init3D);
