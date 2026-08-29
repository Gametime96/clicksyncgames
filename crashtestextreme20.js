// ==========================================
// SCENE, CAMERA & LIGHTING INITIALIZATION
// ==========================================
const container = document.getElementById('webgl-container');
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
const CAMERA_DISTANCE = 16.0;
const CAMERA_HEIGHT = 7.8;
let orbitTheta = 0;
let joystickVelocity = 0;

function updateCameraPosition() {
    const focusTarget = vehicleRig.position.clone().add(new THREE.Vector3(0, 1.4, 0));
    camera.position.x = focusTarget.x + Math.sin(orbitTheta) * CAMERA_DISTANCE;
    camera.position.z = focusTarget.z + Math.cos(orbitTheta) * CAMERA_DISTANCE;
    camera.position.y = focusTarget.y + CAMERA_HEIGHT;
    camera.lookAt(focusTarget);
}

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
container.appendChild(renderer.domElement);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
scene.add(ambientLight);

const mainSpot = new THREE.DirectionalLight(0xffffff, 1.35);
mainSpot.position.set(20, 30, 20);
mainSpot.castShadow = true;
mainSpot.shadow.mapSize.width = 2048;
mainSpot.shadow.mapSize.height = 2048;
mainSpot.shadow.bias = -0.0001;
scene.add(mainSpot);

const fillLight = new THREE.DirectionalLight(0x93c5fd, 0.55);
fillLight.position.set(-20, 20, -20);
scene.add(fillLight);

// ==========================================
// PROCEDURAL TEXTURES (FRACTURED GLASS, FLOOR, MARKERS)
// ==========================================
function createFracturedGlassTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 512;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = 'rgba(235, 248, 255, 0.82)';
    ctx.fillRect(0, 0, 512, 512);

    const cx = 256, cy = 256;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.lineWidth = 3;

    for (let r = 20; r < 240; r += 28) {
        ctx.beginPath();
        for (let a = 0; a <= Math.PI * 2; a += 0.3) {
            const jitter = (Math.random() - 0.5) * 12;
            const x = cx + Math.cos(a) * (r + jitter);
            const y = cy + Math.sin(a) * (r + jitter);
            if (a === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(203, 213, 225, 0.9)';
    ctx.lineWidth = 2.5;
    for (let i = 0; i < 22; i++) {
        const angle = (i / 22) * Math.PI * 2 + (Math.random() - 0.5) * 0.2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        let currX = cx, currY = cy;
        for (let step = 0; step < 6; step++) {
            const dist = 45 * (step + 1);
            currX = cx + Math.cos(angle) * dist + (Math.random() - 0.5) * 14;
            currY = cy + Math.sin(angle) * dist + (Math.random() - 0.5) * 14;
            ctx.lineTo(currX, currY);
        }
        ctx.stroke();
    }

    return new THREE.CanvasTexture(canvas);
}

function createPavedFloorTexture(isDark = false) {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 512;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = isDark ? '#1e293b' : '#cbd5e1';
    ctx.fillRect(0, 0, 512, 512);

    ctx.strokeStyle = isDark ? '#334155' : '#94a3b8';
    ctx.lineWidth = 4;
    for (let i = 0; i <= 512; i += 64) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 512); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(512, i); ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(10, 10);
    return tex;
}

function createHazardStripeTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#eab308';
    ctx.fillRect(0, 0, 256, 64);
    ctx.fillStyle = '#0f172a';
    ctx.lineWidth = 14;
    for (let i = -100; i < 356; i += 28) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + 32, 64); ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 1);
    return tex;
}

function createCrashDecalTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#facc15'; ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = '#000000';
    ctx.beginPath(); ctx.moveTo(128, 128); ctx.arc(128, 128, 128, 0, Math.PI / 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(128, 128); ctx.arc(128, 128, 128, Math.PI, Math.PI * 1.5); ctx.fill();
    return new THREE.CanvasTexture(canvas);
}

function createRedCautionTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 256, 64);
    ctx.fillStyle = '#dc2626'; ctx.lineWidth = 16;
    for (let i = -100; i < 356; i += 32) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + 40, 64); ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 1);
    return tex;
}

function createTireXTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 18;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(20, 20); ctx.lineTo(108, 108);
    ctx.moveTo(108, 20); ctx.lineTo(20, 108);
    ctx.stroke();
    return new THREE.CanvasTexture(canvas);
}

const targetDecalTex = createCrashDecalTexture();
const redCautionTex = createRedCautionTexture();
const tireXTex = createTireXTexture();
const fracturedGlassTex = createFracturedGlassTexture();
const hazardStripeTex = createHazardStripeTexture();

// Arena Floor & Walls
const floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(140, 140), new THREE.MeshStandardMaterial());
floorMesh.rotation.x = -Math.PI / 2;
floorMesh.receiveShadow = true;
scene.add(floorMesh);

const arenaWalls = new THREE.Group();
scene.add(arenaWalls);
const wallMat = new THREE.MeshStandardMaterial({ roughness: 0.6 });

const backWall = new THREE.Mesh(new THREE.PlaneGeometry(140, 26), wallMat);
backWall.position.set(0, 13, -70);
arenaWalls.add(backWall);

