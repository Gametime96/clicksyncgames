// ==========================================
// SCENE, CAMERA & LIGHTING INITIALIZATION
// ==========================================
const container = document.getElementById('webgl-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xe2e8f0);
scene.fog = new THREE.Fog(0xe2e8f0, 30, 95);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
const CAMERA_DISTANCE = 14.0; 
const CAMERA_HEIGHT = 6.2;
let orbitTheta = 0;
let joystickVelocity = 0;

function updateCameraPosition() {
    camera.position.x = Math.sin(orbitTheta) * CAMERA_DISTANCE;
    camera.position.z = Math.cos(orbitTheta) * CAMERA_DISTANCE;
    camera.position.y = CAMERA_HEIGHT;
    camera.lookAt(0, 1.2, 0);
}

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
container.appendChild(renderer.domElement);

// Facility Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 1.25);
scene.add(ambientLight);

[[-12, 16, -10], [12, 16, -10], [-12, 16, 10], [12, 16, 10], [0, 18, 0]].forEach(pos => {
    const spot = new THREE.DirectionalLight(0xffffff, 0.75);
    spot.position.set(pos[0], pos[1], pos[2]);
    spot.castShadow = true;
    spot.shadow.mapSize.width = 1024;
    spot.shadow.mapSize.height = 1024;
    spot.shadow.bias = -0.0001;
    scene.add(spot);
});

// Facility Geometry (Light Gray Floor, Light Gray Walls, White Ceiling)
const wallMat = new THREE.MeshStandardMaterial({ color: 0xd1d5db, roughness: 0.5 });
const ceilingMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
const floorMat = new THREE.MeshStandardMaterial({ color: 0xe5e7eb, roughness: 0.25, metalness: 0.1 });

const floor = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), floorMat);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const backWall = new THREE.Mesh(new THREE.PlaneGeometry(100, 20), wallMat);
backWall.position.set(0, 10, -50);
scene.add(backWall);

const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(100, 20), wallMat);
leftWall.position.set(-50, 10, 0);
leftWall.rotation.y = Math.PI / 2;
scene.add(leftWall);

const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(100, 20), wallMat);
rightWall.position.set(50, 10, 0);
rightWall.rotation.y = -Math.PI / 2;
scene.add(rightWall);

const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), ceilingMat);
ceiling.position.set(0, 20, 0);
ceiling.rotation.x = Math.PI / 2;
scene.add(ceiling);

// Dark Yellow Floor Markers
const darkYellowCircleMat = new THREE.MeshBasicMaterial({ color: 0xb45309 });
[[-8, 4], [10, -6], [-14, -12], [7, 15], [16, 8], [-6, -18]].forEach(pos => {
    const circle = new THREE.Mesh(new THREE.CircleGeometry(0.85, 24), darkYellowCircleMat);
    circle.rotation.x = -Math.PI / 2;
    circle.position.set(pos[0], 0.015, pos[1]);
    scene.add(circle);
});

// ==========================================
// PROCEDURAL TEXTURE GENERATION
// ==========================================
function createCrashTargetTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#facc15'; ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = '#000000';
    ctx.beginPath(); ctx.moveTo(128, 128); ctx.arc(128, 128, 128, 0, Math.PI / 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(128, 128); ctx.arc(128, 128, 128, Math.PI, Math.PI * 1.5); ctx.fill();
    return new THREE.CanvasTexture(canvas);
}

function createCautionDiagonalTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#facc15'; ctx.fillRect(0, 0, 256, 64);
    ctx.fillStyle = '#000000'; ctx.lineWidth = 14;
    for (let i = -100; i < 356; i += 32) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + 40, 64); ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 1);
    return tex;
}

const targetTexture = createCrashTargetTexture();
const cautionTexture = createCautionDiagonalTexture();

// ==========================================
// 3D MODELS: DUMMY & HELMETED CHICKEN
// ==========================================
const dummySkinMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.35 });
const jointMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.5 });
const targetDecalMat = new THREE.MeshStandardMaterial({ map: targetTexture, roughness: 0.3 });
const seatbeltMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8 });

