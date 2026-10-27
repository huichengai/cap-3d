window.onerror = function(m, s, l, c){var d=document.createElement("pre");d.style.cssText="position:fixed;left:0;top:0;z-index:99999;background:#fff;color:#c00;font:13px monospace;padding:10px;max-width:100%;white-space:pre-wrap";d.textContent="ERR: "+m+" @ "+l+":"+c;document.body.appendChild(d);};window.addEventListener('unhandledrejection',e=>{var d=document.createElement('pre');d.style.cssText='position:fixed;left:0;top:60px;z-index:99999;background:#fff;color:#c00;font:13px monospace;padding:10px';d.textContent='REJ: '+(e.reason&&e.reason.message||e.reason);document.body.appendChild(d);});
"use strict";
const EPS0 = 8.8541878128e-12;
const pf = v => (v * 1e12).toFixed(2);

/* ---------------- 场景 ---------------- */
const stage = document.getElementById("stage");
const canvas = document.getElementById("gl");
const renderer = new THREE.WebGLRenderer({canvas, antialias:true});
renderer.setPixelRatio(1);
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
const MOBILE = (window.matchMedia && (matchMedia("(max-width: 860px)").matches
                || matchMedia("(pointer: coarse)").matches));
const FAST = new URLSearchParams(location.search).has("fast") || MOBILE;   // 手机默认关阴影
renderer.shadowMap.enabled = !FAST;
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xeef2f7);

const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
const camState = { az: 0.62, el: 0.52, dist: 4.3, target: new THREE.Vector3(0, 0.62, 0) };
if (MOBILE){ camState.dist = 4.0; camState.el = 0.46; }   // 手机：模型更饱满

scene.add(new THREE.HemisphereLight(0xffffff, 0x8fa1b5, 0.55));
const key = new THREE.DirectionalLight(0xfff6ec, 0.85); key.position.set(4, 6, 5);
key.castShadow = true;
key.shadow.mapSize.set(1024, 1024);
key.shadow.camera.left = -3.2; key.shadow.camera.right = 3.2;
key.shadow.camera.top = 3.2;   key.shadow.camera.bottom = -3.2;
key.shadow.camera.near = 0.5;  key.shadow.camera.far = 20;
key.shadow.bias = -0.0009;
key.shadow.normalBias = 0.02;
scene.add(key);
const fill = new THREE.DirectionalLight(0xdbe8f7, 0.28); fill.position.set(-5, 2.5, -4); scene.add(fill);

/* 地面网格（弱） */
const grid = new THREE.GridHelper(12, 24, 0xc9d5e2, 0xdde6f0);
grid.position.y = -0.42;
const shadowPlane = new THREE.Mesh(
  new THREE.PlaneGeometry(16, 16),
  new THREE.ShadowMaterial({ color: 0x1e2a36, opacity: 0.22 })
);
shadowPlane.rotation.x = -Math.PI / 2;
shadowPlane.position.y = -0.022;
shadowPlane.receiveShadow = true;
scene.add(shadowPlane); scene.add(grid);

/* 相机交互 */
let drag = false, lastX = 0, lastY = 0;
canvas.addEventListener("pointerdown", e => { drag = true; lastX = e.clientX; lastY = e.clientY; });
window.addEventListener("pointerup", () => drag = false);
window.addEventListener("pointermove", e => {
  if (!drag || pinchD > 0) return;
  camState.az -= (e.clientX - lastX) * 0.008;
  camState.el = Math.max(-0.15, Math.min(1.25, camState.el + (e.clientY - lastY) * 0.006));
  lastX = e.clientX; lastY = e.clientY;
});
function resetCam(){
  camState.az = 0.62; camState.el = 0.52; camState.dist = 4.3;
  camState.target.set(0, 0.62, 0);
}
canvas.addEventListener("dblclick", resetCam);
/* 双指缩放（手机） */
let pinchD = 0;
canvas.addEventListener("touchstart", e => {
  if (e.touches.length === 2){
    pinchD = Math.hypot(e.touches[0].clientX - e.touches[1].clientX,
                        e.touches[0].clientY - e.touches[1].clientY);
    drag = false;
  }
}, {passive:true});
canvas.addEventListener("touchmove", e => {
  if (e.touches.length === 2 && pinchD > 0){
    e.preventDefault();
    const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX,
                         e.touches[0].clientY - e.touches[1].clientY);
    if (d > 0){
      camState.dist = Math.max(2.0, Math.min(11, camState.dist * pinchD / d));
      pinchD = d;
    }
  }
}, {passive:false});
canvas.addEventListener("touchend", e => {
  if (e.touches.length < 2) pinchD = 0;
}, {passive:true});

canvas.addEventListener("wheel", e => {
  e.preventDefault();
  camState.dist = Math.max(2.2, Math.min(11, camState.dist + e.deltaY * 0.0022));
}, {passive:false});

function updateCamera(){
  const {az, el, dist, target} = camState;
  camera.position.set(
    target.x + dist * Math.cos(el) * Math.sin(az),
    target.y + dist * Math.sin(el),
    target.z + dist * Math.cos(el) * Math.cos(az)
  );
  camera.lookAt(target);
}


