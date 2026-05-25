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
