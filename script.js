const REL_COLOURS = {
  love:   '#e41b1b',
  hate:   '#000000',
  friend: '#9e9e9e'
};

const REL_SYMBOL = {
  love:'❤️',
  hate:'♠️',
  friend:'♦️'
};

const isMobile = /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);

let cy = null;
let firstNode = null;
let secondNode = null;
const relMenu = document.getElementById('relMenu');
const relMenuMobile = document.getElementById('relMenuMobile');

const undoStack = [];
const redoStack = [];

function graphJSON() {
  return cy.elements().jsons().map(el => {
    if (el.group === 'nodes' && el.classes) {
      const filtered = el.classes
        .split(' ')
        .filter(c => c !== 'cy-node-first' && c !== 'cy-node-second')
        .join(' ');
      return { ...el, classes: filtered };
    }
    return el;
  });
}

function pushUndo() {
  undoStack.push(graphJSON());
  redoStack.length = 0;
  updateHistoryButtons();
}

function saveAutosave() {
  localStorage.setItem('shipperizer_autosave', JSON.stringify(graphJSON()));
}

function restore(elements) {
  cy.elements().remove();
  cy.add(elements);

  cy.nodes().removeClass('cy-node-first cy-node-second');

  firstNode = cy.nodes('.cy-node-first')[0] || null;
  secondNode = cy.nodes('.cy-node-second')[0] || null;

  if (firstNode)  firstNode.addClass('cy-node-first');
  if (secondNode) secondNode.addClass('cy-node-second');

  cy.nodes().unlock();
  applyNodeSize();
}
function updateHistoryButtons(){
  undoBtn.disabled = !undoStack.length;
  redoBtn.disabled = !redoStack.length;

}

const undoBtn = document.getElementById('undoBtn');
const redoBtn = document.getElementById('redoBtn');
updateHistoryButtons();

undoBtn.onclick = () => {
  if (!undoStack.length) return;
  redoStack.push(graphJSON());
  const prev = undoStack.pop();
  restore(prev);
  saveAutosave();
  updateHistoryButtons();
};

redoBtn.onclick = () => {
  if (!redoStack.length) return;
  undoStack.push(graphJSON());
  const next = redoStack.pop();
  restore(next);
  saveAutosave();
  updateHistoryButtons();
};

function edgeId(src, tgt)        { return `${src}_${tgt}`; }
function mergedId(a, b)          { return `merged_${[a, b].sort().join('_')}`; }
function getEdge(src, tgt)       { return cy.getElementById(edgeId(src, tgt)); }
function getMerged(a, b)         { return cy.getElementById(mergedId(a, b));   }

function createEdge(src, tgt, rel) {
  cy.add({
    group: 'edges',
    data : {
      id    : edgeId(src, tgt),
      source: src,
      target: tgt,
      rel,
      color : REL_COLOURS[rel]
    }
  });
}

function createMerged(a, b, rel) {
  const [low, high] = [a, b].sort();
  cy.add({
    group: 'edges',
    data : {
      id    : mergedId(low, high),
      source: low,
      target: high,
      rel,
      merged: true,
      color : REL_COLOURS[rel]
    }
  });
}

async function loadCharacters() {
  try {
    const res  = await fetch('assets/face_images/manifest.json');
    const list = await res.json();
    return list.sort();
  } catch (e) {
    console.error('manifest missing, falling back to default list');
    return ['Stolas','Blitzo'];
  }
}

loadCharacters().then(names => {
  startCy(names);
  const autosave = localStorage.getItem('shipperizer_autosave');
  if (autosave) {
    try {
      const elems = JSON.parse(autosave);

      cy.batch(() => {
        cy.elements().remove();
        cy.add(elems);
      });

      cy.edges().forEach(e => {
        if (e.data('merged')) {
          e.style({
            'source-arrow-shape': 'triangle',
            'target-arrow-shape': 'triangle'
          });
        } else {
          e.style({
            'source-arrow-shape': 'none',
            'target-arrow-shape': 'triangle'
          });
        }
      });

      clearSelection();
      cy.nodes().unlock();
      applyNodeSize();
    } catch (e) {
      console.warn('Autosave corrupted, skipping.');
    }
  } else {
    document.getElementById('layoutBtn').click();
  }
});

function getNodeSize() {
  const w = cy ? cy.width()  : window.innerWidth;
  const h = cy ? cy.height() : window.innerHeight;

  const base      = Math.min(w, h);
  const divisor   = isMobile ? 10 : 12;
  const minSize   = isMobile ? 80 : 64;
  const maxSize   = isMobile ? 200 : 160;

  return Math.max(minSize, Math.min(maxSize, Math.floor(base / divisor)));
}

function applyNodeSize() {
  const size = getNodeSize();
  cy.batch(() => {
    cy.nodes().forEach(n => {
      n.style('width',  size);
      n.style('height', size);
    });
  });
}

