// ── CONFIGURATION: FORMSPREE LINK ────────────────────────────────
// Copy your Formspree URL from your dashboard and paste it here.
// Example: "https://formspree.io/f/xbjnqypo"
const FORMSPREE_URL = "https://formspree.io/f/YOUR_ENDPOINT_ID";
// ──────────────────────────────────────────────────────────────────

const canvas   = document.getElementById('canvas');
const ctx      = canvas.getContext('2d');
const card     = document.getElementById('editor-card');
const textarea = document.getElementById('editor-textarea');
const hudState = document.getElementById('hud-state');
const hudSpeed = document.getElementById('hud-speed');
const hudIdle  = document.getElementById('hud-idle');
const shareBtn = document.getElementById('share-btn');
const aboutLink= document.getElementById('about-link');
const promptOverlay  = document.getElementById('prompt-overlay');
const promptQuestion = document.getElementById('prompt-question');
const promptChoices  = document.getElementById('prompt-choices');
const shareCard      = document.getElementById('share-card');
const promptComment  = document.getElementById('prompt-comment');

let W = 0, H = 0;
function resize() { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; }
window.addEventListener('resize', resize);
resize();

// ── SHARE MESSAGES ────────────────────────────────────────────────
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
async function doShare(btn) {
    const text = getShareText();
    try {
        if (navigator.share) { await navigator.share({ text }); }
        else {
            await navigator.clipboard.writeText(text);
            if (btn) { const o=btn.textContent; btn.textContent='Copied ✓'; setTimeout(()=>{btn.textContent=o;},2200); }
        }
    } catch(e) {}
}

// ── CYCLING EMOTIONAL PLACEHOLDERS (smooth fade) ──────────────────
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
let promptIdx = 0;
textarea.setAttribute('placeholder', PROMPTS[0]);

setInterval(() => {
    if (textarea.value.length > 0) return;
    // Fade out over 1.2s, swap text, fade back in
    textarea.classList.add('placeholder-fade');
    setTimeout(() => {
        promptIdx = (promptIdx + 1) % PROMPTS.length;
        textarea.setAttribute('placeholder', PROMPTS[promptIdx]);
        // small delay then fade back in
        setTimeout(() => { textarea.classList.remove('placeholder-fade'); }, 80);
    }, 1200);
}, 5000);

// ── INTERACTION SENSING ───────────────────────────────────────────
let lastActive  = Date.now();
let keyTimes    = [];
let cpm         = 0;
let promptShown = false;
let userTouched = false; // tracks if user ever typed

function recordActivity() {
    lastActive = Date.now();
    keyTimes.push(Date.now());
    userTouched = true;
}
textarea.addEventListener('input', recordActivity);
textarea.addEventListener('keydown', recordActivity);
document.getElementById('editor-title').addEventListener('input', recordActivity);

// Clicking the dimmed card bumps it to 60% and focuses textarea
card.addEventListener('click', () => {
    if (currentCardOpacity < 0.65) {
        // snap to 60% so they can see
        currentCardOpacity = 0.60;
        card.style.opacity = '0.60';
        textarea.focus();
    }
});

setInterval(() => {
    const now = Date.now();
    keyTimes = keyTimes.filter(t => now - t < 12000);
    cpm = Math.round(keyTimes.length * 5);
    const idle = Math.round((now - lastActive) / 1000);
    hudState.textContent = stateName.charAt(0).toUpperCase() + stateName.slice(1);
    hudSpeed.textContent = cpm;
    hudIdle.textContent  = idle + 's';
}, 600);

// UI elements fade in after 30s
setTimeout(() => {
    shareBtn.classList.add('visible');
    if (aboutLink) aboutLink.classList.add('visible');
}, 30000);

// 5-min prompt
setTimeout(() => {
    if (!promptShown) { promptShown = true; promptOverlay.classList.add('visible'); }
}, 5 * 60 * 1000);


// ── [START] FORMSPREE SUBMISSION UTILITY ──
let selectedChoice = "";

