// ── CONFIGURATION: CREDENTIALS ────────────────────────────────────
const SUPABASE_URL = "https://uwaclfeptosaterfimqn.supabase.co";
const SUPABASE_KEY = "sb_publishable_3t70TIXLzaJTj1CngUDVzQ_yOQ91uHw";
const FORMSPREE_URL = "https://formspree.io/f/YOUR_ENDPOINT_ID";
// ──────────────────────────────────────────────────────────────────

// ── GLOBAL STATE (top to prevent hoisting errors) ─────────────────
let stateBlend         = 0;
let targetBlend        = 0;
let stateName          = 'flow';
let isTyping = false;
let typingCooldownTimer = null;
let currentCardOpacity = 0.7; // starts invisible, wakes on first keypress

// Separate timers: typing only vs general
let lastTyped  = Date.now(); // only keyboard input
let keyTimes   = [];
let cpm        = 0;
let promptShown = false;
let userTouched = false;
let spaceHeld   = false;    // spacebar hold tracking

// Glow & breath
let breathPhase = 0;
let glowOffsetX = 0, glowOffsetY = 0, glowTargetX = 0, glowTargetY = 0;

// Mouse — tracked separately, never affects card
let mouseX = -9999, mouseY = -9999;
let lastMouseX = -9999, lastMouseY = -9999;
let lastMouseTime = Date.now();
let mouseSpeed = 0; // px per ms
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

// ── SESSION TRACKING ──────────────────────────────────────────────
let deviceId = localStorage.getItem("device_id");
if (!deviceId) {
    deviceId = typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : 'dev-' + Math.random().toString(36).substring(2, 15);
    localStorage.setItem("device_id", deviceId);
}
let visits = Number(localStorage.getItem("visits") || 0) + 1;
localStorage.setItem("visits", visits);

const sessionStart = Date.now();
const sessionId = typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : 'sess-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);

const referrer = document.referrer || "direct";
const device_type =
    /iPad|Tablet/i.test(navigator.userAgent) ? "tablet" :
    /Mobi|Android/i.test(navigator.userAgent) ? "mobile" : "desktop";

async function startSession() {
    if (!SUPABASE_URL || !SUPABASE_KEY) return;
    try {
        await fetch(`${SUPABASE_URL}/rest/v1/sessions`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}`, "Prefer": "return=representation" },
            body: JSON.stringify({ session_id: sessionId, device_id: deviceId, visits, session_start: sessionStart, session_duration: 0, screen_w: window.innerWidth, screen_h: window.innerHeight, referrer, device_type, emotion_tag: null })
        });
    } catch(e) { console.error("Supabase start:", e); }
}
async function endSession() {
    if (!SUPABASE_URL || !SUPABASE_KEY) return;
    try {
        await fetch(`${SUPABASE_URL}/rest/v1/sessions?session_id=eq.${sessionId}`, {
            method: "PATCH", keepalive: true,
            headers: { "Content-Type": "application/json", "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}`, "Prefer": "return=minimal" },
            body: JSON.stringify({ session_duration: Date.now() - sessionStart })
        });
    } catch(e) {}
}
async function updateSessionEmotion(tag) {
    if (!SUPABASE_URL || !SUPABASE_KEY) return;
    try {
        await fetch(`${SUPABASE_URL}/rest/v1/sessions?session_id=eq.${sessionId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}`, "Prefer": "return=minimal" },
            body: JSON.stringify({ emotion_tag: tag })
        });
    } catch(e) {}
}
startSession();
let sessionEnded = false;
function safeEndSession() { if(sessionEnded) return; sessionEnded=true; endSession(); }
window.addEventListener("pagehide", safeEndSession);
window.addEventListener("beforeunload", safeEndSession);
document.addEventListener("visibilitychange", () => { if(document.visibilityState==="hidden") safeEndSession(); });
// ── END SESSION TRACKING ──────────────────────────────────────────


// ── SHARE ─────────────────────────────────────────────────────────
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
    return `${SHARE_MESSAGES[Math.floor(Math.random()*SHARE_MESSAGES.length)]}\nhttps://my-projects-spacelab.github.io/living-digital-sanctuary/`;
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

