class HoleInTwelveSmooth3D {
    constructor() {
        this.level = 1; this.wallsPassed = 0; this.timeLeft = 90; this.gameTimer = null; this.isGameOver = true; this.isPaused = false;
        this.canvas = document.getElementById('gameCanvas'); this.ctx = this.canvas.getContext('2d');
        this.ball = { x: 0, y: -8, z: 160, radius: 26, vx: 0, vz: 0, targetZ: 160, maxVelX: 6.8, bounceDuration: 0 };
        this.cameraZ = 0; this.fov = 300; this.viewHeight = 150; this.cameraAnchorOffset = -150;
        this.walls = []; this.boosters = []; this.barriers = []; this.keys = {}; this.activeTouches = new Set();
        this.brickColors = ["#cfa16a", "#694423", "#bcbcbc"]; 
        this.introScreen = document.getElementById('screen-intro'); this.overlayScreen = document.getElementById('screen-overlay');
        this.overlayTitle = document.getElementById('overlay-title'); this.overlayDesc = document.getElementById('overlay-desc');
        this.overlayBtn = document.getElementById('btn-overlay-action'); this.pauseBtn = document.getElementById('btn-pause');
        this.lblLevel = document.getElementById('lbl-level'); this.lblWalls = document.getElementById('lbl-walls'); this.lblTime = document.getElementById('lbl-time');
    }
    init() { this.canvas.width = 700; this.canvas.height = 700; this.attachEventListeners(); this.showHazardIntro(); this.runPipelineLoop(); }
    attachEventListeners() {
        window.addEventListener('keydown', (e) => {
            if (e.key.toLowerCase() === 'p') { this.togglePause(); return; }
            this.keys[e.key] = true;
        });
        window.addEventListener('keyup', (e) => this.keys[e.key] = false);
        this.pauseBtn.addEventListener('click', () => this.togglePause());
        document.querySelectorAll('.ctrl-btn').forEach(btn => {
            const d = btn.getAttribute('data-dir'); btn.addEventListener('touchstart', (e) => { e.preventDefault(); if(!this.isPaused) this.activeTouches.add(d); }, {passive: false});
            ['touchend', 'mouseup', 'mouseleave'].forEach(evt => btn.addEventListener(evt, () => this.activeTouches.delete(d)));
            btn.addEventListener('mousedown', () => { if(!this.isPaused) this.activeTouches.add(d); });
        });
        document.getElementById('btn-intro-next').addEventListener('click', () => this.launchGameViewport());
        this.overlayBtn.addEventListener('click', () => this.showHazardIntro());
    }
    togglePause() {
        if (this.isGameOver) return;
        this.isPaused = !this.isPaused;
        this.pauseBtn.innerText = this.isPaused ? "▶ RESUME" : "⏸ PAUSE";
        if (this.isPaused) {
            this.ctx.fillStyle = "rgba(0, 0, 0, 0.5)"; this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.fillStyle = "#ffffff"; this.ctx.font = "bold 32px Arial"; this.ctx.textAlign = "center";
            this.ctx.fillText("GAME PAUSED", this.canvas.width / 2, this.canvas.height / 2);
        }
    }
    showHazardIntro() {
        this.overlayScreen.classList.add('hidden'); this.introScreen.classList.remove('hidden');
        document.getElementById('card-gates').classList.toggle('locked', this.level < 2);
        document.getElementById('card-tape').classList.toggle('locked', this.level < 4);
        document.getElementById('card-cones').classList.toggle('locked', this.level < 7);
    }
    launchGameViewport() {
        this.introScreen.classList.add('hidden'); this.wallsPassed = 0; this.timeLeft = 90; this.cameraZ = 0; this.isPaused = false; this.pauseBtn.innerText = "⏸ PAUSE";
        this.ball.x = 0; this.ball.y = -8; this.ball.z = this.ball.targetZ; this.ball.vx = 0; this.ball.vz = 0; this.ball.bounceDuration = 0;
        this.generate3DCourseTrack(); clearInterval(this.gameTimer);
        this.gameTimer = setInterval(() => { if (!this.isGameOver && !this.isPaused) { this.timeLeft--; this.lblTime.innerText = this.timeLeft; if (this.timeLeft <= 0) this.triggerTimeout(); } }, 1000);
        this.isGameOver = false; this.updateHUDStats();
    }
    generate3DCourseTrack() {
        this.walls = []; this.boosters = []; this.barriers = []; let cursorZ = 650;
        for (let i = 0; i < 12; i++) {
            cursorZ += (580 + (this.level * 10)); const gapW = Math.max(130 - (this.level * 3), 85); const gapX = Math.random() * (220 - gapW) - 110;
            let brickSeeds = []; for(let b=0; b<16; b++) { brickSeeds.push(Math.floor(Math.random()*this.brickColors.length)); }
            this.walls.push({ id: i + 1, z: cursorZ, gapX: gapX, gapWidth: gapW, passed: false, bricks: brickSeeds, thick: 50, height3D: 110 });
            if (this.level >= 2 && Math.random() < 0.75) this.barriers.push({ type: 'gate', z: cursorZ, gapX: gapX, gapWidth: gapW, stateY: 0, dir: 1, speed: 0.012 + (this.level * 0.003) });
            if (this.level >= 4 && Math.random() < 0.5) this.barriers.push({ type: 'tape', z: cursorZ - 120, x: gapX, width: gapW, ripped: false });
            if (this.level >= 7 && Math.random() < 0.6) this.barriers.push({ type: 'cone', z: cursorZ - 200, x: gapX + (Math.random() * (gapW - 40)) + 20, knocked: false, rotX: 0, rotY: 0, bounceY: 0, bounceV: 0 });
        }
        for (let j = 0; j < 6; j++) this.boosters.push({ x: Math.random() * 180 - 90, z: j * 950 + 500, w: 80, h: 50, active: true });
    }
    handleSmoothVelocityInput() {
        if (this.ball.bounceDuration > 0 || this.isPaused) return;
        const left = this.keys['ArrowLeft'] || this.keys['a'] || this.activeTouches.has('left');
        const right = this.keys['ArrowRight'] || this.keys['d'] || this.activeTouches.has('right');
        const up = this.keys['ArrowUp'] || this.keys['w'] || this.activeTouches.has('up');
        const down = this.keys['ArrowDown'] || this.keys['s'] || this.activeTouches.has('down');
        if (left) this.ball.vx = Math.max(-this.ball.maxVelX, this.ball.vx - 0.45);
        else if (right) this.ball.vx = Math.min(this.ball.maxVelX, this.ball.vx + 0.45);
        else this.ball.vx *= 0.86;
        let targetForwardVz = 3.0 + (this.level * 0.35);
        if (up) this.ball.vz = (this.ball.vz * 0.88) + (targetForwardVz * 1.45 * 0.12);
        else if (down) this.ball.vz = (this.ball.vz * 0.88) + (targetForwardVz * 0.35 * 0.12);
        else this.ball.vz = (this.ball.vz * 0.88) + (targetForwardVz * 0.12);
    }
    update() {
        if (this.isGameOver || this.isPaused) return; this.handleSmoothVelocityInput();
        if (this.ball.bounceDuration > 0) { this.ball.z -= 1.6; this.ball.bounceDuration -= 0.02; if (this.ball.bounceDuration <= 0) { this.ball.bounceDuration = 0; } }
        else { this.ball.x += this.ball.vx; this.ball.z += this.ball.vz; this.ball.z += 0.5; }
        if (this.ball.x < -220) { this.ball.x = -220; this.ball.vx = 0; } if (this.ball.x > 220) { this.ball.x = 220; this.ball.vx = 0; }
        this.cameraZ = this.ball.z + this.cameraAnchorOffset;
        this.boosters.forEach(b => { if (b.active && Math.abs(this.ball.z - b.z) < 40 && Math.abs(this.ball.x - b.x) < b.w/2) { b.active = false; this.ball.z += 130; } });
        this.barriers.forEach(b => {
            if (b.type === 'gate') { b.stateY += b.speed * b.dir; if (b.stateY > 1 || b.stateY < 0) b.dir *= -1; if (Math.abs(this.ball.z - b.z) < 30 && this.ball.x > b.gapX && this.ball.x < b.gapX + b.gapWidth && b.stateY > 0.35) this.bounceBackward(); }
            if (b.type === 'tape' && !b.ripped && Math.abs(this.ball.z - b.z) < 30 && this.ball.x > b.x && this.ball.x < b.x + b.width) b.ripped = true;
            if (b.type === 'cone') {
                if (!b.knocked) { if (Math.hypot(this.ball.x - b.x, this.ball.z - b.z) < this.ball.radius * 0.7 + 15) { b.knocked = true; b.bounceV = -5.5; } }
                else { b.bounceV += 0.38; b.bounceY += b.bounceV; if (b.bounceY > 0) { b.bounceY = 0; b.bounceV = -b.bounceV * 0.48; } if (b.rotX < Math.PI/2) b.rotX += 0.12; b.rotY += 0.06; }
            }
        });
        this.walls.forEach(w => { if (Math.abs(this.ball.z - w.z) < 30) { if (this.ball.x > w.gapX && this.ball.x < w.gapX + w.gapWidth) { if (!w.passed) { w.passed = true; this.wallsPassed++; this.updateHUDStats(); if (this.wallsPassed >= 12) this.triggerTrackWin(); } } else { this.bounceBackward(); } } });
    }
    bounceBackward() { if (this.ball.bounceDuration > 0) return; this.ball.bounceDuration = 0.45; this.ball.vz = -1.2; this.ball.vx = -this.ball.vx * 0.25; }
    triggerTimeout() { this.isGameOver = true; this.showEndOverlay("TIME EXPIRED", "The course timer window elapsed.", "Retry Level"); }
    triggerTrackWin() { this.isGameOver = true; if (this.level >= 10) { this.showEndOverlay("CHAMPION COMPLETED!", "You cleared all high-definition tracks!", "Restart"); this.level = 1; } else { this.showEndOverlay("STAGE SURVIVED", `Course ${this.level} complete!`, `Enter Level ${this.level + 1}`); this.level++; } }
    updateHUDStats() { this.lblLevel.innerText = this.level; this.lblWalls.innerText = this.wallsPassed; this.lblTime.innerText = this.timeLeft; }
    showEndOverlay(title, desc, btnText) { this.overlayTitle.innerText = title; this.overlayDesc.innerText = desc; this.overlayBtn.innerText = btnText; this.overlayScreen.classList.remove('hidden'); }
    project3D(x, y, z) {
        let relativeZ = z - this.cameraZ; if (relativeZ <= 5) return null;
        let scale = this.fov / relativeZ; return { x: (this.canvas.width / 2) + (x * scale), y: (this.canvas.height / 2) + ((this.viewHeight - y) * scale), size: scale, light: Math.max(0.02, 1 - (relativeZ / 1500)) };
    }
    drawSolid3DBlock(x1, x2, z, thick, height, seedColor) {
        let pF_L = this.project3D(x1, 0, z), pF_R = this.project3D(x2, 0, z);
        let pB_L = this.project3D(x1, 0, z + thick), pB_R = this.project3D(x2, 0, z + thick);
        if (!pF_L || !pF_R || !pB_L || !pB_R) return;
        let hF = pF_L.size * height, hB = pB_L.size * height;
        this.ctx.fillStyle = seedColor; 
        this.ctx.beginPath(); this.ctx.moveTo(pF_L.x, pF_L.y); this.ctx.lineTo(pF_R.x, pF_R.y); this.ctx.lineTo(pF_R.x, pF_R.y - hF); this.ctx.lineTo(pF_L.x, pF_L.y - hF); this.ctx.closePath(); this.ctx.fill();
        this.ctx.fillStyle = "rgba(0,0,0,0.18)"; 
        this.ctx.beginPath(); this.ctx.moveTo(pF_L.x, pF_L.y - hF); this.ctx.lineTo(pF_R.x, pF_R.y - hF); this.ctx.lineTo(pB_R.x, pB_R.y - hB); this.ctx.lineTo(pB_L.x, pB_L.y - hB); this.ctx.closePath(); this.ctx.fill();
        this.ctx.fillStyle = "rgba(0,0,0,0.36)"; 
        this.ctx.beginPath(); this.ctx.moveTo(pF_R.x, pF_R.y); this.ctx.lineTo(pB_R.x, pB_R.y); this.ctx.lineTo(pB_R.x, pB_R.y - hB); this.ctx.lineTo(pF_R.x, pF_R.y - hF); this.ctx.closePath(); this.ctx.fill();
    }
    draw() {
        if (this.isPaused) return;
        this.ctx.fillStyle = "#05070a"; this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = "#010204"; this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height / 2);
        for (let pZ = Math.floor(this.cameraZ / 80) * 80; pZ < this.cameraZ + 1600; pZ += 80) {
            let pL = this.project3D(-240, 0, pZ), pR = this.project3D(240, 0, pZ);
            if (pL && pR) { this.ctx.strokeStyle = `rgba(0, 242, 254, ${pL.light * 0.14})`; this.ctx.lineWidth = Math.max(1, pL.size * 0.3); this.ctx.beginPath(); this.ctx.moveTo(pL.x, pL.y); this.ctx.lineTo(pR.x, pR.y); this.ctx.stroke(); }
        }
        this.boosters.forEach(b => {
            if (!b.active) return; let p1 = this.project3D(b.x - b.w/2, 0, b.z), p2 = this.project3D(b.x + b.w/2, 0, b.z + b.h);
            if (p1 && p2) {
                let g = this.ctx.createLinearGradient(0, p2.y, 0, p1.y); g.addColorStop(0, `rgba(0,255,120,${p1.light})`); g.addColorStop(1, "transparent"); this.ctx.fillStyle = g; this.ctx.fillRect(p1.x, p2.y, p2.x - p1.x, p1.y - p2.y);
                this.ctx.fillStyle = `rgba(255,255,255,${p1.light * 0.6})`; this.ctx.font = `bold ${Math.max(10, p1.size * 3)}px Arial`; this.ctx.textAlign = "center"; this.ctx.fillText("▲ SPEED ▲", p1.x + (p2.x - p1.x)/2, p1.y - 5);
            }
        });
        this.walls.forEach(w => {
            this.drawSolid3DBlock(-240, w.gapX, w.z, w.thick, w.height3D, this.brickColors[w.bricks[0]]);
            this.drawSolid3DBlock(w.gapX + w.gapWidth, 240, w.z, w.thick, w.height3D, this.brickColors[w.bricks[1]]);
        });
        this.barriers.forEach(b => {
            if (b.type === 'gate') {
                let pB = this.project3D(b.gapX, 0, b.z), pT = this.project3D(b.gapX + b.gapWidth, 0, b.z);
                if (pB && pT) {
                    let maxH = pB.size * 72, dropH = maxH * b.stateY;
                    let mG = this.ctx.createLinearGradient(pB.x, 0, pT.x, 0); mG.addColorStop(0, `rgba(165,175,190,${pB.light})`); mG.addColorStop(0.5, `rgba(235,240,250,${pB.light})`); mG.addColorStop(1, `rgba(125,135,145,${pB.light})`);
                    this.ctx.fillStyle = mG; this.ctx.fillRect(pB.x, pB.y - maxH, pT.x - pB.x, dropH);
                    this.ctx.strokeStyle = `rgba(45,55,65,${pB.light})`; this.ctx.lineWidth = Math.max(1.5, pB.size * 0.5);
                    let step = (pT.x - pB.x) / 8; for (let k = 0; k <= 8; k++) { this.ctx.beginPath(); this.ctx.moveTo(pB.x + (k * step), pB.y - maxH); this.ctx.lineTo(pB.x + (k * step), pB.y - maxH + dropH); this.ctx.stroke(); }
                }
            }
            if (b.type === 'tape') {
                let pL = this.project3D(b.x, 32, b.z), pR = this.project3D(b.x + b.width, 32, b.z);
                if (pL && pR) {
                    let th = Math.max(4, pL.size * 4.2); this.ctx.fillStyle = `rgba(255,215,0,${pL.light})`;
                    if (b.ripped) { this.ctx.fillRect(pL.x, pL.y, (pR.x - pL.x)*0.12, th); this.ctx.fillRect(pL.x + (pR.x - pL.x)*0.88, pL.y, (pR.x - pL.x)*0.12, th); }
                    else { this.ctx.fillRect(pL.x, pL.y, pR.x - pL.x, th); this.ctx.fillStyle = `rgba(0,0,0,${pL.light})`; this.ctx.font = `bold ${Math.max(9, pL.size * 3.4)}px monospace`; this.ctx.textAlign = "center"; this.ctx.fillText("CAUTION", pL.x + (pR.x - pL.x)/2, pL.y + th - 1.5); this.ctx.textAlign = "left"; }
                }
            }
            if (b.type === 'cone') {
                let p = this.project3D(b.x, -b.bounceY, b.z);
                if (p) {
                    let h3D = p.size * 22, w3D = p.size * 16; this.ctx.save(); this.ctx.translate(p.x, p.y); if (b.knocked) this.ctx.rotate(b.rotY);
                    this.ctx.fillStyle = `rgba(255,105,0,${p.light})`; this.ctx.beginPath(); this.ctx.moveTo(-w3D/2, 0); this.ctx.lineTo(w3D/2, 0); this.ctx.lineTo(w3D*0.16, -h3D); this.ctx.lineTo(-w3D*0.16, -h3D); this.ctx.closePath(); this.ctx.fill();
                    this.ctx.fillStyle = `rgba(255,255,255,${p.light})`; this.ctx.fillRect(-w3D*0.3, -h3D*0.75, w3D*0.6, h3D*0.14); this.ctx.fillRect(-w3D*0.4, -h3D*0.4, w3D*0.8, h3D*0.14);
                    this.ctx.restore();
                }
            }
        });
        let pBall = this.project3D(this.ball.x, this.ball.y, this.ball.z);
        if (pBall) {
            let r3D = Math.max(8, pBall.size * 2.2);
            let bG = this.ctx.createRadialGradient(pBall.x - r3D*0.3, pBall.y - r3D*0.3, r3D*0.1, pBall.x, pBall.y, r3D);
            bG.addColorStop(0, "#ffffff"); bG.addColorStop(0.28, "#cbd5e1"); bG.addColorStop(1, "#334155");
            this.ctx.fillStyle = bG; this.ctx.shadowColor = "rgba(0, 242, 254, 0.8)"; this.ctx.shadowBlur = 18;
            this.ctx.beginPath(); this.ctx.arc(pBall.x, pBall.y, r3D, 0, Math.PI * 2); this.ctx.fill(); this.ctx.shadowBlur = 0;
        }
    }
    runPipelineLoop() { this.update(); this.draw(); requestAnimationFrame(() => this.runPipelineLoop()); }
}
const game = new HoleInTwelveSmooth3D(); window.addEventListener('DOMContentLoaded', () => game.init());