async function sendToFormspree(choice, comment) {
    if (!FORMSPREE_URL || FORMSPREE_URL.includes("YOUR_ENDPOINT_ID")) {
        console.log("Formspree URL not configured. Data is:", { choice, comment });
        return;
    }
    try {
        await fetch(FORMSPREE_URL, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json', 
                'Accept': 'application/json' 
            },
            body: JSON.stringify({
                feeling_choice: choice,
                user_comment: comment,
                typing_speed_cpm: cpm,
                sanctuary_state: stateName,
                timestamp: new Date().toISOString()
            })
        });
    } catch(e) {
        console.error("Formspree submit error:", e);
    }
}
// ── [END] FORMSPREE SUBMISSION UTILITY ──


// Prompt interactions
document.querySelectorAll('.prompt-choice-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        // Save the chosen emotion option
        selectedChoice = btn.textContent.trim();
        
        promptQuestion.style.display  = 'none';
        promptChoices.style.display   = 'none';
        promptComment.style.display   = 'flex';
    });
});

document.getElementById('btn-notsure').addEventListener('click', () => {
    selectedChoice = "Not Sure";
    promptQuestion.style.display = 'none';
    promptChoices.style.display  = 'none';
    
    // Submit straight to Formspree when skipped
    sendToFormspree(selectedChoice, "");
    
    shareCard.hidden = false;
});

document.getElementById('btn-submit-comment').addEventListener('click', () => {
    // Find text inside the comment field (works with input or textarea)
    const commentField = promptComment.querySelector('textarea') || promptComment.querySelector('input') || document.getElementById('comment-input');
    const commentText = commentField ? commentField.value.trim() : "";
    
    promptComment.style.display = 'none';
    
    // Submit choice and comment together
    sendToFormspree(selectedChoice, commentText);
    
    shareCard.hidden = false;
});

document.getElementById('btn-dismiss').addEventListener('click', () => {
    promptOverlay.classList.remove('visible');
});
document.getElementById('btn-copy-link').addEventListener('click', async function() {
    const text = getShareText();
    await navigator.clipboard.writeText(text);
    this.textContent = 'Copied ✓';
    setTimeout(() => { this.textContent = 'Copy link'; }, 2200);
});
document.getElementById('btn-native-share').addEventListener('click', function() { doShare(this); });
shareBtn.addEventListener('click', () => doShare(shareBtn));

// ── STATE ENGINE ──────────────────────────────────────────────────
let stateBlend         = 0;
let targetBlend        = 0;
let stateName          = 'flow';
let currentCardOpacity = 1.0;

function updateState() {
    const idle = (Date.now() - lastActive) / 1000;

    if (idle > 18)                  targetBlend = 1.0;
    else if (idle > 8 || cpm < 30) targetBlend = 0.5;
    else if (cpm > 160)             targetBlend = 0.0;
    else targetBlend = Math.max(0, Math.min(0.5, 0.5 - (cpm - 30) / 260));

    let targetCard = idle > 18 ? 0.05 : idle > 8 ? 0.52 : 1.0;
    const waking   = targetCard > currentCardOpacity;

    currentCardOpacity += (targetCard - currentCardOpacity) * (waking ? 0.10 : 0.014);
    stateBlend         += (targetBlend - stateBlend)        * (waking ? 0.06 : 0.010);

    card.style.opacity     = currentCardOpacity.toFixed(4);
    card.style.transform   = stateBlend < 0.25 ? 'scale(1)' : stateBlend < 0.70 ? 'scale(0.990)' : 'scale(0.982)';
    card.style.background  = stateBlend < 0.25 ? 'rgba(8,12,18,0.60)' : stateBlend < 0.70 ? 'rgba(8,12,18,0.36)' : 'rgba(5,8,12,0.10)';
    card.style.borderColor = stateBlend < 0.25 ? 'rgba(255,255,255,0.07)' : stateBlend < 0.70 ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.012)';

    if      (stateBlend < 0.25) stateName = 'flow';
    else if (stateBlend < 0.70) stateName = 'drift';
    else                         stateName = 'restore';
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

