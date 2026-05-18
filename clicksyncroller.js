const GAME = {
    state: 'MENU', // MENU, PLAYING, PAUSED, DEATH, WIN
    level: 1, maxLevels: 8, lives: 3,
    t: 0, speed: 0, maxSpeed: 0.0008,
    latTheta: 0, latVel: 0, 
    jumpState: 0, 
    jumpTarget: 0, jumpStartY: 0, jumpStartTheta: 0,
    gaps: [], 
    currentJump: null
};

const INPUT = { up: false, down: false, left: false, right: false };
const TUBE_RADIUS = 20; 
const BALL_RADIUS = 3.5;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x020510);
scene.fog = new THREE.FogExp2(0x020510, 0.0015);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 5000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); 
document.getElementById('game-canvas').appendChild(renderer.domElement);

const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(100, 300, 100);
scene.add(light);
scene.add(new THREE.AmbientLight(0x404040, 2));

const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 256;
const ctx = canvas.getContext('2d');
ctx.fillStyle = '#010812'; ctx.fillRect(0,0,256,256);
ctx.strokeStyle = '#00ffcc'; ctx.lineWidth = 3;
ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(256,256); ctx.stroke();
ctx.beginPath(); ctx.moveTo(256,0); ctx.lineTo(0,256); ctx.stroke();
const tex = new THREE.CanvasTexture(canvas);
tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(10, 150);
const trackMat = new THREE.MeshPhongMaterial({ map: tex, side: THREE.DoubleSide });

const ball = new THREE.Mesh(
    new THREE.SphereGeometry(BALL_RADIUS, 32, 32), 
    new THREE.MeshPhongMaterial({ color: 0xffffff, emissive: 0x0088ff, shininess: 100 })
);
scene.add(ball);

let curve = null;
let trackMeshes = [];

window.addEventListener('resize', () => { 
    setTimeout(() => {
        camera.aspect = window.innerWidth / window.innerHeight; 
        camera.updateProjectionMatrix(); 
        renderer.setSize(window.innerWidth, window.innerHeight); 
    }, 100);
});

function buildTrackMesh(startT, endT) {
    if (endT <= startT) return; 

    const geo = new THREE.BufferGeometry();
    const positions = []; const indices = [];
    const segments = Math.max(10, Math.floor((endT - startT) * 1500)); 

    const profileX = [];
    const profileY = [];
    const radialSegments = 20; 
    
    for(let j=0; j<=radialSegments; j++) {
        const angle = -Math.PI/2 + (j/radialSegments) * Math.PI;
        profileX.push(Math.sin(angle) * TUBE_RADIUS);
        profileY.push(TUBE_RADIUS - (Math.cos(angle) * TUBE_RADIUS));
    }

    for(let i=0; i<=segments; i++) {
        const t = startT + (i/segments) * (endT - startT);
        const pt = curve.getPointAt(t);
        const tangent = curve.getTangentAt(t).normalize();
        
        const up = new THREE.Vector3(0, 1, 0);
        const right = new THREE.Vector3().crossVectors(tangent, up).normalize();
        const normal = new THREE.Vector3().crossVectors(right, tangent).normalize();

        for(let p=0; p<profileX.length; p++) {
            const v = pt.clone().add(right.clone().multiplyScalar(profileX[p])).add(normal.clone().multiplyScalar(profileY[p]));
            positions.push(v.x, v.y, v.z);
        }
    }

    const width = profileX.length;
    for(let i=0; i<segments; i++) {
        for(let j=0; j<width-1; j++) {
            const a = i * width + j; const b = i * width + j + 1;
            const c = (i + 1) * width + j; const d = (i + 1) * width + j + 1;
            indices.push(a, c, b); indices.push(b, c, d);
        }
    }

    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(indices); geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, trackMat);
    scene.add(mesh); trackMeshes.push(mesh);
}

function getSurfacePosition(tVal, thetaVal) {
    const pt = curve.getPointAt(tVal);
    const tangent = curve.getTangentAt(tVal).normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(tangent, up).normalize();
    const normal = new THREE.Vector3().crossVectors(right, tangent).normalize();

    const effectiveR = TUBE_RADIUS - BALL_RADIUS;
    const localX = Math.sin(thetaVal) * effectiveR;
    const localY = TUBE_RADIUS - (Math.cos(thetaVal) * effectiveR);

    return pt.clone().add(right.clone().multiplyScalar(localX)).add(normal.clone().multiplyScalar(localY));
}

