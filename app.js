const canvas = document.getElementById('designerCanvas');
const ctx = canvas.getContext('2d');

const toolToLayer = {
  room: 'structure', rect: 'structure', circle: 'structure',
  window: 'openings', door: 'openings',
  text: 'annotation', measure: 'annotation',
  pen: 'markup', highlighter: 'markup',
};

const state = {
  tool: 'select', previousTool: 'select', handMode: false,
  theme: 'dark', wireframe: false, ortho: false,
  zoom: 1, pan: { x: 80, y: 60 },
  pointerDown: false, dragging: null, panning: null,
  drawing: null, measureTemp: null,
  selectedId: null, showAnnotations: true,
  objects: [], undoStack: [], redoStack: [],
  layers: {
    structure: { visible: true, locked: false },
    openings: { visible: true, locked: false },
    annotation: { visible: true, locked: false },
    markup: { visible: true, locked: false },
  },
};

const GRID = 40;
const statusText = document.getElementById('statusText');
const hintText = document.getElementById('hintText');
const zoomText = document.getElementById('zoomText');
const colorPicker = document.getElementById('colorPicker');
const strokePicker = document.getElementById('strokePicker');
const lineWidthInput = document.getElementById('lineWidth');
const orthoToggle = document.getElementById('orthoToggle');

const makeId = () => Math.random().toString(36).slice(2, 9);
const snap = (v) => Math.round(v / GRID) * GRID;
const cloneObj = (obj) => JSON.parse(JSON.stringify(obj));

function saveHistory() {
  state.undoStack.push(cloneObj(state.objects));
  if (state.undoStack.length > 100) state.undoStack.shift();
  state.redoStack = [];
}

function activeTool() {
  return state.handMode ? 'hand' : state.tool;
}

function setTool(tool) {
  state.tool = tool;
  statusText.textContent = `Tool: ${tool}`;
  document.querySelectorAll('[data-tool]').forEach((b) => b.classList.toggle('active', b.dataset.tool === tool));
}

function toWorld(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (clientX - rect.left - state.pan.x) / state.zoom,
    y: (clientY - rect.top - state.pan.y) / state.zoom,
  };
}

function layerEnabled(layer) {
  const l = state.layers[layer] || { visible: true, locked: false };
  return l.visible;
}

function layerLocked(layer) {
  const l = state.layers[layer] || { visible: true, locked: false };
  return l.locked;
}

function boundsOf(o) {
  if (o.type === 'room' || o.type === 'rect') return { x: o.x, y: o.y, w: o.w, h: o.h };
  if (o.type === 'circle') return { x: o.x - o.r, y: o.y - o.r, w: o.r * 2, h: o.r * 2 };
  if (o.type === 'window' || o.type === 'measure') {
    const x = Math.min(o.x1, o.x2); const y = Math.min(o.y1, o.y2);
    return { x, y, w: Math.abs(o.x2 - o.x1), h: Math.abs(o.y2 - o.y1) };
  }
  if (o.type === 'door') return { x: o.x - o.r, y: o.y - o.r, w: o.r, h: o.r };
  if (o.type === 'text') return { x: o.x, y: o.y - 20, w: Math.max(20, o.text.length * 12), h: 24 };
  if (o.type === 'pen' || o.type === 'highlighter') {
    const xs = o.points.map((p) => p.x); const ys = o.points.map((p) => p.y);
    return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
  }
  return null;
}

function drawObject(o) {
  if (!layerEnabled(o.layer)) return;
  if (!state.showAnnotations && (o.layer === 'annotation' || o.layer === 'markup')) return;

  ctx.save();
  if (o.type === 'highlighter') ctx.globalAlpha = 0.28;
  ctx.lineWidth = o.width || 2;
  ctx.strokeStyle = o.stroke;
  ctx.fillStyle = state.wireframe ? 'transparent' : o.color;

  if (o.type === 'room' || o.type === 'rect') {
    ctx.beginPath(); ctx.rect(o.x, o.y, o.w, o.h); if (!state.wireframe) ctx.fill(); ctx.stroke();
  } else if (o.type === 'circle') {
    ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2); if (!state.wireframe) ctx.fill(); ctx.stroke();
  } else if (o.type === 'window' || o.type === 'measure') {
    ctx.beginPath(); ctx.moveTo(o.x1, o.y1); ctx.lineTo(o.x2, o.y2); ctx.stroke();
    if (o.type === 'measure') {
      const length = Math.hypot(o.x2 - o.x1, o.y2 - o.y1) / 10;
      ctx.fillStyle = o.stroke; ctx.font = '14px Inter';
      ctx.fillText(`${length.toFixed(1)} m`, (o.x1 + o.x2) / 2 + 8, (o.y1 + o.y2) / 2 - 8);
    }
  } else if (o.type === 'door') {
    ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.arc(o.x, o.y, o.r, o.a1, o.a2); ctx.stroke();
  } else if (o.type === 'pen' || o.type === 'highlighter') {
    ctx.beginPath(); o.points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke();
  } else if (o.type === 'text') {
    ctx.fillStyle = o.color; ctx.font = `${o.size || 18}px Inter`; ctx.fillText(o.text, o.x, o.y);
  }

  if (state.selectedId === o.id) {
    const bb = boundsOf(o);
    if (bb) { ctx.strokeStyle = '#39d0ff'; ctx.setLineDash([6, 6]); ctx.lineWidth = 1; ctx.strokeRect(bb.x - 4, bb.y - 4, bb.w + 8, bb.h + 8); }
  }
  ctx.restore();
}

