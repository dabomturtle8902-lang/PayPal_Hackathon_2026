import {
  AmbientLight,
  CanvasTexture,
  DirectionalLight,
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  SRGBColorSpace,
  Scene,
  Shape,
  WebGLRenderer,
} from './three.module.min.js';

const CARD_DESIGNS = [
  {
    id: 'pp-balance',
    brand: 'PayPal Wallet',
    title: 'PayPal Balance Card',
    last4: '4829',
    badge: 'Primary · USD',
    colors: ['#0A3D9E', '#1457D9', '#1F7AE0'],
    showBalance: true,
  },
  {
    id: 'pp-cashback',
    brand: 'Mastercard',
    title: 'PayPal Cashback',
    last4: '9104',
    badge: '3% Cashback',
    colors: ['#141B31', '#243B6B', '#0E6E74'],
    showBalance: false,
  },
  {
    id: 'pp-travel',
    brand: 'PayPal Global',
    title: 'Multi-Currency Travel',
    last4: '3318',
    badge: 'USD · GBP · EUR',
    colors: ['#123635', '#136B63', '#2B3758'],
    showBalance: false,
  },
];

function drawCardTexture(card, walletBalanceCents) {
  const c = document.createElement('canvas');
  c.width = 680;
  c.height = 420;
  const ctx = c.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, c.width, c.height);
  grad.addColorStop(0, card.colors[0]);
  grad.addColorStop(0.55, card.colors[1]);
  grad.addColorStop(1, card.colors[2]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, c.width, c.height);

  // Subtle geometric sheen circles
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  ctx.beginPath();
  ctx.arc(570, 82, 175, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  ctx.beginPath();
  ctx.arc(140, 390, 140, 0, Math.PI * 2);
  ctx.fill();

  // Brand pill
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  roundRect(ctx, 42, 36, 172, 40, 12);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 20px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(card.brand, 60, 63);

  // Badge pill
  ctx.fillStyle = 'rgba(0,0,0,0.24)';
  roundRect(ctx, 452, 36, 186, 38, 19);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '700 18px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(card.badge, 474, 62);

  // EMV Chip
  ctx.fillStyle = '#F3D37A';
  roundRect(ctx, 44, 152, 68, 48, 9);
  ctx.fill();
  ctx.strokeStyle = 'rgba(24,32,53,0.28)';
  ctx.lineWidth = 2;
  ctx.strokeRect(56, 164, 44, 24);

  // Contactless arcs
  ctx.strokeStyle = 'rgba(255,255,255,0.78)';
  ctx.lineWidth = 3.2;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(130, 176, 10 + i * 7, -0.7, 0.7);
    ctx.stroke();
  }

  // Balance if primary PayPal card
  if (card.showBalance) {
    const bal = `$${(walletBalanceCents / 100).toFixed(2)} USD`;
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255,255,255,0.78)';
    ctx.font = '700 16px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText('Available balance', 636, 158);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 29px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText(bal, 636, 194);
    ctx.textAlign = 'left';
  }

  // Title + Masked Number + Holder
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '700 20px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(card.title, 44, 294);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 32px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(`••••   ••••   ••••   ${card.last4}`, 44, 344);

  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(255,255,255,0.78)';
  ctx.font = '800 19px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText('LEAH MORGAN', 636, 344);
  ctx.textAlign = 'left';

  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function roundedCardShape(w, h, r) {
  const s = new Shape();
  const hw = w / 2;
  const hh = h / 2;
  s.moveTo(-hw + r, -hh);
  s.lineTo(hw - r, -hh);
  s.quadraticCurveTo(hw, -hh, hw, -hh + r);
  s.lineTo(hw, hh - r);
  s.quadraticCurveTo(hw, hh, hw - r, hh);
  s.lineTo(-hw + r, hh);
  s.quadraticCurveTo(-hw, hh, -hw, hh - r);
  s.lineTo(-hw, -hh + r);
  s.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
  return s;
}

let activeController = null;