// ── CYCLING PLACEHOLDERS ──────────────────────────────────────────
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
    textarea.classList.add('placeholder-fade');
    setTimeout(() => {
        promptIdx = (promptIdx + 1) % PROMPTS.length;
        textarea.setAttribute('placeholder', PROMPTS[promptIdx]);
        setTimeout(() => textarea.classList.remove('placeholder-fade'), 80);
    }, 1200);
}, 5000);


// ── NOISE & FIELD (must be above Particle classes) ────────────────
let t = 0;
function smoothNoise(x, y, t) {
    const a = Math.sin(x*0.011 + t*0.17) * Math.cos(y*0.009 + t*0.12);
    const b = Math.sin(x*0.022 - y*0.016 + t*0.10) * 0.48;
    const c = Math.cos(x*0.007 + y*0.012 - t*0.065) * 0.33;
    return (a + b + c) / 1.81;
}
function fieldAngle(x, y, t) {
    const speed = 1.0 - stateBlend * 0.55;
    const n1 = smoothNoise(x, y, t * speed);
    const n2 = smoothNoise(x*1.5, y*1.5, t*speed*0.65 + 8);
    return n1 * Math.PI * 1.9 + n2 * Math.PI * 0.55;
}
// ── BLUE → GREEN → ORANGE COLOR ──────────────────────────────────
function particleColor(hv, alpha) {
    let h = stateBlend < 0.5
        ? 210 + (165 - 210) * (stateBlend / 0.5)
        : 165 + (38  - 165) * ((stateBlend - 0.5) / 0.5);
    h += hv * 14 - 7;
    return `hsla(${h.toFixed(1)},${(72-stateBlend*16).toFixed(1)}%,${(52+stateBlend*10).toFixed(1)}%,${alpha.toFixed(4)})`;
}


// ── TEXT DISSOLVE PARTICLES ───────────────────────────────────────
const textParticles = [];

class TextParticle {
    constructor(x, y) {
        this.x = x + (Math.random()-0.5)*30;
        this.y = y + (Math.random()-0.5)*18;
        // Start with random burst direction, then blend into wind
        const angle = Math.random() * Math.PI * 2;
        const speed = 0.8 + Math.random() * 1.6;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed - 0.6; // slight upward bias
        this.spd = 0.5 + Math.random() * 0.5;
        this.life = 0;
        this.maxL = 80 + Math.random() * 100;
        this.hv   = Math.random();
        this.sz   = 0.5 + Math.random() * 1.0;
        this.trail = [];
        // Each particle blends into wind at different rates — makes it unpredictable
        this.windRate = 0.02 + Math.random() * 0.05;
    }
    update() {
        this.life++;
        // Gradually hand off to the ambient wind field — each particle at its own pace
        const w = Math.min(1, this.life * this.windRate);
        const ang  = fieldAngle(this.x, this.y, t);
        const wxv  = Math.cos(ang) * 0.068 * (1-stateBlend*0.52);
        const wyv  = Math.sin(ang) * 0.068 * (1-stateBlend*0.52);
        this.vx = this.vx*(1-w*0.08) + wxv*w*0.08;
        this.vy = this.vy*(1-w*0.08) + wyv*w*0.08;
        this.vx += (Math.random()-0.5)*0.012;
        this.vy += (Math.random()-0.5)*0.012;
        if(stateBlend>0.5) this.vy -= 0.005*(stateBlend-0.5)*2;
        const d = 0.912 + stateBlend*0.054;
        this.vx*=d; this.vy*=d;
        this.trail.push({x:this.x, y:this.y});
        if(this.trail.length>18) this.trail.shift();
        this.x += this.vx*this.spd;
        this.y += this.vy*this.spd;
    }
    draw() {
        if(this.trail.length<2) return;
        const la = Math.min(1, this.life/15) * Math.min(1, (this.maxL-this.life)/25);
        const base = (0.32+stateBlend*0.10)*la;
        for(let i=1;i<this.trail.length;i++){
            const f = i/this.trail.length;
            ctx.beginPath();
            ctx.strokeStyle = particleColor(this.hv, f*base);
            ctx.lineWidth   = f*this.sz*1.2;
            ctx.lineCap     = 'round';
            ctx.moveTo(this.trail[i-1].x, this.trail[i-1].y);
            ctx.lineTo(this.trail[i].x,   this.trail[i].y);
            ctx.stroke();
        }
    }
    isDead() {
        return this.life>this.maxL || this.x<-90||this.x>W+90||this.y<-90||this.y>H+90;
    }
}

