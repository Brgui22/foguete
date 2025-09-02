// --- CONFIGURAÇÃO INICIAL ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- ELEMENTOS DA UI ---
const shipPreviewCanvas = document.getElementById('ship-preview-canvas');
const shipPreviewCtx = shipPreviewCanvas.getContext('2d');
const totalCoinsEl = document.getElementById('total-coins');
const coinsEarnedEl = document.getElementById('coins-earned');
const gameOverScreen = document.getElementById('gameOverScreen');
const finalScoreEl = document.getElementById('finalScore');
const restartButton = document.getElementById('restartButton');
const scoreEl = document.getElementById('score');
const instructionsEl = document.getElementById('instructions');
const statsAltitudeEl = document.getElementById('statsAltitude');
const statsSpeedEl = document.getElementById('statsSpeed');
const statsTimeEl = document.getElementById('statsTime');

canvas.width = 1200; canvas.height = 700;

// --- VARIÁVEIS DO JOGO ---
let gameState = 'ready';
let score = 0;
let totalCoins = 0;
let maxAltitude = 0; let maxSpeed = 0; let flightStartTime = 0;

// --- CÂMERA E MUNDO ---
const camera = { x: 0, y: 0 };
const LERP_FACTOR = 0.08; // Suavidade da câmera (menor = mais suave)
const ALTITUDE_SPACE_START = 5000; // Altitude em "metros" para o espaço começar

// Constantes e objetos do jogo
const gravity = 0.2, groundLevel = canvas.height - 100, BOUNCINESS = 0.6, FRICTION = 0.95;
const ship = { x: 150, y: groundLevel, width: 60, height: 25, angle: -30, velX: 0, velY: 0 };
const powerMeter = { value: 0, speed: 2.5, direction: 1 };
let scenery = [], particles = [], windLines = [], clouds = [], stars = [];


// --- PERSISTÊNCIA DE DADOS (LocalStorage) ---
function saveGameData() {
    const data = {
        totalCoins: totalCoins
    };
    localStorage.setItem('lançamentoSideralData', JSON.stringify(data));
}

function loadGameData() {
    const savedData = localStorage.getItem('lançamentoSideralData');
    if (savedData) {
        const data = JSON.parse(savedData);
        totalCoins = data.totalCoins || 0;
    }
    updateCoinDisplay();
}

function updateCoinDisplay() {
    totalCoinsEl.innerText = totalCoins.toLocaleString();
}

function formatDistance(meters) {
    if (meters >= 1000) {
        const kilometers = meters / 1000;
        return `${kilometers.toFixed(2).replace(/\.00$/, '')} km`;
    }
    return `${Math.round(meters)} m`;
}

// --- DESENHO DO FOGUETE NO HANGAR (PREVIEW) ---
function drawShipPreview() {
    shipPreviewCtx.clearRect(0, 0, shipPreviewCanvas.width, shipPreviewCanvas.height);
    const previewX = shipPreviewCanvas.width / 2;
    const previewY = shipPreviewCanvas.height / 2;
    
    shipPreviewCtx.save();
    shipPreviewCtx.translate(previewX, previewY);
    shipPreviewCtx.rotate(-15 * Math.PI / 180);
    shipPreviewCtx.scale(1.5, 1.5);

    const w = ship.width * 0.5, h = ship.height * 0.5;

    shipPreviewCtx.fillStyle = '#b0c4de';
    shipPreviewCtx.beginPath();
    shipPreviewCtx.moveTo(-w * 0.8, 0); shipPreviewCtx.lineTo(w * 0.5, -h);
    shipPreviewCtx.lineTo(w * 0.8, 0); shipPreviewCtx.lineTo(w * 0.5, h);
    shipPreviewCtx.closePath(); shipPreviewCtx.fill();
    shipPreviewCtx.strokeStyle = '#778899'; shipPreviewCtx.lineWidth = 1; shipPreviewCtx.stroke();

    shipPreviewCtx.fillStyle = '#778899';
    shipPreviewCtx.beginPath();
    shipPreviewCtx.moveTo(w * 0.7, -h); shipPreviewCtx.lineTo(w * 1.1, -h * 2);
    shipPreviewCtx.lineTo(w * 0.8, 0); shipPreviewCtx.closePath(); shipPreviewCtx.fill();
    shipPreviewCtx.beginPath();
    shipPreviewCtx.moveTo(w * 0.7, h); shipPreviewCtx.lineTo(w * 1.1, h * 2);
    shipPreviewCtx.lineTo(w * 0.8, 0); ctx.closePath(); ctx.fill();
    
    shipPreviewCtx.fillStyle = '#dc143c';
    shipPreviewCtx.beginPath();
    shipPreviewCtx.moveTo(w * 0.5, -h); shipPreviewCtx.lineTo(w * 0.8, 0);
    shipPreviewCtx.lineTo(w * 0.5, h); shipPreviewCtx.closePath(); shipPreviewCtx.fill();

    shipPreviewCtx.restore();
}

