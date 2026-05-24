const canvas   = document.getElementById('canvas');
const ctx      = canvas.getContext('2d');
const label    = document.getElementById('state-label');
const card     = document.getElementById('editor-card');
const textarea = document.getElementById('editor-textarea');
const hudState = document.getElementById('hud-state');
const hudSpeed = document.getElementById('hud-speed');
const hudIdle  = document.getElementById('hud-idle');
const shareBtn = document.getElementById('share-btn');

const promptOverlay  = document.getElementById('prompt-overlay');
const promptQuestion = document.getElementById('prompt-question');
const promptChoices  = document.getElementById('prompt-choices');
const shareCard      = document.getElementById('share-card');
const btnCopyLink    = document.getElementById('btn-copy-link');
const btnNativeShare = document.getElementById('btn-native-share');
const btnDismiss     = document.getElementById('btn-dismiss');
const promptComment  = document.getElementById('prompt-comment');
const btnSubmitComment = document.getElementById('btn-submit-comment');

let W = 0, H = 0;
function resize() { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; }
window.addEventListener('resize', resize);
resize();


// ── SHARE MESSAGES — randomised, personal ────────────────────────
const SHARE_MESSAGES = [
    "Thought you might need this.",
    "For when your brain feels loud.",
    "This helped me slow down a little.",
    "A soft little corner of the internet.",
    "Maybe sit with this for a minute.",
    "Something gentle for tired minds.",
    "A small digital sanctuary for someone you care about.",
    "Something peaceful, to express yourself.",
];

function getShareText() {
    const msg = SHARE_MESSAGES[Math.floor(Math.random() * SHARE_MESSAGES.length)];
    return `${msg}\nhttps://my-projects-spacelab.github.io/living-digital-sanctuary/`;
}

async function doShare(buttonEl) {
    const text = getShareText();
    try {
        if (navigator.share) {
            await navigator.share({ text });
        } else {
            await navigator.clipboard.writeText(text);
            if (buttonEl) {
                const orig = buttonEl.textContent;
                buttonEl.textContent = 'Copied ✓';
                setTimeout(() => { buttonEl.textContent = orig; }, 2200);
            }
        }
    } catch(e) { /* user cancelled */ }
}


// ── CYCLING EMOTIONAL PLACEHOLDERS ───────────────────────────────
const PROMPTS = [
    "What are you feeling right now?",
    "What's been sitting heavy on your mind?",
    "Write the thing you haven't said out loud yet.",
    "What would make today feel okay?",
    "Who are you thinking about?",
    "What do you need right now, honestly?",
    "What would you tell yourself from six months ago?",
    "What are you holding that you could let go of?",
    "What small thing made today bearable?",
    "Write to no one. Just write.",
    "What does rest feel like for you?",
    "What would you do if you weren't tired?",
    "You don't have to make this good. Just true.",
    "What do you wish someone would ask you today?",
    "What are you afraid of admitting?",
];

let promptIndex = 0;
textarea.setAttribute('placeholder', PROMPTS[0]);

setInterval(() => {
    if (textarea.value.length > 0) return;
    textarea.classList.add('placeholder-fade');
    setTimeout(() => {
        promptIndex = (promptIndex + 1) % PROMPTS.length;
        textarea.setAttribute('placeholder', PROMPTS[promptIndex]);
        textarea.classList.remove('placeholder-fade');
    }, 900);
}, 5000);


// ── INTERACTION SENSING ──────────────────────────────────────────
let lastActive  = Date.now();
let keyTimes    = [];
let cpm         = 0;
let promptShown = false;

function recordActivity() { lastActive = Date.now(); keyTimes.push(Date.now()); }
textarea.addEventListener('input', recordActivity);
textarea.addEventListener('keydown', recordActivity);
document.getElementById('editor-title').addEventListener('input', recordActivity);

setInterval(() => {
    const now = Date.now();
    keyTimes = keyTimes.filter(t => now - t < 12000);
    cpm = Math.round(keyTimes.length * 5);
    const idle = Math.round((now - lastActive) / 1000);
    hudState.textContent = stateName.charAt(0).toUpperCase() + stateName.slice(1);
    hudSpeed.textContent = cpm;
    hudIdle.textContent  = idle + 's';
}, 600);


// ── SHARE BUTTON (index.html bottom right) ────────────────────────
// Fades in after 30s
setTimeout(() => { shareBtn.classList.add('visible'); }, 30000);

