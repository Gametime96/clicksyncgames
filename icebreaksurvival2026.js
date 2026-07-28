/* Icebreak Survival 2026 - Cracking Physics, Jump Dynamics & Unified Spinning Coins */

document.addEventListener('DOMContentLoaded', () => {
    let scene, camera, renderer;
    let suvMesh, iceMesh, waterMesh, forestGroup;
    let coins3D = [], activeCracks = [], holes3D = [], ramps3D = [], speedPads3D = [];

    const introScreen = document.getElementById('intro-screen');
    const instructionsScreen = document.getElementById('instructions-screen');
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

    let lakeLength = 160; 
    const lakeWidth = 120;  
    const keys = { up: false, down: false, left: false, right: false };

    // SUV Physical State + Airborne Jump Dynamics
    const suv = {
        x: 0,
        z: -lakeLength / 2 + 10,
        y: 0,
        vy: 0,          // Vertical Jump Velocity
        gravity: -0.018,// Airborne Gravity Pull
        isAirborne: false,
        vx: 0,
        vz: 0,
        angle: 0,
        sinking: false,
        sinkScale: 1,
        dwellTimer: 0,   // Dwell tracking for cracks
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
            scene.background = new THREE.Color(0xb0e0e6);
        }

        if (!camera) {
            camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 1000);
            camera.position.set(0, 7, -15);
        }

        if (!renderer) {
            renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
            renderer.setSize(container.clientWidth, container.clientHeight);
            renderer.shadowMap.enabled = true;
            container.appendChild(renderer.domElement);

            const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
            scene.add(ambientLight);

            const dirLight = new THREE.DirectionalLight(0xffffff, 0.7);
            dirLight.position.set(20, 40, 20);
            dirLight.castShadow = true;
            scene.add(dirLight);

            forestGroup = new THREE.Group();
            scene.add(forestGroup);
        }
        return true;
    }

    // --- 2. BUILD 3D SUV MESH ---
    function create3DSUVMesh(colorHex) {
        if (typeof THREE === 'undefined') return null;
        const suvGroup = new THREE.Group();

        const bodyGeo = new THREE.BoxGeometry(2.4, 1.3, 4.4);
        const bodyMat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.3 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 0.8;
        body.castShadow = true;
        suvGroup.add(body);

        const cabinGeo = new THREE.BoxGeometry(2.0, 1.0, 2.4);
        const cabinMat = new THREE.MeshStandardMaterial({ color: 0x87CEEB, roughness: 0.1 });
        const cabin = new THREE.Mesh(cabinGeo, cabinMat);
        cabin.position.set(0, 1.85, -0.2);
        suvGroup.add(cabin);

        const wheelGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.45, 16);
        const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
        const wheelPositions = [
            [-1.2, 0.4, 1.4], [1.2, 0.4, 1.4],
            [-1.2, 0.4, -1.4], [1.2, 0.4, -1.4]
        ];

        wheelPositions.forEach(pos => {
            const wheel = new THREE.Mesh(wheelGeo, wheelMat);
            wheel.rotation.z = Math.PI / 2;
            wheel.position.set(...pos);
            suvGroup.add(wheel);
        });

        return suvGroup;
    }

    // --- 3. UNIFIED SPINNING GOLD COIN (GOLD + BLACK RIM AS ONE UNIT) ---
    function create3DCoinMesh(radius = 1.5) {
        if (typeof THREE === 'undefined') return { group: null, spinnerUnit: null, auraMesh: null };

        const coinGroup = new THREE.Group();
        const spinnerUnit = new THREE.Group(); // Single unit that spins together

        // Core Gold Cylinder
        const coinGeo = new THREE.CylinderGeometry(radius, radius, 0.3, 24);
        const coinMat = new THREE.MeshStandardMaterial({ color: 0xFFDD00, emissive: 0xFFAA00, emissiveIntensity: 0.5 });
        const coinMesh = new THREE.Mesh(coinGeo, coinMat);
        coinMesh.rotation.x = Math.PI / 2;
        spinnerUnit.add(coinMesh);

        // THIN BLACK OUTER EDGE LAYER (UNIFIED INSIDE SPINNER UNIT)
        const rimGeo = new THREE.TorusGeometry(radius + 0.02, 0.06, 12, 32);
        const rimMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
        const rimMesh = new THREE.Mesh(rimGeo, rimMat);
        spinnerUnit.add(rimMesh);

        coinGroup.add(spinnerUnit);

        // Outer Aura
        const auraGeo = new THREE.SphereGeometry(radius * 1.7, 24, 24);
        const auraMat = new THREE.MeshBasicMaterial({ color: 0xFFFF55, transparent: true, opacity: 0.25, wireframe: true });
        const auraMesh = new THREE.Mesh(auraGeo, auraMat);
        coinGroup.add(auraMesh);

        return { group: coinGroup, spinnerUnit: spinnerUnit, auraMesh: auraMesh };
    }

    // --- 4. RAMP & SPEED PAD CREATION ---
    function createSolidGreenRampMesh(width, height, depth) {
        const shape = new THREE.Shape();
        shape.moveTo(0, 0);
        shape.lineTo(depth, 0);
        shape.lineTo(depth, height);
        shape.closePath();

        const extrudeSettings = { depth: width, bevelEnabled: false };
        const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        const material = new THREE.MeshStandardMaterial({ color: 0x2e7d32, roughness: 0.3, metalness: 0.1 });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.rotation.y = -Math.PI / 2; 
        mesh.position.x = width / 2; 
        return mesh;
    }

    function createRedSpeedStripMesh(width, depth) {
        const padGroup = new THREE.Group();

        const baseGeo = new THREE.PlaneGeometry(width, depth);
        const baseMat = new THREE.MeshBasicMaterial({ color: 0xD32F2F, side: THREE.DoubleSide });
        const baseMesh = new THREE.Mesh(baseGeo, baseMat);
        baseMesh.rotation.x = -Math.PI / 2;
        padGroup.add(baseMesh);

        return padGroup;
    }

    // --- 5. TUTORIAL LOOP WITH UNIFIED COIN SPINNER ---
    function init3DTutorial() {
        const container = document.getElementById('tutorial-3d-viewport');
        if (!container || container.children.length > 0 || typeof THREE === 'undefined') return;

        const tScene = new THREE.Scene();
        tScene.background = new THREE.Color(0xb0e0e6);

        const tCam = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 100);
        tCam.position.set(0, 8, -14);

        const tRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        tRenderer.setSize(container.clientWidth, container.clientHeight);
        container.appendChild(tRenderer.domElement);

        tScene.add(new THREE.AmbientLight(0xffffff, 0.9));
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(10, 20, 10);
        tScene.add(dirLight);

        const iceGeo = new THREE.PlaneGeometry(100, 100);
        const iceMat = new THREE.MeshStandardMaterial({ color: 0xe0f7fa, roughness: 0.1 });
        const ice = new THREE.Mesh(iceGeo, iceMat);
        ice.rotation.x = -Math.PI / 2;
        tScene.add(ice);

        const redSUV = create3DSUVMesh(0xD32F2F);
        if (redSUV) tScene.add(redSUV);

        // Unified Coins for Tutorial
        const coin1 = create3DCoinMesh(1.2);
        if (coin1.group) {
            coin1.group.position.set(0, 1.5, 4);
            tScene.add(coin1.group);
        }

        const coin2 = create3DCoinMesh(1.2);
        if (coin2.group) {
            coin2.group.position.set(10, 1.5, 22);
            tScene.add(coin2.group);
        }

        let startTime = Date.now();

        function animateTutorial() {
            const elapsed = ((Date.now() - startTime) % 6000) / 1000;

            // Spin Gold Coin + Black Outline as single unit
            if (coin1.spinnerUnit) coin1.spinnerUnit.rotation.z += 0.08;
            if (coin2.spinnerUnit) coin2.spinnerUnit.rotation.z += 0.08;

            if (redSUV) {
                if (elapsed < 0.8) {
                    const progress = elapsed / 0.8;
                    redSUV.position.set(0, 0, -5 + progress * 9);
                    redSUV.rotation.y = 0;
                    if (coin1.group) coin1.group.visible = true;
                } else if (elapsed < 1.6) {
                    if (coin1.group) coin1.group.visible = false;
                    const turnProgress = (elapsed - 0.8) / 0.8;
                    redSUV.position.set(turnProgress * 2.5, 0, 4 + turnProgress * 3.5);
                    redSUV.rotation.y = -turnProgress * 0.55;
                } else {
                    const driveProgress = (elapsed - 1.6) / 4.4;
                    redSUV.position.set(2.5 + driveProgress * 7.5, 0, 7.5 + driveProgress * 14.5);
                    redSUV.rotation.y = -0.55;
                    if (coin2.group) coin2.group.visible = true;
                }

                tCam.position.x = redSUV.position.x;
                tCam.position.z = redSUV.position.z - 12;
                tCam.lookAt(redSUV.position.x, 1.2, redSUV.position.z + 4);
            }

            tRenderer.render(tScene, tCam);
            requestAnimationFrame(animateTutorial);
        }

        animateTutorial();
    }

    // --- 6. SAFETY ZONE PROXIMITY CHECK (NO CRACKS NEAR LAND/SPEED/RAMPS/COINS) ---
    function isNearSafetyZone(x, z) {
        // 1. Shoreline / Land Exclusion Buffer
        const isOddLevel = currentLevel % 2 !== 0;
        if (isOddLevel) {
            const marginX = (lakeWidth / 2) * 0.82;
            const marginZ = (lakeLength / 2) * 0.82;
            if (Math.abs(x) >= marginX || Math.abs(z) >= marginZ) return true;
        }

        // 2. Speed Boost Strips Radius
        if (speedPads3D.some(sp => Math.hypot(x - sp.x, z - sp.z) < 14)) return true;

        // 3. Ramps Radius
        if (ramps3D.some(r => Math.hypot(x - r.x, z - r.z) < 18)) return true;

        // 4. Gold Coins Radius
        if (coins3D.some(c => !c.collected && Math.hypot(x - c.x, z - c.z) < 12)) return true;

        return false;
    }

    // --- 7. SPAWN RED LINE CRACKS THAT TURN INTO HOLES ---
    function spawnRedIceCrack(x, z) {
        if (isNearSafetyZone(x, z) || typeof THREE === 'undefined') return;

        const crackGroup = new THREE.Group();
        const lineMat = new THREE.LineBasicMaterial({ color: 0xFF0000, linewidth: 3 });

        const points = [];
        let currX = -3.5, currZ = 0;
        for (let i = 0; i < 8; i++) {
            points.push(new THREE.Vector3(currX, 0.05, currZ));
            currX += 0.9;
            currZ += (i % 2 === 0 ? 0.8 : -0.8);
        }

        const mainLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), lineMat);
        crackGroup.add(mainLine);
        crackGroup.position.set(x, 0, z);

        if (scene) scene.add(crackGroup);

        activeCracks.push({ mesh: crackGroup, x: x, z: z, timer: 0, maxTimer: 75 });
    }

    // --- 8. 3D CAR SELECTION PREVIEWS ---
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

            const previewSUV = create3DSUVMesh(colorHex);
            if (previewSUV) pScene.add(previewSUV);

            function animatePreview() {
                if (previewSUV) previewSUV.rotation.y += 0.015;
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

                    if (suvMesh && scene) scene.remove(suvMesh);
                    suvMesh = create3DSUVMesh(vehicleColorHex);
                    if (suvMesh && scene) scene.add(suvMesh);

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
        }, 5000);
    }

    // --- 10. LEVEL INTRO RESET ---
    function startLevelWithIntro(levelNum) {
        currentLevel = levelNum;
        isTransitioning = true;
        isPaused = true;
        isGameOver = false;

        setGaugeVisible(false);

        levelIntroText.textContent = `LEVEL ${currentLevel}`;
        levelIntroScreen.classList.remove('hidden');

        init3D();

        suv.x = 0;
        suv.z = -lakeLength / 2 + 10;
        suv.y = 0;
        suv.vy = 0;
        suv.isAirborne = false;
        suv.vx = 0;
        suv.vz = 0;
        suv.angle = 0; 
        suv.sinking = false;
        suv.dwellTimer = 0;

        if (suvMesh) {
            suvMesh.position.set(suv.x, 0, suv.z);
            suvMesh.rotation.y = 0;
            suvMesh.scale.set(1, 1, 1);
        }

        if (camera) {
            camera.position.set(0, 7, suv.z - 12);
            if (cameraLookTarget.set) cameraLookTarget.set(0, 1.2, suv.z + 5);
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

        if (iceMesh && scene) scene.remove(iceMesh);
        if (waterMesh && scene) scene.remove(waterMesh);

        if (typeof THREE !== 'undefined' && scene) {
            const infiniteIceGeo = new THREE.PlaneGeometry(800, 800);
            const iceMat = new THREE.MeshStandardMaterial({ color: 0xcaf0f8, roughness: 0.08, metalness: 0.05 });
            iceMesh = new THREE.Mesh(infiniteIceGeo, iceMat);
            iceMesh.rotation.x = -Math.PI / 2;
            iceMesh.position.y = 0;
            iceMesh.receiveShadow = true;
            scene.add(iceMesh);
        }

        coins3D.forEach(c => scene && scene.remove(c.group));
        coins3D = [];
        ramps3D.forEach(r => r.mesh && scene.remove(r.mesh));
        ramps3D = [];
        speedPads3D.forEach(sp => scene && scene.remove(sp.mesh));
        speedPads3D = [];
        activeCracks.forEach(c => scene && scene.remove(c.mesh));
        activeCracks = [];
        holes3D.forEach(h => scene && scene.remove(h.mesh));
        holes3D = [];

        requiredCoins = level * 2;
        scoreCoins = 0;

        // Build Ramps (Level >= 3)
        if (level >= 3) {
            const solidRamp = createSolidGreenRampMesh(8, 2.5, 14);
            const rampX = (Math.random() - 0.5) * (lakeWidth - 40);
            const rampZ = -lakeLength / 2 + 50;
            solidRamp.position.set(rampX, 0, rampZ - 7);
            if (scene) scene.add(solidRamp);

            ramps3D.push({ mesh: solidRamp, x: rampX, z: rampZ, width: 8, depth: 14, height: 2.5 });
        }

        for (let i = 0; i < requiredCoins; i++) {
            const coinData = create3DCoinMesh(1.5);

            const xPos = (Math.random() - 0.5) * (lakeWidth - 30);
            const zPos = -lakeLength / 2 + 30 + (i * ((lakeLength - 50) / requiredCoins));

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

        const progressRatio = Math.max(0.05, 1 - (currentLevel - 1) * 0.1 - ((suv.z + lakeLength / 2) / lakeLength));
        gaugeDial.style.bottom = `${15 + progressRatio * 125}px`;
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

        document.getElementById('btn-to-car-select').addEventListener('click', () => {
            instructionsScreen.classList.add('hidden');
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

    // --- 12. GAMEPLAY UPDATE LOOP (PHYSICS, JUMPS, CRACKS & HOLES) ---
    function update() {
        if (isGameOver || isPaused) return;

        let currentMaxAccel = 0.052;
        if (keys.up) {
            suv.vx += Math.sin(suv.angle) * currentMaxAccel;
            suv.vz += Math.cos(suv.angle) * currentMaxAccel;
        }
        if (keys.down) {
            suv.vx -= Math.sin(suv.angle) * 0.028;
            suv.vz -= Math.cos(suv.angle) * 0.028;
        }
        if (keys.left) suv.angle += 0.045;
        if (keys.right) suv.angle -= 0.045;

        suv.vx *= 0.955;
        suv.vz *= 0.955;
        suv.x += suv.vx;
        suv.z += suv.vz;

        // RAMP HEIGHT & BALLISTIC AIRBORNE JUMP DYNAMICS
        let rampSurfaceY = 0;
        let onRamp = false;

        ramps3D.forEach(r => {
            const relZ = suv.z - (r.z - r.depth / 2);
            if (Math.abs(suv.x - r.x) < r.width / 2 && relZ >= 0 && relZ <= r.depth) {
                onRamp = true;
                const ratio = relZ / r.depth;
                rampSurfaceY = ratio * r.height;
            }
        });

        if (onRamp) {
            suv.y = rampSurfaceY;
            suv.isAirborne = false;
            suv.vy = 0;
        } else {
            if (suv.y > 0 && !suv.isAirborne && suv.vz > 0.1) {
                suv.isAirborne = true;
                suv.vy = 0.18; // Upward initial launch impulse
            }

            if (suv.isAirborne) {
                suv.vy += suv.gravity;
                suv.y += suv.vy;

                if (suv.y <= 0) {
                    suv.y = 0;
                    suv.vy = 0;
                    suv.isAirborne = false;
                }
            } else {
                suv.y = 0;
            }
        }

        // 1-SECOND DWELL TRACKING FOR RED ICE CRACK FORMATION
        const moveDist = Math.hypot(suv.x - suv.lastX, suv.z - suv.lastZ);
        if (moveDist < 0.25) {
            suv.dwellTimer++;
            if (suv.dwellTimer >= 60) { // Spends 1 Second in an area
                suv.dwellTimer = 0;
                spawnRedIceCrack(suv.x, suv.z);
            }
        } else {
            suv.dwellTimer = 0;
        }
        suv.lastX = suv.x;
        suv.lastZ = suv.z;

        // PROCESS RED CRACKS TRANSITION TO WATER HOLES
        for (let i = activeCracks.length - 1; i >= 0; i--) {
            const crack = activeCracks[i];
            crack.timer++;

            crack.mesh.children.forEach(line => {
                line.material.opacity = (crack.timer % 10 < 5) ? 0.3 : 1.0;
                line.material.transparent = true;
            });

            if (crack.timer >= crack.maxTimer) {
                if (scene) scene.remove(crack.mesh);

                if (!isNearSafetyZone(crack.x, crack.z) && typeof THREE !== 'undefined') {
                    const holeGeo = new THREE.CylinderGeometry(2.8, 2.8, 0.2, 16);
                    const holeMat = new THREE.MeshBasicMaterial({ color: 0x0a1d30 });
                    const holeMesh = new THREE.Mesh(holeGeo, holeMat);
                    holeMesh.position.set(crack.x, 0.02, crack.z);
                    if (scene) scene.add(holeMesh);

                    holes3D.push({ mesh: holeMesh, x: crack.x, z: crack.z, radius: 2.8 });
                }

                activeCracks.splice(i, 1);
            }
        }

        // HOLE FALL COLLISION
        for (let hole of holes3D) {
            if (Math.hypot(suv.x - hole.x, suv.z - hole.z) < hole.radius - 0.4 && suv.y <= 0.2) {
                handleLifeLost();
                return;
            }
        }

        if (suvMesh) {
            suvMesh.position.set(suv.x, suv.y, suv.z);
            suvMesh.rotation.y = suv.angle;
        }

        // CAMERA TRACKING
        if (camera) {
            const distanceBehind = 12;
            const cameraHeight = 6;
            const idealX = suv.x - Math.sin(suv.angle) * distanceBehind;
            const idealZ = suv.z - Math.cos(suv.angle) * distanceBehind;
            const idealY = suv.y + cameraHeight;

            camera.position.x += (idealX - camera.position.x) * 0.08;
            camera.position.y += (idealY - camera.position.y) * 0.08;
            camera.position.z += (idealZ - camera.position.z) * 0.08;

            const targetLookX = suv.x + Math.sin(suv.angle) * 3;
            const targetLookZ = suv.z + Math.cos(suv.angle) * 3;
            if (cameraLookTarget.x !== undefined) {
                cameraLookTarget.x += (targetLookX - cameraLookTarget.x) * 0.08;
                cameraLookTarget.y = suv.y + 1.2;
                cameraLookTarget.z += (targetLookZ - cameraLookTarget.z) * 0.08;
                camera.lookAt(cameraLookTarget);
            }
        }

        // UNIFIED COIN ROTATION & COLLECTION
        coins3D.forEach(coin => {
            if (!coin.collected) {
                if (coin.spinnerUnit) coin.spinnerUnit.rotation.z += 0.07; // Spin Gold + Black Rim together
                if (coin.auraMesh) coin.auraMesh.rotation.y += 0.04;

                const dist = Math.hypot(suv.x - coin.x, suv.z - coin.z);
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

    function handleResize() {
        const container = document.getElementById('webgl-container');
        if (renderer && camera && container) {
            camera.aspect = container.clientWidth / container.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(container.clientWidth, container.clientHeight);
        }
    }

    window.addEventListener('resize', handleResize);

    setupControls();
    startIntro();
});
