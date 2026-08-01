/* Fish Energy Survival - 3D Engine & Game Logic */

document.addEventListener('DOMContentLoaded', () => {
    let scene, camera, renderer;
    let playerFishMesh, playerGlowLight;
    let worms3D = [], sharks3D = [], seaweedClumps3D = [], bubbles3D;

    const introScreen = document.getElementById('intro-screen');
    const instructionsScreen = document.getElementById('instructions-screen');
    const pauseScreen = document.getElementById('pause-screen');
    const gameOverScreen = document.getElementById('game-over-screen');
    const victoryScreen = document.getElementById('victory-screen');
    const levelIntroScreen = document.getElementById('level-intro-screen');
    const levelIntroText = document.getElementById('level-intro-text');
    const levelIntroSub = document.getElementById('level-intro-sub');
    const energyBarFill = document.getElementById('energy-bar-fill');

    const hudTime = document.getElementById('hud-time');
    const hudSharks = document.getElementById('hud-sharks-count');
    const bottomTimeBox = document.getElementById('bottom-time-box');
    const modalLivesCount = document.getElementById('modal-lives-count');
    const btnRestartLevel = document.getElementById('btn-restart-level');

    let currentLevel = 1;
    let lives = 3;
    let timeRemaining = 60;
    let timerInterval = null;
    let animFrameId = null;

    let isGameOver = false;
    let isPaused = false;
    let isTransitioning = false;
    let introTransitioned = false;

    // Energy Mechanics
    let fishEnergy = 100;
    const MAX_ENERGY = 100;
    const ENERGY_DEPLETION_RATE = 0.08;

    const keys = { up: false, down: false, left: false, right: false };

    // Player Fish Physics State
    const fish = {
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        speed: 0.08,
        accel: 0.035,
        friction: 0.92,
        angleY: 0,
        angleX: 0
    };

    const oceanBounds = { width: 120, height: 60, depth: 140 };

    let cameraLookTarget = (typeof THREE !== 'undefined') ? new THREE.Vector3() : { x: 0, y: 0, z: 0 };

    // --- 1. THREE.JS VIEWPORT & ENVIRONMENT INITIALIZATION ---
    function init3D() {
        const container = document.getElementById('webgl-container');
        if (!container || typeof THREE === 'undefined') return false;

        if (!scene) {
            scene = new THREE.Scene();
            scene.background = new THREE.Color(0x021428);
            scene.fog = new THREE.FogExp2(0x021428, 0.015);
        }

        if (!camera) {
            camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 1000);
            camera.position.set(0, 8.5, -22);
        }

        if (!renderer) {
            renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
            renderer.setSize(container.clientWidth, container.clientHeight);
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            renderer.shadowMap.enabled = true;
            renderer.shadowMap.type = THREE.PCFSoftShadowMap;
            container.appendChild(renderer.domElement);

            const ambientLight = new THREE.AmbientLight(0x205078, 1.1);
            scene.add(ambientLight);

            const sunLight = new THREE.DirectionalLight(0x60f0ff, 1.6);
            sunLight.position.set(0, 60, 20);
            sunLight.castShadow = true;
            scene.add(sunLight);

            buildSeabedAndSeaweed();
            buildFloatingBubbles();
        }
        return true;
    }

    function buildSeabedAndSeaweed() {
        const floorGeo = new THREE.PlaneGeometry(200, 200, 32, 32);
        const floorMat = new THREE.MeshStandardMaterial({ color: 0x0a1f30, roughness: 0.9 });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = -oceanBounds.height / 2 - 2;
        floor.receiveShadow = true;
        scene.add(floor);

        const plantGeo = new THREE.CylinderGeometry(0.08, 0.22, 5, 6, 8);
        const plantMat = new THREE.MeshStandardMaterial({ color: 0x00b862, roughness: 0.5, flatShading: true });

        for (let i = 0; i < 32; i++) {
            const clump = new THREE.Group();
            const bladeCount = 3 + Math.floor(Math.random() * 4);
            
            for (let j = 0; j < bladeCount; j++) {
                const blade = new THREE.Mesh(plantGeo, plantMat);
                blade.position.set((Math.random() - 0.5) * 0.6, 2.5, (Math.random() - 0.5) * 0.6);
                blade.rotation.z = (Math.random() - 0.5) * 0.3;
                blade.rotation.x = (Math.random() - 0.5) * 0.3;
                clump.add(blade);
            }

            const px = (Math.random() - 0.5) * (oceanBounds.width - 20);
            const pz = (Math.random() - 0.5) * (oceanBounds.depth - 20);
            clump.position.set(px, floor.position.y, pz);

            seaweedClumps3D.push(clump);
            scene.add(clump);
        }
    }

    function buildFloatingBubbles() {
        const count = 70;
        const geo = new THREE.BufferGeometry();
        const pos = new Float32Array(count * 3);

        for (let i = 0; i < count * 3; i += 3) {
            pos[i] = (Math.random() - 0.5) * oceanBounds.width;
            pos[i + 1] = (Math.random() - 0.5) * oceanBounds.height;
            pos[i + 2] = (Math.random() - 0.5) * oceanBounds.depth;
        }

        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        const mat = new THREE.PointsMaterial({ color: 0x7be5ff, size: 0.2, transparent: true, opacity: 0.6 });
        bubbles3D = new THREE.Points(geo, mat);
        scene.add(bubbles3D);
    }

    // --- 2. BUILD MESHES ---
    function createPlayerFishMesh() {
        const tunaGroup = new THREE.Group();

        playerGlowLight = new THREE.PointLight(0x00ffff, 2.5, 12);
        tunaGroup.add(playerGlowLight);

        const bodyGeo = new THREE.ConeGeometry(1.6, 5.0, 20);
        bodyGeo.rotateX(Math.PI / 2);
        const bodyMat = new THREE.MeshStandardMaterial({
            color: 0x0d3b66,
            roughness: 0.2,
            metalness: 0.5,
            emissive: 0x004466,
            emissiveIntensity: 0.4
        });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.castShadow = true;
        tunaGroup.add(body);

        const glowShellGeo = new THREE.ConeGeometry(1.7, 5.1, 16);
        glowShellGeo.rotateX(Math.PI / 2);
        const glowShellMat = new THREE.MeshBasicMaterial({
            color: 0x00f0ff,
            transparent: true,
            opacity: 0.22,
            side: THREE.BackSide
        });
        const glowShell = new THREE.Mesh(glowShellGeo, glowShellMat);
        tunaGroup.add(glowShell);

        const stripeGeo = new THREE.CylinderGeometry(0.85, 1.55, 4.2, 16);
        stripeGeo.rotateX(Math.PI / 2);
        const stripeMat = new THREE.MeshStandardMaterial({ color: 0xffd166, roughness: 0.3 });
        const stripe = new THREE.Mesh(stripeGeo, stripeMat);
        stripe.scale.set(1.02, 1.02, 0.98);
        tunaGroup.add(stripe);

        const tailGeo = new THREE.BufferGeometry();
        const vertices = new Float32Array([
            0, 0, -2.4,
            0, 1.8, -3.8,
            0, -1.8, -3.8
        ]);
        tailGeo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        tailGeo.computeVertexNormals();
        const finMat = new THREE.MeshStandardMaterial({ color: 0xffb703, side: THREE.DoubleSide });
        const tail = new THREE.Mesh(tailGeo, finMat);
        tunaGroup.add(tail);

        for (let i = 0; i < 3; i++) {
            const finletGeo = new THREE.ConeGeometry(0.12, 0.4, 4);
            const finletTop = new THREE.Mesh(finletGeo, finMat);
            finletTop.position.set(0, 0.7 - i * 0.4, -1.5 - i * 0.3);
            finletTop.rotation.x = -Math.PI / 3;
            tunaGroup.add(finletTop);
        }

        const eyeGeo = new THREE.SphereGeometry(0.32, 12, 12);
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const pupilMat = new THREE.MeshBasicMaterial({ color: 0x000000 });

        const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
        leftEye.position.set(-0.8, 0.35, 1.2);
        const leftPupil = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), pupilMat);
        leftPupil.position.set(-0.95, 0.35, 1.35);
        tunaGroup.add(leftEye); tunaGroup.add(leftPupil);

        const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
        rightEye.position.set(0.8, 0.35, 1.2);
        const rightPupil = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), pupilMat);
        rightPupil.position.set(0.95, 0.35, 1.35);
        tunaGroup.add(rightEye); tunaGroup.add(rightPupil);

        return tunaGroup;
    }

    function createSharkMesh() {
        const sharkGroup = new THREE.Group();

        const darkSkinMat = new THREE.MeshStandardMaterial({ color: 0x2b3642, roughness: 0.4 });
        const whiteBellyMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.5 });
        const finDarkMat = new THREE.MeshStandardMaterial({ color: 0x1e2730, roughness: 0.3 });

        const snoutGeo = new THREE.ConeGeometry(1.6, 3.2, 16);
        snoutGeo.rotateX(Math.PI / 2);
        const snout = new THREE.Mesh(snoutGeo, darkSkinMat);
        snout.position.set(0, 0, 3.2);
        sharkGroup.add(snout);

        const bodyGeo = new THREE.CylinderGeometry(1.6, 1.2, 6.0, 16);
        bodyGeo.rotateX(Math.PI / 2);
        const body = new THREE.Mesh(bodyGeo, darkSkinMat);
        body.position.set(0, 0, -0.4);
        body.castShadow = true;
        sharkGroup.add(body);

        const bellyGeo = new THREE.CylinderGeometry(1.5, 1.1, 5.8, 16);
        bellyGeo.rotateX(Math.PI / 2);
        const belly = new THREE.Mesh(bellyGeo, whiteBellyMat);
        belly.position.set(0, -0.25, -0.4);
        belly.scale.set(0.96, 0.9, 0.98);
        sharkGroup.add(belly);

        const primaryDorsalGeo = new THREE.ConeGeometry(0.35, 3.2, 4);
        const primaryDorsal = new THREE.Mesh(primaryDorsalGeo, finDarkMat);
        primaryDorsal.rotation.x = -Math.PI / 3.5;
        primaryDorsal.position.set(0, 2.6, 0.2);
        sharkGroup.add(primaryDorsal);

        const secondaryDorsalGeo = new THREE.ConeGeometry(0.2, 1.2, 4);
        const secondaryDorsal = new THREE.Mesh(secondaryDorsalGeo, finDarkMat);
        secondaryDorsal.rotation.x = -Math.PI / 3.5;
        secondaryDorsal.position.set(0, 1.4, -2.5);
        sharkGroup.add(secondaryDorsal);

        const pecLeftGeo = new THREE.BoxGeometry(3.8, 0.18, 1.6);
        const pecLeft = new THREE.Mesh(pecLeftGeo, finDarkMat);
        pecLeft.position.set(0, -0.4, 0.8);
        pecLeft.rotation.z = -Math.PI / 12;
        sharkGroup.add(pecLeft);

        const pelvicGeo = new THREE.BoxGeometry(1.8, 0.15, 0.8);
        const pelvic = new THREE.Mesh(pelvicGeo, finDarkMat);
        pelvic.position.set(0, -1.0, -1.8);
        sharkGroup.add(pelvic);

        const tailGroup = new THREE.Group();
        tailGroup.position.set(0, 0, -3.4);

        const upperTailGeo = new THREE.ConeGeometry(0.3, 3.8, 4);
        const upperTail = new THREE.Mesh(upperTailGeo, finDarkMat);
        upperTail.position.set(0, 1.6, -1.2);
        upperTail.rotation.x = -Math.PI / 3;
        tailGroup.add(upperTail);

        const lowerTailGeo = new THREE.ConeGeometry(0.25, 2.2, 4);
        const lowerTail = new THREE.Mesh(lowerTailGeo, finDarkMat);
        lowerTail.position.set(0, -0.8, -0.8);
        lowerTail.rotation.x = Math.PI / 3.5;
        tailGroup.add(lowerTail);

        sharkGroup.add(tailGroup);

        const gillMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
        for (let i = 0; i < 4; i++) {
            const gill = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.6, 0.1), gillMat);
            gill.position.set(-1.61, 0, 1.5 - i * 0.35);
            sharkGroup.add(gill);

            const gillR = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.6, 0.1), gillMat);
            gillR.position.set(1.61, 0, 1.5 - i * 0.35);
            sharkGroup.add(gillR);
        }

        const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff1100 });
        const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 8), eyeMat);
        leftEye.position.set(-1.2, 0.35, 3.2);
        const rightEye = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 8), eyeMat);
        rightEye.position.set(1.2, 0.35, 3.2);
        sharkGroup.add(leftEye); sharkGroup.add(rightEye);

        return sharkGroup;
    }

    function createWormMesh() {
        const wormGroup = new THREE.Group();

        const segmentCount = 18;
        const segmentRadius = 0.38;
        const wormMat = new THREE.MeshStandardMaterial({ color: 0xff88a5, roughness: 0.4 });
        const jointMat = new THREE.MeshBasicMaterial({ color: 0x661122 });

        for (let i = 0; i < segmentCount; i++) {
            const angle = (i / segmentCount) * Math.PI * 1.5;
            const x = Math.sin(angle) * 1.2;
            const y = Math.cos(angle) * 0.8;
            const z = (i - segmentCount / 2) * 0.18;

            const segGeo = new THREE.SphereGeometry(segmentRadius, 10, 10);
            const segMesh = new THREE.Mesh(segGeo, wormMat);
            segMesh.position.set(x, y, z);
            wormGroup.add(segMesh);

            if (i < segmentCount - 1) {
                const ringGeo = new THREE.TorusGeometry(segmentRadius * 0.95, 0.05, 6, 12);
                const ringMesh = new THREE.Mesh(ringGeo, jointMat);
                ringMesh.position.set(x, y, z);
                wormGroup.add(ringMesh);
            }
        }

        return wormGroup;
    }

    // --- 3. FULL-SCREEN 3D TUTORIAL LOOP ---
    function init3DTutorial() {
        const container = document.getElementById('tutorial-3d-viewport');
        if (!container || container.children.length > 0 || typeof THREE === 'undefined') return;

        const tScene = new THREE.Scene();
        tScene.background = new THREE.Color(0x021428);

        const tCam = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 1000);
        tCam.position.set(0, 8.5, -20);

        const tRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        tRenderer.setSize(container.clientWidth, container.clientHeight);
        container.appendChild(tRenderer.domElement);

        tScene.add(new THREE.AmbientLight(0x306088, 1.0));

        const tutFish = createPlayerFishMesh();
        tScene.add(tutFish);

        const tutWorm = createWormMesh();
        tutWorm.position.set(0, 0, 10);
        tScene.add(tutWorm);

        const tutShark = createSharkMesh();
        tutShark.position.set(20, 0, 16);
        tScene.add(tutShark);

        let startTime = Date.now();

        function animateTutorial() {
            if (introTransitioned && instructionsScreen.classList.contains('hidden')) return;

            const elapsed = ((Date.now() - startTime) % 6000) / 1000;
            tutWorm.rotation.y += 0.04;
            tutShark.rotation.y = Math.PI / 2;

            if (elapsed < 3.0) {
                const p = elapsed / 3.0;
                tutFish.position.set(0, 0, -10 + p * 20);
                tutFish.rotation.y = 0;
                tutWorm.visible = true;
            } else {
                tutWorm.visible = false;
                const p = (elapsed - 3.0) / 3.0;
                tutFish.position.set(-p * 15, 0, 10 + p * 15);
                tutFish.rotation.y = -0.8;
            }

            tCam.position.x = tutFish.position.x;
            tCam.position.z = tutFish.position.z - 18;
            tCam.lookAt(tutFish.position.x, 0, tutFish.position.z + 5);

            tRenderer.render(tScene, tCam);
            requestAnimationFrame(animateTutorial);
        }

        animateTutorial();
    }

    // --- 4. INTRO & LEVEL GENERATION ---
    function triggerIntroTransition() {
        if (introTransitioned) return;
        introTransitioned = true;
        introScreen.classList.add('hidden');
        instructionsScreen.classList.remove('hidden');
        init3DTutorial();
    }

    function startIntro() {
        setTimeout(() => triggerIntroTransition(), 5000);
        introScreen.addEventListener('click', () => triggerIntroTransition());
    }

    function startLevelWithIntro(levelNum) {
        currentLevel = levelNum;
        isTransitioning = true;
        isPaused = true;
        isGameOver = false;

        levelIntroText.textContent = `LEVEL ${currentLevel}`;
        levelIntroSub.textContent = "SURVIVE FOR 60 SECONDS";
        levelIntroScreen.classList.remove('hidden');

        init3D();

        fish.x = 0; fish.y = 0; fish.z = 0;
        fish.vx = 0; fish.vy = 0; fish.vz = 0;
        fish.angleY = 0; fish.angleX = 0;
        fishEnergy = MAX_ENERGY;
        updateEnergyGauge();

        if (playerFishMesh) {
            playerFishMesh.position.set(fish.x, fish.y, fish.z);
            playerFishMesh.rotation.set(0, 0, 0);
        }

        buildLevelEnvironment(currentLevel);

        setTimeout(() => {
            levelIntroScreen.classList.add('hidden');
            isTransitioning = false;
            isPaused = false;
            timeRemaining = 60;
            updateHUD();
            startTimer();
        }, 1800);
    }

    function buildLevelEnvironment(level) {
        worms3D.forEach(w => scene && scene.remove(w.mesh));
        worms3D = [];
        sharks3D.forEach(s => scene && scene.remove(s.mesh));
        sharks3D = [];

        const sharkCount = level;
        const wormCount = Math.max(4, 18 - level * 2);

        for (let i = 0; i < wormCount; i++) {
            const wormMesh = createWormMesh();
            const wx = (Math.random() - 0.5) * (oceanBounds.width - 30);
            const wy = (Math.random() - 0.5) * (oceanBounds.height - 20);
            const wz = (Math.random() - 0.5) * (oceanBounds.depth - 40);

            wormMesh.position.set(wx, wy, wz);
            if (scene) scene.add(wormMesh);

            worms3D.push({ mesh: wormMesh, x: wx, y: wy, z: wz, eaten: false });
        }

        for (let i = 0; i < sharkCount; i++) {
            const sharkMesh = createSharkMesh();
            const sx = (Math.random() - 0.5) * (oceanBounds.width - 20);
            const sy = (Math.random() - 0.5) * (oceanBounds.height - 20);
            const sz = (Math.random() - 0.5) * (oceanBounds.depth - 20);

            sharkMesh.position.set(sx, sy, sz);
            if (scene) scene.add(sharkMesh);

            const speedMag = 0.12 + Math.random() * 0.06;
            const randomAngle = Math.random() * Math.PI * 2;

            sharks3D.push({
                mesh: sharkMesh,
                x: sx, y: sy, z: sz,
                vx: Math.sin(randomAngle) * speedMag,
                vy: (Math.random() - 0.5) * 0.04,
                vz: Math.cos(randomAngle) * speedMag,
                angleY: randomAngle
            });
        }

        if (!playerFishMesh && scene) {
            playerFishMesh = createPlayerFishMesh();
            playerFishMesh.position.set(fish.x, fish.y, fish.z);
            scene.add(playerFishMesh);
        }
    }

    // --- 5. TIMERS, HUD & CONTROLS ---
    function startTimer() {
        clearInterval(timerInterval);
        timerInterval = setInterval(() => {
            if (isGameOver || isPaused) return;
            timeRemaining--;
            hudTime.textContent = timeRemaining;

            if (timeRemaining <= 10) bottomTimeBox.classList.add('urgent-warning');
            else bottomTimeBox.classList.remove('urgent-warning');

            if (timeRemaining <= 0) {
                if (currentLevel < 8) {
                    startLevelWithIntro(currentLevel + 1);
                } else {
                    triggerVictory();
                }
            }
        }, 1000);
    }

    function updateHUD() {
        hudTime.textContent = timeRemaining;
        hudSharks.textContent = sharks3D.length;
    }

    function updateEnergyGauge() {
        if (!energyBarFill) return;
        const pct = Math.max(0, Math.min(100, fishEnergy));
        energyBarFill.style.width = `${pct}%`;
    }

    function togglePause() {
        if (isGameOver || isTransitioning) return;
        isPaused = !isPaused;
        if (isPaused) pauseScreen.classList.remove('hidden');
        else pauseScreen.classList.add('hidden');
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

        const bindButton = (id, keyName) => {
            const btn = document.getElementById(id);
            if (!btn) return;

            const start = (e) => {
                e.preventDefault();
                if (!isPaused) keys[keyName] = true;
                btn.classList.add('active');
            };
            const end = (e) => {
                e.preventDefault();
                keys[keyName] = false;
                btn.classList.remove('active');
            };

            btn.addEventListener('touchstart', start, { passive: false });
            btn.addEventListener('touchend', end, { passive: false });
            btn.addEventListener('mousedown', start);
            btn.addEventListener('mouseup', end);
            btn.addEventListener('mouseleave', end);
        };

        bindButton('btn-up', 'up');
        bindButton('btn-down', 'down');
        bindButton('btn-left', 'left');
        bindButton('btn-right', 'right');

        document.getElementById('btn-pause-hud').addEventListener('click', togglePause);
        document.getElementById('btn-resume').addEventListener('click', togglePause);

        document.querySelectorAll('.btn-return-csg').forEach(btn => {
            btn.addEventListener('click', () => { window.location.href = "https://clicksyncgames.com"; });
        });

        document.getElementById('btn-start-game').addEventListener('click', () => {
            instructionsScreen.classList.add('hidden');
            startLevelWithIntro(1);
            if (!animFrameId) animFrameId = requestAnimationFrame(gameLoop);
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

    // --- 6. MAIN GAME LOOP & PHYSICS ---
    function update() {
        if (isGameOver || isPaused) return;

        fishEnergy -= ENERGY_DEPLETION_RATE;
        updateEnergyGauge();

        if (fishEnergy <= 0) {
            handleLifeLost("YOU RAN OUT OF ENERGY!");
            return;
        }

        if (keys.left) fish.angleY += 0.04;
        if (keys.right) fish.angleY -= 0.04;
        
        if (keys.up) {
            fish.angleX = Math.min(0.5, fish.angleX + 0.025);
        } else if (keys.down) {
            fish.angleX = Math.max(-0.5, fish.angleX - 0.025);
        } else {
            fish.angleX *= 0.9;
        }

        const isMoving = keys.up || keys.down || keys.left || keys.right;
        const forwardThrust = isMoving ? fish.accel : fish.accel * 0.4;

        fish.vx += Math.sin(fish.angleY) * forwardThrust;
        fish.vz += Math.cos(fish.angleY) * forwardThrust;
        fish.vy += Math.sin(fish.angleX) * forwardThrust;

        fish.vx *= fish.friction;
        fish.vy *= fish.friction;
        fish.vz *= fish.friction;

        fish.x += fish.vx;
        fish.y += fish.vy;
        fish.z += fish.vz;

        // BOUNDARY LIMITS (Clamped Y-axis so player fish remains above overlay controls)
        fish.x = Math.max(-oceanBounds.width / 2, Math.min(oceanBounds.width / 2, fish.x));
        fish.y = Math.max(-oceanBounds.height / 2 + 6, Math.min(oceanBounds.height / 2, fish.y));
        fish.z = Math.max(-oceanBounds.depth / 2, Math.min(oceanBounds.depth / 2, fish.z));

        if (playerFishMesh) {
            playerFishMesh.position.set(fish.x, fish.y, fish.z);
            playerFishMesh.rotation.y = fish.angleY;
            playerFishMesh.rotation.x = fish.angleX;
            playerFishMesh.children[3].rotation.y = Math.sin(Date.now() * 0.01) * 0.35;
        }

        if (camera) {
            const cameraDistance = 22;
            const cameraHeight = 8.5;
            const idealX = fish.x - Math.sin(fish.angleY) * cameraDistance;
            const idealZ = fish.z - Math.cos(fish.angleY) * cameraDistance;
            const idealY = fish.y + cameraHeight;

            camera.position.x += (idealX - camera.position.x) * 0.08;
            camera.position.y += (idealY - camera.position.y) * 0.08;
            camera.position.z += (idealZ - camera.position.z) * 0.08;

            cameraLookTarget.set(fish.x, fish.y + 1, fish.z);
            camera.lookAt(cameraLookTarget);
        }

        worms3D.forEach(worm => {
            if (!worm.eaten) {
                worm.mesh.rotation.y += 0.03;
                const dist = Math.hypot(fish.x - worm.x, fish.y - worm.y, fish.z - worm.z);

                if (dist < 3.8) {
                    worm.eaten = true;
                    if (scene) scene.remove(worm.mesh);
                    fishEnergy = Math.min(MAX_ENERGY, fishEnergy + 30);
                    updateEnergyGauge();
                }
            }
        });

        sharks3D.forEach(shark => {
            shark.x += shark.vx;
            shark.y += shark.vy;
            shark.z += shark.vz;

            if (Math.abs(shark.x) > oceanBounds.width / 2) { shark.vx *= -1; }
            if (Math.abs(shark.y) > oceanBounds.height / 2) { shark.vy *= -1; }
            if (Math.abs(shark.z) > oceanBounds.depth / 2) { shark.vz *= -1; }

            shark.angleY = Math.atan2(shark.vx, shark.vz);

            if (shark.mesh) {
                shark.mesh.position.set(shark.x, shark.y, shark.z);
                shark.mesh.rotation.y = shark.angleY;
                if (shark.mesh.children[7]) {
                    shark.mesh.children[7].rotation.y = Math.sin(Date.now() * 0.008) * 0.35;
                }
            }

            const distToShark = Math.hypot(fish.x - shark.x, fish.y - shark.y, fish.z - shark.z);
            if (distToShark < 4.8) {
                handleLifeLost("EATEN BY A SHARK!");
                return;
            }
        });

        seaweedClumps3D.forEach((clump, i) => {
            clump.children.forEach((blade, j) => {
                blade.rotation.z = Math.sin(Date.now() * 0.002 + i + j) * 0.15;
            });
        });

        if (bubbles3D) {
            const pos = bubbles3D.geometry.attributes.position.array;
            for (let i = 1; i < pos.length; i += 3) {
                pos[i] += 0.04;
                if (pos[i] > oceanBounds.height / 2) pos[i] = -oceanBounds.height / 2;
            }
            bubbles3D.geometry.attributes.position.needsUpdate = true;
        }
    }

    function gameLoop() {
        update();
        if (renderer && scene && camera) renderer.render(scene, camera);
        animFrameId = requestAnimationFrame(gameLoop);
    }

    function handleLifeLost(reason) {
        isGameOver = true;
        clearInterval(timerInterval);
        lives--;
        bottomTimeBox.classList.remove('urgent-warning');

        document.getElementById('game-over-reason').textContent = reason;
        modalLivesCount.textContent = lives;

        if (lives > 0) {
            btnRestartLevel.textContent = `RESTART LEVEL ${currentLevel}`;
        } else {
            btnRestartLevel.textContent = "RESTART GAME";
            currentLevel = 1;
            lives = 3;
        }

        gameOverScreen.classList.remove('hidden');
    }

    function triggerVictory() {
        isGameOver = true;
        clearInterval(timerInterval);
        victoryScreen.classList.remove('hidden');
        runFireworks();
    }

    function runFireworks() {
        const fwCanvas = document.getElementById('fireworks-canvas');
        const fwCtx = fwCanvas.getContext('2d');
        fwCanvas.width = window.innerWidth;
        fwCanvas.height = window.innerHeight;

        let particles = [];
        const colors = ['#00FFCC', '#00BFFF', '#FFD700', '#00FF00', '#FF4500'];

        for (let i = 0; i < 120; i++) {
            particles.push({
                x: fwCanvas.width / 2, y: fwCanvas.height / 2,
                vx: (Math.random() - 0.5) * 12, vy: (Math.random() - 0.5) * 12,
                color: colors[Math.floor(Math.random() * colors.length)],
                radius: Math.random() * 4 + 2, alpha: 1
            });
        }

        const startTime = Date.now();
        function animateFW() {
            const elapsed = Date.now() - startTime;
            fwCtx.clearRect(0, 0, fwCanvas.width, fwCanvas.height);

            particles.forEach(p => {
                p.x += p.vx; p.y += p.vy; p.alpha -= 0.01;
                fwCtx.globalAlpha = Math.max(0, p.alpha);
                fwCtx.fillStyle = p.color;
                fwCtx.beginPath(); fwCtx.arc(p.x, p.y, p.radius, 0, Math.PI * 2); fwCtx.fill();
            });

            if (elapsed < 3000) requestAnimationFrame(animateFW);
            else fwCtx.clearRect(0, 0, fwCanvas.width, fwCanvas.height);
        }
        animateFW();
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