// --- GERAÇÃO DO MUNDO ---
function generateWorld() {
    // Gera cenário do chão
    scenery = [];
    for (let i = 0; i < 500; i++) {
        const x = i * (Math.random() * 200 + 250);
        const type = Math.random() > 0.3 ? 'mountain' : 'house';
        if (type === 'mountain') {
            scenery.push({type: 'mountain', x, y: groundLevel, base: Math.random() * 200 + 100, height: Math.random() * 400 + 150});
        } else {
            scenery.push({type: 'house', x, y: groundLevel - (Math.random() * 30 + 40), width: 60, height: Math.random() * 30 + 50, color: `hsl(${Math.random() * 60 + 200}, 50%, 60%)`});
        }
    }
    // Gera nuvens em várias altitudes
    clouds = [];
    for (let i = 0; i < 200; i++) {
        clouds.push({
            x: Math.random() * 40000 - 10000,
            y: groundLevel - (Math.random() * ALTITUDE_SPACE_START * 1.5 + 500),
            size: Math.random() * 50 + 50
        });
    }
    // Gera estrelas no espaço
    stars = [];
    for (let i = 0; i < 500; i++) {
        stars.push({
            x: Math.random() * 50000 - 15000,
            y: groundLevel - (Math.random() * 20000 + ALTITUDE_SPACE_START),
            size: Math.random() * 2 + 0.5
        });
    }
}


// --- PARTÍCULAS ---
function createSparks(x, y) {
    const sparkCount = 20;
    for (let i = 0; i < sparkCount; i++) {
        particles.push({ type: 'spark', x, y, velX: (Math.random() - 0.5) * 8, velY: -Math.random() * 10, size: Math.random() * 3 + 1, life: Math.random() * 60 + 30, color: Math.random() > 0.3 ? '#FFA500' : '#FFD700' });
    }
}
function createWindLines() {
    if (gameState === 'inFlight' && ship.velX > 5 && ship.y < groundLevel) {
        if (Math.random() < 0.3) {
            windLines.push({ x: canvas.width + Math.random() * 100, y: Math.random() * canvas.height, length: Math.random() * 40 + 20, speed: ship.velX * 0.4 + 3, alpha: 0, maxAlpha: Math.random() * 0.4 + 0.2, pulseOffset: Math.random() * Math.PI * 2 });
        }
    }
}
function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.velY += gravity * 0.5;
        p.x += p.velX; p.y += p.velY; p.life--;
        if (p.life <= 0) { particles.splice(i, 1); }
    }
    for (let i = windLines.length - 1; i >= 0; i--) {
        const w = windLines[i];
        w.x -= w.speed;
        if (w.alpha < w.maxAlpha) { w.alpha += 0.02; } 
        else if (w.x < canvas.width * 0.2) { w.alpha -= 0.03; }
        w.alpha *= (1 + Math.sin(Date.now() * 0.01 + w.pulseOffset) * 0.1);
        if (w.x + w.length < 0 || w.alpha <= 0) { windLines.splice(i, 1); }
    }
}