function build3DDummy() {
    const group = new THREE.Group();
    const pelvis = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.3, 0.35, 16), dummySkinMat);
    pelvis.position.y = 0.5;
    group.add(pelvis);

    [-0.24, 0.24].forEach(xOffset => {
        const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.12, 0.65, 16), dummySkinMat);
        thigh.rotation.x = Math.PI / 2;
        thigh.position.set(xOffset, 0.45, 0.35);
        group.add(thigh);

        const thighTarget = new THREE.Mesh(new THREE.CircleGeometry(0.1, 16), targetDecalMat);
        thighTarget.rotation.y = xOffset > 0 ? Math.PI / 2 : -Math.PI / 2;
        thighTarget.position.set(xOffset > 0 ? xOffset + 0.15 : xOffset - 0.15, 0.45, 0.35);
        group.add(thighTarget);

        const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.09, 0.65, 16), dummySkinMat);
        shin.position.set(xOffset, 0.1, 0.7);
        group.add(shin);

        const foot = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.09, 0.3), dummySkinMat);
        foot.position.set(xOffset, -0.2, 0.78);
        group.add(foot);
    });

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.85, 0.4), dummySkinMat);
    torso.position.y = 1.1;
    group.add(torso);

    [-0.48, 0.48].forEach(xOffset => {
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.09, 0.55, 16), dummySkinMat);
        arm.position.set(xOffset, 1.05, 0.1);
        arm.rotation.x = 0.35;
        group.add(arm);

        const armTarget = new THREE.Mesh(new THREE.CircleGeometry(0.08, 16), targetDecalMat);
        armTarget.rotation.y = xOffset > 0 ? Math.PI / 2 : -Math.PI / 2;
        armTarget.position.set(xOffset > 0 ? xOffset + 0.11 : xOffset - 0.11, 1.15, 0.08);
        group.add(armTarget);
    });

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.2, 16), jointMat);
    neck.position.y = 1.6;
    group.add(neck);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 24, 24), dummySkinMat);
    head.position.y = 1.9;
    group.add(head);

    const leftTarget = new THREE.Mesh(new THREE.CircleGeometry(0.11, 16), targetDecalMat);
    leftTarget.rotation.y = -Math.PI / 2;
    leftTarget.position.set(-0.29, 1.9, 0);
    group.add(leftTarget);

    const rightTarget = new THREE.Mesh(new THREE.CircleGeometry(0.11, 16), targetDecalMat);
    rightTarget.rotation.y = Math.PI / 2;
    rightTarget.position.set(0.29, 1.9, 0);
    group.add(rightTarget);

    // 3-Point Belt
    const diagBelt = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.1, 0.04), seatbeltMat);
    diagBelt.position.set(0, 1.1, 0.22);
    diagBelt.rotation.z = -0.45;
    group.add(diagBelt);

    const lapBelt = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.1, 0.04), seatbeltMat);
    lapBelt.position.set(0, 0.52, 0.32);
    group.add(lapBelt);

    return group;
}

function buildHelmetedChicken() {
    const group = new THREE.Group();
    const featherMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.6 });
    const beakMat = new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.4 });
    const helmetMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, metalness: 0.4, roughness: 0.2 });
    const cageMat = new THREE.MeshStandardMaterial({ color: 0xd1d5db, metalness: 0.9, roughness: 0.1 });

    const body = new THREE.Mesh(new THREE.SphereGeometry(0.45, 16, 16), featherMat);
    body.position.y = 0.65;
    body.scale.set(0.9, 1.0, 1.2);
    group.add(body);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 16), featherMat);
    head.position.set(0, 1.1, 0.28);
    group.add(head);

    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 12), beakMat);
    beak.rotation.x = Math.PI / 2;
    beak.position.set(0, 1.08, 0.58);
    group.add(beak);

    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.32, 20, 20, 0, Math.PI * 2, 0, Math.PI * 0.75), helmetMat);
    helmet.position.set(0, 1.16, 0.26);
    group.add(helmet);

    const mask = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.02, 8, 16, Math.PI), cageMat);
    mask.position.set(0, 1.05, 0.48);
    mask.rotation.x = -Math.PI / 4;
    group.add(mask);

    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.1, 0.04), seatbeltMat);
    belt.position.set(0, 0.65, 0.35);
    group.add(belt);

    return group;
}

