const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const BG_WIDTH = 2982;
const BG_HEIGHT = 850;
const FPS = 10;
let worldScale = 1; 
let screenShake = 0; 

// 🌌 Assets
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

/* ===============================
   📱 OPTIMIZED SHAKE (Medium Sensitivity)
================================ */
let lastX, lastY, lastZ;
let moveThreshold = 25; // 🎯 MEDIUM: Not too sensitive, not too hard

function handleMotion(event) {
    let accel = event.accelerationIncludingGravity;
    if (!accel.x) return;

    let deltaX = Math.abs(accel.x - lastX);
    let deltaY = Math.abs(accel.y - lastY);
    let deltaZ = Math.abs(accel.z - lastZ);

    if ((deltaX + deltaY + deltaZ) > moveThreshold) {
        if (activeSnowCount < MAX_SNOW) activeSnowCount += 3; // Adds snow gradually
        
        snowParticles.forEach((p, i) => {
            if (i < activeSnowCount) {
                p.speed += 2.5; 
                if (p.speed > 10) p.speed = 10;
                if (p.opacity <= 0) p.reset(false);
            }
        });
    }
    lastX = accel.x; lastY = accel.y; lastZ = accel.z;
}

/* ===============================
   📱 ORIENTATION GUARD (Dismissible)
================================ */
let manualDismiss = false;
const rotateOverlay = document.createElement('div');
rotateOverlay.id = 'rotate-guard';
rotateOverlay.innerHTML = `<div class="rotate-box"><div class="phone-icon"></div><p>Rotate Your Device</p></div>`;
document.body.appendChild(rotateOverlay);

const style = document.createElement('style');
style.innerHTML = `
  #rotate-guard { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.85); z-index: 10000; color: white; font-family: sans-serif; justify-content: center; align-items: center; cursor: pointer; }
  .phone-icon { width: 40px; height: 70px; border: 3px solid white; border-radius: 6px; margin: 0 auto 15px; animation: rotatePhone 2s ease-in-out infinite; }
  @keyframes rotatePhone { 0% { transform: rotate(0deg); } 50% { transform: rotate(90deg); } 100% { transform: rotate(90deg); } }
`;
document.head.appendChild(style);
rotateOverlay.addEventListener('touchstart', () => { manualDismiss = true; rotateOverlay.style.display = 'none'; }, {passive: true});

function checkOrientation() {
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  if (isMobile && window.innerHeight > window.innerWidth && !manualDismiss) rotateOverlay.style.display = 'flex';
  else rotateOverlay.style.display = 'none';
}

