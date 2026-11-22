// --- 3D Billiards Game 2026 (High-Definition PBR 8-Ball Engine) ---

const TABLE_WIDTH = 14;
const TABLE_LENGTH = 28;
const CUSHION_THICKNESS = 0.28;
const BALL_RADIUS = 0.45;
const FRICTION = 0.990;
const POCKET_RADIUS = 1.25;
const SUB_STEPS = 12;

let scene, camera, renderer;
let balls = [];
let cueBall;
let cueStickGroup, cueStickMesh;
let aimDots = [];
let feltMesh, cushionMeshGroup = [];

let aimAngle = 0; // 0 rad = straight ahead (-Z) toward rack
let power = 0;
let isCharging = false;
let canShoot = true;
let isPaused = false;
let isDraggingDial = false;
let cameraMode = 'locked'; // 'locked' or 'overhead'

// Match Mode & 8-Ball Turn / Suit State
let gameMode = '2p'; // '2p' or 'cpu'
let currentTurn = 1; // 1 = Player 1, 2 = Player 2 or Computer
let playerSuits = { 1: null, 2: null }; // 'SOLIDS' or 'STRIPES'
let isBreakShot = true;
let shotInProgress = false;
let pocketedThisTurn = [];
let cueBallPocketed = false;
let cueRespawnTimer = null;
let cpuThinkingTimer = null;
let matchOver = false;

let selectedTheme = 'green';
let selectedCue = 'default';

// --- Web Audio API Sound Synthesizer ---
let audioCtx = null;
let isMuted = false;
let lastBallClackTime = 0;
let lastCushionSoundTime = 0;

function ensureAudioContext() {
    if (!audioCtx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) audioCtx = new AudioCtx();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function playCueStrikeSound(powerRatio = 0.6) {
    if (isMuted) return;
    ensureAudioContext();
    if (!audioCtx) return;

    const now = audioCtx.currentTime;
    const vol = Math.min(0.65, 0.18 + powerRatio * 0.45);

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(240 + powerRatio * 120, now);
    osc.frequency.exponentialRampToValueAtTime(75, now + 0.065);
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.07);

    const clickOsc = audioCtx.createOscillator();
    const clickGain = audioCtx.createGain();
    clickOsc.type = 'sine';
    clickOsc.frequency.setValueAtTime(1950 + powerRatio * 500, now);
    clickOsc.frequency.exponentialRampToValueAtTime(780, now + 0.025);
    clickGain.gain.setValueAtTime(vol * 0.55, now);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
    clickOsc.connect(clickGain);
    clickGain.connect(audioCtx.destination);
    clickOsc.start(now);
    clickOsc.stop(now + 0.03);
}

function playBallCollisionSound(impactSpeed) {
    if (isMuted || !audioCtx) return;
    const now = audioCtx.currentTime;
    if (now - lastBallClackTime < 0.018) return;
    lastBallClackTime = now;

    const intensity = Math.min(1.0, Math.max(0.08, impactSpeed * 0.85));

    const osc1 = audioCtx.createOscillator();
    const osc2 = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc1.type = 'sine';
    osc2.type = 'triangle';
    const baseFreq = 2350 + Math.random() * 260;
    osc1.frequency.setValueAtTime(baseFreq, now);
    osc1.frequency.exponentialRampToValueAtTime(1180, now + 0.032);

    osc2.frequency.setValueAtTime(baseFreq * 1.48, now);
    osc2.frequency.exponentialRampToValueAtTime(1600, now + 0.024);

    gain.gain.setValueAtTime(intensity * 0.42, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.036);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(audioCtx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.036);
    osc2.stop(now + 0.036);
}

function playCushionBounceSound(speed) {
    if (isMuted || !audioCtx) return;
    const now = audioCtx.currentTime;
    if (now - lastCushionSoundTime < 0.035) return;
    lastCushionSoundTime = now;

    const intensity = Math.min(0.4, Math.max(0.05, speed * 0.35));
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(145, now);
    osc.frequency.exponentialRampToValueAtTime(58, now + 0.06);
    gain.gain.setValueAtTime(intensity, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.065);
}

function playPocketDropAndRollSound() {
    if (isMuted) return;
    ensureAudioContext();
    if (!audioCtx) return;

    const now = audioCtx.currentTime;
    const rollDuration = 2.5;

    const dropOsc = audioCtx.createOscillator();
    const dropGain = audioCtx.createGain();
    dropOsc.type = 'sine';
    dropOsc.frequency.setValueAtTime(175, now);
    dropOsc.frequency.exponentialRampToValueAtTime(52, now + 0.16);
    dropGain.gain.setValueAtTime(0.42, now);
    dropGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    dropOsc.connect(dropGain);
    dropGain.connect(audioCtx.destination);
    dropOsc.start(now);
    dropOsc.stop(now + 0.18);

    const bufferSize = Math.floor(audioCtx.sampleRate * rollDuration);
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        const t = i / audioCtx.sampleRate;
        const wobble = 0.75 + 0.25 * Math.sin(t * 28);
        data[i] = (Math.random() * 2 - 1) * wobble;
    }

    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;

    const bandpass = audioCtx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.setValueAtTime(340, now + 0.12);
    bandpass.frequency.linearRampToValueAtTime(210, now + rollDuration);
    bandpass.Q.setValueAtTime(3.2, now + 0.12);

    const rollGain = audioCtx.createGain();
    rollGain.gain.setValueAtTime(0.001, now);
    rollGain.gain.linearRampToValueAtTime(0.24, now + 0.22);
    rollGain.gain.setValueAtTime(0.20, now + 1.5);
    rollGain.gain.exponentialRampToValueAtTime(0.001, now + rollDuration);

    noise.connect(bandpass);
    bandpass.connect(rollGain);
    rollGain.connect(audioCtx.destination);
    noise.start(now + 0.10);
    noise.stop(now + rollDuration);

    const settleTime = now + rollDuration - 0.08;
    const settleOsc = audioCtx.createOscillator();
    const settleGain = audioCtx.createGain();
    settleOsc.type = 'triangle';
    settleOsc.frequency.setValueAtTime(1450, settleTime);
    settleOsc.frequency.exponentialRampToValueAtTime(620, settleTime + 0.04);
    settleGain.gain.setValueAtTime(0.22, settleTime);
    settleGain.gain.exponentialRampToValueAtTime(0.001, settleTime + 0.045);
    settleOsc.connect(settleGain);
    settleGain.connect(audioCtx.destination);
    settleOsc.start(settleTime);
    settleOsc.stop(settleTime + 0.045);
}

const THEME_COLORS = {
    green: 0x0e6b3a,
    grey: 0x64748b,
    purple: 0x4c1d95,
    red: 0x881337,
    blue: 0x1e3a8a
};

const CUSHION_COLORS = {
    green: 0x094726,
    grey: 0x475569,
    purple: 0x3b0764,
    red: 0x5c0b24,
    blue: 0x172554
};

const CUE_SPECS = {
    default: { powerMult: 0.038, sensitivity: 1.0 },
    white:   { powerMult: 0.048, sensitivity: 1.0 },
    black:   { powerMult: 0.038, sensitivity: 0.5 }
};

