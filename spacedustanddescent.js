// --- Space Dust and Descent (8 Levels with 3D Astronaut Avatar) ---

let scene, camera, renderer;
let originPlanetMesh, targetPlanetMesh, starField, dustParticles;
let astronautGroup, thrusterLeftFire, thrusterRightFire;
let rings = [];
let terrainRocks = [];

// 8 Defined Levels
const LEVELS = [
    {
        level: 1,
        title: "Earth to Moon",
        originColor: 0x1a53ff,
        originName: "Earth",
        targetColor: 0xaaaaaa,
        targetName: "Moon",
        targetRoughness: 0.9,
        surfaceType: "moon",
        distance: 3000,
        ringCount: 5,
        fogColor: 0x000208
    },
    {
        level: 2,
        title: "Moon to Mars",
        originColor: 0x888888,
        originName: "Moon",
        targetColor: 0xc4411b, // Red Martian surface
        targetName: "Mars",
        targetRoughness: 0.8,
        surfaceType: "mars",
        distance: 3600,
        ringCount: 6,
        fogColor: 0x120202
    },
    {
        level: 3,
        title: "Mars to Phobos",
        originColor: 0xbd3c15,
        originName: "Mars",
        targetColor: 0x6e635b,
        targetName: "Phobos",
        targetRoughness: 1.0,
        surfaceType: "asteroid",
        distance: 3800,
        ringCount: 6,
        fogColor: 0x080404
    },
    {
        level: 4,
        title: "Phobos to Europa (Jupiter)",
        originColor: 0x6e635b,
        originName: "Phobos",
        targetColor: 0xd4cbb8,
        targetName: "Europa",
        targetRoughness: 0.3,
        surfaceType: "ice",
        distance: 4200,
        ringCount: 7,
        fogColor: 0x090914
    },
    {
        level: 5,
        title: "Europa to Titan (Saturn)",
        originColor: 0xb5a78d,
        originName: "Europa",
        targetColor: 0xdf9836,
        targetName: "Titan",
        targetRoughness: 0.6,
        surfaceType: "methane",
        distance: 4500,
        ringCount: 7,
        fogColor: 0x140d04
    },
    {
        level: 6,
        title: "Titan to Titania (Uranus)",
        originColor: 0xc48028,
        originName: "Titan",
        targetColor: 0xaecbd6,
        targetName: "Titania",
        targetRoughness: 0.7,
        surfaceType: "ice_rock",
        distance: 4800,
        ringCount: 8,
        fogColor: 0x040e14
    },
    {
        level: 7,
        title: "Titania to Triton (Neptune)",
        originColor: 0x8ba6b0,
        originName: "Titania",
        targetColor: 0x5aa5a7,
        targetName: "Triton",
        targetRoughness: 0.8,
        surfaceType: "geyser",
        distance: 5200,
        ringCount: 8,
        fogColor: 0x020814
    },
    {
        level: 8,
        title: "Triton to Deep Space Outpost",
        originColor: 0x4a8c8e,
        originName: "Triton",
        targetColor: 0x334455,
        targetName: "Station Alpha",
        targetRoughness: 0.4,
        surfaceType: "station",
        distance: 5500,
        ringCount: 9,
        fogColor: 0x020202
    }
];

let currentLevelIdx = 0;
let isPaused = false;
let isGameOver = false;

// Astronaut & Flight Mechanics
let ship = {
    x: 0,
    y: 0,
    z: 0,
    vx: 0,
    vy: 0,
    vz: -2.8,
    fuel: 100,
    ringsPassed: 0,
    totalRings: 5,
    destZ: -3000
};

const inputState = {
    up: false,
    down: false,
    left: false,
    right: false,
    thrust: false,
    brake: false
};

// UI DOM Elements
const levelEl = document.getElementById('tele-level');
const altEl = document.getElementById('tele-alt');
const speedEl = document.getElementById('tele-speed');
const fuelEl = document.getElementById('tele-fuel');
const ringsEl = document.getElementById('tele-rings');
const pauseBtn = document.getElementById('pause-btn');
const modalOverlay = document.getElementById('modal-overlay');
const modalTitle = document.getElementById('modal-title');
const modalMsg = document.getElementById('modal-msg');
const modalActionBtn = document.getElementById('modal-action-btn');