function startCy(characterNames) {
  cy = cytoscape({
    container: document.getElementById('cy'),
    elements: characterNames.map(n => ({
      data: { id: n, img: `assets/face_images/${n}.png` }
    })),
    style: [
      {
        selector: 'node',
        style: {
          'background-fit': 'cover',
          'background-image': 'data(img)',
          'border-width': 2,
          'border-color': '#444'
        }
      },
      {
        selector: 'edge',
        style: {
          'curve-style'      : 'bezier',
          'line-color'       : 'data(color)',
          'target-arrow-color': 'data(color)',
          'target-arrow-shape': 'triangle',
          'source-arrow-shape': 'none',
          'arrow-scale' : 1.4,
          'width'            : 4
        }
      },
      {
        selector: 'edge[merged]',
        style: {
          'source-arrow-color': 'data(color)',
          'source-arrow-shape': 'triangle',
          'arrow-scale' : 1.4,
        }
      },
      { selector: '.cy-node-first',  style: { 'border-color': '#ffea00' } },
      { selector: '.cy-node-second', style: { 'border-color': '#3498db' } }
    ],
    layout: { name: 'circle', padding: 50 }
  });

  applyNodeSize();

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(applyNodeSize, 100);
  });

  setUpEventHandlers();
}

async function downscaleTo128(dataURL){
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const dim = Math.min(img.width, img.height);
      const sx = (img.width  - dim) / 2;
      const sy = (img.height - dim) / 2;

      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');

      ctx.drawImage(img, sx, sy, dim, dim, 0, 0, 128, 128);

      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.src = dataURL;
  });
}

const uploadBtn = document.getElementById('uploadBtn');
const filePicker = document.getElementById('filePicker');

function domPointToCy(x, y) {
  const rect = cy.container().getBoundingClientRect();
  const px = (x - rect.left - cy.pan().x) / cy.zoom();
  const py = (y - rect.top  - cy.pan().y) / cy.zoom();
  return { x: px, y: py };
}

uploadBtn.onclick = () => {
  alert('Upload character headshots (preferably 128×128 PNGs). Filenames will become names.');
  filePicker.click();
};

filePicker.onchange = async () => {
  const files = Array.from(filePicker.files);
  if (!files.length) return;

  const bRect = uploadBtn.getBoundingClientRect();
  const start = domPointToCy(
    bRect.left + bRect.width  / 2,
    bRect.top  + bRect.height / 2
  );

  const validTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
  const uploads = [];

  for (const file of files) {
    if (!validTypes.includes(file.type)) {
      alert(`Skipping ${file.name}: unsupported file type`);
      continue;
    }
    const name    = file.name.replace(/\.[^.]+$/, '');
    const original = await fileToDataURL(file);
    const dataURL  = await downscaleTo128(original);
    uploads.push({ name, dataURL });
  }

  if (!uploads.length) return;

  pushUndo();
  cy.startBatch();

  uploads.forEach(({ name, dataURL }) => {
    const existing = cy.getElementById(name);
    if (existing.nonempty()) {
      existing.data('img', dataURL);
      existing.style('background-image', dataURL);
    } else {
      cy.add({
        group: 'nodes',
        data: { id: name, img: dataURL },
        position: { ...start }
      });
    }
  });

  cy.endBatch();

  const sorted = cy.nodes().sort((a, b) =>
    a.id().localeCompare(b.id()));
  sorted.move({ parent: null });

  applyNodeSize();
  document.getElementById('layoutBtn').click();
  setTimeout(saveAutosave, 650);
  updateHistoryButtons();
};

function fileToDataURL(file) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.readAsDataURL(file);
  });
}