const BALL_DEFS = [
    { num: 0,  color: "#f8fafc", stripe: false },
    { num: 1,  color: "#eab308", stripe: false },
    { num: 2,  color: "#1d4ed8", stripe: false },
    { num: 3,  color: "#dc2626", stripe: false },
    { num: 4,  color: "#6d28d9", stripe: false },
    { num: 5,  color: "#ea580c", stripe: false },
    { num: 6,  color: "#15803d", stripe: false },
    { num: 7,  color: "#7f1d1d", stripe: false },
    { num: 8,  color: "#111827", stripe: false },
    { num: 9,  color: "#eab308", stripe: true  },
    { num: 10, color: "#1d4ed8", stripe: true  },
    { num: 11, color: "#dc2626", stripe: true  },
    { num: 12, color: "#6d28d9", stripe: true  },
    { num: 13, color: "#ea580c", stripe: true  },
    { num: 14, color: "#15803d", stripe: true  },
    { num: 15, color: "#7f1d1d", stripe: true  }
];

function init() {
    const container = document.getElementById('game-container');

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x060911);
    scene.fog = new THREE.FogExp2(0x060911, 0.010);

    camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.1, 1000);

    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.appendChild(renderer.domElement);

    const hemiLight = new THREE.HemisphereLight(0xf8fafc, 0x0f172a, 0.65);
    scene.add(hemiLight);

    const overheadSpot1 = new THREE.SpotLight(0xfffbeb, 1.15);
    overheadSpot1.position.set(0, 26, -6);
    overheadSpot1.angle = Math.PI / 3.2;
    overheadSpot1.penumbra = 0.65;
    overheadSpot1.decay = 1.2;
    overheadSpot1.castShadow = true;
    overheadSpot1.shadow.mapSize.width = 2048;
    overheadSpot1.shadow.mapSize.height = 2048;
    overheadSpot1.shadow.bias = -0.0004;
    overheadSpot1.target.position.set(0, 0, -5);
    scene.add(overheadSpot1);
    scene.add(overheadSpot1.target);

    const overheadSpot2 = new THREE.SpotLight(0xfffbeb, 1.15);
    overheadSpot2.position.set(0, 26, 6);
    overheadSpot2.angle = Math.PI / 3.2;
    overheadSpot2.penumbra = 0.65;
    overheadSpot2.decay = 1.2;
    overheadSpot2.castShadow = true;
    overheadSpot2.shadow.mapSize.width = 2048;
    overheadSpot2.shadow.mapSize.height = 2048;
    overheadSpot2.shadow.bias = -0.0004;
    overheadSpot2.target.position.set(0, 0, 5);
    scene.add(overheadSpot2);
    scene.add(overheadSpot2.target);

    const rimLight = new THREE.DirectionalLight(0x93c5fd, 0.35);
    rimLight.position.set(18, 16, 14);
    scene.add(rimLight);

    createTable();
    createBalls();
    createCueStick();
    createAimStream();

    setupModalUI();
    setupDialControls();
    setupEvents();
    updateTurnSuitDisplay();

    animate();
}

function getActivePlayerName(turnNum = currentTurn) {
    if (turnNum === 1) return 'Player 1';
    return gameMode === 'cpu' ? 'Computer' : 'Player 2';
}

function updateTurnSuitDisplay() {
    const badge = document.getElementById('turn-suit-badge');
    if (!badge) return;

    const name = getActivePlayerName(currentTurn);
    const suit = playerSuits[currentTurn];

    if (suit) {
        badge.textContent = `${name}: ${suit}`;
    } else {
        badge.textContent = `${name}: OPEN TABLE`;
    }
}

function setHumanControlsEnabled(enabled) {
    const dialPanel = document.getElementById('dial-panel');
    const rightControls = document.getElementById('right-controls-stack');
    const opacity = enabled ? '1' : '0.50';
    const pointer = enabled ? 'auto' : 'none';
    if (dialPanel) {
        dialPanel.style.opacity = opacity;
        dialPanel.style.pointerEvents = pointer;
    }
    if (rightControls) {
        const actionPanel = document.getElementById('action-panel');
        if (actionPanel) {
            actionPanel.style.opacity = opacity;
            actionPanel.style.pointerEvents = pointer;
        }
    }
}

function createFeltTextures() {
    const size = 512;
    const colorCanvas = document.createElement('canvas');
    colorCanvas.width = size;
    colorCanvas.height = size;
    const cCtx = colorCanvas.getContext('2d');

    const bumpCanvas = document.createElement('canvas');
    bumpCanvas.width = size;
    bumpCanvas.height = size;
    const bCtx = bumpCanvas.getContext('2d');

    cCtx.fillStyle = '#e8e8e8';
    cCtx.fillRect(0, 0, size, size);

    bCtx.fillStyle = '#808080';
    bCtx.fillRect(0, 0, size, size);

    for (let y = 0; y < size; y += 2) {
        for (let x = 0; x < size; x += 2) {
            const weave = ((x + y) % 4 === 0) ? 10 : -10;
            const noise = (Math.random() - 0.5) * 26 + weave;
            const cVal = Math.max(200, Math.min(255, 236 + noise));
            cCtx.fillStyle = `rgb(${cVal},${cVal},${cVal})`;
            cCtx.fillRect(x, y, 2, 2);

            const bVal = Math.max(0, Math.min(255, 128 + noise * 2.2));
            bCtx.fillStyle = `rgb(${bVal},${bVal},${bVal})`;
            bCtx.fillRect(x, y, 2, 2);
        }
    }

    const map = new THREE.CanvasTexture(colorCanvas);
    map.wrapS = THREE.RepeatWrapping;
    map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(0.55, 0.55);

    const bumpMap = new THREE.CanvasTexture(bumpCanvas);
    bumpMap.wrapS = THREE.RepeatWrapping;
    bumpMap.wrapT = THREE.RepeatWrapping;
    bumpMap.repeat.set(0.55, 0.55);

    return { map, bumpMap };
}

function createWoodTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    const grad = ctx.createLinearGradient(0, 0, 512, 0);
    grad.addColorStop(0, '#4a1d08');
    grad.addColorStop(0.5, '#63290d');
    grad.addColorStop(1, '#3d1605');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    for (let i = 0; i < 420; i++) {
        const x = Math.random() * 512;
        const alpha = 0.04 + Math.random() * 0.09;
        ctx.strokeStyle = i % 2 === 0 ? `rgba(25, 8, 2, ${alpha})` : `rgba(145, 72, 28, ${alpha})`;
        ctx.lineWidth = 1 + Math.random() * 2.5;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.bezierCurveTo(
            x + (Math.random() - 0.5) * 18, 170,
            x + (Math.random() - 0.5) * 18, 340,
            x + (Math.random() - 0.5) * 10, 512
        );
        ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
}

