const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const BG_WIDTH = 2982;
const BG_HEIGHT = 850;
const FPS = 10;
let worldScale = 1; 
let screenShake = 0; 

// 🌌 Background Assets
const skyImg = new Image(); skyImg.src = 'assets/sky.webp';
const mountainImg = new Image(); mountainImg.src = 'assets/mountainandgrass.webp';

let skyTime = 0; 
let snowParticles = [];
let isSnowing = true;
let weatherTimer = 0;
const SNOW_DURATION = 20000; 
const CLEAR_DURATION = 15000;

// ❄️ DYNAMIC SNOW GLOBE CONTROLS
let activeSnowCount = 15; 
const MAX_SNOW = 100;
let lastX = 0, lastY = 0, lastZ = 0;
let moveThreshold = 25; 

/* ===============================
   📱 NATIVE SCROLL & CSS
================================ */
const hideScrollStyle = document.createElement('style');
hideScrollStyle.innerHTML = `
  html, body {
    margin: 0; padding: 0;
    overflow-x: auto; 
    overflow-y: hidden; 
    background-color: #000;
    scrollbar-width: none;
    -ms-overflow-style: none;
    overscroll-behavior-y: none;
  }
  html::-webkit-scrollbar, body::-webkit-scrollbar {
    display: none;
  }
  canvas {
    display: block;
    touch-action: pan-x; /* Allow native mobile left/right swipes */
    cursor: grab; /* Default PC cursor */
  }
  canvas:active {
    cursor: grabbing; /* PC grabbing cursor */
  }
`;
document.head.appendChild(hideScrollStyle);

/* ===============================
   ✨ YOUR CUSTOM OVERLAY (PERFECTLY ALIGNED)
================================ */
let manualDismiss = false;
const rotateOverlay = document.createElement('div');
rotateOverlay.id = 'rotate-guard';
rotateOverlay.innerHTML = `
  <div class="custom-overlay-content">
    
    <div class="icons-container">
      <svg class="anim-phone" viewBox="0 0 24 24" width="60" height="60" stroke="white" stroke-width="1" fill="none" stroke-linecap="round" stroke-linejoin="round">
        <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
      </svg>

      <svg viewBox="0 0 24 24" width="60" height="60" stroke="white" stroke-width="1" fill="none" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
        <path class="anim-wave1" d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
        <path class="anim-wave2" d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
      </svg>

      <svg class="anim-snow" viewBox="0 0 24 24" width="60" height="60" stroke="white" stroke-width="1" fill="none" stroke-linecap="round" stroke-linejoin="round">
        <line x1="12" y1="2" x2="12" y2="22"></line><line x1="17" y1="5" x2="12" y2="10"></line><line x1="7" y1="5" x2="12" y2="10"></line>
        <line x1="17" y1="19" x2="12" y2="14"></line><line x1="7" y1="19" x2="12" y2="14"></line><line x1="2" y1="12" x2="22" y2="12"></line>
        <line x1="5" y1="7" x2="10" y2="12"></line><line x1="5" y1="17" x2="10" y2="12"></line><line x1="19" y1="7" x2="14" y2="12"></line>
        <line x1="19" y1="17" x2="14" y2="12"></line>
      </svg>
    </div>

    <div class="text-block">
      Rotate your phone. Turn your volume on. Shake your phone to snow.
    </div>

  </div>
`;
document.body.appendChild(rotateOverlay);

