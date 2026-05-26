// ── CONFIGURATION: CREDENTIALS ────────────────────────────────────
// Paste your Supabase project URL and API key below
const SUPABASE_URL = "https://uwaclfeptosaterfimqn.supabase.co";
const SUPABASE_KEY = "sb_publishable_3t70TIXLzaJTj1CngUDVzQ_yOQ91uHw";

// Paste your Formspree URL from your dashboard below
const FORMSPREE_URL = "https://formspree.io/f/YOUR_ENDPOINT_ID";
// ──────────────────────────────────────────────────────────────────

// ── GLOBAL STATE VARIABLES (Moved to top to prevent ReferenceErrors) ──
let stateBlend         = 0;
let targetBlend        = 0;
let stateName          = 'flow';
let currentCardOpacity = 1.0;

let lastActive  = Date.now();
let keyTimes    = [];
let cpm         = 0;
let promptShown = false;
let userTouched = false;

// Glow & Breath variables
let breathPhase = 0;
let glowOffsetX = 0, glowOffsetY = 0, glowTargetX = 0, glowTargetY = 0;

// Mouse tracking variables
let mouseX = -1000, mouseY = -1000;
let lastMouseX = -1000, lastMouseY = -1000;
let lastMouseMoveTime = Date.now();
let mouseSpeed = 0;
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

// ── [START] DEVICE, SESSION & METRIC SIGNALS ──────────────────────
let deviceId = localStorage.getItem("device_id");
if (!deviceId) {
    deviceId = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : 'dev-' + Math.random().toString(36).substring(2, 15);
    localStorage.setItem("device_id", deviceId);
}

let visits = Number(localStorage.getItem("visits") || 0) + 1;
localStorage.setItem("visits", visits);

const sessionStart = Date.now();
const sessionId = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : 'sess-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);

// V2 Signals
const referrer = document.referrer || "direct";
const device_type = 
  /iPad|Tablet/i.test(navigator.userAgent) ? "tablet" :
  /Mobi|Android/i.test(navigator.userAgent) ? "mobile" :
  "desktop";

// Insert the initial session row on page load (Write 1 of 2)
async function startSession() {
    console.log("START SESSION RUNNING");

    if (!SUPABASE_URL || !SUPABASE_KEY) {
        console.log("Missing Supabase credentials");
        return;
    }

    const payload = {
        session_id: sessionId,
        device_id: deviceId,
        visits: visits,
        session_start: sessionStart,
        session_duration: 0,
        screen_w: window.innerWidth,
        screen_h: window.innerHeight,
        referrer: referrer,
        device_type: device_type,
        emotion_tag: null
    };

    console.log("SENDING DATA:", payload);

    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/sessions`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "apikey": SUPABASE_KEY,
                "Authorization": `Bearer ${SUPABASE_KEY}`,
                "Prefer": "return=representation"
            },
            body: JSON.stringify(payload)
        });

        console.log("STATUS:", response.status);

        const text = await response.text();
        console.log("SUPABASE RESPONSE:", text);

    } catch (e) {
        console.error("SUPABASE ERROR:", e);
    }
}

// Update the final session duration on exit (Write 2 of 2)
async function endSession() {
    if (!SUPABASE_URL || !SUPABASE_KEY) return;
    const sessionDuration = Date.now() - sessionStart;
    try {
        await fetch(`${SUPABASE_URL}/rest/v1/sessions?session_id=eq.${sessionId}`, {
            method: "PATCH",
            keepalive: true, // Guarantees execution on tab close
            headers: {
                "Content-Type": "application/json",
                "apikey": SUPABASE_KEY,
                "Authorization": `Bearer ${SUPABASE_KEY}`,
                "Prefer": "return=minimal"
            },
            body: JSON.stringify({
                session_duration: sessionDuration
            })
        });
    } catch (e) {
        console.error("Supabase session update error:", e);
    }
}

// V3 Signal: Update the Supabase record when user selects a feeling
async function updateSessionEmotion(tag) {
    if (!SUPABASE_URL || !SUPABASE_KEY) return;
    try {
        await fetch(`${SUPABASE_URL}/rest/v1/sessions?session_id=eq.${sessionId}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                "apikey": SUPABASE_KEY,
                "Authorization": `Bearer ${SUPABASE_KEY}`,
                "Prefer": "return=minimal"
            },
            body: JSON.stringify({
                emotion_tag: tag
            })
        });
    } catch (e) {
        console.error("Supabase emotion update error:", e);
    }
}