function createBallTexture(def) {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = def.stripe ? "#f8fafc" : def.color;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (def.stripe) {
        ctx.fillStyle = def.color;
        ctx.fillRect(0, 104, canvas.width, 304);

        ctx.fillStyle = "rgba(0,0,0,0.18)";
        ctx.fillRect(0, 102, canvas.width, 4);
        ctx.fillRect(0, 406, canvas.width, 4);
    }

    if (def.num > 0) {
        [256, 768].forEach(x => {
            ctx.beginPath();
            ctx.arc(x, 256, 86, 0, Math.PI * 2);
            ctx.fillStyle = "#ffffff";
            ctx.fill();

            ctx.lineWidth = 5;
            ctx.strokeStyle = "#1e293b";
            ctx.stroke();

            ctx.fillStyle = "#090d16";
            ctx.font = "900 84px 'Segoe UI', Arial, sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(def.num.toString(), x, 260);
        });
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.anisotropy = 4;
    return texture;
}

function createTable() {
    const { map: feltMap, bumpMap: feltBump } = createFeltTextures();

    const halfW = TABLE_WIDTH / 2;   // 7
    const halfL = TABLE_LENGTH / 2;  // 14
    const borderThick = 1.45;
    const borderHeight = 0.56;
    const outerHalfW = halfW + borderThick;
    const outerHalfL = halfL + borderThick;

    // 1. Pitch-Black Recessed Pocket Void Floor Under the Entire Table
    const voidFloorGeo = new THREE.BoxGeometry(outerHalfW * 2 - 0.1, 0.35, outerHalfL * 2 - 0.1);
    const voidFloorMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const voidFloor = new THREE.Mesh(voidFloorGeo, voidFloorMat);
    voidFloor.position.y = -0.35;
    scene.add(voidFloor);

    // 2. Extruded Felt Bed with True Carved Semicircular Pocket Notches
    const rCorner = POCKET_RADIUS * 0.96;
    const rSide = POCKET_RADIUS * 0.88;
    const feltShape = new THREE.Shape();

    feltShape.moveTo(-halfW + rCorner, halfL);
    feltShape.lineTo(halfW - rCorner, halfL);
    feltShape.absarc(halfW, halfL, rCorner, Math.PI, Math.PI * 1.5, false);
    feltShape.lineTo(halfW, rSide);
    feltShape.absarc(halfW + 0.12, 0, rSide, Math.PI * 0.5, Math.PI * 1.5, false);
    feltShape.lineTo(halfW, -halfL + rCorner);
    feltShape.absarc(halfW, -halfL, rCorner, Math.PI * 0.5, Math.PI, false);
    feltShape.lineTo(-halfW + rCorner, -halfL);
    feltShape.absarc(-halfW, -halfL, rCorner, 0, Math.PI * 0.5, false);
    feltShape.lineTo(-halfW, -rSide);
    feltShape.absarc(-halfW - 0.12, 0, rSide, -Math.PI * 0.5, Math.PI * 0.5, false);
    feltShape.lineTo(-halfW, halfL - rCorner);
    feltShape.absarc(-halfW, halfL, rCorner, -Math.PI * 0.5, 0, false);

    const feltGeo = new THREE.ExtrudeGeometry(feltShape, {
        depth: 0.25,
        bevelEnabled: false,
        curveSegments: 32
    });
    feltGeo.rotateX(-Math.PI / 2);

    const feltMat = new THREE.MeshStandardMaterial({
        color: THEME_COLORS[selectedTheme],
        map: feltMap,
        bumpMap: feltBump,
        bumpScale: 0.025,
        roughness: 0.85,
        metalness: 0.02
    });
    feltMesh = new THREE.Mesh(feltGeo, feltMat);
    feltMesh.position.y = -0.25;
    feltMesh.receiveShadow = true;
    scene.add(feltMesh);

    // Subtle Head String & Foot Spot Markings on Felt
    const lineMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.16
    });
    const headLine = new THREE.Mesh(new THREE.PlaneGeometry(TABLE_WIDTH - 1.0, 0.04), lineMat);
    headLine.rotation.x = -Math.PI / 2;
    headLine.position.set(0, 0.003, 7);
    scene.add(headLine);

    const footSpot = new THREE.Mesh(new THREE.CircleGeometry(0.11, 20), lineMat);
    footSpot.rotation.x = -Math.PI / 2;
    footSpot.position.set(0, 0.003, -6);
    scene.add(footSpot);

    // 3. Inner Rubber Cushion Bumpers
    const cushionMat = new THREE.MeshStandardMaterial({
        color: CUSHION_COLORS[selectedTheme],
        roughness: 0.72
    });
    cushionMeshGroup = [];

    const sideCushionLen = (TABLE_LENGTH / 2) - (POCKET_RADIUS * 2.15);
    [-1, 1].forEach(side => {
        [-1, 1].forEach(half => {
            const cGeo = new THREE.BoxGeometry(CUSHION_THICKNESS, 0.44, sideCushionLen);
            const cushion = new THREE.Mesh(cGeo, cushionMat);
            cushion.position.set(
                side * (halfW - CUSHION_THICKNESS / 2),
                0.22,
                half * (TABLE_LENGTH / 4)
            );
            cushion.castShadow = true;
            cushion.receiveShadow = true;
            scene.add(cushion);
            cushionMeshGroup.push(cushion);
        });
    });

    const endCushionLen = TABLE_WIDTH - (POCKET_RADIUS * 2.65);
    [-1, 1].forEach(end => {
        const eGeo = new THREE.BoxGeometry(endCushionLen, 0.44, CUSHION_THICKNESS);
        const cushion = new THREE.Mesh(eGeo, cushionMat);
        cushion.position.set(0, 0.22, end * (halfL - CUSHION_THICKNESS / 2));
        cushion.castShadow = true;
        cushion.receiveShadow = true;
        scene.add(cushion);
        cushionMeshGroup.push(cushion);
    });

    // 4. Segmented Mahogany Wood Rails + Outer Perimeter Skirt
    const woodTex = createWoodTexture();
    const woodMat = new THREE.MeshStandardMaterial({
        map: woodTex,
        roughness: 0.28,
        metalness: 0.08
    });

    const outerSkirtThick = 0.36;
    const outerSkirtLong = new THREE.Mesh(
        new THREE.BoxGeometry(outerSkirtThick, borderHeight + 0.20, outerHalfL * 2),
        woodMat
    );
    outerSkirtLong.position.set(-outerHalfW + outerSkirtThick / 2, (borderHeight - 0.20) / 2, 0);
    outerSkirtLong.castShadow = true;
    outerSkirtLong.receiveShadow = true;
    scene.add(outerSkirtLong);

    const outerSkirtRight = outerSkirtLong.clone();
    outerSkirtRight.position.x = outerHalfW - outerSkirtThick / 2;
    scene.add(outerSkirtRight);

    const outerSkirtTop = new THREE.Mesh(
        new THREE.BoxGeometry(outerHalfW * 2, borderHeight + 0.20, outerSkirtThick),
        woodMat
    );
    outerSkirtTop.position.set(0, (borderHeight - 0.20) / 2, -outerHalfL + outerSkirtThick / 2);
    outerSkirtTop.castShadow = true;
    outerSkirtTop.receiveShadow = true;
    scene.add(outerSkirtTop);

    const outerSkirtBottom = outerSkirtTop.clone();
    outerSkirtBottom.position.z = outerHalfL - outerSkirtThick / 2;
    scene.add(outerSkirtBottom);

    const sideRailSegLen = halfL - POCKET_RADIUS * 2.05;
    [-1, 1].forEach(side => {
        [-1, 1].forEach(half => {
            const segGeo = new THREE.BoxGeometry(borderThick, borderHeight, sideRailSegLen);
            const seg = new THREE.Mesh(segGeo, woodMat);
            seg.position.set(
                side * (halfW + borderThick / 2),
                borderHeight / 2,
                half * (halfL / 2)
            );
            seg.castShadow = true;
            seg.receiveShadow = true;
            scene.add(seg);
        });
    });

    const endRailSegLen = TABLE_WIDTH - POCKET_RADIUS * 2.30;
    [-1, 1].forEach(end => {
        const endGeo = new THREE.BoxGeometry(endRailSegLen, borderHeight, borderThick);
        const seg = new THREE.Mesh(endGeo, woodMat);
        seg.position.set(0, borderHeight / 2, end * (halfL + borderThick / 2));
        seg.castShadow = true;
        seg.receiveShadow = true;
        scene.add(seg);
    });

    // Mother-of-Pearl Diamond Aiming Sights Along the Rails
    const pearlMat = new THREE.MeshStandardMaterial({
        color: 0xfefce8,
        emissive: 0xfef08a,
        emissiveIntensity: 0.15,
        roughness: 0.2,
        metalness: 0.3
    });
    const sightGeo = new THREE.OctahedronGeometry(0.11, 0);
    sightGeo.scale(1, 0.3, 1);

    [-1, 1].forEach(side => {
        [-10.5, -7, -3.5, 3.5, 7, 10.5].forEach(zPos => {
            const sight = new THREE.Mesh(sightGeo, pearlMat);
            sight.position.set(side * (halfW + borderThick * 0.5), borderHeight + 0.01, zPos);
            scene.add(sight);
        });
    });

    [-1, 1].forEach(end => {
        [-3.5, 0, 3.5].forEach(xPos => {
            const sight = new THREE.Mesh(sightGeo, pearlMat);
            sight.position.set(xPos, borderHeight + 0.01, end * (halfL + borderThick * 0.5));
            scene.add(sight);
        });
    });
}