const style = document.createElement('style');
style.innerHTML = `
  #rotate-guard { 
    display: none; 
    position: fixed; 
    top: 0; left: 0; 
    width: 100%; height: 100%; 
    background: rgba(10, 15, 50, 0.85); 
    backdrop-filter: blur(4px); 
    z-index: 10000; 
    justify-content: center; 
    align-items: center; 
    cursor: pointer; 
  }
  .custom-overlay-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 25px; /* Space between icons and text */
  }
  .icons-container {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    gap: 35px; /* Spacing between the 3 icons */
  }
  .text-block {
    color: white;
    font-family: 'Segoe UI', Tahoma, Geneva, sans-serif;
    font-size: 14px;
    font-weight: 300;
    text-align: center;
    line-height: 1.5;
    max-width: 250px; /* THIS IS THE FIX: Forces text to wrap perfectly under the icon edges */
  }
  
  /* Animations */
  .anim-phone { animation: rotPhone 2.5s ease-in-out infinite; }
  @keyframes rotPhone { 0% { transform: rotate(0deg); } 40%, 100% { transform: rotate(-90deg); } }
  .anim-wave1 { animation: pulseWave 1.5s infinite; }
  .anim-wave2 { animation: pulseWave 1.5s infinite 0.3s; }
  @keyframes pulseWave { 0%, 100% { opacity: 0.2; } 50% { opacity: 1; } }
  .anim-snow { animation: fadeSnow 2s ease-in-out infinite; }
  @keyframes fadeSnow { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }
`;
document.head.appendChild(style);

/* ===============================
   📱 MOBILE FULLSCREEN HIDER
================================ */
function goFullScreenMobile() {
    const isMobile = /Android|webOS|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isMobile) {
        const doc = window.document;
        const docEl = doc.documentElement;
        const requestFullScreen = docEl.requestFullscreen || docEl.webkitRequestFullScreen || docEl.msRequestFullscreen;
        if (!doc.fullscreenElement && requestFullScreen) {
            requestFullScreen.call(docEl).catch(err => console.log("Fullscreen blocked by browser"));
        }
    }
}

function handleMotion(event) {
    let accel = event.accelerationIncludingGravity;
    if (!accel?.x) return;
    let delta = Math.abs(accel.x - lastX) + Math.abs(accel.y - lastY) + Math.abs(accel.z - lastZ);
    if (delta > moveThreshold) {
        if (activeSnowCount < MAX_SNOW) activeSnowCount += 3;
        snowParticles.forEach(p => { 
            p.speed = Math.min(p.speed + 0.8, 8); 
            if (p.opacity <= 0) p.reset(false); 
        });
    }
    lastX = accel.x; lastY = accel.y; lastZ = accel.z;
}

function checkOrientation() {
  const isMobile = /Android|webOS|iPhone|iPad|iPod/i.test(navigator.userAgent);
  rotateOverlay.style.display = (isMobile && window.innerHeight > window.innerWidth && !manualDismiss) ? 'flex' : 'none';
}

/* ===============================
   ❄️ SNOW SYSTEM
================================ */
class SnowParticle {
  constructor(startOnScreen = false) { this.reset(startOnScreen); }
  reset(startOnScreen = false) {
    this.x = Math.random() * BG_WIDTH;
    this.y = startOnScreen ? Math.random() * BG_HEIGHT : -50 - Math.random() * 200;
    this.size = Math.random() * 4 + 2; 
    this.baseSpeed = Math.random() * 1.2 + 0.5; 
    this.speed = this.baseSpeed; 
    this.opacity = 0; 
    this.meltY = 740 + Math.random() * 60; 
  }
  update(forceStop) {
    if (this.y < this.meltY) {
      this.y += this.speed;
      this.x += Math.sin(this.y * 0.01) * 0.2; 
      if (this.opacity < 0.8) this.opacity += 0.015; 
      if (this.speed > this.baseSpeed) this.speed *= 0.96; 
    } else {
      this.opacity -= 0.02; 
      if (this.opacity <= 0 && !forceStop) this.reset(false);
    }
  }
  draw() {
    if (this.opacity <= 0) return;
    ctx.fillStyle = `rgba(255, 255, 255, ${this.opacity})`;
    ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); ctx.fill();
  }
}
for (let i = 0; i < MAX_SNOW; i++) snowParticles.push(new SnowParticle(true));

