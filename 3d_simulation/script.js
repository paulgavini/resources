import * as THREE from "https://unpkg.com/three@0.162.0/build/three.module.js";

const root = document.getElementById("sceneRoot");
const clearBtn = document.getElementById("clearBtn");
const cursorInfo = document.getElementById("cursorInfo");

const GRID_CELLS = 15;
const HALF_GRID = GRID_CELLS / 2;
const MAX_HEIGHT = 12;

const scene = new THREE.Scene();
scene.background = null;

const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
const orbitState = {
  radius: 22,
  azimuth: Math.PI * 0.7,
  polar: 1.05,
  target: new THREE.Vector3(4.5, 2.6, 4.5)
};

function updateCamera() {
  const sinPolar = Math.sin(orbitState.polar);
  camera.position.set(
    orbitState.target.x + orbitState.radius * sinPolar * Math.cos(orbitState.azimuth),
    orbitState.target.y + orbitState.radius * Math.cos(orbitState.polar),
    orbitState.target.z + orbitState.radius * sinPolar * Math.sin(orbitState.azimuth)
  );
  camera.lookAt(orbitState.target);
}

updateCamera();

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
root.appendChild(renderer.domElement);

const hemi = new THREE.HemisphereLight(0xffffff, 0x8fa2b7, 0.8);
scene.add(hemi);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(8, 16, 10);
scene.add(dirLight);

function createGridTexture(label) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "#111111";
  ctx.lineWidth = 5;
  ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);

  ctx.lineWidth = 2;
  for (let i = 1; i < GRID_CELLS; i += 1) {
    const p = (i / GRID_CELLS) * canvas.width;
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, canvas.height);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, p);
    ctx.lineTo(canvas.width, p);
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(85, 85, 85, 0.35)";
  ctx.font = "italic 110px Georgia";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 8;
  return texture;
}

const planeMaterialXY = new THREE.MeshStandardMaterial({
  map: createGridTexture("xy-plane"),
  roughness: 0.95,
  metalness: 0,
  side: THREE.DoubleSide
});

const planeMaterialXZ = new THREE.MeshStandardMaterial({
  map: createGridTexture("xz-plane"),
  roughness: 0.95,
  metalness: 0,
  side: THREE.DoubleSide
});

const planeMaterialYZ = new THREE.MeshStandardMaterial({
  map: createGridTexture("yz-plane"),
  roughness: 0.95,
  metalness: 0,
  side: THREE.DoubleSide
});

const floor = new THREE.Mesh(new THREE.PlaneGeometry(GRID_CELLS, GRID_CELLS), planeMaterialXZ);
floor.rotation.x = -Math.PI / 2;
floor.position.set(HALF_GRID, 0, HALF_GRID);
scene.add(floor);

const wallYZ = new THREE.Mesh(new THREE.PlaneGeometry(GRID_CELLS, GRID_CELLS), planeMaterialYZ);
wallYZ.rotation.y = Math.PI / 2;
wallYZ.position.set(0, HALF_GRID, HALF_GRID);
scene.add(wallYZ);

const wallXY = new THREE.Mesh(new THREE.PlaneGeometry(GRID_CELLS, GRID_CELLS), planeMaterialXY);
wallXY.position.set(HALF_GRID, HALF_GRID, 0);
scene.add(wallXY);

function createTextSprite(text, options = {}) {
  const {
    bg = "rgba(255,255,255,0.82)",
    fg = "#111111",
    font = "700 38px Segoe UI",
    scale = 0.78
  } = options;

  const canvas = document.createElement("canvas");
  canvas.width = 160;
  canvas.height = 82;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "rgba(20,20,20,0.7)";
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, canvas.width - 3, canvas.height - 3);

  ctx.fillStyle = fg;
  ctx.font = font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;

  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(scale * 1.7, scale, 1);
  sprite.renderOrder = 1000;
  return sprite;
}