const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(140, 26), wallMat);
leftWall.position.set(-70, 13, 0);
leftWall.rotation.y = Math.PI / 2;
arenaWalls.add(leftWall);

const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(140, 26), wallMat);
rightWall.position.set(70, 13, 0);
rightWall.rotation.y = -Math.PI / 2;
arenaWalls.add(rightWall);

const tireXGroup = new THREE.Group();
scene.add(tireXGroup);
const tireXMat = new THREE.MeshBasicMaterial({ map: tireXTex, transparent: true });
[[-2.1, 2.3], [2.1, 2.3], [-2.1, -2.3], [2.1, -2.3]].forEach(p => {
    const marker = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.3), tireXMat);
    marker.rotation.x = -Math.PI / 2;
    marker.position.set(p[0], 0.015, p[1]);
    tireXGroup.add(marker);
});

// ==========================================
// 3D DUMMY AVATARS
// ==========================================
const dummySkinMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.35 });
const jointMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.5 });
const targetDecalMat = new THREE.MeshStandardMaterial({ map: targetDecalTex, roughness: 0.3 });
const seatbeltMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });

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

    const diagBelt = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.1, 0.04), seatbeltMat);
    diagBelt.position.set(0, 1.1, 0.22);
    diagBelt.rotation.z = -0.45;
    group.add(diagBelt);

    return group;
}

// ==========================================
// 3D VEHICLE
// ==========================================
const vehicleRig = new THREE.Group();
scene.add(vehicleRig);

const targetVehicleGroup = new THREE.Group();
vehicleRig.add(targetVehicleGroup);

const carPaintMat = new THREE.MeshStandardMaterial({ roughness: 0.25, metalness: 0.65 });
const trimMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 });
const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.85 });
const rimMat = new THREE.MeshStandardMaterial({ color: 0xd1d5db, metalness: 0.9, roughness: 0.2 });
const seatMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8 });

function createClearGlassMaterial() {
    return new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.25,
        roughness: 0.05,
        metalness: 0.1,
        transmission: 0.95,
        ior: 1.5
    });
}

function createShatteredGlassMaterial() {
    return new THREE.MeshStandardMaterial({
        map: fracturedGlassTex,
        transparent: true,
        opacity: 0.88,
        roughness: 0.45,
        metalness: 0.2
    });
}

const chassis = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.4, 7.6), trimMat);
chassis.position.y = 0.5;
targetVehicleGroup.add(chassis);

const wheelRigMap = {};
[
    { key: 'FL', pos: [-2.1, 0.6, 2.3] },
    { key: 'FR', pos: [2.1, 0.6, 2.3] },
    { key: 'RL', pos: [-2.1, 0.6, -2.3] },
    { key: 'RR', pos: [2.1, 0.6, -2.3] }
].forEach(wInfo => {
    const wheelGroup = new THREE.Group();
    wheelGroup.position.set(wInfo.pos[0], wInfo.pos[1], wInfo.pos[2]);

    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.45, 24), wheelMat);
    w.rotation.z = Math.PI / 2;
    wheelGroup.add(w);

    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.46, 16), rimMat);
    rim.rotation.z = Math.PI / 2;
    wheelGroup.add(rim);

    targetVehicleGroup.add(wheelGroup);
    wheelRigMap[wInfo.key] = { group: wheelGroup, popped: false, mesh: w };
});

const lowerBodyGeo = new THREE.BoxGeometry(4.0, 1.0, 7.4, 10, 6, 14);
const lowerBody = new THREE.Mesh(lowerBodyGeo, carPaintMat);
lowerBody.position.set(0, 1.1, 0);
targetVehicleGroup.add(lowerBody);

const trunk = new THREE.Mesh(new THREE.BoxGeometry(3.9, 0.8, 1.8), carPaintMat);
trunk.position.set(0, 1.4, -2.7);
targetVehicleGroup.add(trunk);

const hood = new THREE.Mesh(new THREE.BoxGeometry(3.9, 0.8, 2.0), carPaintMat);
hood.position.set(0, 1.4, 2.6);
targetVehicleGroup.add(hood);

const roof = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.12, 3.4), carPaintMat);
roof.position.set(0, 3.15, -0.1);
targetVehicleGroup.add(roof);

[[-1.8, 2.3, 1.5], [1.8, 2.3, 1.5], [-1.8, 2.3, -1.7], [1.8, 2.3, -1.7]].forEach(pos => {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.7, 0.18), carPaintMat);
    pillar.position.set(pos[0], pos[1], pos[2]);
    targetVehicleGroup.add(pillar);
});

const windowMap = {
    front: new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.5, 0.06), createClearGlassMaterial()),
    rear: new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.5, 0.06), createClearGlassMaterial()),
    left: new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.4, 3.2), createClearGlassMaterial()),
    right: new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.4, 3.2), createClearGlassMaterial())
};

windowMap.front.position.set(0, 2.3, 1.5);
windowMap.front.rotation.x = -0.32;
targetVehicleGroup.add(windowMap.front);

windowMap.rear.position.set(0, 2.3, -1.7);
windowMap.rear.rotation.x = 0.32;
targetVehicleGroup.add(windowMap.rear);

