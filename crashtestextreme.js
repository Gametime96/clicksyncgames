/* Crash Test Extreme - 3D Engine & Game Logic */

const LEVEL_CONFIGS = [
  { name: "LEVEL 1: Standard Frontal Impact", length: 150, obstacles: 4, speedBoost: 0, requiredHealth: 40 },
  { name: "LEVEL 2: Side Barrier Slalom", length: 180, obstacles: 7, speedBoost: 0.05, requiredHealth: 45 },
  { name: "LEVEL 3: High-Speed Deceleration Zone", length: 220, obstacles: 10, speedBoost: 0.1, requiredHealth: 50 },
  { name: "LEVEL 4: Concrete Pillars", length: 250, obstacles: 14, speedBoost: 0.12, requiredHealth: 55 },
  { name: "LEVEL 5: Dynamic Pendulum Crushers", length: 280, obstacles: 18, speedBoost: 0.15, requiredHealth: 60 },
  { name: "LEVEL 6: Offset Deformable Barriers", length: 320, obstacles: 22, speedBoost: 0.18, requiredHealth: 65 },
  { name: "LEVEL 7: The Rollover Gauntlet", length: 360, obstacles: 26, speedBoost: 0.2, requiredHealth: 70 },
  { name: "LEVEL 8: Kinetic Shockwave Row", length: 400, obstacles: 30, speedBoost: 0.22, requiredHealth: 75 },
  { name: "LEVEL 9: Extreme Safety Clearance", length: 450, obstacles: 36, speedBoost: 0.25, requiredHealth: 80 }
];

let currentLevel = 0;
let health = 100;
let speed = 0;
let maxSpeed = 1.6;
let acceleration = 0.03;
let friction = 0.98;
let turnSpeed = 0.04;
let isPaused = false;
let isGameOver = false;
let isLevelClear = false;
let keys = {};

// Three.js Core
let scene, camera, renderer;
let car, finishLine;
let obstacles = [];

function init() {
  const canvas = document.getElementById('game-canvas');
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1a1f);
  scene.fog = new THREE.Fog(0x1a1a1f, 40, 180);

  camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 1000);

  // Lighting
  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.7);
  scene.add(hemiLight);

  const dirLight = new THREE.DirectionalLight(0xfffaed, 0.8);
  dirLight.position.set(20, 40, 20);
  dirLight.castShadow = true;
  scene.add(dirLight);

  // Build Scene & Bindings
  createCar();
  loadLevel(currentLevel);
  setupEventListeners();

  animate();
}

// Build Crash Test Dummy Car
function createCar() {
  car = new THREE.Group();

  // Chassis
  const bodyGeo = new THREE.BoxGeometry(2.4, 1, 4.8);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0xe6a100, // Crash yellow
    roughness: 0.3,
    metalness: 0.2
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.8;
  body.castShadow = true;
  car.add(body);

  // Cabin
  const cabinGeo = new THREE.BoxGeometry(2.0, 0.8, 2.4);
  const cabinMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.1 });
  const cabin = new THREE.Mesh(cabinGeo, cabinMat);
  cabin.position.set(0, 1.6, -0.2);
  car.add(cabin);

  // Wheels
  const wheelGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.4, 16);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8 });
  const wheelPos = [
    [-1.3, 0.5, 1.5],
    [1.3, 0.5, 1.5],
    [-1.3, 0.5, -1.5],
    [1.3, 0.5, -1.5]
  ];

  wheelPos.forEach(pos => {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(...pos);
    car.add(wheel);
  });

  scene.add(car);
}

// Load Level Elements
function loadLevel(lvlIdx) {
  const config = LEVEL_CONFIGS[lvlIdx];
  const trackLen = config.length;

  // Clean old objects
  obstacles.forEach(o => scene.remove(o));
  obstacles = [];
  if (finishLine) scene.remove(finishLine);

  // Track Road
  const roadGeo = new THREE.PlaneGeometry(16, trackLen);
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x252528, roughness: 0.9 });
  const road = new THREE.Mesh(roadGeo, roadMat);
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0, -trackLen / 2);
  road.receiveShadow = true;
  scene.add(road);

  // Test Obstacles
  const blockGeo = new THREE.BoxGeometry(2, 2, 2);
  for (let i = 0; i < config.obstacles; i++) {
    const blockMat = new THREE.MeshStandardMaterial({
      color: i % 2 === 0 ? 0xd9381e : 0xffffff,
      roughness: 0.4
    });
    const block = new THREE.Mesh(blockGeo, blockMat);
    const zPos = -20 - (Math.random() * (trackLen - 40));
    const xPos = (Math.random() - 0.5) * 11;
    block.position.set(xPos, 1, zPos);
    block.castShadow = true;
    scene.add(block);
    obstacles.push(block);
  }

  // Finish Sensor Line
  const finishGeo = new THREE.BoxGeometry(16, 0.2, 2);
  const finishMat = new THREE.MeshStandardMaterial({ color: 0xffcc00, emissive: 0x443300 });
  finishLine = new THREE.Mesh(finishGeo, finishMat);
  finishLine.position.set(0, 0.1, -trackLen + 10);
  scene.add(finishLine);

  // Reset Car State
  car.position.set(0, 0, 0);
  car.rotation.set(0, 0, 0);
  speed = 0;
  health = 100;
  updateHUD();
}

