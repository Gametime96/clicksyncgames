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
    
    if (canvas.width < canvas.height) {
        cameraZ = -1500;
        cameraY = -450; 
        focalLength = canvas.width * 1.3;
    } else {
        cameraZ = -1500;
        cameraY = -350;
        focalLength = Math.min(canvas.width, canvas.height) * 1.5;
    }
}
window.addEventListener('resize', resize);
resize(); 

// Game State Management
let gameState = 'menu';
let ballState = 'serving'; // 'serving' or 'playing'
let server = 'player';
let lastHitter = null;
let hasBouncedOnOpponentSide = false;
let isPaused = false;
let difficulty = 'medium';
let playerScore = 0;
let aiScore = 0;
let selectedPaddleColor = '#e74c3c'; 

function project(x, y, z) {
    const relZ = z - cameraZ;
    const relY = y - cameraY;
    if (relZ <= 0) return { x: 0, y: 0, scale: 0 }; 
    const scale = focalLength / relZ;
    
    const baseCenterY = canvas.width < canvas.height ? canvas.height * 0.40 : canvas.height * 0.25;

    return {
        x: canvas.width / 2 + x * scale,
        y: baseCenterY + relY * scale,
        scale: scale
    };
}

// Entities
const table = { width: 600, length: 1200, y: 100 };
const net = { height: 60, z: 0 };
const ball = { x: 0, y: 0, z: -500, vx: 0, vy: 0, vz: 0, radius: 15, speedBase: 18 };
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

// Color Selection Logic
document.querySelectorAll('.color-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        selectedPaddleColor = e.target.getAttribute('data-color');
    });
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
    server = direction === 1 ? 'player' : 'ai';
    ballState = 'serving';
    lastHitter = null;
    hasBouncedOnOpponentSide = false;
    ball.vx = 0; 
    ball.vy = 0; 
    ball.vz = 0;
}

function updateScoreboard() {
    playerScoreEl.innerText = playerScore;
    aiScoreEl.innerText = aiScore;
}