/* ===============================
   🛼 SHANNON GLOBAL CONTROL
================================ */
let shannonProgress = 0, shannonState = "skating", shannonWaitTimer = 0, trickTimer = 0, shannonPathLength = 0;
const SHANNON_WAIT = 4000, TRICK_DURATION = 700, SHANNON_SPEED = 0.00005; 
const shannonPath = document.createElementNS("http://www.w3.org/2000/svg", "path");

/* ===============================
   🎨 SPRITE CLASS
================================ */
class Sprite {
  constructor(name, jsonPath, webpPath, x, y, idleRange, actionRange, repeatAction = 1, stutterQueue = [], assetScale = 1, yOffset = 0, zIndex = 0) {
    this.name = name; this.startX = x; this.x = x; this.y = y;
    this.assetScale = assetScale; this.yOffset = yOffset; this.zIndex = zIndex; 
    this.webp = new Image(); this.webp.src = webpPath;
    this.jsonPath = jsonPath; this.idleFrames = idleRange; this.actionFrames = actionRange;
    this.repeatTarget = repeatAction; this.repeatCount = 0;
    this.stutterQueue = stutterQueue; this.stutterStage = -1; this.stutterCount = 0;
    this.crabPhase = 0; this.moveSpeed = 25; this.rabbitSubPhase = 0; this.leahWaitTimer = 0;
    this.fullData = null; this.frameNames = []; this.state = "idle"; this.index = 0; this.ready = false; this.lastUpdate = 0;
    this.hitShakeDone = false;
    this.sound = new Audio(`assets/sounds/${this.name.toLowerCase()}.mp3`);
    this.load();
  }

  async load() {
    try {
      const resp = await fetch(this.jsonPath);
      this.fullData = await resp.json();
      this.frameNames = Object.keys(this.fullData.frames).sort((a, b) => a.localeCompare(b, undefined, {numeric: true, sensitivity: 'base'}));
      this.ready = true; sortCharacters(); 
    } catch (e) { console.error("JSON Error for " + this.name, e); }
  }

  update(now) {
    if (!this.ready || !this.fullData) return;
    let seq = (this.state === "idle") ? this.idleFrames : (this.stutterStage >= 0) ? this.stutterQueue[this.stutterStage].range : this.actionFrames;
    if (!seq || seq.length === 0) return;
    if (this.index >= seq.length) this.index = 0; 

    if (this.name === "donghaoandbear" && this.state === "action" && seq[this.index] === 29 && !this.hitShakeDone) {
      screenShake = 60; this.hitShakeDone = true;
    }

    const frameData = this.fullData.frames[this.frameNames[seq[this.index]]];
    if (frameData) {
      const f = frameData.frame; const s = frameData.spriteSourceSize; 
      ctx.save();
      const drawW = f.w / this.assetScale; const drawH = f.h / this.assetScale;
      this.w = drawW; this.h = drawH;
      let jumpY = 0;
      if (this.name === "Shannon" && shannonState === "trick") jumpY = Math.sin((trickTimer / TRICK_DURATION) * Math.PI) * -200;
      else if (this.name === "Leah" && this.state === "action") {
        const totalJumpFrames = this.actionFrames.length * 3;
        const currentProgress = (this.repeatCount * this.actionFrames.length + this.index) / totalJumpFrames;
        jumpY = Math.sin(currentProgress * Math.PI) * -120;
      }
      ctx.translate(this.x + (s.x / this.assetScale) + (drawW / 2), this.y + (s.y / this.assetScale) + (drawH / 2) + this.yOffset + jumpY);
      if (this.name === "Shannon" && shannonState === "trick") ctx.rotate((trickTimer / TRICK_DURATION) * Math.PI * 4);
      if ((this.name === "Crabman" && this.crabPhase === 0) || (this.name === "Rabbitman" && this.crabPhase === 1)) ctx.scale(-1, 1);
      ctx.drawImage(this.webp, f.x, f.y, f.w, f.h, -drawW / 2, -drawH / 2, drawW, drawH);
      ctx.restore();
    }
    if (now - this.lastUpdate > 1000 / FPS) {
      if (this.name === "Crabman" && this.state === "action") {
        if (this.crabPhase === 0) { this.x -= this.moveSpeed; if (this.x <= 100) { this.x = 100; this.crabPhase = 1; this.state = "idle"; } }
        else { this.x += this.moveSpeed; if (this.x >= 2700) { this.x = 2700; this.crabPhase = 0; this.state = "idle"; } }
      }
      if (this.name === "Rabbitman" && this.state === "action") { if (this.rabbitSubPhase === 0) this.x += (this.crabPhase === 0) ? 6 : -6; }
      if (this.name === "Leah") {
        if (this.state !== "waiting") { this.x -= 12; if (this.x < -600) { this.state = "waiting"; this.leahWaitTimer = now; } }
        else if (now - this.leahWaitTimer > 4000) { this.x = 3200; this.state = "idle"; }
      }
      this.index++;
      if (this.index >= seq.length) this.handleSequenceEnd();
      this.lastUpdate = now;
    }
  }