function init() {
    const container = document.getElementById('canvas-wrapper');

    // 1. Scene & Camera Setup
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(LEVELS[0].fogColor, 0.0003);

    camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 9000);

    // 2. Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // 3. Lighting
    const ambientLight = new THREE.AmbientLight(0x445566, 1.4);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 1.8);
    sunLight.position.set(600, 1000, 500);
    scene.add(sunLight);

    // 4. Construct 3D Astronaut Avatar
    buildAstronaut();

    // 5. Starfield & Space Dust
    createStarfield();
    createSpaceDust();

    // 6. Build Level Environment
    loadLevel(currentLevelIdx);

    // 7. Event & Input Handlers
    setupControls();
    window.addEventListener('resize', onWindowResize);

    // Start Simulation
    requestAnimationFrame(animate);
}

// Full 3D Astronaut Avatar
function buildAstronaut() {
    astronautGroup = new THREE.Group();

    const suitMat = new THREE.MeshStandardMaterial({
        color: 0xeeeeee,
        roughness: 0.6,
        metalness: 0.1
    });

    const jointMat = new THREE.MeshStandardMaterial({
        color: 0x222222,
        roughness: 0.8
    });

    const visorMat = new THREE.MeshPhysicalMaterial({
        color: 0xffaa00,
        metalness: 0.9,
        roughness: 0.1,
        clearcoat: 1.0,
        reflectivity: 1.0
    });

    // Torso
    const torsoGeo = new THREE.BoxGeometry(1.2, 1.6, 0.8);
    const torso = new THREE.Mesh(torsoGeo, suitMat);
    astronautGroup.add(torso);

    // Life Support Jetpack
    const packGeo = new THREE.BoxGeometry(1.0, 1.3, 0.5);
    const pack = new THREE.Mesh(packGeo, suitMat);
    pack.position.set(0, 0, 0.55);
    astronautGroup.add(pack);

    // Helmet
    const helmetGeo = new THREE.SphereGeometry(0.55, 24, 24);
    const helmet = new THREE.Mesh(helmetGeo, suitMat);
    helmet.position.set(0, 1.3, 0);
    astronautGroup.add(helmet);

    // Gold Visor
    const visorGeo = new THREE.SphereGeometry(0.42, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const visor = new THREE.Mesh(visorGeo, visorMat);
    visor.rotation.x = -Math.PI / 2;
    visor.position.set(0, 1.3, -0.22);
    astronautGroup.add(visor);

    // Limbs
    const createLimb = (x, y, z, rotZ = 0) => {
        const limbGeo = new THREE.CylinderGeometry(0.2, 0.22, 1.1, 12);
        const limb = new THREE.Mesh(limbGeo, suitMat);
        limb.position.set(x, y, z);
        limb.rotation.z = rotZ;
        return limb;
    };

    // Arms
    astronautGroup.add(createLimb(-0.85, 0.2, 0, 0.3));
    astronautGroup.add(createLimb(0.85, 0.2, 0, -0.3));

    // Legs
    astronautGroup.add(createLimb(-0.4, -1.3, 0, 0.08));
    astronautGroup.add(createLimb(0.4, -1.3, 0, -0.08));

    // Jetpack Thruster Flame Emitters
    const fireGeo = new THREE.ConeGeometry(0.18, 0.8, 8);
    const fireMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.8 });

    thrusterLeftFire = new THREE.Mesh(fireGeo, fireMat);
    thrusterLeftFire.position.set(-0.35, -0.7, 0.55);
    thrusterLeftFire.rotation.x = Math.PI;
    thrusterLeftFire.visible = false;
    astronautGroup.add(thrusterLeftFire);

    thrusterRightFire = thrusterLeftFire.clone();
    thrusterRightFire.position.x = 0.35;
    astronautGroup.add(thrusterRightFire);

    scene.add(astronautGroup);
}

