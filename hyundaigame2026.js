// --- Game State & Data ---
let state = 'INIT'; 
let level = 1;
const maxLevels = 10;
let health = 100;
let timer = 0.0;
let isCoverDeployed = false;
let isPaused = false; // New Pause State

const levelData = [
    { title: "Level 1: Hailstorm", desc: "Heavy Hail. Deploy SHIELD to protect the vehicle.", duration: 15 },
    { title: "Level 2: F1 Tornado", desc: "DRIVE to outrun the funnel! Touching it drains 6% Integrity per second.", duration: 15 },
    { title: "Level 3: Zombie Attack", desc: "Zombies tracking the vehicle. SHIELD to block. Unshielded hits drain 5%.", duration: 15 },
    { title: "Level 4: UFO Attack", desc: "Low-flying UFO. Unshielded contact with the tractor beam drains 4% Integrity per second.", duration: 15 },
    { title: "Level 5: Rogue Vehicles", desc: "A Bus, Ambulance, and Mower approach. SHIELD to block or DRIVE to evade.", duration: 15 },
    { title: "Level 6: Tricky F2 Setup", desc: "Tornado + Bouncing Cow. Alternate between SHIELD (blocks cow) and DRIVE (evades tornado).", duration: 15 },
    { title: "Level 7: Mad Cow & UFO", desc: "Bipedal Mad Cow with an axe + UFO. Mad Cow blocked by shield.", duration: 15 },
    { title: "Level 8: F3 Tornado Combo", desc: "Hailstorm + F3 Tornado + Circling Mad Cows. High chaos.", duration: 20 },
    { title: "Level 9: Zombie & UFO", desc: "Zombies tracking the vehicle while UFO sweeps the area.", duration: 20 },
    { title: "Level 10: F5 APOCALYPSE", desc: "F5 Tornado, Zombies, Cows, and Mad Cows. Survive for 30 seconds.", duration: 30 }
];

// --- Input Handling ---
const keys = { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false };

window.addEventListener('keydown', (e) => { 
    if(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault(); 
    if(keys.hasOwnProperty(e.key)) keys[e.key] = true; 
    if(e.key === ' ' && !e.repeat) toggleShield(); 
    if((e.key === 'p' || e.key === 'P') && !e.repeat) togglePause();
}, { passive: false });

window.addEventListener('keyup', (e) => { 
    if(keys.hasOwnProperty(e.key)) keys[e.key] = false; 
});

document.querySelectorAll('.ctrl-btn:not(#btn-shield)').forEach(btn => {
    const press = (e) => { e.preventDefault(); keys[btn.dataset.key] = true; btn.style.background = 'rgba(100,100,100,0.9)'; };
    const release = (e) => { e.preventDefault(); keys[btn.dataset.key] = false; btn.style.background = 'rgba(0,0,0,0.7)'; };
    btn.addEventListener('touchstart', press, {passive: false});
    btn.addEventListener('touchend', release, {passive: false});
    btn.addEventListener('mousedown', press);
    btn.addEventListener('mouseup', release);
    btn.addEventListener('mouseleave', release);
});

// Pause Button Setup
const pauseBtn = document.getElementById('btn-pause');
pauseBtn.addEventListener('click', togglePause);

function togglePause() {
    if (state === 'GAMEOVER' || state === 'INIT') return;
    isPaused = !isPaused;
    pauseBtn.innerText = isPaused ? "▶ RESUME (P)" : "⏸ PAUSE (P)";
    pauseBtn.style.backgroundColor = isPaused ? "#ffcc00" : "#28a745";
    pauseBtn.style.color = isPaused ? "black" : "white";
    if (!isPaused) lastTime = performance.now(); // Reset timer so dt doesn't jump
}

const shieldBtn = document.getElementById('btn-shield');
let lastShieldToggle = 0;
function handleShieldToggle(e) {
    e.preventDefault();
    if(isPaused) return;
    let now = Date.now();
    if (now - lastShieldToggle < 200) return;
    lastShieldToggle = now;
    toggleShield();
}
shieldBtn.addEventListener('touchstart', handleShieldToggle, {passive: false});
shieldBtn.addEventListener('click', handleShieldToggle);

function toggleShield() {
    if (state !== 'PLAYING' || isPaused) return;
    isCoverDeployed = !isCoverDeployed;
    cover.visible = isCoverDeployed;
    shieldBtn.classList.toggle('shield-active', isCoverDeployed);
    shieldBtn.innerText = isCoverDeployed ? "🛡️ SHIELD ON" : "🛡️ SHIELD OFF";
}

function forceRetractShield() {
    isCoverDeployed = false;
    cover.visible = false;
    shieldBtn.classList.remove('shield-active');
    shieldBtn.innerText = "🛡️ SHIELD";
}

// --- Engine Setup ---
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0xd2b48c, 0.012);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x87CEEB); 
renderer.shadowMap.enabled = true; 
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI / 2 - 0.05; 
controls.minDistance = 6;
controls.maxDistance = 25;