function addCoordinateLabels() {
  const labels = new THREE.Group();

  for (let i = 0; i < GRID_CELLS; i += 1) {
    const xTick = createTextSprite(String(i + 1), { scale: 0.4, font: "700 34px Segoe UI" });
    xTick.position.set(i + 0.5, 0.06, -0.55);
    labels.add(xTick);

    const zTick = createTextSprite(String(i + 1), { scale: 0.4, font: "700 34px Segoe UI" });
    zTick.position.set(-0.55, 0.06, i + 0.5);
    labels.add(zTick);

    const yTick = createTextSprite(String(i + 1), { scale: 0.38, font: "700 32px Segoe UI" });
    yTick.position.set(-0.55, i + 0.5, -0.55);
    labels.add(yTick);
  }

  const xTag = createTextSprite("X", { scale: 0.85, font: "700 44px Segoe UI" });
  xTag.position.set(HALF_GRID, 0.1, GRID_CELLS + 1.2);
  labels.add(xTag);

  const zTag = createTextSprite("Z", { scale: 0.85, font: "700 44px Segoe UI" });
  zTag.position.set(-1.15, 0.1, HALF_GRID);
  labels.add(zTag);

  const yTag = createTextSprite("Y", { scale: 0.85, font: "700 44px Segoe UI" });
  yTag.position.set(-1.15, HALF_GRID, -1.1);
  labels.add(yTag);

  scene.add(labels);
}

addCoordinateLabels();

const cubeGeometry = new THREE.BoxGeometry(1, 1, 1);
const cubeColors = [0xff3b30, 0xff9500, 0xffcc00, 0x34c759, 0x00c7be, 0x32ade6, 0x5856d6, 0xaf52de, 0xff2d55, 0xffffff];
const cubeMaterialPool = cubeColors.map(
  (color) =>
    new THREE.MeshStandardMaterial({
      color,
      roughness: 0.45,
      metalness: 0.05
    })
);

const cubes = new Map();
const heights = new Map();

function key(x, z, y) {
  return `${x},${z},${y}`;
}

function colKey(x, z) {
  return `${x},${z}`;
}

function getColumnHeight(x, z) {
  return heights.get(colKey(x, z)) ?? 0;
}

function setColumnHeight(x, z, h) {
  if (h <= 0) {
    heights.delete(colKey(x, z));
    return;
  }
  heights.set(colKey(x, z), h);
}

function inBounds(x, z) {
  return x >= 0 && x < GRID_CELLS && z >= 0 && z < GRID_CELLS;
}

function addCube(x, z) {
  if (!inBounds(x, z)) {
    return;
  }

  const y = getColumnHeight(x, z);
  if (y >= MAX_HEIGHT) {
    return;
  }

  const material = cubeMaterialPool[Math.floor(Math.random() * cubeMaterialPool.length)];
  const cube = new THREE.Mesh(cubeGeometry, material);
  cube.position.set(x + 0.5, y + 0.5, z + 0.5);
  cube.userData.grid = { x, y, z };
  scene.add(cube);

  cubes.set(key(x, z, y), cube);
  setColumnHeight(x, z, y + 1);
}

function removeCubeAtColumn(x, z) {
  const h = getColumnHeight(x, z);
  if (h <= 0) {
    return;
  }

  const y = h - 1;
  const cube = cubes.get(key(x, z, y));
  if (!cube) {
    return;
  }

  scene.remove(cube);
  cubes.delete(key(x, z, y));
  setColumnHeight(x, z, y);
}

function clearAllCubes() {
  for (const cube of cubes.values()) {
    scene.remove(cube);
  }
  cubes.clear();
  heights.clear();
  if (cursorInfo) {
    cursorInfo.innerHTML = "<strong>Cursor:</strong> x: -, y: -, z: -";
  }
}

clearBtn.addEventListener("click", clearAllCubes);

for (let i = 0; i < 3; i += 1) {
  addCube(3, 3);
}
for (let i = 0; i < 4; i += 1) {
  addCube(5, 4);
}
addCube(6, 4);
addCube(6, 4);

const hoverMesh = new THREE.Mesh(
  new THREE.BoxGeometry(1.02, 1.02, 1.02),
  new THREE.MeshBasicMaterial({
    color: 0x2d7cf6,
    wireframe: true,
    transparent: true,
    opacity: 0.6
  })
);
hoverMesh.visible = false;
scene.add(hoverMesh);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const floorPick = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

function setPointerFromClient(clientX, clientY) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
}

function toGridFromFloorPoint(point) {
  const x = Math.floor(point.x);
  const z = Math.floor(point.z);
  if (!inBounds(x, z)) {
    return null;
  }
  return { x, z };
}

function pickColumnAtClient(clientX, clientY) {
  setPointerFromClient(clientX, clientY);
  raycaster.setFromCamera(pointer, camera);

  const cubeHits = raycaster.intersectObjects(Array.from(cubes.values()), false);
  if (cubeHits.length > 0) {
    const grid = cubeHits[0].object.userData.grid;
    return { x: grid.x, z: grid.z };
  }

  const floorHit = new THREE.Vector3();
  if (raycaster.ray.intersectPlane(floorPick, floorHit)) {
    return toGridFromFloorPoint(floorHit);
  }

  return null;
}

