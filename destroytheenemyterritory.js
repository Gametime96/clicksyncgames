/* =========================================================================
   DESTROY THE ENEMY TERRITORY - 2026 COMBAT FLIGHT ENGINE
   ========================================================================= */

// --- 1. Sound FX System (Zero Drone, Event Driven) ---
const SFX = {
  ctx: null,

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    } else if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  },

  playWhoosh() {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, this.ctx.currentTime + 0.4);
    gain.gain.setValueAtTime(0.18, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.4);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.4);
  },

  playBombRelease() {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(45, this.ctx.currentTime + 0.6);
    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.6);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.6);
  },

  playDetonation() {
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate * 0.9;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(380, this.ctx.currentTime);
    filter.frequency.linearRampToValueAtTime(30, this.ctx.currentTime + 0.9);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.65, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.9);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    noise.start();
  },

  playFlakBurst() {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(130, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(30, this.ctx.currentTime + 0.18);
    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.18);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.18);
  }
};

// --- 2. Configuration & State ---
const CONFIG = {
  totalLevels: 7,
  highAltitude: 780,
  lowAltitude: 240,
  cloudBreakTime: 9.0,     // Breaches cloud deck at 9 seconds
  cloudUnderTime: 3.0,     // 3 seconds under clouds before manual override
  cruiseSpeed: 440,
  strikeProximity: 190,
  maxHealth: 100
};

// Autopilot takes total: 9s + 3s = 12s
CONFIG.totalAutopilotTime = CONFIG.cloudBreakTime + CONFIG.cloudUnderTime;

const state = {
  level: 1,
  active: false,
  elapsed: 0,
  inManualControl: false,
  alertShown: false,
  bombsLeft: 1,
  targetsLeft: 1,
  hullHealth: 100,

  plane: {
    x: 0,
    y: CONFIG.highAltitude,
    z: 0,
    targetY: CONFIG.highAltitude,
    roll: 0,
    pitch: 0
  },

  targets: [],
  enemyJets: [],
  flakBatteries: [],
  bombs: [],
  explosions: []
};

// Virtual Control State
const input = { up: false, down: false, left: false, right: false };

// Desktop Keyboard Binds
window.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (k === 'w' || k === 'arrowup') input.down = true; // Inverted pitch down
  if (k === 's' || k === 'arrowdown') input.up = true;  // Inverted pitch up
  if (k === 'a' || k === 'arrowleft') input.left = true;
  if (k === 'd' || k === 'arrowright') input.right = true;
  if (e.code === 'Space') {
    e.preventDefault();
    triggerBombRelease();
  }
});

window.addEventListener('keyup', e => {
  const k = e.key.toLowerCase();
  if (k === 'w' || k === 'arrowup') input.down = false;
  if (k === 's' || k === 'arrowdown') input.up = false;
  if (k === 'a' || k === 'arrowleft') input.left = false;
  if (k === 'd' || k === 'arrowright') input.right = false;
});

// UI Element Handles
const hudLevel = document.getElementById('hud-level');
const hudBombs = document.getElementById('hud-bombs');
const hudTargets = document.getElementById('hud-targets');
const hudSystem = document.getElementById('hud-system');
const countdownHud = document.getElementById('countdown-hud');
const countdownLabel = document.getElementById('countdown-label');
const countdownTimer = document.getElementById('countdown-timer');
const controlAlert = document.getElementById('control-alert');
const hullBarFill = document.getElementById('hull-bar-fill');
const hullValue = document.getElementById('hull-value');
const btnBomb = document.getElementById('btn-bomb');
const missionModal = document.getElementById('mission-modal');
const modalTitle = document.getElementById('modal-title');
const modalStatusText = document.getElementById('modal-status-text');
const modalActionBtn = document.getElementById('modal-action-btn');
const radarCanvas = document.getElementById('radar-canvas');
const radarCtx = radarCanvas.getContext('2d');

