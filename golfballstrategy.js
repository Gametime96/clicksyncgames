/* Golf Ball Strategy 2026 - High Definition Glass Beaker Physics & Inertial Gliding */

document.addEventListener('DOMContentLoaded', () => {
    let scene, camera, renderer, world, physicsMaterial;
    let balls = [];
    let topFunnelGroup, topFunnelBody, bottomFunnelGroup, bottomFunnelBody;
    let oceanMesh, railMesh;

    // Game State
    let gameState = 'start'; 
    let currentLevel = 1;
    let totalLevels = 10;
    let timeRemaining = 30;
    let lastTimeUpdate = 0;

    let caughtBallsCount = 0;
    let requiredQuota = 3;
    let ballsRemainingInTop = 20;

    let gameTime = 0;
    let lastBallDropTime = 0;

    // INERTIAL GLIDING PHYSICS VARIABLES (TOP FUNNEL)
    let topPositionX = 0;
    let topVelocityX = 0;
    let inputAccelX = 0;
    const maxTopX = 9.5;
    const accelRate = 0.016;  // Smooth acceleration rate
    const frictionRate = 0.88; // Gliding friction coasting multiplier

    // DOM Elements
    const scoreEl = document.getElementById('score');
    const timeEl = document.getElementById('time-display');
    const roundEl = document.getElementById('round-display');
    const uiEl = document.getElementById('ui');
    const statusScreen = document.getElementById('status-screen');
    const statusTitle = document.getElementById('status-title');
    const statusDesc = document.getElementById('status-desc');

    const startBtn = document.getElementById('start-btn');
    const resumeBtn = document.getElementById('resume-btn');
    const pauseBtn = document.getElementById('pause-btn');
    const nextRoundBtn = document.getElementById('next-round-btn');
    const restartBtn = document.getElementById('restart-btn');

    // DYNAMIC HD COLOR SCHEMES FOR EACH LEVEL (Levels 1-10)
    const levelThemes = [
        { bg: 0x0a192f, ocean: 0x023e8a, glassTop: 0x00bfff, glassBottom: 0xffdd00, ball: 0xff8c00 },
        { bg: 0x112a15, ocean: 0x1b4332, glassTop: 0x52b788, glassBottom: 0xff9f1c, ball: 0xffffff },
        { bg: 0x2b0903, ocean: 0x4a1207, glassTop: 0xff5400, glassBottom: 0x00f5d4, ball: 0x9d4edd },
        { bg: 0x1d1128, ocean: 0x3c1642, glassTop: 0xf72585, glassBottom: 0x4cc9f0, ball: 0xccff00 },
        { bg: 0x020336, ocean: 0x0077b6, glassTop: 0x90e0ef, glassBottom: 0xffb703, ball: 0xef233c },
        { bg: 0x1a0601, ocean: 0x481203, glassTop: 0xf48c06, glassBottom: 0x3a86ff, ball: 0x06d6a0 },
        { bg: 0x0b001a, ocean: 0x240046, glassTop: 0x9d4edd, glassBottom: 0xffd166, ball: 0xff5400 },
        { bg: 0x001d3d, ocean: 0x003566, glassTop: 0xffc300, glassBottom: 0x00f5d4, ball: 0xffffff },
        { bg: 0x140424, ocean: 0x310852, glassTop: 0x00f5d4, glassBottom: 0xff007f, ball: 0xccff00 },
        { bg: 0x080808, ocean: 0x1f1f1f, glassTop: 0x00ff66, glassBottom: 0xff0033, ball: 0xff8c00 }
    ];

    // --- 1. INITIALIZE THREE.JS HD 3D SCENE & Perspective ---
    function init() {
        scene = new THREE.Scene();
        scene.background = new THREE.Color(levelThemes[0].bg);

        const width = window.innerWidth;
        const height = window.innerHeight;

        // DYNAMIC 3D ISOMETRIC PROFILE VIEW WITH DEPTH
        camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
        camera.position.set(0, 4.5, 24);
        camera.lookAt(0, 3.8, 0);

        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.1;
        document.body.appendChild(renderer.domElement);

        // Lighting Architecture
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
        scene.add(ambientLight);

        const mainLight = new THREE.DirectionalLight(0xffffff, 1.2);
        mainLight.position.set(12, 22, 18);
        mainLight.castShadow = true;
        mainLight.shadow.mapSize.width = 2048;
        mainLight.shadow.mapSize.height = 2048;
        scene.add(mainLight);

        const fillLight = new THREE.PointLight(0x00bfff, 0.8, 40);
        fillLight.position.set(-15, 10, 10);
        scene.add(fillLight);

        // Reflective Water Hazard Floor
        const oceanGeo = new THREE.PlaneGeometry(120, 100);
        const oceanMat = new THREE.MeshStandardMaterial({
            color: levelThemes[0].ocean,
            roughness: 0.1,
            metalness: 0.3
        });
        oceanMesh = new THREE.Mesh(oceanGeo, oceanMat);
        oceanMesh.rotation.x = -Math.PI / 2;
        oceanMesh.position.y = -6;
        oceanMesh.receiveShadow = true;
        scene.add(oceanMesh);

        // Overhead Chrome Rail System
        const railGeo = new THREE.CylinderGeometry(0.12, 0.12, 30, 16);
        const railMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.9, roughness: 0.1 });
        railMesh = new THREE.Mesh(railGeo, railMat);
        railMesh.rotation.z = Math.PI / 2;
        railMesh.position.set(0, 11.8, 0);
        scene.add(railMesh);

        initPhysics();
        setupInputs();
    }

    function initPhysics() {
        world = new CANNON.World();
        world.gravity.set(0, -9.82, 0);
        world.broadphase = new CANNON.NaiveBroadphase();
        world.solver.iterations = 10;

        physicsMaterial = new CANNON.Material("standard");
        const contactMaterial = new CANNON.ContactMaterial(
            physicsMaterial, physicsMaterial, { friction: 0.2, restitution: 0.4 }
        );
        world.addContactMaterial(contactMaterial);
    }

    // --- 2. BUILD TRANSPARENT GLASS BEAKER FUNNELS WITH OPTICAL REFRACTION ---
    function createGlassBeakerMesh(topRadius, bottomRadius, height, glassColorHex) {
        const group = new THREE.Group();

        // High-Definition Physical Glass Material
        const glassMat = new THREE.MeshPhysicalMaterial({
            color: glassColorHex,
            transparent: true,
            opacity: 0.35,
            roughness: 0.05,
            metalness: 0.1,
            transmission: 0.85,  // Optical refraction
            ior: 1.45,            // Index of Refraction for Glass
            side: THREE.DoubleSide
        });

        // Flared Beaker Conical Shell
        const glassGeo = new THREE.CylinderGeometry(topRadius, bottomRadius, height, 48, 1, true);
        const glassMesh = new THREE.Mesh(glassGeo, glassMat);
        glassMesh.castShadow = true;
        group.add(glassMesh);

        // Metallic Lip & Base Outlines
        const rimMat = new THREE.MeshStandardMaterial({
            color: glassColorHex,
            metalness: 0.8,
            roughness: 0.2
        });

        const topRimGeo = new THREE.TorusGeometry(topRadius, 0.14, 16, 48);
        const topRim = new THREE.Mesh(topRimGeo, rimMat);
        topRim.rotation.x = Math.PI / 2;
        topRim.position.y = height / 2;
        group.add(topRim);

        const bottomRimGeo = new THREE.TorusGeometry(bottomRadius, 0.14, 16, 48);
        const bottomRim = new THREE.Mesh(bottomRimGeo, rimMat);
        bottomRim.rotation.x = Math.PI / 2;
        bottomRim.position.y = -height / 2;
        group.add(bottomRim);

        return group;
    }

    // --- 3. BUILD LEVEL & SET THEME ---
    function buildLevel(level) {
        const theme = levelThemes[(level - 1) % levelThemes.length];
        
        scene.background.setHex(theme.bg);
        if (oceanMesh) oceanMesh.material.color.setHex(theme.ocean);

        // Clean Up Old Assemblies
        if (topFunnelGroup) scene.remove(topFunnelGroup);
        if (bottomFunnelGroup) scene.remove(bottomFunnelGroup);
        if (topFunnelBody) world.removeBody(topFunnelBody);
        if (bottomFunnelBody) world.removeBody(bottomFunnelBody);

        balls.forEach(b => { scene.remove(b.mesh); world.removeBody(b.body); });
        balls = [];

        // Reset Physics Dynamics
        topPositionX = 0;
        topVelocityX = 0;
        inputAccelX = 0;
        caughtBallsCount = 0;
        requiredQuota = level + 2; // Level 1 = 3, Level 2 = 4, etc.
        ballsRemainingInTop = 20;

        // TOP DISPENSER BEAKER (Wide Top, Narrow Intake)
        topFunnelGroup = createGlassBeakerMesh(2.8, 1.1, 3.4, theme.glassTop);
        
        // Add Mechanical Carriage Clamp to Top Beaker
        const clampGeo = new THREE.BoxGeometry(1.6, 0.4, 1.6);
        const clampMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.9, roughness: 0.2 });
        const clampMesh = new THREE.Mesh(clampGeo, clampMat);
        clampMesh.position.y = 2.0;
        topFunnelGroup.add(clampMesh);

        topFunnelGroup.position.set(0, 9.8, 0);
        scene.add(topFunnelGroup);

        topFunnelBody = new CANNON.Body({ mass: 0, material: physicsMaterial, type: CANNON.Body.KINEMATIC });
        topFunnelBody.position.set(0, 9.8, 0);
        world.addBody(topFunnelBody);

        // INVERTED BOTTOM TARGET BEAKER (Narrow Intake, Wide Solid Glass Base)
        bottomFunnelGroup = createGlassBeakerMesh(1.3, 3.2, 3.8, theme.glassBottom);
        
        // Solid Bottom Glass Collector Plate
        const basePlateGeo = new THREE.CylinderGeometry(3.2, 3.2, 0.4, 32);
        const basePlateMat = new THREE.MeshStandardMaterial({ color: theme.glassBottom, metalness: 0.4, roughness: 0.2 });
        const basePlate = new THREE.Mesh(basePlateGeo, basePlateMat);
        basePlate.position.y = -1.9;
        bottomFunnelGroup.add(basePlate);

        bottomFunnelGroup.position.set(0, -1.2, 0);
        scene.add(bottomFunnelGroup);

        bottomFunnelBody = new CANNON.Body({ mass: 0, material: physicsMaterial, type: CANNON.Body.KINEMATIC });
        bottomFunnelBody.position.set(0, -1.2, 0);
        world.addBody(bottomFunnelBody);

        updateHUD();
    }

    // --- 4. DROP GOLF BALL ---
    function dropGolfBall() {
        if (ballsRemainingInTop <= 0 || gameState !== 'playing') return;

        const theme = levelThemes[(currentLevel - 1) % levelThemes.length];
        
        const ballGeo = new THREE.SphereGeometry(0.38, 32, 32);
        const ballMat = new THREE.MeshStandardMaterial({
            color: theme.ball,
            roughness: 0.25,
            metalness: 0.1
        });
        const mesh = new THREE.Mesh(ballGeo, ballMat);
        mesh.castShadow = true;
        scene.add(mesh);

        const shape = new CANNON.Sphere(0.38);
        const body = new CANNON.Body({ mass: 1, material: physicsMaterial });
        body.addShape(shape);
        body.position.set(topFunnelGroup.position.x + (Math.random() - 0.5) * 0.3, 8.2, 0);
        
        world.addBody(body);
        balls.push({ mesh, body, caught: false });

        ballsRemainingInTop--;
    }

    // --- 5. INPUT ATTACHMENTS FOR SMOOTH GLIDING ---
    function setupInputs() {
        window.addEventListener('keydown', (e) => {
            if (e.key.toLowerCase() === 'p') togglePause();
            if (gameState !== 'playing') return;
            if (e.key === 'ArrowLeft') inputAccelX = -accelRate;
            if (e.key === 'ArrowRight') inputAccelX = accelRate;
        });

        window.addEventListener('keyup', (e) => {
            if (gameState !== 'playing') return;
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') inputAccelX = 0;
        });

        const bindTouch = (id, direction) => {
            const btn = document.getElementById(id);
            if (!btn) return;

            const start = (e) => {
                e.preventDefault();
                if (gameState === 'playing') inputAccelX = direction * accelRate;
                btn.classList.add('simulated-active');
            };
            const end = (e) => {
                e.preventDefault();
                if (gameState === 'playing') inputAccelX = 0;
                btn.classList.remove('simulated-active');
            };

            btn.addEventListener('touchstart', start, { passive: false });
            btn.addEventListener('touchend', end, { passive: false });
            btn.addEventListener('mousedown', start);
            btn.addEventListener('mouseup', end);
            btn.addEventListener('mouseleave', end);
        };

        bindTouch('btn-left', -1);
        bindTouch('btn-right', 1);

        window.addEventListener('resize', handleResize);
    }

    function handleResize() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
    }

    // --- 6. GAME FLOW CONTROL ---
    function startLevel(levelNum) {
        currentLevel = levelNum;
        timeRemaining = 30;
        gameTime = 0;
        lastBallDropTime = 0;

        roundEl.innerText = currentLevel;
        timeEl.innerText = timeRemaining;
        
        buildLevel(currentLevel);
        gameState = 'playing';
    }

    function updateHUD() {
        scoreEl.innerText = `${caughtBallsCount}/${requiredQuota}`;
    }

    function togglePause() {
        if (gameState === 'playing') {
            gameState = 'paused';
            statusTitle.innerText = "GAME PAUSED";
            statusTitle.style.color = "#00bfff";
            statusDesc.innerText = "Press 'P' or click Resume to continue.";
            resumeBtn.style.display = "inline-block";
            nextRoundBtn.style.display = "none";
            restartBtn.style.display = "none";
            statusScreen.style.display = 'flex';
            pauseBtn.innerText = 'RESUME (P)';
        } else if (gameState === 'paused') {
            gameState = 'playing';
            statusScreen.style.display = 'none';
            pauseBtn.innerText = 'PAUSE (P)';
            lastTimeUpdate = performance.now();
        }
    }

    function checkWinLoss() {
        if (caughtBallsCount >= requiredQuota) {
            gameState = 'transition';
            if (currentLevel >= totalLevels) {
                statusTitle.innerText = "YOU WON!";
                statusTitle.style.color = "#ffdd00";
                statusDesc.innerText = "You survived all 10 levels of Golf Ball Strategy!";
                resumeBtn.style.display = "none";
                nextRoundBtn.style.display = "none";
                restartBtn.style.display = "inline-block";
            } else {
                statusTitle.innerText = `LEVEL ${currentLevel} PASSED!`;
                statusTitle.style.color = "#00bfff";
                statusDesc.innerText = `Caught ${caughtBallsCount} golf balls! Ready for Level ${currentLevel + 1}?`;
                resumeBtn.style.display = "none";
                restartBtn.style.display = "none";
                nextRoundBtn.style.display = "inline-block";
            }
            statusScreen.style.display = 'flex';
            return;
        }

        const activeBallsInFlight = balls.filter(b => !b.caught && b.body.position.y > -5).length;
        if ((timeRemaining <= 0 || (ballsRemainingInTop === 0 && activeBallsInFlight === 0)) && caughtBallsCount < requiredQuota) {
            gameState = 'gameover';
            statusTitle.innerText = "LEVEL FAILED";
            statusTitle.style.color = "#d32f2f";
            statusDesc.innerText = `You needed ${requiredQuota} balls but only caught ${caughtBallsCount}.`;
            resumeBtn.style.display = "none";
            nextRoundBtn.style.display = "none";
            restartBtn.style.display = "inline-block";
            statusScreen.style.display = 'flex';
        }
    }

    // --- 7. MAIN ANIMATION LOOP WITH INERTIAL GLIDING & SINE INTERPOLATION ---
    function animate(time) {
        requestAnimationFrame(animate);

        if (gameState === 'playing') {
            if (lastTimeUpdate === 0) lastTimeUpdate = time;
            const dt = (time - lastTimeUpdate) / 1000;
            lastTimeUpdate = time;

            timeRemaining -= dt;
            if (timeRemaining < 0) timeRemaining = 0;
            timeEl.innerText = Math.ceil(timeRemaining);

            world.step(1 / 60);
            gameTime += 1 / 60;

            // AUTOMATIC BALL DROPPING INTERVAL (~1.1s)
            if (gameTime - lastBallDropTime >= 1.1 && ballsRemainingInTop > 0) {
                dropGolfBall();
                lastBallDropTime = gameTime;
            }

            // TOP FUNNEL INERTIAL GLIDING MOVEMENT (ACCELERATION + FRICTION)
            topVelocityX += inputAccelX;
            topVelocityX *= frictionRate; // Coasting deceleration
            topPositionX += topVelocityX;

            // Soft Bounding Box Boundaries
            if (topPositionX < -maxTopX) {
                topPositionX = -maxTopX;
                topVelocityX = 0;
            } else if (topPositionX > maxTopX) {
                topPositionX = maxTopX;
                topVelocityX = 0;
            }

            topFunnelGroup.position.x = topPositionX;
            topFunnelBody.position.x = topPositionX;

            // INVERTED BOTTOM FUNNEL DUAL-SINE WAVE SMOOTH GLIDE
            const speedFactor = 0.02 + (currentLevel * 0.007);
            const primaryWave = Math.sin(gameTime * speedFactor * 60 * 0.04) * (6.5 + Math.min(currentLevel * 0.25, 2.5));
            const secondarySway = Math.sin(gameTime * 0.08) * 0.8; // Organic fluid offset
            const bottomX = primaryWave + secondarySway;

            bottomFunnelGroup.position.x = bottomX;
            bottomFunnelBody.position.x = bottomX;

            // BALL CATCH & FALL DETECTION
            for (let i = balls.length - 1; i >= 0; i--) {
                const b = balls[i];
                b.mesh.position.copy(b.body.position);
                b.mesh.rotation.copy(b.body.quaternion);

                // Catch Detection inside Bottom Beakers Intake
                if (!b.caught) {
                    const distToBottomCenterX = Math.abs(b.body.position.x - bottomFunnelGroup.position.x);
                    const distToBottomCenterZ = Math.abs(b.body.position.z - bottomFunnelGroup.position.z);

                    if (distToBottomCenterX < 1.4 && distToBottomCenterZ < 1.4 && b.body.position.y <= 0.8 && b.body.position.y >= -2.0) {
                        b.caught = true;
                        caughtBallsCount++;
                        updateHUD();
                        scene.remove(b.mesh);
                        world.removeBody(b.body);
                        balls.splice(i, 1);
                        continue;
                    }
                }

                // Water Hazard Collision Cleanup
                if (b.body.position.y < -5.5) {
                    scene.remove(b.mesh);
                    world.removeBody(b.body);
                    balls.splice(i, 1);
                }
            }

            checkWinLoss();
        } else {
            lastTimeUpdate = time;
        }

        renderer.render(scene, camera);
    }

    // --- 8. BUTTON EVENT ATTACHMENTS ---
    startBtn.addEventListener('click', () => {
        document.getElementById('start-screen').style.display = 'none';
        uiEl.style.display = 'flex';
        startLevel(1);
    });

    resumeBtn.addEventListener('click', togglePause);
    pauseBtn.addEventListener('click', togglePause);
    
    nextRoundBtn.addEventListener('click', () => {
        statusScreen.style.display = 'none';
        startLevel(currentLevel + 1);
    });

    restartBtn.addEventListener('click', () => {
        statusScreen.style.display = 'none';
        startLevel(1);
    });

    document.querySelectorAll('.btn-top-nav').forEach(btn => {
        btn.addEventListener('click', () => {
            window.location.href = "https://clicksyncgames.com";
        });
    });

    init();
    requestAnimationFrame(animate);
});