windowMap.left.position.set(-1.85, 2.3, -0.1);
targetVehicleGroup.add(windowMap.left);

windowMap.right.position.set(1.85, 2.3, -0.1);
targetVehicleGroup.add(windowMap.right);

const seatData = {
    FL: { label: 'Driver', localPos: new THREE.Vector3(-1.1, 0.7, 0.9), occupant: null },
    FR: { label: 'Front Passenger', localPos: new THREE.Vector3(1.1, 0.7, 0.9), occupant: null }
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
// 3D HAZARD PURSUIT CRASH CART
// ==========================================
const crashCart = new THREE.Group();
scene.add(crashCart);

const cartFrame = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.35, 6.0), trimMat);
cartFrame.position.y = 0.5;
crashCart.add(cartFrame);

const crushBarrier = new THREE.Mesh(
    new THREE.BoxGeometry(3.8, 1.4, 1.4),
    new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.85, roughness: 0.25 })
);
crushBarrier.position.set(0, 1.2, 3.6);
crashCart.add(crushBarrier);

const cautionStripe = new THREE.Mesh(
    new THREE.BoxGeometry(3.82, 0.4, 0.1),
    new THREE.MeshBasicMaterial({ map: redCautionTex })
);
cautionStripe.position.set(0, 1.2, 4.32);
crashCart.add(cautionStripe);

// ==========================================
// TWO-TONE ROTATING COINS & REFERENCE SPIKE STRIP
// ==========================================
const coinsGroup = new THREE.Group();
scene.add(coinsGroup);
const obstaclesGroup = new THREE.Group();
scene.add(obstaclesGroup);

let coinObjects = [];
let spikeStripObjects = [];
let speedBumpObjects = [];
let brickWallObjects = [];

const coinInnerMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.25, metalness: 0.75 });
const coinRingMat = new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.2, metalness: 0.85 });

function buildTwoToneCoin() {
    const coinGroup = new THREE.Group();
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.14, 24), coinInnerMat);
    core.rotation.x = Math.PI / 2;
    coinGroup.add(core);

    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.08, 12, 24), coinRingMat);
    coinGroup.add(rim);
    return coinGroup;
}

const spikeBaseMat = new THREE.MeshStandardMaterial({ map: hazardStripeTex, roughness: 0.4, metalness: 0.2 });
const spikeNeedleMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, metalness: 0.8, roughness: 0.25 });

function buildReferenceSpikeStrip() {
    const stripGroup = new THREE.Group();

    const baseShape = new THREE.Shape();
    baseShape.moveTo(-0.65, 0);
    baseShape.lineTo(-0.38, 0.22);
    baseShape.lineTo(0.38, 0.22);
    baseShape.lineTo(0.65, 0);
    baseShape.closePath();

    const extrudeSettings = { depth: 6.8, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.04, bevelThickness: 0.04 };
    const baseGeo = new THREE.ExtrudeGeometry(baseShape, extrudeSettings);
    const baseMesh = new THREE.Mesh(baseGeo, spikeBaseMat);
    baseMesh.rotation.y = Math.PI / 2;
    baseMesh.position.set(-3.4, 0, 0);
    stripGroup.add(baseMesh);

    const needleGeo = new THREE.ConeGeometry(0.045, 0.55, 8);
    const numNeedles = 24;
    for (let i = 0; i < numNeedles; i++) {
        const needle = new THREE.Mesh(needleGeo, spikeNeedleMat);
        const zOffset = -3.1 + (i / (numNeedles - 1)) * 6.2;
        needle.position.set(0, 0.42, zOffset);
        needle.rotation.x = (Math.random() - 0.5) * 0.15;
        needle.rotation.z = -0.22;
        stripGroup.add(needle);
    }

    return stripGroup;
}

function getScatteredPositions(count, minRadius, maxRadius) {
    const positions = [];
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = minRadius + Math.random() * (maxRadius - minRadius);
        const x = Math.cos(angle) * radius + (Math.random() - 0.5) * 6;
        const z = Math.sin(angle) * radius + (Math.random() - 0.5) * 6;
        positions.push({ x: THREE.MathUtils.clamp(x, -55, 55), z: THREE.MathUtils.clamp(z, -55, 55) });
    }
    return positions;
}

function spawnCoins(count = 20) {
    coinObjects.forEach(c => coinsGroup.remove(c.mesh));
    coinObjects = [];

    const positions = getScatteredPositions(count, 8, 52);
    positions.forEach(p => {
        const coinMesh = buildTwoToneCoin();
        coinMesh.position.set(p.x, 1.0, p.z);
        coinsGroup.add(coinMesh);
        coinObjects.push({ mesh: coinMesh, collected: false });
    });
}