const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);
const sunLight = new THREE.DirectionalLight(0xffffff, 1.0);
sunLight.position.set(20, 30, 10);
sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 2048;
sunLight.shadow.mapSize.height = 2048;
scene.add(sunLight);

const sand = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), new THREE.MeshStandardMaterial({ color: 0xd2b48c, roughness: 1 }));
sand.rotation.x = -Math.PI / 2;
sand.receiveShadow = true;
scene.add(sand);

const rockGeo = new THREE.DodecahedronGeometry(0.5, 0);
const rockMat = new THREE.MeshStandardMaterial({ color: 0x8b7355, roughness: 0.9 });
for(let i=0; i<600; i++) {
    const mesh = new THREE.Mesh(rockGeo, rockMat);
    mesh.position.set((Math.random() - 0.5) * 1000, 0.1, (Math.random() - 0.5) * 1000);
    mesh.rotation.set(Math.random(), Math.random(), Math.random());
    const scale = Math.random() * 2 + 0.5;
    mesh.scale.set(scale, scale, scale);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
}

// --- The Vehicle ---
const carGroup = new THREE.Group();
scene.add(carGroup);

const carBodyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.2, roughness: 0.4 }); 
const carBottomMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.2 }); // Now White

// Lower Body
const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.1, 4.4), carBottomMat);
chassis.position.y = 0.9;
chassis.castShadow = true;
chassis.receiveShadow = true;
carGroup.add(chassis);

// Upper Cabin
const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.7, 2.4), carBodyMat);
cabin.position.set(0, 1.8, -0.3);
cabin.castShadow = true;
carGroup.add(cabin);

// Spoiler
const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.15, 0.6), new THREE.MeshStandardMaterial({color: 0x111111}));
spoiler.position.set(0, 2.2, -1.3);
spoiler.rotation.x = 0.1;
carGroup.add(spoiler);

// Windshields and Sunroof Materials
const glassMat = new THREE.MeshStandardMaterial({ color: 0xadd8e6, transparent: true, opacity: 0.8, roughness: 0.1 }); 
const brokenGlassMat = new THREE.MeshBasicMaterial({ color: 0x444444, wireframe: true, transparent: true, opacity: 0.5 }); 

const sunroof = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 1.0), glassMat);
sunroof.position.set(0, 2.15, -0.3);
carGroup.add(sunroof);

// Flush Front Windshield Geometry
const frontGlass = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.05, 0.05), glassMat);
frontGlass.position.set(0, 1.8, 1.1); // Moved forward
frontGlass.rotation.x = Math.PI / 4; // Angled 45 deg to sit flush
carGroup.add(frontGlass);

const rearGlass = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.7, 0.05), glassMat);
rearGlass.position.set(0, 1.8, -1.55);
rearGlass.rotation.x = -Math.PI / 8;
carGroup.add(rearGlass);

// Wheels
const wheels = [];
[[-1.05, 1.4], [1.05, 1.4], [-1.05, -1.4], [1.05, -1.4]].forEach(pos => {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.3, 16), new THREE.MeshStandardMaterial({ color: 0x222222 }));
    w.rotation.z = Math.PI / 2;
    w.position.set(pos[0], 0.48, pos[1]);
    w.castShadow = true;
    wheels.push(w);
    carGroup.add(w);
});

// Shield
const cover = new THREE.Mesh(
    new THREE.BoxGeometry(2.8, 2.8, 5.2),
    new THREE.MeshStandardMaterial({ color: 0x0088ff, transparent: true, opacity: 0.5, side: THREE.DoubleSide })
);
cover.position.y = 1.4;
cover.visible = false;
carGroup.add(cover);