function findAt(x, y) {
  for (let i = state.objects.length - 1; i >= 0; i -= 1) {
    const o = state.objects[i];
    if (!layerEnabled(o.layer) || layerLocked(o.layer)) continue;
    const b = boundsOf(o);
    if (b && x >= b.x - 6 && x <= b.x + b.w + 6 && y >= b.y - 6 && y <= b.y + b.h + 6) return o;
  }
  return null;
}

function smartAnchor(x, y) {
  const room = [...state.objects].reverse().find((o) => o.type === 'room' && x > o.x && x < o.x + o.w && y > o.y && y < o.y + o.h);
  if (!room) return { x: snap(x), y: snap(y) };
  const left = Math.abs(x - room.x); const right = Math.abs(x - (room.x + room.w));
  const top = Math.abs(y - room.y); const bottom = Math.abs(y - (room.y + room.h));
  const min = Math.min(left, right, top, bottom);
  if (min === left) return { x: room.x, y: snap(y) };
  if (min === right) return { x: room.x + room.w, y: snap(y) };
  if (min === top) return { x: snap(x), y: room.y };
  return { x: snap(x), y: room.y + room.h };
}

function applyOrtho(start, p) {
  if (!state.ortho) return p;
  const dx = p.x - start.x;
  const dy = p.y - start.y;
  return Math.abs(dx) >= Math.abs(dy) ? { x: p.x, y: start.y } : { x: start.x, y: p.y };
}

function redraw() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(state.zoom, 0, 0, state.zoom, state.pan.x, state.pan.y);
  state.objects.forEach(drawObject);
  if (state.drawing) drawObject(state.drawing);
  if (state.measureTemp) drawObject(state.measureTemp);
  zoomText.textContent = `${Math.round(state.zoom * 100)}%`;
  hintText.textContent = `Objects: ${state.objects.length} • Ortho: ${state.ortho ? 'On' : 'Off'} • Hand: ${state.handMode ? 'On' : 'Off'}`;
}

canvas.addEventListener('mousedown', (e) => {
  state.pointerDown = true;
  const p = toWorld(e.clientX, e.clientY);

  if (activeTool() === 'hand' || e.button === 1) {
    state.panning = { x: e.clientX, y: e.clientY, ox: state.pan.x, oy: state.pan.y };
    return;
  }

  if (state.tool === 'select') {
    const hit = findAt(p.x, p.y);
    state.selectedId = hit?.id || null;
    if (hit) {
      const b = boundsOf(hit);
      state.dragging = { id: hit.id, dx: p.x - b.x, dy: p.y - b.y };
      colorPicker.value = hit.color || '#9fb8ff'; strokePicker.value = hit.stroke || '#1d1f2a'; lineWidthInput.value = hit.width || 2;
      saveHistory();
    }
  } else if (state.tool === 'text') {
    const value = prompt('Text note', 'Room name');
    if (value) {
      saveHistory();
      state.objects.push({ id: makeId(), type: 'text', layer: 'annotation', x: p.x, y: p.y, text: value, color: colorPicker.value, stroke: strokePicker.value, width: 1 });
    }
  } else if (state.tool === 'pen' || state.tool === 'highlighter') {
    state.drawing = { id: makeId(), type: state.tool, layer: toolToLayer[state.tool], points: [p], color: colorPicker.value, stroke: colorPicker.value, width: state.tool === 'highlighter' ? 14 : Number(lineWidthInput.value) };
    saveHistory();
  } else if (state.tool === 'measure') {
    state.measureTemp = { id: makeId(), type: 'measure', layer: 'annotation', x1: p.x, y1: p.y, x2: p.x, y2: p.y, color: '#0000', stroke: '#7be495', width: 2 };
    saveHistory();
  } else {
    const sp = state.tool === 'window' || state.tool === 'door' ? smartAnchor(p.x, p.y) : { x: snap(p.x), y: snap(p.y) };
    state.drawing = { id: makeId(), type: state.tool, layer: toolToLayer[state.tool], x: sp.x, y: sp.y, x2: sp.x, y2: sp.y, w: 0, h: 0, r: 0, a1: 0, a2: Math.PI / 2, color: colorPicker.value, stroke: strokePicker.value, width: Number(lineWidthInput.value) };
    saveHistory();
  }
  redraw();
});

