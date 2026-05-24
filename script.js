const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const label = document.getElementById('state-label');
const card = document.getElementById('editor-card');

const hudState = document.getElementById('hud-state');
const hudSpeed = document.getElementById('hud-speed');
const hudIdle = document.getElementById('hud-idle');

const textarea = document.getElementById('editor-textarea');

let W = 0, H = 0;

// ── RESIZE ───────────────────────────────────────────────────────
function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// ── INTERACTION SENSING ──────────────────────────────────────────
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

// ── STATE ENGINE (SPEEDED UP FOR CAPTURE/DEMONSTRATION) ──────────
let stateBlend = 0;
let targetBlend = 0;
let stateName = 'flow';
let currentCardOpacity = 1.0;

function updateState() {
    const idleSecs = (Date.now() - lastActive) / 1000;

    // Fast-acting thresholds:
    if (idleSecs > 4.0) {
        targetBlend = 1.0;
    } else if (idleSecs > 1.5 || cpm < 40) {
        targetBlend = 0.5;
    } else if (cpm > 180) {
        targetBlend = 0.0;
    } else {
        targetBlend = Math.max(0, Math.min(0.5, 0.5 - (cpm - 40) / 280));
    }

    let targetCardOpacity = 1.0;
    if (idleSecs > 4.0) {
        targetCardOpacity = 0.04;
    } else if (idleSecs > 1.0) {
        targetCardOpacity = 0.55;
    } else {
        targetCardOpacity = 1.0;
    }

    const isWakingUp = (targetCardOpacity > currentCardOpacity);

    // Lerp speeds dramatically increased so transitions occur in ~3-4 seconds
    const cardLerp = isWakingUp ? 0.25 : 0.06;
    const blendLerp = isWakingUp ? 0.18 : 0.06;

    currentCardOpacity += (targetCardOpacity - currentCardOpacity) * cardLerp;
    stateBlend += (targetBlend - stateBlend) * blendLerp;

    card.style.opacity = currentCardOpacity.toFixed(3);

    if (stateBlend < 0.25) {
        stateName = 'flow';
        card.style.transform = 'scale(1)';
        card.style.background = 'rgba(8, 12, 18, 0.65)';
        card.style.borderColor = 'rgba(255, 255, 255, 0.08)';
    } else if (stateBlend < 0.7) {
        stateName = 'drift';
        card.style.transform = 'scale(0.98)';
        card.style.background = 'rgba(8, 12, 18, 0.4)';
        card.style.borderColor = 'rgba(255, 255, 255, 0.04)';
    } else {
        stateName = 'restore';
        card.style.transform = 'scale(0.96)';
    }

    const prev = label.textContent;
    if (stateName !== prev) {
        label.textContent = stateName;
        hudState.textContent = stateName.charAt(0).toUpperCase() + stateName.slice(1);
    }
}

// ── FLOW FIELD ───────────────────────────────────────────────────
function fieldAngle(x, y, t) {
    const sc = 0.0012 + stateBlend * 0.0004;
    return Math.sin(x * sc + t * 0.25) * Math.PI
        + Math.cos(y * sc + t * 0.18) * Math.PI
        + Math.sin((x + y) * sc * 0.6 + t * 0.12) * Math.PI * 0.5;
}

// ── COLOR SHIFT (BLUE → GREEN → ORANGE) ──────────────────────────
function particleColor(hueVariant, alpha) {
    let h;
    if (stateBlend < 0.5) {
        const t = stateBlend / 0.5;
        h = 205 + (140 - 205) * t;
    } else {
        const t = (stateBlend - 0.5) / 0.5;
        h = 140 + (26 - 140) * t;
    }

    h += hueVariant * 16 - 8;
    const s = 76 - stateBlend * 12;
    const l = 50 + stateBlend * 12;
    return `hsla(${h.toFixed(0)}, ${s.toFixed(0)}%, ${l.toFixed(0)}%, ${alpha.toFixed(3)})`;
}

// ── PARTICLES ────────────────────────────────────────────────────
const PARTICLE_COUNT = 850;
const TAIL_LEN = 28;

class Particle {
    constructor() { this.init(true); }

    init(scatter) {
        this.x = scatter ? Math.random() * W : (Math.random() < 0.5 ? -10 : W + 10);
        this.y = scatter ? Math.random() * H : Math.random() * H;
        this.vx = 0;
        this.vy = 0;
        this.spd = 0.4 + Math.random() * 0.9;
        this.life = 0;
        this.maxL = 220 + Math.random() * 380;
        this.hv = Math.random();
        this.sz = 0.7 + Math.random() * 1.5;
        this.trail = [];
    }