// Particle System (Smoke & Fire)
const emissions = [];
const pGeo = new THREE.PlaneGeometry(0.6, 0.6);
const smokeMat = new THREE.MeshBasicMaterial({ color: 0x555555, transparent: true, opacity: 0.6 });
const fireMat = new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending }); // Glowing flames

function spawnEmissions() {
    if (state !== 'PLAYING' || isPaused) return;
    
    if (health < 50) {
        const s = new THREE.Mesh(pGeo, smokeMat);
        s.position.set(carGroup.position.x + (Math.random()-0.5)*1.5, carGroup.position.y + 1.2, carGroup.position.z + (Math.random()-0.5)*2 + 1.0);
        s.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI, Math.random()*Math.PI);
        scene.add(s);
        emissions.push({ mesh: s, life: 1.0, isFire: false });
    }

    if (health < 30) {
        const f = new THREE.Mesh(pGeo, fireMat);
        f.position.set(carGroup.position.x + (Math.random()-0.5)*2.0, carGroup.position.y + 1.0, carGroup.position.z + (Math.random()-0.5)*4.0);
        f.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI, Math.random()*Math.PI);
        scene.add(f);
        emissions.push({ mesh: f, life: 1.0, isFire: true });
    }
}
setInterval(spawnEmissions, 60);

// --- Entity Generators ---
const activeEntities = { hail: [], tornado: null, ufo: null, zombies: [], cows: [], rogues: [] };

function buildTornado(scaleX, scaleY) {
    if(activeEntities.tornado) scene.remove(activeEntities.tornado);
    const tg = new THREE.Group();
    for(let i = 0; i < 30; i++) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry((0.5 + (i * i * 0.02)) * scaleX, 0.4, 8, 16), new THREE.MeshStandardMaterial({ color: i%2===0 ? 0x444444 : 0x222222 }));
        ring.position.y = i * 0.8 * scaleY;
        ring.rotation.x = Math.PI / 2;
        ring.rotation.y = Math.random() * Math.PI; 
        ring.castShadow = true;
        tg.add(ring);
    }
    tg.visible = false;
    scene.add(tg);
    activeEntities.tornado = tg;
}

function spawnHail() {
    const hGroup = new THREE.Group();
    hGroup.add(new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), new THREE.MeshBasicMaterial({ color: 0xddddff })));
    hGroup.add(new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), new THREE.MeshBasicMaterial({ color: 0x000000, wireframe: true }))); 
    hGroup.position.set(carGroup.position.x + (Math.random()-0.5)*30, 25, carGroup.position.z + (Math.random()-0.5)*30);
    scene.add(hGroup);
    activeEntities.hail.push(hGroup);
}

function spawnZombie(x, z, isMadCow) {
    const zGroup = new THREE.Group();
    zGroup.position.set(x, 0, z);
    const mainMat = new THREE.MeshStandardMaterial({ color: isMadCow ? 0xffffff : 0x6e8b60 });
    const secMat = new THREE.MeshStandardMaterial({ color: isMadCow ? 0x111111 : 0x3d3d3d }); 
    
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.0, 0.5), secMat);
    torso.position.y = 1.3;
    zGroup.add(torso);
    
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), mainMat);
    head.position.y = 2.1;
    if(isMadCow) {
        const eye1 = new THREE.Mesh(new THREE.BoxGeometry(0.15,0.15,0.1), new THREE.MeshBasicMaterial({color: 0xff0000}));
        eye1.position.set(0.15, 0.1, 0.3); head.add(eye1);
        const eye2 = new THREE.Mesh(new THREE.BoxGeometry(0.15,0.15,0.1), new THREE.MeshBasicMaterial({color: 0xff0000}));
        eye2.position.set(-0.15, 0.1, 0.3); head.add(eye2);
    }
    zGroup.add(head);

    const lLegPivot = new THREE.Group(); lLegPivot.position.set(-0.25, 0.8, 0);
    const lLeg = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.8, 0.3), secMat); lLeg.position.y = -0.4; lLegPivot.add(lLeg); zGroup.add(lLegPivot);

    const rLegPivot = new THREE.Group(); rLegPivot.position.set(0.25, 0.8, 0);
    const rLeg = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.8, 0.3), secMat); rLeg.position.y = -0.4; rLegPivot.add(rLeg); zGroup.add(rLegPivot);

    const rArmPivot = new THREE.Group(); rArmPivot.position.set(0.55, 1.7, 0);
    const rArm = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.8, 0.25), mainMat); rArm.position.y = -0.4; rArmPivot.add(rArm);
    
    const weapon = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.8, 0.2), new THREE.MeshStandardMaterial({ color: 0x8b5a2b }));
    weapon.position.set(0, -0.7, 0.4); weapon.rotation.x = Math.PI / 2;
    rArmPivot.add(weapon);
    zGroup.add(rArmPivot);

    zGroup.userData = { lLegPivot, rLegPivot, rArmPivot, animOffset: Math.random() * Math.PI * 2, type: isMadCow ? 'madcow' : 'zombie' };
    zGroup.traverse(child => { if (child.isMesh) child.castShadow = true; });
    scene.add(zGroup);
    activeEntities.zombies.push(zGroup);
}