/* ===============================
   ❄️ REFINED SNOW SYSTEM
================================ */
class SnowParticle {
  constructor(startOnScreen = false) { this.reset(startOnScreen); }
  reset(startOnScreen = false) {
    this.x = Math.random() * BG_WIDTH;
    this.y = startOnScreen ? Math.random() * BG_HEIGHT : -50 - Math.random() * 200;
    this.size = Math.random() * 4 + 2; 
    this.baseSpeed = Math.random() * 1 + 0.5; 
    this.speed = this.baseSpeed; 
    this.velX = (Math.random() - 0.5) * 0.5; 
    this.opacity = 0; 
    this.meltY = 740 + Math.random() * 60; 
  }
  update(forceStop) {
    if (this.y < this.meltY) {
      this.y += this.speed;
      this.x += this.velX + Math.sin(this.y * 0.01) * 0.2; 
      if (this.opacity < 0.8) this.opacity += 0.01; 
      if (this.speed > this.baseSpeed) this.speed *= 0.97; // Decay boost
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
   🎨 SPRITE CLASS & CHARACTERS
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
    this.soundPath = `assets/sounds/${this.name.toLowerCase()}.mp3`;
    this.sound = new Audio(this.soundPath);
    this.load();
  }
  async load() {
    try {
      const resp = await fetch(this.jsonPath);
      this.fullData = await resp.json();
      this.frameNames = Object.keys(this.fullData.frames).sort((a, b) => a.localeCompare(b, undefined, {numeric: true, sensitivity: 'base'}));
      this.ready = true; sortCharacters(); 
    } catch (e) { console.error("JSON Error", e); }
  }
  playSound() { if (this.sound) { this.sound.currentTime = 0; this.sound.play().catch(e => {}); } }
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
      if (this.name === "Shannon" && shannonState === "trick") { jumpY = Math.sin((trickTimer / TRICK_DURATION) * Math.PI) * -200; }
      else if (this.name === "Leah" && this.state === "action") {
        const totalJumpFrames = this.actionFrames.length * 3;
        const currentProgress = (this.repeatCount * this.actionFrames.length + this.index) / totalJumpFrames;
        jumpY = Math.sin(currentProgress * Math.PI) * -120;
      }
      const pivotX = this.x + (s.x / this.assetScale) + (drawW / 2);
      const pivotY = this.y + (s.y / this.assetScale) + (drawH / 2) + this.yOffset + jumpY;
      ctx.translate(pivotX, pivotY);
      if (this.name === "Shannon" && shannonState === "trick") { ctx.rotate((trickTimer / TRICK_DURATION) * Math.PI * 4); }
      if ((this.name === "Crabman" && this.crabPhase === 0) || (this.name === "Rabbitman" && this.crabPhase === 1)) { ctx.scale(-1, 1); }
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
        else { this.stutterCount++; if (this.stutterCount < this.stutterQueue[this.stutterStage].target) { this.index = 0; } else { this.stutterStage++; this.stutterCount = 0; this.index = 0; if (this.stutterStage >= this.stutterQueue.length) this.finalize(); } }
      } else { this.finalize(); }
    } else { this.index = 0; }
  }
  finalize() { this.index = 0; this.state = "idle"; this.repeatCount = 0; this.stutterStage = -1; this.stutterCount = 0; this.rabbitSubPhase = 0; }
  checkHit(tx, ty) {
    let isHit = (tx >= this.x && tx <= this.x + this.w && ty >= this.y + this.yOffset - 100 && ty <= this.y + this.yOffset + this.h + 100);
    if (isHit) {
      this.playSound(); 
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

const characters = [
  new Sprite("Rabbitman", "assets/rabbitman.json", "assets/rabbitman.webp", 1300, 630, [0], [], 1, [], 1, 0, 98),
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

/* ===============================
   🚀 ENGINE & RENDER
================================ */
async function initShannonPath() {
  try {
    const resp = await fetch('assets/path.svg');
    const text = await resp.text();
    const xml = new DOMParser().parseFromString(text, "image/svg+xml");
    const pathElem = xml.querySelector('path');
    if (pathElem) { shannonPath.setAttribute("d", pathElem.getAttribute('d')); shannonPathLength = pathElem.getTotalLength(); }
  } catch(e) { console.error("Path error", e); }
}

function updateShannon(delta) {
  const s = characters.find(c => c.name === "Shannon");
  if (!s || !shannonPathLength) return;
  if (shannonState === "skating" || shannonState === "trick") {
    const speedMultiplier = (shannonState === "trick") ? 1.5 : 1.0;
    shannonProgress += SHANNON_SPEED * delta * speedMultiplier;
    if (shannonProgress <= 1.0) {
      const point = shannonPath.getPointAtLength((1 - shannonProgress) * shannonPathLength);
      s.x = point.x; s.y = point.y;
    } else { s.x -= 8 * speedMultiplier; if (s.x < -400) { shannonState = "waiting"; shannonWaitTimer = 0; } }
  } else if (shannonState === "waiting") {
    shannonWaitTimer += delta; if (shannonWaitTimer >= SHANNON_WAIT) { shannonProgress = 0; shannonState = "skating"; }
  }
  if (shannonState === "trick") { trickTimer += delta; if (trickTimer >= TRICK_DURATION) shannonState = "skating"; }
}

function sortCharacters() { characters.sort((a, b) => a.zIndex - b.zIndex); }

let lastTime = 0;
function render(time) {
  const delta = time - lastTime; lastTime = time;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  ctx.save();
  if (screenShake > 0) { ctx.translate((Math.random() - 0.5) * screenShake, (Math.random() - 0.5) * screenShake); screenShake *= 0.85; if (screenShake < 1) screenShake = 0; }

  skyTime += 0.015; let currentHue = Math.sin(skyTime) * 20; 
  ctx.save(); ctx.scale(worldScale, worldScale); 
  ctx.filter = `hue-rotate(${currentHue}deg) brightness(0.8)`; 
  if (skyImg.complete) ctx.drawImage(skyImg, 0, 0); 
  ctx.filter = 'none'; 
  if (mountainImg.complete) ctx.drawImage(mountainImg, 0, 0);

  weatherTimer += delta;
  let forceStop = (weatherTimer > SNOW_DURATION);
  snowParticles.forEach((p, i) => { if (i < activeSnowCount) { p.update(forceStop); p.draw(); } });
  if (weatherTimer > SNOW_DURATION + CLEAR_DURATION) { weatherTimer = 0; }

  updateShannon(delta); 
  characters.forEach(c => c.update(time)); 
  ctx.restore(); ctx.restore();
  requestAnimationFrame(render);
}

function handleResize() { worldScale = window.innerHeight / BG_HEIGHT; canvas.height = window.innerHeight; canvas.width = BG_WIDTH * worldScale; checkOrientation(); }
window.addEventListener('resize', handleResize); handleResize();

/* 📱 MOBILE INPUT OPTIMIZATION */
const handleInteraction = (e) => {
    // Permission request for iOS motion
    if (typeof DeviceMotionEvent.requestPermission === 'function') {
        DeviceMotionEvent.requestPermission().then(state => { if (state === 'granted') window.addEventListener('devicemotion', handleMotion); });
    } else { window.addEventListener('devicemotion', handleMotion); }

    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const worldX = (clientX - rect.left) / worldScale;
    const worldY = (clientY - rect.top) / worldScale;
    [...characters].sort((a,b) => b.zIndex - a.zIndex).forEach(c => c.checkHit(worldX, worldY));
};

// Remove click lag by using touchstart
canvas.addEventListener('touchstart', handleInteraction, {passive: false});
canvas.addEventListener('mousedown', handleInteraction);

initShannonPath(); requestAnimationFrame(render);