// --- LÓGICA PRINCIPAL ---
function resetGame() {
    gameState = 'ready'; score = 0;
    maxAltitude = 0; maxSpeed = 0; flightStartTime = 0;
    ship.x = 150; ship.y = groundLevel;
    ship.velX = 0; ship.velY = 0;
    camera.x = 0; camera.y = 0;
    powerMeter.value = 0;
    particles = []; windLines = [];
    gameOverScreen.classList.add('hidden');
    instructionsEl.classList.remove('hidden');
}

function update() {
    if (gameState === 'charging') {
        powerMeter.value += powerMeter.speed * powerMeter.direction;
        if (powerMeter.value >= 100) { powerMeter.value = 100; powerMeter.direction = -1; }
        if (powerMeter.value <= 0) { powerMeter.value = 0; powerMeter.direction = 1; }
    } else if (gameState === 'inFlight') {
        ship.velY += gravity;
        ship.x += ship.velX; ship.y += ship.velY;
        
        const currentDistance = Math.floor(ship.x - 150);
        if (currentDistance > score) { score = currentDistance; }

        const currentAltitude = groundLevel - ship.y;
        if (currentAltitude > maxAltitude) { maxAltitude = currentAltitude; }
        const currentSpeed = Math.sqrt(ship.velX**2 + ship.velY**2);
        if (currentSpeed > maxSpeed) { maxSpeed = currentSpeed; }

        if (ship.y >= groundLevel) {
            ship.y = groundLevel;
            if (Math.abs(ship.velY) > 2) { createSparks(ship.x, ship.y); }
            ship.velY = -ship.velY * BOUNCINESS;
            ship.velX *= FRICTION;
            if (Math.abs(ship.velY) < 1) { ship.velY = 0; }
            if (Math.abs(ship.velX) < 0.1 && ship.velY === 0) {
                ship.velX = 0; gameState = 'gameOver';
                const flightDuration = (Date.now() - flightStartTime) / 1000;
                
                const coinsEarned = Math.floor(score / 10);
                totalCoins += coinsEarned;
                updateCoinDisplay();
                saveGameData();

                finalScoreEl.innerText = formatDistance(score);
                coinsEarnedEl.innerText = `+ ${coinsEarned.toLocaleString()} moedas`;
                statsAltitudeEl.innerText = formatDistance(maxAltitude);
                statsSpeedEl.innerText = Math.round(maxSpeed * 10);
                statsTimeEl.innerText = `${flightDuration.toFixed(1)} s`;
                gameOverScreen.classList.remove('hidden');
            }
        }
    }

    // Lógica da Câmera
    const targetX = ship.x - canvas.width * 0.4;
    const targetY = ship.y - canvas.height * 0.6;
    camera.x += (targetX - camera.x) * LERP_FACTOR;
    camera.y += (targetY - camera.y) * LERP_FACTOR;
    
    // Trava a câmera para não ir abaixo do chão (agora usando groundLevel)
    const minCameraY = groundLevel - canvas.height;
    if (camera.y > minCameraY) {
        camera.y = minCameraY;
    }

    createWindLines();
    updateParticles();
    draw();
    requestAnimationFrame(update);
}