// Run session tracking
startSession();

// Exit listeners (no database spam)
let sessionEnded = false;

function safeEndSession() {
    if (sessionEnded) return;
    sessionEnded = true;
    endSession();
}

// Fixed syntax layout block here
window.addEventListener("pagehide", safeEndSession);
window.addEventListener("beforeunload", safeEndSession);
document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
        safeEndSession();
    }
});
// ── [END] DEVICE, SESSION & METRIC SIGNALS ────────────────────────


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

// ── INTERACTION SENSING & TYPING DISSOLVE ──────────────────────────
function recordActivity() {
    lastActive = Date.now();
    keyTimes.push(Date.now());
    userTouched = true;
}

// ── [START] TEXT-TO-PARTICLES SYSTEM ──
const textParticles = [];

class TextParticle {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        // Start rising, floating slightly outwards
        this.vx = (Math.random() - 0.5) * 1.4;
        this.vy = -Math.random() * 1.5 - 0.4;
        this.spd = (0.6 + Math.random() * 0.6) * (1 - stateBlend * 0.35);
        this.life = 0;
        this.maxL = 100 + Math.random() * 120;
        this.hv = Math.random();
        this.sz = 0.8 + Math.random() * 1.2;
        this.trail = [];
    }
    update(t) {
        this.life++;
        
        // Start by rising, then smoothly blend into the wind flow field
        const windWeight = Math.min(1, this.life / 25);
        const windAng = fieldAngle(this.x, this.y, t);
        const windVx = Math.cos(windAng) * 0.068 * (1 - stateBlend * 0.52);
        const windVy = Math.sin(windAng) * 0.068 * (1 - stateBlend * 0.52);

        this.vx = this.vx * (1 - windWeight * 0.06) + windVx * windWeight;
        this.vy = this.vy * (1 - windWeight * 0.06) + windVy * windWeight;

        // Jitter drift
        const jitter = 0.01 + stateBlend * 0.015;
        this.vx += (Math.random() - 0.5) * jitter;
        this.vy += (Math.random() - 0.5) * jitter;

        // Thermal lift in restore state
        if (stateBlend > 0.5) {
            const lift = (stateBlend - 0.5) * 2;
            this.vy -= 0.006 * lift;
        }

        const d = 0.912 + stateBlend * 0.054;
        this.vx *= d; this.vy *= d;
        
        this.trail.push({x: this.x, y: this.y});
        if (this.trail.length > 24) this.trail.shift();
        
        this.x += this.vx * this.spd;
        this.y += this.vy * this.spd;
    }
    draw() {
        if (this.trail.length < 3) return;
        const la = Math.min(1, this.life / 20) * Math.min(1, (this.maxL - this.life) / 30);
        const base = (0.28 + stateBlend * 0.12) * la;
        for (let i = 1; i < this.trail.length; i++) {
            const f = i / this.trail.length;
            ctx.beginPath();
            ctx.strokeStyle = particleColor(this.hv, f * base);
            ctx.lineWidth = f * this.sz * 1.4;
            ctx.lineCap = 'round';
            ctx.moveTo(this.trail[i-1].x, this.trail[i-1].y);
            ctx.lineTo(this.trail[i].x, this.trail[i].y);
            ctx.stroke();
        }
    }
}

function handleTypingSensing(e) {
    recordActivity();

    // Spawn visual text particles inside the card notepad area
    if (textParticles.length < 250) {
        const rect = textarea.getBoundingClientRect();
        const spawnX = rect.left + Math.random() * rect.width;
        const spawnY = rect.top + Math.random() * rect.height;
        
        for (let i = 0; i < 3; i++) {
            textParticles.push(new TextParticle(spawnX, spawnY));
        }
    }
}

textarea.addEventListener('input', handleTypingSensing);
textarea.addEventListener('keydown', handleTypingSensing);
document.getElementById('editor-title').addEventListener('input', handleTypingSensing);

