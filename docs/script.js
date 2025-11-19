// Configuration
const CONFIG = {
  socketURL: 'http://localhost:3000',
  canvasSize: 600,
  colors: [
    '#ef4444',
    '#f97316',
    '#f59e0b',
    '#84cc16',
    '#10b981',
    '#06b6d4',
    '#3b82f6',
    '#8b5cf6',
    '#ec4899'
  ]
};

// Helper function to darken color for border
function darkenColor(hex, percent) {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = (num >> 16) - amt;
  const G = (num >> 8 & 0x00FF) - amt;
  const B = (num & 0x0000FF) - amt;
  return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
    (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
    (B < 255 ? B < 1 ? 0 : B : 255))
    .toString(16).slice(1);
}

// State
const state = {
  socket: null,
  canvas: null,
  ctx: null,
  isDrawing: false,
  currentColor: CONFIG.colors[0],
  brushSize: 15,
  symmetry: 8,
  glowIntensity: 0.7,
  showGuides: true,
  showParticles: true,
  currentPattern: 'dot',
  strokes: [],
  particles: []
};

// Initialize
document.addEventListener('DOMContentLoaded', init);

function init() {
  setupCanvas();
  setupSocket();
  setupControls();
  initColorPalette();
  startAnimation();
}

// Canvas Setup
function setupCanvas() {
  state.canvas = document.getElementById('rangoliCanvas');
  state.ctx = state.canvas.getContext('2d');
  
  state.canvas.width = CONFIG.canvasSize;
  state.canvas.height = CONFIG.canvasSize;
  
  // Mouse events
  state.canvas.addEventListener('mousedown', handleMouseDown);
  state.canvas.addEventListener('mousemove', handleMouseMove);
  state.canvas.addEventListener('mouseup', handleMouseUp);
  state.canvas.addEventListener('mouseleave', handleMouseUp);
  
  // Touch events
  state.canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
  state.canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
  state.canvas.addEventListener('touchend', handleMouseUp);
  
  redrawCanvas();
}

// Socket.io Setup
function setupSocket() {
  state.socket = io(CONFIG.socketURL);
  
  state.socket.on('draw', (data) => {
    state.strokes.push(data.stroke);
    if (state.showParticles) {
      createParticlesBurst(data.stroke.x, data.stroke.y, data.stroke.color);
    }
    redrawCanvas();
  });
  
  state.socket.on('clear', () => {
    state.strokes = [];
    state.particles = [];
    redrawCanvas();
  });
}

// Controls Setup
function setupControls() {
  // Brush size
  const brushSlider = document.getElementById('brushSize');
  const brushValue = document.getElementById('brushValue');
  
  brushSlider.addEventListener('input', (e) => {
    state.brushSize = parseInt(e.target.value);
    brushValue.textContent = state.brushSize;
  });
  
  // Glow slider
  const glowSlider = document.getElementById('glowSlider');
  const glowValue = document.getElementById('glowValue');
  
  glowSlider.addEventListener('input', (e) => {
    state.glowIntensity = parseFloat(e.target.value) / 100;
    glowValue.textContent = e.target.value + '%';
    redrawCanvas();
  });
  
  // Symmetry buttons
  const symmetryButtons = document.querySelectorAll('.symmetry-btn');
  symmetryButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      symmetryButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.symmetry = parseInt(btn.dataset.symmetry);
      redrawCanvas();
    });
  });
  
  // Toggles
  document.getElementById('guidesToggle').addEventListener('change', (e) => {
    state.showGuides = e.target.checked;
    redrawCanvas();
  });
  
  document.getElementById('particlesToggle').addEventListener('change', (e) => {
    state.showParticles = e.target.checked;
  });
  
  // Pattern buttons
  const patternButtons = document.querySelectorAll('.pattern-btn');
  patternButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      patternButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.currentPattern = btn.dataset.pattern;
    });
  });
  
  // Action buttons
  document.getElementById('undoBtn').addEventListener('click', undoStroke);
  document.getElementById('clearBtn').addEventListener('click', clearCanvas);
  document.getElementById('saveBtn').addEventListener('click', saveImage);
}