function createBalls() {
    const ballGeo = new THREE.SphereGeometry(BALL_RADIUS, 48, 48);

    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = 128;
    shadowCanvas.height = 128;
    const sCtx = shadowCanvas.getContext('2d');
    const sGrad = sCtx.createRadialGradient(64, 64, 8, 64, 64, 60);
    sGrad.addColorStop(0, 'rgba(0, 0, 0, 0.72)');
    sGrad.addColorStop(0.55, 'rgba(0, 0, 0, 0.30)');
    sGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    sCtx.fillStyle = sGrad;
    sCtx.fillRect(0, 0, 128, 128);
    const contactShadowTex = new THREE.CanvasTexture(shadowCanvas);

    function attachContactShadow(ballMesh) {
        const shadowPlane = new THREE.Mesh(
            new THREE.PlaneGeometry(BALL_RADIUS * 2.5, BALL_RADIUS * 2.5),
            new THREE.MeshBasicMaterial({
                map: contactShadowTex,
                transparent: true,
                depthWrite: false
            })
        );
        shadowPlane.rotation.x = -Math.PI / 2;
        shadowPlane.position.y = 0.008;
        scene.add(shadowPlane);
        ballMesh.contactShadow = shadowPlane;
    }

    const cueMat = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        roughness: 0.12,
        metalness: 0.02,
        clearcoat: 1.0,
        clearcoatRoughness: 0.08
    });
    cueBall = new THREE.Mesh(ballGeo, cueMat);
    cueBall.position.set(0, BALL_RADIUS, 7);
    cueBall.castShadow = true;
    cueBall.receiveShadow = true;
    cueBall.velocity = new THREE.Vector3(0, 0, 0);
    cueBall.isCue = true;
    cueBall.idNumber = 0;
    scene.add(cueBall);
    attachContactShadow(cueBall);
    balls.push(cueBall);

    const rackLayout = [
        1,
        2, 9,
        3, 8, 10,
        4, 11, 5, 12,
        7, 13, 6, 14, 15
    ];

    let startZ = -6;
    let idx = 0;

    for (let r = 0; r < 5; r++) {
        let startX = -((r * BALL_RADIUS * 2.04) / 2);
        for (let c = 0; c <= r; c++) {
            const ballNum = rackLayout[idx];
            const def = BALL_DEFS[ballNum];
            const texture = createBallTexture(def);

            const ballMat = new THREE.MeshPhysicalMaterial({
                map: texture,
                roughness: 0.14,
                metalness: 0.02,
                clearcoat: 1.0,
                clearcoatRoughness: 0.08
            });

            const ball = new THREE.Mesh(ballGeo, ballMat);
            ball.position.set(startX + c * BALL_RADIUS * 2.04, BALL_RADIUS, startZ - r * (BALL_RADIUS * 1.78));
            ball.rotation.y = Math.PI / 2;
            ball.castShadow = true;
            ball.receiveShadow = true;
            ball.velocity = new THREE.Vector3(0, 0, 0);
            ball.idNumber = ballNum;
            scene.add(ball);
            attachContactShadow(ball);
            balls.push(ball);
            idx++;
        }
    }
}

function createCueTexture(cueType) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    if (cueType === 'white') {
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#0f172a';
        for (let y = 80; y < canvas.height; y += 64) {
            ctx.fillRect(0, y, canvas.width, 22);
        }
    } else if (cueType === 'black') {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#f8fafc';
        for (let y = 80; y < canvas.height; y += 64) {
            ctx.fillRect(0, y, canvas.width, 22);
        }
    } else {
        const shaftGrad = ctx.createLinearGradient(0, 0, 0, 560);
        shaftGrad.addColorStop(0, '#fde68a');
        shaftGrad.addColorStop(1, '#d97706');
        ctx.fillStyle = shaftGrad;
        ctx.fillRect(0, 0, canvas.width, 560);

        ctx.fillStyle = '#291206';
        ctx.fillRect(0, 560, canvas.width, 464);

        ctx.fillStyle = '#facc15';
        ctx.fillRect(0, 556, canvas.width, 10);
        ctx.fillRect(0, 960, canvas.width, 12);

        ctx.fillStyle = '#1c1917';
        ctx.fillRect(0, 660, canvas.width, 260);
    }

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 8, canvas.width, 22);
    ctx.fillStyle = '#0284c7';
    ctx.fillRect(0, 0, canvas.width, 8);

    return new THREE.CanvasTexture(canvas);
}

function createCueStick() {
    cueStickGroup = new THREE.Group();

    const cueLength = 12;
    const cueGeo = new THREE.CylinderGeometry(0.075, 0.175, cueLength, 24);
    const cueTexture = createCueTexture(selectedCue);
    const cueMat = new THREE.MeshStandardMaterial({
        map: cueTexture,
        roughness: 0.25,
        metalness: 0.1
    });

    cueStickMesh = new THREE.Mesh(cueGeo, cueMat);
    cueStickMesh.position.set(0, 0, cueLength / 2 + BALL_RADIUS + 0.08);
    cueStickMesh.rotation.x = Math.PI / 2;
    cueStickMesh.castShadow = true;

    cueStickGroup.add(cueStickMesh);
    scene.add(cueStickGroup);
}

function rebuildCueStick() {
    if (cueStickGroup) scene.remove(cueStickGroup);
    createCueStick();
}

function createAimDotTexture() {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, size, size);

    ctx.beginPath();
    ctx.arc(size / 2, size / 2, 54, 0, Math.PI * 2);
    ctx.fillStyle = '#ca8a04';
    ctx.fill();
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#000000';
    ctx.stroke();

    return new THREE.CanvasTexture(canvas);
}

function createAimStream() {
    aimDots = [];
    const dotCount = 26;
    const dotTex = createAimDotTexture();
    const dotGeo = new THREE.PlaneGeometry(0.24, 0.24);

    for (let i = 0; i < dotCount; i++) {
        const dotMat = new THREE.MeshBasicMaterial({
            map: dotTex,
            transparent: true,
            depthWrite: false,
            opacity: 0.98
        });
        const dot = new THREE.Mesh(dotGeo, dotMat);
        dot.rotation.x = -Math.PI / 2;
        dot.visible = false;
        dot.renderOrder = 3;
        scene.add(dot);
        aimDots.push(dot);
    }
}