  handleSequenceEnd() {
    if (this.state === "action") {
      if (this.name === "Rabbitman") {
        this.repeatCount++;
        if (this.rabbitSubPhase === 0) {
          if (this.repeatCount < 3) { this.index = 0; } 
          else { this.rabbitSubPhase = 1; this.repeatCount = 0; this.index = 0; this.actionFrames = Array.from({length: 4}, (_, i) => i + 8); }
        } else {
          if (this.repeatCount < 2) { this.index = 0; } 
          else { this.state = "idle"; this.index = 0; this.repeatCount = 0; this.rabbitSubPhase = 0; this.crabPhase = (this.crabPhase === 0) ? 1 : 0; if (this.crabPhase === 0) this.x = this.startX; }
        }
        return;
      }
      if (this.repeatTarget > 1 && this.name !== "Leah" && this.name !== "Rabbitman") { this.repeatCount++; if (this.repeatCount < this.repeatTarget) { this.index = 0; return; } this.repeatCount = 0; }
      if (this.name === "Leah") { this.repeatCount++; if (this.repeatCount < 3) { this.index = 0; return; } this.repeatCount = 0; this.state = "idle"; this.index = 0; return; }
      if (this.name === "Crabman") { this.state = "idle"; this.index = 0; return; }
      if (this.stutterQueue.length > 0) {
        if (this.stutterStage === -1) { this.stutterStage = 0; this.index = 0; } 
        else {
          this.stutterCount++; if (this.stutterCount < this.stutterQueue[this.stutterStage].target) { this.index = 0; } else { this.stutterStage++; this.stutterCount = 0; this.index = 0; if (this.stutterStage >= this.stutterQueue.length) this.finalize(); } }
      } else { this.finalize(); }
    } else { this.index = 0; }
  }

  finalize() { this.index = 0; this.state = "idle"; this.repeatCount = 0; this.stutterStage = -1; this.stutterCount = 0; this.rabbitSubPhase = 0; }

  isHit(tx, ty) {
    if (!this.w || !this.h) return false;
    return (tx >= this.x && tx <= this.x + this.w && ty >= this.y + this.yOffset - 100 && ty <= this.y + this.yOffset + this.h + 100);
  }

  checkHit(tx, ty) {
    if (this.isHit(tx, ty)) {
      if (this.sound) { this.sound.currentTime = 0; this.sound.play().catch(()=>{}); }
      if (this.name === "Shannon") { shannonState = "trick"; trickTimer = 0; }
      if (this.name === "Rabbitman" && this.state === "idle") {
        this.state = "action"; this.index = 0; this.repeatCount = 0; this.rabbitSubPhase = 0;
        this.actionFrames = Array.from({length: 8}, (_, i) => i); return;
      }
      if (this.state === "idle" || (this.name === "Leah" && this.state !== "waiting")) { 
        this.state = "action"; this.index = 0; this.repeatCount = 0; this.stutterStage = -1; this.stutterCount = 0; this.hitShakeDone = false;
      }
    }
  }
}

