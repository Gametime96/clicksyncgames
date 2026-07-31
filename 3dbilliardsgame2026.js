// --- 3D Billiards Game 2026 ---

const TABLE_WIDTH = 14;
const TABLE_LENGTH = 28;
const BALL_RADIUS = 0.45;
const FRICTION = 0.988;
const POCKET_RADIUS = 1.35;

let scene, camera, renderer;
let balls = [];
let cueBall;
let cueStickGroup, cueStickMesh;
let aimLine, lineMaterial;
let feltMesh;

let aimAngle = Math.PI; // Pivoting angle in radians
let power = 0;
let isCharging = false;
let canShoot = true;
let isDraggingDial = false;
let cameraMode = 'locked'; // 'locked' (behind stick) or 'overhead'

let selectedTheme = 'green';
let selectedCue = 'default';

const THEME_COLORS = {
    green: 0x0a6b38,
    grey: 0x71717a,
    purple: 0x4c1d95,
    red: 0x881337,
    blue: 0x1e3a8a
};

const CUE_SPECS = {
    default: { powerMult: 0.038, sensitivity: 1.0 },
    white:   { powerMult: 0.048, sensitivity: 1.0 },
    black:   { powerMult: 0.038, sensitivity: 0.5 }
};

const BALL_DEFS = [
    { num: 0,  color: "#ffffff", stripe: false },
    { num: 1,  color: "#f1c40f", stripe: false },
    { num: 2,  color: "#2980b9", stripe: false },
    { num: 3,  color: "#e74c3c", stripe: false },
    { num: 4,  color: "#8e44ad", stripe: false },
    { num: 5,  color: "#e67e22", stripe: false },
    { num: 6,  color: "#27ae60", stripe: false },
    { num: 7,  color: "#7f1d1d", stripe: false },
    { num: 8,  color: "#111111", stripe: false },
    { num: 9,  color: "#f1c40f", stripe: true  },
    { num: 10, color: "#2980b9", stripe: true  },
    { num: 11, color: "#e74c3c", stripe: true  },
    { num: 12, color: "#8e44ad", stripe: true  },
    { num: 13, color: "#e67e22", stripe: true  },
    { num: 14, color: "#27ae60", stripe: true  },
    { num: 15, color: "#7f1d1d", stripe: true  }
];

function init() {
    const container = document.getElementById('game-container');

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x07090e);

    camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.1, 1000);

    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // Softened lighting to eliminate glare
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const light1 = new THREE.DirectionalLight(0xfffaed, 0.4);
    light1.position.set(0, 25, -5);
    light1.castShadow = true;
    scene.add(light1);

    const light2 = new THREE.DirectionalLight(0xfffaed, 0.4);
    light2.position.set(0, 25, 5);
    scene.add(light2);

    createTable();
    createBalls();
    createCueStick();
    createAimLine();

    setupModalUI();
    setupDialControls();
    setupEvents();

    animate();
}

function createBallTexture(def) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = def.stripe ? "#ffffff" : def.color;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (def.stripe) {
        ctx.fillStyle = def.color;
        ctx.fillRect(0, 48, canvas.width, 160);
    }

    if (def.num > 0) {
        [128, 384].forEach(x => {
            ctx.beginPath();
            ctx.arc(x, 128, 44, 0, Math.PI * 2);
            ctx.fillStyle = "#ffffff";
            ctx.fill();

            ctx.fillStyle = "#000000";
            ctx.font = "bold 42px sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(def.num.toString(), x, 130);
        });
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    return texture;
}