function togglePauseState() {
    if (matchOver) return;
    const selHidden = document.getElementById('selection-modal').classList.contains('hidden');
    const modeHidden = document.getElementById('mode-modal').classList.contains('hidden');
    if (!selHidden || !modeHidden) return;

    isPaused = !isPaused;
    if (isPaused) {
        isCharging = false;
        document.getElementById('pause-modal').classList.remove('hidden');
    } else {
        document.getElementById('pause-modal').classList.add('hidden');
    }
}

function setupModalUI() {
    const proceedToCustomization = (chosenMode) => {
        ensureAudioContext();
        gameMode = chosenMode;
        const subEl = document.getElementById('customize-subtitle');
        if (subEl) {
            subEl.textContent = chosenMode === 'cpu'
                ? 'Mode: Player 1 vs. Computer • Customize Table & Cue'
                : 'Mode: 2 Player Match • Customize Table & Cue';
        }
        document.getElementById('mode-modal').classList.add('hidden');
        document.getElementById('selection-modal').classList.remove('hidden');
    };

    document.getElementById('mode-2p-btn').addEventListener('click', () => {
        proceedToCustomization('2p');
    });

    document.getElementById('mode-cpu-btn').addEventListener('click', () => {
        proceedToCustomization('cpu');
    });

    const themeBtns = document.querySelectorAll('.theme-btn');
    themeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            themeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedTheme = btn.dataset.theme;
        });
    });

    const cueCards = document.querySelectorAll('.cue-card');
    cueCards.forEach(card => {
        card.addEventListener('click', () => {
            cueCards.forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            selectedCue = card.dataset.cue;
        });
    });

    document.getElementById('start-game-btn').addEventListener('click', () => {
        ensureAudioContext();
        feltMesh.material.color.setHex(THEME_COLORS[selectedTheme]);
        cushionMeshGroup.forEach(c => c.material.color.setHex(CUSHION_COLORS[selectedTheme]));
        rebuildCueStick();

        currentTurn = 1;
        playerSuits = { 1: null, 2: null };
        isBreakShot = true;
        updateTurnSuitDisplay();
        setHumanControlsEnabled(true);

        document.getElementById('selection-modal').classList.add('hidden');
        document.getElementById('ui-container').classList.remove('hidden');
    });

    document.getElementById('pause-btn').addEventListener('click', () => {
        togglePauseState();
    });

    document.getElementById('resume-btn').addEventListener('click', () => {
        if (isPaused) togglePauseState();
    });

    document.getElementById('restart-btn').addEventListener('click', () => {
        location.reload();
    });

    document.getElementById('play-again-btn').addEventListener('click', () => {
        location.reload();
    });

    const muteBtn = document.getElementById('mute-btn');
    const volOnIcon = document.getElementById('vol-on-icon');
    const volOffIcon = document.getElementById('vol-off-icon');
    muteBtn.addEventListener('click', () => {
        ensureAudioContext();
        isMuted = !isMuted;
        volOnIcon.classList.toggle('hidden', isMuted);
        volOffIcon.classList.toggle('hidden', !isMuted);
    });
}

function setAimAngleRad(rad) {
    let deg = (rad * 180) / Math.PI;
    deg = ((deg % 360) + 360) % 360;
    aimAngle = (deg * Math.PI) / 180;
    const dialRing = document.getElementById('dial-ring');
    const slider = document.getElementById('aim-slider');
    if (dialRing) dialRing.style.transform = `rotate(${deg}deg)`;
    if (slider) slider.value = deg;
}

function setupDialControls() {
    const dialContainer = document.getElementById('dial-container');
    const slider = document.getElementById('aim-slider');

    const isHumanTurn = () => !(gameMode === 'cpu' && currentTurn === 2);

    const updateAngleFromDeg = (deg) => {
        const normalizedDeg = ((deg % 360) + 360) % 360;
        setAimAngleRad((normalizedDeg * Math.PI) / 180);
    };

    slider.addEventListener('input', (e) => {
        if (!isHumanTurn() || isPaused) return;
        const spec = CUE_SPECS[selectedCue];
        let val = parseFloat(e.target.value);

        if (spec.sensitivity < 1.0) {
            const currentDeg = (aimAngle * 180) / Math.PI;
            const diff = (val - currentDeg) * spec.sensitivity;
            val = currentDeg + diff;
        }

        updateAngleFromDeg(val);
    });

    const handlePointerMove = (clientX, clientY) => {
        if (!isDraggingDial || isPaused || !isHumanTurn()) return;
        const rect = dialContainer.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        let angleRad = Math.atan2(clientY - centerY, clientX - centerX) + Math.PI / 2;
        if (angleRad < 0) angleRad += Math.PI * 2;

        const deg = (angleRad * 180) / Math.PI;
        updateAngleFromDeg(deg);
    };

    dialContainer.addEventListener('mousedown', (e) => {
        if (!isPaused && isHumanTurn()) {
            isDraggingDial = true;
            handlePointerMove(e.clientX, e.clientY);
        }
    });
    window.addEventListener('mouseup', () => { isDraggingDial = false; });
    window.addEventListener('mousemove', (e) => handlePointerMove(e.clientX, e.clientY));

    dialContainer.addEventListener('touchstart', (e) => {
        if (!isPaused && isHumanTurn() && e.touches.length > 0) {
            isDraggingDial = true;
            handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
        }
    }, { passive: true });
    window.addEventListener('touchend', () => { isDraggingDial = false; });
    window.addEventListener('touchmove', (e) => {
        if (isDraggingDial && e.touches.length > 0) {
            handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
        }
    }, { passive: true });
}

function setupEvents() {
    const shootBtn = document.getElementById('shoot-btn');
    const isHumanTurn = () => !(gameMode === 'cpu' && currentTurn === 2);

    const startCharge = () => {
        ensureAudioContext();
        if (canShoot && !cueBallPocketed && !isPaused && !matchOver && isHumanTurn()) {
            isCharging = true;
        }
    };
    const releaseCharge = () => {
        if (isCharging && !isPaused && !matchOver && isHumanTurn()) {
            shoot();
            isCharging = false;
        }
    };

    shootBtn.addEventListener('mousedown', startCharge);
    shootBtn.addEventListener('mouseup', releaseCharge);
    shootBtn.addEventListener('touchstart', (e) => { e.preventDefault(); startCharge(); });
    shootBtn.addEventListener('touchend', (e) => { e.preventDefault(); releaseCharge(); });

    window.addEventListener('keydown', (e) => {
        if (e.code === 'KeyP') {
            e.preventDefault();
            togglePauseState();
            return;
        }
        if (e.code === 'Space') startCharge();
    });
    window.addEventListener('keyup', (e) => {
        if (e.code === 'Space') releaseCharge();
    });

    const camBtn = document.getElementById('cam-toggle-btn');
    camBtn.addEventListener('click', () => {
        if (cameraMode === 'locked') {
            cameraMode = 'overhead';
            camBtn.textContent = 'CAM VIEW: OVERHEAD TABLE';
        } else {
            cameraMode = 'locked';
            camBtn.textContent = 'CAM VIEW: LOCKED BEHIND CUE';
        }
    });

    window.addEventListener('resize', onWindowResize);
    window.addEventListener('orientationchange', () => setTimeout(onWindowResize, 120));
}