// ==========================================
// 3D VEHICLE: SOLID 4-DOOR SEDAN WITH CLEAR GLASS
// ==========================================
const targetVehicleGroup = new THREE.Group();
scene.add(targetVehicleGroup);

const solidSedanMat = new THREE.MeshStandardMaterial({
    color: 0x1e3a8a,
    metalness: 0.6,
    roughness: 0.25
});

const trimMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 });
const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });
const rimMat = new THREE.MeshStandardMaterial({ color: 0xd1d5db, metalness: 0.9, roughness: 0.2 });
const seatMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8 });

const clearGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.2,
    roughness: 0.05,
    metalness: 0.1,
    transmission: 0.95,
    ior: 1.5
});

// Sedan Chassis
const chassis = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.4, 7.6), trimMat);
chassis.position.y = 0.5;
targetVehicleGroup.add(chassis);

// Wheels
[[-2.1, 0.6, 2.3], [2.1, 0.6, 2.3], [-2.1, 0.6, -2.3], [2.1, 0.6, -2.3]].forEach(pos => {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.45, 24), wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(pos[0], pos[1], pos[2]);
    targetVehicleGroup.add(w);

    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.46, 16), rimMat);
    rim.rotation.z = Math.PI / 2;
    rim.position.set(pos[0], pos[1], pos[2]);
    targetVehicleGroup.add(rim);
});

// Lower Solid Body
const lowerBody = new THREE.Mesh(new THREE.BoxGeometry(4.0, 1.0, 7.4), solidSedanMat);
lowerBody.position.set(0, 1.1, 0);
targetVehicleGroup.add(lowerBody);

// Solid Trunk
const trunk = new THREE.Mesh(new THREE.BoxGeometry(3.9, 0.8, 1.8), solidSedanMat);
trunk.position.set(0, 1.4, -2.7);
targetVehicleGroup.add(trunk);

// Solid Hood
const hood = new THREE.Mesh(new THREE.BoxGeometry(3.9, 0.8, 2.0), solidSedanMat);
hood.position.set(0, 1.4, 2.6);
targetVehicleGroup.add(hood);

// Solid Roof Shell
const roof = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.12, 3.4), solidSedanMat);
roof.position.set(0, 2.65, -0.1);
targetVehicleGroup.add(roof);

// Pillars
[[-1.8, 2.1, 1.5], [1.8, 2.1, 1.5], [-1.8, 2.1, -1.7], [1.8, 2.1, -1.7]].forEach(pos => {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.1, 0.18), solidSedanMat);
    pillar.position.set(pos[0], pos[1], pos[2]);
    targetVehicleGroup.add(pillar);
});

// Clear Windows
const windshield = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.1, 0.06), clearGlassMat);
windshield.position.set(0, 2.1, 1.5);
windshield.rotation.x = -0.4;
targetVehicleGroup.add(windshield);

const rearWindow = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.1, 0.06), clearGlassMat);
rearWindow.position.set(0, 2.1, -1.7);
rearWindow.rotation.x = 0.4;
targetVehicleGroup.add(rearWindow);

const leftSideGlass = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.0, 3.2), clearGlassMat);
leftSideGlass.position.set(-1.85, 2.1, -0.1);
targetVehicleGroup.add(leftSideGlass);

const rightSideGlass = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.0, 3.2), clearGlassMat);
rightSideGlass.position.set(1.85, 2.1, -0.1);
targetVehicleGroup.add(rightSideGlass);

// Airbags
const airbagMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.65 });
const driverAirbag = new THREE.Mesh(new THREE.SphereGeometry(0.36, 24, 24), airbagMat);
driverAirbag.scale.set(1.2, 1.2, 0.7);
driverAirbag.position.set(-1.1, 1.6, 1.25);
driverAirbag.visible = false;
targetVehicleGroup.add(driverAirbag);