/* ================= 外部资源（内联 base64，file:// 可用） ================= */
const PARTS = {};
let TEX = {};
function b64ToBuf(b64){
  const bin = atob(b64), len = bin.length, u8 = new Uint8Array(len);
  for (let i = 0; i < len; i++) u8[i] = bin.charCodeAt(i);
  return u8.buffer;
}
function loadAssets(done){
  try {
    const tl = new THREE.TextureLoader();
    const mk = (uri, srgb) => {
      const t = tl.load(uri);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      if (srgb) t.encoding = THREE.sRGBEncoding;
      return t;
    };
    if (window.TEX_BASE)   TEX.base   = mk(window.TEX_BASE, true);
    if (window.TEX_ROUGH)  TEX.rough  = mk(window.TEX_ROUGH, false);
    if (window.TEX_NORMAL) TEX.normal = mk(window.TEX_NORMAL, false);
  } catch(e){ console.warn("贴图失败", e); }

  /* 环境反射：
     USE_PMREM = true  → 用 PMREM 预滤波，金属反射最准（需要显卡；无头/软件渲染下会卡）
     USE_PMREM = false → 直接拿等距柱状图当环境，略糊但稳 */
  const USE_PMREM = false;
  if (window.ENV_PNG){
    new THREE.TextureLoader().load(window.ENV_PNG, tex => {
      tex.mapping = THREE.EquirectangularReflectionMapping;
      tex.encoding = THREE.sRGBEncoding;
      if (USE_PMREM){
        const pm = new THREE.PMREMGenerator(renderer);
        pm.compileEquirectangularShader();
        scene.environment = pm.fromEquirectangular(tex).texture;
        pm.dispose();
      } else {
        scene.environment = tex;
      }
    });
  }

  if (!window.GLB_B64){ done(); return; }
  try {
    new THREE.GLTFLoader().parse(b64ToBuf(window.GLB_B64), "", g => {
      g.scene.traverse(o => { if (o.isMesh) PARTS[o.name] = o; });
      console.log("GLB 零件载入:", Object.keys(PARTS).length);
      done();
    }, err => { console.warn("GLB 解析失败，回退程序化几何", err); done(); });
  } catch(e){ console.warn("GLB 失败", e); done(); }
}

/* ---------------- 齿轮几何：按齿廓采样后挤出 ---------------- */
function gearGeometry(z, Rroot, Rtip, width){
  const P = Math.PI * 2 / z;
  const seg = 20;                       // 每齿采样点
  const pts = [];
  /* 齿廓：齿顶平台 0.10–0.42，齿侧 0.42–0.55 平滑下降，齿根 0.55–1.0 */
  const profile = (q) => {
    const s = (a, b, x) => {
      const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
      return t * t * (3 - 2 * t);
    };
    if (q < 0.08) return 1;
    if (q < 0.46) return 1;
    if (q < 0.54) return 1 - s(0.46, 0.54, q);
    return 0;
  };
  for (let i = 0; i < z; i++){
    for (let k = 0; k < seg; k++){
      const q = k / seg;
      const phi = i * P + q * P;
      const r = Rroot + (Rtip - Rroot) * profile(q);
      pts.push(new THREE.Vector2(Math.cos(phi) * r, Math.sin(phi) * r));
    }
  }
  const shape = new THREE.Shape(pts);
  /* 内孔（轴孔） */
  const hole = new THREE.Path();
  hole.absarc(0, 0, Rroot * 0.16, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: width * 0.72, bevelEnabled: true,
    bevelThickness: width * 0.055, bevelSize: 0.005, bevelSegments: 2, curveSegments: 6
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, -width * 0.36, 0);
  geo.computeVertexNormals();
  return geo;
}

/* 几何：优先用 GLB 里的，没有就用程序化兜底 */
function partGeo(name, fallbackFn){
  if (PARTS[name] && PARTS[name].geometry) return PARTS[name].geometry;
  return fallbackFn();
}
/* 金属材质贴图 */
function applyMetalTex(mat){
  if (!TEX.base) return mat;
  mat.map = TEX.base;
  mat.roughnessMap = TEX.rough;
  mat.normalMap = TEX.normal;
  mat.metalness = 0.38;
  mat.roughness = 0.46;
  mat.envMapIntensity = 0.55;
  mat.color.setHex(0xc4ced9);
  mat.normalScale = new THREE.Vector2(0.45, 0.45);
  if (TEX.base){ TEX.base.repeat.set(2, 2); }
  if (TEX.rough){ TEX.rough.repeat.set(2, 2); }
  if (TEX.normal){ TEX.normal.repeat.set(2, 2); }
  mat.needsUpdate = true;
  return mat;
}


/* 程序化环境贴图：给金属提供反射，避免"塑料感" */
(function makeEnv(){
  const c = document.createElement("canvas");
  c.width = 512; c.height = 256;
  const g = c.getContext("2d");
  const grd = g.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0.00, "#ffffff");
  grd.addColorStop(0.42, "#e6eef8");
  grd.addColorStop(0.52, "#cfdae6");
  grd.addColorStop(1.00, "#8c99a6");
  g.fillStyle = grd; g.fillRect(0, 0, 512, 256);
  /* 两块柔光板，让金属有高光条 */
  g.fillStyle = "rgba(255,255,255,.95)";
  g.beginPath(); g.ellipse(150, 62, 96, 34, 0, 0, 7); g.fill();
  g.beginPath(); g.ellipse(380, 48, 70, 26, 0, 0, 7); g.fill();
  const t = new THREE.CanvasTexture(c);
  t.mapping = THREE.EquirectangularReflectionMapping;
  t.encoding = THREE.sRGBEncoding;
  scene.environment = t;
})();

/* ---------------- 材质 ---------------- */
const M = {
  red:   new THREE.MeshStandardMaterial({color:0xe4573d, metalness:0.55, roughness:0.34, envMapIntensity:0.9}),
  blue:  new THREE.MeshStandardMaterial({color:0x2e6fd0, metalness:0.55, roughness:0.34, envMapIntensity:0.9}),
  steel: new THREE.MeshStandardMaterial({color:0x9fb0c2, metalness:0.95, roughness:0.28, envMapIntensity:1.0}),
  amber: new THREE.MeshStandardMaterial({color:0xe8a119, metalness:0.15, roughness:0.55,
           transparent:true, opacity:0.92}),
  glass: new THREE.MeshPhysicalMaterial({color:0xd8e8f6, metalness:0, roughness:0.06,
           transparent:true, opacity:0.22, side:THREE.DoubleSide}),
  water: new THREE.MeshPhysicalMaterial({color:0x2f86c9, metalness:0, roughness:0.12,
           transparent:true, opacity:0.74}),
  dark:  new THREE.MeshStandardMaterial({color:0x24313d, metalness:0.4, roughness:0.6}),
  line:  new THREE.LineBasicMaterial({color:0x2ea3d8, transparent:true, opacity:0.55}),
};

