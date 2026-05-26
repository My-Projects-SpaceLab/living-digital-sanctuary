// ── CONFIGURATION: CREDENTIALS ────────────────────────────────────
const SUPABASE_URL = "https://uwaclfeptosaterfimqn.supabase.co";
const SUPABASE_KEY = "sb_publishable_3t70TIXLzaJTj1CngUDVzQ_yOQ91uHw";
const FORMSPREE_URL = "https://formspree.io/f/YOUR_ENDPOINT_ID";
// ──────────────────────────────────────────────────────────────────

// ── GLOBAL STATE ──────────────────────────────────────────────────
let stateBlend         = 0;
let targetBlend        = 0;
let stateName          = 'flow';

// ── CARD OPACITY — three separate layers combined ─────────────────
// 1. entryOpacity   : 0→0.65 over 30s on page load, independent
// 2. currentCardOpacity : runtime opacity driven by idle/CPM/click
// Final opacity = Math.min(entryOpacity, currentCardOpacity) before
//   click-snap, or just currentCardOpacity after first interaction.
let entryOpacity       = 0.0;   // climbs 0→0.65 over 30s automatically
let currentCardOpacity = 0.0;   // runtime value
let userTouched        = false; // true after first click or keypress

const sessionStart = Date.now();

let lastTyped  = Date.now();
let keyTimes   = [];
let cpm        = 0;
let promptShown = false;
let spaceHeld   = false;

// Glow & breath
let breathPhase = 0;
let glowOffsetX = 0, glowOffsetY = 0, glowTargetX = 0, glowTargetY = 0;

// Mouse
let mouseX = -9999, mouseY = -9999;
let lastMouseX = -9999, lastMouseY = -9999;
let lastMouseTime = Date.now();
let mouseSpeed = 0; // px/ms
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


// ── NOISE & FIELD ─────────────────────────────────────────────────
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

// ── COLOR: BLUE → GREEN → ORANGE ─────────────────────────────────
function particleColor(hv, alpha) {
    let h = stateBlend < 0.5
        ? 210 + (165 - 210) * (stateBlend / 0.5)
        : 165 + (38  - 165) * ((stateBlend - 0.5) / 0.5);
    h += hv * 14 - 7;
    return `hsla(${h.toFixed(1)},${(72-stateBlend*16).toFixed(1)}%,${(52+stateBlend*10).toFixed(1)}%,${alpha.toFixed(4)})`;
}


// ── TEXT DISSOLVE PARTICLES ───────────────────────────────────────
// These particles die FAST and fade to BLACK — they don't linger as bright trails
const textParticles = [];