const passAirbag = new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 24), airbagMat);
passAirbag.scale.set(1.3, 1.1, 0.8);
passAirbag.position.set(1.1, 1.65, 1.35);
passAirbag.visible = false;
targetVehicleGroup.add(passAirbag);

const leftCurtainAirbag = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.0, 3.2), airbagMat);
leftCurtainAirbag.position.set(-1.75, 2.1, -0.1);
leftCurtainAirbag.visible = false;
targetVehicleGroup.add(leftCurtainAirbag);

const rightCurtainAirbag = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.0, 3.2), airbagMat);
rightCurtainAirbag.position.set(1.75, 2.1, -0.1);
rightCurtainAirbag.visible = false;
targetVehicleGroup.add(rightCurtainAirbag);

// 4 Seats
const seatData = {
    FL: { label: 'Driver', type: 'human', localPos: new THREE.Vector3(-1.1, 0.7, 0.9), occupant: null },
    FR: { label: 'Front Pass', type: 'human', localPos: new THREE.Vector3(1.1, 0.7, 0.9), occupant: null },
    BL: { label: 'Rear Driver', type: 'chicken', localPos: new THREE.Vector3(-1.1, 0.7, -1.1), occupant: null },
    BR: { label: 'Rear Pass', type: 'human', localPos: new THREE.Vector3(1.1, 0.7, -1.1), occupant: null }
};

for (let key in seatData) {
    const s = seatData[key];
    const sm = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.3, 1.2), seatMat);
    sm.position.copy(s.localPos);
    targetVehicleGroup.add(sm);

    const sb = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.6, 0.25), seatMat);
    sb.position.set(s.localPos.x, s.localPos.y + 0.8, s.localPos.z - 0.5);
    targetVehicleGroup.add(sb);
}

// ==========================================
// 3D IIHS MOVING CRASH CART
// ==========================================
const crashCart = new THREE.Group();
scene.add(crashCart);

const cartFrame = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.35, 6.0), trimMat);
cartFrame.position.y = 0.5;
crashCart.add(cartFrame);

[[-1.9, 0.6, 1.8], [1.9, 0.6, 1.8], [-1.9, 0.6, -1.8], [1.9, 0.6, -1.8]].forEach(pos => {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.4, 20), wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(pos[0], pos[1], pos[2]);
    crashCart.add(w);
});

const crushBarrier = new THREE.Mesh(
    new THREE.BoxGeometry(3.6, 1.3, 1.4),
    new THREE.MeshStandardMaterial({ color: 0xd8e2dc, metalness: 0.85, roughness: 0.25 })
);
crushBarrier.position.set(0, 1.15, 3.6);
crashCart.add(crushBarrier);

const cautionBand = new THREE.Mesh(
    new THREE.BoxGeometry(3.64, 0.35, 0.1),
    new THREE.MeshBasicMaterial({ map: cautionTexture })
);
cautionBand.position.set(0, 1.15, 4.32);
crashCart.add(cautionBand);

// ==========================================
// GAME STATE MANAGEMENT (7 LEVELS)
// ==========================================
let currentLevel = 1;
const TOTAL_LEVELS = 7;
let isPaused = false;
let gameState = 'PREP';
let countdownTimer = 10.0;
let vehicleHealth = 100;
let selectedSeatKey = 'FL';
let attackSide = 'LEFT';
let activeFloatingTexts = [];
let joltAnimTimer = 0;
let isJolting = false;
let replayClock = 5.0;
let focusedReplaySeat = 'FL';

function createOccupantData(name, isChicken = false) {
    return {
        name: name,
        health: 100,
        isAxed: false,
        isChicken: isChicken,
        mesh: isChicken ? buildHelmetedChicken() : build3DDummy()
    };
}

function installOccupant(seatKey, name, isChicken = false) {
    const seat = seatData[seatKey];
    if (seat.occupant) return;
    const occ = createOccupantData(name, isChicken);
    occ.mesh.position.set(seat.localPos.x, seat.localPos.y + 0.1, seat.localPos.z);
    targetVehicleGroup.add(occ.mesh);
    seat.occupant = occ;
}

