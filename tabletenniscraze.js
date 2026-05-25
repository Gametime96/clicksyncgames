const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const menu = document.getElementById('menu');
const playerScoreEl = document.getElementById('player-score');
const aiScoreEl = document.getElementById('ai-score');
const pauseBtn = document.getElementById('pause-btn');

// Dynamic Camera Config
let focalLength = 1000;
let cameraY = -300;
let cameraZ = -1400;

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    // New math ensures table always fits and anchors to the bottom
    if (canvas.width < canvas.height) {
        // Portrait Mode
        cameraZ = -1400;
        cameraY = -400; 
        focalLength = canvas.width * 1.2;
    } else {
        // Landscape Mode
        cameraZ = -1400;
        cameraY = -300;
        focalLength = Math.min(canvas.width, canvas.height) * 1.4;
    }
}
window.addEventListener('resize', resize);
resize(); 

// Game State
let gameState = 'menu';
let isPaused = false;
let difficulty = 'medium';
let playerScore = 0;
let aiScore = 0;

function project(x, y, z) {
    const relZ = z - cameraZ;
    const relY = y - cameraY;
    if (relZ <= 0) return { x: 0, y: 0, scale: 0 }; 
    const scale = focalLength / relZ;
    
    // Shift the vanishing point up to look down on the table naturally
    const baseCenterY = canvas.width < canvas.height ? canvas.height * 0.45 : canvas.height * 0.25;

    return {
        x: canvas.width / 2 + x * scale,
        y: baseCenterY + relY * scale,
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

// Input controls
let inputX = canvas.width / 2;
let inputY = canvas.height / 2;

function updateInputInfo(clientX, clientY) {
    inputX = clientX;
    inputY = clientY;
}

window.addEventListener('mousemove', (e) => updateInputInfo(e.clientX, e.clientY));

window.addEventListener('touchstart', (e) => {
    if (e.target === canvas) e.preventDefault(); 
    updateInputInfo(e.touches[0].clientX, e.touches[0].clientY);
}, { passive: false });

window.addEventListener('touchmove', (e) => {
    if (e.target === canvas) e.preventDefault(); 
    updateInputInfo(e.touches[0].clientX, e.touches[0].clientY);
}, { passive: false });

function togglePause() {
    if (gameState === 'playing' || gameState === 'scored') {
        isPaused = !isPaused;
        pauseBtn.innerText = isPaused ? 'Resume' : 'Pause';
        canvas.style.cursor = isPaused ? 'default' : 'none';
    }
}

pauseBtn.addEventListener('click', togglePause);
window.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'p') togglePause();
});

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

    const sensitivityX = canvas.width < canvas.height ? 2.5 : 1.5;
    const sensitivityY = canvas.width < canvas.height ? 2.0 : 1.2;

    // Map paddle position to mouse/touch tightly
    player.x = (inputX - canvas.width / 2) * sensitivityX;
    player.y = (inputY - canvas.height / 1.5) * sensitivityY + table.y - 50;

    // Clamp paddle rigidly so it cannot float into the air or go way beneath the table
    player.x = Math.max(-table.width/2 - 100, Math.min(table.width/2 + 100, player.x));
    player.y = Math.max(table.y - 150, Math.min(table.y + 50, player.y));

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
    ball.vy += 0.8; 

    // Table Bounce
    if (ball.y >= table.y - ball.radius && Math.abs(ball.z) <= table.length / 2) {
        if (Math.abs(ball.x) <= table.width / 2) {
            ball.y = table.y - ball.radius;
            ball.vy *= -0.85; 
        }
    }

    // Net Collision
    if (Math.abs(ball.z) < Math.abs(ball.vz) && ball.y > table.y - net.height) {
        ball.vz *= -0.5;
        ball.vx *= 0.5;
    }

    // Player Hit
    if (ball.z <= player.z && ball.z >= player.z - 60 && ball.vz < 0) {
        if (Math.abs(ball.x - player.x) < player.width + 20 && Math.abs(ball.y - player.y) < player.height + 20) {
            ball.vz *= -1.05; 
            ball.vx = (ball.x - player.x) * 0.2;
            ball.vy = -12; 
        }
    }

    // AI Hit
    if (ball.z >= ai.z && ball.z <= ai.z + 60 && ball.vz > 0) {
        if (Math.abs(ball.x - ai.x) < ai.width + 20) {
            ball.vz *= -1.05;
            ball.vx = (ball.x - ai.x) * 0.2;
            ball.vy = -12;
        }
    }

    // Scoring
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
    let hasValidPoints = false;
    points.forEach((p, i) => {
        const proj = project(p.x, p.y, p.z);
        if (proj.scale > 0) {
            hasValidPoints = true;
            if (i === 0) ctx.moveTo(proj.x, proj.y);
            else ctx.lineTo(proj.x, proj.y);
        }
    });
    if (hasValidPoints) {
        ctx.closePath();
        ctx.fill();
    }
}