function spawnObstaclesForLevel(lvl) {
    while (obstaclesGroup.children.length > 0) {
        obstaclesGroup.remove(obstaclesGroup.children[0]);
    }
    spikeStripObjects = [];
    speedBumpObjects = [];
    brickWallObjects = [];

    const spikeCount = lvl === 1 ? 6 : 11;
    const spikePositions = getScatteredPositions(spikeCount, 12, 54);

    spikePositions.forEach(p => {
        const strip = buildReferenceSpikeStrip();
        strip.position.set(p.x, 0.01, p.z);
        strip.rotation.y = Math.random() * Math.PI;
        obstaclesGroup.add(strip);
        spikeStripObjects.push(strip);
    });

    const bumpGeo = new THREE.CylinderGeometry(0.9, 0.9, 7.5, 16, 1, false, 0, Math.PI);
    const bumpMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4 });
    const bumpCount = lvl === 1 ? 6 : 9;
    const bumpPositions = getScatteredPositions(bumpCount, 10, 50);

    bumpPositions.forEach(p => {
        const m = new THREE.Mesh(bumpGeo, bumpMat);
        m.rotation.z = Math.PI / 2;
        m.rotation.y = Math.random() * Math.PI;
        m.position.set(p.x, 0.15, p.z);
        obstaclesGroup.add(m);
        speedBumpObjects.push(m);
    });

    if (lvl >= 2) {
        const brickGeo = new THREE.BoxGeometry(5.5, 2.2, 1.2);
        const brickMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.8 });
        const wallPositions = getScatteredPositions(8, 14, 48);

        wallPositions.forEach(p => {
            const m = new THREE.Mesh(brickGeo, brickMat);
            m.position.set(p.x, 1.1, p.z);
            m.rotation.y = Math.random() * Math.PI;
            obstaclesGroup.add(m);
            brickWallObjects.push(m);
        });
    }
}

// ==========================================
// GAME STATE & DRIVING ENGINE
// ==========================================
let currentLevel = 1;
let totalPoints = 0;
let isPaused = false;
let gameState = 'DRIVE';
let vehicleHealth = 100;
let survivalTimer = 10.0;
let activeFloatingTexts = [];

const keysPressed = {};
let carVelocity = 0;
let carAngle = 0;
let carYVelocity = 0;
let carYPos = 0;
const BASE_MAX_SPEED = 28.0;
const ACCEL = 54.0;
const FRICTION = 16.0;
const STEER_SPEED = 3.2;
const GRAVITY = 42.0;
const JUMP_IMPULSE = 15.0;

let carRoll = 0;
let rollVelocity = 0;
let cartAngle = 0;

let hazardStunTimer = 0;
let hazardRecoilSpeed = 0;
const MIN_COLLISION_DISTANCE = 6.4;

function installOccupants() {
    for (let key in seatData) {
        const s = seatData[key];
        if (s.occupant && s.occupant.mesh) targetVehicleGroup.remove(s.occupant.mesh);
        const occMesh = build3DDummy();
        occMesh.position.set(s.localPos.x, s.localPos.y + 0.1, s.localPos.z);
        targetVehicleGroup.add(occMesh);
        s.occupant = {
            health: 100,
            isAxed: false,
            mesh: occMesh
        };
    }
}

function initLevel(lvl) {
    currentLevel = lvl;
    gameState = 'DRIVE';
    isPaused = false;
    vehicleHealth = 100;
    survivalTimer = (lvl === 1) ? 10.0 : 15.0;
    carVelocity = 0;
    carAngle = 0;
    carYVelocity = 0;
    carYPos = 0;
    carRoll = 0;
    rollVelocity = 0;
    hazardStunTimer = 0;
    hazardRecoilSpeed = 0;

    for (let k in wheelRigMap) {
        wheelRigMap[k].popped = false;
        wheelRigMap[k].mesh.scale.set(1, 1, 1);
        document.getElementById(`tire${k}`).className = 'tire-indicator intact';
        document.getElementById(`tire${k}`).textContent = `${k}: OK`;
    }

    for (let winKey in windowMap) {
        windowMap[winKey].material = createClearGlassMaterial();
    }

    if (lvl === 1) {
        scene.background = new THREE.Color(0xe2e8f0);
        scene.fog = new THREE.Fog(0xe2e8f0, 30, 110);
        floorMesh.material.map = createPavedFloorTexture(false);
        floorMesh.material.needsUpdate = true;
        wallMat.color.setHex(0xd1d5db);
        carPaintMat.color.setHex(0x1e3a8a);
    } else {
        scene.background = new THREE.Color(0x0f172a);
        scene.fog = new THREE.Fog(0x0f172a, 30, 110);
        floorMesh.material.map = createPavedFloorTexture(true);
        floorMesh.material.needsUpdate = true;
        wallMat.color.setHex(0x1e293b);
        carPaintMat.color.setHex(0xf8fafc);
    }

    vehicleRig.position.set(0, 0, 0);
    vehicleRig.rotation.set(0, 0, 0);
    targetVehicleGroup.rotation.set(0, 0, 0);

    const posAttr = lowerBodyGeo.attributes.position;
    const baseGeo = new THREE.BoxGeometry(4.0, 1.0, 7.4, 10, 6, 14);
    for (let i = 0; i < posAttr.count; i++) {
        posAttr.setXYZ(i, baseGeo.attributes.position.getX(i), baseGeo.attributes.position.getY(i), baseGeo.attributes.position.getZ(i));
    }
    posAttr.needsUpdate = true;
    lowerBodyGeo.computeVertexNormals();

    crashCart.position.set(38, 0, 38);

    document.getElementById('levelDisplay').textContent = `TIER ${currentLevel} / 7`;
    document.getElementById('warningBeacon').style.display = 'none';
    document.getElementById('workshopModal').style.display = 'none';
    document.getElementById('gameOverModal').style.display = 'none';
    document.getElementById('pauseModal').style.display = 'none';
    document.getElementById('phaseDisplay').textContent = 'COLLECT COINS & EVADE';

    spawnCoins(20);
    spawnObstaclesForLevel(lvl);
    installOccupants();
    updateUI();
    updateCameraPosition();
}