function initLevel(level) {
    currentLevel = level;
    gameState = 'PREP';
    isPaused = false;
    countdownTimer = 10.0;
    vehicleHealth = 100;
    isJolting = false;
    replayClock = 5.0;

    orbitTheta = 0;
    updateCameraPosition();

    document.getElementById('levelDisplay').textContent = `LEVEL ${currentLevel} / ${TOTAL_LEVELS}`;
    document.getElementById('replayBanner').style.display = 'none';
    document.getElementById('resultModal').style.display = 'none';
    document.getElementById('pauseModal').style.display = 'none';
    document.getElementById('telemetryPanel').style.display = 'flex';
    document.getElementById('joyContainer').style.display = 'flex';

    targetVehicleGroup.position.set(0, 0, 0);
    targetVehicleGroup.rotation.set(0, 0, 0);
    leftSideGlass.visible = true;
    rightSideGlass.visible = true;
    driverAirbag.visible = false;
    passAirbag.visible = false;
    leftCurtainAirbag.visible = false;
    rightCurtainAirbag.visible = false;

    attackSide = Math.random() < 0.5 ? 'LEFT' : 'RIGHT';
    if (attackSide === 'LEFT') {
        crashCart.position.set(-22, 0, 0);
        crashCart.rotation.y = Math.PI / 2;
    } else {
        crashCart.position.set(22, 0, 0);
        crashCart.rotation.y = -Math.PI / 2;
    }

    for (let key in seatData) {
        if (seatData[key].occupant && seatData[key].occupant.mesh) {
            targetVehicleGroup.remove(seatData[key].occupant.mesh);
        }
        seatData[key].occupant = null;
    }

    installOccupant('FL', 'Driver');
    installOccupant('FR', 'Co-Pilot');

    if (currentLevel >= 2) {
        installOccupant('BL', 'Cluck Norris', true);
    }
    selectedSeatKey = 'FL';

    document.getElementById('phaseDisplay').textContent = 'COUNTDOWN PREPARATION';
    document.getElementById('phaseDisplay').style.borderColor = '#d97706';
    document.getElementById('phaseDisplay').style.color = '#d97706';
    updateUI();
}

function triggerImpactSequence() {
    vehicleHealth = Math.max(0, vehicleHealth - 30);
    isJolting = true;
    joltAnimTimer = 0;

    if (attackSide === 'LEFT') {
        leftSideGlass.visible = false;
        leftCurtainAirbag.visible = true;
    } else {
        rightSideGlass.visible = false;
        rightCurtainAirbag.visible = true;
    }

    if (seatData.FL.occupant) driverAirbag.visible = true;
    if (seatData.FR.occupant) passAirbag.visible = true;

    for (let key in seatData) {
        const s = seatData[key];
        if (s.occupant && !s.occupant.isAxed) {
            const isDirectSide = (attackSide === 'LEFT' && key.endsWith('L')) || (attackSide === 'RIGHT' && key.endsWith('R'));
            const damageAmount = isDirectSide ? 40 : 20;

            s.occupant.health = Math.max(0, s.occupant.health - damageAmount);
            if (s.occupant.health === 0) s.occupant.isAxed = true;

            spawnLevitatingDamage(s.localPos, `-${damageAmount}%`);
        }
    }

    updateUI();

    setTimeout(() => {
        startFocusedReplay();
    }, 800);
}

function startFocusedReplay() {
    gameState = 'REPLAY';
    replayClock = 5.0;

    const installedKeys = Object.keys(seatData).filter(k => seatData[k].occupant !== null);
    focusedReplaySeat = installedKeys[Math.floor(Math.random() * installedKeys.length)] || 'FL';

    for (let key in seatData) {
        if (seatData[key].occupant && seatData[key].occupant.mesh) {
            seatData[key].occupant.mesh.visible = (key === focusedReplaySeat);
        }
    }

    const occ = seatData[focusedReplaySeat].occupant;
    document.getElementById('replayTargetLabel').textContent = `🔴 5-SEC REPLAY: ${seatData[focusedReplaySeat].label.toUpperCase()} (${occ.name})`;
    document.getElementById('replayBanner').style.display = 'flex';
    document.getElementById('telemetryPanel').style.display = 'none';
    document.getElementById('joyContainer').style.display = 'none';

    const targetPos = seatData[focusedReplaySeat].localPos;
    if (focusedReplaySeat.endsWith('L')) {
        camera.position.set(2.4, 2.1, 1.8);
    } else {
        camera.position.set(-2.4, 2.1, 1.8);
    }
    camera.lookAt(targetPos.x, targetPos.y + 0.8, targetPos.z);
}