/* ---------------- 通用小工具 ---------------- */
function plate(w, h, d, mat){
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.castShadow = false; m.receiveShadow = false;
  return m;
}
function fieldLines(n, w, d, yTop, yBot){
  const g = new THREE.BufferGeometry();
  const pts = [];
  for (let i = 0; i < n; i++){
    const x = -w/2 + w * (i + 0.5) / n;
    pts.push(x, yBot, 0, x, yTop, 0);
    pts.push(x, yBot, -d/2, x, yTop, -d/2);
  }
  g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  return new THREE.LineSegments(g, M.line);
}
function disposeGroup(g){
  g.traverse(o => {
    if (o.geometry) o.geometry.dispose();
  });
  scene.remove(g);
}

/* ================= 模块 ================= */
const MODULES = [];
let root = null;

/* ---- 1. 麦克风：变极距 ---- */
MODULES.push({
  id:"mic", tab:"电容麦克风", points:["振膜=动极板，带孔背极板固定","声压让 d 在几十微米间变化","ΔC/C 只有万分之几 → 必须放大"], real:{video:"thumb_mic.mp4", poster:"thumb_mic.jpg", cap:"实物：驻极体电容传声器（拆解动画）"},
  tip:"吹一口气 → 声压推振膜 → d 变 → C 变",
  hint:"振膜与背极板之间只有几十微米，<b>只有 d 在变</b>；画面中的位移已按 ×420 放大，真实位移只有几纳米。",
  controls:[
    {k:"p", label:"声压幅值", min:0, max:2, step:0.05, val:1.0, unit:"Pa"},
    {k:"f", label:"声波频率", min:100, max:2000, step:20, val:440, unit:"Hz"},
    {k:"d0",label:"静态极距 d₀", min:15, max:60, step:1, val:25, unit:"μm"}
  ],
  fixed:{a:5e-3},
  calc(s){
    const A = Math.PI * this.fixed.a ** 2, d0 = s.d0 * 1e-6;
    return {A, d0, C0: EPS0 * A / d0, xp: s.p * 1e-8};
  },
  build(){
    const g = new THREE.Group();
    const R = 1.0;
    // 背极板（蓝）：带孔
    const back = new THREE.Mesh(partGeo("backplate", () => new THREE.CylinderGeometry(R, R, 0.10, 64)), M.blue);
    back.position.y = 0.05; g.add(back);
    for (let i = 0; i < 7; i++){
      const a = i / 7 * Math.PI * 2;
      const hole = new THREE.Mesh(partGeo("hole_0", () => new THREE.CylinderGeometry(0.075, 0.075, 0.11, 18)), M.dark);
      hole.position.set(Math.cos(a) * 0.52, 0.052, Math.sin(a) * 0.52);
      g.add(hole);
    }
    // 振膜（红）
    const mem = new THREE.Mesh(partGeo("membrane", () => new THREE.CylinderGeometry(R, R, 0.02, 64)), M.red);
    mem.name = "membrane"; g.add(mem);
    // 场线
    const fl = new THREE.Group(); fl.name = "field"; g.add(fl);
    const geo = new THREE.BufferGeometry();
    const pts = [];
    for (let i = 0; i < 10; i++){
      const a = i / 10 * Math.PI * 2;
      pts.push(Math.cos(a) * 0.78, 0.10, Math.sin(a) * 0.78,
               Math.cos(a) * 0.78, 0.40, Math.sin(a) * 0.78);
    }
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    fl.add(new THREE.LineSegments(geo, M.line));
    // 声波环
    const rings = new THREE.Group(); rings.name = "rings"; g.add(rings);
    for (let i = 0; i < 3; i++){
      const mat = new THREE.MeshBasicMaterial({color:0xe8a119, transparent:true, opacity:0.5});
      const t = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.006, 6, 56), mat);
      t.rotation.x = Math.PI / 2; t.position.y = 0.42; t.name = "ring" + i;
      rings.add(t);
    }
    root = g; scene.add(g);
  },
  update(s, t, g0){
    const g = this.calc(s);
    const ph = Math.sin(2 * Math.PI * s.f * t);
    const x  = g.xp * ph;
    const d  = g.d0 - x;
    const C  = EPS0 * g.A / d;

    /* ④ 静态极距 → 视觉间距：15 μm→0.20，60 μm→0.66 */
    const gapVis = 0.20 + 0.46 * (s.d0 - 15) / 45;

    /* ② 声压 → 振幅：把 x/d₀ 按 GAIN 放大后画出来（界面注明倍数） */
    const GAIN = 420;
    const xVis = (x / g.d0) * gapVis * GAIN;

    const yM = 0.10 + gapVis + xVis;          // 只有振膜在动，背极板固定
    root.getObjectByName("membrane").position.y = yM;

    /* 场线随之伸缩 */
    const geo = new THREE.BufferGeometry(); const pts = [];
    for (let i = 0; i < 12; i++){
      const a = i / 12 * Math.PI * 2;
      pts.push(Math.cos(a) * 0.78, 0.10, Math.sin(a) * 0.78,
               Math.cos(a) * 0.78, yM, Math.sin(a) * 0.78);
    }
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    const fl = root.getObjectByName("field").children[0];
    fl.geometry.dispose(); fl.geometry = geo;

    /* ③ 声波环：发射周期 = 1/f，频率越高环跑得越快、越密 */
    const rings = root.getObjectByName("rings").children;
    const speed = 0.55 + 0.45 * (s.f / 2000);        // 高频略快，避免闪成一片
    rings.forEach((r, i) => {
      const phase = ((t * s.f * 0.9 * speed + i / rings.length) % 1);
      const rad = 0.55 + phase * 1.05;
      r.scale.setScalar(rad / 0.72);
      r.material.opacity = 0.42 * (1 - phase) * (0.35 + 0.65 * (s.p / 2));
      r.visible = s.p > 0.02;
    });

    return {C, extra:[["振膜位移", (x*1e9).toFixed(1)+" nm"],
                      ["ΔC/C₀", ((C-g0.C0)/g0.C0*100).toFixed(4)+" %"],
                      ["d", (d*1e6).toFixed(2)+" μm"],
                      ["位移显示倍数", "×" + GAIN]]};
  },
  series(s, t, g0){ // 波形数据
    const g = this.calc(s), arr = [];
    for (let i = 0; i <= 120; i++){
      const tau = t - (i/120)*0.02;
      arr.push(EPS0 * g.A / (g.d0 - g.xp * Math.sin(2*Math.PI*s.f*tau)));
    }
    return arr.reverse();
  }
});