// Spawn a burst of particles at a position
function spawnBurst(x, y, count) {
    if(textParticles.length >= 350) return;
    for(let i=0;i<count;i++) textParticles.push(new TextParticle(x, y));
}

// ── [START] TEXT DISSOLVE SYSTEM (INDEX-BASED SNAPSHOT ENGINE) ──

let dissolveActive = false;
let dissolveTimer = null;

let dissolveSnapshot = "";
let dissolveQueue = [];

// ── IDLE CHECK ────────────────────────────────────────────────────
let idleCheckInterval = setInterval(() => {
    const idleSec = isTyping ? 0 : (Date.now() - lastTyped) / 1000;
    const now = Date.now();

const timeSinceTyped = now - lastTyped;
const hasText = textarea.value.trim().length > 0;

const isTrulySettled =
    timeSinceTyped > 4000 &&   // longer delay = removes false pauses
    !isTyping &&
    cpm < 35;                  // prevents active thinking states

if (isTrulySettled && !dissolveActive && hasText) {
    startDissolve();
}

// ── BUILD WORD QUEUE (INDEXED SNAPSHOT) ──────────────────────────
function buildDissolveQueue(text) {
    const words = [];
    const regex = /\S+\s*/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
        words.push({
            text: match[0],
            start: match.index,
            len: match[0].length
        });
    }

    return words;
}


// ── START DISSOLVE ───────────────────────────────────────────────
function startDissolve() {
    if (dissolveActive) return;

    const text = textarea.value;
    if (!text.trim()) return;

    dissolveActive = true;

    // SNAPSHOT (freeze once)
    dissolveSnapshot = text;

    // build indexed queue once
    dissolveQueue = buildDissolveQueue(dissolveSnapshot);

    runNextDissolve();
}


// ── RUN ONE DISSOLVE STEP ─────────────────────────────────────────
function runNextDissolve() {
    if (!dissolveActive) return;

    // stop condition
    if (dissolveQueue.length === 0 || !dissolveSnapshot.trim()) {
        dissolveActive = false;
        textarea.value = "";
        return;
    }

    // pick random WORD INDEX
    const pickIndex = Math.floor(Math.random() * dissolveQueue.length);
    const pick = dissolveQueue[pickIndex];

    const textBefore = dissolveSnapshot;

    // get position for particles (approx visual randomness)
    const rect = textarea.getBoundingClientRect();

    spawnBurst(
        rect.left + Math.random() * rect.width,
        rect.top + Math.random() * rect.height,
        3 + Math.floor(pick.text.trim().length * 0.9)
    );

    // ── REMOVE WORD BY INDEX (NO replace, NO backspace) ───────────
    dissolveSnapshot =
        textBefore.slice(0, pick.start) +
        textBefore.slice(pick.start + pick.len);

    // remove from queue
    dissolveQueue.splice(pickIndex, 1);

    // IMPORTANT: update remaining word indices
    for (let i = pickIndex; i < dissolveQueue.length; i++) {
        dissolveQueue[i].start -= pick.len;
    }

    // next frame
    const delay = 60 + Math.random() * 90;
    dissolveTimer = setTimeout(runNextDissolve, delay);
}


// ── STOP DISSOLVE ────────────────────────────────────────────────
function stopDissolve() {
    dissolveActive = false;

    if (dissolveTimer) {
        clearTimeout(dissolveTimer);
        dissolveTimer = null;
    }

    dissolveQueue = [];
}
// ── END SYSTEM ───────────────────────────────────────────────────


// ── [START] TYPING SENSING ───*main risk is delayed state switching, isTyping may stay longer than expected*───────────────
let lastKeyEvent = 0;

function handleTyping() {
    const now = Date.now();
    if (now - lastKeyEvent < 40) return; // throttle noise
    lastKeyEvent = now;

    lastTyped = now;
    keyTimes.push(now);
    userTouched = true;

    stopDissolve();
    isTyping = true;

    clearTimeout(typingCooldownTimer);
    typingCooldownTimer = setTimeout(() => {
        isTyping = false;
    }, 5000);
}

// this bloack is global,idle detection becomes inaccurate
    lastTyped = Date.now();
    keyTimes.push(Date.now());
    userTouched = true;
    stopDissolve(); // Stop dissolve the moment they type again

textarea.addEventListener('input',   handleTyping);
textarea.addEventListener('keydown', handleTyping);
document.getElementById('editor-title').addEventListener('input', handleTyping);
// ── [END] TYPING SENSING ──────────────────────────────────────────


// ── [START] CARD CLICK TO WAKE ───────────────────────────────────
card.addEventListener('click', () => {
    userTouched = true;
    stopDissolve();
    if(currentCardOpacity < 0.7) {
        currentCardOpacity = 0.7;
        card.style.opacity = '0.7';
    }
    textarea.focus();
});
// ── [END] CARD CLICK TO WAKE ─────────────────────────────────────


// ── [START] SPACEBAR HOLD = INSTANT RESTORE ──────────────────────
window.addEventListener('keydown', (e) => {
    if(e.code === 'Space' && document.activeElement !== textarea) {
        e.preventDefault();
        spaceHeld = true;
    }
});
window.addEventListener('keyup', (e) => {
    if(e.code === 'Space') spaceHeld = false;
});
// ── [END] SPACEBAR HOLD = INSTANT RESTORE ────────────────────────


// ── [START] MOUSE TRACKING (no effect on card ever) ──────────────
window.addEventListener('mousemove', (e) => {
    const now = Date.now();
    const dt  = Math.max(1, now - lastMouseTime);
    lastMouseTime = now;

    mouseX = e.clientX;
    mouseY = e.clientY;

    if(lastMouseX > -9000) {
        const dx   = mouseX - lastMouseX;
        const dy   = mouseY - lastMouseY;
        mouseSpeed = Math.sqrt(dx*dx + dy*dy) / dt; // px/ms
    }
    lastMouseX = mouseX;
    lastMouseY = mouseY;
    // NOTE: No lastTyped or card opacity update here — mouse never affects card
});
// ── [END] MOUSE TRACKING ─────────────────────────────────────────


// ── HUD UPDATE ────────────────────────────────────────────────────
setInterval(() => {
    const now = Date.now();
    keyTimes = keyTimes.filter(t => now-t < 15000);
    cpm = Math.round(keyTimes.length * 5);
    const idleSec = Math.round((now - lastTyped) / 1000);
    hudState.textContent = stateName.charAt(0).toUpperCase()+stateName.slice(1);
    hudSpeed.textContent = cpm;
    hudIdle.textContent  = idleSec + 's';
}, 600);

// UI fade in after 30s
setTimeout(() => { shareBtn.classList.add('visible'); if(aboutLink) aboutLink.classList.add('visible'); }, 30000);

// 5-min emotional prompt
setTimeout(() => { if(!promptShown){promptShown=true; promptOverlay.classList.add('visible');} }, 5*60*1000);


// ── FORMSPREE ─────────────────────────────────────────────────────
let selectedChoice = "";
async function sendToFormspree(choice, comment="") {
    if(!FORMSPREE_URL||FORMSPREE_URL.includes("YOUR_ENDPOINT_ID")) return;
    try {
        await fetch(FORMSPREE_URL, {
            method:'POST',
            headers:{'Content-Type':'application/json','Accept':'application/json'},
            body: JSON.stringify({ feeling_choice:choice, user_comment:comment, typing_speed_cpm:cpm, sanctuary_state:stateName, timestamp:new Date().toISOString() })
        });
    } catch(e) {}
}
document.querySelectorAll('.prompt-choice-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        selectedChoice = btn.textContent.trim();
        promptQuestion.style.display='none'; promptChoices.style.display='none';
        sendToFormspree(selectedChoice,"");
        updateSessionEmotion(selectedChoice);
        shareCard.hidden=false;
    });
});
document.getElementById('btn-notsure').addEventListener('click', () => {
    selectedChoice="Not Sure";
    promptQuestion.style.display='none'; promptChoices.style.display='none';
    sendToFormspree(selectedChoice,""); updateSessionEmotion(selectedChoice);
    shareCard.hidden=false;
});
document.getElementById('btn-dismiss').addEventListener('click', () => promptOverlay.classList.remove('visible'));
document.getElementById('btn-copy-link').addEventListener('click', async function() {
    await navigator.clipboard.writeText(getShareText());
    this.textContent='Copied ✓'; setTimeout(()=>{this.textContent='Copy link';},2200);
});
document.getElementById('btn-native-share').addEventListener('click', function(){ doShare(this); });
shareBtn.addEventListener('click', ()=>doShare(shareBtn));