// Color Palette
function initColorPalette() {
  const palette = document.getElementById('colorPalette');
  
  CONFIG.colors.forEach((color, index) => {
    const btn = document.createElement('button');
    btn.className = 'color-btn' + (index === 0 ? ' active' : '');
    btn.style.background = color;
    
    // Set border to darker version of the color
    const darkerColor = darkenColor(color, 30);
    btn.style.borderColor = darkerColor;
    
    btn.addEventListener('click', () => {
      document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.currentColor = color;
    });
    
    palette.appendChild(btn);
  });
}

// Drawing Functions
function handleMouseDown(e) {
  state.isDrawing = true;
  draw(e);
}

function handleMouseMove(e) {
  if (!state.isDrawing) return;
  draw(e);
}

function handleMouseUp() {
  state.isDrawing = false;
}

function handleTouchStart(e) {
  e.preventDefault();
  state.isDrawing = true;
  const touch = e.touches[0];
  const mouseEvent = new MouseEvent('mousedown', {
    clientX: touch.clientX,
    clientY: touch.clientY
  });
  draw(mouseEvent);
}

function handleTouchMove(e) {
  e.preventDefault();
  if (!state.isDrawing) return;
  const touch = e.touches[0];
  const mouseEvent = new MouseEvent('mousemove', {
    clientX: touch.clientX,
    clientY: touch.clientY
  });
  draw(mouseEvent);
}

function draw(e) {
  const rect = state.canvas.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * CONFIG.canvasSize;
  const y = ((e.clientY - rect.top) / rect.height) * CONFIG.canvasSize;
  
  const stroke = {
    x,
    y,
    color: state.currentColor,
    size: state.brushSize,
    pattern: state.currentPattern,
    timestamp: Date.now()
  };
  
  state.strokes.push(stroke);
  
  if (state.showParticles) {
    createParticlesBurst(x, y, state.currentColor);
  }
  
  if (state.socket && state.socket.connected) {
    state.socket.emit('draw', { stroke });
  }
  
  redrawCanvas();
}

function undoStroke() {
  if (state.strokes.length > 0) {
    state.strokes.pop();
    redrawCanvas();
  }
}

function clearCanvas() {
  state.strokes = [];
  state.particles = [];
  
  if (state.socket && state.socket.connected) {
    state.socket.emit('clear');
  }
  
  redrawCanvas();
}

function saveImage() {
  const link = document.createElement('a');
  link.download = `rangoli-${Date.now()}.png`;
  link.href = state.canvas.toDataURL('image/png');
  link.click();
}

// Canvas Drawing
function redrawCanvas() {
  const ctx = state.ctx;
  
  // Clear canvas
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, CONFIG.canvasSize, CONFIG.canvasSize);
  
  // Draw guides
  if (state.showGuides) {
    drawGuides(ctx);
  }
  
  // Draw all strokes
  state.strokes.forEach(stroke => {
    drawSymmetricPattern(ctx, stroke);
  });
  
  // Draw particles
  state.particles.forEach(particle => {
    drawParticle(ctx, particle);
  });
}

function drawGuides(ctx) {
  const centerX = CONFIG.canvasSize / 2;
  const centerY = CONFIG.canvasSize / 2;
  const maxRadius = CONFIG.canvasSize / 2 - 20;
  
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 5]);
  
  // Radial lines
  for (let i = 0; i < state.symmetry; i++) {
    const angle = (Math.PI * 2 / state.symmetry) * i;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(
      centerX + Math.cos(angle) * maxRadius,
      centerY + Math.sin(angle) * maxRadius
    );
    ctx.stroke();
  }
  
  // Circles
  const circleCount = 6;
  for (let i = 1; i <= circleCount; i++) {
    const radius = (maxRadius / circleCount) * i;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.stroke();
  }
  
  ctx.setLineDash([]);
}