/* ---- 2. 转速：变极距 ---- */
MODULES.push({
  id:"rpm", tab:"测转速",
  points:["齿盘是动极板，探头（定极板）固定不动","齿顶经过时 d 最小、C 最大","输出频率 f = 齿数 z × 转速 n / 60"],
  real:{video:"thumb_gear.mp4", poster:"thumb_gear.jpg", cap:"实物：齿盘 + 电容探头（非接触测转速）"},
  tip:"齿轮转、探头不动；齿顶与齿槽交替经过探头下方，间隙 d 周期性变化",
  hint:"<b>变极距型</b>：探头固定，齿顶经过时 d 最小、C 最大；齿槽经过时 d 最大、C 最小。测频率即可反算转速。",
  controls:[
    {k:"n",  label:"转速 n", min:0, max:1200, step:10, val:600, unit:"rpm"},
    {k:"z",  label:"齿数 z", min:8, max:48, step:1, val:16, unit:"齿"},
    {k:"d0", label:"齿顶间隙 d₀", min:0.2, max:1.0, step:0.05, val:0.30, unit:"mm"},
    {k:"h",  label:"齿高 h", min:0.2, max:0.8, step:0.05, val:0.40, unit:"mm"}
  ],
  fixed:{A: 9e-6, Rroot: 0.62},
  calc(s){
    const d0 = s.d0 * 1e-3, h = s.h * 1e-3;
    /* 视觉标度：齿高 0.2–0.8 mm → 0.10–0.34；齿顶间隙 0.2–1.0 mm → 0.05–0.30 */
    const hVis   = 0.10 + 0.24 * (s.h - 0.2) / 0.6;
    const gapVis = 0.05 + 0.25 * (s.d0 - 0.2) / 0.8;
    return {d0, h, A: this.fixed.A, hVis, gapVis,
            Rroot: this.fixed.Rroot,
            Rtooth: this.fixed.Rroot + hVis,
            Cmax: EPS0 * this.fixed.A / d0,
            Cmin: EPS0 * this.fixed.A / (d0 + h),
            f: s.z * s.n / 60};
  },
  build(s0){
    s0 = s0 || {};
    const g = new THREE.Group();
    const gear = new THREE.Group(); gear.name = "gear"; g.add(gear);

    /* 齿盘主体由 rebuildGear 生成；这里放轮毂与减重孔 */
    const R0 = this.fixed.Rroot;
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(R0 * 0.99, R0 * 0.99, 0.12, 64), M.dark);
    hub.name = "hub"; gear.add(hub);
    /* 凸台（中心台阶） */
    const boss = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.19, 0.16, 48), M.steel);
    boss.position.y = 0.10; gear.add(boss);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(R0 * 0.98, 0.008, 8, 72), M.steel);
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.062; gear.add(ring);
    /* 减重孔：凹坑（外圈 + 暗底） */
    for (let i = 0; i < 5; i++){
      const a = i / 5 * Math.PI * 2 + 0.3;
      const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.098, 0.098, 0.14, 24), M.dark);
      hole.position.set(Math.cos(a) * 0.36, 0.01, Math.sin(a) * 0.36);
      hole.name = "hubhole"; gear.add(hole);
      const lip = new THREE.Mesh(new THREE.TorusGeometry(0.098, 0.006, 6, 28), M.steel);
      lip.rotation.x = Math.PI / 2;
      lip.position.set(Math.cos(a) * 0.36, 0.058, Math.sin(a) * 0.36);
      gear.add(lip);
    }

    /* 探头：外壳 + 陶瓷绝缘套 + 红色极面 + 引线 */
    const probe = new THREE.Group(); probe.name = "probe"; g.add(probe);
    const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.34, 32), M.steel);
    shell.rotation.z = Math.PI / 2; shell.position.set(0.22, 0, 0); probe.add(shell);
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.118, 0.012, 8, 32), M.steel);
    collar.rotation.y = Math.PI / 2; collar.position.set(0.055, 0, 0); probe.add(collar);
    const cer = new THREE.Mesh(new THREE.CylinderGeometry(0.104, 0.104, 0.045, 28),
      new THREE.MeshStandardMaterial({color:0xf2f0ea, roughness:0.55, metalness:0.05}));
    cer.rotation.z = Math.PI / 2; cer.position.set(0.028, 0, 0); probe.add(cer);
    const face = new THREE.Mesh(new THREE.CylinderGeometry(0.086, 0.086, 0.014, 28), M.red);
    face.rotation.z = Math.PI / 2; face.position.set(0.002, 0, 0); probe.add(face);
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.020, 0.020, 0.30, 12), M.dark);
    cable.rotation.z = Math.PI / 2; cable.position.set(0.52, 0, 0); probe.add(cable);

    /* 支架：L 形夹臂 + 两颗螺钉（从齿盘后方伸出） */
    const armV = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.42, 0.075), M.steel);
    armV.position.set(0.30, -0.24, -0.30); armV.name = "mast"; g.add(armV);
    const armH = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.055, 0.30), M.steel);
    armH.position.set(0.30, -0.04, -0.16); g.add(armH);
    for (const dz of [-0.05, 0.05]){
      const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.085, 10), M.dark);
      screw.rotation.x = Math.PI / 2; screw.position.set(0.30 + dz, 0.02, -0.02); g.add(screw);
    }
    /* 间隙指示条 */
    const gapBar = new THREE.Mesh(new THREE.BoxGeometry(1, 0.014, 0.014),
                                  new THREE.MeshBasicMaterial({color:0xe8a119}));
    gapBar.name = "gapbar"; g.add(gapBar);

    const fl = new THREE.LineSegments(new THREE.BufferGeometry(), M.line);
    fl.name = "field"; g.add(fl);

    root = g; scene.add(g);
    this._z = 0; this._h = -1;
    this.rebuildGear(s0.z || 16, s0.h || 0.4);
  },
  rebuildGear(z, h){
    const gear = root.getObjectByName("gear");
    if (!gear) return;
    gear.children.filter(c => c.name === "gearBody").forEach(c => { gear.remove(c); c.geometry.dispose(); });
    const hVis = 0.10 + 0.24 * (h - 0.2) / 0.6;
    const R0 = this.fixed.Rroot;
    const body = new THREE.Mesh(gearGeometry(z, R0, R0 + hVis, 0.14), M.steel);
    body.name = "gearBody";
    gear.add(body);
    this._z = z; this._h = h;
  },
  update(s, t, g0){
    if (this._z !== s.z || Math.abs(this._h - s.h) > 1e-6) this.rebuildGear(s.z, s.h);

    const g = this.calc(s);
    const th = 2 * Math.PI * (s.n / 60) * t;
    root.getObjectByName("gear").rotation.y = -th;

    /* 齿内相位：0 = 齿顶正对探头，1 = 齿槽正对 */
    const k = 0.5 * (1 - Math.cos(s.z * th));
    const gap = g.d0 + g.h * k;
    const C = EPS0 * g.A / gap;

    /* 探头固定：位置只随 d₀ 变（拖动滑杆时一次性移动，动画中不动） */
    const probeFaceX = g.Rtooth + g.gapVis;
    root.getObjectByName("probe").position.x = probeFaceX;

    /* 支架随探头一起平移（保持刚性连接），但不进入齿盘区域 */
    root.getObjectByName("mast").position.x = probeFaceX + 0.14;

    /* 间隙指示条：从齿面画到探头端面 */
    const Rsurf0 = g.Rtooth - g.hVis * k;
    const bar = root.getObjectByName("gapbar");
    bar.scale.x = Math.max(0.001, probeFaceX - Rsurf0);
    bar.position.set((probeFaceX + Rsurf0) / 2, 0.0, 0.0);

    /* 当前正对探头的是齿顶还是齿槽 → 表面半径 */
    const Rsurf = g.Rtooth - g.hVis * k;
    const geo = new THREE.BufferGeometry(); const pts = [];
    for (let i = 0; i < 6; i++){
      const yy = -0.075 + i * 0.030, zz = -0.05 + (i % 3) * 0.05;
      pts.push(probeFaceX, yy, zz, Rsurf, yy, zz);
    }
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    const fl = root.getObjectByName("field");
    fl.geometry.dispose(); fl.geometry = geo;

    const f = g.f;
    return {C, extra:[["当前间隙 d", (gap*1e3).toFixed(2) + " mm"],
                      ["输出频率 f", f.toFixed(1) + " Hz"],
                      ["反算转速 60f/z", (f * 60 / s.z).toFixed(0) + " rpm"],
                      ["C 最大 / 最小", (g0.Cmax*1e12).toFixed(3) + " / " + (g0.Cmin*1e12).toFixed(3) + " pF"]]};
  },
  series(s, t, g0){
    const g = this.calc(s), arr = [];
    for (let i = 0; i <= 160; i++){
      const tau = t - (i / 160) * 0.06;
      const kk = 0.5 * (1 - Math.cos(s.z * 2 * Math.PI * (s.n / 60) * tau));
      arr.push(EPS0 * g.A / (g.d0 + g.h * kk));
    }
    return arr.reverse();
  }
});