function finishLevel() {
    gameState = 'RESOLVED';
    document.getElementById('replayBanner').style.display = 'none';

    for (let key in seatData) {
        if (seatData[key].occupant && seatData[key].occupant.mesh) {
            seatData[key].occupant.mesh.visible = true;
        }
    }

    const hasSurvivor = Object.values(seatData).some(s => s.occupant && !s.occupant.isAxed);
    const modal = document.getElementById('resultModal');
    const headline = document.getElementById('modalHeadline');
    const subtext = document.getElementById('modalSubtext');
    const nextBtn = document.getElementById('btnNextLevel');

    modal.style.display = 'flex';
    if (hasSurvivor && vehicleHealth > 0) {
        if (currentLevel < TOTAL_LEVELS) {
            headline.textContent = `LEVEL ${currentLevel} PASSED`;
            headline.style.color = '#10b981';
            subtext.textContent = 'At least one occupant survived the impact! Ready for next test tier.';
            nextBtn.textContent = `Proceed to Level ${currentLevel + 1}`;
        } else {
            headline.textContent = `CRASH TEST EXTREME 2.0 CHAMPION!`;
            headline.style.color = '#10b981';
            subtext.textContent = 'All 7 crash testing tiers completed with valid passenger survival rates!';
            nextBtn.textContent = 'Restart Level 1';
        }
    } else {
        headline.textContent = 'TEST FAILED: 0 SURVIVORS';
        headline.style.color = '#ef4444';
        subtext.textContent = 'All occupants were axed or the sedan cab suffered structural collapse.';
        nextBtn.textContent = `Retry Level ${currentLevel}`;
    }
}

function spawnLevitatingDamage(localPos, text) {
    const worldPos = localPos.clone();
    worldPos.y += 2.0;

    const el = document.createElement('div');
    el.className = 'levitating-damage';
    el.textContent = text;
    document.getElementById('floatingLayer').appendChild(el);

    activeFloatingTexts.push({
        element: el,
        worldPos: worldPos,
        life: 2.0,
        maxLife: 2.0
    });
}

function togglePause() {
    if (gameState === 'RESOLVED') return;
    isPaused = !isPaused;
    document.getElementById('pauseModal').style.display = isPaused ? 'flex' : 'none';
    document.getElementById('btnPause').textContent = isPaused ? '▶ Resume' : '⏸ Pause';
}

// ==========================================
// UI & EVENT LISTENERS
// ==========================================
function updateUI() {
    document.getElementById('carHpText').textContent = vehicleHealth + '%';
    document.getElementById('carHpBar').style.width = vehicleHealth + '%';
    document.getElementById('carHpBar').style.backgroundColor = vehicleHealth > 40 ? '#10b981' : '#ef4444';

    const rack = document.getElementById('dummyRack');
    rack.innerHTML = '';

    for (let key in seatData) {
        const s = seatData[key];
        if (s.occupant) {
            const card = document.createElement('div');
            card.className = `dummy-card ${s.occupant.isAxed ? 'axed' : ''} ${selectedSeatKey === key ? 'selected' : ''}`;
            card.onclick = () => {
                if (!s.occupant.isAxed) {
                    selectedSeatKey = key;
                    updateUI();
                }
            };

            const icon = s.occupant.isChicken ? '🐔' : '👤';
            card.innerHTML = `
                <div class="status-line">
                    <strong>${icon} ${s.label} (${s.occupant.name})</strong>
                    <span class="${s.occupant.isAxed ? 'stat-red' : 'stat-blue'}">${s.occupant.isAxed ? 'AXED (0%)' : s.occupant.health + '%'}</span>
                </div>
                <div class="meter-bar">
                    <div class="meter-fill" style="width: ${s.occupant.health}%; background-color: ${s.occupant.health > 40 ? '#10b981' : '#ef4444'}"></div>
                </div>
            `;
            rack.appendChild(card);
        }
    }

    const inPrep = gameState === 'PREP';
    document.getElementById('btnSpawnDummy').disabled = !inPrep;
    document.getElementById('btnRepairCar').disabled = !inPrep;
    document.getElementById('btnRepairDummy').disabled = !inPrep || !selectedSeatKey || !seatData[selectedSeatKey]?.occupant || seatData[selectedSeatKey].occupant.isAxed;
}

