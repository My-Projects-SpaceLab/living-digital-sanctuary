const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const label = document.getElementById('state-label');
const card = document.getElementById('editor-card');
const hudState = document.getElementById('hud-state');
const hudSpeed = document.getElementById('hud-speed');
const hudIdle = document.getElementById('hud-idle');
const textarea = document.getElementById('editor-textarea');

let W = 0, H = 0;

function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

let lastActive = Date.now();
let keyTimes = [];
let cpm = 0;

textarea.addEventListener('input', () => {
    const now = Date.now();
    lastActive = now;
    keyTimes.push(now);
});

setInterval(() => {
    const now = Date.now();
    keyTimes = keyTimes.filter(t => now - t < 10000);
    cpm = Math.round(keyTimes.length * 6);
    hudSpeed.textContent = cpm;
    const idleSecs = Math.round((now - lastActive) / 1000);
    hudIdle.textContent = idleSecs;
}, 500);

let stateBlend = 0;
let targetBlend = 0;
let stateName = 'flow';
let currentCardOpacity = 1.0;

function updateState() {
    const idleSecs = (Date.now() - lastActive) / 1000;
    if (idleSecs > 4.0) { targetBlend = 1.0; }
    else if (idleSecs > 1.5 || cpm < 40) { targetBlend = 0.5; }
    else if (cpm > 180) { targetBlend = 0.0; }
    else { targetBlend = Math.max(0, Math.min(0.5, 0.5 - (cpm - 40) / 280)); }

    let targetCardOpacity = (idleSecs > 4.0) ? 0.04 : (idleSecs > 1.0 ? 0.55 : 1.0);
    const isWakingUp = (targetCardOpacity > currentCardOpacity);
    const cardLerp = isWakingUp ? 0.25 : 0.06;
    const blendLerp = isWakingUp ? 0.18 : 0.06;

    currentCardOpacity += (targetCardOpacity - currentCardOpacity) * cardLerp;
    stateBlend += (targetBlend - stateBlend) * blendLerp;
    card.style.opacity = currentCardOpacity.toFixed(3);

    if (stateBlend < 0.25) {
        stateName = 'flow';
        card.style.transform = 'scale(1)';
    } else if (stateBlend < 0.7) {
        stateName = 'drift';
        card.style.transform = 'scale(0.98)';
    } else {
        stateName = 'restore';
        card.style.transform = 'scale(0.96)';
    }

    if (stateName !== label.textContent) {
        label.textContent = stateName;
        hudState.textContent = stateName.charAt(0).toUpperCase() + stateName.slice(1);
    }
}

// Particle Engine
const PARTICLE_COUNT = 850;
let particles = [];
class Particle {
    constructor() { this.init(); }
    init() {
        this.x = Math.random() * W;
        this.y = Math.random() * H;
        this.life = Math.random() * 500;
    }
    update() {
        this.life--;
        if (this.life <= 0) this.init();
    }
    draw() {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.beginPath();
        ctx.arc(this.x, this.y, 1, 0, Math.PI * 2);
        ctx.fill();
    }
}

for (let i = 0; i < PARTICLE_COUNT; i++) particles.push(new Particle());

function loop() {
    ctx.fillStyle = 'rgba(2, 4, 6, 0.2)';
    ctx.fillRect(0, 0, W, H);
    updateState();
    particles.forEach(p => { p.update(); p.draw(); });
    requestAnimationFrame(loop);
}
loop();