function setUpEventHandlers() {
  cy.on('tap', 'node', e => {
    const node = e.target;

    if (!firstNode) {
      setFirst(node);
      return;
    }

    if (node.id() === firstNode.id()) {
      clearSelection();
      return;
    }

    if (!secondNode) {
      setSecond(node);
      openRelMenu(e.originalEvent.pageX, e.originalEvent.pageY);
      return;
    }

    if (node.id() === firstNode.id() || node.id() === secondNode.id()) {
      swapFirstAndSecond();
      openRelMenu(e.originalEvent.pageX, e.originalEvent.pageY);
      return;
    }

    setSecond(node);
    openRelMenu(e.originalEvent.pageX, e.originalEvent.pageY);
  });

  cy.on('tap', 'edge', e => {
    pushUndo();
    e.target.remove();
    saveAutosave();
    updateHistoryButtons();
  });

  cy.on('grab', 'node', () => {
    pushUndo();
    updateHistoryButtons();
  });

  cy.on('dragfree', 'node', () => {
    saveAutosave();
    updateHistoryButtons();
  });

  document.getElementById('exportBtn').onclick = () => {
    const toRestore = [];

    cy.nodes('.cy-node-first, .cy-node-second').forEach(n => {
      toRestore.push({ node: n, classes: [...n.classes()] });
      n.removeClass('cy-node-first cy-node-second');
    });

    setTimeout(() => {
      const png = cy.png({ full: true, padding: 20, bg: '#333' });

      toRestore.forEach(({ node, classes }) => {
        node.classes(classes);
      });

      const a = document.createElement('a');
      a.href = png;
      a.download = 'ships.png';
      a.click();
    }, 50);
  };

  document.getElementById('saveBtn').onclick = () => {
    const nodes = cy.nodes().map(n => ({
      group: 'nodes',
      data: {
        id: n.id(),
        img: n.data('img')
      },
      position: n.position()
    }));

    const edges = cy.edges().map(e => ({
      group: 'edges',
      data: {
        id     : e.id(),
        source : e.data('source'),
        target : e.data('target'),
        rel    : e.data('rel'),
        color  : e.data('color'),
        merged : !!e.data('merged')
      }
    }));

    const all = [...nodes, ...edges];

    const data = JSON.stringify(all, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'ships.json';
    a.click();

    URL.revokeObjectURL(url);
  };

  const jsonPicker = document.getElementById('jsonPicker');
  document.getElementById('loadBtn').onclick = () => jsonPicker.click();

  jsonPicker.onchange = async () => {
    const file = jsonPicker.files[0];
    if (!file) return;

    const text = await file.text();
    let elems;
    try {
      elems = JSON.parse(text);
    } catch (e) {
      alert('Invalid JSON file');
      return;
    }

    cy.elements().remove();
    clearSelection();
    cy.add(elems);

    cy.edges().forEach(e => {
      if (e.data('merged')) {
        e.style({
          'source-arrow-shape': 'triangle',
          'target-arrow-shape': 'triangle'
        });
      } else {
        e.style({
          'source-arrow-shape': 'none',
          'target-arrow-shape': 'triangle'
        });
      }
    });

    cy.nodes().unlock();
    applyNodeSize();
  };

  document.getElementById('layoutBtn').onclick = () => {
    pushUndo();
    const nodes = cy.nodes().sort((a, b) => a.id().localeCompare(b.id()));
    if (nodes.empty()) return;

    let cx0 = 0, cy0 = 0;
    nodes.forEach(n => {
      cx0 += n.position('x');
      cy0 += n.position('y');
    });
    cx0 /= nodes.length;
    cy0 /= nodes.length;

    const w    = cy.width();
    const h    = cy.height();
    const zoom = cy.zoom();
    const pan  = cy.pan();

    const cxGraph = (w / 2 - pan.x) / zoom;
    const cyGraph = (h / 2 - pan.y) / zoom;

    const nodeSize = parseFloat(nodes[0]?.style('width') || 120);
    const maxRadiusScreen = (Math.min(w, h) - nodeSize - 50) / 2;
    const r = maxRadiusScreen / zoom;

    const polar = nodes.map(n => {
      const dx = n.position('x') - cx0;
      const dy = n.position('y') - cy0;
      let ang  = Math.atan2(dy, dx);
      if (ang < 0) ang += 2 * Math.PI;
      return { node: n, ang };
    }).sort((a, b) => a.ang - b.ang);

    const N       = polar.length;
    const spacing = 2 * Math.PI / N;
    const offset  = polar[0].ang;

    polar.forEach((p, i) => {
      const θ = offset + i * spacing;
      const x = cxGraph + r * Math.cos(θ);
      const y = cyGraph + r * Math.sin(θ);
      p.node.unlock().animate({
        position: { x, y }
      }, {
        duration: 600,
        easing: 'spring(80, 10)'
      });
    });
    setTimeout(saveAutosave, 650);
    updateHistoryButtons();
  };

  document.getElementById('clearAutosaveBtn').onclick = () => {
    if (confirm('Clear autosaved data? This cannot be undone.')) {
      localStorage.removeItem('shipperizer_autosave');
      alert('Autosave cleared. Reload to start fresh.');
    }
  };

  function handleRelationship(rel){
    pushUndo();
    const src = firstNode.id();
    const tgt = secondNode.id();

    const merged = getMerged(src, tgt);
    if (merged.nonempty()) {
      if (merged.data('rel') === rel) { clearSelection(); return; }
      const oldRel = merged.data('rel');
      merged.remove();
      createEdge(tgt, src, oldRel);
      createEdge(src, tgt, rel);
      clearSelection(); return;
    }

    const forward = getEdge(src, tgt);
    if (forward.nonempty()) forward.remove();

    const reverse = getEdge(tgt, src);
    if (reverse.nonempty() && reverse.data('rel') === rel) {
      reverse.remove();
      createMerged(src, tgt, rel);
    } else {
      createEdge(src, tgt, rel);
    }
    clearSelection();
    saveAutosave();
    updateHistoryButtons();
  }

  relMenu.addEventListener('mousedown', e=>{
    const rel = e.target.dataset.rel;
    if (!rel) return;
    relMenu.style.display = 'none';
    handleRelationship(rel);
  });

  relMenuMobile.addEventListener('click', e => {
    const rel = e.target.dataset.rel;
    if (!rel) return;

    relMenuMobile.style.display = 'none';
    handleRelationship(rel);
  });

  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    if (e.key === 'Escape') clearSelection();

    if ((e.key === 'Delete' || e.key === 'Backspace') && firstNode) {
      pushUndo();
      cy.remove(firstNode.connectedEdges());
      cy.remove(firstNode);
      clearSelection();
      saveAutosave();
      updateHistoryButtons();
    }

    if (e.key === 'o' || e.key === 'O') {
      document.getElementById('layoutBtn').click();
    }

    if (e.key === 'u' || e.key === 'U') {
      document.getElementById('uploadBtn').click();
    }

    if (e.key === 'c' || e.key === 'C') {
      document.getElementById('clearBtn').click();
    }

    if (e.key === 's' || e.key === 'S') {
      document.getElementById('saveBtn').click();
    }

    if (e.key === 'l' || e.key === 'L') {
      document.getElementById('loadBtn').click();
    }

    if (e.key === 'e' || e.key === 'E') {
      document.getElementById('exportBtn').click();
    }

    if (e.ctrlKey && !e.shiftKey && e.key === 'z') {
      e.preventDefault();
      undoBtn.click();
    } else if ((e.ctrlKey && e.key === 'y') || (e.ctrlKey && e.shiftKey && e.key === 'Z')) {
      e.preventDefault();
      redoBtn.click();
    } else if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'delete') {
      e.preventDefault();
      document.getElementById('clearAutosaveBtn').click();
    }
  });

  cy.on('mouseover', 'node', e => {
    const node = e.target;
    const pos  = node.position();
    const zoom = cy.zoom();
    const pan  = cy.pan();

    const renderedHeight = parseFloat(node.renderedStyle('height')) || 120;

    const screenX = pos.x * zoom + pan.x;
    const screenY = pos.y * zoom + pan.y - renderedHeight * 0.6;

    showTip(node.id(), screenX, screenY);
  });
  cy.on('mouseout', 'node', hideTip);

  cy.on('mouseover', 'edge', e => {
    const edge = e.target;
    const rel = edge.data('rel');
    const sym = REL_SYMBOL[rel] || '?';
    const src = edge.data('source');
    const tgt = edge.data('target');
    const text = `${src} ${sym} ${tgt}`;
    const pos = e.renderedPosition || edge.midpoint();
    showTip(text, pos.x, pos.y);
  });
  cy.on('mouseout', 'edge', hideTip);

  cy.on('pan zoom', hideTip);

  document.getElementById('clearBtn').onclick = () => {
    if (!confirm('Delete ALL nodes and relationships?')) return;
    pushUndo();
    cy.elements().remove();
    clearSelection();
    saveAutosave();
    updateHistoryButtons();
  };
}