// --- FUNÇÕES DE DESENHO ---
function drawShip() {
    ctx.save();
    ctx.translate(ship.x, ship.y);
    let currentAngle = ship.angle;
    if (gameState === 'inFlight' && (ship.velX !== 0 || ship.velY !== 0)) {
        currentAngle = Math.atan2(ship.velY, ship.velX) * 180 / Math.PI;
    } else if (gameState === 'gameOver' || (gameState === 'inFlight' && ship.velY === 0)) {
        currentAngle = 0;
    }
    ctx.rotate(currentAngle * Math.PI / 180);
    ctx.fillStyle = '#b0c4de';
    ctx.beginPath();
    ctx.moveTo(-ship.width * 0.8, 0); ctx.lineTo(ship.width * 0.5, -ship.height / 2);
    ctx.lineTo(ship.width * 0.8, 0); ctx.lineTo(ship.width * 0.5, ship.height / 2);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#778899'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#778899';
    ctx.beginPath();
    ctx.moveTo(ship.width * 0.7, -ship.height / 2); ctx.lineTo(ship.width * 1.1, -ship.height);
    ctx.lineTo(ship.width * 0.8, 0); ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(ship.width * 0.7, ship.height / 2); ctx.lineTo(ship.width * 1.1, ship.height);
    ctx.lineTo(ship.width * 0.8, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#dc143c';
    ctx.beginPath();
    ctx.moveTo(ship.width * 0.5, -ship.height / 2); ctx.lineTo(ship.width * 0.8, 0);
    ctx.lineTo(ship.width * 0.5, ship.height / 2); ctx.closePath(); ctx.fill();
    if (gameState === 'charging' || (gameState === 'inFlight' && ship.y < groundLevel)) {
        ctx.fillStyle = 'orange';
        ctx.beginPath();
        ctx.moveTo(-ship.width * 0.8, 0); ctx.lineTo(-ship.width * 1.2, -ship.height / 4);
        ctx.lineTo(-ship.width * 1.5, 0); ctx.lineTo(-ship.width * 1.2, ship.height / 4);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'yellow';
        ctx.beginPath();
        ctx.moveTo(-ship.width * 0.9, 0); ctx.lineTo(-ship.width * 1.3, -ship.height / 8);
        ctx.lineTo(-ship.width * 1.4, 0); ctx.lineTo(-ship.width * 1.3, ship.height / 8);
        ctx.closePath(); ctx.fill();
    }
    ctx.restore();
}

function drawPowerMeter() {
    if (gameState !== 'charging') return;
    const centerX = canvas.width / 2;
    const centerY = canvas.height - 130;
    const radius = 100;
    const startAngle = Math.PI * 0.75;
    const endAngle = Math.PI * 2.25;
    const totalAngle = endAngle - startAngle;
    const bezelGradient = ctx.createLinearGradient(centerX - radius, centerY - radius, centerX + radius, centerY + radius);
    bezelGradient.addColorStop(0, '#d9d9d9');
    bezelGradient.addColorStop(1, '#8c8c8c');
    ctx.fillStyle = bezelGradient;
    ctx.beginPath(); ctx.arc(centerX, centerY, radius + 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#000000';
    ctx.beginPath(); ctx.arc(centerX, centerY, radius, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i <= 100; i += 5) {
        const angle = startAngle + (totalAngle * (i / 100));
        const isMajorTick = i % 20 === 0;
        const tickLength = isMajorTick ? 15 : 8;
        const tickWidth = isMajorTick ? 3 : 1.5;
        const startX = centerX + Math.cos(angle) * (radius - 5);
        const startY = centerY + Math.sin(angle) * (radius - 5);
        const endX = centerX + Math.cos(angle) * (radius - 5 - tickLength);
        const endY = centerY + Math.sin(angle) * (radius - 5 - tickLength);
        ctx.strokeStyle = 'white'; ctx.lineWidth = tickWidth;
        ctx.beginPath(); ctx.moveTo(startX, startY); ctx.lineTo(endX, endY); ctx.stroke();
        if (isMajorTick) {
            ctx.fillStyle = 'white'; ctx.font = '20px Arial'; ctx.textAlign = 'center';
            const textX = centerX + Math.cos(angle) * (radius - 35);
            const textY = centerY + Math.sin(angle) * (radius - 35) + 7;
            ctx.fillText(i.toString(), textX, textY);
        }
    }
    const currentAngle = startAngle + (totalAngle * (powerMeter.value / 100));
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(currentAngle);
    ctx.strokeStyle = '#ff3333'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(radius - 15, 0); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath(); ctx.arc(centerX, centerY, 15, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#333333'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = 'white'; ctx.font = 'bold 22px Arial'; ctx.textAlign = 'center';
    ctx.fillText('FORÇA', centerX, centerY + 40);
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Lógica de cor do céu baseada na altitude da NAVE
    const shipAltitude = Math.max(0, groundLevel - ship.y); // Altitude real da nave
    const altitudeRatio = Math.min(1, shipAltitude / ALTITUDE_SPACE_START);

    // Cores: Céu azul claro -> Espaço escuro
    const rStart = 135, gStart = 206, bStart = 235; // Light Sky Blue
    const rEnd = 0, gEnd = 0, bEnd = 16;           // Cor do espaço
    
    const r = rStart + (rEnd - rStart) * altitudeRatio;
    const g = gStart + (gEnd - gStart) * altitudeRatio;
    const b = bStart + (bEnd - bStart) * altitudeRatio;
    ctx.fillStyle = `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Camadas de Parallax
    ctx.save();
    ctx.translate(-camera.x * 0.2, -camera.y * 0.2);
    stars.forEach(star => {
        ctx.fillStyle = 'white';
        ctx.beginPath(); ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2); ctx.fill();
    });
    ctx.restore();

    ctx.save();
    ctx.translate(-camera.x * 0.5, -camera.y * 0.5);
    clouds.forEach(cloud => {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.beginPath(); ctx.ellipse(cloud.x, cloud.y, cloud.size, cloud.size * 0.6, 0, 0, Math.PI * 2); ctx.fill();
    });
    ctx.restore();
    
    // Mundo Principal
    ctx.save();
    ctx.translate(-camera.x, -camera.y);

    scenery.forEach(obj => {
        if (obj.type === 'mountain') {
            ctx.fillStyle = '#2c3e50';
            ctx.beginPath(); ctx.moveTo(obj.x - obj.base / 2, obj.y); ctx.lineTo(obj.x, obj.y - obj.height); ctx.lineTo(obj.x + obj.base / 2, obj.y); ctx.closePath(); ctx.fill();
        } else {
            ctx.fillStyle = obj.color;
            ctx.fillRect(obj.x, obj.y, obj.width, obj.height);
            ctx.fillStyle = '#a0522d';
            ctx.beginPath(); ctx.moveTo(obj.x - 5, obj.y); ctx.lineTo(obj.x + obj.width / 2, obj.y - obj.height / 3); ctx.lineTo(obj.x + obj.width + 5, obj.y); ctx.closePath(); ctx.fill();
        }
    });

    // Plataforma de Lançamento
    ctx.fillStyle = '#555';
    ctx.fillRect(50, groundLevel, 200, 20);
    ctx.fillStyle = '#777';
    ctx.fillRect(40, groundLevel + 20, 220, 10);

    // CHÃO VERDE: Agora com uma largura bem grande para cobrir todo o horizonte
    ctx.fillStyle = '#27ae60'; // Verde grama
    ctx.fillRect(-100000, groundLevel, 200000, 500); // Cobrindo uma vasta área horizontal

    particles.forEach(p => {
        ctx.globalAlpha = p.life / 60;
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1.0;
    });
    
    drawShip();
    ctx.restore();

    // UI (Vento e Score)
    windLines.forEach(w => {
        ctx.strokeStyle = `rgba(255, 255, 255, ${w.alpha})`;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(w.x, w.y); ctx.lineTo(w.x + w.length, w.y); ctx.stroke();
    });
    
    scoreEl.innerText = `Distância: ${formatDistance(score)}`;
    drawPowerMeter();
}

// --- EVENT LISTENERS ---
function handleStart(e) { if (gameState === 'ready') { e.preventDefault(); gameState = 'charging'; instructionsEl.classList.add('hidden'); } }
function handleEnd(e) {
    if (gameState === 'charging') {
        e.preventDefault(); gameState = 'inFlight';
        flightStartTime = Date.now();
        const launchForce = (powerMeter.value / 100) * 45; // Aumentei um pouco a força para alcançar o espaço
        const angleRad = Math.abs(ship.angle * Math.PI / 180);
        ship.velX = Math.cos(angleRad) * launchForce;
        ship.velY = -Math.sin(angleRad) * launchForce;
    }
}
canvas.addEventListener('mousedown', handleStart);
canvas.addEventListener('mouseup', handleEnd);
canvas.addEventListener('touchstart', handleStart);
canvas.addEventListener('touchend', handleEnd);
restartButton.addEventListener('click', resetGame);

// --- INÍCIO DO JOGO ---
function init() {
    loadGameData();
    generateWorld();
    drawShipPreview();
    resetGame();
    update();
}
init();