MODULES.push({
  id:"level", tab:"测液位", points:["极板不动，动的是介质","上下两段并联：C = ε₀b[εr·h+(L−h)]/d","C 与液位近似线性"], real:{video:"thumb_tank.mp4", poster:"thumb_tank.jpg", cap:"实物：带两侧电极的液位槽（水面上升）"},
  tip:"水面上升 → 介质填充段变长 → C 变大",
  hint:"竖极板、上下两段并联：C = ε₀b[εr·h + (L−h)]/d，<b>极板不动</b>；拖动 εr 看介质颜色与电容一起变。",
  controls:[
    {k:"h", label:"液位高度 h", min:0, max:200, step:1, val:80, unit:"mm"},
    {k:"er", label:"液体介电常数 εr", min:1, max:81, step:0.5, val:80, unit:"—"}
  ],
  fixed:{b:0.05, L:0.20, d:0.005},
  calc(s){
    const F = this.fixed, h = s.h/1000, perM = EPS0*F.b/F.d;
    return {h, perM, Cair: perM*F.L, Cw: perM*F.L*s.er};
  },
  build(){
    const g = new THREE.Group();
    const TW = 1.7, TH = 2.0, TD = 1.05;
    // 玻璃槽
    const tank = new THREE.Mesh(new THREE.BoxGeometry(TW, TH, TD), M.glass);
    tank.position.y = TH/2; g.add(tank);
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(TW, TH, TD)),
      new THREE.LineBasicMaterial({color:0x8fb0cc, transparent:true, opacity:0.75}));
    edges.position.y = TH/2; g.add(edges);
    // 极板
    const pL = plate(0.05, TH - 0.12, TD - 0.12, M.red);  pL.position.set(-TW/2 + 0.06, TH/2, 0); g.add(pL);
    const pR = plate(0.05, TH - 0.12, TD - 0.12, M.blue); pR.position.set( TW/2 - 0.06, TH/2, 0); g.add(pR);
    // 水
    const water = new THREE.Mesh(partGeo("water", () => new THREE.BoxGeometry(TW - 0.16, 1, TD - 0.16)), M.water);
    water.name = "water";
    water.position.y = 0.5; g.add(water);
    const fl = new THREE.LineSegments(new THREE.BufferGeometry(), M.line);
    fl.name = "field"; g.add(fl);
    root = g; scene.add(g);
  },
  update(s, t, g0){
    const F = this.fixed, h = s.h/1000, C = g0.perM*(s.er*h + (F.L - h));
    const hh = 2.0*0.94*(h/F.L);
    const water = root.getObjectByName("water");
    water.scale.y = Math.max(0.001, hh);
    water.position.y = hh/2 + 0.03;
    /* 介质颜色随 εr 变化：空气=近透明，油≈2.2=淡琥珀，水≈80=蓝 */
    const er = s.er;
    let cr, cg, cb, op;
    if (er <= 1.4){ cr = 0.86; cg = 0.90; cb = 0.95; op = 0.16; }
    else if (er < 10){ const k = (er - 1.4) / 8.6;
      cr = 0.86 + (0.95 - 0.86) * k; cg = 0.90 + (0.72 - 0.90) * k; cb = 0.95 + (0.35 - 0.95) * k; op = 0.35 + 0.3 * k; }
    else { const k = Math.min(1, (er - 10) / 70);
      cr = 0.95 - 0.75 * k; cg = 0.72 - 0.30 * k; cb = 0.35 + 0.37 * k; op = 0.65 + 0.09 * k; }
    water.material.color.setRGB(cr, cg, cb);
    water.material.opacity = op;
    // 场线
    const geo = new THREE.BufferGeometry(); const pts = [];
    for (const z of [-0.30, 0.30]){
      for (let j = 0; j < 5; j++){
        const y = 0.08 + 1.86*(j+0.5)/5;
        pts.push(-0.80, y, z, 0.80, y, z);
      }
    }
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    const fl = root.getObjectByName("field");
    fl.geometry.dispose(); fl.geometry = geo;
    return {C, extra:[["空槽 C", (g0.Cair*1e12).toFixed(1)+" pF"],
                      ["满槽 C", (g0.Cw*1e12).toFixed(0)+" pF"],
                      ["液位比", (h/F.L*100).toFixed(0)+" %"]]};
  },
  series(s, t, g0){
    const F = this.fixed, arr = [];
    for (let i = 0; i <= 120; i++){
      const hh = F.L*i/120;
      arr.push(g0.perM*(s.er*hh + (F.L-hh)));
    }
    return arr;
  },
  xMode:"h"
});