// Touch Flight Deck Hooks
function attachTouchDeck() {
  const bindTouch = (id, keyName) => {
    const el = document.getElementById(id);
    const press = (e) => { e.preventDefault(); input[keyName] = true; el.classList.add('active'); };
    const lift = (e) => { e.preventDefault(); input[keyName] = false; el.classList.remove('active'); };
    el.addEventListener('touchstart', press, { passive: false });
    el.addEventListener('touchend', lift, { passive: false });
    el.addEventListener('mousedown', press);
    el.addEventListener('mouseup', lift);
    el.addEventListener('mouseleave', lift);
  };

  bindTouch('btn-up', 'down');
  bindTouch('btn-down', 'up');
  bindTouch('btn-left', 'left');
  bindTouch('btn-right', 'right');

  const releasePayload = (e) => {
    e.preventDefault();
    triggerBombRelease();
  };
  btnBomb.addEventListener('touchstart', releasePayload, { passive: false });
  btnBomb.addEventListener('mousedown', releasePayload);
}

// --- 3. Three.js High-Definition Pipeline ---
let scene, camera, renderer;
let b29Group, propDiscs = [];
let terrainMesh, cloudMesh;

function initEngine() {
  const container = document.getElementById('canvas-wrapper');
  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0xa1bed2, 0.00024);

  camera = new THREE.PerspectiveCamera(54, window.innerWidth / window.innerHeight, 5, 26000);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  // Natural Sky & Sun Rigging
  const hemi = new THREE.HemisphereLight(0xffffff, 0x4a5d43, 0.75);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff5e4, 1.45);
  sun.position.set(700, 2200, -1400);
  sun.castShadow = true;
  sun.shadow.camera.top = 2200;
  sun.shadow.camera.bottom = -2200;
  sun.shadow.camera.left = -2200;
  sun.shadow.camera.right = 2200;
  sun.shadow.camera.near = 400;
  sun.shadow.camera.far = 6000;
  sun.shadow.mapSize.width = 2048;
  sun.shadow.mapSize.height = 2048;
  scene.add(sun);

  buildLandscape();
  buildCloudCeiling();
  buildBoeingB29();

  window.addEventListener('resize', adaptViewport);
  window.addEventListener('orientationchange', () => setTimeout(adaptViewport, 150));
}

function adaptViewport() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
}

// Procedural Coastal Mountain Landscape
function buildLandscape() {
  const geo = new THREE.PlaneGeometry(28000, 70000, 80, 140);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    let elevation = Math.sin(x * 0.0007) * Math.cos(z * 0.0005) * 280;
    elevation += Math.sin(x * 0.0018 + z * 0.0012) * 110;
    if (x > 2600) elevation -= 240; // Coastline grade
    pos.setY(i, Math.max(0, elevation));
  }
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    color: 0x616a4b,
    roughness: 0.88,
    metalness: 0.08,
    flatShading: true
  });
  terrainMesh = new THREE.Mesh(geo, mat);
  terrainMesh.receiveShadow = true;
  terrainMesh.position.set(0, -60, 28000);
  scene.add(terrainMesh);
}

// Volumetric Cloud Deck
function buildCloudCeiling() {
  const geo = new THREE.PlaneGeometry(28000, 70000, 16, 16);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshLambertMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.95,
    depthWrite: false
  });
  cloudMesh = new THREE.Mesh(geo, mat);
  cloudMesh.position.set(0, 520, 28000);
  scene.add(cloudMesh);
}