function spawnCow(x, z) {
    const cGroup = new THREE.Group();
    cGroup.position.set(x, 2, z);
    
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const blackMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
    const pinkMat = new THREE.MeshStandardMaterial({ color: 0xffb6c1 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 1.4), whiteMat);
    const spot = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.4, 0.6), blackMat); 
    cGroup.add(body); cGroup.add(spot);
    
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.5), whiteMat);
    head.position.set(0, 0.4, 0.7);
    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.2), pinkMat);
    nose.position.set(0, -0.1, 0.3);
    head.add(nose);
    cGroup.add(head);

    [[-0.3, -0.4, 0.5], [0.3, -0.4, 0.5], [-0.3, -0.4, -0.5], [0.3, -0.4, -0.5]].forEach(pos => {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.6, 0.15), blackMat);
        leg.position.set(...pos);
        cGroup.add(leg);
    });

    cGroup.traverse(child => { if (child.isMesh) child.castShadow = true; });
    scene.add(cGroup);
    activeEntities.cows.push({ mesh: cGroup, angle: Math.random() * Math.PI * 2, state: 'orbit' }); 
}

function buildUFO() {
    if(activeEntities.ufo) scene.remove(activeEntities.ufo);
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(3, 1, 1, 32), new THREE.MeshStandardMaterial({color: 0x888888, metalness: 0.8})));
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 3, 12, 32), new THREE.MeshBasicMaterial({color: 0x00ffcc, transparent: true, opacity: 0.3}));
    beam.position.y = -6;
    g.add(beam);
    g.visible = false;
    scene.add(g);
    activeEntities.ufo = g;
}

function spawnRogueVehicle(type, x, z) {
    const vGroup = new THREE.Group();
    
    let mainColor, length, height;
    if(type === 'bus') { mainColor = 0xffcc00; length = 6; height = 2; }
    else if(type === 'ambulance') { mainColor = 0xffffff; length = 4.5; height = 1.8; }
    else { mainColor = 0x228b22; length = 1.5; height = 0.8; } 

    const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, height, length), new THREE.MeshStandardMaterial({color: mainColor}));
    body.position.y = height/2 + 0.5;
    vGroup.add(body);

    if(type === 'bus' || type === 'ambulance') {
        const win = new THREE.Mesh(new THREE.BoxGeometry(1.9, height*0.4, length*0.8), new THREE.MeshStandardMaterial({color: 0x111111}));
        win.position.y = height/2 + 0.8;
        vGroup.add(win);
    }
    if(type === 'ambulance') {
        const light = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.2, 0.4), new THREE.MeshBasicMaterial({color: 0xff0000}));
        light.position.set(0, height + 0.6, 1);
        vGroup.add(light);
    }

    const wheelGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 16);
    const wheelMat = new THREE.MeshStandardMaterial({color: 0x111111});
    [[-1, length/3], [1, length/3], [-1, -length/3], [1, -length/3]].forEach(pos => {
        const w = new THREE.Mesh(wheelGeo, wheelMat);
        w.rotation.z = Math.PI/2;
        w.position.set(pos[0], 0.4, pos[1]);
        vGroup.add(w);
    });

    vGroup.position.set(x, 0, z);
    vGroup.traverse(child => { if(child.isMesh) child.castShadow = true; });
    scene.add(vGroup);
    activeEntities.rogues.push({ mesh: vGroup, speed: Math.random()*0.15 + 0.1 });
}

// --- Game Logic Flow ---
function startGame() {
    document.getElementById('intro-screen').style.display = 'none';
    document.getElementById('game-ui').style.display = 'block';
    document.getElementById('mobile-controls').style.display = 'flex';
    pauseBtn.style.display = 'block';
    startLevelTransition(1);
}