function drawBall() {
    const ballProj = project(ball.x, ball.y, ball.z);
    if (ballProj.scale > 0) {
        const shadowProj = project(ball.x, Math.min(table.y, ball.y + 200), ball.z);
        if (shadowProj.scale > 0) {
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.beginPath();
            ctx.ellipse(shadowProj.x, shadowProj.y, ball.radius * shadowProj.scale, (ball.radius/2) * shadowProj.scale, 0, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.fillStyle = '#f1c40f';
        ctx.beginPath();
        ctx.arc(ballProj.x, ballProj.y, ball.radius * ballProj.scale, 0, Math.PI * 2);
        ctx.fill();
    }
}

function drawNet() {
    const tW = table.width / 2;
    drawPolygon([
        {x: -tW - 20, y: table.y, z: net.z},
        {x: tW + 20, y: table.y, z: net.z},
        {x: tW + 20, y: table.y - net.height, z: net.z},
        {x: -tW - 20, y: table.y - net.height, z: net.z}
    ], 'rgba(255, 255, 255, 0.4)');
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Dynamic Horizon
    const horizonProj = project(0, 0, 5000);
    const horizon = horizonProj.y || canvas.height / 2;

    // Draw Background Wall (Dark Red/Brown)
    ctx.fillStyle = '#4A1C1C';
    ctx.fillRect(0, 0, canvas.width, horizon);

    // Draw Floor (Wood)
    ctx.fillStyle = '#A36B3B';
    ctx.fillRect(0, horizon, canvas.width, canvas.height - horizon);

    const tW = table.width / 2;
    const tL = table.length / 2;

    // 1. Draw Table Legs
    ctx.lineWidth = Math.max(4, 15 * (focalLength / 2000)); 
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#111';

    const drawLeg = (x, z) => {
        const p1 = project(x, table.y, z);
        const p2 = project(x, table.y + 250, z); // Leg height
        if(p1.scale > 0 && p2.scale > 0) {
            ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
        }
    };
    
    const legInset = 30;
    drawLeg(-tW + legInset, tL - legInset);  // Back Left
    drawLeg(tW - legInset, tL - legInset);   // Back Right
    drawLeg(-tW + legInset, -tL + legInset); // Front Left
    drawLeg(tW - legInset, -tL + legInset);  // Front Right

    // 2. Draw Table Base/Thickness
    drawPolygon([
        {x: -tW, y: table.y, z: -tL},
        {x: tW, y: table.y, z: -tL},
        {x: tW, y: table.y + 15, z: -tL},
        {x: -tW, y: table.y + 15, z: -tL}
    ], '#145A32');

    // 3. Draw Table Top
    drawPolygon([
        {x: -tW, y: table.y, z: -tL},
        {x: tW, y: table.y, z: -tL},
        {x: tW, y: table.y, z: tL},
        {x: -tW, y: table.y, z: tL}
    ], '#27AE60');

    // 4. Draw Table Lines
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = Math.max(1, 3 * (focalLength / 1500));
    const p1 = project(0, table.y, -tL);
    const p2 = project(0, table.y, tL);
    if (p1.scale > 0 && p2.scale > 0) {
        ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
    }

    // 5. Draw AI Paddle
    const aiProj = project(ai.x, ai.y, ai.z);
    if (aiProj.scale > 0) {
        ctx.fillStyle = '#8B0000'; // Darker Handle
        ctx.fillRect(aiProj.x - (8 * aiProj.scale), aiProj.y, 16 * aiProj.scale, 65 * aiProj.scale);
        ctx.fillStyle = '#2980b9'; // Blue Face
        ctx.beginPath();
        ctx.arc(aiProj.x, aiProj.y, (ai.width / 2) * aiProj.scale, 0, Math.PI * 2);
        ctx.fill();
    }

    // 6. Draw Net and Ball with Z-Sorting
    if (ball.z > 0) {
        drawBall();
        drawNet();
    } else {
        drawNet();
        drawBall();
    }

    // 7. Draw Player Paddle
    const playerProj = project(player.x, player.y, player.z);
    if (playerProj.scale > 0) {
        ctx.fillStyle = '#8B0000'; // Darker Handle
        ctx.fillRect(playerProj.x - (10 * playerProj.scale), playerProj.y, 20 * playerProj.scale, 90 * playerProj.scale);
        ctx.fillStyle = '#E74C3C'; // Red Face
        ctx.beginPath();
        ctx.arc(playerProj.x, playerProj.y, (player.width / 2) * playerProj.scale, 0, Math.PI * 2);
        ctx.fill();
    }

    // Draw Pause Screen Overlay
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

gameLoop();
