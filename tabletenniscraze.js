const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const menu = document.getElementById('menu');
const playerScoreEl = document.getElementById('player-score');
const aiScoreEl = document.getElementById('ai-score');
const pauseBtn = document.getElementById('pause-btn');

// Set canvas to full window size
function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// Game State
let gameState = 'menu'; // 'menu', 'playing', 'scored'
let isPaused = false;
let difficulty = 'medium';
let playerScore = 0;
let aiScore = 0;

// Camera and 3D Projection configuration (Zoomed out and angled up)
const focalLength = 900;
const cameraY = -450;  // Moved camera up
const cameraZ = -1200; // Pulled camera back to prevent bottom cutoff

function project(x, y, z) {
    const relZ = z - cameraZ;
    const relY = y - cameraY;
    const scale = focalLength / relZ;
    return {
        x: canvas.width / 2 + x * scale,
        y: canvas.height / 2 + relY * scale,
        scale: scale
    };
}

// Entities
const table = { width: 600, length: 1200, y: 100 };
const net = { height: 60, z: 0 };

const ball = {
    x: 0, y: 0, z: -500,
    vx: 0, vy: 0, vz: 0,
    radius: 15,
    speedBase: 18
};

const player = { x: 0, y: 0, z: -600, width: 80, height: 80 };
const ai = { x: 0, y: -50, z: 600, width: 80, height: 80, speed: 5 };

// Mouse controls
let mouseX = canvas.width / 2;
let mouseY = canvas.height / 2;
window.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
});

// Pause Logic
function togglePause() {
    if (gameState === 'playing' || gameState === 'scored') {
        isPaused = !isPaused;
        pauseBtn.innerText = isPaused ? 'Resume' : 'Pause';
        if (isPaused) {
            canvas.style.cursor = 'default';
        } else {
            canvas.style.cursor = 'none';
        }
    }
}

pauseBtn.addEventListener('click', togglePause);

window.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'p') {
        togglePause();
    }
});

// Difficulty Settings
const difficultySettings = {
    easy: { aiSpeed: 4, aiError: 150, ballSpeedMod: 0.8 },
    medium: { aiSpeed: 8, aiError: 50, ballSpeedMod: 1.0 },
    impossible: { aiSpeed: 25, aiError: 0, ballSpeedMod: 1.4 }
};

document.querySelectorAll('.diff-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        difficulty = e.target.getAttribute('data-diff');
        startGame();
    });
});

function startGame() {
    menu.style.display = 'none';
    pauseBtn.style.display = 'block';
    playerScore = 0;
    aiScore = 0;
    isPaused = false;
    pauseBtn.innerText = 'Pause';
    canvas.style.cursor = 'none';
    updateScoreboard();
    resetBall(1); 
    gameState = 'playing';
}

function resetBall(direction) {
    ball.x = 0;
    ball.y = -200;
    ball.z = direction === 1 ? -500 : 500;
    
    const settings = difficultySettings[difficulty];
    ball.vx = (Math.random() - 0.5) * 10;
    ball.vy = -10;
    ball.vz = direction * ball.speedBase * settings.ballSpeedMod;
}

function updateScoreboard() {
    playerScoreEl.innerText = playerScore;
    aiScoreEl.innerText = aiScore;
}

function scorePoint(winner) {
    gameState = 'scored';
    if (winner === 'player') {
        playerScore++;
        setTimeout(() => { if(gameState !== 'menu') { resetBall(-1); gameState = 'playing'; }}, 1000);
    } else {
        aiScore++;
        setTimeout(() => { if(gameState !== 'menu') { resetBall(1); gameState = 'playing'; }}, 1000);
    }
    updateScoreboard();
}