function shoot(overridePower = null) {
    if (!canShoot || cueBallPocketed || matchOver) return;

    const spec = CUE_SPECS[selectedCue];
    const usedPower = overridePower !== null ? overridePower : Math.max(power, 8);
    const hitForce = usedPower * spec.powerMult;

    playCueStrikeSound(usedPower / 100);

    cueBall.velocity.x = Math.sin(aimAngle) * hitForce;
    cueBall.velocity.z = -Math.cos(aimAngle) * hitForce;

    canShoot = false;
    shotInProgress = true;
    pocketedThisTurn = [];
    power = 0;
    document.getElementById('power-bar-fill').style.width = '0%';
}

function endMatch(winnerTurnNum, reasonText) {
    matchOver = true;
    canShoot = false;
    setHumanControlsEnabled(false);
    const winnerName = getActivePlayerName(winnerTurnNum).toUpperCase();
    document.getElementById('winner-heading').textContent = `${winnerName} WINS!`;
    document.getElementById('winner-reason').textContent = reasonText;
    document.getElementById('gameover-modal').classList.remove('hidden');
}

function countRemainingSuitBalls(suit) {
    let count = 0;
    balls.forEach(b => {
        if (!b.parent || b.isCue || b.idNumber === 8) return;
        if (suit === 'SOLIDS' && b.idNumber >= 1 && b.idNumber <= 7) count++;
        if (suit === 'STRIPES' && b.idNumber >= 9 && b.idNumber <= 15) count++;
    });
    return count;
}

function evaluateShotOutcome() {
    shotInProgress = false;
    const otherTurn = currentTurn === 1 ? 2 : 1;
    const pocketed8 = pocketedThisTurn.includes(8);
    const objectBallsPocketed = pocketedThisTurn.filter(n => n > 0 && n !== 8);

    if (pocketed8) {
        const activeSuit = playerSuits[currentTurn];
        const remainingOwn = activeSuit ? countRemainingSuitBalls(activeSuit) : 7;
        if (!cueBallPocketed && activeSuit && remainingOwn === 0) {
            endMatch(currentTurn, `${getActivePlayerName(currentTurn)} legally pocketed the 8-ball!`);
        } else {
            const reason = cueBallPocketed
                ? `${getActivePlayerName(currentTurn)} scratched on the 8-ball!`
                : `${getActivePlayerName(currentTurn)} pocketed the 8-ball early!`;
            endMatch(otherTurn, reason);
        }
        return;
    }

    if (!playerSuits[1] && !playerSuits[2] && !isBreakShot && !cueBallPocketed && objectBallsPocketed.length > 0) {
        const firstBallNum = objectBallsPocketed[0];
        const assignedSuit = (firstBallNum >= 1 && firstBallNum <= 7) ? 'SOLIDS' : 'STRIPES';
        const oppositeSuit = assignedSuit === 'SOLIDS' ? 'STRIPES' : 'SOLIDS';
        playerSuits[currentTurn] = assignedSuit;
        playerSuits[otherTurn] = oppositeSuit;
    }

    let keepTurn = false;
    if (!cueBallPocketed && objectBallsPocketed.length > 0) {
        const activeSuit = playerSuits[currentTurn];
        if (!activeSuit) {
            keepTurn = true;
        } else {
            keepTurn = objectBallsPocketed.some(n =>
                (activeSuit === 'SOLIDS' && n >= 1 && n <= 7) ||
                (activeSuit === 'STRIPES' && n >= 9 && n <= 15)
            );
        }
    }

    isBreakShot = false;

    if (!keepTurn) {
        currentTurn = otherTurn;
    }

    updateTurnSuitDisplay();

    if (cueBallPocketed) {
        setHumanControlsEnabled(false);
        respawnCueBallAfterDelay();
    } else {
        prepareNextTurn();
    }
}

function prepareNextTurn() {
    if (matchOver) return;
    canShoot = true;
    updateTurnSuitDisplay();

    if (gameMode === 'cpu' && currentTurn === 2) {
        setHumanControlsEnabled(false);
        scheduleComputerShot();
    } else {
        setHumanControlsEnabled(true);
    }
}

function scheduleComputerShot() {
    if (cpuThinkingTimer) clearTimeout(cpuThinkingTimer);

    cpuThinkingTimer = setTimeout(() => {
        cpuThinkingTimer = null;
        if (isPaused || matchOver || currentTurn !== 2 || !canShoot || cueBallPocketed) {
            if (isPaused) scheduleComputerShot();
            return;
        }

        const cpuSuit = playerSuits[2];
        const legalTargets = balls.filter(b => {
            if (!b.parent || b.isCue) return false;
            if (!cpuSuit) return b.idNumber !== 8;
            const remainingOwn = countRemainingSuitBalls(cpuSuit);
            if (remainingOwn === 0) return b.idNumber === 8;
            if (cpuSuit === 'SOLIDS') return b.idNumber >= 1 && b.idNumber <= 7;
            return b.idNumber >= 9 && b.idNumber <= 15;
        });

        const pocketPositions = [
            [-TABLE_WIDTH / 2 + 0.12, -TABLE_LENGTH / 2 + 0.12],
            [ TABLE_WIDTH / 2 - 0.12, -TABLE_LENGTH / 2 + 0.12],
            [-TABLE_WIDTH / 2 - 0.04,  0],
            [ TABLE_WIDTH / 2 + 0.04,  0],
            [-TABLE_WIDTH / 2 + 0.12,  TABLE_LENGTH / 2 - 0.12],
            [ TABLE_WIDTH / 2 - 0.12,  TABLE_LENGTH / 2 - 0.12]
        ];

        let bestAimAngle = 0;
        let bestScore = Infinity;

        legalTargets.forEach(target => {
            pocketPositions.forEach(pPos => {
                const toPocketX = pPos[0] - target.position.x;
                const toPocketZ = pPos[1] - target.position.z;
                const distToPocket = Math.hypot(toPocketX, toPocketZ);
                if (distToPocket < 0.01) return;

                const dirPX = toPocketX / distToPocket;
                const dirPZ = toPocketZ / distToPocket;

                const ghostX = target.position.x - dirPX * (BALL_RADIUS * 2);
                const ghostZ = target.position.z - dirPZ * (BALL_RADIUS * 2);

                const toGhostX = ghostX - cueBall.position.x;
                const toGhostZ = ghostZ - cueBall.position.z;
                const distToGhost = Math.hypot(toGhostX, toGhostZ);
                if (distToGhost < 0.01) return;

                const dirGX = toGhostX / distToGhost;
                const dirGZ = toGhostZ / distToGhost;

                const dot = dirGX * dirPX + dirGZ * dirPZ;
                if (dot > 0.25) {
                    const score = (distToGhost + distToPocket) / dot;
                    if (score < bestScore) {
                        bestScore = score;
                        bestAimAngle = Math.atan2(dirGX, -dirGZ);
                    }
                }
            });
        });

        if (bestScore === Infinity && legalTargets.length > 0) {
            const fallback = legalTargets[0];
            const dx = fallback.position.x - cueBall.position.x;
            const dz = fallback.position.z - cueBall.position.z;
            bestAimAngle = Math.atan2(dx, -dz);
        }

        const jitterRad = ((Math.random() - 0.5) * 3.6 * Math.PI) / 180;
        setAimAngleRad(bestAimAngle + jitterRad);

        const cpuPower = isBreakShot ? 88 : Math.min(72, Math.max(36, 32 + bestScore * 1.1));
        shoot(cpuPower);
    }, 1100);
}

