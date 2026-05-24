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

    if (stateName !== label.textContent) {
        label.textContent = stateName;
        hudState.textContent = stateName.charAt(0).toUpperCase() + stateName.slice(1);
    }
}