// Accurate Boeing B-29 Superfortress Model
function buildBoeingB29() {
  b29Group = new THREE.Group();

  const alloyMat = new THREE.MeshStandardMaterial({
    color: 0xdde3ea,
    roughness: 0.28,
    metalness: 0.75
  });
  const darkAlloy = new THREE.MeshStandardMaterial({
    color: 0x3d4852,
    roughness: 0.45,
    metalness: 0.65
  });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x1a252f,
    roughness: 0.1,
    transmission: 0.7,
    thickness: 1.5
  });

  // Fuselage Body
  const fuseGeo = new THREE.CylinderGeometry(15, 13.8, 204, 28);
  fuseGeo.rotateX(Math.PI / 2);
  const fuselage = new THREE.Mesh(fuseGeo, alloyMat);
  fuselage.castShadow = true;
  b29Group.add(fuselage);

  // Glass Cockpit
  const noseGeo = new THREE.SphereGeometry(14.8, 20, 20, 0, Math.PI * 2, 0, Math.PI * 0.5);
  noseGeo.rotateX(-Math.PI / 2);
  const nose = new THREE.Mesh(noseGeo, glassMat);
  nose.position.set(0, 0, 102);
  b29Group.add(nose);

  // Wingspan
  const wingGeo = new THREE.BoxGeometry(380, 4, 38);
  const wings = new THREE.Mesh(wingGeo, alloyMat);
  wings.position.set(0, 4.5, 18);
  wings.castShadow = true;
  b29Group.add(wings);

  // Wing Pods
  const podGeo = new THREE.CylinderGeometry(4.8, 4.8, 50, 16);
  podGeo.rotateX(Math.PI / 2);
  const podL = new THREE.Mesh(podGeo, darkAlloy);
  podL.position.set(-150, -4, 18);
  const podR = podL.clone();
  podR.position.x = 150;
  b29Group.add(podL);
  b29Group.add(podR);

  // Vertical Fin
  const finShape = new THREE.Shape();
  finShape.moveTo(0, 0);
  finShape.lineTo(0, 78);
  finShape.lineTo(-28, 86);
  finShape.lineTo(-44, 0);
  finShape.closePath();

  const finExt = new THREE.ExtrudeGeometry(finShape, { depth: 3.8, bevelEnabled: false });
  finExt.rotateY(Math.PI / 2);
  const fin = new THREE.Mesh(finExt, alloyMat);
  fin.position.set(-1.9, 4, -94);
  fin.castShadow = true;
  b29Group.add(fin);

  // Horizontal Tail
  const tailGeo = new THREE.BoxGeometry(124, 3, 28);
  const tail = new THREE.Mesh(tailGeo, alloyMat);
  tail.position.set(0, 11, -86);
  tail.castShadow = true;
  b29Group.add(tail);

  // 4 Radial Engines & Props
  const engineX = [-110, -54, 54, 110];
  propDiscs = [];

  engineX.forEach(x => {
    const engGeo = new THREE.CylinderGeometry(8.8, 9.4, 54, 16);
    engGeo.rotateX(Math.PI / 2);
    const eng = new THREE.Mesh(engGeo, darkAlloy);
    eng.position.set(x, 0.5, 20);
    eng.castShadow = true;
    b29Group.add(eng);

    const propGeo = new THREE.BoxGeometry(36, 2.6, 0.5);
    const propMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
    const prop = new THREE.Mesh(propGeo, propMat);
    prop.position.set(x, 0.5, 48);
    b29Group.add(prop);
    propDiscs.push(prop);
  });

  scene.add(b29Group);
}