    update(t) {
        this.life++;
        const sm = 1.0 - stateBlend * 0.5;

        const ang = fieldAngle(this.x, this.y, t);
        this.vx += Math.cos(ang) * 0.08 * sm;
        this.vy += Math.sin(ang) * 0.08 * sm;

        const damp = 0.92 + stateBlend * 0.045;
        this.vx *= damp;
        this.vy *= damp;

        this.trail.push({ x: this.x, y: this.y });
        if (this.trail.length > TAIL_LEN) this.trail.shift();

        this.x += this.vx * this.spd;
        this.y += this.vy * this.spd;

        if (this.life > this.maxL || this.x < -80 || this.x > W + 80 || this.y < -80 || this.y > H + 80) {
            this.init(false);
        }
    }

    draw() {
        if (this.trail.length < 2) return;
        const lifeA = Math.min(1, this.life / 40) * Math.min(1, (this.maxL - this.life) / 40);

        for (let i = 1; i < this.trail.length; i++) {
            const t = i / this.trail.length;
            const alp = t * lifeA * (0.28 + stateBlend * 0.16);
            const lw = t * this.sz * 1.5;

            ctx.beginPath();
            ctx.strokeStyle = particleColor(this.hv, alp);
            ctx.lineWidth = lw;
            ctx.lineCap = 'round';
            ctx.moveTo(this.trail[i - 1].x, this.trail[i - 1].y);
            ctx.lineTo(this.trail[i].x, this.trail[i].y);
            ctx.stroke();
        }
    }
}

let particles = [];
function initParticles() {
    particles = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) particles.push(new Particle());
}
initParticles();

// ── BREATHING GLOW ───────────────────────────────────────────────
let breathPhase = 0;
function drawBreath() {
    const vis = Math.max(0, (stateBlend - 0.25) / 0.75);
    if (vis <= 0) return;

    breathPhase += 0.005;
    const pulse = Math.sin(breathPhase) * 0.5 + 0.5;
    const radius = Math.min(W, H) * (0.22 + pulse * 0.12);
    const alpha = vis * 0.06 * pulse;

    const grd = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, radius);
    grd.addColorStop(0, `hsla(${26 + stateBlend * 10}, 65%, 65%, ${alpha.toFixed(3)})`);
    grd.addColorStop(0.6, `hsla(${26 + stateBlend * 10}, 50%, 45%, ${(alpha * 0.3).toFixed(3)})`);
    grd.addColorStop(1, 'rgba(0,0,0,0)');

    ctx.beginPath();
    ctx.fillStyle = grd;
    ctx.arc(W / 2, H / 2, radius, 0, Math.PI * 2);
    ctx.fill();
}

// ── VIGNETTE ─────────────────────────────────────────────────────
function drawVignette() {
    const str = 0.45 + stateBlend * 0.2;
    const grd = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95);
    grd.addColorStop(0, 'rgba(0,0,0,0)');
    grd.addColorStop(1, `rgba(2, 4, 6, ${str.toFixed(2)})`);
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, W, H);
}

// ── MAIN LOOP ────────────────────────────────────────────────────
let t = 0;
function loop() {
    t += 0.004;
    updateState();

    const fade = 0.038 + (1 - stateBlend) * 0.035;
    ctx.fillStyle = `rgba(2, 4, 6, ${fade.toFixed(3)})`;
    ctx.fillRect(0, 0, W, H);

    const active = Math.floor(PARTICLE_COUNT * (0.8 + (1 - stateBlend) * 0.2));
    for (let i = 0; i < active; i++) {
        particles[i].update(t);
        particles[i].draw();
    }

    drawBreath();
    drawVignette();

    requestAnimationFrame(loop);
}
loop();

// ── SHARE SPACE ──────────
document.getElementById('share-btn').addEventListener('click', async () => {
    const shareData = {
        title: "My Digital Sanctuary",
        text: "I am in a state of " + stateName + ". Experience the flow.",
        url: window.location.href
    };

    try {
        if (navigator.share) {
            await navigator.share(shareData);
            console.log("Sanctuary shared successfully");
        } else {
            // Fallback for browsers that don't support Web Share API
            alert("Copy this link to share your space: " + window.location.href);
        }
    } catch (err) {
        console.error("Error sharing:", err);
    }
});