function setFirst(node) {
  clearSelection();
  firstNode = node;
  node.addClass('cy-node-first');
}

function setSecond(node) {
  if (secondNode) secondNode.removeClass('cy-node-second');
  secondNode = node;
  node.addClass('cy-node-second');
}

function swapFirstAndSecond() {
  firstNode.removeClass('cy-node-first');
  secondNode.removeClass('cy-node-second');
  [firstNode, secondNode] = [secondNode, firstNode];
  firstNode.addClass('cy-node-first');
  secondNode.addClass('cy-node-second');
}

function clearSelection() {
  if (firstNode)  firstNode.removeClass('cy-node-first');
  if (secondNode) secondNode.removeClass('cy-node-second');
  firstNode = secondNode = null;
  relMenu.style.display = 'none';
  relMenuMobile.style.display = 'none';
}

function openRelMenu(x, y){
  if (isMobile){
    relMenuMobile.querySelectorAll('button').forEach(btn => btn.blur());

    relMenuMobile.style.display = 'flex';
  }else{
    relMenu.style.left  = `${x}px`;
    relMenu.style.top   = `${y}px`;
    relMenu.style.display = 'flex';
  }
}

const tip = document.getElementById('tooltip');
let tipTimer = null;

function showTip(text, x, y) {
  clearTimeout(tipTimer);
  tipTimer = setTimeout(() => {
    tip.textContent = text;
    tip.style.left = `${x}px`;
    tip.style.top  = `${y}px`;
    tip.hidden = false;
  }, 500);
}

function hideTip() {
  clearTimeout(tipTimer);
  tip.hidden = true;
}