shareBtn.addEventListener('click', () => doShare(shareBtn));


// ── ABOUT LINK — top right, fades in after 30s ───────────────────
const aboutLink = document.getElementById('about-link');
setTimeout(() => { if (aboutLink) aboutLink.classList.add('visible'); }, 30000);


// ── 5-MINUTE PROMPT ──────────────────────────────────────────────
setTimeout(() => {
    if (!promptShown) {
        promptShown = true;
        promptOverlay.classList.add('visible');
    }
}, 5 * 60 * 1000);

// 3 response buttons — Feeling better / Calm / Not sure yet
document.querySelectorAll('.prompt-choice-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        promptQuestion.style.display   = 'none';
        promptChoices.style.display    = 'none';
        promptComment.style.display    = 'flex';
    });
});

btnSubmitComment.addEventListener('click', () => {
    promptComment.style.display = 'none';
    shareCard.hidden = false;
});

// Skip comment, go straight to share card on "Not sure yet"
document.getElementById('btn-notsure').addEventListener('click', () => {
    promptQuestion.style.display = 'none';
    promptChoices.style.display  = 'none';
    shareCard.hidden = false;
});

btnDismiss.addEventListener('click', () => {
    promptOverlay.classList.remove('visible');
});

// Copy link in share card
btnCopyLink.addEventListener('click', async () => {
    const text = getShareText();
    await navigator.clipboard.writeText(text);
    btnCopyLink.textContent = 'Copied ✓';
    setTimeout(() => { btnCopyLink.textContent = 'Copy link'; }, 2200);
});

// Native share in share card
btnNativeShare.addEventListener('click', () => doShare(btnNativeShare));


// ── STATE ENGINE — 8s / 18s thresholds ───────────────────────────
let stateBlend         = 0;
let targetBlend        = 0;
let stateName          = 'flow';
let currentCardOpacity = 1.0;

function updateState() {
    const idle = (Date.now() - lastActive) / 1000;

    if (idle > 18)                       targetBlend = 1.0;
    else if (idle > 8 || cpm < 30)      targetBlend = 0.5;
    else if (cpm > 160)                  targetBlend = 0.0;
    else targetBlend = Math.max(0, Math.min(0.5, 0.5 - (cpm - 30) / 260));

    let targetCard = idle > 18 ? 0.05 : idle > 8 ? 0.52 : 1.0;
    const waking   = targetCard > currentCardOpacity;

    currentCardOpacity += (targetCard - currentCardOpacity)   * (waking ? 0.10 : 0.014);
    stateBlend         += (targetBlend - stateBlend)           * (waking ? 0.06 : 0.010);

    card.style.opacity     = currentCardOpacity.toFixed(4);
    card.style.transform   = stateBlend < 0.25 ? 'scale(1)' : stateBlend < 0.70 ? 'scale(0.990)' : 'scale(0.982)';
    card.style.background  = stateBlend < 0.25 ? 'rgba(8,12,18,0.60)' : stateBlend < 0.70 ? 'rgba(8,12,18,0.36)' : 'rgba(5,8,12,0.10)';
    card.style.borderColor = stateBlend < 0.25 ? 'rgba(255,255,255,0.07)' : stateBlend < 0.70 ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.012)';

    if      (stateBlend < 0.25) stateName = 'flow';
    else if (stateBlend < 0.70) stateName = 'drift';
    else                         stateName = 'restore';
    label.textContent = stateName;
}


// ── SMOOTH NOISE ──────────────────────────────────────────────────
function smoothNoise(x, y, t) {
    const a = Math.sin(x * 0.011 + t * 0.17) * Math.cos(y * 0.009 + t * 0.12);
    const b = Math.sin(x * 0.022 - y * 0.016 + t * 0.10) * 0.48;
    const c = Math.cos(x * 0.007 + y * 0.012 - t * 0.065) * 0.33;
    return (a + b + c) / 1.81;
}

function fieldAngle(x, y, t) {
    const speed = 1.0 - stateBlend * 0.55;
    const n1 = smoothNoise(x, y, t * speed);
    const n2 = smoothNoise(x * 1.5, y * 1.5, t * speed * 0.65 + 8);
    return n1 * Math.PI * 1.9 + n2 * Math.PI * 0.55;
}