function cleanUpHazards() {
    activeEntities.hail.forEach(h => scene.remove(h)); activeEntities.hail.length = 0;
    activeEntities.zombies.forEach(z => scene.remove(z)); activeEntities.zombies.length = 0;
    activeEntities.cows.forEach(c => scene.remove(c.mesh)); activeEntities.cows.length = 0;
    activeEntities.rogues.forEach(r => scene.remove(r.mesh)); activeEntities.rogues.length = 0;
    if(activeEntities.tornado) activeEntities.tornado.visible = false;
    if(activeEntities.ufo) activeEntities.ufo.visible = false;
    forceRetractShield();
}

function triggerInspectPhase() {
    state = 'INSPECT';
    timer = 10.0;
    cleanUpHazards();
    document.getElementById('mode-indicator').style.display = 'block';
    document.getElementById('mode-indicator').innerText = "LEVEL CLEAR! Inspect Vehicle Damage (10s)";
    controls.autoRotate = true;
    controls.autoRotateSpeed = 2.0;
}

function startLevelTransition(nextLevel) {
    state = 'TRANSITION';
    level = nextLevel;
    timer = 9.0; 
    cleanUpHazards();
    controls.autoRotate = false;
    document.getElementById('mode-indicator').style.display = 'none';
    
    const d = levelData[level-1];
    document.getElementById('transition-title').innerText = d.title;
    document.getElementById('transition-desc').innerText = d.desc;
    document.getElementById('level-transition').style.display = 'flex';
}

function startPlayingPhase() {
    state = 'PLAYING';
    timer = levelData[level-1].duration; 
    document.getElementById('level-transition').style.display = 'none';
    
    carGroup.rotation.y = 0; 
    camera.position.set(carGroup.position.x + 8, carGroup.position.y + 6, carGroup.position.z + 12);
    controls.target.copy(carGroup.position);
    
    const spawnZ = carGroup.position.z - 25; 
    const spawnX = carGroup.position.x - 10;

    renderer.setClearColor(0x87CEEB); scene.fog.color.setHex(0xd2b48c); 
    
    if (level === 2 || level === 6 || level === 8 || level === 10) {
        renderer.setClearColor(0x444444); scene.fog.color.setHex(0x444444);
        let scaleX = 1, scaleY = 1;
        if(level===8) { scaleX = 1.5; scaleY = 1.2; } 
        if(level===10) { scaleX = 2.5; scaleY = 1.5; renderer.setClearColor(0x222222); scene.fog.color.setHex(0x222222); }
        buildTornado(scaleX, scaleY);
        activeEntities.tornado.position.set(spawnX, 0, spawnZ);
        activeEntities.tornado.visible = true;
    }
    
    if (level === 3 || level === 9 || level === 10) {
        renderer.setClearColor(level===10 ? 0x222222 : 0x3a5f43); scene.fog.color.setHex(level===10 ? 0x222222 : 0x3a5f43);
        for(let i=0; i < (level===10 ? 8 : 4); i++) spawnZombie(spawnX + (Math.random()-0.5)*20, spawnZ + (Math.random()-0.5)*20, false);
    }
    
    if (level === 4 || level === 7 || level === 9) {
        renderer.setClearColor(0x111133); scene.fog.color.setHex(0x111133);
        buildUFO();
        activeEntities.ufo.position.set(spawnX, 8, spawnZ); 
        activeEntities.ufo.visible = true;
    }

    if (level === 5) {
        spawnRogueVehicle('bus', spawnX, spawnZ);
        spawnRogueVehicle('ambulance', spawnX - 5, spawnZ - 10);
        spawnRogueVehicle('mower', spawnX + 5, spawnZ - 5);
    }

    if (level === 6) spawnCow(spawnX, spawnZ);
    if (level === 8 || level === 10) {
        for(let i=0; i<3; i++) spawnCow(spawnX, spawnZ);
    }

    if (level === 7 || level === 8 || level === 10) {
        for(let i=0; i < (level===10 ? 4 : 2); i++) spawnZombie(spawnX + (Math.random()-0.5)*15, spawnZ + (Math.random()-0.5)*15, true); 
    }
}