// ── [START] 3-SECOND TEXT DISSOLVE SYSTEM ──
// Deletes text character-by-character if idle for 3 seconds, releasing particles
setInterval(() => {
    const idle = (Date.now() - lastActive) / 1000;
    if (idle >= 3 && textarea.value.length > 0) {
        const text = textarea.value;
        textarea.value = text.slice(0, -1);
        
        const rect = textarea.getBoundingClientRect();
        const spawnX = rect.left + Math.random() * rect.width;
        const spawnY = rect.bottom - 20; // Dissolves near the bottom line
        
        for (let i = 0; i < 3; i++) {
            textParticles.push(new TextParticle(spawnX, spawnY));
        }
        
        // Reset placeholders if text is fully cleared
        if (textarea.value.length === 0) {
            textarea.dispatchEvent(new Event('input'));
        }
    }
}, 60);
// ── [END] 3-SECOND TEXT DISSOLVE SYSTEM ──


// ── [START] SLOW MOUSE INTERACTION SENSING ──
window.addEventListener('mousemove', (e) => {
    const now = Date.now();
    const dt = now - lastMouseMoveTime || 1;
    lastMouseMoveTime = now;
    
    mouseX = e.clientX;
    mouseY = e.clientY;
    
    if (lastMouseX !== -1000) {
        const dx = mouseX - lastMouseX;
        const dy = mouseY - lastMouseY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        mouseSpeed = dist / dt; // pixels per millisecond
    }
    
    lastMouseX = mouseX;
    lastMouseY = mouseY;
    
    // Register activity on mouse move to reset idle timers
    recordActivity();
});
// ── [END] SLOW MOUSE INTERACTION SENSING ──


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

async function sendToFormspree(choice, comment = "") {
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


// ── [START] OPTION A: DIRECT INTERACTION FUNNEL ──
// Prompt interactions
document.querySelectorAll('.prompt-choice-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        selectedChoice = btn.textContent.trim();
        promptQuestion.style.display  = 'none';
        promptChoices.style.display   = 'none';
        
        // 1. Submit selection to Formspree
        sendToFormspree(selectedChoice, "");
        
        // 2. ALSO update the Supabase session row with the emotion selected
        updateSessionEmotion(selectedChoice);
        
        // Show share card
        shareCard.hidden = false;
    });
});

document.getElementById('btn-notsure').addEventListener('click', () => {
    selectedChoice = "Not Sure";
    promptQuestion.style.display = 'none';
    promptChoices.style.display  = 'none';
    
    // Submit to Formspree and Supabase
    sendToFormspree(selectedChoice, "");
    updateSessionEmotion(selectedChoice);
    
    shareCard.hidden = false;
});
// ── [END] OPTION A: DIRECT INTERACTION FUNNEL ──


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

// ── ORIGINAL BLUE -> GREEN -> ORANGE THEME RETAINED ──────────────────
function particleColor(hv, alpha) {
    let h = stateBlend < 0.5
        ? 210 + (165 - 210) * (stateBlend / 0.5)
        : 165 + (38  - 165) * ((stateBlend - 0.5) / 0.5);
    h += hv * 14 - 7;
    return `hsla(${h.toFixed(1)},${(72-stateBlend*16).toFixed(1)}%,${(52+stateBlend*10).toFixed(1)}%,${alpha.toFixed(4)})`;
}

// ── PARTICLES ─────────────────────────────────────────────────────
const MAX_P = 800, TAIL = 32;
class Particle {
    constructor() { this.init(true); }
    
    // ── ALL-EDGE PARTICLE SPAWNER ──
    init(s) {
        if (s) {
            this.x = Math.random() * W;
            this.y = Math.random() * H;
        } else {
            const edge = Math.floor(Math.random() * 4);
            if (edge === 0) { this.x = -15; this.y = Math.random() * H; }      
            else if (edge === 1) { this.x = W + 15; this.y = Math.random() * H; } 
            else if (edge === 2) { this.x = Math.random() * W; this.y = -15; }   
            else { this.x = Math.random() * W; this.y = H + 15; }                  
        }
        this.vx=0; this.vy=0;
        this.spd=(0.5+Math.random()*0.7)*(1-stateBlend*0.45);
        this.life=0; this.maxL=240+Math.random()*420;
        this.hv=Math.random(); this.sz=0.6+Math.random()*1.4;
        this.trail=[];
    }
    