// Generate Realistic Displaced Natural Planetary Surface & Rocks
function createNaturalSurface(config) {
    if (targetPlanetMesh) scene.remove(targetPlanetMesh);
    terrainRocks.forEach(rock => scene.remove(rock));
    terrainRocks = [];

    const radius = 420;
    const segments = 64;
    const geo = new THREE.SphereGeometry(radius, segments, segments);

    // Natural surface vertex displacement (craters, mountain bumps & ridges)
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        let vx = pos.getX(i);
        let vy = pos.getY(i);
        let vz = pos.getZ(i);

        let noise = Math.sin(vx * 0.03) * Math.cos(vy * 0.03) * Math.sin(vz * 0.03) * 8.0;
        if (config.surfaceType === 'mars') {
            noise += Math.sin(vx * 0.015) * Math.cos(vz * 0.015) * 16.0; // Higher Martian hills
        } else if (config.surfaceType === 'moon') {
            noise += Math.cos(vx * 0.05 + vy * 0.05) * 6.0; // Lunar crater depressions
        }

        const len = Math.hypot(vx, vy, vz);
        const factor = (len + noise) / len;
        pos.setXYZ(i, vx * factor, vy * factor, vz * factor);
    }
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
        color: config.targetColor,
        roughness: config.targetRoughness,
        metalness: 0.1
    });

    targetPlanetMesh = new THREE.Mesh(geo, mat);
    targetPlanetMesh.position.set(0, 0, config.destZ - (radius + 20));
    scene.add(targetPlanetMesh);

    // Spawn 3D Boulders & Rocks on Martian and Rocky Terrains
    if (config.surfaceType === 'mars' || config.surfaceType === 'moon' || config.surfaceType === 'asteroid') {
        const rockGeo = new THREE.DodecahedronGeometry(4, 1);
        const rockMat = new THREE.MeshStandardMaterial({ color: config.targetColor * 0.85, roughness: 0.95 });

        for (let j = 0; j < 30; j++) {
            const rock = new THREE.Mesh(rockGeo, rockMat);
            const rx = (Math.random() - 0.5) * 140;
            const ry = (Math.random() - 0.5) * 140;
            const rz = config.destZ - 10 - Math.random() * 50;
            rock.position.set(rx, ry, rz);
            rock.scale.set(Math.random() + 0.5, Math.random() + 0.5, Math.random() + 0.5);
            terrainRocks.push(rock);
            scene.add(rock);
        }
    }
}

function loadLevel(idx) {
    const config = LEVELS[idx];
    ship.destZ = -config.distance;
    ship.totalRings = config.ringCount;
    ship.ringsPassed = 0;
    ship.x = 0;
    ship.y = 0;
    ship.z = 0;
    ship.vx = 0;
    ship.vy = 0;
    ship.vz = -2.8;
    ship.fuel = 100;
    isGameOver = false;

    scene.fog.color.setHex(config.fogColor);

    // Build origin planet (behind player)
    if (originPlanetMesh) scene.remove(originPlanetMesh);
    const origGeo = new THREE.SphereGeometry(220, 32, 32);
    const origMat = new THREE.MeshPhongMaterial({ color: config.originColor, shininess: 10 });
    originPlanetMesh = new THREE.Mesh(origGeo, origMat);
    originPlanetMesh.position.set(0, -80, 500);
    scene.add(originPlanetMesh);

    // Build Target Planet
    config.destZ = ship.destZ;
    createNaturalSurface(config);

    // Build Approach Rings
    rings.forEach(ring => scene.remove(ring));
    rings = [];
    const ringGeo = new THREE.TorusGeometry(14, 0.45, 12, 32);
    const zStep = (config.distance - 700) / (config.ringCount + 1);

    for (let i = 1; i <= config.ringCount; i++) {
        const ringMat = new THREE.MeshBasicMaterial({ color: 0x00ffcc });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.set(
            Math.sin(i * 1.6) * 32,
            Math.cos(i * 1.3) * 24,
            -600 - (i * zStep)
        );
        ring.userData = { passed: false, collected: false };
        rings.push(ring);
        scene.add(ring);
    }

    levelEl.innerText = `${config.level} - ${config.title}`;
    modalOverlay.classList.add('modal-hidden');
}

function createStarfield() {
    const starGeo = new THREE.BufferGeometry();
    const starPositions = new Float32Array(2200 * 3);
    for (let i = 0; i < 2200 * 3; i += 3) {
        starPositions[i] = (Math.random() - 0.5) * 7000;
        starPositions[i + 1] = (Math.random() - 0.5) * 7000;
        starPositions[i + 2] = (Math.random() - 0.5) * 7000;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.5, sizeAttenuation: false });
    starField = new THREE.Points(starGeo, starMat);
    scene.add(starField);
}

function createSpaceDust() {
    const dustGeo = new THREE.BufferGeometry();
    const dustCount = 800;
    const dustPos = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount * 3; i += 3) {
        dustPos[i] = (Math.random() - 0.5) * 200;
        dustPos[i + 1] = (Math.random() - 0.5) * 200;
        dustPos[i + 2] = (Math.random() - 0.5) * 600;
    }
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    const dustMat = new THREE.PointsMaterial({ color: 0x00ffcc, size: 1.8, transparent: true, opacity: 0.7 });
    dustParticles = new THREE.Points(dustGeo, dustMat);
    scene.add(dustParticles);
}