function takeDamage(amount) {
    if (state !== 'PLAYING') return; 

    health = Math.max(0, health - amount);
    document.getElementById('health-text').innerText = Math.floor(health) + "%";
    document.getElementById('health-bar').style.width = health + "%";
    
    const container = document.getElementById('health-bar-container');
    container.classList.remove('damage-flash');
    void container.offsetWidth; 
    container.classList.add('damage-flash');
    setTimeout(() => { container.classList.remove('damage-flash'); }, 400); 
    
    // Strict Progressive Damage Visuals
    if (health <= 96) { 
        sunroof.material = brokenGlassMat; frontGlass.material = brokenGlassMat; rearGlass.material = brokenGlassMat; 
    } else {
        sunroof.material = glassMat; frontGlass.material = glassMat; rearGlass.material = glassMat;
    }
    
    wheels[0].scale.y = health < 80 ? 0.5 : 1.0; // FL Flat
    wheels[1].scale.y = health < 65 ? 0.5 : 1.0; // FR Flat
    wheels[2].scale.y = health < 50 ? 0.5 : 1.0; // RL Flat 
    wheels[3].scale.y = health < 35 ? 0.5 : 1.0; // RR Flat

    if (health < 50) document.getElementById('health-bar').style.backgroundColor = "#ffcc00";
    if (health < 20) document.getElementById('health-bar').style.backgroundColor = "#ff3333";
    
    if (health === 0 && state !== 'GAMEOVER') {
        state = 'GAMEOVER';
        document.getElementById('game-over-screen').style.display = 'flex';
        document.getElementById('mobile-controls').style.display = 'none';
        pauseBtn.style.display = 'none';
    }
}

// --- Main Loop ---
let lastTime = performance.now();
let spawnTimer = 0;