function particleColor(hv, alpha) {
    let h = stateBlend < 0.5
        ? 210 + (165 - 210) * (stateBlend / 0.5)
        : 165 + (38  - 165) * ((stateBlend - 0.5) / 0.5);
    h += hv * 14 - 7;
    return `hsla(${h.toFixed(1)},${(72 - stateBlend*16).toFixed(1)}%,${(52 + stateBlend*10).toFixed(1)}%,${alpha.toFixed(4)})`;
}


// ── PARTICLES ─────────────────────────────────────────────────────
const MAX_P = 800, TAIL = 32;

class Particle {
    constructor() { this.init(true); }
    init(s) {
        this.x = s ? Math.random()*W : (Math.random()<0.5 ? -12 : W+12);
        this.y = s ? Math.random()*H : Math.random()*H;
        this.vx = 0; this.vy = 0;
        this.spd  = (0.5 + Math.random()*0.7) * (1 - stateBlend*0.45);
        this.life = 0; this.maxL = 240 + Math.random()*420;
        this.hv = Math.random(); this.sz = 0.6 + Math.random()*1.4;
        this.trail = [];
    }
    update(t) {
        this.life++;
        const slow = 1 - stateBlend * 0.52;
        const ang  = fieldAngle(this.x, this.y, t);
        this.vx += Math.cos(ang) * 0.068 * slow;
        this.vy += Math.sin(ang) * 0.068 * slow;
        const d = 0.912 + stateBlend * 0.054;
        this.vx *= d; this.vy *= d;
        this.trail.push({x: this.x, y: this.y});
        if (this.trail.length > TAIL) this.trail.shift();
        this.x += this.vx * this.spd;
        this.y += this.vy * this.spd;
        if (this.life > this.maxL || this.x<-90 || this.x>W+90 || this.y<-90 || this.y>H+90) this.init(false);
    }
    draw() {
        if (this.trail.length < 3) return;
        const la = Math.min(1, this.life/50) * Math.min(1, (this.maxL-this.life)/50);
        const base = 0.22 + stateBlend * 0.14;
        for (let i=1; i<this.trail.length; i++) {
            const f = i / this.trail.length;
            ctx.beginPath();
            ctx.strokeStyle = particleColor(this.hv, f * la * base);
            ctx.lineWidth = f * this.sz * 1.4;
            ctx.lineCap = 'round';
            ctx.moveTo(this.trail[i-1].x, this.trail[i-1].y);
            ctx.lineTo(this.trail[i].x,   this.trail[i].y);
            ctx.stroke();
        }
    }
}

const particles = Array.from({length: MAX_P}, () => new Particle());


// ── BREATHING GLOW ────────────────────────────────────────────────
let breathPhase = 0;
function drawBreath() {
    const vis = Math.max(0, (stateBlend - 0.2) / 0.8);
    if (vis < 0.01) return;
    breathPhase += 0.0026;
    const pulse  = Math.pow(Math.sin(breathPhase)*0.5+0.5, 1.4);
    const radius = Math.min(W,H) * (0.20 + pulse*0.13);
    const alpha  = vis * 0.052 * (0.4 + pulse*0.6);
    const hue    = 38 + (1-stateBlend)*122;
    const g = ctx.createRadialGradient(W/2,H/2,0, W/2,H/2,radius);
    g.addColorStop(0,   `hsla(${hue},65%,62%,${alpha.toFixed(4)})`);
    g.addColorStop(0.5, `hsla(${hue},50%,42%,${(alpha*0.4).toFixed(4)})`);
    g.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.beginPath(); ctx.fillStyle = g;
    ctx.arc(W/2,H/2,radius,0,Math.PI*2); ctx.fill();
}

function drawVignette() {
    const str = 0.42 + stateBlend*0.22;
    const g = ctx.createRadialGradient(W/2,H/2,H*0.30, W/2,H/2,H*0.92);
    g.addColorStop(0,'rgba(0,0,0,0)');
    g.addColorStop(1,`rgba(2,4,6,${str.toFixed(3)})`);
    ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
}


// ── MAIN LOOP ─────────────────────────────────────────────────────
let t = 0;
function loop() {
    t += 0.003;
    updateState();
    const fade = 0.030 + (1-stateBlend)*0.030;
    ctx.fillStyle = `rgba(2,4,6,${fade.toFixed(4)})`;
    ctx.fillRect(0,0,W,H);
    const active = Math.floor(MAX_P * (0.72 + (1-stateBlend)*0.28));
    for (let i=0; i<active; i++) { particles[i].update(t); particles[i].draw(); }
    drawBreath();
    drawVignette();
    requestAnimationFrame(loop);
}
loop();
