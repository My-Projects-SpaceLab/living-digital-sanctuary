const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const label = document.getElementById('state-label');
const card = document.getElementById('editor-card');
const textarea = document.getElementById('editor-textarea');
const hudState = document.getElementById('hud-state');
const hudSpeed = document.getElementById('hud-speed');
const hudIdle = document.getElementById('hud-idle');
const shareBtn = document.getElementById('share-btn');
const aboutLink = document.getElementById('about-link');
const promptOverlay = document.getElementById('prompt-overlay');
const btnClearer = document.getElementById('btn-clearer');
const btnNotSure = document.getElementById('btn-notsure');
const shareCard = document.getElementById('share-card');
const btnCopyLink = document.getElementById('btn-copy-link');
const btnNativeShare = document.getElementById('btn-native-share');

let W = 0, H = 0;

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
let sessionStart = Date.now();
let promptShown = false;

function recordActivity() {
    const now = Date.now();
    lastActive = now;
    keyTimes.push(now);
}

textarea.addEventListener('input', recordActivity);
textarea.addEventListener('keydown', recordActivity);
document.getElementById('editor-title').addEventListener('input', recordActivity);

setInterval(() => {
    const now = Date.now();
    keyTimes = keyTimes.filter(t => now - t < 12000);
    cpm = Math.round(keyTimes.length * 5);

    const idleSecs = Math.round((now - lastActive) / 1000);
    hudState.textContent = stateName.charAt(0).toUpperCase() + stateName.slice(1);
    hudSpeed.textContent = cpm;
    hudIdle.textContent = idleSecs;
}, 800);

// ── SHARE & UI VISIBILITY (after 30s) ───────────────────────────
setTimeout(() => {
    shareBtn.classList.add('visible');
    aboutLink.classList.add('visible');
}, 30000);

// ── 10-MINUTE PROMPT ─────────────────────────────────────────────
setTimeout(() => {
    if (!promptShown) {
        promptShown = true;
        promptOverlay.classList.add('visible');
    }
},   60 * 1000);

btnClearer.addEventListener('click', () => {
    document.getElementById('prompt-question').style.display = 'none';
    document.getElementById('prompt-choices').style.display = 'none';
    shareCard.hidden = false;
});

btnNotSure.addEventListener('click', () => {
    promptOverlay.style.opacity = '0';
    promptOverlay.style.pointerEvents = 'none';
});

btnCopyLink.addEventListener('click', () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
        btnCopyLink.textContent = 'Copied ✓';
        setTimeout(() => { btnCopyLink.textContent = 'Copy link'; }, 2000);
    });
});

btnNativeShare.addEventListener('click', async () => {
    const data = {
        title: 'Living Digital Sanctuary',
        text: 'Something real. No sign-up. Just open it.',
        url: window.location.href
    };
    try {
        if (navigator.share) { await navigator.share(data); }
        else { navigator.clipboard.writeText(window.location.href); btnNativeShare.textContent = 'Link copied'; }
    } catch (e) { /* user cancelled */ }
});

shareBtn.addEventListener('click', async () => {
    const data = {
        title: 'Living Digital Sanctuary',
        text: 'Something real. No sign-up. Just open it.',
        url: window.location.href
    };
    try {
        if (navigator.share) { await navigator.share(data); }
        else { navigator.clipboard.writeText(window.location.href); shareBtn.textContent = 'link copied'; }
    } catch (e) { /* cancelled */ }
});

// ── STATE ENGINE (REAL HUMAN TIMESCALES) ─────────────────────────
let stateBlend = 0;
let targetBlend = 0;
let stateName = 'flow';
let currentCardOpacity = 1.0;