// --- 4. Mission Setup & Reset ---
function setupMission(lvl) {
  state.level = lvl;
  state.active = true;
  state.elapsed = 0;
  state.inManualControl = false;
  state.alertShown = false;
  state.bombsLeft = lvl;
  state.targetsLeft = lvl;
  state.hullHealth = CONFIG.maxHealth;

  state.plane.x = 0;
  state.plane.y = CONFIG.highAltitude;
  state.plane.z = 0;
  state.plane.targetY = CONFIG.highAltitude;
  state.plane.roll = 0;

  countdownHud.style.display = 'flex';
  controlAlert.classList.add('hidden');
  countdownLabel.innerText = "AUTOPILOT INGRESS DESCENT";

  purgeEntities();

  // Primary Military Base Targets
  state.targets = [];
  const spacing = 3400;
  for (let i = 0; i < lvl; i++) {
    const tz = 6600 + i * spacing;
    const tx = (Math.random() - 0.5) * 1500;
    const baseMesh = buildBaseFacility(tx, 0, tz);
    scene.add(baseMesh);

    state.targets.push({
      id: i + 1,
      x: tx,
      y: 0,
      z: tz,
      destroyed: false,
      mesh: baseMesh
    });
  }

  // Anti-Air Flak Turrets
  state.flakBatteries = [];
  const flakCount = 4 + lvl * 2;
  for (let i = 0; i < flakCount; i++) {
    const fx = (Math.random() - 0.5) * 3000;
    const fz = 5200 + Math.random() * (lvl * spacing + 1200);
    const turret = buildFlakFacility(fx, 0, fz);
    scene.add(turret);

    state.flakBatteries.push({
      x: fx,
      z: fz,
      lastShot: Math.random() * 2,
      mesh: turret
    });
  }

  updateHUD();
}

function purgeEntities() {
  state.targets.forEach(t => scene.remove(t.mesh));
  state.flakBatteries.forEach(f => scene.remove(f.mesh));
  state.enemyJets.forEach(j => scene.remove(j.mesh));
  state.bombs.forEach(b => scene.remove(b.mesh));
  state.explosions.forEach(e => scene.remove(e.mesh));

  state.targets = [];
  state.flakBatteries = [];
  state.enemyJets = [];
  state.bombs = [];
  state.explosions = [];
}

function buildBaseFacility(x, y, z) {
  const g = new THREE.Group();
  g.position.set(x, y, z);

  const tarmacGeo = new THREE.BoxGeometry(380, 4, 520);
  const tarmacMat = new THREE.MeshStandardMaterial({ color: 0x272e36, roughness: 0.9 });
  const tarmac = new THREE.Mesh(tarmacGeo, tarmacMat);
  tarmac.receiveShadow = true;
  g.add(tarmac);

  const bunkerGeo = new THREE.BoxGeometry(96, 46, 96);
  const bunkerMat = new THREE.MeshStandardMaterial({ color: 0x727e8a });
  const bunker = new THREE.Mesh(bunkerGeo, bunkerMat);
  bunker.position.set(-75, 23, 0);
  bunker.castShadow = true;
  g.add(bunker);

  const siloGeo = new THREE.CylinderGeometry(22, 22, 58, 16);
  const siloMat = new THREE.MeshStandardMaterial({ color: 0x9b2b2b });
  const silo1 = new THREE.Mesh(siloGeo, siloMat);
  silo1.position.set(75, 29, -50);
  silo1.castShadow = true;
  const silo2 = silo1.clone();
  silo2.position.set(75, 29, 50);
  g.add(silo1);
  g.add(silo2);

  const towerGeo = new THREE.CylinderGeometry(3, 8, 90, 8);
  const towerMat = new THREE.MeshStandardMaterial({ color: 0xbdc3c7 });
  const tower = new THREE.Mesh(towerGeo, towerMat);
  tower.position.set(0, 45, 140);
  tower.castShadow = true;
  g.add(tower);

  return g;
}

function buildFlakFacility(x, y, z) {
  const geo = new THREE.BoxGeometry(32, 22, 32);
  const mat = new THREE.MeshStandardMaterial({ color: 0x1e272e });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y + 11, z);
  mesh.castShadow = true;
  return mesh;
}