// ── STATE ENGINE ──────────────────────────────────────────────────
function getTrueIdleSeconds() {
    if (isTyping) return 0;
    return (Date.now() - lastTyped) / 1000;
}

function updateState() {
    const idleSec = getTrueIdleSeconds();

    // ── Spacebar hold forces Restore immediately ──
    if(spaceHeld) {
        targetBlend = 1.0;
    } else if(idleSec > 18) {
        targetBlend = 1.0;
    } else if(idleSec > 8 || cpm < 30) {
        targetBlend = 0.5;
    } else if(cpm > 160) {
        // Fast typing: push back toward green/blue (not full flow instantly)
        targetBlend = Math.max(0, targetBlend - 0.02);
    } else {
        targetBlend = Math.max(0, Math.min(0.5, 0.5 - (cpm-30)/260));
    }

    // ── Card opacity: driven by typing speed only ──
    // Fast typing (>150 CPM) → card fades toward green/blue (more transparent)
    // Slow or stopped → card comes back to 65%
    // Spacebar held → card fades away
    let targetCard;
    if(spaceHeld) {
        targetCard = 0.04;
    } else if(!userTouched) {
        targetCard = 0.65; // Never shown until first interaction
    } else if(idleSec > 16) {
        targetCard = 0.04;
    } else if(idleSec > 8 && !isTyping) {
        targetCard = 0.55;
    } else if(cpm > 150) {
        // Fast typing makes card more transparent — user is in flow, don't distract
        const speed = Math.min(Math.max(cpm, 0), 180);
        targetCard = Math.max(0.16, 0.65 - ((speed-150)/150)*0.47);
    } else {
        targetCard = 0.65;
    }

    const waking = targetCard > currentCardOpacity;
    currentCardOpacity += (targetCard - currentCardOpacity) * (waking ? 0.08 : 0.012);
    stateBlend         += (targetBlend - stateBlend)        * (spaceHeld ? 0.12 : waking ? 0.06 : 0.010);

    card.style.opacity     = currentCardOpacity.toFixed(4);
    card.style.transform   = stateBlend<0.25?'scale(1)':stateBlend<0.70?'scale(0.990)':'scale(0.982)';
    card.style.background  = stateBlend<0.25?'rgba(8,12,18,0.60)':stateBlend<0.70?'rgba(8,12,18,0.36)':'rgba(5,8,12,0.10)';
    card.style.borderColor = stateBlend<0.25?'rgba(255,255,255,0.07)':stateBlend<0.70?'rgba(255,255,255,0.03)':'rgba(255,255,255,0.012)';

    if      (stateBlend<0.25) stateName='flow';
    else if (stateBlend<0.70) stateName='drift';
    else                       stateName='restore';
}