function updateState() {
    const idleSecs = (Date.now() - lastActive) / 1000;

    // Real timescales: drift at 15s idle or low cpm, restore at 45s
    if (idleSecs > 45) {
        targetBlend = 1.0;
    } else if (idleSecs > 15 || cpm < 30) {
        targetBlend = 0.5;
    } else if (cpm > 160) {
        targetBlend = 0.0;
    } else {
        targetBlend = Math.max(0, Math.min(0.5, 0.5 - (cpm - 30) / 260));
    }

    // Card opacity
    let targetCardOpacity;
    if (idleSecs > 45) {
        targetCardOpacity = 0.05;
    } else if (idleSecs > 15) {
        targetCardOpacity = 0.55;
    } else {
        targetCardOpacity = 1.0;
    }

    const isWakingUp = targetCardOpacity > currentCardOpacity;

    // Very slow lerps — transitions take 8–20 real seconds
    // Wake-up is faster (feels responsive), fade-out is glacial (imperceptible)
    const cardLerp  = isWakingUp ? 0.08 : 0.012;
    const blendLerp = isWakingUp ? 0.05 : 0.008;

    currentCardOpacity += (targetCardOpacity - currentCardOpacity) * cardLerp;
    stateBlend         += (targetBlend - stateBlend) * blendLerp;

    card.style.opacity = currentCardOpacity.toFixed(4);

    if (stateBlend < 0.25) {
        stateName = 'flow';
        card.style.transform = 'scale(1)';
        card.style.background = 'rgba(8, 12, 18, 0.60)';
        card.style.borderColor = 'rgba(255, 255, 255, 0.07)';
    } else if (stateBlend < 0.70) {
        stateName = 'drift';
        card.style.transform = 'scale(0.990)';
        card.style.background = 'rgba(8, 12, 18, 0.38)';
        card.style.borderColor = 'rgba(255, 255, 255, 0.035)';
    } else {
        stateName = 'restore';
        card.style.transform = 'scale(0.980)';
        card.style.background = 'rgba(5, 8, 12, 0.12)';
        card.style.borderColor = 'rgba(255, 255, 255, 0.015)';
    }

    const prev = label.textContent;
    if (stateName !== prev) label.textContent = stateName;
}

// ── SIMPLEX-LIKE SMOOTH NOISE (no library needed) ────────────────
// Layered sine approximation — organic enough, zero imports
function smoothNoise(x, y, t) {
    const a = Math.sin(x * 0.011 + t * 0.19) * Math.cos(y * 0.009 + t * 0.13);
    const b = Math.sin(x * 0.023 - y * 0.017 + t * 0.11) * 0.5;
    const c = Math.cos(x * 0.007 + y * 0.013 - t * 0.07) * 0.35;
    return (a + b + c) / 1.85; // range ~-1..1
}

// ── FLOW FIELD ───────────────────────────────────────────────────
function fieldAngle(x, y, t) {
    // Slow down field when in restore — drifting, not flowing
    const speed = 1.0 - stateBlend * 0.55;
    const sc    = 0.0010 + stateBlend * 0.0003;

    const n1 = smoothNoise(x, y, t * speed);
    const n2 = smoothNoise(x * 1.6, y * 1.6, t * speed * 0.7 + 10);

    return n1 * Math.PI * 1.8 + n2 * Math.PI * 0.6;
}

// ── COLOR PALETTE (blue→teal→warm amber) ─────────────────────────
function particleColor(hueVariant, alpha) {
    // flow: cool blue-teal (200–215°)
    // drift: teal-green (155–175°)
    // restore: warm amber-gold (30–50°)
    let h;
    if (stateBlend < 0.5) {
        const t = stateBlend / 0.5;
        h = 208 + (162 - 208) * t;
    } else {
        const t = (stateBlend - 0.5) / 0.5;
        h = 162 + (38 - 162) * t;
    }
    h += hueVariant * 14 - 7;

    const s = 72 - stateBlend * 16;
    const l = 52 + stateBlend * 10;
    return `hsla(${h.toFixed(1)}, ${s.toFixed(1)}%, ${l.toFixed(1)}%, ${alpha.toFixed(4)})`;
}

// ── PARTICLES ────────────────────────────────────────────────────
// Count scales with state — fewer, slower particles in restore
const MAX_PARTICLES = 800;
const TAIL_LEN = 32;

class Particle {
    constructor() { this.init(true); }

    init(scatter) {
        this.x = scatter ? Math.random() * W : (Math.random() < 0.5 ? -12 : W + 12);
        this.y = scatter ? Math.random() * H : Math.random() * H;
        this.vx = 0;
        this.vy = 0;
        // Speed is lower in restore
        const speedMult = 0.55 + Math.random() * 0.7;
        this.spd = speedMult * (1.0 - stateBlend * 0.45);
        this.life = 0;
        this.maxL = 240 + Math.random() * 420;
        this.hv = Math.random();
        this.sz = 0.6 + Math.random() * 1.4;
        this.trail = [];
    }