// Ordnance Drop
function triggerBombRelease() {
  if (!state.active || !state.inManualControl) return;
  if (state.bombsLeft <= 0) return;

  state.bombsLeft--;
  SFX.playBombRelease();

  const bombGeo = new THREE.CylinderGeometry(3.6, 4.8, 26, 12);
  bombGeo.rotateX(Math.PI / 2);
  const bombMat = new THREE.MeshStandardMaterial({ color: 0x1a252f, metalness: 0.8 });
  const bombMesh = new THREE.Mesh(bombGeo, bombMat);
  bombMesh.position.set(state.plane.x, state.plane.y - 14, state.plane.z + 10);
  scene.add(bombMesh);

  state.bombs.push({
    mesh: bombMesh,
    x: state.plane.x,
    y: state.plane.y - 14,
    z: state.plane.z + 10,
    vx: (Math.random() - 0.5) * 8,
    vy: -22,
    vz: CONFIG.cruiseSpeed * 0.74
  });

  // Hostile interceptors scramble ONLY after bombs are deployed
  scrambleHostileJets();
  updateHUD();
}

function scrambleHostileJets() {
  const count = 1 + (state.level >= 4 ? 2 : 1);
  for (let i = 0; i < count; i++) {
    const jetMesh = buildHostileJetMesh();
    const spawnZ = state.plane.z - 1300 - (i * 400);
    const spawnX = state.plane.x + (Math.random() - 0.5) * 1100;
    const spawnY = state.plane.y + 40 + Math.random() * 80;

    jetMesh.position.set(spawnX, spawnY, spawnZ);
    scene.add(jetMesh);

    state.enemyJets.push({
      mesh: jetMesh,
      x: spawnX,
      y: spawnY,
      z: spawnZ,
      speed: CONFIG.cruiseSpeed + 90 + (state.level * 8),
      lastFire: 0
    });
  }
}

function buildHostileJetMesh() {
  const g = new THREE.Group();
  const jetMat = new THREE.MeshStandardMaterial({ color: 0xa82835, metalness: 0.6 });

  const bodyGeo = new THREE.ConeGeometry(7, 72, 12);
  bodyGeo.rotateX(Math.PI / 2);
  const body = new THREE.Mesh(bodyGeo, jetMat);
  g.add(body);

  const wingGeo = new THREE.BoxGeometry(72, 2, 26);
  const wing = new THREE.Mesh(wingGeo, jetMat);
  wing.position.set(0, 0, -8);
  g.add(wing);

  return g;
}

