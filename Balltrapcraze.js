const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const switchDirBtn = document.getElementById('switch-dir-btn');
const dirArrow = document.getElementById('dir-arrow');
const scoreDisplay = document.getElementById('score-display');
const livesDisplay = document.getElementById('lives-display');

// Game State
let isVertical = true;
let totalArea = canvas.width * canvas.height;
let activeAreas = [{ x: 0, y: 0, w: canvas.width, h: canvas.height }];
let balls = [{ x: 400, y: 200, vx: 3, vy: 3, radius: 6 }];
let activeWall = null;
let lives = 3;
let isGameOver = false;

// Toggle Wall Direction
switchDirBtn.addEventListener('click', () => {
    isVertical = !isVertical;
    dirArrow.innerHTML = isVertical ? '&#8597;' : '&#8596;'; // Up/Down vs Left/Right
});

// Start building a wall on click
canvas.addEventListener('mousedown', (e) => {
    if (activeWall || isGameOver) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Find which area the user clicked inside
    const clickedArea = activeAreas.find(a => 
        mouseX >= a.x && mouseX <= a.x + a.w &&
        mouseY >= a.y && mouseY <= a.y + a.h
    );

    if (clickedArea) {
        activeWall = {
            x: mouseX,
            y: mouseY,
            isVertical: isVertical,
            area: clickedArea,
            lenPos: 0, // Growth in positive direction
            lenNeg: 0, // Growth in negative direction
            speed: 5
        };
    }
});

function update() {
    if (isGameOver) return;

    // 1. Move Balls and handle bouncing within their specific active area
    balls.forEach(ball => {
        ball.x += ball.vx;
        ball.y += ball.vy;

        // Find the area the ball is currently in
        const area = activeAreas.find(a => 
            ball.x >= a.x && ball.x <= a.x + a.w &&
            ball.y >= a.y && ball.y <= a.y + a.h
        );

        if (area) {
            // Bounce off area boundaries
            if (ball.x - ball.radius < area.x || ball.x + ball.radius > area.x + area.w) ball.vx *= -1;
            if (ball.y - ball.radius < area.y || ball.y + ball.radius > area.y + area.h) ball.vy *= -1;
            
            // Keep ball strictly inside to prevent wall-glitching
            ball.x = Math.max(area.x + ball.radius, Math.min(ball.x, area.x + area.w - ball.radius));
            ball.y = Math.max(area.y + ball.radius, Math.min(ball.y, area.y + area.h - ball.radius));
        }
    });

    // 2. Update Wall Growth
    if (activeWall) {
        const { x, y, isVertical, area, speed } = activeWall;
        let hitPos = false;
        let hitNeg = false;

        // Grow wall
        if (isVertical) {
            if (y + activeWall.lenPos < area.y + area.h) activeWall.lenPos += speed; else hitPos = true;
            if (y - activeWall.lenNeg > area.y) activeWall.lenNeg += speed; else hitNeg = true;
        } else {
            if (x + activeWall.lenPos < area.x + area.w) activeWall.lenPos += speed; else hitPos = true;
            if (x - activeWall.lenNeg > area.x) activeWall.lenNeg += speed; else hitNeg = true;
        }

        // Check if ball hits the growing wall (Lose a life)
        balls.forEach(ball => {
            if (isVertical) {
                if (Math.abs(ball.x - x) < ball.radius && ball.y > y - activeWall.lenNeg && ball.y < y + activeWall.lenPos) {
                    loseLife();
                }
            } else {
                if (Math.abs(ball.y - y) < ball.radius && ball.x > x - activeWall.lenNeg && ball.x < x + activeWall.lenPos) {
                    loseLife();
                }
            }
        });

        // If wall finishes building, split the area
        if (hitPos && hitNeg && activeWall) {
            splitArea(activeWall);
            activeWall = null; // Wall is done
        }
    }
}

function splitArea(wall) {
    const { x, y, isVertical, area } = wall;
    let area1, area2;

    // Create the two new rectangles mathematically
    if (isVertical) {
        area1 = { x: area.x, y: area.y, w: x - area.x, h: area.h };
        area2 = { x: x, y: area.y, w: area.x + area.w - x, h: area.h };
    } else {
        area1 = { x: area.x, y: area.y, w: area.w, h: y - area.y };
        area2 = { x: area.x, y: y, w: area.w, h: area.y + area.h - y };
    }

    // Remove the old combined area
    activeAreas = activeAreas.filter(a => a !== area);

    // Only keep the new areas if they contain a ball
    const keepArea1 = balls.some(b => b.x >= area1.x && b.x <= area1.x + area1.w && b.y >= area1.y && b.y <= area1.y + area1.h);
    const keepArea2 = balls.some(b => b.x >= area2.x && b.x <= area2.x + area2.w && b.y >= area2.y && b.y <= area2.y + area2.h);

    if (keepArea1) activeAreas.push(area1);
    if (keepArea2) activeAreas.push(area2);

    updateScore();
}

function updateScore() {
    let currentActiveSpace = activeAreas.reduce((sum, a) => sum + (a.w * a.h), 0);
    let cleared = ((totalArea - currentActiveSpace) / totalArea) * 100;
    scoreDisplay.innerText = `${Math.floor(cleared)}% cleared`;
}

function loseLife() {
    lives--;
    livesDisplay.innerText = `Lives: ${lives}/3`;
    activeWall = null; // Destroy the wall that was being built
    if (lives <= 0) {
        isGameOver = true;
        alert("Game Over! Refresh to try again.");
    }
}

function draw() {
    // Fill the whole canvas with the "cleared" gray color first
    ctx.fillStyle = '#c0c0c0'; 
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw only the active (playable) areas in white
    ctx.fillStyle = '#ffffff';
    activeAreas.forEach(a => {
        ctx.fillRect(a.x, a.y, a.w, a.h);
    });

    // Draw boundaries between active areas slightly darker if needed
    ctx.strokeStyle = '#999';
    activeAreas.forEach(a => {
        ctx.strokeRect(a.x, a.y, a.w, a.h);
    });

    // Draw the wall currently being built
    if (activeWall) {
        ctx.fillStyle = '#ff0000'; // Red while building
        if (activeWall.isVertical) {
            ctx.fillRect(activeWall.x - 2, activeWall.y - activeWall.lenNeg, 4, activeWall.lenPos + activeWall.lenNeg);
        } else {
            ctx.fillRect(activeWall.x - activeWall.lenNeg, activeWall.y - 2, activeWall.lenPos + activeWall.lenNeg, 4);
        }
    }

    // Draw Balls
    ctx.fillStyle = '#000000';
    balls.forEach(ball => {
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
        ctx.fill();
    });
}

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// Start Game
gameLoop();