function getSafeCueRespawnPosition() {
    const candidates = [
        [0, 7],
        [-1.2, 7], [1.2, 7],
        [-2.4, 7], [2.4, 7],
        [0, 8.4], [-1.5, 8.4], [1.5, 8.4],
        [0, 5.6], [-1.5, 5.6], [1.5, 5.6]
    ];
    for (const [cx, cz] of candidates) {
        const blocked = balls.some(b =>
            b.parent && !b.isCue && Math.hypot(b.position.x - cx, b.position.z - cz) < BALL_RADIUS * 2.15
        );
        if (!blocked) return { x: cx, z: cz };
    }
    return { x: 0, z: 7 };
}

function respawnCueBallAfterDelay() {
    if (cueRespawnTimer) return;
    cueRespawnTimer = setTimeout(() => {
        cueRespawnTimer = null;
        cueBallPocketed = false;
        const pos = getSafeCueRespawnPosition();
        cueBall.position.set(pos.x, BALL_RADIUS, pos.z);
        cueBall.velocity.set(0, 0, 0);
        scene.add(cueBall);
        if (cueBall.contactShadow) {
            cueBall.contactShadow.position.set(pos.x, 0.008, pos.z);
            scene.add(cueBall.contactShadow);
        }
        prepareNextTurn();
    }, 2000);
}

function updatePhysics() {
    if (isPaused || matchOver) return;

    let allStopped = true;
    const dt = 1 / SUB_STEPS;

    const minX = -TABLE_WIDTH / 2 + CUSHION_THICKNESS + BALL_RADIUS;
    const maxX =  TABLE_WIDTH / 2 - CUSHION_THICKNESS - BALL_RADIUS;
    const minZ = -TABLE_LENGTH / 2 + CUSHION_THICKNESS + BALL_RADIUS;
    const maxZ =  TABLE_LENGTH / 2 - CUSHION_THICKNESS - BALL_RADIUS;

    for (let step = 0; step < SUB_STEPS; step++) {
        balls.forEach(ball => {
            if (!ball.parent) return;

            if (ball.velocity.lengthSq() > 0.00001) {
                allStopped = false;
                
                const stepVel = ball.velocity.clone().multiplyScalar(dt);
                ball.position.add(stepVel);
                ball.position.y = BALL_RADIUS;

                ball.rotation.x += stepVel.z * 0.25;
                ball.rotation.z -= stepVel.x * 0.25;

                ball.velocity.multiplyScalar(Math.pow(FRICTION, dt));

                checkPockets(ball);
                if (!ball.parent) return;

                if (ball.position.x < minX) {
                    playCushionBounceSound(Math.abs(ball.velocity.x));
                    ball.velocity.x = Math.abs(ball.velocity.x) * 0.92;
                    ball.position.x = minX;
                } else if (ball.position.x > maxX) {
                    playCushionBounceSound(Math.abs(ball.velocity.x));
                    ball.velocity.x = -Math.abs(ball.velocity.x) * 0.92;
                    ball.position.x = maxX;
                }

                if (ball.position.z < minZ) {
                    playCushionBounceSound(Math.abs(ball.velocity.z));
                    ball.velocity.z = Math.abs(ball.velocity.z) * 0.92;
                    ball.position.z = minZ;
                } else if (ball.position.z > maxZ) {
                    playCushionBounceSound(Math.abs(ball.velocity.z));
                    ball.velocity.z = -Math.abs(ball.velocity.z) * 0.92;
                    ball.position.z = maxZ;
                }
            } else {
                ball.velocity.set(0, 0, 0);
            }

            if (ball.contactShadow && ball.parent) {
                ball.contactShadow.position.x = ball.position.x;
                ball.contactShadow.position.z = ball.position.z;
            }
        });

        for (let i = 0; i < balls.length; i++) {
            for (let j = i + 1; j < balls.length; j++) {
                const b1 = balls[i];
                const b2 = balls[j];
                if (!b1.parent || !b2.parent) continue;

                const distVec = new THREE.Vector3().subVectors(b2.position, b1.position);
                distVec.y = 0;
                const dist = distVec.length();

                if (dist < BALL_RADIUS * 2) {
                    const normal = dist > 0.0001
                        ? distVec.clone().normalize()
                        : new THREE.Vector3(1, 0, 0);
                    const overlap = (BALL_RADIUS * 2) - dist;

                    b1.position.addScaledVector(normal, -overlap * 0.5);
                    b2.position.addScaledVector(normal, overlap * 0.5);

                    b1.position.x = Math.max(minX, Math.min(maxX, b1.position.x));
                    b1.position.z = Math.max(minZ, Math.min(maxZ, b1.position.z));
                    b2.position.x = Math.max(minX, Math.min(maxX, b2.position.x));
                    b2.position.z = Math.max(minZ, Math.min(maxZ, b2.position.z));

                    const relativeVelocity = new THREE.Vector3().subVectors(b1.velocity, b2.velocity);
                    const speed = relativeVelocity.dot(normal);

                    if (speed > 0) {
                        playBallCollisionSound(speed);
                        const impulse = normal.multiplyScalar(speed * 0.98);
                        b1.velocity.sub(impulse);
                        b2.velocity.add(impulse);
                    }
                }
            }
        }
    }

    if (allStopped && shotInProgress) {
        evaluateShotOutcome();
    }
}

function checkPockets(ball) {
    const pocketPositions = [
        [-TABLE_WIDTH / 2 + 0.12, -TABLE_LENGTH / 2 + 0.12],
        [ TABLE_WIDTH / 2 - 0.12, -TABLE_LENGTH / 2 + 0.12],
        [-TABLE_WIDTH / 2 - 0.04,  0],
        [ TABLE_WIDTH / 2 + 0.04,  0],
        [-TABLE_WIDTH / 2 + 0.12,  TABLE_LENGTH / 2 - 0.12],
        [ TABLE_WIDTH / 2 - 0.12,  TABLE_LENGTH / 2 - 0.12]
    ];

    for (let i = 0; i < pocketPositions.length; i++) {
        const pos = pocketPositions[i];
        const pVec = new THREE.Vector2(pos[0], pos[1]);
        const bVec = new THREE.Vector2(ball.position.x, ball.position.z);
        if (pVec.distanceTo(bVec) < POCKET_RADIUS) {
            playPocketDropAndRollSound();
            if (ball.isCue) {
                cueBallPocketed = true;
                canShoot = false;
                ball.velocity.set(0, 0, 0);
                scene.remove(ball);
                if (ball.contactShadow) scene.remove(ball.contactShadow);
            } else {
                if (!pocketedThisTurn.includes(ball.idNumber)) {
                    pocketedThisTurn.push(ball.idNumber);
                }
                ball.velocity.set(0, 0, 0);
                scene.remove(ball);
                if (ball.contactShadow) scene.remove(ball.contactShadow);
            }
            break;
        }
    }
}