function update() {
    if (gameState !== 'playing' || isPaused) return;

    const settings = difficultySettings[difficulty];

    // Player Paddle Position (Mapped to mouse)
    player.x = (mouseX - canvas.width / 2) * 1.8;
    // Adjusted Y mapping to stay cleanly visible within the new camera bounds
    player.y = (mouseY - canvas.height / 2) * 1.8 + cameraY + 200;

    // Constrain player paddle bounds visually
    player.x = Math.max(-table.width - 100, Math.min(table.width + 100, player.x));
    player.y = Math.min(table.y + 100, player.y);

    // AI Logic
    let targetX = ball.x + (Math.random() - 0.5) * settings.aiError;
    if (ball.vz > 0) {
        if (ai.x < targetX) ai.x += settings.aiSpeed;
        if (ai.x > targetX) ai.x -= settings.aiSpeed;
    } else {
        if (ai.x < 0) ai.x += settings.aiSpeed / 2;
        if (ai.x > 0) ai.x -= settings.aiSpeed / 2;
    }

    // Ball Physics
    ball.x += ball.vx;
    ball.y += ball.vy;
    ball.z += ball.vz;
    ball.vy += 0.8; // Gravity

    // Table Bounce
    if (ball.y >= table.y - ball.radius && Math.abs(ball.z) <= table.length / 2) {
        if (Math.abs(ball.x) <= table.width / 2) {
            ball.y = table.y - ball.radius;
            ball.vy *= -0.85; // Dampening
        }
    }

    // Net Collision
    if (Math.abs(ball.z) < Math.abs(ball.vz) && ball.y > table.y - net.height) {
        ball.vz *= -0.5;
        ball.vx *= 0.5;
    }

    // Player Hit
    if (ball.z <= player.z && ball.z >= player.z - 60 && ball.vz < 0) {
        if (Math.abs(ball.x - player.x) < player.width && Math.abs(ball.y - player.y) < player.height) {
            ball.vz *= -1.05; 
            ball.vx = (ball.x - player.x) * 0.2;
            ball.vy = -12; 
        }
    }

    // AI Hit
    if (ball.z >= ai.z && ball.z <= ai.z + 60 && ball.vz > 0) {
        if (Math.abs(ball.x - ai.x) < ai.width) {
            ball.vz *= -1.05;
            ball.vx = (ball.x - ai.x) * 0.2;
            ball.vy = -12;
        }
    }

    // Out of bounds checking (Scoring)
    if (ball.z > table.length / 2 + 200) {
        scorePoint('player');
    } else if (ball.z < -table.length / 2 - 200) {
        scorePoint('ai');
    } else if (ball.y > 600) {
        if (ball.vz > 0) scorePoint('player'); 
        else scorePoint('ai'); 
    }
}

function drawPolygon(points, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    points.forEach((p, i) => {
        const proj = project(p.x, p.y, p.z);
        if (i === 0) ctx.moveTo(proj.x, proj.y);
        else ctx.lineTo(proj.x, proj.y);
    });
    ctx.closePath();
    ctx.fill();
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw Floor
    ctx.fillStyle = '#34495e';
    const floorY = project(0, 400, 0).y;
    ctx.fillRect(0, floorY, canvas.width, canvas.height - floorY);

    // Draw Table
    const tW = table.width / 2;
    const tL = table.length / 2;
    drawPolygon([
        {x: -tW, y: table.y, z: -tL},
        {x: tW, y: table.y, z: -tL},
        {x: tW, y: table.y, z: tL},
        {x: -tW, y: table.y, z: tL}
    ], '#27ae60');

    // Table Lines
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    const p1 = project(0, table.y, -tL);
    const p2 = project(0, table.y, tL);
    ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();

    // Draw Net
    drawPolygon([
        {x: -tW - 20, y: table.y, z: net.z},
        {x: tW + 20, y: table.y, z: net.z},
        {x: tW + 20, y: table.y - net.height, z: net.z},
        {x: -tW - 20, y: table.y - net.height, z: net.z}
    ], 'rgba(255, 255, 255, 0.4)');

    // Draw AI Paddle (Now with a handle)
    const aiProj = project(ai.x, ai.y, ai.z);
    
    // AI Paddle Handle
    ctx.fillStyle = '#d35400';
    ctx.fillRect(aiProj.x - (8 * aiProj.scale), aiProj.y, 16 * aiProj.scale, 65 * aiProj.scale);
    
    // AI Paddle Blade
    ctx.fillStyle = '#2980b9';
    ctx.beginPath();
    ctx.arc(aiProj.x, aiProj.y, (ai.width / 2) * aiProj.scale, 0, Math.PI * 2);
    ctx.fill();

    // Draw Ball
    const ballProj = project(ball.x, ball.y, ball.z);
    // Add fake shadow
    const shadowProj = project(ball.x, table.y, ball.z);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(shadowProj.x, shadowProj.y, ball.radius * shadowProj.scale, (ball.radius/2) * shadowProj.scale, 0, 0, Math.PI * 2);
    ctx.fill();

    // The Ball itself
    ctx.fillStyle = '#f1c40f';
    ctx.beginPath();
    ctx.arc(ballProj.x, ballProj.y, ball.radius * ballProj.scale, 0, Math.PI * 2);
    ctx.fill();

    // Draw Player Paddle
    const playerProj = project(player.x, player.y, player.z);
    
    // Player Paddle Handle
    ctx.fillStyle = '#d35400';
    ctx.fillRect(playerProj.x - (10 * playerProj.scale), playerProj.y, 20 * playerProj.scale, 90 * playerProj.scale);
    
    // Player Paddle Blade
    ctx.fillStyle = '#c0392b';
    ctx.beginPath();
    ctx.arc(playerProj.x, playerProj.y, (player.width / 2) * playerProj.scale, 0, Math.PI * 2);
    ctx.fill();

    // Draw Pause Screen
    if (isPaused) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = 'white';
        ctx.font = 'bold 64px "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('PAUSED', canvas.width / 2, canvas.height / 2);
    }
}

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// Start visual rendering immediately for background
gameLoop();