// --- 5. Flight Loop & Autopilot Hand-off ---
function updateFlight(delta) {
  if (!state.active) return;

  state.elapsed += delta;

  // Exact Timeline:
  // 0 - 9s: Autopilot high cruise above clouds, slowly descending
  // 9 - 12s: Breaking through and flying under clouds (3s)
  // 12s+: Autopilot disengages, player takes full control
  if (state.elapsed < CONFIG.cloudBreakTime) {
    const remain = Math.max(0, CONFIG.totalAutopilotTime - state.elapsed);
    countdownTimer.innerText = remain.toFixed(1) + 's';
    countdownLabel.innerText = "APPROACHING HOSTILE CORRIDOR";
    state.plane.targetY = CONFIG.highAltitude - (state.elapsed / CONFIG.cloudBreakTime) * 180;
    cloudMesh.material.opacity = 0.95;
    state.inManualControl = false;
  } else if (state.elapsed < CONFIG.totalAutopilotTime) {
    const remain = Math.max(0, CONFIG.totalAutopilotTime - state.elapsed);
    countdownTimer.innerText = remain.toFixed(1) + 's';
    countdownLabel.innerText = "PUNCHING THROUGH CEILING // MANUAL IN";
    state.plane.targetY = CONFIG.lowAltitude;
    cloudMesh.material.opacity = Math.max(0.12, cloudMesh.material.opacity - delta * 0.45);
    state.inManualControl = false;
  } else {
    // 12s Mark reached: Controls Hand-off
    if (!state.inManualControl) {
      state.inManualControl = true;
      countdownHud.style.display = 'none';
      SFX.playWhoosh();

      // Trigger Flash Notification
      controlAlert.classList.remove('hidden');
      setTimeout(() => {
        controlAlert.classList.add('hidden');
      }, 3500);

      updateHUD();
    }
  }

  // Smooth Altitude transition
  state.plane.y += (state.plane.targetY - state.plane.y) * 0.045;
  state.plane.z += CONFIG.cruiseSpeed * delta;

  // Steering & Pitch Handling
  if (state.inManualControl) {
    const turnRate = 280;
    if (input.left) {
      state.plane.x -= turnRate * delta;
      state.plane.roll = Math.max(state.plane.roll - 0.09, -0.45);
    } else if (input.right) {
      state.plane.x += turnRate * delta;
      state.plane.roll = Math.min(state.plane.roll + 0.09, 0.45);
    } else {
      state.plane.roll *= 0.88;
    }

    if (input.up) {
      state.plane.targetY = Math.min(state.plane.targetY + 150 * delta, CONFIG.highAltitude);
    } else if (input.down) {
      state.plane.targetY = Math.max(state.plane.targetY - 150 * delta, 160);
    }
  } else {
    state.plane.roll *= 0.9;
  }

  // Update B-29 Transform
  b29Group.position.set(state.plane.x, state.plane.y, state.plane.z);
  b29Group.rotation.z = -state.plane.roll;
  b29Group.rotation.x = (state.plane.targetY - state.plane.y) * 0.0012;

  propDiscs.forEach(p => p.rotation.z += 0.55);

  // Modern Rear-Chase Camera (GTA Style Position)
  camera.position.set(
    state.plane.x * 0.8,
    state.plane.y + 56,
    state.plane.z - 350
  );
  camera.lookAt(state.plane.x, state.plane.y + 14, state.plane.z + 550);

  // Infinite Terrain Shifting
  terrainMesh.position.z = state.plane.z + 28000;
  cloudMesh.position.z = state.plane.z + 28000;

  // Update Bombs
  for (let i = state.bombs.length - 1; i >= 0; i--) {
    const b = state.bombs[i];
    b.vy -= 280 * delta;
    b.x += b.vx * delta;
    b.y += b.vy * delta;
    b.z += b.vz * delta;

    b.mesh.position.set(b.x, b.y, b.z);
    b.mesh.rotation.x += 0.06;

    if (b.y <= 4) {
      spawnBlast(b.x, 4, b.z, 0xff7675, 1.8);
      SFX.playDetonation();

      state.targets.forEach(t => {
        if (!t.destroyed) {
          const dist = Math.hypot(b.x - t.x, b.z - t.z);
          if (dist <= CONFIG.strikeProximity) {
            t.destroyed = true;
            state.targetsLeft--;
            spawnBlast(t.x, 15, t.z, 0xd63031, 3.8);
            t.mesh.scale.set(1, 0.2, 1);
          }
        }
      });

      scene.remove(b.mesh);
      state.bombs.splice(i, 1);
      updateHUD();
      evaluateMissionStatus();
    }
  }

  // Ground Flak Artillery (Active below clouds)
  if (state.elapsed >= CONFIG.cloudBreakTime) {
    state.flakBatteries.forEach(turret => {
      turret.lastShot += delta;
      const dz = turret.z - state.plane.z;
      if (dz > -100 && dz < 2500 && turret.lastShot > 2.6 - (state.level * 0.12)) {
        turret.lastShot = 0;
        SFX.playFlakBurst();

        const bx = state.plane.x + (Math.random() - 0.5) * 160;
        const by = state.plane.y + (Math.random() - 0.5) * 100;
        const bz = state.plane.z + (Math.random() - 0.5) * 140;
        spawnBlast(bx, by, bz, 0xf39c12, 0.9);

        // B-29 Minimal Damage
        const prox = Math.hypot(bx - state.plane.x, by - state.plane.y, bz - state.plane.z);
        if (prox < 110) {
          receiveDamage(3.5);
        }
      }
    });
  }

  // Interceptors
  for (let i = state.enemyJets.length - 1; i >= 0; i--) {
    const jet = state.enemyJets[i];
    jet.z += jet.speed * delta;
    jet.x += (state.plane.x - jet.x) * 0.035;
    jet.y += (state.plane.y - jet.y) * 0.035;

    jet.mesh.position.set(jet.x, jet.y, jet.z);

    jet.lastFire += delta;
    if (jet.lastFire > 1.4 && jet.z < state.plane.z && jet.z > state.plane.z - 750) {
      jet.lastFire = 0;
      SFX.playFlakBurst();
      if (Math.random() < 0.45) {
        receiveDamage(3.0);
        spawnBlast(state.plane.x + (Math.random()-0.5)*25, state.plane.y, state.plane.z, 0xffa502, 0.45);
      }
    }
  }

  // Blast Dissipation
  for (let i = state.explosions.length - 1; i >= 0; i--) {
    const exp = state.explosions[i];
    exp.life -= delta * 2.2;
    exp.mesh.scale.multiplyScalar(1.05);
    exp.mesh.material.opacity = exp.life;
    if (exp.life <= 0) {
      scene.remove(exp.mesh);
      state.explosions.splice(i, 1);
    }
  }
}