// 🗺️ CHARACTERS
const characters = [
  new Sprite("Rabbitman", "assets/rabbitman.json", "assets/rabbitman.webp", 1300, 630, [0], [], 1, [], 1, 0, 100),
  new Sprite("Shannon", "assets/shannon.json", "assets/shannon.webp", 2840, 129, [0, 1, 2, 3, 4], [0, 1, 2, 3, 4], 1, [], 1, -155, 0),
  new Sprite("ezofox", "assets/ezofox.json", "assets/ezofox.webp", 136, 559, Array.from({length:15}, (_,i)=>i), Array.from({length:3}, (_,i)=>i+15), 3, [], 1, 0, 5),
  new Sprite("donghaoandbear", "assets/donghaoandbear.json", "assets/donghaoandbear.webp", 241, 257, [...Array(5).fill([...Array(10).keys()]).flat(), ...Array.from({length:14},(_,i)=>i+10)], Array.from({length:7}, (_,i)=>i+24), 1, [{ range: [30], target: 10 }], 1, 0, 5),
  new Sprite("Cook", "assets/cook.json", "assets/cook.webp", 1333, 467, Array.from({length:15}, (_,i)=>i), Array.from({length:1}, (_,i)=>i+15), 20, [], 1, 0, 5),
  new Sprite("Lexi", "assets/lexi.json", "assets/lexi.webp", 1611, 500, Array.from({length:15}, (_,i)=>i), Array.from({length:4}, (_,i)=>i+15), 5, [], 1, 0, 5),
  new Sprite("Nanshi", "assets/nanshi.json", "assets/nanshi.webp", 1977, 475, Array.from({length:8}, (_,i)=>i), Array.from({length:6}, (_,i)=>i+8), 5, [], 1, 0, 5),
  new Sprite("Crabman", "assets/crabman.json", "assets/crabman.webp", 2700, 720, [0], [0, 1, 2, 3, 4], 1, [], 1, 0, 99), 
  new Sprite("Leah", "assets/leah.json", "assets/leah.webp", 2800, 600, Array.from({length: 15}, (_, i) => i), [15, 16], 1, [], 1, 0, 100),
  new Sprite("Seagull", "assets/seagull.json", "assets/seagull.webp", 1341, 65, [...Array(5).fill([0, 1, 2, 3, 4]).flat(), ...Array.from({length: 12}, (_, i) => i + 5)], [17, 18, 19, 20, 21, 22, 23, 22, 21, 20, 19, 18], 1, [], 1, 0, 5),
  new Sprite("Bart", "assets/bart.json", "assets/bart.webp", 631, 450, Array.from({length:4}, (_,i)=>i), Array.from({length:8}, (_,i)=>i+4), 1, [], 1, 0, 5),
  new Sprite("Marimokkori", "assets/marimokkori.json", "assets/marimokkori.webp", 766, 409, Array.from({length:20}, (_,i)=>i), Array.from({length:11}, (_,i)=>i+20), 1, [], 1, 0, 5),
  new Sprite("Ekon", "assets/ekon.json", "assets/ekon.webp", 928, 475, Array.from({length: 15}, (_, i) => i), Array.from({length: 10}, (_, i) => i + 15), 1, [{ range: [22, 23, 24], target: 5 }], 1, 0, 5),
  new Sprite("Shuqiao", "assets/shuqiao.json", "assets/shuqiao.webp", 1060, 527, Array.from({length:10}, (_,i)=>i), Array.from({length:9}, (_,i)=>i+10), 2, [], 1, 0, 5),
  new Sprite("Ricky", "assets/ricky.json", "assets/ricky.webp", 1141, 458, Array.from({length:8}, (_,i)=>i), Array.from({length:9}, (_,i)=>i+8), 1, [{range:[15,16], target:10}], 1, 0, 6), 
  new Sprite("Toni", "assets/toni.json", "assets/toni.webp", 1462, 420, Array.from({length:10}, (_,i)=>i), Array.from({length:8}, (_,i)=>i+10), 1, [{range:[18,19], target:5},{range:[20],target:1},{range:[20,21], target:3}], 1, 0, 5),
  new Sprite("Zushihocky", "assets/zushihocky.json", "assets/zushihocky.webp", 1700, 360, Array.from({length:10}, (_,i)=>i), [15], 1, [{range:[11,16], target:1}, {range:[16], target:10}], 1, 0, 5),
  new Sprite("Yuki", "assets/yuki.json", "assets/yuki.webp", 2098, 458, Array.from({length:8}, (_,i)=>i), Array.from({length:6}, (_,i)=>i+8), 1, [{range:[12,13], target:5}], 1, 0, 5),
  new Sprite("Melody", "assets/melody.json", "assets/melody.webp", 2234, 480, Array.from({length:10}, (_,i)=>i), Array.from({length:7}, (_,i)=>i+10), 1, [{range:[12,16], target:10}], 1, 0, 4), 
  new Sprite("Horseman", "assets/horseman.json", "assets/horseman.webp", 2463, 441, Array.from({length:15}, (_,i)=>i), [15], 1, [{range:[15], target:3}, {range:[16], target:10}], 1, 0, 5),
  new Sprite("Onigiriman", "assets/onigiriman.json", "assets/onigiriman.webp", 2600, 648, Array.from({length: 13}, (_, i) => i), Array.from({length:5}, (_, i) => i + 13), 1, [{ range: [13,17], target: 1 },{range:[18], target: 5}], 1, 0, 5),
  new Sprite("Weizhuo", "assets/weizhuo.json", "assets/weizhuo.webp", 2673, 445, Array.from({length:11}, (_,i)=>i), Array.from({length:21}, (_,i)=>i+11), 1, [], 1, 0, 5)
];