function pickColumnFromMouseEvent(event) {
  return pickColumnAtClient(event.clientX, event.clientY);
}

function updateCursorInfo(target) {
  if (!cursorInfo) {
    return;
  }

  if (!target) {
    cursorInfo.innerHTML = "<strong>Cursor:</strong> x: -, y: -, z: -";
    return;
  }

  const topY = getColumnHeight(target.x, target.z);
  cursorInfo.innerHTML = `<strong>Cursor:</strong> x: ${target.x + 1}, y: ${topY + 1}, z: ${target.z + 1}`;
}

renderer.domElement.addEventListener("mousemove", (event) => {
  const target = pickColumnFromMouseEvent(event);
  if (!target) {
    hoverMesh.visible = false;
    updateCursorInfo(null);
    return;
  }

  const topY = getColumnHeight(target.x, target.z);
  hoverMesh.position.set(target.x + 0.5, topY + 0.5, target.z + 0.5);
  hoverMesh.visible = true;
  updateCursorInfo(target);
});

renderer.domElement.addEventListener("mouseleave", () => {
  hoverMesh.visible = false;
  updateCursorInfo(null);
});

const rotating = {
  active: false,
  lastX: 0,
  lastY: 0
};

let suppressMouseClickUntil = 0;
const touchState = {
  mode: "none",
  tapCandidate: false,
  tapStartTime: 0,
  tapStartX: 0,
  tapStartY: 0,
  pinchStartDist: 0,
  pinchStartRadius: orbitState.radius,
  twoFingerMoved: false,
  twoFingerStartTime: 0,
  twoFingerMidX: 0,
  twoFingerMidY: 0,
  lastX: 0,
  lastY: 0
};

function distanceTouches(t1, t2) {
  const dx = t1.clientX - t2.clientX;
  const dy = t1.clientY - t2.clientY;
  return Math.hypot(dx, dy);
}

function midpointTouches(t1, t2) {
  return {
    x: (t1.clientX + t2.clientX) / 2,
    y: (t1.clientY + t2.clientY) / 2
  };
}

renderer.domElement.addEventListener("pointerdown", (event) => {
  if (event.button === 2) {
    rotating.active = true;
    rotating.lastX = event.clientX;
    rotating.lastY = event.clientY;
  }
});

renderer.domElement.addEventListener("pointerup", (event) => {
  if (event.button === 2) {
    rotating.active = false;
  }
});

renderer.domElement.addEventListener("pointerleave", () => {
  rotating.active = false;
});

renderer.domElement.addEventListener("pointermove", (event) => {
  if (!rotating.active) {
    return;
  }

  const dx = event.clientX - rotating.lastX;
  const dy = event.clientY - rotating.lastY;
  rotating.lastX = event.clientX;
  rotating.lastY = event.clientY;

  orbitState.azimuth -= dx * 0.008;
  orbitState.polar = THREE.MathUtils.clamp(orbitState.polar + dy * 0.006, 0.25, 1.5);
  updateCamera();
});

renderer.domElement.addEventListener(
  "wheel",
  (event) => {
    event.preventDefault();
    orbitState.radius = THREE.MathUtils.clamp(orbitState.radius + event.deltaY * 0.02, 10, 44);
    updateCamera();
  },
  { passive: false }
);

renderer.domElement.addEventListener("click", (event) => {
  if (Date.now() < suppressMouseClickUntil) {
    return;
  }

  if (event.button !== 0 || rotating.active) {
    return;
  }

  const target = pickColumnFromMouseEvent(event);
  if (!target) {
    return;
  }

  if (event.shiftKey) {
    removeCubeAtColumn(target.x, target.z);
  } else {
    addCube(target.x, target.z);
  }
});