function createTable() {
    const feltGeo = new THREE.BoxGeometry(TABLE_WIDTH, 0.4, TABLE_LENGTH);
    const feltMat = new THREE.MeshStandardMaterial({
        color: THEME_COLORS[selectedTheme],
        roughness: 0.85
    });
    feltMesh = new THREE.Mesh(feltGeo, feltMat);
    feltMesh.position.y = -0.2;
    feltMesh.receiveShadow = true;
    scene.add(feltMesh);

    const woodMat = new THREE.MeshStandardMaterial({ color: 0x3d1e03, roughness: 0.5 });
    const borderThick = 1.2;
    const borderHeight = 0.8;

    const railGeoLong = new THREE.BoxGeometry(borderThick, borderHeight, TABLE_LENGTH + borderThick * 2);
    const leftRail = new THREE.Mesh(railGeoLong, woodMat);
    leftRail.position.set(-TABLE_WIDTH / 2 - borderThick / 2, 0.2, 0);
    leftRail.castShadow = true;
    scene.add(leftRail);

    const rightRail = leftRail.clone();
    rightRail.position.x = TABLE_WIDTH / 2 + borderThick / 2;
    scene.add(rightRail);

    const railGeoShort = new THREE.BoxGeometry(TABLE_WIDTH, borderHeight, borderThick);
    const topRail = new THREE.Mesh(railGeoShort, woodMat);
    topRail.position.set(0, 0.2, -TABLE_LENGTH / 2 - borderThick / 2);
    topRail.castShadow = true;
    scene.add(topRail);

    const bottomRail = topRail.clone();
    bottomRail.position.z = TABLE_LENGTH / 2 + borderThick / 2;
    scene.add(bottomRail);

    const pocketMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const pocketPositions = [
        [-TABLE_WIDTH/2 + 0.1, -TABLE_LENGTH/2 + 0.1], [TABLE_WIDTH/2 - 0.1, -TABLE_LENGTH/2 + 0.1],
        [-TABLE_WIDTH/2 + 0.1, 0],                     [TABLE_WIDTH/2 - 0.1, 0],
        [-TABLE_WIDTH/2 + 0.1, TABLE_LENGTH/2 - 0.1],  [TABLE_WIDTH/2 - 0.1, TABLE_LENGTH/2 - 0.1]
    ];

    pocketPositions.forEach(pos => {
        const pocketGeo = new THREE.CylinderGeometry(POCKET_RADIUS, POCKET_RADIUS, 0.42, 24);
        const pocket = new THREE.Mesh(pocketGeo, pocketMat);
        pocket.position.set(pos[0], 0.01, pos[1]);
        scene.add(pocket);
    });
}

function createBalls() {
    const ballGeo = new THREE.SphereGeometry(BALL_RADIUS, 32, 32);

    // Low specular sheen to eliminate glare
    const cueMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.65, metalness: 0.0 });
    cueBall = new THREE.Mesh(ballGeo, cueMat);
    cueBall.position.set(0, BALL_RADIUS, 7);
    cueBall.castShadow = true;
    cueBall.velocity = new THREE.Vector3(0, 0, 0);
    cueBall.isCue = true;
    scene.add(cueBall);
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
        let startX = -((r * BALL_RADIUS * 2.05) / 2);
        for (let c = 0; c <= r; c++) {
            const ballNum = rackLayout[idx];
            const def = BALL_DEFS[ballNum];
            const texture = createBallTexture(def);

            const ballMat = new THREE.MeshStandardMaterial({
                map: texture,
                roughness: 0.65,
                metalness: 0.0
            });

            const ball = new THREE.Mesh(ballGeo, ballMat);
            ball.position.set(startX + c * BALL_RADIUS * 2.05, BALL_RADIUS, startZ - r * (BALL_RADIUS * 1.8));
            ball.rotation.y = Math.PI / 2;
            ball.castShadow = true;
            ball.velocity = new THREE.Vector3(0, 0, 0);
            ball.idNumber = ballNum;
            scene.add(ball);
            balls.push(ball);
            idx++;
        }
    }
}

function createCueTexture(cueType) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    if (cueType === 'white') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#111111';
        for (let y = 0; y < canvas.height; y += 40) {
            ctx.fillRect(0, y, canvas.width, 16);
        }
    } else if (cueType === 'black') {
        ctx.fillStyle = '#111111';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#ffffff';
        for (let y = 0; y < canvas.height; y += 40) {
            ctx.fillRect(0, y, canvas.width, 16);
        }
    } else {
        ctx.fillStyle = '#d97706';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#78350f';
        ctx.fillRect(0, 380, canvas.width, 132);
    }

    return new THREE.CanvasTexture(canvas);
}

function createCueStick() {
    cueStickGroup = new THREE.Group();

    const cueLength = 12;
    const cueGeo = new THREE.CylinderGeometry(0.08, 0.18, cueLength, 16);
    const cueTexture = createCueTexture(selectedCue);
    const cueMat = new THREE.MeshStandardMaterial({ map: cueTexture, roughness: 0.4 });

    cueStickMesh = new THREE.Mesh(cueGeo, cueMat);
    cueStickMesh.position.set(0, 0, cueLength / 2 + BALL_RADIUS + 0.05);
    cueStickMesh.rotation.x = Math.PI / 2;

    cueStickGroup.add(cueStickMesh);
    scene.add(cueStickGroup);
}