function sortCharacters() { characters.sort((a, b) => a.zIndex - b.zIndex); }

/* ===============================
   🚀 ENGINE & RENDER
================================ */
async function initShannonPath() {
  try {
    const res = await fetch('assets/path.svg');
    const txt = await res.text();
    const xml = new DOMParser().parseFromString(txt, "image/svg+xml");
    shannonPath.setAttribute("d", xml.querySelector('path').getAttribute('d'));
    shannonPathLength = shannonPath.getTotalLength();
  } catch(e) {}
}

function updateShannon(delta) {
  const s = characters.find(c => c.name === "Shannon");
  if (!s || !shannonPathLength) return;
  if (shannonState === "skating" || shannonState === "trick") {
    const speedMultiplier = (shannonState === "trick") ? 1.5 : 1.0;
    shannonProgress += 0.00005 * delta * speedMultiplier;
    if (shannonProgress <= 1.0) {
      const pt = shannonPath.getPointAtLength((1 - shannonProgress) * shannonPathLength);
      s.x = pt.x; s.y = pt.y;
    } else { s.x -= 8 * speedMultiplier; if (s.x < -400) { shannonState = "waiting"; shannonWaitTimer = 0; } }
  } else if (shannonState === "waiting") {
    shannonWaitTimer += delta; if (shannonWaitTimer >= SHANNON_WAIT) { shannonProgress = 0; shannonState = "skating"; }
  }
  if (shannonState === "trick") { trickTimer += delta; if (trickTimer >= 700) shannonState = "skating"; }
}