function getAimStopDistance(startX, startZ, dirX, dirZ) {
    let maxDist = 34;

    const minX = -TABLE_WIDTH / 2 + CUSHION_THICKNESS + BALL_RADIUS;
    const maxX =  TABLE_WIDTH / 2 - CUSHION_THICKNESS - BALL_RADIUS;
    const minZ = -TABLE_LENGTH / 2 + CUSHION_THICKNESS + BALL_RADIUS;
    const maxZ =  TABLE_LENGTH / 2 - CUSHION_THICKNESS - BALL_RADIUS;

    if (Math.abs(dirX) > 0.0001) {
        const tx = dirX > 0 ? (maxX - startX) / dirX : (minX - startX) / dirX;
        if (tx > 0 && tx < maxDist) maxDist = tx;
    }
    if (Math.abs(dirZ) > 0.0001) {
        const tz = dirZ > 0 ? (maxZ - startZ) / dirZ : (minZ - startZ) / dirZ;
        if (tz > 0 && tz < maxDist) maxDist = tz;
    }

    const hitRadius = BALL_RADIUS * 2;
    for (let i = 0; i < balls.length; i++) {
        const b = balls[i];
        if (b.isCue || !b.parent) continue;

        const toBallX = b.position.x - startX;
        const toBallZ = b.position.z - startZ;
        const proj = toBallX * dirX + toBallZ * dirZ;
        if (proj <= 0) continue;

        const perpSq = (toBallX * toBallX + toBallZ * toBallZ) - (proj * proj);
        if (perpSq < hitRadius * hitRadius) {
            const impactDist = proj - Math.sqrt(hitRadius * hitRadius - perpSq);
            if (impactDist > 0 && impactDist < maxDist) {
                maxDist = impactDist;
            }
        }
    }

    return maxDist;
}

function updateCameraAndAim() {
    if (!cueBall) return;

    if (isCharging && canShoot && !cueBallPocketed && !isPaused) {
        power = Math.min(power + 1.2, 100);
        document.getElementById('power-bar-fill').style.width = power + '%';
    }

    const dirX = Math.sin(aimAngle);
    const dirZ = -Math.cos(aimAngle);

    if (cameraMode === 'locked') {
        camera.up.set(0, 1, 0);
        const isMobilePortrait = window.innerHeight > window.innerWidth && window.innerWidth <= 768;
        const cameraDistance = isMobilePortrait ? 7.4 : 6.2;
        const cameraHeight = isMobilePortrait ? 3.8 : 3.0;

        const camX = cueBall.position.x - dirX * cameraDistance;
        const camZ = cueBall.position.z - dirZ * cameraDistance;

        camera.position.set(camX, cueBall.position.y + cameraHeight, camZ);
        camera.lookAt(
            cueBall.position.x + dirX * 4.5,
            cueBall.position.y + 0.05,
            cueBall.position.z + dirZ * 4.5
        );
    } else if (cameraMode === 'overhead') {
        const totalTableLen = TABLE_LENGTH + 3.4; // 31.4
        const totalTableWid = TABLE_WIDTH + 3.4;  // 17.4
        const vFovRad = (camera.fov * Math.PI) / 180;
        const aspect = window.innerWidth / window.innerHeight;

        const isTouchMobile = window.matchMedia('(pointer: coarse)').matches || ('ontouchstart' in window);
        const isMobileLandscape = isTouchMobile && window.innerWidth > window.innerHeight && window.innerHeight <= 540;
        const isMobilePortrait = window.innerHeight > window.innerWidth && window.innerWidth <= 768;

        if (isMobileLandscape) {
            // Rotate table 90 degrees so the 28-unit length spans horizontally across the landscape screen
            camera.up.set(1, 0, 0);

            const topBarEl = document.getElementById('top-bar');
            const bottomBarEl = document.getElementById('bottom-controls-bar');
            const topPx = topBarEl ? topBarEl.getBoundingClientRect().bottom + 4 : 44;
            const bottomPx = bottomBarEl ? (window.innerHeight - bottomBarEl.getBoundingClientRect().top + 4) : 110;
            const usableHeightFrac = Math.max(0.50, 1 - (topPx + bottomPx) / window.innerHeight);

            const heightForWidthSpan = (totalTableLen / 2) / (Math.tan(vFovRad / 2) * aspect);
            const heightForHeightSpan = ((totalTableWid / usableHeightFrac) / 2) / Math.tan(vFovRad / 2);
            const camHeight = Math.max(heightForWidthSpan, heightForHeightSpan) * 1.03;

            const visibleSpanX = 2 * camHeight * Math.tan(vFovRad / 2);
            const xShift = -((topPx - bottomPx) / window.innerHeight) * 0.5 * visibleSpanX;

            camera.position.set(xShift, camHeight, 0);
            camera.lookAt(xShift, 0, 0);
        } else if (isMobilePortrait) {
            // Portrait orientation: align 28-unit length vertically between top HUD and bottom controls
            camera.up.set(0, 1, 0);

            const topBarEl = document.getElementById('top-bar');
            const bottomBarEl = document.getElementById('bottom-controls-bar');
            const topPx = topBarEl ? topBarEl.getBoundingClientRect().bottom + 6 : 64;
            const bottomPx = bottomBarEl ? (window.innerHeight - bottomBarEl.getBoundingClientRect().top + 6) : 140;
            const usableHeightFrac = Math.max(0.55, 1 - (topPx + bottomPx) / window.innerHeight);

            const heightForLength = ((totalTableLen / usableHeightFrac) / 2) / Math.tan(vFovRad / 2);
            const heightForWidth = (totalTableWid / 2) / (Math.tan(vFovRad / 2) * aspect);
            const camHeight = Math.max(heightForLength, heightForWidth) * 1.03;

            const visibleSpanZ = 2 * camHeight * Math.tan(vFovRad / 2);
            const zShift = -((topPx - bottomPx) / window.innerHeight) * 0.5 * visibleSpanZ;

            camera.position.set(0, camHeight, zShift);
            camera.lookAt(0, 0, zShift);
        } else {
            // Desktop / Laptop Overhead View
            camera.up.set(0, 1, 0);
            const heightForLength = (totalTableLen / 2) / Math.tan(vFovRad / 2);
            const heightForWidth = (totalTableWid / 2) / (Math.tan(vFovRad / 2) * aspect);
            const camHeight = Math.max(heightForLength, heightForWidth) * 1.03;

            camera.position.set(0, camHeight, 0);
            camera.lookAt(0, 0, 0);
        }
    }

    if (canShoot && !cueBallPocketed && !isPaused && !matchOver) {
        cueStickGroup.visible = true;

        const spacing = 0.72;
        const startOffset = BALL_RADIUS + 0.35;
        const flowOffset = (performance.now() * 0.0012) % spacing;
        const maxDist = getAimStopDistance(cueBall.position.x, cueBall.position.z, dirX, dirZ);

        aimDots.forEach((dot, idx) => {
            const dist = startOffset + flowOffset + (idx * spacing);
            if (dist <= maxDist) {
                dot.visible = true;
                dot.position.set(
                    cueBall.position.x + dirX * dist,
                    0.02,
                    cueBall.position.z + dirZ * dist
                );
                const fadeIn = Math.min(1, (dist - startOffset) / 0.5);
                const fadeOut = Math.max(0.35, 1 - (dist / 30));
                dot.material.opacity = fadeIn * fadeOut;
            } else {
                dot.visible = false;
            }
        });

        cueStickGroup.position.copy(cueBall.position);
        cueStickGroup.rotation.y = -aimAngle;
        cueStickGroup.rotation.x = 0.06;

        const pullBackOffset = power * 0.022;
        const cueLength = 12;
        cueStickMesh.position.z = (cueLength / 2) + BALL_RADIUS + 0.12 + pullBackOffset;
    } else {
        aimDots.forEach(dot => dot.visible = false);
        cueStickGroup.visible = false;
    }
}

function animate() {
    requestAnimationFrame(animate);

    updatePhysics();
    updateCameraAndAim();

    renderer.render(scene, camera);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

window.onload = init;