function applyLocalizedDentAndGlassFracture(localHitPoint) {
    const posAttr = lowerBodyGeo.attributes.position;
    const v = new THREE.Vector3();
    const forceRadius = 2.5;
    const maxIndent = 0.6;

    for (let i = 0; i < posAttr.count; i++) {
        v.fromBufferAttribute(posAttr, i);
        const dist = v.distanceTo(localHitPoint);
        if (dist < forceRadius) {
            const factor = (1 - dist / forceRadius) * maxIndent;
            if (Math.abs(localHitPoint.x) > Math.abs(localHitPoint.z)) {
                v.x += (localHitPoint.x > 0 ? -factor : factor);
            } else {
                v.z += (localHitPoint.z > 0 ? -factor : factor);
            }
            posAttr.setXYZ(i, v.x, v.y, v.z);
        }
    }
    posAttr.needsUpdate = true;
    lowerBodyGeo.computeVertexNormals();

    if (Math.abs(localHitPoint.x) > Math.abs(localHitPoint.z)) {
        if (localHitPoint.x < 0) windowMap.left.material = createShatteredGlassMaterial();
        else windowMap.right.material = createShatteredGlassMaterial();
    } else {
        if (localHitPoint.z > 0) windowMap.front.material = createShatteredGlassMaterial();
        else windowMap.rear.material = createShatteredGlassMaterial();
    }
}

function triggerZeroInterceptionImpact(contactNormal) {
    if (hazardStunTimer > 0) return;

    const invRot = vehicleRig.quaternion.clone().invert();
    const localHitPoint = crashCart.position.clone().sub(vehicleRig.position).applyQuaternion(invRot);

    applyLocalizedDentAndGlassFracture(localHitPoint);

    const playerBounceForce = 18.0;
    vehicleRig.position.addScaledVector(contactNormal, 1.2);
    carVelocity = contactNormal.dot(new THREE.Vector3(Math.sin(carAngle), 0, Math.cos(carAngle))) * playerBounceForce;

    hazardStunTimer = 2.0;
    hazardRecoilSpeed = 16.0;
    rollVelocity = (Math.random() < 0.5 ? -1 : 1) * 7.5;

    vehicleHealth = Math.max(0, vehicleHealth - 12);

    for (let key in seatData) {
        const s = seatData[key];
        if (s.occupant && !s.occupant.isAxed) {
            const dmg = 8;
            s.occupant.health = Math.max(0, s.occupant.health - dmg);
            if (s.occupant.health === 0) s.occupant.isAxed = true;
            spawnLevitatingDamage(s.localPos.clone().add(vehicleRig.position), `-${dmg}%`);
        }
    }

    updateUI();
    checkGameOver();
}

function checkGameOver() {
    const allAxed = Object.values(seatData).every(s => !s.occupant || s.occupant.isAxed);
    if (vehicleHealth <= 0 || allAxed) {
        gameState = 'RESOLVED';
        document.getElementById('gameOverModal').style.display = 'flex';
    }
}

function triggerCoinCollection(worldPos) {
    totalPoints += 10;
    document.getElementById('scoreText').textContent = totalPoints;

    const el = document.createElement('div');
    el.className = 'floating-coin-point';
    el.textContent = '+10 PTS';
    document.getElementById('floatingLayer').appendChild(el);

    const screenPos = worldPos.clone().project(camera);
    const startX = (screenPos.x * 0.5 + 0.5) * window.innerWidth;
    const startY = (-(screenPos.y * 0.5) + 0.5) * window.innerHeight;
    el.style.left = `${startX}px`;
    el.style.top = `${startY}px`;

    const pointsBadge = document.getElementById('pointsDisplay');
    const badgeRect = pointsBadge.getBoundingClientRect();
    const targetX = badgeRect.left + badgeRect.width / 2;
    const targetY = badgeRect.top + badgeRect.height / 2;

    requestAnimationFrame(() => {
        el.style.left = `${targetX}px`;
        el.style.top = `${targetY}px`;
        el.style.opacity = '0.1';
    });

    setTimeout(() => {
        el.remove();
    }, 800);
}

function spawnLevitatingDamage(worldPos, text) {
    const el = document.createElement('div');
    el.className = 'levitating-damage';
    el.textContent = text;
    document.getElementById('floatingLayer').appendChild(el);

    activeFloatingTexts.push({
        element: el,
        worldPos: worldPos.clone().add(new THREE.Vector3(0, 1.8, 0)),
        life: 1.5,
        maxLife: 1.5
    });
}