canvas.addEventListener('mousemove', (e) => {
  if (!state.pointerDown) return;
  const p = toWorld(e.clientX, e.clientY);

  if (state.panning) {
    state.pan.x = state.panning.ox + (e.clientX - state.panning.x);
    state.pan.y = state.panning.oy + (e.clientY - state.panning.y);
  } else if (state.dragging) {
    const o = state.objects.find((it) => it.id === state.dragging.id); if (!o) return;
    const b = boundsOf(o); const nx = snap(p.x - state.dragging.dx); const ny = snap(p.y - state.dragging.dy);
    const dx = nx - b.x; const dy = ny - b.y;
    if (o.type === 'room' || o.type === 'rect') { o.x += dx; o.y += dy; }
    if (o.type === 'circle') { o.x += dx; o.y += dy; }
    if (o.type === 'window' || o.type === 'measure') { o.x1 += dx; o.y1 += dy; o.x2 += dx; o.y2 += dy; }
    if (o.type === 'door' || o.type === 'text') { o.x += dx; o.y += dy; }
    if (o.type === 'pen' || o.type === 'highlighter') o.points = o.points.map((pt) => ({ x: pt.x + dx, y: pt.y + dy }));
  } else if (state.measureTemp) {
    const end = applyOrtho({ x: state.measureTemp.x1, y: state.measureTemp.y1 }, p);
    state.measureTemp.x2 = end.x; state.measureTemp.y2 = end.y;
  } else if (state.drawing) {
    if (state.drawing.type === 'room' || state.drawing.type === 'rect') {
      const end = applyOrtho({ x: state.drawing.x, y: state.drawing.y }, p);
      state.drawing.w = snap(end.x) - state.drawing.x; state.drawing.h = snap(end.y) - state.drawing.y;
    } else if (state.drawing.type === 'circle') {
      state.drawing.r = Math.hypot(p.x - state.drawing.x, p.y - state.drawing.y);
    } else if (state.drawing.type === 'window') {
      const end = applyOrtho({ x: state.drawing.x, y: state.drawing.y }, smartAnchor(p.x, p.y));
      state.drawing.x2 = end.x; state.drawing.y2 = end.y;
    } else if (state.drawing.type === 'door') {
      const end = smartAnchor(p.x, p.y);
      state.drawing.r = Math.max(30, Math.hypot(end.x - state.drawing.x, end.y - state.drawing.y));
    } else if (state.drawing.type === 'pen' || state.drawing.type === 'highlighter') {
      state.drawing.points.push(p);
    }
  }
  redraw();
});

canvas.addEventListener('mouseup', () => {
  state.pointerDown = false;
  state.dragging = null;
  state.panning = null;
  if (state.measureTemp) { state.objects.push(state.measureTemp); state.measureTemp = null; }
  if (state.drawing) {
    const invalidRect = (state.drawing.type === 'room' || state.drawing.type === 'rect') && (!state.drawing.w || !state.drawing.h);
    if (!invalidRect) state.objects.push(state.drawing);
    state.drawing = null;
  }
  redraw();
});

canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const factor = e.deltaY > 0 ? 0.92 : 1.08;
  state.zoom = Math.min(3, Math.max(0.25, state.zoom * factor));
  redraw();
});

document.getElementById('toolGrid').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-tool]');
  if (btn) setTool(btn.dataset.tool);
});

document.querySelectorAll('.layerVis').forEach((el) => {
  el.addEventListener('change', () => { state.layers[el.dataset.layer].visible = el.checked; redraw(); });
});
document.querySelectorAll('.layerLock').forEach((el) => {
  el.addEventListener('change', () => { state.layers[el.dataset.layer].locked = el.checked; redraw(); });
});

document.getElementById('themeToggle').onclick = () => { state.theme = state.theme === 'dark' ? 'light' : 'dark'; document.body.dataset.theme = state.theme; };
document.getElementById('wireframeToggle').onclick = () => { state.wireframe = !state.wireframe; redraw(); };
document.getElementById('orthoToggle').onclick = () => { state.ortho = !state.ortho; orthoToggle.textContent = `Ortho: ${state.ortho ? 'On' : 'Off'}`; redraw(); };
document.getElementById('zoomIn').onclick = () => { state.zoom = Math.min(3, state.zoom + 0.1); redraw(); };
document.getElementById('zoomOut').onclick = () => { state.zoom = Math.max(0.25, state.zoom - 0.1); redraw(); };
document.getElementById('zoomFit').onclick = () => { state.zoom = 1; state.pan = { x: 80, y: 60 }; redraw(); };
document.getElementById('hideAnnotations').onclick = () => { state.showAnnotations = !state.showAnnotations; redraw(); };
document.getElementById('handTool').onclick = () => { state.handMode = !state.handMode; document.body.classList.toggle('hand-cursor', state.handMode); redraw(); };

