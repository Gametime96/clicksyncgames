/* Speed Boat Strategy 2026 - Water Dynamics, Red Rainbow Arches & Islands */

document.addEventListener('DOMContentLoaded', () => {
    let scene, camera, renderer;
    let boatMesh, oceanMesh;
    let coins3D = [], redLoops3D = [], islands3D = [], currentPads3D = [];

    // Tutorial variables
    let tScene, tCam, tRenderer;

    const introScreen = document.getElementById('intro-screen');
    const instructionsScreen = document.getElementById('instructions-screen');
    const instructionsScreen2 = document.getElementById('instructions-screen-2');
    const selectScreen = document.getElementById('select-screen');
    const pauseScreen = document.getElementById('pause-screen');
    const gameOverScreen = document.getElementById('game-over-screen');
    const victoryScreen = document.getElementById('victory-screen');
    const levelIntroScreen = document.getElementById('level-intro-screen');
    const levelIntroText = document.getElementById('level-intro-text');
    const iceGaugeContainer = document.getElementById('ice-gauge-container');

    const hudTime = document.getElementById('hud-time');
    const hudCoins = document.getElementById('hud-coins');
    const bottomTimeBox = document.getElementById('bottom-time-box');
    const gaugeDial = document.getElementById('gauge-dial');
    const modalLivesCount = document.getElementById('modal-lives-count');
    const btnRestartLevel = document.getElementById('btn-restart-level');

    let currentLevel = 1;
    let lives = 3;
    let scoreCoins = 0;
    let requiredCoins = 2;
    let timeRemaining = 30;
    let vehicleColorHex = 0x111111;
    let timerInterval = null;
    let animFrameId = null;
    let isGameOver = false;
    let isPaused = false;
    let isTransitioning = false;

    let boostTimer = 0; // Current boost frames counter

    let lakeLength = 160; 
    const lakeWidth = 120;  
    const keys = { up: false, down: false, left: false, right: false };

    // Speedboat Physical State + Water Dynamics
    const boat = {
        x: 0,
        z: -lakeLength / 2 + 10,
        y: 0,
        vx: 0,
        vz: 0,
        angle: 0,
        lastX: 0,
        lastZ: 0
    };

    let cameraLookTarget = (typeof THREE !== 'undefined') ? new THREE.Vector3() : { x: 0, y: 1.2, z: 0 };

    function setGaugeVisible(visible) {
        if (!iceGaugeContainer) return;
        if (visible) iceGaugeContainer.classList.remove('hidden');
        else iceGaugeContainer.classList.add('hidden');
    }

    // --- 1. SAFE THREE.JS VIEWPORT INITIALIZATION ---
    function init3D() {
        const container = document.getElementById('webgl-container');
        if (!container || typeof THREE === 'undefined') return false;

        if (!scene) {
            scene = new THREE.Scene();
            scene.background = new THREE.Color(0x87ceeb); // Ocean sky
        }

        if (!camera) {
            camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 1000);
            camera.position.set(0, 7, -15);
        } else {
            camera.aspect = container.clientWidth / container.clientHeight;
            camera.updateProjectionMatrix();
        }

        if (!renderer) {
            renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
            renderer.setSize(container.clientWidth, container.clientHeight);
            renderer.shadowMap.enabled = true;
            container.appendChild(renderer.domElement);

            const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
            scene.add(ambientLight);

            const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
            dirLight.position.set(20, 40, 20);
            dirLight.castShadow = true;
            scene.add(dirLight);
        } else {
            renderer.setSize(container.clientWidth, container.clientHeight);
        }
        return true;
    }

    // --- 2. BUILD 3D SPEEDBOAT MESH ---
    function create3DSpeedboatMesh(colorHex) {
        if (typeof THREE === 'undefined') return null;
        const boatGroup = new THREE.Group();

        // Sleek V-Hull Body
        const hullGeo = new THREE.ConeGeometry(1.8, 5.2, 5);
        const hullMat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.2 });
        const hull = new THREE.Mesh(hullGeo, hullMat);
        hull.rotation.x = Math.PI / 2;
        hull.rotation.z = Math.PI;
        hull.scale.set(1, 1, 0.5);
        hull.position.y = 0.4;
        hull.castShadow = true;
        boatGroup.add(hull);

        // Deck Decking / Windshield
        const deckGeo = new THREE.BoxGeometry(1.6, 0.6, 2.2);
        const deckMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
        const deck = new THREE.Mesh(deckGeo, deckMat);
        deck.position.set(0, 0.6, -0.2);
        boatGroup.add(deck);

        const glassGeo = new THREE.BoxGeometry(1.4, 0.5, 0.8);
        const glassMat = new THREE.MeshStandardMaterial({ color: 0x00bfff, transparent: true, opacity: 0.7 });
        const glass = new THREE.Mesh(glassGeo, glassMat);
        glass.position.set(0, 0.95, 0.2);
        boatGroup.add(glass);

        // Outboard Motor
        const motorGeo = new THREE.BoxGeometry(0.8, 1.0, 0.8);
        const motorMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
        const motor = new THREE.Mesh(motorGeo, motorMat);
        motor.position.set(0, 0.6, -2.5);
        boatGroup.add(motor);

        return boatGroup;
    }

    // --- 3. BRIGHT RED RAINBOW HALF-LOOP ARCH MESH ---
    function createRedHalfLoopMesh(radius = 6) {
        if (typeof THREE === 'undefined') return null;
        const archGroup = new THREE.Group();

        // Semi-circle Torus Tube (Bright Red Rainbow Arch)
        const tubeGeo = new THREE.TorusGeometry(radius, 0.4, 16, 32, Math.PI);
        const tubeMat = new THREE.MeshStandardMaterial({ color: 0xFF0000, roughness: 0.2, metalness: 0.3 });
        const arch = new THREE.Mesh(tubeGeo, tubeMat);
        archGroup.add(arch);

        // Base Support Anchors in Water
        const anchorGeo = new THREE.CylinderGeometry(0.7, 0.7, 1.2, 16);
        const anchorMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
        const a1 = new THREE.Mesh(anchorGeo, anchorMat);
        a1.position.set(-radius, 0, 0);
        archGroup.add(a1);

        const a2 = new THREE.Mesh(anchorGeo, anchorMat);
        a2.position.set(radius, 0, 0);
        archGroup.add(a2);

        return archGroup;
    }

    // --- 4. ORANGE-GOLD SPINNING COIN MESH ---
    function create3DCoinMesh(radius = 1.5) {
        if (typeof THREE === 'undefined') return { group: null, spinnerUnit: null, auraMesh: null };

        const coinGroup = new THREE.Group();
        const spinnerUnit = new THREE.Group();

        const coinGeo = new THREE.CylinderGeometry(radius, radius, 0.3, 24);
        const coinMat = new THREE.MeshStandardMaterial({ color: 0xFF8C00, emissive: 0xFF5500, emissiveIntensity: 0.6 });
        const coinMesh = new THREE.Mesh(coinGeo, coinMat);
        coinMesh.rotation.x = Math.PI / 2;
        spinnerUnit.add(coinMesh);

        const rimGeo = new THREE.TorusGeometry(radius + 0.02, 0.06, 12, 32);
        const rimMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
        const rimMesh = new THREE.Mesh(rimGeo, rimMat);
        spinnerUnit.add(rimMesh);

        coinGroup.add(spinnerUnit);

        const auraGeo = new THREE.SphereGeometry(radius * 1.7, 24, 24);
        const auraMat = new THREE.MeshBasicMaterial({ color: 0xFF8C00, transparent: true, opacity: 0.3, wireframe: true });
        const auraMesh = new THREE.Mesh(auraGeo, auraMat);
        coinGroup.add(auraMesh);

        return { group: coinGroup, spinnerUnit: spinnerUnit, auraMesh: auraMesh };
    }

    // --- 5. PALM TREE ISLAND MESH ---
    function createPalmIslandMesh() {
        if (typeof THREE === 'undefined') return null;
        const group = new THREE.Group();

        // Sandy Island Base
        const islandGeo = new THREE.CylinderGeometry(4.5, 5.5, 0.8, 16);
        const islandMat = new THREE.MeshStandardMaterial({ color: 0xE6C280, roughness: 0.9 });
        const island = new THREE.Mesh(islandGeo, islandMat);
        island.position.y = 0.2;
        group.add(island);

        // Curved Palm Trunk
        const trunkGeo = new THREE.CylinderGeometry(0.3, 0.5, 5, 8);
        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8B5A2B });
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.set(0, 2.5, 0);
        trunk.rotation.z = -0.15;
        group.add(trunk);

        // Palm Fronds / Leaves
        const leafMat = new THREE.MeshStandardMaterial({ color: 0x2E8B57, side: THREE.DoubleSide });
        for (let i = 0; i < 5; i++) {
            const leafGeo = new THREE.PlaneGeometry(1.2, 3.5);
            const leaf = new THREE.Mesh(leafGeo, leafMat);
            leaf.position.set(0, 5, 0);
            leaf.rotation.y = (i * Math.PI * 2) / 5;
            leaf.rotation.x = Math.PI / 3;
            group.add(leaf);
        }

        return group;
    }

    // --- 6. DIRECTIONAL WATER CURRENT BOOST PAD ---
    function createWaterCurrentPadMesh(width = 6, depth = 12) {
        const group = new THREE.Group();
        const padGeo = new THREE.PlaneGeometry(width, depth);
        const padMat = new THREE.MeshBasicMaterial({ color: 0x00BFFF, side: THREE.DoubleSide, transparent: true, opacity: 0.7 });
        const padMesh = new THREE.Mesh(padGeo, padMat);
        padMesh.rotation.x = -Math.PI / 2;
        group.add(padMesh);

        // White Arrow Decal
        const arrowShape = new THREE.Shape();
        arrowShape.moveTo(0, 3);
        arrowShape.lineTo(-2, -1);
        arrowShape.lineTo(-0.8, -1);
        arrowShape.lineTo(-0.8, -3);
        arrowShape.lineTo(0.8, -3);
        arrowShape.lineTo(0.8, -1);
        arrowShape.lineTo(2, -1);
        arrowShape.closePath();

        const arrowGeo = new THREE.ShapeGeometry(arrowShape);
        const arrowMat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF, side: THREE.DoubleSide });
        const arrowMesh = new THREE.Mesh(arrowGeo, arrowMat);
        arrowMesh.rotation.x = -Math.PI / 2;
        arrowMesh.position.y = 0.02;
        group.add(arrowMesh);

        return group;
    }

    // --- 7. TUTORIAL LOOP WITH SPEEDBOAT & RED ARCH ---
    function init3DTutorial() {
        const container = document.getElementById('tutorial-3d-viewport');
        if (!container || container.children.length > 0 || typeof THREE === 'undefined') return;

        tScene = new THREE.Scene();
        tScene.background = new THREE.Color(0x87ceeb);

        tCam = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 100);
        tCam.position.set(0, 8, -14);

        tRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        tRenderer.setSize(container.clientWidth, container.clientHeight);
        container.appendChild(tRenderer.domElement);

        tScene.add(new THREE.AmbientLight(0xffffff, 0.9));
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(10, 20, 10);
        tScene.add(dirLight);

        const oceanGeo = new THREE.PlaneGeometry(100, 100);
        const oceanMat = new THREE.MeshStandardMaterial({ color: 0x006699, roughness: 0.1 });
        const ocean = new THREE.Mesh(oceanGeo, oceanMat);
        ocean.rotation.x = -Math.PI / 2;
        tScene.add(ocean);

        const redBoat = create3DSpeedboatMesh(0xD32F2F);
        if (redBoat) tScene.add(redBoat);

        const redArch = createRedHalfLoopMesh(5);
        if (redArch) {
            redArch.position.set(0, 0, 5);
            tScene.add(redArch);
        }

        const coin1 = create3DCoinMesh(1.2);
        if (coin1.group) {
            coin1.group.position.set(-8, 1.5, 20);
            tScene.add(coin1.group);
        }

        let startTime = Date.now();

        function animateTutorial() {
            const elapsed = ((Date.now() - startTime) % 6000) / 1000;

            if (coin1.spinnerUnit) coin1.spinnerUnit.rotation.z += 0.08;

            if (redBoat) {
                if (elapsed < 1.2) {
                    const progress = elapsed / 1.2;
                    redBoat.position.set(0, 0, -5 + progress * 10); // Pass under Red Arch
                    redBoat.rotation.y = 0;
                } else if (elapsed < 2.0) {
                    const turnProgress = (elapsed - 1.2) / 0.8;
                    redBoat.position.set(-turnProgress * 2.5, 0, 5 + turnProgress * 3.5);
                    redBoat.rotation.y = -turnProgress * 0.55; // Turn Left
                } else {
                    const driveProgress = (elapsed - 2.0) / 4.0;
                    redBoat.position.set(-2.5 - driveProgress * 5.5, 0, 8.5 + driveProgress * 11.5);
                    redBoat.rotation.y = -0.55;
                }

                tCam.position.x = redBoat.position.x;
                tCam.position.z = redBoat.position.z - 12;
                tCam.lookAt(redBoat.position.x, 1.2, redBoat.position.z + 4);
            }

            if (tRenderer && tScene && tCam) {
                tRenderer.render(tScene, tCam);
            }
            requestAnimationFrame(animateTutorial);
        }

        animateTutorial();
    }

    // --- 8. PREVIEW BOAT SELECTION ---
    function setup3DVehiclePreviews() {
        const cards = document.querySelectorAll('.car-card');
        cards.forEach(card => {
            const container = card.querySelector('.car-preview-box');
            if (!container || container.children.length > 0 || typeof THREE === 'undefined') return;

            const colorHex = parseInt(card.getAttribute('data-hex'), 16);

            const pScene = new THREE.Scene();
            const pCam = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100);
            pCam.position.set(4, 3, 5);
            pCam.lookAt(0, 0.8, 0);

            const pRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
            pRenderer.setSize(container.clientWidth, container.clientHeight);
            container.appendChild(pRenderer.domElement);

            pScene.add(new THREE.AmbientLight(0xffffff, 0.7));
            const pLight = new THREE.DirectionalLight(0xffffff, 1.2);
            pLight.position.set(5, 10, 5);
            pScene.add(pLight);

            const previewBoat = create3DSpeedboatMesh(colorHex);
            if (previewBoat) pScene.add(previewBoat);

            function animatePreview() {
                if (previewBoat) previewBoat.rotation.y += 0.015;
                pRenderer.render(pScene, pCam);
                requestAnimationFrame(animatePreview);
            }
            animatePreview();

            card.addEventListener('click', () => {
                if (isTransitioning) return;
                isTransitioning = true;

                vehicleColorHex = colorHex;

                cards.forEach(c => { if (c !== card) c.classList.add('fade-out'); });
                card.classList.add('selected-enlarge');

                setTimeout(() => {
                    selectScreen.classList.add('hidden');
                    init3D();

                    if (boatMesh && scene) scene.remove(boatMesh);
                    boatMesh = create3DSpeedboatMesh(vehicleColorHex);
                    if (boatMesh && scene) scene.add(boatMesh);

                    isTransitioning = false;
                    startLevelWithIntro(1);
                    if (!animFrameId) animFrameId = requestAnimationFrame(gameLoop);
                }, 1000);
            });
        });
    }

    // --- 9. INTRO TRANSITION ---
    function startIntro() {
        setGaugeVisible(false);
        setTimeout(() => {
            introScreen.classList.add('hidden');
            instructionsScreen.classList.remove('hidden');
            init3DTutorial();
            handleResize();
        }, 5000);
    }

    // --- 10. LEVEL INTRO RESET ---
    function startLevelWithIntro(levelNum) {
        currentLevel = levelNum;
        isTransitioning = true;
        isPaused = true;
        isGameOver = false;
        boostTimer = 0;

        setGaugeVisible(false);

        levelIntroText.textContent = `LEVEL ${currentLevel}`;
        levelIntroScreen.classList.remove('hidden');

        init3D();

        boat.x = 0;
        boat.z = -lakeLength / 2 + 10;
        boat.y = 0;
        boat.vx = 0;
        boat.vz = 0;
        boat.angle = 0; 

        if (boatMesh) {
            boatMesh.position.set(boat.x, 0, boat.z);
            boatMesh.rotation.y = 0;
        }

        if (camera) {
            camera.position.set(0, 7, boat.z - 12);
            if (cameraLookTarget.set) cameraLookTarget.set(0, 1.2, boat.z + 5);
            camera.lookAt(cameraLookTarget);
        }

        build3DLevel(currentLevel);

        setTimeout(() => {
            levelIntroScreen.classList.add('hidden');
            isTransitioning = false;
            isPaused = false;
            setGaugeVisible(true);
            timeRemaining = calculateLevelTime(currentLevel);
            updateHUD();
            startTimer();
            handleResize();
        }, 1800);
    }

    function calculateLevelTime(level) {
        if (level === 1) return 30;
        let baseTime = 30;
        for (let l = 2; l <= level; l++) baseTime *= 1.2;
        return Math.ceil(baseTime / 5) * 5;
    }

    function build3DLevel(level) {
        lakeLength = 160 + (level - 1) * 40;

        if (oceanMesh && scene) scene.remove(oceanMesh);

        if (typeof THREE !== 'undefined' && scene) {
            const oceanGeo = new THREE.PlaneGeometry(800, 800);
            const oceanMat = new THREE.MeshStandardMaterial({ color: 0x005f73, roughness: 0.1, metalness: 0.1 });
            oceanMesh = new THREE.Mesh(oceanGeo, oceanMat);
            oceanMesh.rotation.x = -Math.PI / 2;
            oceanMesh.position.y = 0;
            oceanMesh.receiveShadow = true;
            scene.add(oceanMesh);
        }

        coins3D.forEach(c => scene && scene.remove(c.group));
        coins3D = [];
        redLoops3D.forEach(rl => scene && scene.remove(rl.mesh));
        redLoops3D = [];
        islands3D.forEach(isl => scene && scene.remove(isl.mesh));
        islands3D = [];
        currentPads3D.forEach(cp => scene && scene.remove(cp.mesh));
        currentPads3D = [];

        requiredCoins = level * 2;
        scoreCoins = 0;

        // SPAWN BRIGHT RED HALF-LOOPS
        const loopCount = Math.min(3, 1 + Math.floor(level / 2));
        for (let l = 0; l < loopCount; l++) {
            const redLoopMesh = createRedHalfLoopMesh(6);
            const lX = (Math.random() - 0.5) * (lakeWidth - 30);
            const lZ = -lakeLength / 2 + 35 + l * 40;
            if (redLoopMesh) {
                redLoopMesh.position.set(lX, 0, lZ);
                if (scene) scene.add(redLoopMesh);
                redLoops3D.push({ mesh: redLoopMesh, x: lX, z: lZ, passed: false });
            }
        }

        // SPAWN PALM TREE ISLANDS (OBSTACLES)
        const islandCount = Math.min(5, level + 1);
        for (let isl = 0; isl < islandCount; isl++) {
            const islandMesh = createPalmIslandMesh();
            const iX = (Math.random() - 0.5) * (lakeWidth - 25);
            const iZ = -lakeLength / 2 + 30 + isl * 28;
            if (islandMesh) {
                islandMesh.position.set(iX, 0, iZ);
                if (scene) scene.add(islandMesh);
                islands3D.push({ mesh: islandMesh, x: iX, z: iZ, radius: 4.8 });
            }
        }

        // SPAWN WATER CURRENT BOOST PADS
        if (level >= 3) {
            for (let cp = 0; cp < 2; cp++) {
                const padMesh = createWaterCurrentPadMesh(6, 12);
                const pX = (Math.random() - 0.5) * (lakeWidth - 30);
                const pZ = -lakeLength / 2 + 45 + cp * 45;
                if (padMesh) {
                    padMesh.position.set(pX, 0.03, pZ);
                    if (scene) scene.add(padMesh);
                    currentPads3D.push({ mesh: padMesh, x: pX, z: pZ, width: 6, depth: 12, dirX: 0, dirZ: 1 });
                }
            }
        }

        // SPAWN ORANGE-GOLD COINS
        for (let i = 0; i < requiredCoins; i++) {
            const coinData = create3DCoinMesh(1.5);
            const xPos = (Math.random() - 0.5) * (lakeWidth - 30);
            const zPos = -lakeLength / 2 + 25 + (i * ((lakeLength - 40) / requiredCoins));

            if (coinData.group) {
                coinData.group.position.set(xPos, 1.8, zPos);
                if (scene) scene.add(coinData.group);
            }

            coins3D.push({ 
                group: coinData.group, 
                spinnerUnit: coinData.spinnerUnit, 
                auraMesh: coinData.auraMesh, 
                collected: false, 
                x: xPos, 
                y: 1.8, 
                z: zPos 
            });
        }
    }

    // --- 11. TIMERS & CONTROLS ---
    function startTimer() {
        clearInterval(timerInterval);
        timerInterval = setInterval(() => {
            if (isGameOver || isPaused) return;
            timeRemaining--;
            hudTime.textContent = timeRemaining;

            if (timeRemaining <= 10) bottomTimeBox.classList.add('urgent-warning');
            else bottomTimeBox.classList.remove('urgent-warning');

            if (timeRemaining <= 0) handleLifeLost();
        }, 1000);
    }

    function updateHUD() {
        hudTime.textContent = timeRemaining;
        hudCoins.textContent = `${scoreCoins}/${requiredCoins}`;

        const progressRatio = Math.max(0.05, 1 - (currentLevel - 1) * 0.1 - ((boat.z + lakeLength / 2) / lakeLength));
        gaugeDial.style.bottom = `${12 + progressRatio * 95}px`;
    }

    function togglePause() {
        if (isGameOver || isTransitioning) return;
        isPaused = !isPaused;
        if (isPaused) {
            pauseScreen.classList.remove('hidden');
            setGaugeVisible(false);
        } else {
            pauseScreen.classList.add('hidden');
            setGaugeVisible(true);
        }
    }

    function setupControls() {
        window.addEventListener('keydown', e => {
            if (e.key === 'p' || e.key === 'P') togglePause();
            if (isPaused) return;
            if (['ArrowUp', 'w', 'W'].includes(e.key)) keys.up = true;
            if (['ArrowDown', 's', 'S'].includes(e.key)) keys.down = true;
            if (['ArrowLeft', 'a', 'A'].includes(e.key)) keys.left = true;
            if (['ArrowRight', 'd', 'D'].includes(e.key)) keys.right = true;
        });

        window.addEventListener('keyup', e => {
            if (['ArrowUp', 'w', 'W'].includes(e.key)) keys.up = false;
            if (['ArrowDown', 's', 'S'].includes(e.key)) keys.down = false;
            if (['ArrowLeft', 'a', 'A'].includes(e.key)) keys.left = false;
            if (['ArrowRight', 'd', 'D'].includes(e.key)) keys.right = false;
        });

        const bindTouch = (id, keyName) => {
            const btn = document.getElementById(id);
            if (!btn) return;
            const start = (e) => { e.preventDefault(); if (!isPaused) keys[keyName] = true; btn.classList.add('active'); };
            const end = (e) => { e.preventDefault(); keys[keyName] = false; btn.classList.remove('active'); };
            btn.addEventListener('touchstart', start, {passive: false});
            btn.addEventListener('touchend', end, {passive: false});
            btn.addEventListener('mousedown', start);
            btn.addEventListener('mouseup', end);
            btn.addEventListener('mouseleave', end);
        };

        bindTouch('btn-up', 'up');
        bindTouch('btn-down', 'down');
        bindTouch('btn-left', 'left');
        bindTouch('btn-right', 'right');

        document.getElementById('btn-pause-hud').addEventListener('click', togglePause);
        document.getElementById('btn-resume').addEventListener('click', togglePause);

        document.querySelectorAll('.btn-return-csg').forEach(btn => {
            btn.addEventListener('click', () => { window.location.href = "https://clicksyncgames.com"; });
        });

        document.getElementById('btn-to-page-2').addEventListener('click', () => {
            instructionsScreen.classList.add('hidden');
            instructionsScreen2.classList.remove('hidden');
        });

        document.getElementById('btn-to-car-select').addEventListener('click', () => {
            instructionsScreen2.classList.add('hidden');
            selectScreen.classList.remove('hidden');
            setup3DVehiclePreviews();
        });

        btnRestartLevel.addEventListener('click', () => {
            gameOverScreen.classList.add('hidden');
            startLevelWithIntro(currentLevel);
        });

        document.getElementById('btn-play-again').addEventListener('click', () => {
            victoryScreen.classList.add('hidden');
            lives = 3;
            startLevelWithIntro(1);
        });
    }

    // --- 12. GAMEPLAY UPDATE LOOP ---
    function update() {
        if (isGameOver || isPaused) return;

        let currentMaxAccel = 0.0410;
        if (boostTimer > 0) {
            boostTimer--;
            currentMaxAccel *= 1.40; // 40% Speed Boost
        }

        if (keys.up) {
            boat.vx += Math.sin(boat.angle) * currentMaxAccel;
            boat.vz += Math.cos(boat.angle) * currentMaxAccel;
        }
        if (keys.down) {
            boat.vx -= Math.sin(boat.angle) * 0.0220;
            boat.vz -= Math.cos(boat.angle) * 0.0220;
        }
        if (keys.left) boat.angle += 0.045;
        if (keys.right) boat.angle -= 0.045;

        // Water Friction
        boat.vx *= 0.950;
        boat.vz *= 0.950;

        let nextX = boat.x + boat.vx;
        let nextZ = boat.z + boat.vz;

        // PALM ISLAND SOLID COLLISION
        for (let isl of islands3D) {
            if (Math.hypot(nextX - isl.x, nextZ - isl.z) < isl.radius) {
                handleLifeLost();
                return;
            }
        }

        boat.x = nextX;
        boat.z = nextZ;

        // DIRECTIONAL CURRENT BOOST PAD CHECK
        const boatDirX = Math.sin(boat.angle);
        const boatDirZ = Math.cos(boat.angle);

        currentPads3D.forEach(cp => {
            if (Math.abs(boat.x - cp.x) < cp.width / 2 && Math.abs(boat.z - cp.z) < cp.depth / 2) {
                const dotProduct = (boatDirX * cp.dirX) + (boatDirZ * cp.dirZ);
                if (dotProduct > 0.45) {
                    boostTimer = 120; // 2s Boost
                }
            }
        });

        if (boatMesh) {
            boatMesh.position.set(boat.x, 0, boat.z);
            boatMesh.rotation.y = boat.angle;
        }

        if (camera) {
            const distanceBehind = 12;
            const cameraHeight = 6;
            const idealX = boat.x - Math.sin(boat.angle) * distanceBehind;
            const idealZ = boat.z - Math.cos(boat.angle) * distanceBehind;
            const idealY = boat.y + cameraHeight;

            camera.position.x += (idealX - camera.position.x) * 0.08;
            camera.position.y += (idealY - camera.position.y) * 0.08;
            camera.position.z += (idealZ - camera.position.z) * 0.08;

            const targetLookX = boat.x + Math.sin(boat.angle) * 3;
            const targetLookZ = boat.z + Math.cos(boat.angle) * 3;
            if (cameraLookTarget.x !== undefined) {
                cameraLookTarget.x += (targetLookX - cameraLookTarget.x) * 0.08;
                cameraLookTarget.y = boat.y + 1.2;
                cameraLookTarget.z += (targetLookZ - cameraLookTarget.z) * 0.08;
                camera.lookAt(cameraLookTarget);
            }
        }

        // COIN COLLECTION
        coins3D.forEach(coin => {
            if (!coin.collected) {
                if (coin.spinnerUnit) coin.spinnerUnit.rotation.z += 0.07;
                if (coin.auraMesh) coin.auraMesh.rotation.y += 0.04;

                const dist = Math.hypot(boat.x - coin.x, boat.z - coin.z);
                if (dist < 3.2) {
                    coin.collected = true;
                    if (scene && coin.group) scene.remove(coin.group);
                    scoreCoins++;
                    updateHUD();

                    if (scoreCoins >= requiredCoins) {
                        if (currentLevel < 8) startLevelWithIntro(currentLevel + 1);
                        else triggerVictory();
                    }
                }
            }
        });
    }

    function gameLoop() {
        update();
        if (renderer && scene && camera) renderer.render(scene, camera);
        animFrameId = requestAnimationFrame(gameLoop);
    }

    function handleLifeLost() {
        isGameOver = true;
        clearInterval(timerInterval);
        lives--;
        setGaugeVisible(false);
        bottomTimeBox.classList.remove('urgent-warning');

        modalLivesCount.textContent = lives;
        if (lives > 0) {
            btnRestartLevel.textContent = `Restart Level ${currentLevel}`;
        } else {
            btnRestartLevel.textContent = "Restart Game";
            currentLevel = 1;
            lives = 3;
        }

        gameOverScreen.classList.remove('hidden');
    }

    function triggerVictory() {
        isGameOver = true;
        clearInterval(timerInterval);
        setGaugeVisible(false);
        victoryScreen.classList.remove('hidden');
    }

    // --- 13. DYNAMIC RESIZE HANDLER ---
    function handleResize() {
        const container = document.getElementById('webgl-container');
        if (renderer && camera && container && container.clientWidth > 0) {
            camera.aspect = container.clientWidth / container.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(container.clientWidth, container.clientHeight);
        }

        const tContainer = document.getElementById('tutorial-3d-viewport');
        if (tRenderer && tCam && tContainer && tContainer.clientWidth > 0) {
            tCam.aspect = tContainer.clientWidth / tContainer.clientHeight;
            tCam.updateProjectionMatrix();
            tRenderer.setSize(tContainer.clientWidth, tContainer.clientHeight);
        }
    }

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', () => {
        setTimeout(handleResize, 200);
    });

    setupControls();
    startIntro();
});