function receiveDamage(val) {
  state.hullHealth = Math.max(0, state.hullHealth - val);
  hullBarFill.style.width = state.hullHealth + '%';
  hullValue.innerText = Math.round(state.hullHealth) + '%';

  if (state.hullHealth < 30) {
    hullBarFill.style.background = '#ff4757';
  }
  if (state.hullHealth <= 0) {
    terminateMission(false, "B-29 HEAVY BOMBER DOWN // CATASTROPHIC HULL LOSS.");
  }
}

function spawnBlast(x, y, z, colorHex, scale) {
  const geo = new THREE.SphereGeometry(15 * scale, 14, 14);
  const mat = new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.95 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  scene.add(mesh);

  state.explosions.push({ mesh, life: 1.0 });
}

function evaluateMissionStatus() {
  if (state.targetsLeft <= 0) {
    if (state.level >= CONFIG.totalLevels) {
      terminateMission(true, "WAR ZONE LIBERATED! ALL 7 THEATERS NEUTRALIZED.");
    } else {
      terminateMission(true, `SECTOR ${state.level} SECURED! PROCEEDING TO NEXT TARGET ZONE.`);
    }
  } else if (state.bombsLeft === 0 && state.bombs.length === 0) {
    terminateMission(false, "MISSION FAILED: OUT OF BOMBS. TARGETS REMAIN OPERATIONAL.");
  }
}

function terminateMission(victorious, debriefText) {
  state.active = false;
  missionModal.classList.remove('hidden');

  modalTitle.innerText = victorious ? "OBJECTIVE COMPLETED" : "MISSION FAILED";
  modalTitle.style.color = victorious ? "#2ecc71" : "#ff4757";
  modalStatusText.innerText = debriefText;

  if (victorious && state.level < CONFIG.totalLevels) {
    modalActionBtn.innerText = `COMMENCE MISSION ${state.level + 1}`;
    modalActionBtn.onclick = () => {
      missionModal.classList.add('hidden');
      setupMission(state.level + 1);
    };
  } else {
    modalActionBtn.innerText = "RESTART OPERATION";
    modalActionBtn.onclick = () => {
      missionModal.classList.add('hidden');
      setupMission(1);
    };
  }
}

function updateHUD() {
  hudLevel.innerText = `${state.level} / ${CONFIG.totalLevels}`;
  hudBombs.innerText = `${state.bombsLeft} BOMB${state.bombsLeft === 1 ? '' : 'S'}`;
  hudTargets.innerText = `${state.targetsLeft} BASE${state.targetsLeft === 1 ? '' : 'S'}`;

  if (state.inManualControl) {
    hudSystem.innerText = "MANUAL";
    hudSystem.className = "hud-metric tag-manual";
  } else {
    hudSystem.innerText = "AUTOPILOT";
    hudSystem.className = "hud-metric tag-auto";
  }

  // Faded state logic for "DROP BOMB" button
  if (state.inManualControl && state.bombsLeft > 0) {
    btnBomb.classList.remove('faded');
  } else {
    btnBomb.classList.add('faded');
  }
}