function loadLevel(levelNum) {
    trackMeshes.forEach(m => { scene.remove(m); m.geometry.dispose(); }); trackMeshes = [];
    GAME.t = 0; GAME.speed = 0; GAME.latTheta = 0; GAME.latVel = 0; GAME.jumpState = 0; 
    GAME.gaps = []; 
    
    document.getElementById('ui-level').innerHTML = `${levelNum} <span class="sub">/ 8</span>`;

    const pts = [];
    let cx = 0, cy = 0, cz = 0;
    pts.push(new THREE.Vector3(cx, cy, cz)); 
    pts.push(new THREE.Vector3(cx, cy, cz - 100));
    
    const maxSegs = 30 + (levelNum * 6); 
    const turnFreq = 0.3 + (levelNum * 0.05); 
    const turnAmp = 200 + (levelNum * 40); 
    const vertBump = levelNum > 2 ? (levelNum * 5) : 0; 

    for(let i=2; i<=maxSegs; i++) {
        cz -= 250;
        cy -= 30 + (Math.sin(i * 1.5) * vertBump); 
        cx += Math.sin(i * turnFreq) * turnAmp; 
        pts.push(new THREE.Vector3(cx, cy, cz));
    }
    curve = new THREE.CatmullRomCurve3(pts);

    const numGaps = Math.ceil(levelNum / 3); 
    const gapBaseWidth = 0.035 + (levelNum * 0.003); 

    for(let g = 1; g <= numGaps; g++) {
        const spawnCenter = (g / (numGaps + 1));
        const startT = spawnCenter + (Math.random() * 0.04 - 0.02);
        GAME.gaps.push({ start: startT, end: startT + gapBaseWidth, cleared: false });
    }

    let currentBuildT = 0;
    GAME.gaps.forEach(gap => {
        buildTrackMesh(currentBuildT, gap.start);
        currentBuildT = gap.end;
    });
    buildTrackMesh(currentBuildT, 1);
}

// =======================================================
// INPUT CONTROL & PAUSE LOGIC
// =======================================================
function togglePause() {
    if (GAME.state === 'PLAYING') {
        GAME.state = 'PAUSED';
        document.getElementById('screen-pause').classList.remove('hidden');
        document.getElementById('screen-pause').classList.add('active');
        document.getElementById('btn-pause').innerText = 'RESUME (P)';
    } else if (GAME.state === 'PAUSED') {
        GAME.state = 'PLAYING';
        document.getElementById('screen-pause').classList.add('hidden');
        document.getElementById('screen-pause').classList.remove('active');
        document.getElementById('btn-pause').innerText = 'PAUSE (P)';
    }
}

function bindKey(keyStr, isDown) {
    const k = keyStr.toLowerCase();
    // Pause mapping
    if (k === 'p' && isDown) { togglePause(); return; }

    if(['arrowup','w'].includes(k)) { INPUT.up = isDown; document.getElementById('key-up').classList.toggle('active', isDown); }
    if(['arrowdown','s'].includes(k)) { INPUT.down = isDown; document.getElementById('key-down').classList.toggle('active', isDown); }
    if(['arrowleft','a'].includes(k)) { INPUT.left = isDown; document.getElementById('key-left').classList.toggle('active', isDown); }
    if(['arrowright','d'].includes(k)) { INPUT.right = isDown; document.getElementById('key-right').classList.toggle('active', isDown); }
}

window.addEventListener('keydown', e => bindKey(e.key, true));
window.addEventListener('keyup', e => bindKey(e.key, false));

['up','down','left','right'].forEach(d => {
    const btn = document.getElementById(`key-${d}`);
    btn.addEventListener('mousedown', () => bindKey(`arrow${d}`, true));
    btn.addEventListener('mouseup', () => bindKey(`arrow${d}`, false));
    btn.addEventListener('mouseleave', () => bindKey(`arrow${d}`, false));
    
    btn.addEventListener('touchstart', e => { e.preventDefault(); bindKey(`arrow${d}`, true); }, {passive: false});
    btn.addEventListener('touchend', e => { e.preventDefault(); bindKey(`arrow${d}`, false); }, {passive: false});
});

document.getElementById('btn-pause').addEventListener('click', togglePause);
document.getElementById('btn-resume').addEventListener('click', togglePause);
document.getElementById('btn-return').addEventListener('click', () => { window.location.href = 'index.html'; });