class TextParticle {
    constructor(x, y) {
        this.x = x + (Math.random()-0.5)*30;
        this.y = y + (Math.random()-0.5)*18;
        const angle = Math.random() * Math.PI * 2;
        const speed = 0.8 + Math.random() * 1.6;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed - 0.6;
        this.spd = 0.5 + Math.random() * 0.5;
        this.life = 0;
        // SHORTER life — particles die quickly so they don't linger
        this.maxL = 30 + Math.random() * 40;
        this.hv   = Math.random();
        this.sz   = 0.4 + Math.random() * 0.8; // smaller too
        this.trail = [];
        this.windRate = 0.02 + Math.random() * 0.05;
    }
    update() {
        this.life++;
        const w = Math.min(1, this.life * this.windRate);
        const ang  = fieldAngle(this.x, this.y, t);
        const wxv  = Math.cos(ang) * 0.068 * (1-stateBlend*0.52);
        const wyv  = Math.sin(ang) * 0.068 * (1-stateBlend*0.52);
        this.vx = this.vx*(1-w*0.08) + wxv*w*0.08;
        this.vy = this.vy*(1-w*0.08) + wyv*w*0.08;
        this.vx += (Math.random()-0.5)*0.012;
        this.vy += (Math.random()-0.5)*0.012;
        const d = 0.912 + stateBlend*0.054;
        this.vx*=d; this.vy*=d;
        this.trail.push({x:this.x, y:this.y});
        if(this.trail.length>8) this.trail.shift(); // short trail
        this.x += this.vx*this.spd;
        this.y += this.vy*this.spd;
    }
    draw() {
        if(this.trail.length<2) return;

        // Life progress 0→1
        const lifeRatio = this.life / this.maxL;

        // Alpha drops sharply as particle ages — fades toward 0 (black/invisible)
        // Starts slightly visible, then quickly fades out to nothing
        const lifeAlpha = Math.max(0, 1.0 - lifeRatio * lifeRatio); // quadratic fade-out
        const base = 0.18 * lifeAlpha;

        for(let i=1;i<this.trail.length;i++){
            const f = i/this.trail.length;

            // Color shifts toward dark as it dies: reduce lightness toward 0
            // At lifeRatio=0 → normal color; at lifeRatio=1 → near black
            const lightness = (52 + stateBlend*10) * (1 - lifeRatio * 0.95);
            let h = stateBlend < 0.5
                ? 210 + (165 - 210) * (stateBlend / 0.5)
                : 165 + (38  - 165) * ((stateBlend - 0.5) / 0.5);
            h += this.hv * 14 - 7;
            const alpha = f * base;

            ctx.beginPath();
            ctx.strokeStyle = `hsla(${h.toFixed(1)},${(72-stateBlend*16).toFixed(1)}%,${Math.max(0,lightness).toFixed(1)}%,${alpha.toFixed(4)})`;
            ctx.lineWidth   = f*this.sz*1.0;
            ctx.lineCap     = 'round';
            ctx.moveTo(this.trail[i-1].x, this.trail[i-1].y);
            ctx.lineTo(this.trail[i].x,   this.trail[i].y);
            ctx.stroke();
        }
    }
    isDead() {
        // Dies at maxL OR exits screen
        return this.life > this.maxL || this.x<-90||this.x>W+90||this.y<-90||this.y>H+90;
    }
}

function spawnBurst(x, y, count) {
    if(textParticles.length >= 300) return;
    for(let i=0;i<count;i++) textParticles.push(new TextParticle(x, y));
}

// ── TEXT DISSOLVE SYSTEM ──────────────────────────────────────────
let dissolveActive = false;
let dissolveTimer  = null;

function buildDissolveQueue(text) {
    const words = [];
    const regex  = /\S+\s*/g;
    let match;
    while((match = regex.exec(text)) !== null) {
        words.push({ start: match.index, len: match[0].length });
    }
    for(let i=words.length-1;i>0;i--) {
        const j = Math.floor(Math.random()*(i+1));
        [words[i], words[j]] = [words[j], words[i]];
    }
    return words;
}

function startDissolve() {
    if(dissolveActive) return;
    if(textarea.value.trim().length === 0) return;
    dissolveActive = true;
    runNextDissolve();
}

function runNextDissolve() {
    if(!dissolveActive) return;
    if(textarea.value.length === 0) { dissolveActive = false; return; }

    const words = [];
    const regex  = /\S+\s*/g;
    let match;
    const text = textarea.value;
    while((match = regex.exec(text)) !== null) {
        words.push({ start: match.index, len: match[0].length, text: match[0] });
    }
    if(words.length === 0) { dissolveActive=false; textarea.value=''; return; }

    const pick = words[Math.floor(Math.random()*words.length)];
    textarea.value = text.slice(0,pick.start) + text.slice(pick.start+pick.len);

    const rect   = textarea.getBoundingClientRect();
    const spawnX = rect.left + (pick.start/Math.max(text.length,1)) * rect.width * 0.8 + 12;
    const spawnY = rect.top  + 16 + Math.random() * rect.height * 0.6;
    spawnBurst(spawnX, spawnY, 3 + Math.floor(pick.text.trim().length * 0.8));

    const delay = 60 + Math.random() * 90;
    dissolveTimer = setTimeout(runNextDissolve, delay);
}

function stopDissolve() {
    dissolveActive = false;
    if(dissolveTimer) clearTimeout(dissolveTimer);
    dissolveTimer = null;
}

// Idle check — starts dissolve after 3s of no typing
setInterval(() => {
    const idleSec = (Date.now() - lastTyped) / 1000;
    if(idleSec >= 3 && !dissolveActive && textarea.value.trim().length > 0) {
        startDissolve();
    }
}, 500);