function rebuildCueStick() {
    if (cueStickGroup) scene.remove(cueStickGroup);
    createCueStick();
}

function createAimLine() {
    const points = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -20)];
    const lineGeo = new THREE.BufferGeometry().setFromPoints(points);

    lineMaterial = new THREE.LineDashedMaterial({
        color: 0x00ffff, // Bright Neon Cyan
        dashSize: 0.5,
        gapSize: 0.3,
        linewidth: 3
    });

    aimLine = new THREE.Line(lineGeo, lineMaterial);
    aimLine.computeLineDistances();
    scene.add(aimLine);
}

function setupModalUI() {
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
        feltMesh.material.color.setHex(THEME_COLORS[selectedTheme]);
        rebuildCueStick();

        document.getElementById('selection-modal').classList.add('hidden');
        document.getElementById('ui-container').classList.remove('hidden');
    });
}

function setupDialControls() {
    const dialContainer = document.getElementById('dial-container');
    const dialRing = document.getElementById('dial-ring');
    const slider = document.getElementById('aim-slider');

    const updateAngleFromDeg = (deg) => {
        aimAngle = (deg * Math.PI) / 180;
        dialRing.style.transform = `rotate(${deg}deg)`;
        slider.value = deg;
    };

    slider.addEventListener('input', (e) => {
        const spec = CUE_SPECS[selectedCue];
        let val = parseFloat(e.target.value);

        if (spec.sensitivity < 1.0) {
            const currentDeg = (aimAngle * 180) / Math.PI;
            const diff = (val - currentDeg) * spec.sensitivity;
            val = currentDeg + diff;
        }

        updateAngleFromDeg(val);
    });

    const handlePointerMove = (e) => {
        if (!isDraggingDial) return;
        const rect = dialContainer.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        let angleRad = Math.atan2(e.clientY - centerY, e.clientX - centerX) + Math.PI / 2;
        if (angleRad < 0) angleRad += Math.PI * 2;

        const deg = (angleRad * 180) / Math.PI;
        updateAngleFromDeg(deg);
    };

    dialContainer.addEventListener('mousedown', () => { isDraggingDial = true; });
    window.addEventListener('mouseup', () => { isDraggingDial = false; });
    window.addEventListener('mousemove', handlePointerMove);
}

function setupEvents() {
    const shootBtn = document.getElementById('shoot-btn');

    const startCharge = () => { if (canShoot) isCharging = true; };
    const releaseCharge = () => {
        if (isCharging) {
            shoot();
            isCharging = false;
        }
    };

    shootBtn.addEventListener('mousedown', startCharge);
    shootBtn.addEventListener('mouseup', releaseCharge);

    window.addEventListener('keydown', (e) => {
        if (e.code === 'Space') startCharge();
    });
    window.addEventListener('keyup', (e) => {
        if (e.code === 'Space') releaseCharge();
    });

    // Camera Toggle Button Handler
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
}

function shoot() {
    if (!canShoot) return;

    const spec = CUE_SPECS[selectedCue];
    const hitForce = Math.max(power, 8) * spec.powerMult;

    cueBall.velocity.x = Math.sin(aimAngle) * hitForce;
    cueBall.velocity.z = -Math.cos(aimAngle) * hitForce;

    canShoot = false;
    power = 0;
    document.getElementById('power-bar-fill').style.width = '0%';
}