// ── [START] GOLDEN EMBERS COLOR PALETTE ──
function particleColor(hv, alpha) {
    let h = stateBlend < 0.5
        ? 210 + (165 - 210) * (stateBlend / 0.5)
        : 165 + (38  - 165) * ((stateBlend - 0.5) / 0.5);
    h += hv * 14 - 7;

    // Saturation and Lightness values are boosted in the Restore state (stateBlend = 1.0)
    // This makes the particles look like warm golden embers instead of dull grey ash
    const sat = stateBlend < 0.5 
        ? (72 - stateBlend * 16) 
        : (56 + (88 - 56) * ((stateBlend - 0.5) / 0.5)); 
        
    const light = stateBlend < 0.5 
        ? (52 + stateBlend * 10) 
        : (62 + (74 - 62) * ((stateBlend - 0.5) / 0.5)); 

    return `hsla(${h.toFixed(1)},${sat.toFixed(1)}%,${light.toFixed(1)}%,${alpha.toFixed(4)})`;
}
// ── [END] GOLDEN EMBERS COLOR PALETTE ──

// ── PARTICLES ─────────────────────────────────────────────────────
const MAX_P = 800, TAIL = 32;
class Particle {
    constructor() { this.init(true); }
    
    // ── [START] ALL-EDGE PARTICLE SPAWNER ──
    init(s) {
        if (s) {
            this.x = Math.random() * W;
            this.y = Math.random() * H;
        } else {
            // Pick a random screen edge to spawn from (Left, Right, Top, or Bottom)
            const edge = Math.floor(Math.random() * 4);
            if (edge === 0) { this.x = -15; this.y = Math.random() * H; }      // Left
            else if (edge === 1) { this.x = W + 15; this.y = Math.random() * H; } // Right
            else if (edge === 2) { this.x = Math.random() * W; this.y = -15; }   // Top
            else { this.x = Math.random() * W; this.y = H + 15; }                  // Bottom
        }
        this.vx=0; this.vy=0;
        this.spd=(0.5+Math.random()*0.7)*(1-stateBlend*0.45);
        this.life=0; this.maxL=240+Math.random()*420;
        this.hv=Math.random(); this.sz=0.6+Math.random()*1.4;
        this.trail=[];
    }
    // ── [END] ALL-EDGE PARTICLE SPAWNER ──
    
    update(t) {
        this.life++;
        const slow=1-stateBlend*0.52;
        const ang=fieldAngle(this.x,this.y,t);
        this.vx+=Math.cos(ang)*0.068*slow;
        this.vy+=Math.sin(ang)*0.068*slow;

        // ── [START] UNIFIED RADIAL BREATHING PULSE ──
        if (stateBlend > 0.1) {
            // Target is the wandering glow center
            const cx = W / 2 + glowOffsetX;
            const cy = H / 2 + glowOffsetY;
            
            const dx = cx - this.x;
            const dy = cy - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            
            // Normalize direction vector away from center
            const ndx = dx / dist;
            const ndy = dy / dist;
            
            // Use the cosine of breathPhase (which represents expansion/contraction)
            // Positive is breathing out (expansion), negative is breathing in (contraction)
            const breathForce = Math.cos(breathPhase) * 0.024 * stateBlend;
            
            this.vx += ndx * breathForce;
            this.vy += ndy * breathForce;
        }
        // ── [END] UNIFIED RADIAL BREATHING PULSE ──

        const d=0.912+stateBlend*0.054;
        this.vx*=d; this.vy*=d;
        this.trail.push({x:this.x,y:this.y});
        if(this.trail.length>TAIL) this.trail.shift();
        this.x+=this.vx*this.spd; this.y+=this.vy*this.spd;
        if(this.life>this.maxL||this.x<-90||this.x>W+90||this.y<-90||this.y>H+90) this.init(false);
    }
    