function updateHUD() {
  document.getElementById('level-display').innerText = `${currentLevel + 1} / 9`;
  document.getElementById('speed-display').innerText = `${Math.round(Math.abs(speed) * 45)} MPH`;

  const healthBar = document.getElementById('health-bar');
  healthBar.style.width = `${health}%`;
  if (health < 30) {
    healthBar.style.background = '#ef4444';
  } else if (health < 60) {
    healthBar.style.background = '#f59e0b';
  } else {
    healthBar.style.background = 'linear-gradient(90deg, #4ade80, #22c55e)';
  }
}

function showModal(title, desc, btnText, isComplete = false) {
  const modal = document.getElementById('modal-overlay');
  document.getElementById('modal-title').innerText = title;
  document.getElementById('modal-desc').innerText = desc;
  document.getElementById('modal-btn').innerText = btnText;
  document.getElementById('level-info').innerText = LEVEL_CONFIGS[currentLevel].name;
  modal.classList.add('active');
}

function hideModal() {
  document.getElementById('modal-overlay').classList.remove('active');
}

// Key Handling
function setupEventListeners() {
  window.addEventListener('keydown', e => {
    keys[e.key.toLowerCase()] = true;
    if (e.key === 'p' || e.key === 'P') togglePause();
  });
  window.addEventListener('keyup', e => {
    keys[e.key.toLowerCase()] = false;
  });

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  document.getElementById('pause-btn').addEventListener('click', togglePause);

  document.getElementById('modal-btn').addEventListener('click', () => {
    if (isGameOver) {
      isGameOver = false;
      loadLevel(currentLevel);
    } else if (isLevelClear) {
      isLevelClear = false;
      currentLevel++;
      loadLevel(currentLevel);
    }
    hideModal();
    isPaused = false;
  });
}

function togglePause() {
  if (isGameOver || isLevelClear) return;
  isPaused = !isPaused;
  if (isPaused) {
    showModal("TEST PAUSED", "Simulation paused. Take a breath, inspect the trajectory, and continue when ready.", "RESUME");
  } else {
    hideModal();
  }
}

// Game Loop
function animate() {
  requestAnimationFrame(animate);

  if (!isPaused && !isGameOver && !isLevelClear) {
    // Controls
    if (keys['arrowup'] || keys['w']) speed += acceleration;
    if (keys['arrowdown'] || keys['s']) speed -= acceleration;
    speed *= friction;

    // Steering
    if (keys['arrowleft'] || keys['a']) car.rotation.y += turnSpeed * (speed / maxSpeed);
    if (keys['arrowright'] || keys['d']) car.rotation.y -= turnSpeed * (speed / maxSpeed);

    // Forward Vector Update
    car.translateZ(-speed);

    // Boundary check
    if (car.position.x > 7.2) car.position.x = 7.2;
    if (car.position.x < -7.2) car.position.x = -7.2;

    // Collision Detection
    for (let i = 0; i < obstacles.length; i++) {
      const obs = obstacles[i];
      if (car.position.distanceTo(obs.position) < 2.2) {
        // Impact Damage
        const damage = Math.round(Math.abs(speed) * 28) + 8;
        health = Math.max(0, health - damage);
        speed = -speed * 0.4; // Bounce back
        obs.position.z += 5;  // Scatter block

        // Vehicle damage tilt
        car.rotation.z += (Math.random() - 0.5) * 0.4;

        if (health <= 0) {
          isGameOver = true;
          showModal("CRITICAL FAILURE", "Vehicle structural integrity reached 0%. Test failed.", "RETRY LEVEL");
        }
      }
    }

    // Finish Line
    if (finishLine && car.position.z < finishLine.position.z) {
      if (currentLevel >= 8) {
        showModal("CERTIFICATION PASSED", "Congratulations! You survived all 9 Extreme Crash Test levels and cleared safety regulations!", "PLAY AGAIN");
        currentLevel = 0;
        isGameOver = true;
      } else {
        isLevelClear = true;
        showModal("LEVEL PASSED", `Safety threshold held! Next stage introduces harder obstacles.`, "NEXT LEVEL");
      }
    }

    updateHUD();

    // Camera follow (Third-person)
    camera.position.x = car.position.x;
    camera.position.y = car.position.y + 4.5;
    camera.position.z = car.position.z + 8.5;
    camera.lookAt(car.position.x, car.position.y + 1, car.position.z - 5);
  }

  renderer.render(scene, camera);
}

window.onload = init;