// --- Control Bindings ---
function setupControls() {
    window.addEventListener('keydown', (e) => {
        if (e.key === 'p' || e.key === 'P') {
            togglePause();
            return;
        }
        if (isPaused || isGameOver) return;

        if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') inputState.up = true;
        if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') inputState.down = true;
        if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') inputState.left = true;
        if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') inputState.right = true;
        if (e.key === 'Shift' || e.key === ' ') inputState.thrust = true;
        if (e.key === 'Control' || e.key === 'b' || e.key === 'B') inputState.brake = true;
    });

    window.addEventListener('keyup', (e) => {
        if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') inputState.up = false;
        if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') inputState.down = false;
        if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') inputState.left = false;
        if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') inputState.right = false;
        if (e.key === 'Shift' || e.key === ' ') inputState.thrust = false;
        if (e.key === 'Control' || e.key === 'b' || e.key === 'B') inputState.brake = false;
    });

    bindButton('btn-up', 'up');
    bindButton('btn-down', 'down');
    bindButton('btn-left', 'left');
    bindButton('btn-right', 'right');
    bindButton('btn-thrust', 'thrust');
    bindButton('btn-brake', 'brake');

    pauseBtn.addEventListener('click', togglePause);
    modalActionBtn.addEventListener('click', handleModalAction);
}

function bindButton(id, stateProp) {
    const el = document.getElementById(id);
    if (!el) return;

    const start = (e) => {
        e.preventDefault();
        inputState[stateProp] = true;
        el.classList.add('active');
    };
    const end = (e) => {
        e.preventDefault();
        inputState[stateProp] = false;
        el.classList.remove('active');
    };

    el.addEventListener('touchstart', start, { passive: false });
    el.addEventListener('touchend', end, { passive: false });
    el.addEventListener('mousedown', start);
    el.addEventListener('mouseup', end);
    el.addEventListener('mouseleave', end);
}

function togglePause() {
    if (isGameOver) return;
    isPaused = !isPaused;
    if (isPaused) {
        modalTitle.innerText = "MISSION PAUSED";
        modalTitle.style.color = "#00ffcc";
        modalMsg.innerText = "Descent paused. Press P or tap below to resume.";
        modalActionBtn.innerText = "RESUME";
        modalOverlay.classList.remove('modal-hidden');
    } else {
        modalOverlay.classList.add('modal-hidden');
    }
}

function handleModalAction() {
    if (isPaused) {
        togglePause();
    } else if (isGameOver) {
        if (modalActionBtn.dataset.action === "next") {
            currentLevelIdx = (currentLevelIdx + 1) % LEVELS.length;
            loadLevel(currentLevelIdx);
        } else {
            loadLevel(currentLevelIdx); // Retry current level
        }
    }
}