// =======================================================
// UI FLOW & TUTORIAL LOGIC
// =======================================================
function hideAllPanels() {
    document.querySelectorAll('.panel').forEach(p => {
        p.classList.remove('active'); p.classList.add('hidden');
    });
}

function showMsg(title, txt, btnTxt, callback) {
    hideAllPanels();
    document.getElementById('top-controls').classList.add('hidden');
    const p = document.getElementById('screen-msg');
    p.classList.remove('hidden'); p.classList.add('active');
    document.getElementById('msg-title').innerText = title;
    document.getElementById('msg-text').innerText = txt;
    const btn = document.getElementById('btn-continue');
    btn.innerText = btnTxt;
    btn.onclick = () => { 
        hideAllPanels(); 
        document.getElementById('top-controls').classList.remove('hidden');
        callback(); 
    };
}

function updateLives() {
    const dots = document.querySelectorAll('.life-dot');
    dots.forEach((d, i) => { if(i < GAME.lives) d.classList.remove('lost'); else d.classList.add('lost'); });
}

document.getElementById('btn-start').addEventListener('click', () => {
    hideAllPanels();
    const p = document.getElementById('screen-tutorial-prompt');
    p.classList.remove('hidden'); p.classList.add('active');
});

document.getElementById('btn-no-tut').addEventListener('click', () => startGame(false));
document.getElementById('btn-yes-tut').addEventListener('click', () => startGame(true));

function startGame(withTutorial) {
    hideAllPanels();
    document.getElementById('hud').classList.remove('hidden');
    document.getElementById('touch-pad').classList.remove('hidden');
    document.getElementById('top-controls').classList.remove('hidden');
    GAME.lives = 3; updateLives();
    loadLevel(1);
    GAME.state = 'PLAYING';
    if(withTutorial) runTutorialRoutine();
}

function runTutorialRoutine() {
    const tutUI = document.getElementById('tutorial-hud');
    const timerUI = document.getElementById('tut-timer');
    const instUI = document.getElementById('tut-instruction');
    
    tutUI.classList.remove('hidden');
    let timeLeft = 14;

    const instructions = [
        "Hold UP / W to accelerate.",
        "Speed controls track progress.",
        "Use LEFT / RIGHT to steer on walls.",
        "Brake on sharp turns or fly off!",
        "Hit max speed to clear structural gaps."
    ];

    const tutInterval = setInterval(() => {
        if (GAME.state === 'PAUSED') return; // Pause tutorial timer if game paused
        timeLeft--;
        timerUI.innerText = `TUTORIAL: ${timeLeft}s`;
        
        if(timeLeft === 11) instUI.innerText = instructions[1];
        if(timeLeft === 8) instUI.innerText = instructions[2];
        if(timeLeft === 5) instUI.innerText = instructions[3];
        if(timeLeft === 2) instUI.innerText = instructions[4];

        if(timeLeft <= 0 || GAME.state === 'DEATH' || GAME.state === 'WIN') {
            clearInterval(tutInterval);
            tutUI.classList.add('hidden');
        }
    }, 1000);
}

function die(reason) {
    GAME.state = 'DEATH'; GAME.lives--; updateLives();
    if(GAME.lives <= 0) {
        showMsg("SIMULATION FAILED", "Chassis Destroyed. No backups remain.", "REBOOT", () => location.reload());
    } else {
        showMsg("UNIT LOST", reason, "RESPAWN", () => {
            GAME.t = Math.max(0, GAME.t - 0.05);
            const insideGap = GAME.gaps.find(g => GAME.t >= g.start && GAME.t <= g.end);
            if(insideGap) GAME.t = insideGap.start - 0.05;
            GAME.gaps.forEach(g => { if(g.start >= GAME.t) g.cleared = false; });
            GAME.speed = 0; GAME.latTheta = 0; GAME.latVel = 0; GAME.jumpState = 0;
            GAME.state = 'PLAYING';
        });
    }
}