// Button Attachments
document.getElementById('btnPause').onclick = togglePause;
document.getElementById('btnResume').onclick = togglePause;

window.addEventListener('keydown', (e) => {
    if (e.key === 'p' || e.key === 'P') {
        togglePause();
    }
});

document.getElementById('btnSpawnDummy').onclick = () => {
    if (gameState !== 'PREP') return;
    const emptyKey = Object.keys(seatData).find(k => seatData[k].occupant === null);
    if (emptyKey) {
        installOccupant(emptyKey, 'Reinforcement');
        selectedSeatKey = emptyKey;
        updateUI();
    }
};

document.getElementById('btnRepairCar').onclick = () => {
    if (gameState !== 'PREP') return;
    vehicleHealth = Math.min(100, vehicleHealth + 20);
    updateUI();
};

document.getElementById('btnRepairDummy').onclick = () => {
    if (gameState !== 'PREP' || !selectedSeatKey) return;
    const target = seatData[selectedSeatKey]?.occupant;
    if (target && !target.isAxed) {
        target.health = Math.min(100, target.health + 20);
        updateUI();
    }
};

document.getElementById('btnTriggerTest').onclick = () => {
    countdownTimer = 0;
};

document.getElementById('btnNextLevel').onclick = () => {
    const hasSurvivor = Object.values(seatData).some(s => s.occupant && !s.occupant.isAxed);
    if (hasSurvivor && vehicleHealth > 0) {
        if (currentLevel < TOTAL_LEVELS) {
            initLevel(currentLevel + 1);
        } else {
            initLevel(1);
        }
    } else {
        initLevel(currentLevel);
    }
};

// ==========================================
// VIRTUAL JOYSTICK
// ==========================================
const joyContainer = document.getElementById('joyContainer');
const joyKnob = document.getElementById('joyKnob');
let joyActive = false;
let joyTouchId = null;

function handleJoystickMove(clientX, clientY) {
    const rect = joyContainer.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const maxRadius = rect.width / 2 - 10;

    let dx = clientX - centerX;
    let dy = clientY - centerY;
    const dist = Math.hypot(dx, dy);

    if (dist > maxRadius) {
        dx = (dx / dist) * maxRadius;
        dy = (dy / dist) * maxRadius;
    }

    joyKnob.style.transform = `translate(${dx}px, ${dy}px)`;
    joystickVelocity = (dx / maxRadius) * 2.5;
}

function resetJoystick() {
    joyActive = false;
    joyTouchId = null;
    joystickVelocity = 0;
    joyKnob.style.transform = `translate(0px, 0px)`;
}

joyContainer.addEventListener('touchstart', (e) => {
    joyActive = true;
    joyTouchId = e.changedTouches[0].identifier;
    handleJoystickMove(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
}, { passive: false });

window.addEventListener('touchmove', (e) => {
    if (!joyActive) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === joyTouchId) {
            handleJoystickMove(e.changedTouches[i].clientX, e.changedTouches[i].clientY);
            break;
        }
    }
}, { passive: false });

window.addEventListener('touchend', resetJoystick);
window.addEventListener('touchcancel', resetJoystick);

joyContainer.addEventListener('mousedown', (e) => {
    joyActive = true;
    handleJoystickMove(e.clientX, e.clientY);
});

window.addEventListener('mousemove', (e) => {
    if (joyActive) handleJoystickMove(e.clientX, e.clientY);
});

window.addEventListener('mouseup', () => {
    if (joyActive) resetJoystick();
});