    // ── [START] BREATHING SIZE AND BRIGHTNESS PULSE ──
    draw() {
        if(this.trail.length<3) return;
        const la=Math.min(1,this.life/50)*Math.min(1,(this.maxL-this.life)/50);
        
        // Let particle brightness and width pulse in sync with the global chest inhale/exhale
        const pulseEffect = 1.0 + stateBlend * (currentPulse * 0.35 - 0.175); 
        const base = (0.22 + stateBlend * 0.14) * pulseEffect;
        
        for(let i=1;i<this.trail.length;i++){
            const f=i/this.trail.length;
            ctx.beginPath();
            ctx.strokeStyle=particleColor(this.hv,f*la*base);
            
            // Size also expands and contracts with breath
            ctx.lineWidth=f*this.sz*1.4 * (1.0 + stateBlend * (currentPulse * 0.3 - 0.15)); 
            ctx.lineCap='round';
            ctx.moveTo(this.trail[i-1].x,this.trail[i-1].y);
            ctx.lineTo(this.trail[i].x,this.trail[i].y);
            ctx.stroke();
        }
    }
    // ── [END] BREATHING SIZE AND BRIGHTNESS PULSE ──
}
const particles=Array.from({length:MAX_P},()=>new Particle());

// ── BREATHING GLOW — softer, more natural, less hypnotic ─────────
// Key fix: glow stays off-centre slightly, slower pulse, lower alpha
// This makes it feel like sunlight through leaves, not a spotlight
let breathPhase = 0;
let currentPulse = 0; // global variable to share with particles
let glowOffsetX = 0, glowOffsetY = 0, glowTargetX = 0, glowTargetY = 0;

// Glow wanders slowly so it never feels static or centred like a vortex
setInterval(() => {
    glowTargetX = (Math.random() - 0.5) * W * 0.12;
    glowTargetY = (Math.random() - 0.5) * H * 0.10;
}, 6000);

function drawBreath() {
    const vis = Math.max(0, (stateBlend - 0.2) / 0.8);
    if (vis < 0.01) return;

    // Drift glow position slowly
    glowOffsetX += (glowTargetX - glowOffsetX) * 0.002;
    glowOffsetY += (glowTargetY - glowOffsetY) * 0.002;

    // Softer: smaller radius, lower max alpha
    const radius = Math.min(W, H) * (0.16 + currentPulse * 0.09);
    const alpha  = vis * 0.038 * (0.3 + currentPulse * 0.7); // max ~0.038, much softer

    const cx = W / 2 + glowOffsetX;
    const cy = H / 2 + glowOffsetY;
    const hue = 38 + (1 - stateBlend) * 122;

    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    g.addColorStop(0,   `hsla(${hue},60%,58%,${alpha.toFixed(4)})`);
    g.addColorStop(0.4, `hsla(${hue},48%,40%,${(alpha*0.35).toFixed(4)})`);
    g.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.beginPath(); ctx.fillStyle=g;
    ctx.arc(cx, cy, radius, 0, Math.PI*2); ctx.fill();
}

function drawVignette() {
    const str=0.42+stateBlend*0.22;
    const g=ctx.createRadialGradient(W/2,H/2,H*0.30,W/2,H/2,H*0.92);
    g.addColorStop(0,'rgba(0,0,0,0)');
    g.addColorStop(1,`rgba(2,4,6,${str.toFixed(3)})`);
    ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
}

// ── MAIN LOOP ─────────────────────────────────────────────────────
let t = 0;
function loop() {
    t += 0.003;
    
    // ── [START] GLOBAL BREATHING UPDATE ──
    breathPhase += 0.0018; // slower — ~6s cycle
    currentPulse = Math.pow(Math.sin(breathPhase) * 0.5 + 0.5, 1.6);
    // ── [END] GLOBAL BREATHING UPDATE ──

    updateState();
    const fade=0.030+(1-stateBlend)*0.030;
    ctx.fillStyle=`rgba(2,4,6,${fade.toFixed(4)})`;
    ctx.fillRect(0,0,W,H);
    const active=Math.floor(MAX_P*(0.72+(1-stateBlend)*0.28));
    for(let i=0;i<active;i++){particles[i].update(t);particles[i].draw();}
    drawBreath();
    drawVignette();
    requestAnimationFrame(loop);
}
loop();