export function mountWallet3DCards(canvas, initialState) {
  if (activeController && activeController.canvas === canvas) {
    activeController.update(initialState.activeCardIndex, initialState.walletBalanceCents);
    return activeController;
  }
  if (activeController) {
    activeController.dispose();
    activeController = null;
  }

  let renderer;
  try {
    renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true });
  } catch {
    return null;
  }

  const width = canvas.clientWidth || 360;
  const height = canvas.clientHeight || 220;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height, false);

  const scene = new Scene();
  const camera = new PerspectiveCamera(36, width / height, 0.1, 100);
  camera.position.set(0, 0.1, 6.2);

  scene.add(new AmbientLight(0xffffff, 1.45));
  const dir = new DirectionalLight(0xffffff, 1.35);
  dir.position.set(3, 5, 6);
  scene.add(dir);

  const cardW = 3.55;
  const cardH = 2.18;
  const deckGroup = new Group();
  scene.add(deckGroup);

  const shape = roundedCardShape(cardW, cardH, 0.22);
  const bodyGeo = new ExtrudeGeometry(shape, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 3 });
  bodyGeo.center();

  const frontGeo = new ExtrudeGeometry(roundedCardShape(cardW - 0.02, cardH - 0.02, 0.20), { depth: 0.002, bevelEnabled: false });
  frontGeo.center();
  // Normalize UVs cleanly across card bounds [0..1]
  const posAttr = frontGeo.attributes.position;
  const uvArr = new Float32Array(posAttr.count * 2);
  for (let i = 0; i < posAttr.count; i++) {
    uvArr[i * 2] = (posAttr.getX(i) + cardW / 2) / cardW;
    uvArr[i * 2 + 1] = (posAttr.getY(i) + cardH / 2) / cardH;
  }
  frontGeo.setAttribute('uv', new (posAttr.constructor)(uvArr, 2));

  let state = { ...initialState };
  let ptrX = 0;
  let ptrY = 0;
  let disposed = false;
  let rafId = 0;
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const cards = CARD_DESIGNS.map((design, idx) => {
    const group = new Group();
    const edgeMat = new MeshStandardMaterial({ color: design.colors[0], metalness: 0.35, roughness: 0.35 });
    const bodyMesh = new Mesh(bodyGeo, edgeMat);
    const tex = drawCardTexture(design, state.walletBalanceCents);
    const faceMat = new MeshBasicMaterial({ map: tex });
    const faceMesh = new Mesh(frontGeo, faceMat);
    faceMesh.position.z = 0.04;
    group.add(bodyMesh, faceMesh);
    deckGroup.add(group);
    return { design, idx, group, faceMat, tex };
  });

  const onMove = (e) => {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    ptrX = ((e.clientX - rect.left) / rect.width - 0.5) * 0.42;
    ptrY = ((e.clientY - rect.top) / rect.height - 0.5) * 0.28;
  };
  const onLeave = () => { ptrX = 0; ptrY = 0; };
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerleave', onLeave);

  function tick(t) {
    if (disposed || !canvas.isConnected) {
      dispose();
      return;
    }
    const cw = canvas.clientWidth || width;
    const ch = canvas.clientHeight || height;
    if (cw > 0 && ch > 0 && (canvas.width !== Math.round(cw * renderer.getPixelRatio()) || canvas.height !== Math.round(ch * renderer.getPixelRatio()))) {
      renderer.setSize(cw, ch, false);
      camera.aspect = cw / ch;
      camera.updateProjectionMatrix();
    }

    const total = cards.length;
    const active = ((state.activeCardIndex % total) + total) % total;
    const lerpSpeed = reduceMotion ? 1 : 0.14;
    const floatY = reduceMotion ? 0 : Math.sin(t * 0.0022) * 0.045;

    deckGroup.rotation.y += (ptrX - deckGroup.rotation.y) * lerpSpeed;
    deckGroup.rotation.x += (ptrY - deckGroup.rotation.x) * lerpSpeed;
    deckGroup.position.y = floatY;

    cards.forEach((c) => {
      const depth = (c.idx - active + total) % total;
      const targetX = depth === 0 ? -0.1 : depth === 1 ? 0.36 : 0.72;
      const targetY = depth === 0 ? 0.06 : depth === 1 ? -0.05 : -0.15;
      const targetZ = depth === 0 ? 0.45 : depth === 1 ? -0.22 : -0.78;
      const targetRotZ = depth === 0 ? 0 : depth === 1 ? -0.055 : -0.11;
      const targetRotY = depth === 0 ? -0.04 : depth === 1 ? -0.12 : -0.20;
      const s = depth === 0 ? 1 : depth === 1 ? 0.94 : 0.88;

      c.group.position.x += (targetX - c.group.position.x) * lerpSpeed;
      c.group.position.y += (targetY - c.group.position.y) * lerpSpeed;
      c.group.position.z += (targetZ - c.group.position.z) * lerpSpeed;
      c.group.rotation.z += (targetRotZ - c.group.rotation.z) * lerpSpeed;
      c.group.rotation.y += (targetRotY - c.group.rotation.y) * lerpSpeed;
      c.group.scale.setScalar(c.group.scale.x + (s - c.group.scale.x) * lerpSpeed);
    });

    renderer.render(scene, camera);
    rafId = requestAnimationFrame(tick);
  }

  function update(activeCardIndex, walletBalanceCents) {
    const balanceChanged = walletBalanceCents !== state.walletBalanceCents;
    state = { activeCardIndex, walletBalanceCents };
    if (balanceChanged) {
      const primary = cards[0];
      primary.tex.dispose();
      primary.tex = drawCardTexture(primary.design, walletBalanceCents);
      primary.faceMat.map = primary.tex;
      primary.faceMat.needsUpdate = true;
    }
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(rafId);
    canvas.removeEventListener('pointermove', onMove);
    canvas.removeEventListener('pointerleave', onLeave);
    cards.forEach((c) => {
      c.tex.dispose();
      c.faceMat.dispose();
    });
    bodyGeo.dispose();
    frontGeo.dispose();
    renderer.dispose();
    if (activeController?.canvas === canvas) activeController = null;
  }

  rafId = requestAnimationFrame(tick);
  activeController = { canvas, update, dispose };
  return activeController;
}