function openWorkshop() {
    gameState = 'RESOLVED';
    document.getElementById('shopPointsText').textContent = `${totalPoints} PTS`;

    const dummyList = document.getElementById('shopDummyList');
    dummyList.innerHTML = '';

    for (let key in seatData) {
        const s = seatData[key];
        if (s.occupant) {
            const row = document.createElement('div');
            row.className = 'shop-item';
            row.innerHTML = `
                <div class="shop-info">
                    <strong>🩹 First Aid: ${s.label}</strong>
                    <span>Health: ${s.occupant.health}% ${s.occupant.isAxed ? '(INCAPACITATED)' : ''}</span>
                </div>
                <button class="btn-shop" id="btnHeal_${key}">20 PTS</button>
            `;
            dummyList.appendChild(row);

            const btn = row.querySelector(`#btnHeal_${key}`);
            btn.disabled = totalPoints < 20 || s.occupant.health >= 100;
            btn.onclick = () => {
                if (totalPoints >= 20 && s.occupant.health < 100) {
                    totalPoints -= 20;
                    s.occupant.health = 100;
                    s.occupant.isAxed = false;
                    document.getElementById('scoreText').textContent = totalPoints;
                    openWorkshop();
                    updateUI();
                }
            };
        }
    }

    const btnCar = document.getElementById('btnShopRepairCar');
    btnCar.disabled = totalPoints < 50 || (vehicleHealth >= 100 && Object.values(windowMap).every(w => !w.material.map));
    btnCar.onclick = () => {
        if (totalPoints >= 50) {
            totalPoints -= 50;
            vehicleHealth = 100;
            for (let winKey in windowMap) {
                windowMap[winKey].material = createClearGlassMaterial();
            }
            document.getElementById('scoreText').textContent = totalPoints;
            openWorkshop();
            updateUI();
        }
    };

    document.getElementById('workshopModal').style.display = 'flex';
}

document.getElementById('btnStartNextTier').onclick = () => {
    if (currentLevel < 2) initLevel(2);
    else initLevel(1);
};

document.getElementById('btnRetryLevel').onclick = () => {
    initLevel(currentLevel);
};

function updateUI() {
    document.getElementById('carHpText').textContent = vehicleHealth + '%';
    document.getElementById('carHpBar').style.width = vehicleHealth + '%';
    document.getElementById('carHpBar').style.backgroundColor = vehicleHealth > 40 ? '#10b981' : '#ef4444';
    document.getElementById('speedometerChip').textContent = `${Math.abs(Math.round(carVelocity * 2.2))} MPH`;

    const rack = document.getElementById('dummyRack');
    rack.innerHTML = '';

    for (let key in seatData) {
        const s = seatData[key];
        if (s.occupant) {
            const card = document.createElement('div');
            card.className = `dummy-card ${s.occupant.isAxed ? 'axed' : ''}`;
            card.innerHTML = `
                <div class="status-line">
                    <strong>👤 ${s.label}</strong>
                    <span class="${s.occupant.isAxed ? 'stat-red' : 'stat-green'}">${s.occupant.isAxed ? '0%' : s.occupant.health + '%'}</span>
                </div>
                <div class="meter-bar">
                    <div class="meter-fill" style="width: ${s.occupant.health}%; background-color: ${s.occupant.health > 40 ? '#10b981' : '#ef4444'}"></div>
                </div>
            `;
            rack.appendChild(card);
        }
    }
}

function togglePause() {
    if (gameState === 'RESOLVED') return;
    isPaused = !isPaused;
    document.getElementById('pauseModal').style.display = isPaused ? 'flex' : 'none';
    document.getElementById('btnPause').textContent = isPaused ? '▶ Resume' : '⏸ Pause';
}

// Telemetry Panel Toggle on Mobile
const btnToggleTelemetry = document.getElementById('btnToggleTelemetry');
const telemetryPanel = document.getElementById('telemetryPanel');

btnToggleTelemetry.onclick = () => {
    telemetryPanel.classList.toggle('mobile-visible');
};

// ==========================================
// CONTROLS & BINDINGS (RELIABLE MULTI-TOUCH)
// ==========================================
window.addEventListener('keydown', (e) => {
    if (e.key === 'p' || e.key === 'P') togglePause();
    
    const k = e.key.toLowerCase();
    keysPressed[k] = true;
    keysPressed[e.code] = true;

    if (e.key === ' ' && carYPos === 0) {
        e.preventDefault();
        carYVelocity = JUMP_IMPULSE;
    }
});

window.addEventListener('keyup', (e) => {
    const k = e.key.toLowerCase();
    keysPressed[k] = false;
    keysPressed[e.code] = false;
});

document.getElementById('btnJump').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (carYPos === 0 && !isPaused && gameState === 'DRIVE') {
        carYVelocity = JUMP_IMPULSE;
    }
});

function bindDpad(btnId, keyName) {
    const el = document.getElementById(btnId);
    
    const on = (e) => { 
        e.preventDefault(); 
        keysPressed[keyName] = true;
        el.classList.add('active');
    };
    const off = (e) => { 
        e.preventDefault(); 
        keysPressed[keyName] = false; 
        el.classList.remove('active');
    };

    el.addEventListener('pointerdown', on);
    el.addEventListener('pointerup', off);
    el.addEventListener('pointerleave', off);
    el.addEventListener('pointercancel', off);
}
bindDpad('btnDriveFwd', 'w');
bindDpad('btnDriveRev', 's');
bindDpad('btnDriveLeft', 'a');
bindDpad('btnDriveRight', 'd');