// =======================================================
// MAIN PHYSICS LOOP
// =======================================================
function animate() {
    requestAnimationFrame(animate);

    // If we are in the menu, dead, or paused, just render the scene statically
    if(GAME.state !== 'PLAYING' || !curve) { 
        if(curve) renderer.render(scene, camera); 
        return; 
    }

    if(GAME.jumpState === 0) {
        // PROPULSION
        if(INPUT.up) GAME.speed += GAME.maxSpeed * 0.03;
        if(INPUT.down) GAME.speed -= GAME.maxSpeed * 0.06;
        GAME.speed *= 0.985; 
        GAME.speed = Math.max(0, Math.min(GAME.speed, GAME.maxSpeed));
        GAME.t += GAME.speed;

        // UI SYNC
        document.getElementById('ui-speed').innerText = Math.floor((GAME.speed/GAME.maxSpeed)*300).toString().padStart(3,'0');
        document.getElementById('ui-speed-bar').style.width = `${(GAME.speed/GAME.maxSpeed)*100}%`;
        document.getElementById('ui-prog-bar').style.width = `${GAME.t * 100}%`;

        const tangent = curve.getTangentAt(GAME.t % 1);
        const up = new THREE.Vector3(0,1,0);
        const right = new THREE.Vector3().crossVectors(tangent, up).normalize();

        const nextTan = curve.getTangentAt(Math.min(1, GAME.t + 0.01));
        const bend = right.dot(nextTan);
        const centrifugal = bend * (GAME.speed * GAME.speed) * 350000;

        // LATERAL MOVEMENT
        GAME.latVel -= Math.sin(GAME.latTheta) * 0.05; 
        GAME.latVel += centrifugal; 
        if(INPUT.left) GAME.latVel -= 0.012;
        if(INPUT.right) GAME.latVel += 0.012;
        GAME.latVel *= 0.88; 
        GAME.latTheta += GAME.latVel;

        ball.position.copy(getSurfacePosition(GAME.t % 1, GAME.latTheta));
        ball.rotateOnWorldAxis(right, GAME.speed * 50);

        // HAZARD CHECKS
        if(Math.abs(GAME.latTheta) > Math.PI / 2.05) { die("Centrifugal forces exceeded. Flung over track barriers."); return; }
        
        const activeGap = GAME.gaps.find(g => GAME.t >= g.start && GAME.t <= g.end && !g.cleared);
        if(activeGap) {
            activeGap.cleared = true; 
            GAME.currentJump = activeGap;
            const requiredSpeed = GAME.maxSpeed * (0.75 + (GAME.level * 0.015));

            if(GAME.speed > requiredSpeed) {
                GAME.jumpState = 1; 
                GAME.jumpTarget = activeGap.end;
                GAME.jumpStartTheta = GAME.latTheta; 
            } else {
                GAME.jumpState = 2; GAME.jumpStartY = ball.position.y;
            }
        }

        // WIN CONDITION
        if(GAME.t >= 0.99) {
            GAME.state = 'WIN';
            if(GAME.level >= 8) showMsg("SYSTEM CONQUERED", "All 8 sectors cleared successfully.", "PLAY AGAIN", () => location.reload());
            else showMsg(`SECTOR ${GAME.level} SECURED`, "Initializing next sector...", "PROCEED", () => { GAME.level++; loadLevel(GAME.level); GAME.state = 'PLAYING'; });
            return;
        }

    } else if (GAME.jumpState === 1) { 
        GAME.t += GAME.speed; 
        const p = (GAME.t - GAME.currentJump.start) / (GAME.jumpTarget - GAME.currentJump.start);
        
        const startPos = getSurfacePosition(GAME.currentJump.start, GAME.jumpStartTheta);
        const endPos = getSurfacePosition(GAME.jumpTarget, 0); 

        const arcPos = new THREE.Vector3().lerpVectors(startPos, endPos, p);
        arcPos.y += Math.sin(p * Math.PI) * 120; 
        
        ball.position.copy(arcPos);
        
        if(p >= 1.0) { 
            GAME.jumpState = 0; 
            GAME.latTheta = 0; 
            GAME.latVel = 0; 
        }

    } else if (GAME.jumpState === 2) { 
        ball.position.y -= 8; ball.position.z -= 5;
        if(ball.position.y < GAME.jumpStartY - 500) { die("Velocity insufficient to clear the structural gap."); return; }
    }

    // CINEMATIC CAMERA
    const cTan = curve.getTangentAt(Math.min(1, GAME.t));
    const camTarget = ball.position.clone().add(cTan.clone().multiplyScalar(-60)).add(new THREE.Vector3(0, 35, 0));
    camera.position.lerp(camTarget, 0.15);
    camera.lookAt(ball.position);

    renderer.render(scene, camera);
}

animate();