    update(t) {
        this.life++;
        const slow=1-stateBlend*0.52;
        const ang=fieldAngle(this.x,this.y,t);
        this.vx+=Math.cos(ang)*0.068*slow;
        this.vy+=Math.sin(ang)*0.068*slow;

        // ── OLD-SCHOOL CHAOTIC PARTICLE DRIFT ──
        const jitter = 0.01 + stateBlend * 0.015;
        this.vx += (Math.random() - 0.5) * jitter;
        this.vy += (Math.random() - 0.5) * jitter;

        if (stateBlend > 0.5) {
            const lift = (stateBlend - 0.5) * 2;
            this.vy -= 0.006 * lift; 
        }

        // ── [START] GENTLE MOUSE INTERACTION (SLOW MOVE ONLY) ──
        if (mouseX !== -1000 && mouseSpeed < 0.8) {
            const mdx = this.x - mouseX;
            const mdy = this.y - mouseY;
            const mdist = Math.sqrt(mdx * mdx + mdy * mdy) || 1;
            if (mdist < 120) {
                // Slower mouse movements create a stronger, gentler push
                const force = (1 - mdist / 120) * 0.14 * (1 - mouseSpeed);
                this.vx += (mdx / mdist) * force;
                this.vy += (mdy / mdist) * force;
            }
        }
        // ── [END] GENTLE MOUSE INTERACTION (SLOW MOVE ONLY) ──

        const d=0.912+stateBlend*0.054;
        this.vx*=d; this.vy*=d;
        this.trail.push({x:this.x,y:this.y});
        if(this.trail.length>TAIL) this.trail.shift();
        this.x+=this.vx*this.spd; this.y+=this.vy*this.spd;
        if(this.life>this.maxL||this.x<-90||this.x>W+90||this.y<-90||this.y>H+90) this.init(false);
    }
    
    draw() {
        if(this.trail.length<3) return;
        const la=Math.min(1,this.life/50)*Math.min(1,(this.maxL-this.life)/50);
        const base=0.22+stateBlend*0.14;
        for(let i=1;i<this.trail.length;i++){
            const f=i/this.trail.length;
            ctx.beginPath();
            ctx.strokeStyle=particleColor(this.hv,f*la*base);
            ctx.lineWidth=f*this.sz*1.4; ctx.lineCap='round';
            ctx.moveTo(this.trail[i-1].x,this.trail[i-1].y);
            ctx.lineTo(this.trail[i].x,this.trail[i].y);
            ctx.stroke();
        }
    }
}
const particles=Array.from({length:MAX_P},()=>new Particle());

// ── BREATHING GLOW ────────────────────────────────────────────────
function drawBreath() {
    const vis = Math.max(0, (stateBlend - 0.2) / 0.8);
    if (vis < 0.01) return;

    glowOffsetX += (glowTargetX - glowOffsetX) * 0.002;
    glowOffsetY += (glowTargetY - glowOffsetY) * 0.002;

    breathPhase += 0.0018; 
    const pulse  = Math.pow(Math.sin(breathPhase) * 0.5 + 0.5, 1.6);

    const radius = Math.min(W, H) * (0.16 + pulse * 0.09);
    const alpha  = vis * 0.038 * (0.3 + pulse * 0.7); 

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
    updateState();
    const fade=0.030+(1-stateBlend)*0.030;
    ctx.fillStyle=`rgba(2,4,6,${fade.toFixed(4)})`;
    ctx.fillRect(0,0,W,H);
    
    const active=Math.floor(MAX_P*(0.72+(1-stateBlend*0.28)));
    for(let i=0;i<active;i++){particles[i].update(t);particles[i].draw();}
    
    // ── [START] UPDATE & DRAW TYPED TEXT PARTICLES ──
    for (let i = textParticles.length - 1; i >= 0; i--) {
        const tp = textParticles[i];
        tp.update(t);
        tp.draw();
        if (tp.life > tp.maxL || tp.x < -90 || tp.x > W + 90 || tp.y < -90 || tp.y > H + 90) {
            textParticles.splice(i, 1);
        }
    }
    // ── [END] UPDATE & DRAW TYPED TEXT PARTICLES ──
    
    drawBreath();
    drawVignette();
    requestAnimationFrame(loop);
}
loop();