let lastTime = 0;
function render(time) {
  const delta = time - lastTime; lastTime = time;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  if (screenShake > 0) { ctx.translate((Math.random()-0.5)*screenShake, (Math.random()-0.5)*screenShake); screenShake *= 0.85; if (screenShake < 1) screenShake = 0; }
  
  ctx.save(); ctx.scale(worldScale, worldScale); 
  if (skyImg.complete) {
    skyTime += 0.015; ctx.filter = `hue-rotate(${Math.sin(skyTime)*20}deg) brightness(0.8)`;
    ctx.drawImage(skyImg, 0, 0); ctx.filter = 'none';
  }
  if (mountainImg.complete) ctx.drawImage(mountainImg, 0, 0);

  snowParticles.forEach((p, i) => { if (i < activeSnowCount) { p.update(weatherTimer > SNOW_DURATION); p.draw(); } });
  weatherTimer += delta; if (weatherTimer > SNOW_DURATION + CLEAR_DURATION) weatherTimer = 0;

  updateShannon(delta); 
  characters.forEach(c => c.update(time));
  ctx.restore(); ctx.restore();
  requestAnimationFrame(render);
}

/* ===============================
   🖱️ INSTANT TOUCH & BUG-FREE PC DRAG
================================ */
const handleInteraction = (e) => {
    if (typeof DeviceMotionEvent?.requestPermission === 'function') {
        DeviceMotionEvent.requestPermission().then(s => { if (s === 'granted') window.addEventListener('devicemotion', handleMotion); });
    } else window.addEventListener('devicemotion', handleMotion);
    
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX !== undefined ? e.clientX : (e.changedTouches ? e.changedTouches[0].clientX : 0);
    const clientY = e.clientY !== undefined ? e.clientY : (e.changedTouches ? e.changedTouches[0].clientY : 0);
    
    const worldX = (clientX - rect.left) / worldScale;
    const worldY = (clientY - rect.top) / worldScale;
    [...characters].sort((a,b) => b.zIndex - a.zIndex).forEach(c => c.checkHit(worldX, worldY));
};

let isDragging = false;
let hasDragged = false;
let lastClientX = 0;

// 1. POINTER EVENTS FOR BUG-FREE DRAGGING/HOVERING (Replaces mousemove)
window.addEventListener('pointerdown', (e) => {
    // Triggers Mobile App Mode!
    goFullScreenMobile();

    if (e.pointerType === 'mouse') {
        isDragging = true;
        hasDragged = false;
        lastClientX = e.clientX;
    } else {
        // Instant interaction for Mobile Touch
        handleInteraction(e);
    }
});

window.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse') {
        if (isDragging) {
            const dx = e.clientX - lastClientX;
            if (Math.abs(dx) > 2) hasDragged = true; 
            window.scrollBy(-dx, 0);
            lastClientX = e.clientX;
            canvas.style.cursor = 'grabbing'; 
        } else {
            const rect = canvas.getBoundingClientRect();
            const worldX = (e.clientX - rect.left) / worldScale;
            const worldY = (e.clientY - rect.top) / worldScale;
            
            let isHovering = false;
            const sortedChars = [...characters].sort((a,b) => b.zIndex - a.zIndex);
            for (let c of sortedChars) {
                if (c.isHit(worldX, worldY)) {
                    isHovering = true;
                    break;
                }
            }
            canvas.style.cursor = isHovering ? 'pointer' : 'grab'; 
        }
    }
});

window.addEventListener('pointerup', (e) => {
    if (e.pointerType === 'mouse') {
        if (isDragging && e.button === 0 && !hasDragged) {
            handleInteraction(e); 
        }
        isDragging = false;
        // Cursor will automatically reset on next pointermove hover check
    }
});

function handleResize() { worldScale = window.innerHeight / 850; canvas.height = window.innerHeight; canvas.width = 2982 * worldScale; checkOrientation(); }
window.addEventListener('resize', handleResize); handleResize();

// Dismiss overlay + trigger fullscreen on mobile
rotateOverlay.addEventListener('pointerdown', () => { 
  manualDismiss = true; 
  rotateOverlay.style.display = 'none'; 
  goFullScreenMobile();
});

initShannonPath(); requestAnimationFrame(render);