/* ---- 4. 旋钮：变面积 ---- */
MODULES.push({
  id:"rot", tab:"旋钮 · 变面积",
  points:["定片与动片各自可转，只有相对角差决定重叠","重叠扇形 = 正对面积 S","S 减小 → C 线性下降"],
  real:{video:"thumb_knob.mp4", poster:"thumb_knob.jpg", cap:"实物：收音机调台旋钮（动片转动）"},
  tip:"转定片、转动片都行，C 只认两者的夹角差",
  hint:"<b>变面积型</b>：两组半圆极片各自可转；黄色区域的<b>两条直边就是两块极板的边</b>，所以它随极板转——它其实就是正对面积 S。",
  controls:[
    {k:"a",  label:"定片转角 α", min:0, max:180, step:1, val:0, unit:"°"},
    {k:"b",  label:"动片转角 β", min:0, max:180, step:1, val:30, unit:"°"},
    {k:"d",  label:"极板间距 d", min:0.5, max:5, step:0.1, val:2.0, unit:"mm"}
  ],
  fixed:{R:0.02},
  calc(s){
    const S0 = Math.PI * this.fixed.R ** 2 / 2;      // 半圆面积
    const dA = Math.abs(s.b - s.a) * Math.PI / 180;  // 相对角差
    const frac = Math.max(0, (Math.PI - dA) / Math.PI);  // 重叠比例 0..1
    return {S0, frac, S: S0 * frac, C0: EPS0 * S0 / (s.d * 1e-3)};
  },
  build(){
    const g = new THREE.Group();
    const R = 1.0, H = 0.05;
    /* 底板 */
    const base = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.15, R * 1.15, 0.05, 72), M.dark);
    base.position.y = -0.20; g.add(base);
    /* 定片（红）：可独立转 */
    const stat = new THREE.Mesh(new THREE.CylinderGeometry(R, R, H, 72, 1, false, 0, Math.PI), M.red);
    stat.position.y = 0.16; stat.name = "stator"; g.add(stat);
    /* 动片（蓝）：可独立转 */
    const rot = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.97, R * 0.97, H, 72, 1, false, 0, Math.PI), M.blue);
    rot.position.y = 0.02; rot.name = "rotor"; g.add(rot);
    /* 重叠区：不是独立零件，而是在两块极板的面上各染一片琥珀色 */
    /* 3D 里只放两块极板；重叠面积在右侧俯视小图中标注 */
    /* 轴 */
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.60, 20), M.steel);
    shaft.position.y = 0.02; g.add(shaft);
    root = g; scene.add(g);
  },
  update(s, t, g0){
    const g = this.calc(s);
    const C = EPS0 * g.S / (s.d * 1e-3);
    const a = s.a * Math.PI / 180, b = s.b * Math.PI / 180;
    const lo = Math.max(a, b);
    const span = Math.max(0.0001, Math.min(a, b) + Math.PI - lo);

    /* 极板间距 d（0.5–5 mm）→ 两片竖向间距（0.03–0.23） */
    const gapV = 0.03 + 0.20 * (s.d - 0.5) / 4.5;
    const yStat = 0.02 + gapV + 0.05;          // 定片在上
    const yRot  = 0.02;                        // 动片在下（基准面）
    root.getObjectByName("stator").position.y = yStat;

    /* 定片绕 Y 转 −α，动片转 −β（各自独立） */
    root.getObjectByName("stator").rotation.y = -a;
    root.getObjectByName("rotor").rotation.y = -b;


    /* 两个指针的角度差 = 相对角 */
    this._plan = {a: s.a, b: s.b, lo, span};
    return {C, extra:[["正对面积 S", (g.S*1e6).toFixed(1) + " mm²"],
                      ["重叠比例", (g.frac*100).toFixed(0) + " %"],
                      ["相对角 |α−β|", Math.abs(s.b - s.a).toFixed(0) + "°"],
                      ["极板间距", s.d.toFixed(1) + " mm"]]};
  },
  series(s, t, g0){
    /* 横轴：相对角 0→180°，C = ε₀·(R²/2)(π−δ)/d */
    const arr = [];
    for (let i = 0; i <= 120; i++){
      const frac = Math.max(0, (Math.PI - (i / 120) * Math.PI) / Math.PI);
      arr.push(EPS0 * (g0.S0 * frac) / (s.d * 1e-3));
    }
    return arr;
  },
  xMode:"rel"
});

