    "use strict";

    // ---------- Проверка WebGL и базовые константы ----------
    const fallback = document.getElementById("fallback");
    if (!window.THREE) {
      fallback.style.display = "grid";
      throw new Error("Three.js не загрузился");
    }

    const testCanvas = document.createElement("canvas");
    const gl = testCanvas.getContext("webgl2") || testCanvas.getContext("webgl");
    if (!gl) {
      fallback.style.display = "grid";
      throw new Error("WebGL недоступен");
    }

    const TAU = Math.PI * 2;
    const clamp = THREE.MathUtils.clamp;
    const lerp = THREE.MathUtils.lerp;
    const isMobile = matchMedia("(pointer: coarse)").matches;
    const prefersReducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

    const COLORS = {
      sky: 0xc8dfe0, fog: 0xdbe6d8, cream: 0xffedc7, grass: 0x738b4f,
      grassLight: 0x9eae6c, grassDark: 0x53683f, ochre: 0xc98725, brown: 0x69452f,
      darkBrown: 0x33291f, fox: 0xf0732e, foxLight: 0xf6d6a5, blue: 0x577b80,
      water: 0x8ebcc1, flower: 0xf1c65c, white: 0xfff8e8, rock: 0x9a987f
    };

    // ---------- Рендерер, сцена, камера и акварельное освещение ----------
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(COLORS.sky);
    scene.fog = new THREE.FogExp2(COLORS.fog, isMobile ? 0.0048 : 0.0037);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true, powerPreference: "high-performance" });
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.shadowMap.enabled = !isMobile;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setPixelRatio(Math.min(devicePixelRatio, isMobile ? 1.5 : 1.8));
    renderer.setSize(innerWidth, innerHeight);
    document.getElementById("scene").appendChild(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(innerWidth < 700 ? 51 : 43, innerWidth / innerHeight, 0.1, 900);
    camera.position.set(11, 36, 26);

    // Полупрозрачная процедурная бумага рендерится прямо в canvas и попадает в PNG-снимок.
    const paperCanvas = document.createElement("canvas");
    paperCanvas.width = paperCanvas.height = 128;
    const paperContext = paperCanvas.getContext("2d");
    paperContext.clearRect(0, 0, 128, 128);
    for (let i = 0; i < 2600; i++) {
      const shade = 110 + Math.floor(Math.random() * 90);
      paperContext.fillStyle = `rgba(${shade}, ${shade - 12}, ${shade - 28}, ${.025 + Math.random() * .045})`;
      const size = .35 + Math.random() * 1.1;
      paperContext.fillRect(Math.random() * 128, Math.random() * 128, size, size);
    }
    const paperTexture = new THREE.CanvasTexture(paperCanvas);
    paperTexture.wrapS = paperTexture.wrapT = THREE.RepeatWrapping;
    paperTexture.repeat.set(5, 5);
    const paperFilm = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.MeshBasicMaterial({ map: paperTexture, transparent: true, opacity: .1, depthTest: false, depthWrite: false })
    );
    paperFilm.position.z = -.12;
    paperFilm.renderOrder = 999;
    camera.add(paperFilm);
    scene.add(camera);

    function sizePaperFilm() {
      const height = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov * .5)) * .12;
      paperFilm.scale.set(height * camera.aspect * .5, height * .5, 1);
    }
    sizePaperFilm();

    const hemi = new THREE.HemisphereLight(0xfff6dc, 0x78905f, .62);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffd999, .95);
    sun.position.set(-45, 80, 25);
    sun.castShadow = !isMobile;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -70;
    sun.shadow.camera.right = 70;
    sun.shadow.camera.top = 70;
    sun.shadow.camera.bottom = -70;
    scene.add(sun);
    const warmFill = new THREE.DirectionalLight(0xf3a85f, .16);
    warmFill.position.set(40, 25, -60);
    scene.add(warmFill);

    function mat(color, roughness = .9, transparent = false, opacity = 1) {
      return new THREE.MeshLambertMaterial({ color, transparent, opacity });
    }

    const materials = {
      cream: mat(COLORS.cream), grass: mat(COLORS.grass), grassLight: mat(COLORS.grassLight),
      grassDark: mat(COLORS.grassDark), ochre: mat(COLORS.ochre), brown: mat(COLORS.brown),
      darkBrown: mat(COLORS.darkBrown), fox: mat(COLORS.fox), foxLight: mat(COLORS.foxLight),
      blue: mat(COLORS.blue), water: mat(COLORS.water, .35, true, .8), flower: mat(COLORS.flower),
      white: mat(COLORS.white, 1, true, .92), rock: mat(COLORS.rock), black: mat(0x201d18),
      lantern: new THREE.MeshBasicMaterial({ color: 0xffd765, transparent: true, opacity: .88 }),
      brass: new THREE.MeshStandardMaterial({ color: 0xb68b3e, roughness: .55, metalness: .18 })
    };

    const shared = {
      sphere: new THREE.SphereGeometry(1, isMobile ? 10 : 14, isMobile ? 8 : 12),
      cone: new THREE.ConeGeometry(1, 2, isMobile ? 7 : 9),
      cylinder: new THREE.CylinderGeometry(1, 1, 1, isMobile ? 8 : 12),
      box: new THREE.BoxGeometry(1, 1, 1),
      petal: new THREE.SphereGeometry(1, 7, 5)
    };
    const sharedGeometrySet = new Set(Object.values(shared));

    function mesh(geometry, material, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) {
      const object = new THREE.Mesh(geometry, material);
      object.position.set(x, y, z);
      object.scale.set(sx, sy, sz);
      object.castShadow = !isMobile;
      object.receiveShadow = !isMobile;
      return object;
    }

    // ---------- Детерминированная случайность ----------
    function seeded(seed) {
      let value = seed >>> 0;
      return function random() {
        value += 0x6D2B79F5;
        let t = value;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }

    function noise2(x, z, seed) {
      return Math.sin(x * .063 + seed * .017) * 1.4 + Math.cos(z * .052 - seed * .013) * 1.15 + Math.sin((x + z) * .021 + seed) * 1.8;
    }

    // ---------- Самолёт ----------
    const airplane = new THREE.Group();
    airplane.position.set(0, 30, 4);
    scene.add(airplane);

    const fuselage = mesh(new THREE.CapsuleGeometry(1.05, 4.7, 8, 14), materials.ochre, 0, 0, 0, 1, 1, 1);
    fuselage.rotation.x = Math.PI / 2;
    fuselage.scale.set(1.12, 1.05, 1);
    airplane.add(fuselage);

    const nose = mesh(shared.sphere, materials.brown, 0, 0, -3.2, 1.08, 1, 1.3);
    airplane.add(nose);

    const topWing = mesh(shared.box, materials.cream, 0, 3.32, -.35, 7.8, .24, 1.35);
    const lowerWing = mesh(shared.box, materials.blue, 0, .22, -.15, 6.7, .2, 1.05);
    [topWing, lowerWing].forEach(wing => { wing.geometry = new THREE.BoxGeometry(1, 1, 1, 3, 1, 2); airplane.add(wing); });

    for (const x of [-2.65, 2.65]) {
      const strutA = mesh(shared.cylinder, materials.brown, x, 1.74, -.8, .09, 3.12, .09);
      const strutB = mesh(shared.cylinder, materials.brown, x, 1.74, .3, .09, 3.12, .09);
      airplane.add(strutA, strutB);
    }

    const tailWing = mesh(shared.box, materials.cream, 0, .32, 3.3, 3.2, .16, .7);
    const tailFin = mesh(new THREE.ConeGeometry(.85, 1.8, 3), materials.blue, 0, 1.1, 3.4, 1, 1, .4);
    tailFin.rotation.z = Math.PI;
    airplane.add(tailWing, tailFin);

    const propeller = new THREE.Group();
    propeller.position.set(0, 0, -4.35);
    const hub = mesh(shared.sphere, materials.brass, 0, 0, 0, .28, .28, .28);
    const blade1 = mesh(new THREE.CapsuleGeometry(.15, 1.45, 5, 8), materials.brown, 0, 0, 0, 1, 1, .18);
    const blade2 = blade1.clone();
    blade1.rotation.z = Math.PI / 4;
    blade2.rotation.z = -Math.PI / 4;
    propeller.add(hub, blade1, blade2);
    airplane.add(propeller);

    const propBlur = mesh(new THREE.CircleGeometry(2.1, 36), mat(0xc49c59, 1, true, .05), 0, 0, -4.48);
    propBlur.rotation.y = Math.PI;
    airplane.add(propBlur);

    const cockpitFront = mesh(new THREE.TorusGeometry(1.02, .15, 8, 22, Math.PI), materials.brown, 0, .9, -.55);
    cockpitFront.rotation.x = Math.PI / 2;
    airplane.add(cockpitFront);

    // Колёса игрушечного биплана.
    for (const x of [-1.15, 1.15]) {
      const wheel = mesh(new THREE.TorusGeometry(.52, .18, 8, 18), materials.darkBrown, x, -1.28, -.35);
      wheel.rotation.y = Math.PI / 2;
      const axle = mesh(shared.cylinder, materials.brown, x, -.82, -.35, .08, .78, .08);
      airplane.add(wheel, axle);
    }

    // ---------- Лисёнок и Ежонок из округлых форм ----------
    function makeEye(x, y, z, scale = 1) {
      const eye = mesh(shared.sphere, materials.black, x, y, z, .09 * scale, .13 * scale, .07 * scale);
      eye.userData.eye = true;
      return eye;
    }

    function createFox() {
      const fox = new THREE.Group();
      fox.position.set(-.62, 1.55, -.72);
      const body = mesh(shared.sphere, materials.fox, 0, .1, 0, .55, .82, .48);
      const chest = mesh(shared.sphere, materials.foxLight, 0, .1, -.39, .31, .58, .13);
      const headPivot = new THREE.Group();
      headPivot.position.set(0, 1.02, -.08);
      headPivot.scale.setScalar(1.04);
      const head = mesh(shared.sphere, materials.fox, 0, 0, 0, .55, .55, .48);
      const muzzle = mesh(shared.sphere, materials.foxLight, 0, -.1, -.42, .38, .28, .24);
      const nose = mesh(shared.sphere, materials.black, 0, -.08, -.64, .09, .08, .08);
      const earGeo = new THREE.ConeGeometry(.25, .62, 5);
      const leftEar = mesh(earGeo, materials.fox, -.3, .48, -.01, 1, 1, .7);
      const rightEar = mesh(earGeo, materials.fox, .3, .48, -.01, 1, 1, .7);
      const leftTip = mesh(earGeo, materials.darkBrown, -.3, .62, -.01, .63, .35, .62);
      const rightTip = mesh(earGeo, materials.darkBrown, .3, .62, -.01, .63, .35, .62);
      headPivot.add(head, muzzle, nose, leftEar, rightEar, leftTip, rightTip, makeEye(-.2, .08, -.44), makeEye(.2, .08, -.44));
      const tailPivot = new THREE.Group();
      tailPivot.position.set(-.68, -.12, .5);
      tailPivot.scale.setScalar(.72);
      const tail = mesh(new THREE.CapsuleGeometry(.32, 1.35, 7, 10), materials.fox, 0, 0, 0, 1, 1, 1);
      tail.rotation.z = -1.05;
      tail.rotation.x = .28;
      const tailTip = mesh(shared.sphere, materials.foxLight, -.64, -.31, .16, .32, .4, .32);
      tailPivot.add(tail, tailTip);
      const scarf = new THREE.Group();
      scarf.position.set(.4, .64, .14);
      for (let i = 0; i < 4; i++) {
        const piece = mesh(shared.box, materials.blue, .2 + i * .33, -.03, .1 + i * .08, .38, .08, .16);
        piece.rotation.y = -.2;
        scarf.add(piece);
      }
      fox.add(body, chest, headPivot, tailPivot, scarf);
      fox.userData = { headPivot, leftEar, rightEar, tailPivot, scarf };
      return fox;
    }

    function createHedgehog() {
      const hedgehog = new THREE.Group();
      hedgehog.position.set(.58, 1.48, .78);
      hedgehog.rotation.y = 3.05;
      const needles = mesh(shared.sphere, materials.darkBrown, 0, .18, .05, .57, .78, .56);
      const face = mesh(shared.sphere, materials.foxLight, 0, .22, -.38, .46, .57, .28);
      const belly = mesh(shared.sphere, materials.foxLight, 0, -.1, -.38, .36, .48, .16);
      const headPivot = new THREE.Group();
      headPivot.position.set(0, .27, 0);
      const nose = mesh(shared.sphere, materials.black, 0, .22, -.69, .08, .07, .08);
      headPivot.add(nose, makeEye(-.17, .38, -.61, .86), makeEye(.17, .38, -.61, .86));
      for (let i = 0; i < 15; i++) {
        const angle = (i / 15) * TAU;
        const spike = mesh(shared.cone, materials.brown, Math.cos(angle) * .48, .3 + Math.sin(angle * 2) * .24, .02 + Math.sin(angle) * .45, .08, .25, .08);
        spike.rotation.z = -Math.cos(angle) * .62;
        spike.rotation.x = Math.sin(angle) * .62;
        hedgehog.add(spike);
      }
      const pawL = mesh(shared.sphere, materials.brown, -.31, .02, -.55, .14, .25, .11);
      const pawR = mesh(shared.sphere, materials.brown, .31, .02, -.55, .14, .25, .11);
      hedgehog.add(needles, face, belly, headPivot, pawL, pawR);
      hedgehog.userData = { headPivot, pawL, pawR };
      return hedgehog;
    }

    const fox = createFox();
    const hedgehog = createHedgehog();
    airplane.add(fox, hedgehog);

    // ---------- Процедурные участки сказочного мира ----------
    const CHUNK_LENGTH = 155;
    const CHUNK_WIDTH = 150;
    const CHUNK_COUNT = isMobile ? 6 : 8;
    const worldChunks = [];
    let nextChunkIndex = CHUNK_COUNT;

    function makeTerrainGeometry(index) {
      const segmentsX = isMobile ? 18 : 26;
      const segmentsZ = isMobile ? 18 : 26;
      const geometry = new THREE.PlaneGeometry(CHUNK_WIDTH, CHUNK_LENGTH + 3, segmentsX, segmentsZ);
      geometry.rotateX(-Math.PI / 2);
      const pos = geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const z = pos.getZ(i);
        const worldZ = z - index * CHUNK_LENGTH;
        let y = noise2(x, worldZ, 31) * .48 + Math.sin(x * .027 + worldZ * .006) * .9;
        y *= .82 + Math.min(1, Math.abs(x) / 70) * .25;
        pos.setY(i, y - 4.5);
      }
      pos.needsUpdate = true;
      geometry.computeVertexNormals();
      return geometry;
    }

    function setInstances(instanced, items) {
      const dummy = new THREE.Object3D();
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        dummy.position.set(item.x, item.y, item.z);
        dummy.rotation.set(item.rx || 0, item.ry || 0, item.rz || 0);
        dummy.scale.set(item.sx || 1, item.sy || 1, item.sz || 1);
        dummy.updateMatrix();
        instanced.setMatrixAt(i, dummy.matrix);
      }
      instanced.instanceMatrix.needsUpdate = true;
      instanced.castShadow = !isMobile;
      instanced.receiveShadow = !isMobile;
    }

    function addTreeCluster(group, random, centerX, centerZ, count) {
      const trunks = [];
      const crowns = [];
      for (let i = 0; i < count; i++) {
        const angle = random() * TAU;
        const radius = Math.sqrt(random()) * (10 + count * .16);
        const x = centerX + Math.cos(angle) * radius;
        const z = centerZ + Math.sin(angle) * radius;
        const scale = .75 + random() * 1.1;
        trunks.push({ x, y: -2.3, z, sx: .35 * scale, sy: 3.2 * scale, sz: .35 * scale });
        crowns.push({ x, y: .5 + scale, z, sx: 2.1 * scale, sy: 2.7 * scale, sz: 2.1 * scale, ry: random() * TAU });
      }
      const trunkMesh = new THREE.InstancedMesh(shared.cylinder, materials.brown, trunks.length);
      const crownMesh = new THREE.InstancedMesh(shared.sphere, random() > .45 ? materials.grassDark : materials.grass, crowns.length);
      setInstances(trunkMesh, trunks);
      setInstances(crownMesh, crowns);
      group.add(trunkMesh, crownMesh);
    }

    function createHouse(group, x, z, random) {
      const house = new THREE.Group();
      house.position.set(x, -1.7, z);
      const walls = mesh(shared.box, materials.cream, 0, 1.7, 0, 3.5, 3.4, 3.1);
      const roof = mesh(new THREE.ConeGeometry(3.1, 2.4, 4), random() > .5 ? materials.grassDark : materials.ochre, 0, 4.25, 0, 1, 1, 1);
      roof.rotation.y = Math.PI / 4;
      const door = mesh(shared.box, materials.brown, 0, 1.1, -1.58, .85, 1.8, .18);
      const windowGlow = mesh(shared.box, materials.flower, 1.1, 2.05, -1.61, .65, .72, .12);
      const chimney = mesh(shared.box, materials.brown, 1.2, 5.05, .2, .55, 1.55, .55);
      house.add(walls, roof, door, windowGlow, chimney);
      group.add(house);
    }

    function createWindmill(group, x, z) {
      const mill = new THREE.Group();
      mill.position.set(x, -1.5, z);
      const tower = mesh(new THREE.CylinderGeometry(2.2, 3.2, 7, 8), materials.cream, 0, 3.5, 0);
      const cap = mesh(new THREE.ConeGeometry(2.8, 2.1, 8), materials.blue, 0, 7.7, 0);
      const rotor = new THREE.Group();
      rotor.position.set(0, 5.5, -2.55);
      rotor.rotation.x = Math.PI / 2;
      for (let i = 0; i < 4; i++) {
        const blade = mesh(shared.box, materials.brown, 0, 2.25, 0, .38, 3.9, .14);
        blade.rotation.z = i * Math.PI / 2;
        rotor.add(blade);
      }
      mill.add(tower, cap, rotor);
      mill.userData.rotor = rotor;
      group.add(mill);
    }

    function createBridge(group, x, z) {
      const water = mesh(new THREE.PlaneGeometry(19, 5), materials.water, x, -3.15, z);
      water.rotation.x = -Math.PI / 2;
      const bridge = new THREE.Group();
      bridge.position.set(x, -2.55, z);
      for (let i = -3; i <= 3; i++) {
        bridge.add(mesh(shared.box, materials.brown, i * .95, 0, 0, .82, .22, 3.8, 0, (i % 2) * .03, 0));
      }
      group.add(water, bridge);
    }

    function createCamp(group, x, z) {
      const camp = new THREE.Group();
      camp.position.set(x, -2.2, z);
      for (let i = 0; i < 7; i++) {
        const stone = mesh(shared.sphere, materials.rock, Math.cos(i / 7 * TAU) * 1.4, 0, Math.sin(i / 7 * TAU) * 1.4, .42, .26, .4);
        camp.add(stone);
      }
      const fire = mesh(shared.cone, materials.flower, 0, .8, 0, .6, 1.3, .6);
      const bench = mesh(shared.box, materials.brown, 3.2, .35, .4, 3.2, .35, .75);
      camp.add(fire, bench);
      group.add(camp);
    }

    function createLake(group, x, z, random) {
      const lake = mesh(new THREE.CircleGeometry(7 + random() * 4, 28), materials.water, x, -3.62, z, 1.5, 1, .72);
      lake.rotation.x = -Math.PI / 2;
      const reeds = new THREE.Group();
      reeds.position.set(x - 6, -3.15, z + 2);
      for (let i = 0; i < 7; i++) {
        reeds.add(mesh(shared.cylinder, materials.grassDark, i * .48, .65 + random() * .3, random() * 1.4, .05, 1.4 + random() * .6, .05));
      }
      group.add(lake, reeds);
    }

    function createTower(group, x, z) {
      const tower = new THREE.Group();
      tower.position.set(x, -2.3, z);
      const body = mesh(new THREE.CylinderGeometry(2.05, 2.6, 8, 9), materials.cream, 0, 4, 0);
      const roof = mesh(new THREE.ConeGeometry(3, 3, 9), materials.ochre, 0, 9.2, 0);
      const door = mesh(shared.box, materials.brown, 0, 1.25, -2.23, .85, 1.8, .16);
      const windowLight = mesh(shared.sphere, materials.flower, 0, 5.8, -2.02, .38, .46, .18);
      tower.add(body, roof, door, windowLight);
      group.add(tower);
    }

    function createSignAndMushrooms(group, x, z) {
      const spot = new THREE.Group();
      spot.position.set(x, -2.8, z);
      const pole = mesh(shared.cylinder, materials.brown, 0, 1.4, 0, .12, 3, .12);
      const signA = mesh(shared.box, materials.ochre, .8, 2.3, 0, 2.2, .55, .18);
      const signB = mesh(shared.box, materials.cream, -.65, 1.55, 0, 1.9, .5, .18);
      signA.rotation.z = .09;
      signB.rotation.z = -.08;
      spot.add(pole, signA, signB);
      for (let i = 0; i < 5; i++) {
        const mushroom = new THREE.Group();
        mushroom.position.set(-2.3 + i * .8, .05, 1.1 + Math.sin(i) * .7);
        const stem = mesh(shared.cylinder, materials.cream, 0, .25, 0, .09, .48, .09);
        const cap = mesh(shared.sphere, i % 2 ? materials.ochre : materials.fox, 0, .55, 0, .35, .18, .35);
        mushroom.add(stem, cap);
        spot.add(mushroom);
      }
      group.add(spot);
    }

    function createLanternTrail(group, x, z) {
      const trail = new THREE.Group();
      trail.position.set(x, -2.6, z);
      for (let i = 0; i < 6; i++) {
        const pole = mesh(shared.cylinder, materials.darkBrown, i * 2.4, 1.15 + Math.sin(i) * .08, Math.sin(i * .8) * 1.3, .06, 2.4, .06);
        const light = mesh(shared.sphere, materials.lantern, i * 2.4, 2.25, Math.sin(i * .8) * 1.3, .2, .28, .2);
        trail.add(pole, light);
      }
      group.add(trail);
    }

    function createStorySpot(group, random, index) {
      if (random() < .43) return;
      const x = (random() - .5) * 78;
      const z = (random() - .5) * 84;
      const type = index % 8;
      if (type === 0) { createHouse(group, x, z, random); addTreeCluster(group, random, x + 8, z + 2, 6); }
      if (type === 1) { createBridge(group, x, z); createLake(group, x - 8, z + 1, random); }
      if (type === 2) createWindmill(group, x, z);
      if (type === 3) createCamp(group, x, z);
      if (type === 4) { createHouse(group, x, z, random); addTreeCluster(group, random, x - 9, z - 4, 5); }
      if (type === 5) createTower(group, x, z);
      if (type === 6) createSignAndMushrooms(group, x, z);
      if (type === 7) { createLanternTrail(group, x - 6, z); createLake(group, x + 9, z - 4, random); }
    }

    function populateChunk(chunk, index) {
      chunk.content.traverse(object => {
        if (object.geometry && !sharedGeometrySet.has(object.geometry)) object.geometry.dispose();
      });
      while (chunk.content.children.length) chunk.content.remove(chunk.content.children[0]);
      if (chunk.terrain.geometry) chunk.terrain.geometry.dispose();
      chunk.terrain.geometry = makeTerrainGeometry(index);
      chunk.index = index;
      const random = seeded(index * 104729 + 1877);

      const clusterCount = 2 + Math.floor(random() * 3);
      for (let c = 0; c < clusterCount; c++) {
        const cx = (random() - .5) * 106;
        const cz = (random() - .5) * 110;
        addTreeCluster(chunk.content, random, cx, cz, isMobile ? 5 + Math.floor(random() * 6) : 8 + Math.floor(random() * 9));
      }

      const flowers = [];
      const rocks = [];
      for (let i = 0; i < (isMobile ? 34 : 72); i++) {
        const x = (random() - .5) * 126;
        const z = (random() - .5) * 125;
        flowers.push({ x, y: -2.9 + random() * .8, z, sx: .12, sy: .12 + random() * .14, sz: .12, ry: random() * TAU });
      }
      for (let i = 0; i < (isMobile ? 5 : 10); i++) {
        rocks.push({ x: (random() - .5) * 125, y: -2.7, z: (random() - .5) * 126, sx: .5 + random(), sy: .35 + random() * .5, sz: .5 + random(), ry: random() * TAU });
      }
      const flowerMesh = new THREE.InstancedMesh(shared.petal, materials.flower, flowers.length);
      const rockMesh = new THREE.InstancedMesh(shared.sphere, materials.rock, rocks.length);
      setInstances(flowerMesh, flowers);
      setInstances(rockMesh, rocks);
      chunk.content.add(flowerMesh, rockMesh);
      createStorySpot(chunk.content, random, index);
      if (index === 0) {
        createHouse(chunk.content, -20, -34, random);
        addTreeCluster(chunk.content, random, -10, -30, isMobile ? 6 : 10);
      }
      if (index === 1) createBridge(chunk.content, 18, 8);

      // Извилистая тропинка как цепочка мягких светлых мазков.
      const pathPoints = [];
      for (let i = 0; i < 11; i++) {
        pathPoints.push({ x: Math.sin(i * .72 + index) * 13, y: -3.75, z: -62 + i * 12.5, sx: 2.3, sy: .035, sz: 13.2, ry: Math.sin(i + index) * .16 });
      }
      const pathMesh = new THREE.InstancedMesh(shared.box, materials.cream, pathPoints.length);
      setInstances(pathMesh, pathPoints);
      chunk.content.add(pathMesh);
    }

    function makeChunk(index, order) {
      const group = new THREE.Group();
      const terrain = mesh(new THREE.BufferGeometry(), materials.grass, 0, 0, 0);
      const content = new THREE.Group();
      group.add(terrain, content);
      group.position.z = -order * CHUNK_LENGTH;
      group.userData = { terrain, content, index };
      scene.add(group);
      populateChunk(group.userData, index);
      worldChunks.push(group);
    }

    for (let i = 0; i < CHUNK_COUNT; i++) makeChunk(i, i);

    // ---------- Облака, птицы и пыльца ----------
    const clouds = [];
    function createCloud(index) {
      const random = seeded(index * 4099 + 88);
      const cloud = new THREE.Group();
      const count = 4 + Math.floor(random() * 4);
      for (let i = 0; i < count; i++) {
        const puff = mesh(shared.sphere, materials.white, (i - count / 2) * 2.1 + random(), random() * 1.2, random() * 1.4, 2.4 + random() * 1.8, 1.35 + random(), 1.7 + random());
        puff.castShadow = false;
        cloud.add(puff);
      }
      cloud.position.set((random() - .5) * 130, 15 + random() * 30, -40 - random() * 410);
      cloud.scale.setScalar(.72 + random() * .8);
      cloud.userData.speed = .25 + random() * .35;
      scene.add(cloud);
      clouds.push(cloud);
    }
    for (let i = 0; i < (isMobile ? 8 : 13); i++) createCloud(i);

    const pollenCount = isMobile ? 70 : 140;
    const pollenGeo = new THREE.BufferGeometry();
    const pollenPositions = new Float32Array(pollenCount * 3);
    for (let i = 0; i < pollenCount; i++) {
      pollenPositions[i * 3] = (Math.random() - .5) * 90;
      pollenPositions[i * 3 + 1] = Math.random() * 42;
      pollenPositions[i * 3 + 2] = -Math.random() * 150 + 30;
    }
    pollenGeo.setAttribute("position", new THREE.BufferAttribute(pollenPositions, 3));
    const pollen = new THREE.Points(pollenGeo, new THREE.PointsMaterial({ color: 0xffe6a0, size: .18, transparent: true, opacity: .72, depthWrite: false }));
    scene.add(pollen);

    const birds = new THREE.Group();
    for (let i = 0; i < 9; i++) {
      const bird = new THREE.Group();
      const left = mesh(shared.box, materials.darkBrown, -.3, 0, 0, .6, .05, .1);
      const right = left.clone();
      left.rotation.z = .42;
      right.position.x = .3;
      right.rotation.z = -.42;
      bird.add(left, right);
      bird.position.set((i - 4) * 2.4, Math.abs(i - 4) * .45, i * 1.1);
      bird.scale.setScalar(.6);
      birds.add(bird);
    }
    birds.position.set(-42, 49, -190);
    scene.add(birds);

    // ---------- Ввод и состояние полёта ----------
    const input = { x: 0, y: 0, targetX: 0, targetY: 0, keyX: 0, keyY: 0, dragging: false };
    const flight = { started: false, paused: false, speed: 25, targetSpeed: 25, sound: false, time: 0, distance: 0 };
    const keys = new Set();

    function pointerToInput(clientX, clientY) {
      const nx = (clientX / innerWidth) * 2 - 1;
      const ny = (clientY / innerHeight) * 2 - 1;
      const dead = .08;
      input.targetX = Math.abs(nx) < dead ? 0 : Math.sign(nx) * (Math.abs(nx) - dead) / (1 - dead);
      input.targetY = Math.abs(ny) < dead ? 0 : -Math.sign(ny) * (Math.abs(ny) - dead) / (1 - dead);
      input.targetX = clamp(input.targetX, -1, 1);
      input.targetY = clamp(input.targetY, -1, 1);
    }

    renderer.domElement.addEventListener("pointermove", event => {
      if (event.pointerType === "touch" && !input.dragging) return;
      pointerToInput(event.clientX, event.clientY);
    });
    renderer.domElement.addEventListener("pointerdown", event => {
      input.dragging = true;
      renderer.domElement.setPointerCapture(event.pointerId);
      pointerToInput(event.clientX, event.clientY);
      ensureAudioStarted();
    });
    renderer.domElement.addEventListener("pointerup", event => {
      input.dragging = false;
      if (event.pointerType === "touch") { input.targetX = 0; input.targetY = 0; }
    });
    renderer.domElement.addEventListener("pointercancel", () => { input.dragging = false; input.targetX = 0; input.targetY = 0; });
    addEventListener("blur", () => { keys.clear(); input.keyX = 0; input.keyY = 0; });

    addEventListener("wheel", event => {
      event.preventDefault();
      setSpeed(flight.targetSpeed - Math.sign(event.deltaY) * 2.6);
      ensureAudioStarted();
    }, { passive: false });

    addEventListener("keydown", event => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(event.key)) event.preventDefault();
      keys.add(event.key.toLowerCase());
      if (event.repeat) return;
      const key = event.key.toLowerCase();
      if (key === "p") togglePause();
      if (key === "h") document.body.classList.toggle("ui-hidden");
      if (key === "f") toggleFullscreen();
      if (key === "c") saveScreenshot();
      if (key === "r") { input.targetX = 0; input.targetY = 0; airplane.position.x = 0; }
      if (key === "+" || key === "=") setSpeed(flight.targetSpeed + 3);
      if (key === "-" || key === "_") setSpeed(flight.targetSpeed - 3);
      ensureAudioStarted();
    });
    addEventListener("keyup", event => keys.delete(event.key.toLowerCase()));

    function updateKeyboard() {
      input.keyX = (keys.has("d") || keys.has("arrowright") ? 1 : 0) - (keys.has("a") || keys.has("arrowleft") ? 1 : 0);
      input.keyY = (keys.has("w") || keys.has("arrowup") ? 1 : 0) - (keys.has("s") || keys.has("arrowdown") ? 1 : 0);
    }

    const speedRange = document.getElementById("speedRange");
    const speedText = document.getElementById("speedText");
    function setSpeed(value) {
      flight.targetSpeed = clamp(value, 14, 42);
      const percent = (flight.targetSpeed - 14) / 28 * 100;
      speedRange.value = percent;
      speedRange.style.setProperty("--speed", percent + "%");
      speedText.textContent = percent < 34 ? "тихая" : percent < 70 ? "спокойная" : "бодрая";
    }
    speedRange.addEventListener("input", () => setSpeed(14 + Number(speedRange.value) / 100 * 28));
    setSpeed(26.9);

    // ---------- Ненавязчивый процедурный звук ----------
    let audioContext = null;
    let masterGain = null;
    let engineOsc = null;
    let windSource = null;
    function createNoiseBuffer(context) {
      const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
      const data = buffer.getChannelData(0);
      let last = 0;
      for (let i = 0; i < data.length; i++) {
        last = last * .985 + (Math.random() * 2 - 1) * .015;
        data[i] = last * 3.2;
      }
      return buffer;
    }

    function setupAudio() {
      if (audioContext) return;
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      audioContext = new AudioCtx();
      masterGain = audioContext.createGain();
      masterGain.gain.value = 0;
      masterGain.connect(audioContext.destination);
      engineOsc = audioContext.createOscillator();
      const engineGain = audioContext.createGain();
      engineOsc.type = "triangle";
      engineOsc.frequency.value = 58;
      engineGain.gain.value = .035;
      engineOsc.connect(engineGain).connect(masterGain);
      engineOsc.start();
      windSource = audioContext.createBufferSource();
      windSource.buffer = createNoiseBuffer(audioContext);
      windSource.loop = true;
      const filter = audioContext.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 720;
      const windGain = audioContext.createGain();
      windGain.gain.value = .16;
      windSource.connect(filter).connect(windGain).connect(masterGain);
      windSource.start();
    }

    function ensureAudioStarted() {
      if (!flight.sound) return;
      setupAudio();
      if (audioContext && audioContext.state === "suspended") audioContext.resume();
    }

    function toggleSound() {
      flight.sound = !flight.sound;
      const button = document.getElementById("soundButton");
      button.textContent = flight.sound ? "♫" : "♩";
      button.setAttribute("aria-label", flight.sound ? "Выключить звук" : "Включить звук");
      setupAudio();
      if (audioContext) {
        audioContext.resume();
        masterGain.gain.cancelScheduledValues(audioContext.currentTime);
        masterGain.gain.linearRampToValueAtTime(flight.sound ? .42 : 0, audioContext.currentTime + .45);
      }
    }

    // ---------- Кнопки интерфейса ----------
    function togglePause() {
      if (!flight.started) return;
      flight.paused = !flight.paused;
      document.body.classList.toggle("paused", flight.paused);
      document.getElementById("pauseButton").textContent = flight.paused ? "▶" : "Ⅱ";
    }

    async function toggleFullscreen() {
      try {
        if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
        else await document.exitFullscreen();
      } catch (error) { /* Safari может отклонить полноэкранный режим. */ }
    }

    function saveScreenshot() {
      const uiWasHidden = document.body.classList.contains("ui-hidden");
      document.body.classList.add("ui-hidden");
      renderer.render(scene, camera);
      const link = document.createElement("a");
      link.download = "polyot-ezhonka-i-lisenka.png";
      link.href = renderer.domElement.toDataURL("image/png");
      link.click();
      if (!uiWasHidden) document.body.classList.remove("ui-hidden");
    }

    document.getElementById("pauseButton").addEventListener("click", togglePause);
    document.getElementById("fullButton").addEventListener("click", toggleFullscreen);
    document.getElementById("shotButton").addEventListener("click", saveScreenshot);
    document.getElementById("soundButton").addEventListener("click", toggleSound);
    document.getElementById("startButton").addEventListener("click", () => {
      flight.started = true;
      document.getElementById("startScreen").classList.add("started");
      setTimeout(() => document.getElementById("hint").classList.add("hide"), 7200);
    });

    // ---------- Анимация и переиспользование мира ----------
    const clock = new THREE.Clock();
    const cameraLook = new THREE.Vector3();
    const desiredCamera = new THREE.Vector3();
    const desiredLook = new THREE.Vector3();
    let blink = 1;

    function animateCharacters(time, bank) {
      const foxData = fox.userData;
      const hedgehogData = hedgehog.userData;
      foxData.headPivot.rotation.z = -bank * .14 + Math.sin(time * .55) * .035;
      foxData.headPivot.rotation.y = 3.05 + Math.sin(time * .23) * .06;
      foxData.leftEar.rotation.z = Math.sin(time * 2.1) * .05;
      foxData.rightEar.rotation.z = -Math.sin(time * 1.9) * .05;
      foxData.tailPivot.rotation.y = Math.sin(time * 2.2) * .12;
      foxData.scarf.rotation.y = Math.sin(time * 4.3) * .09;
      foxData.scarf.children.forEach((piece, i) => piece.rotation.z = Math.sin(time * 5 + i * .7) * .09);
      hedgehogData.headPivot.rotation.z = -bank * .18 + Math.sin(time * .43 + 2) * .04;
      hedgehog.rotation.y = 3.05 + Math.sin(time * .18) * .05;
      hedgehogData.pawL.rotation.x = Math.sin(time * .6) * .09;
      blink = Math.sin(time * .61) > .985 ? .08 : 1;
      foxData.headPivot.children.filter(child => child.userData.eye).forEach(eye => eye.scale.y = blink);
      hedgehogData.headPivot.children.filter(child => child.userData.eye).forEach(eye => eye.scale.y = blink);
    }

    function recycleWorld(distanceStep) {
      for (const chunk of worldChunks) {
        chunk.position.z += distanceStep;
        if (chunk.position.z > CHUNK_LENGTH * 1.25) {
          const farthest = Math.min(...worldChunks.map(item => item.position.z));
          chunk.position.z = farthest - CHUNK_LENGTH;
          populateChunk(chunk.userData, nextChunkIndex++);
        }
      }
      for (const cloud of clouds) {
        cloud.position.z += distanceStep * cloud.userData.speed;
        cloud.position.x += Math.sin(flight.time * .05 + cloud.position.y) * .003;
        if (cloud.position.z > 80) cloud.position.z -= 500;
      }
      birds.position.z += distanceStep * .56;
      birds.position.x += Math.sin(flight.time * .22) * .015;
      if (birds.position.z > 55) birds.position.set(42, 44 + Math.sin(flight.time) * 4, -320);

      const pos = pollen.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        let z = pos.getZ(i) + distanceStep * 1.8;
        let x = pos.getX(i) + Math.sin(flight.time * .7 + i) * .006;
        if (z > 40) { z -= 190; x = (Math.random() - .5) * 90; }
        pos.setX(i, x);
        pos.setZ(i, z);
      }
      pos.needsUpdate = true;
    }

    function updateLight(time) {
      const cycle = (Math.sin(time * .012) + 1) * .5;
      const skyMorning = new THREE.Color(0xc8dfe0);
      const skyEvening = new THREE.Color(0xe9c79e);
      scene.background.copy(skyMorning).lerp(skyEvening, cycle * .36);
      sun.color.set(0xffdfa8).lerp(new THREE.Color(0xffb977), cycle * .48);
      sun.intensity = .9 + cycle * .18;
    }

    function tick() {
      requestAnimationFrame(tick);
      const rawDelta = Math.min(clock.getDelta(), .05);
      const delta = flight.paused ? 0 : rawDelta;
      if (flight.started && !flight.paused) flight.time += delta;
      updateKeyboard();

      const steerX = clamp(input.targetX + input.keyX, -1, 1);
      const steerY = clamp(input.targetY + input.keyY, -1, 1);
      input.x = lerp(input.x, steerX, 1 - Math.exp(-delta * 2.6));
      input.y = lerp(input.y, steerY, 1 - Math.exp(-delta * 2.35));
      flight.speed = lerp(flight.speed, flight.targetSpeed, 1 - Math.exp(-delta * 1.35));

      if (flight.started && !flight.paused) {
        airplane.position.x = lerp(airplane.position.x, input.x * 27, 1 - Math.exp(-delta * 1.15));
        const desiredHeight = clamp(30 + input.y * 18, 14, 50);
        airplane.position.y = lerp(airplane.position.y, desiredHeight, 1 - Math.exp(-delta * 1.05));
        const bank = -input.x * .42;
        airplane.rotation.z = lerp(airplane.rotation.z, bank, 1 - Math.exp(-delta * 3));
        airplane.rotation.x = lerp(airplane.rotation.x, input.y * .12, 1 - Math.exp(-delta * 2.6));
        airplane.rotation.y = lerp(airplane.rotation.y, -input.x * .13, 1 - Math.exp(-delta * 2.1));
        airplane.position.y += Math.sin(flight.time * 1.35) * .007;
        topWing.rotation.z = Math.sin(flight.time * 2.4) * .006;
        lowerWing.rotation.z = -Math.sin(flight.time * 2.1) * .005;
        propeller.rotation.z -= delta * (18 + flight.speed * .68);
        propBlur.material.opacity = .035 + (flight.speed - 14) / 28 * .12;
        recycleWorld(delta * flight.speed);
        flight.distance += delta * flight.speed;
        animateCharacters(flight.time, bank);
        updateLight(flight.time);
        if (engineOsc && audioContext) engineOsc.frequency.setTargetAtTime(48 + flight.speed * .58, audioContext.currentTime, .12);
      }

      const speedFactor = (flight.speed - 14) / 28;
      const narrowScreen = innerWidth < 700;
      const cameraDistance = (narrowScreen ? 21 : 14) + speedFactor * (narrowScreen ? 5 : 4);
      desiredCamera.set(airplane.position.x + (narrowScreen ? .7 : 1.05), airplane.position.y + (narrowScreen ? 4.7 : 3.8), airplane.position.z + cameraDistance);
      desiredCamera.x -= input.x * 2.4;
      desiredCamera.y += Math.sin(flight.time * .32) * (prefersReducedMotion ? 0 : .14);
      camera.position.lerp(desiredCamera, 1 - Math.exp(-rawDelta * 2.15));
      desiredLook.set(airplane.position.x - input.x * 4.5, airplane.position.y + .2 + input.y * 1.4, airplane.position.z - 12);
      cameraLook.lerp(desiredLook, 1 - Math.exp(-rawDelta * 2.5));
      camera.lookAt(cameraLook);
      renderer.render(scene, camera);
    }

    // ---------- Размер окна и очистка ----------
    addEventListener("resize", () => {
      camera.aspect = innerWidth / innerHeight;
      camera.fov = innerWidth < 700 ? 51 : 43;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(devicePixelRatio, isMobile ? 1.5 : 1.8));
      renderer.setSize(innerWidth, innerHeight);
      sizePaperFilm();
    });

    addEventListener("pagehide", () => {
      if (audioContext) audioContext.close();
      paperTexture.dispose();
      renderer.dispose();
    }, { once: true });

    tick();