renderer.domElement.addEventListener(
  "touchstart",
  (event) => {
    suppressMouseClickUntil = Date.now() + 700;

    if (event.touches.length === 1) {
      const t = event.touches[0];
      touchState.mode = "rotate";
      touchState.tapCandidate = true;
      touchState.tapStartTime = Date.now();
      touchState.tapStartX = t.clientX;
      touchState.tapStartY = t.clientY;
      touchState.lastX = t.clientX;
      touchState.lastY = t.clientY;

      const target = pickColumnAtClient(t.clientX, t.clientY);
      if (!target) {
        hoverMesh.visible = false;
        updateCursorInfo(null);
      } else {
        const topY = getColumnHeight(target.x, target.z);
        hoverMesh.position.set(target.x + 0.5, topY + 0.5, target.z + 0.5);
        hoverMesh.visible = true;
        updateCursorInfo(target);
      }
    } else if (event.touches.length === 2) {
      const t1 = event.touches[0];
      const t2 = event.touches[1];
      const mid = midpointTouches(t1, t2);
      touchState.mode = "pinch";
      touchState.pinchStartDist = distanceTouches(t1, t2);
      touchState.pinchStartRadius = orbitState.radius;
      touchState.twoFingerMoved = false;
      touchState.twoFingerStartTime = Date.now();
      touchState.twoFingerMidX = mid.x;
      touchState.twoFingerMidY = mid.y;
    }
  },
  { passive: true }
);

renderer.domElement.addEventListener(
  "touchmove",
  (event) => {
    suppressMouseClickUntil = Date.now() + 700;

    if (event.touches.length === 1 && touchState.mode === "rotate") {
      const t = event.touches[0];
      const dx = t.clientX - touchState.lastX;
      const dy = t.clientY - touchState.lastY;
      touchState.lastX = t.clientX;
      touchState.lastY = t.clientY;

      if (Math.hypot(t.clientX - touchState.tapStartX, t.clientY - touchState.tapStartY) > 6) {
        touchState.tapCandidate = false;
      }

      orbitState.azimuth -= dx * 0.008;
      orbitState.polar = THREE.MathUtils.clamp(orbitState.polar + dy * 0.006, 0.25, 1.5);
      updateCamera();

      const target = pickColumnAtClient(t.clientX, t.clientY);
      if (!target) {
        hoverMesh.visible = false;
        updateCursorInfo(null);
      } else {
        const topY = getColumnHeight(target.x, target.z);
        hoverMesh.position.set(target.x + 0.5, topY + 0.5, target.z + 0.5);
        hoverMesh.visible = true;
        updateCursorInfo(target);
      }
      return;
    }

    if (event.touches.length === 2) {
      const t1 = event.touches[0];
      const t2 = event.touches[1];
      const currentDist = distanceTouches(t1, t2);
      if (touchState.pinchStartDist > 0) {
        orbitState.radius = THREE.MathUtils.clamp(
          touchState.pinchStartRadius * (touchState.pinchStartDist / currentDist),
          10,
          44
        );
        updateCamera();
      }

      const mid = midpointTouches(t1, t2);
      if (Math.hypot(mid.x - touchState.twoFingerMidX, mid.y - touchState.twoFingerMidY) > 10) {
        touchState.twoFingerMoved = true;
      }
      if (Math.abs(currentDist - touchState.pinchStartDist) > 8) {
        touchState.twoFingerMoved = true;
      }
    }
  },
  { passive: true }
);

renderer.domElement.addEventListener(
  "touchend",
  (event) => {
    suppressMouseClickUntil = Date.now() + 700;

    if (touchState.mode === "rotate" && touchState.tapCandidate) {
      const duration = Date.now() - touchState.tapStartTime;
      if (duration < 300) {
        const target = pickColumnAtClient(touchState.tapStartX, touchState.tapStartY);
        if (target) {
          addCube(target.x, target.z);
        }
      }
    }

    if (touchState.mode === "pinch") {
      const duration = Date.now() - touchState.twoFingerStartTime;
      if (!touchState.twoFingerMoved && duration < 300) {
        const target = pickColumnAtClient(touchState.twoFingerMidX, touchState.twoFingerMidY);
        if (target) {
          removeCubeAtColumn(target.x, target.z);
        }
      }
    }

    if (event.touches.length === 0) {
      touchState.mode = "none";
      touchState.tapCandidate = false;
    }
  },
  { passive: true }
);

renderer.domElement.addEventListener(
  "touchcancel",
  () => {
    touchState.mode = "none";
    touchState.tapCandidate = false;
    hoverMesh.visible = false;
    updateCursorInfo(null);
  },
  { passive: true }
);

renderer.domElement.addEventListener("contextmenu", (event) => {
  event.preventDefault();
});

function resize() {
  const width = root.clientWidth;
  const height = root.clientHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}

window.addEventListener("resize", resize);
resize();
updateCursorInfo(null);

function tick() {
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

tick();