function getSelected() { return state.objects.find((it) => it.id === state.selectedId); }
function updateSelectedStyle() {
  const o = getSelected(); if (!o || layerLocked(o.layer)) return;
  saveHistory();
  o.color = colorPicker.value; o.stroke = strokePicker.value; o.width = Number(lineWidthInput.value);
  redraw();
}
colorPicker.addEventListener('change', updateSelectedStyle);
strokePicker.addEventListener('change', updateSelectedStyle);
lineWidthInput.addEventListener('change', updateSelectedStyle);

document.getElementById('deleteSelected').onclick = () => {
  const o = getSelected(); if (!o || layerLocked(o.layer)) return;
  saveHistory();
  state.objects = state.objects.filter((it) => it.id !== state.selectedId);
  state.selectedId = null; redraw();
};

document.getElementById('duplicateSelected').onclick = () => {
  const o = getSelected(); if (!o || layerLocked(o.layer)) return;
  saveHistory();
  const cp = cloneObj(o); cp.id = makeId();
  if ('x' in cp) cp.x += GRID / 2;
  if ('y' in cp) cp.y += GRID / 2;
  if ('x1' in cp) { cp.x1 += GRID / 2; cp.x2 += GRID / 2; cp.y1 += GRID / 2; cp.y2 += GRID / 2; }
  if (cp.points) cp.points = cp.points.map((p) => ({ x: p.x + GRID / 2, y: p.y + GRID / 2 }));
  state.objects.push(cp); state.selectedId = cp.id; redraw();
};

document.getElementById('bringFront').onclick = () => {
  const i = state.objects.findIndex((o) => o.id === state.selectedId); if (i < 0) return;
  saveHistory(); const [it] = state.objects.splice(i, 1); state.objects.push(it); redraw();
};
document.getElementById('sendBack').onclick = () => {
  const i = state.objects.findIndex((o) => o.id === state.selectedId); if (i < 0) return;
  saveHistory(); const [it] = state.objects.splice(i, 1); state.objects.unshift(it); redraw();
};

document.getElementById('undoBtn').onclick = () => {
  if (!state.undoStack.length) return;
  state.redoStack.push(cloneObj(state.objects));
  state.objects = state.undoStack.pop();
  state.selectedId = null;
  redraw();
};
document.getElementById('redoBtn').onclick = () => {
  if (!state.redoStack.length) return;
  state.undoStack.push(cloneObj(state.objects));
  state.objects = state.redoStack.pop();
  state.selectedId = null;
  redraw();
};

document.getElementById('saveJson').onclick = () => {
  const payload = { version: 2, layers: state.layers, objects: state.objects };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'home-design.json'; a.click(); URL.revokeObjectURL(a.href);
};
document.getElementById('loadJson').onclick = () => document.getElementById('importFile').click();
document.getElementById('importFile').addEventListener('change', async (e) => {
  const file = e.target.files?.[0]; if (!file) return;
  const text = await file.text();
  try {
    const payload = JSON.parse(text);
    if (!Array.isArray(payload.objects)) throw new Error('Invalid file');
    saveHistory();
    state.objects = payload.objects.map((o) => ({ ...o, layer: o.layer || toolToLayer[o.type] || 'structure' }));
    if (payload.layers) state.layers = payload.layers;
    redraw();
  } catch {
    alert('Invalid JSON file');
  }
  e.target.value = '';
});
document.getElementById('clearCanvas').onclick = () => {
  if (!confirm('Start a new plan?')) return;
  saveHistory(); state.objects = []; state.selectedId = null; redraw();
};

document.addEventListener('keydown', (e) => {
  if (e.key === 'Shift') { state.ortho = true; orthoToggle.textContent = 'Ortho: On'; redraw(); }
  if (e.code === 'Space') { e.preventDefault(); state.handMode = true; document.body.classList.add('hand-cursor'); redraw(); }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); document.getElementById('undoBtn').click(); }
  if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) { e.preventDefault(); document.getElementById('redoBtn').click(); }
  if (e.key.toLowerCase() === 'delete') document.getElementById('deleteSelected').click();
});
document.addEventListener('keyup', (e) => {
  if (e.key === 'Shift') { state.ortho = false; orthoToggle.textContent = 'Ortho: Off'; redraw(); }
  if (e.code === 'Space') { state.handMode = false; document.body.classList.remove('hand-cursor'); redraw(); }
});

redraw();