/* ================= HUD ================= */
const tabsEl = document.getElementById("tabs");
const scrollEl = document.getElementById("scroll");
const footEl = document.getElementById("foot");
const tipEl = document.getElementById("tip");
const chartCv = document.createElement("canvas");
let cur = 0, state = {};

function buildTabs(){
  tabsEl.innerHTML = "";
  MODULES.forEach((m, i) => {
    const b = document.createElement("button");
    b.textContent = m.tab; b.className = i === cur ? "on" : "";
    b.onclick = () => { cur = i; buildTabs(); buildPanel(); buildScene(); };
    tabsEl.appendChild(b);
  });
}
function buildPanel(){
  const m = MODULES[cur];
  state = {};
  m.controls.forEach(c => state[c.k] = c.val);
  scrollEl.innerHTML = "";
  const g1 = document.createElement("div"); g1.className = "group"; g1.textContent = "可调参数";
  scrollEl.appendChild(g1);
  m.controls.forEach(c => {
    const box = document.createElement("div"); box.className = "ctl";
    box.innerHTML = `<div class="row"><span class="nm">${c.label}</span>
      <span class="vl" id="v_${c.k}">${c.val} ${c.unit}</span></div>
      <input type="range" id="r_${c.k}" min="${c.min}" max="${c.max}" step="${c.step}" value="${c.val}">`;
    scrollEl.appendChild(box);
    box.querySelector("input").addEventListener("input", ev => {
      state[c.k] = parseFloat(ev.target.value);
      box.querySelector(".vl").textContent = `${state[c.k]} ${c.unit}`;
    });
  });
  /* 支持 ?p=1.5&f=800&d0=40 预置参数（课堂演示/截图用） */
  const q = new URLSearchParams(location.search);
  m.controls.forEach(c => {
    if (q.has(c.k)){
      const v = parseFloat(q.get(c.k));
      if (!isNaN(v)){
        state[c.k] = Math.min(c.max, Math.max(c.min, v));
        const r0 = document.getElementById("r_" + c.k);
        if (r0) r0.value = state[c.k];
        const v0 = document.getElementById("v_" + c.k);
        if (v0) v0.textContent = `${state[c.k]} ${c.unit}`;
      }
    }
  });

  const ro = document.createElement("div"); ro.className = "readout"; ro.id = "readout";
  ro.innerHTML = `<div class="big">—<small>pF</small></div><table></table>`;
  scrollEl.appendChild(ro);
  chartCv.id = "chart"; scrollEl.appendChild(chartCv);

  if (m.id === "rot"){
    const pc = document.createElement("canvas");
    pc.id = "plan"; pc.width = 720; pc.height = 320;
    pc.style.cssText = "width:100%;height:118px;margin-top:8px;border-radius:10px;" +
                       "background:#fbfcfe;border:1px solid #dbe3ec;display:block";
    scrollEl.appendChild(pc);
    const cap = document.createElement("div");
    cap.style.cssText = "font-size:11.5px;color:#7b8b9c;margin:4px 0 0 2px";
    cap.textContent = "俯视：黄色 = 两块极板的重叠区 = 正对面积 S";
    scrollEl.appendChild(cap);
  }

  if (m.real){
    const box = document.createElement("div"); box.className = "real";
    box.innerHTML = m.real.video
      ? `<video src="${m.real.video}" poster="${m.real.poster || ""}" autoplay loop muted playsinline></video><span>${m.real.cap}</span>`
      : `<img src="${m.real.src}" alt=""><span>${m.real.cap}</span>`;
    scrollEl.appendChild(box);
  }

  const h = document.createElement("div"); h.className = "hint"; h.innerHTML = m.hint;
  scrollEl.appendChild(h);
  tipEl.textContent = m.tip;
  const kEl = document.getElementById("keys");
  if (kEl) kEl.innerHTML = `<b>要点</b>` +
    (m.points || []).map(t => `<div>· ${t}</div>`).join("");
  footEl.textContent = "v2.0 · 3D 主视图（可拖拽旋转）· 数值与曲线按 C = ε₀εrS/d 实时计算";
  resizeChart();
  buildScene();
}
function resizeChart(){
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const r = chartCv.getBoundingClientRect();
  chartCv.width = Math.max(200, r.width * dpr);
  chartCv.height = Math.max(60, r.height * dpr);
}