    update(t) {
        this.life++;
        const slowdown = 1.0 - stateBlend * 0.52;

        const ang = fieldAngle(this.x, this.y, t);
        this.vx += Math.cos(ang) * 0.07 * slowdown;
        this.vy += Math.sin(ang) * 0.07 * slowdown;

        // More damping in restore = longer, floatier arcs
        const damp = 0.91 + stateBlend * 0.055;
        this.vx *= damp;
        this.vy *= damp;

        this.trail.push({ x: this.x, y: this.y });
        if (this.trail.length > TAIL_LEN) this.trail.shift();

        this.x += this.vx * this.spd;
        this.y += this.vy * this.spd;

        if (this.life > this.maxL ||
            this.x < -90 || this.x > W + 90 ||
            this.y < -90 || this.y > H + 90) {
            this.init(false);
        }
    }

    draw() {
        if (this.trail.length < 3) return;
        const lifeA = Math.min(1, this.life / 50) * Math.min(1, (this.maxL - this.life) / 50);
        const baseAlpha = 0.22 + stateBlend * 0.14;

        for (let i = 1; i < this.trail.length; i++) {
            const tFrac = i / this.trail.length;
            const alp = tFrac * lifeA * baseAlpha;
            const lw  = tFrac * this.sz * 1.4;

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
    for (let i = 0; i < MAX_PARTICLES; i++) particles.push(new Particle());
}
initParticles();

// ── BREATHING GLOW ───────────────────────────────────────────────
let breathPhase = 0;
function drawBreath() {
    const vis = Math.max(0, (stateBlend - 0.2) / 0.8);
    if (vis <= 0.01) return;

    // Breathing rhythm: ~4s inhale, ~6s exhale (natural resting breath)
    breathPhase += 0.0028;
    // Use two sines to create asymmetric breath shape
    const rawBreath = Math.sin(breathPhase) * 0.5 + 0.5;
    const pulse = Math.pow(rawBreath, 1.4); // slight ease-in bias

    const radius = Math.min(W, H) * (0.20 + pulse * 0.13);
    const alpha  = vis * 0.055 * (0.4 + pulse * 0.6);

    // Hue shifts with state: amber in restore, teal in drift
    const breathHue = 38 + (1 - stateBlend) * 120;

    const grd = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, radius);
    grd.addColorStop(0,   `hsla(${breathHue}, 65%, 62%, ${alpha.toFixed(4)})`);
    grd.addColorStop(0.5, `hsla(${breathHue}, 50%, 42%, ${(alpha * 0.4).toFixed(4)})`);
    grd.addColorStop(1,   'rgba(0,0,0,0)');

    ctx.beginPath();
    ctx.fillStyle = grd;
    ctx.arc(W / 2, H / 2, radius, 0, Math.PI * 2);
    ctx.fill();
}

// ── VIGNETTE ─────────────────────────────────────────────────────
function drawVignette() {
    const str = 0.42 + stateBlend * 0.22;
    const grd = ctx.createRadialGradient(W / 2, H / 2, H * 0.30, W / 2, H / 2, H * 0.92);
    grd.addColorStop(0, 'rgba(0,0,0,0)');
    grd.addColorStop(1, `rgba(2, 4, 6, ${str.toFixed(3)})`);
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, W, H);
}

// ── MAIN LOOP ────────────────────────────────────────────────────
let t = 0;
function loop() {
    t += 0.0032; // slightly slower time base = more languid motion
    updateState();

    // Trail fade — longer persistence in restore (dreamy)
    const fade = 0.030 + (1 - stateBlend) * 0.030;
    ctx.fillStyle = `rgba(2, 4, 6, ${fade.toFixed(4)})`;
    ctx.fillRect(0, 0, W, H);

    // Active particles scale down toward restore
    const active = Math.floor(MAX_PARTICLES * (0.72 + (1 - stateBlend) * 0.28));
    for (let i = 0; i < active; i++) {
        particles[i].update(t);
        particles[i].draw();
    }

    drawBreath();
    drawVignette();

    requestAnimationFrame(loop);
}
loop();