// ── TYPING SENSING ────────────────────────────────────────────────
function handleTyping() {
    lastTyped = Date.now();
    keyTimes.push(Date.now());
    userTouched = true;
    stopDissolve();

    const rect   = textarea.getBoundingClientRect();
    const spawnX = rect.left + Math.random()*rect.width*0.9 + 8;
    const spawnY = rect.top  + Math.random()*rect.height*0.7 + 8;
    spawnBurst(spawnX, spawnY, 2);
}
textarea.addEventListener('input',   handleTyping);
textarea.addEventListener('keydown', handleTyping);
const editorTitle = document.getElementById('editor-title');
if(editorTitle) editorTitle.addEventListener('input', handleTyping);

// ── CARD CLICK TO WAKE ────────────────────────────────────────────
// Any click anywhere on the page wakes the card to 0.65 instantly
document.addEventListener('click', () => {
    userTouched = true;
    lastTyped = Date.now();
    stopDissolve();
    // Snap to 0.65 — overrides both entryOpacity and currentCardOpacity
    currentCardOpacity = 0.65;
    card.style.opacity = '0.65';
    textarea.focus();
});

// ── SPACEBAR HOLD = INSTANT RESTORE ──────────────────────────────
window.addEventListener('keydown', (e) => {
    if(e.code === 'Space' && document.activeElement !== textarea) {
        e.preventDefault();
        spaceHeld = true;
    }
});
window.addEventListener('keyup', (e) => {
    if(e.code === 'Space') spaceHeld = false;
});

// ── MOUSE TRACKING ────────────────────────────────────────────────
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
});

// ── HUD UPDATE ────────────────────────────────────────────────────
setInterval(() => {
    const now = Date.now();
    keyTimes = keyTimes.filter(t => now-t < 12000);
    cpm = Math.round(keyTimes.length * 5);
    const idleSec = Math.round((now - lastTyped) / 1000);
    if(hudState) hudState.textContent = stateName.charAt(0).toUpperCase()+stateName.slice(1);
    if(hudSpeed) hudSpeed.textContent = cpm;
    if(hudIdle)  hudIdle.textContent  = idleSec + 's';
}, 600);

// UI elements fade in after 30s
setTimeout(() => {
    if(shareBtn)  shareBtn.classList.add('visible');
    if(aboutLink) aboutLink.classList.add('visible');
}, 30000);

// 5-min emotional prompt
setTimeout(() => {
    if(!promptShown){ promptShown=true; promptOverlay.classList.add('visible'); }
}, 5*60*1000);


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
const btnNotSure = document.getElementById('btn-notsure');
if(btnNotSure) btnNotSure.addEventListener('click', () => {
    selectedChoice="Not Sure";
    promptQuestion.style.display='none'; promptChoices.style.display='none';
    sendToFormspree(selectedChoice,""); updateSessionEmotion(selectedChoice);
    shareCard.hidden=false;
});
const btnDismiss = document.getElementById('btn-dismiss');
if(btnDismiss) btnDismiss.addEventListener('click', () => promptOverlay.classList.remove('visible'));
const btnCopyLink = document.getElementById('btn-copy-link');
if(btnCopyLink) btnCopyLink.addEventListener('click', async function() {
    await navigator.clipboard.writeText(getShareText());
    this.textContent='Copied ✓'; setTimeout(()=>{this.textContent='Copy link';},2200);
});
const btnNativeShare = document.getElementById('btn-native-share');
if(btnNativeShare) btnNativeShare.addEventListener('click', function(){ doShare(this); });
if(shareBtn) shareBtn.addEventListener('click', ()=>doShare(shareBtn));