/* 曲线：序列 + 当前点 */
function drawChart(m, data, curVal){
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const c = chartCv.getContext("2d");
  const W = chartCv.width, H = chartCv.height;
  c.setTransform(1,0,0,1,0,0);
  c.clearRect(0,0,W,H);
  const pad = 10*dpr;
  const min = Math.min(...data), max = Math.max(...data);
  const span = (max - min) || 1;
  const X = i => pad + (W - 2*pad) * i/(data.length-1);
  const Y = v => H - pad - (H - 2*pad) * (v - min)/span;
  c.strokeStyle = "#e6edf5"; c.lineWidth = 1*dpr;
  for (let i = 1; i < 4; i++){
    const y = pad + (H-2*pad)*i/4;
    c.beginPath(); c.moveTo(pad, y); c.lineTo(W-pad, y); c.stroke();
  }
  c.beginPath();
  data.forEach((v,i) => i ? c.lineTo(X(i), Y(v)) : c.moveTo(X(i), Y(v)));
  c.strokeStyle = "#2e6fd0"; c.lineWidth = 2*dpr; c.stroke();
  // 当前点
  let idx = data.length - 1;
  if (m.xMode === "h") idx = Math.round((data.length-1) * (state.h / 200));
  if (m.xMode === "rel") idx = Math.round((data.length-1) * (Math.abs(state.b - state.a) / 180));
  c.beginPath(); c.arc(X(idx), Y(data[idx]), 4*dpr, 0, 7);
  c.fillStyle = "#e4573d"; c.fill();
  c.strokeStyle = "#fff"; c.lineWidth = 2*dpr; c.stroke();
}

/* 俯视小图：两个半圆 + 黄色重叠扇区 */
function drawPlan(pl){
  const cv2 = document.getElementById("plan");
  if (!cv2) return;
  const c = cv2.getContext("2d");
  const W = cv2.width, H = cv2.height;
  const cx = W * 0.5, cy = H * 0.60, R = Math.min(W, H) * 0.46;
  c.clearRect(0, 0, W, H);
  const sec = (a0, a1, fill, stroke) => {
    c.beginPath(); c.moveTo(cx, cy); c.arc(cx, cy, R, a0, a1); c.closePath();
    if (fill){ c.fillStyle = fill; c.fill(); }
    if (stroke){ c.strokeStyle = stroke; c.lineWidth = 3; c.stroke(); }
  };
  /* 坐标系：canvas 的 y 向下，故角度取负 */
  const D2R = Math.PI / 180;
  const A = -pl.a * D2R, B = -pl.b * D2R;
  sec(A - Math.PI, A, "rgba(228,87,61,.30)", "#e4573d");      // 定片
  sec(B - Math.PI, B, "rgba(46,111,208,.28)", "#2e6fd0");     // 动片
  c.beginPath(); c.moveTo(cx, cy);
  c.arc(cx, cy, R * 0.98, -pl.lo - pl.span, -pl.lo); c.closePath();
  c.fillStyle = "rgba(232,161,25,.78)"; c.fill();
  c.strokeStyle = "#c98a0d"; c.lineWidth = 2; c.setLineDash([7, 5]); c.stroke(); c.setLineDash([]);
  /* 圆心轴 */
  c.beginPath(); c.arc(cx, cy, 5, 0, 7); c.fillStyle = "#16202b"; c.fill();
}

/* ================= 主循环 ================= */
const clock = { t0: performance.now(), paused: false, off: 0 };
function buildScene(){
  if (root) { disposeGroup(root); root = null; }
  MODULES[cur].build(state);
  if (root) root.traverse(o => { if (o.isMesh){ o.castShadow = true; o.receiveShadow = true; } });
  updateCamera();
}
function tick(){
  const now = performance.now();
  const t = clock.paused ? clock.off : (now - clock.t0)/1000;
  const m = MODULES[cur];
  const g0 = m.calc(state);
  const out = m.update(state, t, g0);
  const ro = document.getElementById("readout");
  if (ro){
    ro.querySelector(".big").innerHTML = `${pf(out.C)}<small>pF</small>`;
    ro.querySelector("table").innerHTML =
      [["电容 C", pf(out.C)+" pF"], ...out.extra]
      .map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join("");
  }
  const data = m.series(state, t, g0);
  drawChart(m, data, out.C);
  if (m.id === "rot" && m._plan) drawPlan(m._plan);
  updateCamera();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

/* 手机：提示文案与悬浮按钮 */
if (MOBILE){
  const b = document.getElementById("badge");
  if (b) b.textContent = "单指旋转 · 双指缩放";
}
document.addEventListener("DOMContentLoaded", () => {});
(function bindMobileBar(){
  const btnR = document.getElementById("mbReset");
  const btnP = document.getElementById("mbPause");
  if (btnR) btnR.addEventListener("click", resetCam);
  if (btnP) btnP.addEventListener("click", () => {
    if (!clock.paused){ clock.off = (performance.now() - clock.t0) / 1000; clock.paused = true; btnP.textContent = "播放"; btnP.classList.add("on"); }
    else { clock.t0 = performance.now() - clock.off * 1000; clock.paused = false; btnP.textContent = "暂停"; btnP.classList.remove("on"); }
  });
})();

/* 尺寸 */
function resize(){
  const r = stage.getBoundingClientRect();
  renderer.setSize(r.width, r.height, false);
  camera.aspect = r.width / r.height;
  camera.updateProjectionMatrix();
  resizeChart();
}
window.addEventListener("resize", resize);
document.addEventListener("keydown", e => {
  if (e.key >= "1" && e.key <= "4"){
    const i = parseInt(e.key, 10) - 1;
    if (i < MODULES.length){ cur = i; buildTabs(); buildPanel(); }
    return;
  }
  if (e.code === "Space"){
    e.preventDefault();
    if (!clock.paused){ clock.off = (performance.now()-clock.t0)/1000; clock.paused = true; }
    else { clock.t0 = performance.now() - clock.off*1000; clock.paused = false; }
  }
});

const hIdx = MODULES.findIndex(m => "#" + m.id === location.hash);
if (hIdx >= 0) cur = hIdx;
resize();
loadAssets(() => {
  
  applyMetalTex(M.steel);
  buildTabs(); buildPanel(); requestAnimationFrame(tick);
});