function updatePhysics() {
    let allStopped = true;

    balls.forEach(ball => {
        if (!ball.parent) return;

        if (ball.velocity.lengthSq() > 0.00001) {
            allStopped = false;
            ball.position.add(ball.velocity);

            ball.rotation.x += ball.velocity.z * 0.2;
            ball.rotation.z -= ball.velocity.x * 0.2;

            ball.velocity.multiplyScalar(FRICTION);

            const minX = -TABLE_WIDTH / 2 + BALL_RADIUS;
            const maxX = TABLE_WIDTH / 2 - BALL_RADIUS;
            const minZ = -TABLE_LENGTH / 2 + BALL_RADIUS;
            const maxZ = TABLE_LENGTH / 2 - BALL_RADIUS;

            if (ball.position.x < minX || ball.position.x > maxX) {
                ball.velocity.x *= -0.95;
                ball.position.x = Math.max(minX, Math.min(maxX, ball.position.x));
            }
            if (ball.position.z < minZ || ball.position.z > maxZ) {
                ball.velocity.z *= -0.95;
                ball.position.z = Math.max(minZ, Math.min(maxZ, ball.position.z));
            }

            checkPockets(ball);
        } else {
            ball.velocity.set(0, 0, 0);
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
                const normal = distVec.clone().normalize();
                const overlap = (BALL_RADIUS * 2) - dist;

                b1.position.addScaledVector(normal, -overlap * 0.5);
                b2.position.addScaledVector(normal, overlap * 0.5);

                const relativeVelocity = new THREE.Vector3().subVectors(b1.velocity, b2.velocity);
                const speed = relativeVelocity.dot(normal);

                if (speed > 0) {
                    const impulse = normal.multiplyScalar(speed * 0.98);
                    b1.velocity.sub(impulse);
                    b2.velocity.add(impulse);
                }
            }
        }
    }

    if (allStopped && !canShoot) {
        canShoot = true;
    }
}

function checkPockets(ball) {
    const pocketPositions = [
        [-TABLE_WIDTH/2 + 0.1, -TABLE_LENGTH/2 + 0.1], [TABLE_WIDTH/2 - 0.1, -TABLE_LENGTH/2 + 0.1],
        [-TABLE_WIDTH/2 + 0.1, 0],                     [TABLE_WIDTH/2 - 0.1, 0],
        [-TABLE_WIDTH/2 + 0.1, TABLE_LENGTH/2 - 0.1],  [TABLE_WIDTH/2 - 0.1, TABLE_LENGTH/2 - 0.1]
    ];

    pocketPositions.forEach(pos => {
        const pVec = new THREE.Vector2(pos[0], pos[1]);
        const bVec = new THREE.Vector2(ball.position.x, ball.position.z);
        if (pVec.distanceTo(bVec) < POCKET_RADIUS) {
            if (ball.isCue) {
                ball.position.set(0, BALL_RADIUS, 7);
                ball.velocity.set(0, 0, 0);
            } else {
                scene.remove(ball);
            }
        }
    });
}

function updateCameraAndAim() {
    if (!cueBall) return;

    if (isCharging && canShoot) {
        power = Math.min(power + 1.2, 100);
        document.getElementById('power-bar-fill').style.width = power + '%';
    }

    // Dynamic Camera View Selection
    if (cameraMode === 'locked') {
        const cameraDistance = 5.8;
        const cameraHeight = 2.8;

        const camX = cueBall.position.x - Math.sin(aimAngle) * cameraDistance;
        const camZ = cueBall.position.z + Math.cos(aimAngle) * cameraDistance;

        camera.position.set(camX, cueBall.position.y + cameraHeight, camZ);
        camera.lookAt(
            cueBall.position.x + Math.sin(aimAngle) * 4,
            cueBall.position.y + 0.1,
            cueBall.position.z - Math.cos(aimAngle) * 4
        );
    } else if (cameraMode === 'overhead') {
        camera.position.set(0, 24, 0);
        camera.lookAt(0, 0, 0);
    }

    if (canShoot) {
        aimLine.visible = true;
        cueStickGroup.visible = true;

        aimLine.position.copy(cueBall.position);
        aimLine.position.y = 0.05;
        aimLine.rotation.y = aimAngle;

        // Flowing dynamic animated dashed line
        lineMaterial.dashSize = 0.5;
        lineMaterial.gapSize = 0.3;
        aimLine.position.x += Math.sin(aimAngle) * ((Date.now() * 0.008) % 0.8);
        aimLine.position.z -= Math.cos(aimAngle) * ((Date.now() * 0.008) % 0.8);

        cueStickGroup.position.copy(cueBall.position);
        cueStickGroup.rotation.y = aimAngle;

        const pullBackOffset = power * 0.02;
        const cueLength = 12;
        cueStickMesh.position.z = (cueLength / 2) + BALL_RADIUS + 0.05 + pullBackOffset;
    } else {
        aimLine.visible = false;
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