// Virtual Joystick (Orbit View)
const joyContainer = document.getElementById('joyContainer');
const joyKnob = document.getElementById('joyKnob');
let joyActive = false;

function handleJoy(clientX, clientY) {
    const rect = joyContainer.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const maxRadius = rect.width / 2 - 6;

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

joyContainer.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    joyActive = true;
    joyContainer.setPointerCapture(e.pointerId);
    handleJoy(e.clientX, e.clientY);
});
joyContainer.addEventListener('pointermove', (e) => {
    if (joyActive) {
        e.preventDefault();
        handleJoy(e.clientX, e.clientY);
    }
});
const endJoy = (e) => {
    if (joyActive) {
        joyActive = false;
        joystickVelocity = 0;
        joyKnob.style.transform = `translate(0px, 0px)`;
    }
};
joyContainer.addEventListener('pointerup', endJoy);
joyContainer.addEventListener('pointercancel', endJoy);

document.getElementById('btnPause').onclick = togglePause;
document.getElementById('btnResume').onclick = togglePause;

// ==========================================
// MAIN SIMULATION & ANIMATION LOOP
// ==========================================
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const delta = Math.min(clock.getDelta(), 0.1);

    if (isPaused) {
        renderer.render(scene, camera);
        return;
    }

    if (Math.abs(joystickVelocity) > 0.001) {
        orbitTheta -= joystickVelocity * delta;
    }
    updateCameraPosition();

    coinObjects.forEach(c => {
        if (!c.collected) c.mesh.rotation.y += 1.8 * delta;
    });

    if (gameState === 'DRIVE') {
        survivalTimer -= delta;
        document.getElementById('survivalTimerText').textContent = `${Math.max(0, survivalTimer).toFixed(1)}s`;
        if (survivalTimer <= 0) {
            openWorkshop();
            return;
        }

        let fwdInput = 0;
        let steerInput = 0;

        if (keysPressed['w'] || keysPressed['arrowup'] || keysPressed['KeyW'] || keysPressed['ArrowUp']) fwdInput += 1;
        if (keysPressed['s'] || keysPressed['arrowdown'] || keysPressed['KeyS'] || keysPressed['ArrowDown']) fwdInput -= 1;
        if (keysPressed['a'] || keysPressed['arrowleft'] || keysPressed['KeyA'] || keysPressed['ArrowLeft']) steerInput += 1;
        if (keysPressed['d'] || keysPressed['arrowright'] || keysPressed['KeyD'] || keysPressed['ArrowRight']) steerInput -= 1;

        let poppedCount = Object.values(wheelRigMap).filter(w => w.popped).length;
        const currentMaxSpeed = BASE_MAX_SPEED * (1.0 - poppedCount * 0.18);

        if (steerInput !== 0) {
            const steerDir = (carVelocity < -0.2) ? -1 : 1;
            carAngle += steerInput * STEER_SPEED * steerDir * delta;
            vehicleRig.rotation.y = carAngle;
        }

        if (fwdInput !== 0) {
            carVelocity += fwdInput * ACCEL * delta;
            carVelocity = THREE.MathUtils.clamp(carVelocity, -currentMaxSpeed * 0.6, currentMaxSpeed);
        } else {
            if (carVelocity > 0) carVelocity = Math.max(0, carVelocity - FRICTION * delta);
            else if (carVelocity < 0) carVelocity = Math.min(0, carVelocity + FRICTION * delta);
        }

        const fwdX = Math.sin(carAngle);
        const fwdZ = Math.cos(carAngle);
        vehicleRig.position.x += fwdX * carVelocity * delta;
        vehicleRig.position.z += fwdZ * carVelocity * delta;

        if (carYPos > 0 || carYVelocity !== 0) {
            carYVelocity -= GRAVITY * delta;
            carYPos += carYVelocity * delta;
            if (carYPos <= 0) {
                carYPos = 0;
                carYVelocity = 0;
            }
            vehicleRig.position.y = carYPos;
        }

        if (Math.abs(rollVelocity) > 0.01 || Math.abs(carRoll) > 0.01) {
            carRoll += rollVelocity * delta;
            rollVelocity -= carRoll * 20.0 * delta;
            rollVelocity *= 0.92;
            targetVehicleGroup.rotation.z = carRoll;
        }

        vehicleRig.position.x = THREE.MathUtils.clamp(vehicleRig.position.x, -58, 58);
        vehicleRig.position.z = THREE.MathUtils.clamp(vehicleRig.position.z, -58, 58);

        // 1. Coins Collection
        coinObjects.forEach(c => {
            if (!c.collected && vehicleRig.position.distanceTo(c.mesh.position) < 2.5) {
                c.collected = true;
                c.mesh.visible = false;
                triggerCoinCollection(c.mesh.position);
            }
        });

        // 2. Spike Strips
        if (carYPos < 0.4) {
            spikeStripObjects.forEach(spike => {
                if (vehicleRig.position.distanceTo(spike.position) < 3.4) {
                    for (let k in wheelRigMap) {
                        if (!wheelRigMap[k].popped && Math.random() < 0.25) {
                            wheelRigMap[k].popped = true;
                            wheelRigMap[k].mesh.scale.set(1, 0.4, 1);
                            document.getElementById(`tire${k}`).className = 'tire-indicator popped';
                            document.getElementById(`tire${k}`).textContent = `${k}: POPPED`;
                        }
                    }
                }
            });
        }

        // 3. Speed Bumps
        if (carYPos < 0.3) {
            speedBumpObjects.forEach(bump => {
                if (vehicleRig.position.distanceTo(bump.position) < 2.8) {
                    if (Math.abs(carVelocity) > 10.0 && carYPos === 0) {
                        carYVelocity = 6.5;
                    }
                }
            });
        }

        // 4. Brick Walls
        brickWallObjects.forEach(wall => {
            if (vehicleRig.position.distanceTo(wall.position) < 3.8) {
                carVelocity = -carVelocity * 0.5;
                vehicleHealth = Math.max(0, vehicleHealth - 5);
                updateUI();
                checkGameOver();
            }
        });

        // Hazard Pursuit Cart AI
        const currentDiff = vehicleRig.position.clone().sub(crashCart.position);
        const currentDist = currentDiff.length();

        const beacon = document.getElementById('warningBeacon');
        if (currentDist < 22.0 && hazardStunTimer <= 0) {
            beacon.style.display = 'block';
            const screenPos = crashCart.position.clone().add(new THREE.Vector3(0, 2.5, 0)).project(camera);
            const x = (screenPos.x * 0.5 + 0.5) * window.innerWidth;
            const y = (-(screenPos.y * 0.5) + 0.5) * window.innerHeight;
            beacon.style.left = `${x}px`;
            beacon.style.top = `${y}px`;
        } else {
            beacon.style.display = 'none';
        }

        if (hazardStunTimer > 0) {
            hazardStunTimer -= delta;
            hazardRecoilSpeed = Math.max(0, hazardRecoilSpeed - 8.0 * delta);
            const recoilDir = new THREE.Vector3(Math.sin(cartAngle), 0, Math.cos(cartAngle)).negate();
            crashCart.position.addScaledVector(recoilDir, hazardRecoilSpeed * delta);
        } else {
            let targetDirection = new THREE.Vector3(currentDiff.x, 0, currentDiff.z).normalize();

            brickWallObjects.forEach(wall => {
                const toWall = wall.position.clone().sub(crashCart.position);
                const wallDist = toWall.length();
                if (wallDist < 9.0) {
                    const avoidNormal = crashCart.position.clone().sub(wall.position).normalize();
                    targetDirection.addScaledVector(avoidNormal, (9.0 - wallDist) * 0.8);
                }
            });

            spikeStripObjects.forEach(spike => {
                const toSpike = spike.position.clone().sub(crashCart.position);
                const spikeDist = toSpike.length();
                if (spikeDist < 7.0) {
                    const avoidNormal = crashCart.position.clone().sub(spike.position).normalize();
                    targetDirection.addScaledVector(avoidNormal, (7.0 - spikeDist) * 0.5);
                }
            });

            targetDirection.normalize();
            cartAngle = Math.atan2(targetDirection.x, targetDirection.z);
            crashCart.rotation.y = cartAngle;

            const cartSpeed = (BASE_MAX_SPEED + 2.0) * delta;
            const intendedMovement = new THREE.Vector3(Math.sin(cartAngle), 0, Math.cos(cartAngle)).multiplyScalar(cartSpeed);
            const nextCartPos = crashCart.position.clone().add(intendedMovement);
            const nextDist = vehicleRig.position.distanceTo(nextCartPos);

            if (nextDist <= MIN_COLLISION_DISTANCE) {
                const contactNormal = currentDiff.clone().normalize();
                crashCart.position.copy(vehicleRig.position).sub(contactNormal.clone().multiplyScalar(MIN_COLLISION_DISTANCE));
                triggerZeroInterceptionImpact(contactNormal);
            } else {
                crashCart.position.copy(nextCartPos);
            }
        }

        crashCart.position.x = THREE.MathUtils.clamp(crashCart.position.x, -58, 58);
        crashCart.position.z = THREE.MathUtils.clamp(crashCart.position.z, -58, 58);

        brickWallObjects.forEach(wall => {
            const distToWall = crashCart.position.distanceTo(wall.position);
            if (distToWall < 4.0) {
                const pushOut = crashCart.position.clone().sub(wall.position).normalize();
                crashCart.position.copy(wall.position).add(pushOut.multiplyScalar(4.0));
            }
        });

        const postDiff = vehicleRig.position.clone().sub(crashCart.position);
        const postDist = postDiff.length();
        if (postDist < MIN_COLLISION_DISTANCE) {
            const pushDir = postDiff.clone().normalize();
            crashCart.position.copy(vehicleRig.position).sub(pushDir.multiplyScalar(MIN_COLLISION_DISTANCE));
        }

        updateUI();
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

function handleResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
}

window.addEventListener('resize', handleResize);
window.addEventListener('orientationchange', () => {
    setTimeout(handleResize, 150);
});

// Initialize Level 1
initLevel(1);
animate();