// --- Main Simulation Loop ---
function animate() {
    requestAnimationFrame(animate);

    if (isPaused || isGameOver) return;

    // 1. Lateral & Propulsion Physics
    const latAcc = 0.09;
    if (inputState.left) ship.vx -= latAcc;
    if (inputState.right) ship.vx += latAcc;
    if (inputState.up) ship.vy += latAcc;
    if (inputState.down) ship.vy -= latAcc;

    // Jet Thruster / Reverse Braking
    const hasFuel = ship.fuel > 0;
    if (inputState.thrust && hasFuel) {
        ship.vz -= 0.07;
        ship.fuel = Math.max(0, ship.fuel - 0.09);
        thrusterLeftFire.visible = true;
        thrusterRightFire.visible = true;
    } else {
        thrusterLeftFire.visible = false;
        thrusterRightFire.visible = false;
    }

    if (inputState.brake && hasFuel) {
        ship.vz += 0.085; // Decelerate toward landing
        ship.fuel = Math.max(0, ship.fuel - 0.09);
    }

    ship.vx *= 0.93;
    ship.vy *= 0.93;

    ship.x += ship.vx;
    ship.y += ship.vy;
    ship.z += ship.vz;

    // 2. Position Astronaut Avatar Entirely in Front of Camera
    astronautGroup.position.set(ship.x, ship.y, ship.z);

    // Natural astronaut movement banking/tilting
    astronautGroup.rotation.z = -ship.vx * 0.12;
    astronautGroup.rotation.x = ship.vy * 0.1;
    astronautGroup.rotation.y = -ship.vx * 0.08;

    // 3. Third-Person Chase Camera (Positioned Behind & Slightly Above the Astronaut)
    camera.position.set(
        ship.x,
        ship.y + 1.8,
        ship.z + 5.5 // Camera is pulled back a few feet so the full body is visible
    );
    camera.lookAt(ship.x, ship.y + 0.4, ship.z - 10);

    // 4. Space Dust Wrap Around Player
    const dustPos = dustParticles.geometry.attributes.position.array;
    for (let i = 2; i < dustPos.length; i += 3) {
        if (dustPos[i] > ship.z + 40) {
            dustPos[i] = ship.z - 450;
        }
    }
    dustParticles.geometry.attributes.position.needsUpdate = true;

    // 5. Approach Ring Trajectory Verification
    rings.forEach(ring => {
        ring.rotation.z += 0.015;
        const dz = ship.z - ring.position.z;
        if (dz < 4 && !ring.userData.passed) {
            ring.userData.passed = true;
            const dist2D = Math.hypot(ship.x - ring.position.x, ship.y - ring.position.y);
            if (dist2D < 16) {
                ring.userData.collected = true;
                ship.ringsPassed++;
                ring.material.color.setHex(0x00ff00);
            } else {
                ring.material.color.setHex(0xff3333);
            }
        }
    });

    // 6. Altitude & Landing Calculations
    const altitude = Math.max(0, Math.round(ship.z - ship.destZ));
    const descentSpeed = Math.abs(ship.vz * 10).toFixed(1);

    if (altitude <= 0 && !isGameOver) {
        concludeLanding(parseFloat(descentSpeed));
    }

    // 7. Render Telemetry HUD
    altEl.innerText = altitude;
    speedEl.innerText = descentSpeed;
    fuelEl.innerText = Math.round(ship.fuel);
    ringsEl.innerText = `${ship.ringsPassed} / ${ship.totalRings}`;

    renderer.render(scene, camera);
}

function concludeLanding(speed) {
    isGameOver = true;
    modalOverlay.classList.remove('modal-hidden');

    const maxSafeSpeed = 19.0;
    const minRingsNeeded = Math.ceil(ship.totalRings * 0.6);
    const isLastLevel = currentLevelIdx === LEVELS.length - 1;

    if (speed <= maxSafeSpeed && ship.ringsPassed >= minRingsNeeded) {
        if (isLastLevel) {
            modalTitle.innerText = "SOLAR SYSTEM VOYAGE COMPLETE!";
            modalTitle.style.color = "#00ffcc";
            modalMsg.innerText = `Master Astronaut! You have safely touched down across all 8 sectors from Earth to Deep Space Outpost!\nTouchdown Speed: ${speed} m/s`;
            modalActionBtn.innerText = "PLAY AGAIN";
            modalActionBtn.dataset.action = "retry";
            currentLevelIdx = 0;
        } else {
            modalTitle.innerText = "SAFE TOUCHDOWN!";
            modalTitle.style.color = "#00ffcc";
            modalMsg.innerText = `Smooth landing on ${LEVELS[currentLevelIdx].targetName}!\nLanding Speed: ${speed} m/s\nRings Cleared: ${ship.ringsPassed}/${ship.totalRings}`;
            modalActionBtn.innerText = `PROCEED TO LEVEL ${currentLevelIdx + 2}`;
            modalActionBtn.dataset.action = "next";
        }
    } else if (speed > maxSafeSpeed) {
        modalTitle.innerText = "CRITICAL HARD IMPACT!";
        modalTitle.style.color = "#ff3344";
        modalMsg.innerText = `Descent speed too high (${speed} m/s). You crashed into ${LEVELS[currentLevelIdx].targetName}!\nUse REVERSE thrusters to stay below ${maxSafeSpeed} m/s.`;
        modalActionBtn.innerText = "RETRY LEVEL";
        modalActionBtn.dataset.action = "retry";
    } else {
        modalTitle.innerText = "OFF-TRAJECTORY LANDING!";
        modalTitle.style.color = "#ffaa00";
        modalMsg.innerText = `Missed entry corridor! You cleared ${ship.ringsPassed}/${ship.totalRings} rings (Need at least ${minRingsNeeded}).`;
        modalActionBtn.innerText = "RETRY LEVEL";
        modalActionBtn.dataset.action = "retry";
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener('DOMContentLoaded', init);