// ==========================================
// MAIN ANIMATION LOOP
// ==========================================
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();

    if (isPaused) {
        renderer.render(scene, camera);
        return;
    }

    if (gameState !== 'REPLAY' && Math.abs(joystickVelocity) > 0.001) {
        orbitTheta -= joystickVelocity * delta;
        updateCameraPosition();
    }

    if (gameState === 'PREP') {
        countdownTimer -= delta;
        document.getElementById('timerBadge').textContent = Math.max(0, Math.ceil(countdownTimer)) + 's';
        if (countdownTimer <= 0) {
            gameState = 'ATTACK';
            document.getElementById('phaseDisplay').textContent = 'IMPACT IN PROGRESS';
            document.getElementById('phaseDisplay').style.borderColor = '#dc2626';
            document.getElementById('phaseDisplay').style.color = '#dc2626';
            updateUI();
        }
    } else if (gameState === 'ATTACK') {
        const speed = (28.0 + currentLevel * 2) * delta;
        if (attackSide === 'LEFT') {
            if (crashCart.position.x < -3.4) {
                crashCart.position.x += speed;
                if (crashCart.position.x >= -3.4) {
                    crashCart.position.x = -3.4;
                    triggerImpactSequence();
                }
            }
        } else {
            if (crashCart.position.x > 3.4) {
                crashCart.position.x -= speed;
                if (crashCart.position.x <= 3.4) {
                    crashCart.position.x = 3.4;
                    triggerImpactSequence();
                }
            }
        }
    } else if (gameState === 'REPLAY') {
        replayClock -= delta;
        document.getElementById('replayClock').textContent = Math.max(0, replayClock).toFixed(1) + 's';

        const targetPos = seatData[focusedReplaySeat].localPos;
        const camXOffset = focusedReplaySeat.endsWith('L') ? 2.4 : -2.4;
        camera.position.x = camXOffset + Math.sin(replayClock * 2) * 0.1;
        camera.position.y = 2.1 + Math.cos(replayClock * 2) * 0.05;
        camera.lookAt(targetPos.x, targetPos.y + 0.8, targetPos.z);

        const occ = seatData[focusedReplaySeat]?.occupant;
        if (occ && occ.mesh) {
            const directionSign = attackSide === 'LEFT' ? 1 : -1;
            occ.mesh.rotation.z = directionSign * (Math.sin(replayClock * 4.5) * 0.35 + 0.15);
            occ.mesh.rotation.x = Math.cos(replayClock * 4.5) * 0.2;
        }

        if (replayClock <= 0) {
            finishLevel();
        }
    }

    if (isJolting && gameState !== 'REPLAY') {
        joltAnimTimer += delta;
        const joltIntensity = Math.sin(joltAnimTimer * 25) * Math.max(0, (1.0 - joltAnimTimer * 1.5));
        const directionSign = attackSide === 'LEFT' ? 1 : -1;

        targetVehicleGroup.rotation.z = directionSign * joltIntensity * 0.12;
        targetVehicleGroup.position.x = directionSign * joltIntensity * 0.25;

        for (let key in seatData) {
            const occ = seatData[key].occupant;
            if (occ && occ.mesh) {
                occ.mesh.rotation.z = directionSign * joltIntensity * 0.35;
                occ.mesh.rotation.x = joltIntensity * 0.2;
            }
        }

        if (joltAnimTimer > 1.0) isJolting = false;
    }

    for (let i = activeFloatingTexts.length - 1; i >= 0; i--) {
        const ft = activeFloatingTexts[i];
        ft.life -= delta;
        ft.worldPos.y += delta * 0.8;

        const screenPos = ft.worldPos.clone().project(camera);
        const x = (screenPos.x * 0.5 + 0.5) * window.innerWidth;
        const y = (-(screenPos.y * 0.5) + 0.5) * window.innerHeight;

        ft.element.style.left = `${x}px`;
        ft.element.style.top = `${y}px`;
        ft.element.style.opacity = `${ft.life / ft.maxLife}`;

        if (ft.life <= 0) {
            ft.element.remove();
            activeFloatingTexts.splice(i, 1);
        }
    }

    renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Start Level 1
initLevel(1);
animate();