// ── BACKGROUND PARTICLES ──────────────────────────────────────────
const MAX_P = 800, TAIL = 32;
class Particle {
    constructor() { this.init(true); }
    init(s) {
        if(s) { this.x=Math.random()*W; this.y=Math.random()*H; }
        else {
            const e=Math.floor(Math.random()*4);
            if(e===0){this.x=-15;this.y=Math.random()*H;}
            else if(e===1){this.x=W+15;this.y=Math.random()*H;}
            else if(e===2){this.x=Math.random()*W;this.y=-15;}
            else{this.x=Math.random()*W;this.y=H+15;}
        }
        this.vx=0; this.vy=0;
        this.spd=(0.5+Math.random()*0.7)*(1-stateBlend*0.45);
        this.life=0; this.maxL=240+Math.random()*420;
        this.hv=Math.random(); this.sz=0.6+Math.random()*1.4;
        this.trail=[];
    }
    update() {
        this.life++;
        const slow=1-stateBlend*0.52;
        const ang=fieldAngle(this.x,this.y,t);
        this.vx+=Math.cos(ang)*0.068*slow;
        this.vy+=Math.sin(ang)*0.068*slow;

        // Natural jitter
        const jitter=0.01+stateBlend*0.015;
        this.vx+=(Math.random()-0.5)*jitter;
        this.vy+=(Math.random()-0.5)*jitter;

        // Thermal lift in restore state
        if(stateBlend>0.5) this.vy-=0.006*(stateBlend-0.5)*2;

        // ── [START] MOUSE PUSH — slow moves only, like hand through water ──
        // mouseSpeed is in px/ms. Threshold 0.4 = 400px/s = gentle glide
        // ── SOFT FLUID MOUSE INTERACTION ──
// ── SOFT FLUID CURSOR ──
if(mouseX > -9000) {

    const dx = this.x - mouseX;
    const dy = this.y - mouseY;

    const dist = Math.sqrt(dx*dx + dy*dy) || 1;

    const radius = 240;

    if(dist < radius) {

        const nx = dx / dist;
        const ny = dy / dist;

        // smoother falloff
        const falloff = Math.pow(1 - dist / radius, 1.6);

        // cursor velocity
        const mvx = mouseX - lastMouseX;
        const mvy = mouseY - lastMouseY;

        // balanced forces
        const push  = 0.11 * falloff;
        const wake  = 0.006 * falloff;
        const swirl = 0.035 * falloff;

        // particles move away gently
        this.vx += nx * push;
        this.vy += ny * push;

        // cursor drags nearby flow
        this.vx += mvx * wake;
        this.vy += mvy * wake;

        // soft swirl around cursor
        this.vx += -ny * swirl;
        this.vy +=  nx * swirl;
    }
}
        // ── [END] MOUSE PUSH ──────────────────────────────────────

        const d = 0.905 + stateBlend * 0.04;
        this.vx *= d; this.vy *= d;
        this.vx = Math.max(-1.2, Math.min(1.2, this.vx));
        this.vy = Math.max(-1.2, Math.min(1.2, this.vy));
        this.trail.push({x:this.x,y:this.y});
        if(this.trail.length>TAIL) this.trail.shift();
        this.x+=this.vx*this.spd;
        this.y+=this.vy*this.spd;
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
const particles = Array.from({length:MAX_P}, ()=>new Particle());


// ── BREATHING GLOW ────────────────────────────────────────────────
setInterval(()=>{ glowTargetX=(Math.random()-0.5)*W*0.12; glowTargetY=(Math.random()-0.5)*H*0.10; }, 6000);

function drawBreath() {
    const vis=Math.max(0,(stateBlend-0.2)/0.8);
    if(vis<0.01) return;
    glowOffsetX+=(glowTargetX-glowOffsetX)*0.002;
    glowOffsetY+=(glowTargetY-glowOffsetY)*0.002;
    breathPhase+=0.0018;
    const pulse=Math.pow(Math.sin(breathPhase)*0.5+0.5,1.6);
    const radius=Math.min(W,H)*(0.16+pulse*0.09);
    const alpha=vis*0.038*(0.3+pulse*0.7);
    const cx=W/2+glowOffsetX, cy=H/2+glowOffsetY;
    const hue=38+(1-stateBlend)*122;
    const g=ctx.createRadialGradient(cx,cy,0,cx,cy,radius);
    g.addColorStop(0,`hsla(${hue},60%,58%,${alpha.toFixed(4)})`);
    g.addColorStop(0.4,`hsla(${hue},48%,40%,${(alpha*0.35).toFixed(4)})`);
    g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.beginPath(); ctx.fillStyle=g;
    ctx.arc(cx,cy,radius,0,Math.PI*2); ctx.fill();
}

function drawVignette() {
    const str=0.42+stateBlend*0.22;
    const g=ctx.createRadialGradient(W/2,H/2,H*0.30,W/2,H/2,H*0.92);
    g.addColorStop(0,'rgba(0,0,0,0)');
    g.addColorStop(1,`rgba(2,4,6,${str.toFixed(3)})`);
    ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
}


// ── MAIN LOOP ─────────────────────────────────────────────────────
function loop() {
    t += 0.003;
    updateState();

    const fade=0.030+(1-stateBlend)*0.030;
    ctx.fillStyle=`rgba(2,4,6,${fade.toFixed(4)})`;
    ctx.fillRect(0,0,W,H);

    // Background field particles — safe cap at array size
    const active=Math.min(particles.length, Math.floor(MAX_P*(0.72+(1-stateBlend)*0.28)));
    for(let i=0;i<active;i++){
        particles[i].update();
        particles[i].draw();
    }

    // Text dissolve particles
    for(let i=textParticles.length-1;i>=0;i--){
        textParticles[i].update();
        textParticles[i].draw();
        if(textParticles[i].isDead()) textParticles.splice(i,1);
    }

    drawBreath();
    drawVignette();
    requestAnimationFrame(loop);
}
loop();
