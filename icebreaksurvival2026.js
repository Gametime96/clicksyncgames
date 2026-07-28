/* Icebreak Survival 2026 - Optimized Collision Engine & Glitch-Free Reset */

document.addEventListener('DOMContentLoaded', () => {
    let scene, camera, renderer;
    let suvMesh, iceMesh, waterMesh, forestGroup, shoreMesh;
    let coins3D = [], activeCracks = [], holes3D = [], ramps3D = [], speedPads3D = [], snowmen3D = [], snowParticles3D = [];

    const introScreen = document.getElementById('intro-screen');
    const introTitle = document.getElementById('intro-title');
    const introLogo = document.getElementById('intro-logo');
    const instructionsScreen = document.getElementById('instructions-screen');
    const selectScreen = document.getElementById('select-screen');
    const pauseScreen = document.getElementById('pause-screen');
    const gameOverScreen = document.getElementById('game-over-screen');
    const victoryScreen = document.getElementById('victory-screen');
    const levelIntroScreen = document.getElementById('level-intro-screen');
    const levelIntroText = document.getElementById('level-intro-text');

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

    let speedBoostTimer = 0;
    const BOOST_DURATION = 180;

    let lakeLength = 160; 
    const lakeWidth = 120;  
    const keys = { up: false, down: false, left: false, right: false };

    const suv = {
        x: 0,
        z: -lakeLength / 2 + 10,
        y: 0,
        vx: 0,
        vz: 0,
        angle: 0,
        sinking: false,
        sinkScale: 1
    };

    let cameraLookTarget = new THREE.Vector3();

    // --- 1. THREE.JS VIEWPORT INITIALIZATION ---
    function init3D() {
        const container = document.getElementById('webgl-container');
        if (renderer) return;

        scene = new THREE.Scene();
        scene.background = new THREE.Color(0xb0e0e6);

        camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 1000);
        camera.position.set(0, 7, -15);

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

    // --- 2. BUILD SUV MESH ---
    function create3DSUVMesh(colorHex) {
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

    // --- 3. PURE WHITE SNOWMAN WITH BLACK BODY OUTLINE ---
    function create3DSnowmanMesh() {
        const snowman = new THREE.Group();
        const snowMat = new THREE.MeshStandardMaterial({ color: 0xFFFFFF, roughness: 0.4 }); // Pure White
        const outlineMat = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide });

        const createOutlinedSphere = (radius, yPos) => {
            const ballGroup = new THREE.Group();
            const sphere = new THREE.Mesh(new THREE.SphereGeometry(radius, 16, 16), snowMat);
            ballGroup.add(sphere);

            // Black Outer Shell Outline
            const outline = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.04, 16, 16), outlineMat);
            ballGroup.add(outline);

            ballGroup.position.y = yPos;
            return ballGroup;
        };

        snowman.add(createOutlinedSphere(1.6, 1.3));
        snowman.add(createOutlinedSphere(1.1, 3.3));
        snowman.add(createOutlinedSphere(0.7, 4.7));

        // Carrot Nose
        const noseMat = new THREE.MeshBasicMaterial({ color: 0xFF6F00 });
        const nose = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.8, 8), noseMat);
        nose.rotation.x = Math.PI / 2;
        nose.position.set(0, 4.7, 0.9);
        snowman.add(nose);

        // Branch Arms
        const armMat = new THREE.MeshStandardMaterial({ color: 0x5D4037, roughness: 0.9 });
        const leftArm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.8, 8), armMat);
        leftArm.rotation.z = Math.PI / 3;
        leftArm.position.set(-1.4, 3.4, 0);
        snowman.add(leftArm);

        const rightArm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.8, 8), armMat);
        rightArm.rotation.z = -Math.PI / 3;
        rightArm.position.set(1.4, 3.4, 0);
        snowman.add(rightArm);

        // Top Hat
        const hatMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3 });
        const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.08, 16), hatMat);
        brim.position.y = 5.35;
        snowman.add(brim);

        const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.8, 16), hatMat);
        crown.position.y = 5.75;
        snowman.add(crown);

        return snowman;
    }

    // --- 4. SOLID GREEN RAMP & RED SPEED STRIPS ---
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

        const arrowShape = new THREE.Shape();
        arrowShape.moveTo(-width * 0.3, -depth * 0.1);
        arrowShape.lineTo(0, depth * 0.12);
        arrowShape.lineTo(width * 0.3, -depth * 0.1);
        arrowShape.lineTo(0, depth * 0.02);
        arrowShape.closePath();

        const arrowGeo = new THREE.ShapeGeometry(arrowShape);
        const arrowMat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF, side: THREE.DoubleSide });

        const zOffsets = [-depth * 0.28, 0, depth * 0.28];
        zOffsets.forEach(offsetZ => {
            const arrowMesh = new THREE.Mesh(arrowGeo, arrowMat);
            arrowMesh.rotation.x = -Math.PI / 2;
            arrowMesh.position.set(0, 0.02, offsetZ);
            padGroup.add(arrowMesh);
        });

        return padGroup;
    }

    // --- 5. 3D CAR SELECTION PREVIEWS ---
    function setup3DVehiclePreviews() {
        const cards = document.querySelectorAll('.car-card');
        cards.forEach(card => {
            const container = card.querySelector('.car-preview-box');
            if (container.children.length > 0) return;

            const colorHex = parseInt(card.getAttribute('data-hex'), 16);

            const pScene = new THREE.Scene();
            const pCam = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100);
            pCam.position.set(4, 3, 5);
            pCam.lookAt(0, 0.8, 0);

            const pRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
            pRenderer.setSize(container.clientWidth, container.clientHeight);
            container.appendChild(pRenderer.domElement);

            const pLight = new THREE.DirectionalLight(0xffffff, 1.2);
            pLight.position.set(5, 10, 5);
            pScene.add(pLight);
            pScene.add(new THREE.AmbientLight(0xffffff, 0.7));

            const previewSUV = create3DSUVMesh(colorHex);
            pScene.add(previewSUV);

            function animatePreview() {
                previewSUV.rotation.y += 0.015;
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

                    if (suvMesh) scene.remove(suvMesh);
                    suvMesh = create3DSUVMesh(vehicleColorHex);
                    scene.add(suvMesh);

                    isTransitioning = false;
                    startLevelWithIntro(1);
                    if (!animFrameId) animFrameId = requestAnimationFrame(gameLoop);
                }, 1200);
            });
        });
    }

    // --- 6. GLITCH-FREE LEVEL INTRO RESET ---
    function startLevelWithIntro(levelNum) {
        currentLevel = levelNum;
        isTransitioning = true;
        isPaused = true;
        isGameOver = false;
        speedBoostTimer = 0;

        levelIntroText.textContent = `LEVEL ${currentLevel}`;
        levelIntroScreen.classList.remove('hidden');

        // Reset SUV State
        suv.x = 0;
        suv.z = -lakeLength / 2 + 10;
        suv.y = 0;
        suv.vx = 0;
        suv.vz = 0;
        suv.angle = 0; 
        suv.sinking = false;
        suv.sinkScale = 1;

        if (suvMesh) {
            suvMesh.position.set(suv.x, 0, suv.z);
            suvMesh.rotation.y = 0;
            suvMesh.scale.set(1, 1, 1);
        }

        camera.position.set(0, 7, suv.z - 12);
        cameraLookTarget.set(0, 1.2, suv.z + 5);
        camera.lookAt(cameraLookTarget);

        build3DLevel(currentLevel);

        setTimeout(() => {
            levelIntroScreen.classList.add('hidden');
            isTransitioning = false;
            isPaused = false;
            timeRemaining = calculateLevelTime(currentLevel);
            updateHUD();
            startTimer();
        }, 2000);
    }

    // --- 7. LAND & SHORE SAFETY CHECKS (NO CRACKS/HOLES NEAR LAND) ---
    function isNearLand(x, z) {
        if (currentLevel % 2 === 0) return false; // Even levels have no land!

        // Shore radius threshold (5% margin beyond ice perimeter)
        const iceRadiusX = (lakeWidth / 2) * 0.95;
        const iceRadiusZ = (lakeLength / 2) * 0.95;

        return (Math.abs(x) >= iceRadiusX || Math.abs(z) >= iceRadiusZ);
    }

    // --- 8. LEVEL BUILDER ---
    function build3DLevel(level) {
        lakeLength = 160 + (level - 1) * 40;
        const isOddLevel = level % 2 !== 0;

        if (iceMesh) scene.remove(iceMesh);
        if (waterMesh) scene.remove(waterMesh);
        if (shoreMesh) scene.remove(shoreMesh);

        if (isOddLevel) {
            scene.background = new THREE.Color(0xb0e0e6);
            scene.fog = new THREE.Fog(0xb0e0e6, 60, 220);

            const waterGeo = new THREE.PlaneGeometry(lakeWidth + 160, lakeLength + 160);
            const waterMat = new THREE.MeshBasicMaterial({ color: 0x0a1d30 });
            waterMesh = new THREE.Mesh(waterGeo, waterMat);
            waterMesh.rotation.x = -Math.PI / 2;
            waterMesh.position.y = -0.2;
            scene.add(waterMesh);

            const shoreShape = new THREE.Shape();
            const wHalf = lakeWidth / 2 + 45;
            const lHalf = lakeLength / 2 + 45;

            shoreShape.moveTo(-wHalf, -lHalf);
            shoreShape.lineTo(wHalf, -lHalf);
            shoreShape.lineTo(wHalf, lHalf);
            shoreShape.lineTo(-wHalf, lHalf);
            shoreShape.closePath();

            const innerHole = new THREE.Path();
            const steps = 60;
            for (let i = 0; i <= steps; i++) {
                const angle = (i / steps) * Math.PI * 2;
                const radiusX = lakeWidth / 2 + Math.sin(angle * 3) * 6;
                const radiusZ = lakeLength / 2 + Math.cos(angle * 2) * 8;
                const px = Math.cos(angle) * radiusX;
                const pz = Math.sin(angle) * radiusZ;
                if (i === 0) innerHole.moveTo(px, pz);
                else innerHole.lineTo(px, pz);
            }
            shoreShape.holes.push(innerHole);

            const shoreGeo = new THREE.ShapeGeometry(shoreShape);
            const shoreMat = new THREE.MeshStandardMaterial({ color: 0x1b3b18, roughness: 0.9 });
            shoreMesh = new THREE.Mesh(shoreGeo, shoreMat);
            shoreMesh.rotation.x = -Math.PI / 2;
            shoreMesh.position.y = 0.01;
            scene.add(shoreMesh);

            const iceShape = new THREE.Shape();
            for (let i = 0; i <= steps; i++) {
                const angle = (i / steps) * Math.PI * 2;
                const radiusX = lakeWidth / 2 + Math.sin(angle * 3) * 6;
                const radiusZ = lakeLength / 2 + Math.cos(angle * 2) * 8;
                const px = Math.cos(angle) * radiusX;
                const pz = Math.sin(angle) * radiusZ;
                if (i === 0) iceShape.moveTo(px, pz);
                else iceShape.lineTo(px, pz);
            }
            const iceGeo = new THREE.ShapeGeometry(iceShape);
            const iceMat = new THREE.MeshStandardMaterial({ color: 0xe0f7fa, roughness: 0.1, metalness: 0.05 });
            iceMesh = new THREE.Mesh(iceGeo, iceMat);
            iceMesh.rotation.x = -Math.PI / 2;
            iceMesh.position.y = 0;
            iceMesh.receiveShadow = true;
            scene.add(iceMesh);

            buildOrganicTrees(lakeLength, lakeWidth);
        } else {
            scene.background = new THREE.Color(0x80deea);
            scene.fog = new THREE.Fog(0x80deea, 80, 300);
            clearForest();

            const infiniteIceGeo = new THREE.PlaneGeometry(800, 800);
            const iceMat = new THREE.MeshStandardMaterial({ color: 0xcaf0f8, roughness: 0.08, metalness: 0.05 });
            iceMesh = new THREE.Mesh(infiniteIceGeo, iceMat);
            iceMesh.rotation.x = -Math.PI / 2;
            iceMesh.position.y = 0;
            iceMesh.receiveShadow = true;
            scene.add(iceMesh);
        }

        // Reset Objects
        coins3D.forEach(c => scene.remove(c.group));
        coins3D = [];
        ramps3D.forEach(r => r.mesh && scene.remove(r.mesh));
        ramps3D = [];
        speedPads3D.forEach(sp => scene.remove(sp.mesh));
        speedPads3D = [];
        snowmen3D.forEach(sm => scene.remove(sm.mesh));
        snowmen3D = [];
        snowParticles3D.forEach(sp => scene.remove(sp.mesh));
        snowParticles3D = [];

        requiredCoins = level * 2;
        scoreCoins = 0;

        const hasRampCoin = level >= 3;
        const rampHeight = hasRampCoin ? 2.0 + (level - 3) * 1.2 : 0;
        const rampDepth = 14;
        const rampWidth = 8;

        const minX = -lakeWidth * 0.38;
        const maxX = lakeWidth * 0.38;
        const minZ = -lakeLength * 0.38;
        const maxZ = lakeLength * 0.38;

        if (level >= 3) {
            const padCount = 2 + (level - 3);
            let attempts = 0;
            while (speedPads3D.length < padCount && attempts < 100) {
                attempts++;
                const padX = minX + Math.random() * (maxX - minX);
                const padZ = minZ + Math.random() * (maxZ - minZ);

                if (speedPads3D.some(sp => Math.hypot(padX - sp.x, padZ - sp.z) < 25)) continue;

                const stripMesh = createRedSpeedStripMesh(6, 10);
                stripMesh.position.set(padX, 0.03, padZ);
                scene.add(stripMesh);

                speedPads3D.push({ mesh: stripMesh, x: padX, z: padZ, width: 6, depth: 10 });
            }
        }

        for (let i = 0; i < requiredCoins; i++) {
            const coinGroup = new THREE.Group();

            const coinGeo = new THREE.CylinderGeometry(1.5, 1.5, 0.3, 24);
            const coinMat = new THREE.MeshStandardMaterial({ color: 0xFFDD00, emissive: 0xFFAA00, emissiveIntensity: 0.5 });
            const coinMesh = new THREE.Mesh(coinGeo, coinMat);
            coinMesh.rotation.x = Math.PI / 2;
            coinGroup.add(coinMesh);

            const rimGeo = new THREE.TorusGeometry(1.52, 0.05, 12, 32);
            const rimMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
            coinGroup.add(new THREE.Mesh(rimGeo, rimMat));

            const auraGeo = new THREE.SphereGeometry(2.6, 24, 24);
            const auraMat = new THREE.MeshBasicMaterial({ color: 0xFFFF55, transparent: true, opacity: 0.25, wireframe: true });
            const auraMesh = new THREE.Mesh(auraGeo, auraMat);
            coinGroup.add(auraMesh);

            let xPos = 0, zPos = 0, coinYPos = 1.8;

            if (i === 0 && hasRampCoin) {
                xPos = (Math.random() - 0.5) * (lakeWidth - 40);
                zPos = -lakeLength / 2 + 50;

                const solidRampMesh = createSolidGreenRampMesh(rampWidth, rampHeight, rampDepth);
                solidRampMesh.position.set(xPos, 0, zPos - rampDepth / 2);
                scene.add(solidRampMesh);

                ramps3D.push({ 
                    mesh: solidRampMesh, 
                    x: xPos, 
                    z: zPos, 
                    width: rampWidth, 
                    depth: rampDepth, 
                    height: rampHeight,
                    graceRadius: 15.0 
                });

                zPos = zPos + rampDepth * 0.32; 
                coinYPos = rampHeight * 0.85 + 1.8; 
            } else {
                let validPos = false;
                let cAttempts = 0;
                while (!validPos && cAttempts < 50) {
                    cAttempts++;
                    xPos = (Math.random() - 0.5) * (lakeWidth - 30);
                    zPos = -lakeLength / 2 + 30 + (i * ((lakeLength - 50) / requiredCoins));
                    if (!speedPads3D.some(sp => Math.hypot(xPos - sp.x, zPos - sp.z) < 14)) validPos = true;
                }
            }

            coinGroup.position.set(xPos, coinYPos, zPos);
            scene.add(coinGroup);

            coins3D.push({ group: coinGroup, coinMesh: coinMesh, auraMesh: auraMesh, collected: false, x: xPos, y: coinYPos, z: zPos });
        }

        if (level >= 4) {
            const snowmanCount = 3 + (level - 4) * 2;
            let smAttempts = 0;

            while (snowmen3D.length < snowmanCount && smAttempts < 100) {
                smAttempts++;
                const smX = (Math.random() - 0.5) * (lakeWidth - 30);
                const smZ = -lakeLength / 2 + 35 + Math.random() * (lakeLength - 50);

                const nearCoin = coins3D.some(c => Math.hypot(smX - c.x, smZ - c.z) < 12);
                const nearRamp = ramps3D.some(r => Math.hypot(smX - r.x, smZ - r.z) < 18);
                const nearStrip = speedPads3D.some(sp => Math.hypot(smX - sp.x, smZ - sp.z) < 14);

                if (nearCoin || nearRamp || nearStrip) continue;

                const smMesh = create3DSnowmanMesh();
                smMesh.position.set(smX, 0, smZ);
                scene.add(smMesh);

                snowmen3D.push({ mesh: smMesh, x: smX, z: smZ, active: true });
            }
        }

        activeCracks.forEach(c => scene.remove(c.mesh));
        activeCracks = [];
        holes3D.forEach(h => scene.remove(h.mesh));
        holes3D = [];
    }

    function buildOrganicTrees(length, width) {
        clearForest();
        const treeGeo = new THREE.ConeGeometry(3, 9, 6);
        const treeMat = new THREE.MeshStandardMaterial({ color: 0x1b3b18 });

        const steps = 40;
        for (let i = 0; i < steps; i++) {
            const angle = (i / steps) * Math.PI * 2;
            const radiusX = width / 2 + 18 + Math.sin(angle * 4) * 12;
            const radiusZ = length / 2 + 18 + Math.cos(angle * 3) * 12;
            
            const tree = new THREE.Mesh(treeGeo, treeMat);
            tree.position.set(Math.cos(angle) * radiusX, 4.5, Math.sin(angle) * radiusZ);
            forestGroup.add(tree);
        }
    }

    function clearForest() {
        while (forestGroup.children.length > 0) forestGroup.remove(forestGroup.children[0]);
    }

    // --- 9. TELEGRAPHED CRACKS (WITH LAND/SHORE BUFFER) ---
    function spawnTelegraphedCrack(x, z) {
        // LAND SAFETY BUFFER: NO cracks near land or shorelines!
        if (isNearLand(x, z)) return;

        // RAMP GRACE AREA CHECK
        const insideRampGraceArea = ramps3D.some(r => Math.hypot(x - r.x, z - r.z) < r.graceRadius);
        if (insideRampGraceArea) return;

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
        scene.add(crackGroup);

        activeCracks.push({ mesh: crackGroup, x: x, z: z, timer: 0, maxTimer: 90 });
    }

    function triggerSnowPowderBurst(x, z) {
        const particleCount = 25;
        const partGeo = new THREE.SphereGeometry(0.25, 8, 8);
        const partMat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.9 });

        for (let i = 0; i < particleCount; i++) {
            const pMesh = new THREE.Mesh(partGeo, partMat);
            pMesh.position.set(x + (Math.random() - 0.5) * 2, 1.5 + Math.random() * 2, z + (Math.random() - 0.5) * 2);
            scene.add(pMesh);

            snowParticles3D.push({
                mesh: pMesh,
                vx: (Math.random() - 0.5) * 0.4,
                vy: Math.random() * 0.3 + 0.1,
                vz: (Math.random() - 0.5) * 0.4,
                life: 30
            });
        }
    }

    // --- 10. GAME CONTROLS & TIMERS ---
    function startIntro() {
        introTitle.classList.remove('hidden');
        setTimeout(() => introLogo.classList.remove('hidden'), 1500);
        setTimeout(() => {
            introScreen.classList.add('hidden');
            instructionsScreen.classList.remove('hidden');
        }, 5000);
    }

    function calculateLevelTime(level) {
        if (level === 1) return 30;
        let baseTime = 30;
        for (let l = 2; l <= level; l++) baseTime *= 1.2;
        return Math.ceil(baseTime / 5) * 5;
    }

    function startTimer() {
        clearInterval(timerInterval);
        timerInterval = setInterval(() => {
            if (isGameOver || isPaused) return;
            timeRemaining--;
            hudTime.textContent = timeRemaining;

            if (timeRemaining <= 10) {
                bottomTimeBox.classList.add('urgent-warning');
            } else {
                bottomTimeBox.classList.remove('urgent-warning');
            }

            if (timeRemaining <= 0) {
                handleLifeLost();
            }
        }, 1000);
    }

    function updateHUD() {
        hudTime.textContent = timeRemaining;
        hudCoins.textContent = `${scoreCoins}/${requiredCoins}`;

        if (timeRemaining <= 10 && timeRemaining > 0) {
            bottomTimeBox.classList.add('urgent-warning');
        } else {
            bottomTimeBox.classList.remove('urgent-warning');
        }
    }

    function togglePause() {
        if (isGameOver || isTransitioning) return;
        isPaused = !isPaused;
        if (isPaused) {
            pauseScreen.classList.remove('hidden');
        } else {
            pauseScreen.classList.add('hidden');
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

    // --- 11. GAME LOOP ---
    function update() {
        if (isGameOver || isPaused) return;

        if (suv.sinking) {
            suv.sinkScale -= 0.025;
            suvMesh.scale.set(suv.sinkScale, suv.sinkScale, suv.sinkScale);
            suvMesh.position.y -= 0.04;
            if (suv.sinkScale <= 0) {
                handleLifeLost();
            }
            return;
        }

        let currentMaxAccel = 0.03;
        if (speedBoostTimer > 0) {
            speedBoostTimer--;
            currentMaxAccel = 0.042;
        }

        if (keys.up) {
            suv.vx += Math.sin(suv.angle) * currentMaxAccel;
            suv.vz += Math.cos(suv.angle) * currentMaxAccel;
        }
        if (keys.down) {
            suv.vx -= Math.sin(suv.angle) * 0.015;
            suv.vz -= Math.cos(suv.angle) * 0.015;
        }
        if (keys.left) suv.angle += 0.032;
        if (keys.right) suv.angle -= 0.032;

        suv.vx *= 0.94;
        suv.vz *= 0.94;
        suv.x += suv.vx;
        suv.z += suv.vz;

        // Ramp Height
        let currentY = 0;
        ramps3D.forEach(r => {
            const relZ = suv.z - (r.z - r.depth / 2);
            if (Math.abs(suv.x - r.x) < r.width / 2 && relZ >= 0 && relZ <= r.depth) {
                const ratio = relZ / r.depth;
                currentY = ratio * r.height;
            }
        });
        suv.y += (currentY - suv.y) * 0.25;

        // Speed Pad Collision
        speedPads3D.forEach(sp => {
            if (Math.abs(suv.x - sp.x) < sp.width / 2 && Math.abs(suv.z - sp.z) < sp.depth / 2) {
                speedBoostTimer = BOOST_DURATION;
            }
        });

        // Snowman Demolition
        snowmen3D.forEach(sm => {
            if (sm.active && Math.hypot(suv.x - sm.x, suv.z - sm.z) < 2.5) {
                sm.active = false;
                scene.remove(sm.mesh);
                triggerSnowPowderBurst(sm.x, sm.z);
            }
        });

        // Particles Animation
        for (let i = snowParticles3D.length - 1; i >= 0; i--) {
            const p = snowParticles3D[i];
            p.mesh.position.x += p.vx;
            p.mesh.position.y += p.vy;
            p.mesh.position.z += p.vz;
            p.life--;
            p.mesh.material.opacity = p.life / 30;

            if (p.life <= 0) {
                scene.remove(p.mesh);
                snowParticles3D.splice(i, 1);
            }
        }

        const xLimit = lakeWidth / 2 - 4;
        if (suv.x < -xLimit) suv.x = -xLimit;
        if (suv.x > xLimit) suv.x = xLimit;
        if (suv.z < -lakeLength / 2 + 5) suv.z = -lakeLength / 2 + 5;

        if (suvMesh) {
            suvMesh.position.set(suv.x, suv.y, suv.z);
            suvMesh.rotation.y = suv.angle;
        }

        // Camera Follow
        const distanceBehind = 12;
        const cameraHeight = 6;

        const idealX = suv.x - Math.sin(suv.angle) * distanceBehind;
        const idealZ = suv.z - Math.cos(suv.angle) * distanceBehind;
        const idealY = suv.y + cameraHeight;

        camera.position.x += (idealX - camera.position.x) * 0.05;
        camera.position.y += (idealY - camera.position.y) * 0.05;
        camera.position.z += (idealZ - camera.position.z) * 0.05;

        const targetLookX = suv.x + Math.sin(suv.angle) * 3;
        const targetLookZ = suv.z + Math.cos(suv.angle) * 3;
        cameraLookTarget.x += (targetLookX - cameraLookTarget.x) * 0.06;
        cameraLookTarget.y = suv.y + 1.2;
        cameraLookTarget.z += (targetLookZ - cameraLookTarget.z) * 0.06;

        camera.lookAt(cameraLookTarget);

        // Cracks & Holes
        const speed = Math.hypot(suv.vx, suv.vz);
        if (Math.random() < (0.003 * currentLevel + (speed > 0.2 ? 0.004 : 0)) && suv.z > -lakeLength / 2 + 15) {
            if (!activeCracks.some(c => Math.hypot(suv.x - c.x, suv.z - c.z) < 6)) {
                spawnTelegraphedCrack(suv.x, suv.z);
            }
        }

        for (let i = activeCracks.length - 1; i >= 0; i--) {
            const crack = activeCracks[i];
            crack.timer++;

            crack.mesh.children.forEach(line => {
                line.material.opacity = (crack.timer % 10 < 5) ? 0.4 : 1.0;
                line.material.transparent = true;
            });

            if (crack.timer >= crack.maxTimer) {
                scene.remove(crack.mesh);

                const insideRampGrace = ramps3D.some(r => Math.hypot(crack.x - r.x, crack.z - r.z) < r.graceRadius);
                const nearLand = isNearLand(crack.x, crack.z);

                if (!insideRampGrace && !nearLand) {
                    const holeGeo = new THREE.CylinderGeometry(2.8, 2.8, 0.2, 16);
                    const holeMat = new THREE.MeshBasicMaterial({ color: 0x0a1d30 });
                    const holeMesh = new THREE.Mesh(holeGeo, holeMat);
                    holeMesh.position.set(crack.x, 0.02, crack.z);
                    scene.add(holeMesh);

                    holes3D.push({ mesh: holeMesh, x: crack.x, z: crack.z, radius: 2.8 });
                }

                activeCracks.splice(i, 1);
            }
        }

        for (let hole of holes3D) {
            if (Math.hypot(suv.x - hole.x, suv.z - hole.z) < hole.radius - 0.4) {
                suv.sinking = true;
                break;
            }
        }

        // Coin Collection
        coins3D.forEach(coin => {
            if (!coin.collected) {
                coin.coinMesh.rotation.z += 0.04;
                coin.auraMesh.rotation.y += 0.02;

                const dist = Math.hypot(suv.x - coin.x, suv.z - coin.z);
                const yDist = Math.abs(suv.y + 1.2 - coin.y);

                if (dist < 3.2 && yDist < 2.5) {
                    coin.collected = true;
                    scene.remove(coin.group);
                    scoreCoins++;
                    updateHUD();

                    if (scoreCoins >= requiredCoins) {
                        if (currentLevel < 8) {
                            startLevelWithIntro(currentLevel + 1);
                        } else {
                            triggerVictory();
                        }
                    }
                }
            }
        });

        // Ice Gauge Needle
        const progressRatio = Math.max(0.05, 1 - (currentLevel - 1) * 0.1 - ((suv.z + lakeLength / 2) / lakeLength));
        gaugeDial.style.bottom = `${15 + progressRatio * 125}px`;
    }

    function gameLoop() {
        update();
        if (renderer && scene && camera) renderer.render(scene, camera);
        animFrameId = requestAnimationFrame(gameLoop);
    }

    // --- 12. CLEAN "LEVEL FAILED" SCREEN (NO EXPLANATION TEXT) ---
    function handleLifeLost() {
        isGameOver = true;
        clearInterval(timerInterval);
        lives--;
        
        bottomTimeBox.classList.remove('urgent-warning');
        updateHUD();

        document.getElementById('game-over-title').textContent = "LEVEL FAILED";
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
        bottomTimeBox.classList.remove('urgent-warning');
        victoryScreen.classList.remove('hidden');
        runFireworks();
    }

    function runFireworks() {
        const fwCanvas = document.getElementById('fireworks-canvas');
        const fwCtx = fwCanvas.getContext('2d');
        fwCanvas.width = window.innerWidth;
        fwCanvas.height = window.innerHeight;

        let particles = [];
        const colors = ['#FF1493', '#00BFFF', '#FFD700', '#00FF00', '#FF4500'];

        for (let i = 0; i < 120; i++) {
            particles.push({
                x: fwCanvas.width / 2,
                y: fwCanvas.height / 2,
                vx: (Math.random() - 0.5) * 12,
                vy: (Math.random() - 0.5) * 12,
                color: colors[Math.floor(Math.random() * colors.length)],
                radius: Math.random() * 4 + 2,
                alpha: 1
            });
        }

        const startTime = Date.now();
        function animateFW() {
            const elapsed = Date.now() - startTime;
            fwCtx.clearRect(0, 0, fwCanvas.width, fwCanvas.height);

            particles.forEach(p => {
                p.x += p.vx;
                p.y += p.vy;
                p.alpha -= 0.01;
                fwCtx.globalAlpha = Math.max(0, p.alpha);
                fwCtx.fillStyle = p.color;
                fwCtx.beginPath();
                fwCtx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                fwCtx.fill();
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