function scorePoint(winner) {
    gameState = 'scored';
    if (winner === 'player') {
        playerScore++;
        // Loser serves next
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
    const sensitivityY = canvas.width < canvas.height ? 3.0 : 1.8;

    // Player Paddle Movement (Full vertical reach enabled)
    player.x = (inputX - canvas.width / 2) * sensitivityX;
    player.y = (inputY - canvas.height / 1.5) * sensitivityY + table.y - 50;
    player.x = Math.max(-table.width/2 - 150, Math.min(table.width/2 + 150, player.x));
    player.y = Math.max(table.y - 500, Math.min(table.y + 100, player.y));

    // SERVING LOGIC
    if (ballState === 'serving') {
        if (server === 'player') {
            // Hold ball perfectly still in front of player
            ball.x = 0;
            ball.y = table.y - 150;
            ball.z = -table.length / 2 + 50;

            // Wait for player paddle to strike the ball
            if (Math.abs(player.x - ball.x) < (player.width / 2 + ball.radius) && 
                Math.abs(player.y - ball.y) < (player.height / 2 + ball.radius) && 
                Math.abs(player.z - ball.z) < 60) {
                
                ballState = 'playing';
                lastHitter = 'player';
                hasBouncedOnOpponentSide = false;
                ball.vz = ball.speedBase * settings.ballSpeedMod;
                ball.vy = -12;
                ball.vx = (ball.x - player.x) * 0.2;
            }
        } else {
            // AI Serve
            ball.x = 0;
            ball.y = table.y - 150;
            ball.z = table.length / 2 - 50;
            
            // Move AI paddle toward the floating ball to serve
            ai.x += (ball.x - ai.x) * 0.1;
            ai.y += (ball.y - ai.y) * 0.1;
            
            if (Math.abs(ai.x - ball.x) < (ai.width / 2 + ball.radius) && 
                Math.abs(ai.y - ball.y) < (ai.height / 2 + ball.radius)) {
                
                ballState = 'playing';
                lastHitter = 'ai';
                hasBouncedOnOpponentSide = false;
                ball.vz = -ball.speedBase * settings.ballSpeedMod;
                ball.vy = -12;
                ball.vx = (Math.random() - 0.5) * 6;
            }
        }
        return; // Skip standard physics while serving
    }

    // AI Playing Logic
    let targetX = ball.x + (Math.random() - 0.5) * settings.aiError;
    if (ball.vz > 0) {
        // Track horizontally
        if (ai.x < targetX) ai.x += settings.aiSpeed;
        if (ai.x > targetX) ai.x -= settings.aiSpeed;
        // Track vertically for high balls
        let targetY = ball.y - 20; 
        if (ai.y < targetY) ai.y += settings.aiSpeed;
        if (ai.y > targetY) ai.y -= settings.aiSpeed;
    } else {
        // Return to center
        if (ai.x < 0) ai.x += settings.aiSpeed / 2;
        if (ai.x > 0) ai.x -= settings.aiSpeed / 2;
        let targetY = table.y - 50;
        if (ai.y < targetY) ai.y += settings.aiSpeed / 2;
        if (ai.y > targetY) ai.y -= settings.aiSpeed / 2;
    }
    ai.x = Math.max(-table.width/2 - 100, Math.min(table.width/2 + 100, ai.x));
    ai.y = Math.max(table.y - 500, Math.min(table.y + 50, ai.y));

    // Ball Physics
    ball.x += ball.vx;
    ball.y += ball.vy;
    ball.z += ball.vz;
    ball.vy += 0.8; // Gravity

    // Table Bounce Logic
    if (ball.y >= table.y - ball.radius && Math.abs(ball.z) <= table.length / 2) {
        if (Math.abs(ball.x) <= table.width / 2) {
            ball.y = table.y - ball.radius;
            ball.vy *= -0.85; 

            // Track if it bounced on the opponent's side based on who hit it last
            if (ball.z > 0 && lastHitter === 'player') {
                hasBouncedOnOpponentSide = true;
            } else if (ball.z < 0 && lastHitter === 'ai') {
                hasBouncedOnOpponentSide = true;
            }
        }
    }

    // Net Collision
    if (Math.abs(ball.z) < Math.abs(ball.vz) && ball.y > table.y - net.height) {
        ball.vz *= -0.5;
        ball.vx *= 0.5;
    }

    // Player Hit Logic
    if (ball.z <= player.z && ball.z >= player.z - 60 && ball.vz < 0) {
        if (Math.abs(ball.x - player.x) < player.width/2 + 20 && Math.abs(ball.y - player.y) < player.height/2 + 20) {
            ball.vz *= -1.05; 
            ball.vx = (ball.x - player.x) * 0.25;
            ball.vy = -12 + (player.y - ball.y) * 0.05; 
            lastHitter = 'player';
            hasBouncedOnOpponentSide = false;
        }
    }

    // AI Hit Logic
    if (ball.z >= ai.z && ball.z <= ai.z + 60 && ball.vz > 0) {
        if (Math.abs(ball.x - ai.x) < ai.width/2 + 20 && Math.abs(ball.y - ai.y) < ai.height/2 + 20) {
            ball.vz *= -1.05;
            ball.vx = (ball.x - ai.x) * 0.25;
            ball.vy = -12;
            lastHitter = 'ai';
            hasBouncedOnOpponentSide = false;
        }
    }

    // SCORING AND OUT-OF-BOUNDS LOGIC
    if (ball.y > table.y + 250 || Math.abs(ball.z) > table.length / 2 + 1000 || Math.abs(ball.x) > table.width / 2 + 1000) {
        if (lastHitter === 'player') {
            if (hasBouncedOnOpponentSide) {
                scorePoint('player'); // Player hit it, it bounced right, AI missed
            } else {
                scorePoint('ai'); // Player hit it out of bounds
            }
        } else if (lastHitter === 'ai') {
            if (hasBouncedOnOpponentSide) {
                scorePoint('ai'); // AI hit it, it bounced right, Player missed
            } else {
                scorePoint('player'); // AI hit it out of bounds
            }
        } else {
            // Failsafe for errors
            scorePoint('ai');
        }
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
            ctx.fillStyle = 'rgba(0,0,0,0.4)';
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
    ], 'rgba(255, 255, 255, 0.25)'); 
    
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = Math.max(1, 3 * (focalLength / 2000));
    const np1 = project(-tW - 20, table.y - net.height, net.z);
    const np2 = project(tW + 20, table.y - net.height, net.z);
    if (np1.scale > 0 && np2.scale > 0) {
        ctx.beginPath(); ctx.moveTo(np1.x, np1.y); ctx.lineTo(np2.x, np2.y); ctx.stroke();
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const horizonProj = project(0, 0, 8000);
    const horizon = horizonProj.y || canvas.height / 2.5;

    // Arena Background
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width, horizon);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    for(let z = 0; z <= 6000; z += 600) {
        const roof1 = project(-2500, -1500, z);
        const roof2 = project(2500, -1500, z);
        if(roof1.scale > 0 && roof2.scale > 0) {
            ctx.lineWidth = 15 * roof1.scale;
            ctx.beginPath(); ctx.moveTo(roof1.x, roof1.y); ctx.lineTo(roof2.x, roof2.y); ctx.stroke();
        }
    }

    ctx.fillStyle = '#1e3a5f'; 
    ctx.fillRect(0, horizon, canvas.width, canvas.height - horizon);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    const floorY = table.y + 400; 
    for(let x of [-1200, -600, 0, 600, 1200]) {
        const f1 = project(x, floorY, -1000);
        const f2 = project(x, floorY, 6000);
        if(f1.scale > 0 && f2.scale > 0) {
            ctx.lineWidth = 4 * f1.scale;
            ctx.beginPath(); ctx.moveTo(f1.x, f1.y); ctx.lineTo(f2.x, f2.y); ctx.stroke();
        }
    }
    for(let z = -1000; z <= 6000; z += 1000) {
        const f1 = project(-1500, floorY, z);
        const f2 = project(1500, floorY, z);
        if(f1.scale > 0 && f2.scale > 0) {
            ctx.lineWidth = 4 * f1.scale;
            ctx.beginPath(); ctx.moveTo(f1.x, f1.y); ctx.lineTo(f2.x, f2.y); ctx.stroke();
        }
    }

    const tW = table.width / 2;
    const tL = table.length / 2;

    // Table Legs
    ctx.lineWidth = Math.max(5, 20 * (focalLength / 2000)); 
    ctx.lineCap = 'square';
    ctx.strokeStyle = '#95a5a6';

    const drawLeg = (x, z) => {
        const p1 = project(x, table.y, z);
        const p2 = project(x, table.y + 350, z); 
        if(p1.scale > 0 && p2.scale > 0) {
            ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
        }
    };
    
    const legInset = 40;
    drawLeg(-tW + legInset, tL - legInset); 
    drawLeg(tW - legInset, tL - legInset);   
    drawLeg(-tW + legInset, -tL + legInset); 
    drawLeg(tW - legInset, -tL + legInset);  

    // Table Base
    drawPolygon([
        {x: -tW, y: table.y, z: -tL},
        {x: tW, y: table.y, z: -tL},
        {x: tW, y: table.y + 20, z: -tL},
        {x: -tW, y: table.y + 20, z: -tL}
    ], '#154360');

    // Table Top
    drawPolygon([
        {x: -tW, y: table.y, z: -tL},
        {x: tW, y: table.y, z: -tL},
        {x: tW, y: table.y, z: tL},
        {x: -tW, y: table.y, z: tL}
    ], '#2980b9');

    // Table Lines
    ctx.strokeStyle = '#ecf0f1';
    ctx.lineWidth = Math.max(1.5, 4 * (focalLength / 1500));
    const l1 = project(0, table.y, -tL);
    const l2 = project(0, table.y, tL);
    if (l1.scale > 0 && l2.scale > 0) {
        ctx.beginPath(); ctx.moveTo(l1.x, l1.y); ctx.lineTo(l2.x, l2.y); ctx.stroke();
    }

    // AI Paddle
    const aiProj = project(ai.x, ai.y, ai.z);
    if (aiProj.scale > 0) {
        ctx.fillStyle = '#8B4513'; 
        ctx.fillRect(aiProj.x - (8 * aiProj.scale), aiProj.y, 16 * aiProj.scale, 65 * aiProj.scale);
        ctx.fillStyle = '#c0392b'; 
        ctx.beginPath();
        ctx.arc(aiProj.x, aiProj.y, (ai.width / 2) * aiProj.scale, 0, Math.PI * 2);
        ctx.fill();
    }

    // Z-Sorting
    if (ball.z > 0) {
        drawBall();
        drawNet();
    } else {
        drawNet();
        drawBall();
    }

    // Player Paddle
    const playerProj = project(player.x, player.y, player.z);
    if (playerProj.scale > 0) {
        ctx.fillStyle = '#8B4513'; 
        ctx.fillRect(playerProj.x - (10 * playerProj.scale), playerProj.y, 20 * playerProj.scale, 90 * playerProj.scale);
        ctx.fillStyle = selectedPaddleColor; 
        ctx.beginPath();
        ctx.arc(playerProj.x, playerProj.y, (player.width / 2) * playerProj.scale, 0, Math.PI * 2);
        ctx.fill();
    }

    // Pause Screen
    if (isPaused) {
        ctx.fillStyle = 'rgba(13, 27, 42, 0.7)';
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