// ── STATE ENGINE ──────────────────────────────────────────────────
function updateState() {
    const idleSec = (Date.now() - lastTyped) / 1000;

    // ── Background stateBlend (particle color/speed, unchanged) ──
    if(spaceHeld) {
        targetBlend = 1.0;
    } else if(idleSec > 18) {
        targetBlend = 1.0;
    } else if(idleSec > 8 || cpm < 30) {
        targetBlend = 0.5;
    } else if(cpm > 160) {
        targetBlend = Math.max(0, targetBlend - 0.02);
    } else {
        targetBlend = Math.max(0, Math.min(0.5, 0.5 - (cpm-30)/260));
    }

    // ── CARD OPACITY — the fixed logic ────────────────────────────
    //
    // Phase 1 — Entry (no interaction yet):
    //   entryOpacity climbs 0 → 0.65 over 30 seconds from page load.
    //   This is the automatic ambient fade-in tied to the color cycle.
    //
    // Phase 2 — After first interaction (click or keypress):
    //   entryOpacity is no longer relevant.
    //   currentCardOpacity is driven by idle time and CPM:
    //     - idle < 8s  → hold at 0.65 base
    //     - typing     → climbs slowly with CPM toward max 0.82
    //     - idle 8–18s → slow fade toward 0.30
    //     - idle > 18s → fade to 0.04 (nearly gone)
    //     - click      → instant snap to 0.65 (handled in click listener)
    //     - spacebar   → fade to 0.04
    //
    // ────────────────────────────────────────────────────────────

    if (!userTouched) {
        // AUTO ENTRY: 0 → 0.65 over 30 seconds
        const ageSeconds = (Date.now() - sessionStart) / 1000;
        entryOpacity = Math.min(0.65, (ageSeconds / 30) * 0.65);
        currentCardOpacity = entryOpacity;

    } else {
        // RUNTIME: user has interacted, opacity driven by idle + CPM
        let targetCard;

        if (spaceHeld) {
            targetCard = 0.04;
        } else if (idleSec > 18) {
            targetCard = 0.04;
        } else if (idleSec > 8) {
            // Slow fade from 0.65 → 0.30 between 8s and 18s idle
            const t = (idleSec - 8) / 10; // 0→1 over those 10 seconds
            targetCard = 0.65 - t * 0.35;
            targetCard = Math.max(0.30, targetCard);
        } else {
            // Active: base 0.65, climbing with CPM up to 0.82
            // More typing = slightly more visible (user is engaged)
            const cpmBoost = Math.min(cpm, 300);
            targetCard = 0.65 + (cpmBoost / 300) * 0.17;
        }

        // Waking up (increasing) = faster lerp so it feels snappy
        // Fading (decreasing) = very slow lerp so it's imperceptible
        const isWaking = targetCard > currentCardOpacity;
        const lerpSpeed = isWaking ? 0.06 : 0.008; // fast wake, glacier fade
        currentCardOpacity += (targetCard - currentCardOpacity) * lerpSpeed;
    }

    // Apply to DOM
    card.style.opacity = Math.max(0, Math.min(1, currentCardOpacity)).toFixed(4);

    // Blend the stateBlend
    const blendLerp = spaceHeld ? 0.12 : (targetBlend > stateBlend ? 0.06 : 0.010);
    stateBlend += (targetBlend - stateBlend) * blendLerp;

    // Card visual style shifts with state
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

        const jitter=0.01+stateBlend*0.015;
        this.vx+=(Math.random()-0.5)*jitter;
        this.vy+=(Math.random()-0.5)*jitter;

        if(stateBlend>0.5) this.vy-=0.006*(stateBlend-0.5)*2;

        // ── MOUSE PUSH — fixed threshold (was 0.4, now 4.0) ──────
        // mouseSpeed is px/ms. 0.4px/ms was far too low — normal mouse
        // movement is 0.5–3px/ms so condition never fired.
        // Now: any gentle-to-normal mouse movement triggers the push.
        if(mouseX > -9000 && mouseSpeed < 4.0) {
            const mdx   = this.x - mouseX;
            const mdy   = this.y - mouseY;
            const mdist = Math.sqrt(mdx*mdx + mdy*mdy) || 1;
            if(mdist < 180) {
                // Slower mouse = stronger push (more deliberate interaction)
                const slowFactor = Math.max(0.1, 1 - (mouseSpeed / 4.0));
                const force = (1 - mdist/180) * 0.22 * slowFactor;
                this.vx += (mdx/mdist) * force;
                this.vy += (mdy/mdist) * force;
            }
        }

        const d=0.912+stateBlend*0.054;
        this.vx*=d; this.vy*=d;
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

    const active=Math.min(particles.length, Math.floor(MAX_P*(0.72+(1-stateBlend)*0.28)));
    for(let i=0;i<active;i++){
        particles[i].update();
        particles[i].draw();
    }

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