// --- 6. Tactical Mini-Radar (Bottom-Left) ---
function updateTacticalRadar() {
  const w = radarCanvas.width;
  const h = radarCanvas.height;
  const cx = w / 2;
  const cy = h / 2;
  const radarScale = 0.038;

  radarCtx.clearRect(0, 0, w, h);

  let targetAlert = false;
  state.targets.forEach(tgt => {
    if (!tgt.destroyed) {
      const dz = tgt.z - state.plane.z;
      if (dz > -150 && dz < 1600) targetAlert = true;
    }
  });

  // Green normally; Red alert on target approach
  radarCtx.fillStyle = targetAlert ? 'rgba(231, 76, 60, 0.4)' : 'rgba(46, 204, 113, 0.25)';
  radarCtx.fillRect(0, 0, w, h);

  // Range Rings
  radarCtx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
  radarCtx.lineWidth = 1;
  radarCtx.beginPath();
  radarCtx.arc(cx, cy, 28, 0, Math.PI * 2);
  radarCtx.arc(cx, cy, 56, 0, Math.PI * 2);
  radarCtx.stroke();

  // Targets
  state.targets.forEach(tgt => {
    if (tgt.destroyed) return;
    const rx = cx + (tgt.x - state.plane.x) * radarScale;
    const ry = cy - (tgt.z - state.plane.z) * radarScale;

    if (rx >= 0 && rx <= w && ry >= 0 && ry <= h) {
      radarCtx.fillStyle = '#ff4757';
      radarCtx.beginPath();
      radarCtx.arc(rx, ry, 4.5, 0, Math.PI * 2);
      radarCtx.fill();

      radarCtx.strokeStyle = '#f1c40f';
      radarCtx.strokeRect(rx - 5, ry - 5, 10, 10);
    }
  });

  // Interceptors
  state.enemyJets.forEach(ep => {
    const rx = cx + (ep.x - state.plane.x) * radarScale;
    const ry = cy - (ep.z - state.plane.z) * radarScale;
    if (rx >= 0 && rx <= w && ry >= 0 && ry <= h) {
      radarCtx.fillStyle = '#ff5252';
      radarCtx.beginPath();
      radarCtx.moveTo(rx, ry - 4);
      radarCtx.lineTo(rx + 4, ry + 4);
      radarCtx.lineTo(rx - 4, ry + 4);
      radarCtx.closePath();
      radarCtx.fill();
    }
  });

  // Player Chevron
  radarCtx.save();
  radarCtx.translate(cx, cy);
  radarCtx.rotate(-state.plane.roll * 0.5);
  radarCtx.fillStyle = '#ffffff';
  radarCtx.beginPath();
  radarCtx.moveTo(0, -6);
  radarCtx.lineTo(5, 5);
  radarCtx.lineTo(0, 2.5);
  radarCtx.lineTo(-5, 5);
  radarCtx.closePath();
  radarCtx.fill();
  radarCtx.restore();
}

// --- 7. Main Game Loop ---
let lastTimestamp = performance.now();
function gameLoop(now) {
  const delta = Math.min((now - lastTimestamp) / 1000, 0.1);
  lastTimestamp = now;

  updateFlight(delta);
  updateTacticalRadar();
  renderer.render(scene, camera);

  requestAnimationFrame(gameLoop);
}

// Initial Launch Handlers
attachTouchDeck();
initEngine();

modalActionBtn.addEventListener('click', () => {
  SFX.init();
  missionModal.classList.add('hidden');
  setupMission(1);
});

requestAnimationFrame(gameLoop);