function drawSymmetricPattern(ctx, stroke) {
  const centerX = CONFIG.canvasSize / 2;
  const centerY = CONFIG.canvasSize / 2;
  const relX = stroke.x - centerX;
  const relY = stroke.y - centerY;
  
  for (let i = 0; i < state.symmetry; i++) {
    const angle = (Math.PI * 2 / state.symmetry) * i;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const x = centerX + (relX * cos - relY * sin);
    const y = centerY + (relX * sin + relY * cos);
    
    // Draw glow
    if (state.glowIntensity > 0) {
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, stroke.size * 2.5);
      gradient.addColorStop(0, stroke.color + 'AA');
      gradient.addColorStop(0.5, stroke.color + Math.floor(state.glowIntensity * 100).toString(16).padStart(2, '0'));
      gradient.addColorStop(1, stroke.color + '00');
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, stroke.size * 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Draw pattern
    drawPattern(ctx, stroke.pattern, x, y, stroke.size, stroke.color);
  }
}

function drawPattern(ctx, pattern, x, y, size, color) {
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  
  switch (pattern) {
    case 'dot':
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
      break;
      
    case 'flower':
      drawFlower(ctx, x, y, size, color);
      break;
      
    case 'star':
      drawStar(ctx, x, y, size, color);
      break;
      
    case 'heart':
      drawHeart(ctx, x, y, size, color);
      break;
  }
}

function drawFlower(ctx, x, y, size, color) {
  const petals = 6;
  const petalLength = size * 1.2;
  const petalWidth = size * 0.6;
  
  ctx.fillStyle = color;
  
  // Draw petals
  for (let i = 0; i < petals; i++) {
    const angle = (Math.PI * 2 / petals) * i;
    
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    
    // Petal shape (elongated ellipse)
    ctx.beginPath();
    ctx.ellipse(0, -size * 0.7, petalWidth, petalLength, 0, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
  }
  
  // Center circle
  ctx.beginPath();
  ctx.arc(x, y, size * 0.4, 0, Math.PI * 2);
  ctx.fill();
}

function drawStar(ctx, x, y, size, color) {
  const spikes = 5;
  const outerRadius = size * 1.3;
  const innerRadius = size * 0.5;
  
  ctx.fillStyle = color;
  ctx.beginPath();
  
  for (let i = 0; i < spikes * 2; i++) {
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    const angle = (Math.PI / spikes) * i - Math.PI / 2;
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    
    if (i === 0) {
      ctx.moveTo(px, py);
    } else {
      ctx.lineTo(px, py);
    }
  }
  
  ctx.closePath();
  ctx.fill();
}

function drawHeart(ctx, x, y, size, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  
  const topCurveHeight = size * 0.3;
  
  ctx.moveTo(x, y + size * 0.3);
  
  // Left side
  ctx.bezierCurveTo(
    x, y - topCurveHeight,
    x - size, y - topCurveHeight,
    x - size, y + size * 0.3
  );
  ctx.bezierCurveTo(
    x - size, y + size * 0.8,
    x - size * 0.5, y + size * 1.2,
    x, y + size * 1.5
  );
  
  // Right side
  ctx.bezierCurveTo(
    x + size * 0.5, y + size * 1.2,
    x + size, y + size * 0.8,
    x + size, y + size * 0.3
  );
  ctx.bezierCurveTo(
    x + size, y - topCurveHeight,
    x, y - topCurveHeight,
    x, y + size * 0.3
  );
  
  ctx.closePath();
  ctx.fill();
}

// Particles
function createParticlesBurst(x, y, color) {
  const particleCount = 12;
  
  for (let i = 0; i < particleCount; i++) {
    const angle = (Math.PI * 2 / particleCount) * i + (Math.random() - 0.5) * 0.5;
    const speed = Math.random() * 1.5 + 0.5;
    
    state.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1,
      size: Math.random() * 2 + 1,
      color
    });
  }
}

function updateParticles() {
  state.particles = state.particles
    .map(p => ({
      ...p,
      x: p.x + p.vx,
      y: p.y + p.vy,
      life: p.life - 0.02,
      vx: p.vx * 0.98,
      vy: p.vy * 0.98
    }))
    .filter(p => p.life > 0);
}

function drawParticle(ctx, particle) {
  const alpha = Math.floor(particle.life * 255).toString(16).padStart(2, '0');
  ctx.fillStyle = particle.color + alpha;
  ctx.beginPath();
  ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
  ctx.fill();
}

// Animation Loop
function startAnimation() {
  function animate() {
    updateParticles();
    redrawCanvas();
    requestAnimationFrame(animate);
  }
  animate();
}