function animate() {
    requestAnimationFrame(animate);
    let now = performance.now();
    let dt = (now - lastTime) / 1000;
    lastTime = now;

    if (isPaused) {
        controls.update();
        renderer.render(scene, camera);
        return; // Halt physics updates
    }

    if (state === 'TRANSITION') {
        timer -= dt;
        document.getElementById('transition-timer').innerText = `Starting in ${Math.ceil(timer)}...`;
        if (timer <= 0) startPlayingPhase();
    }

    if (state === 'INSPECT') {
        timer -= dt;
        document.getElementById('time-text').innerText = timer.toFixed(1);
        if (timer <= 0) {
            if (level < maxLevels) startLevelTransition(level + 1);
            else {
                document.getElementById('game-over-title').innerText = "SIMULATION SURVIVED!";
                document.getElementById('game-over-title').style.color = "#00ff00";
                state = 'GAMEOVER';
                document.getElementById('game-over-screen').style.display = 'flex';
                pauseBtn.style.display = 'none';
            }
        }
    }

    if (state === 'PLAYING') {
        timer -= dt;
        document.getElementById('time-text').innerText = timer.toFixed(1);
        if (timer <= 0) triggerInspectPhase();

        // Driving Physics (Inverted Steer)
        let speed = 0; let turn = 0;
        if (keys.ArrowUp) speed = 0.5;
        if (keys.ArrowDown) speed = -0.3;
        if (keys.ArrowLeft) turn = -0.05;
        if (keys.ArrowRight) turn = 0.05;

        if (speed !== 0 || turn !== 0) {
            let prevPos = carGroup.position.clone();
            carGroup.translateZ(speed);
            carGroup.rotation.y += turn * (speed > 0 ? 1 : -1);
            wheels.forEach(w => w.rotation.x += speed * 0.5);
            camera.position.add(carGroup.position.clone().sub(prevPos));
        }

        // Particle System (Smoke & Fire)
        for(let i = emissions.length - 1; i >= 0; i--) {
            let p = emissions[i];
            p.mesh.position.y += dt * (p.isFire ? 3 : 2);
            p.mesh.scale.setScalar(1 + (1 - p.life)*(p.isFire ? 1.5 : 3));
            p.mesh.material.opacity = p.life * (p.isFire ? 0.8 : 0.6);
            p.life -= dt * (p.isFire ? 1.5 : 1.0); // Fire dies faster
            if(p.life <= 0) { scene.remove(p.mesh); emissions.splice(i, 1); }
        }

        if (level === 1 || level === 8) {
            spawnTimer += dt;
            if(spawnTimer > 0.05) { spawnHail(); spawnTimer = 0; }
            for (let i = activeEntities.hail.length - 1; i >= 0; i--) {
                let h = activeEntities.hail[i];
                h.position.y -= 0.6; 
                if (h.position.y < 2.5 && h.position.y > 0.5 && h.position.distanceTo(carGroup.position) < 3.0) {
                    scene.remove(h); activeEntities.hail.splice(i, 1);
                    if (!isCoverDeployed) takeDamage(3); 
                } else if (h.position.y < 0) {
                    scene.remove(h); activeEntities.hail.splice(i, 1);
                }
            }
        }

        if (activeEntities.tornado && activeEntities.tornado.visible) {
            activeEntities.tornado.children.forEach(ring => ring.rotation.z += 0.2); 
            activeEntities.tornado.rotation.y += 0.3;
            
            const dir = new THREE.Vector3().subVectors(carGroup.position, activeEntities.tornado.position).normalize();
            activeEntities.tornado.position.addScaledVector(dir, level === 10 ? 0.6 : 0.4); 
            if (activeEntities.tornado.position.distanceTo(carGroup.position) < 5) takeDamage(6 * dt); 
        }

        const barrierRadius = isCoverDeployed ? 3.8 : 2.5; 
        activeEntities.zombies.forEach(z => {
            z.lookAt(carGroup.position);
            const dist = z.position.distanceTo(carGroup.position);
            let zTime = performance.now() * 0.008 + z.userData.animOffset;
            
            z.userData.lLegPivot.rotation.x = Math.sin(zTime) * 0.6;
            z.userData.rLegPivot.rotation.x = Math.sin(zTime + Math.PI) * 0.6;

            if (dist > barrierRadius) {
                z.translateZ(0.18); 
                z.userData.rArmPivot.rotation.x = Math.sin(zTime) * 0.6; 
            } else {
                z.userData.rArmPivot.rotation.x = -Math.abs(Math.sin(zTime * 2)) * 1.5; 
            }
            if (dist <= 2.8 && !isCoverDeployed) takeDamage(5 * dt * 2); 
        });

        activeEntities.cows.forEach(c => {
            if(!activeEntities.tornado || !activeEntities.tornado.visible) return;
            
            if(c.state === 'orbit') {
                c.angle += dt * 2;
                c.mesh.position.x = activeEntities.tornado.position.x + Math.sin(c.angle) * 8;
                c.mesh.position.z = activeEntities.tornado.position.z + Math.cos(c.angle) * 8;
                c.mesh.position.y = 15 + Math.sin(c.angle * 3) * 5;
                c.mesh.rotation.x += 0.1; c.mesh.rotation.y += 0.1;

                if(Math.random() < 0.01) c.state = 'dive';
            } else if (c.state === 'dive') {
                const dir = new THREE.Vector3().subVectors(carGroup.position, c.mesh.position).normalize();
                c.mesh.position.addScaledVector(dir, 0.8);
                const dist = c.mesh.position.distanceTo(carGroup.position);

                if (dist < barrierRadius) {
                    if(!isCoverDeployed && dist < 2.5) takeDamage(4); 
                    c.state = 'bounce';
                }
                if(c.mesh.position.y < 0.5) c.state = 'bounce';
            } else if (c.state === 'bounce') {
                c.mesh.position.y += 0.5; 
                if(c.mesh.position.y > 15) c.state = 'orbit';
            }
        });

        if (activeEntities.ufo && activeEntities.ufo.visible) {
            activeEntities.ufo.rotation.y += 0.05;
            const dir = new THREE.Vector3().subVectors(carGroup.position, activeEntities.ufo.position);
            dir.y = 0; dir.normalize();
            activeEntities.ufo.position.addScaledVector(dir, 0.45); 
            
            if (Math.abs(activeEntities.ufo.position.x - carGroup.position.x) < 2.5 && Math.abs(activeEntities.ufo.position.z - carGroup.position.z) < 2.5) {
                if (!isCoverDeployed) takeDamage(4 * dt); 
            }
        }

        activeEntities.rogues.forEach(r => {
            r.mesh.lookAt(carGroup.position);
            r.mesh.translateZ(r.speed);
            const dist = r.mesh.position.distanceTo(carGroup.position);
            if(dist < barrierRadius) {
                if(!isCoverDeployed) takeDamage(10 * dt);
                r.mesh.translateZ(-r.speed * 2); 
            }
        });
    }

    controls.target.copy(carGroup.position);
    controls.update();
    renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();
