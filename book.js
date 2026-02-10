const section = document.getElementById("book-section");

function getBookSize() {
    const w = section.offsetWidth;
    const h = section.offsetHeight;
    return { w, h };
}

// 1. Setup Scene
const scene = new THREE.Scene();
const { w: initialW, h: initialH } = getBookSize();
const camera = new THREE.PerspectiveCamera(75, initialW / initialH, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ 
    alpha: true, 
    antialias: true 
});

renderer.setSize(initialW, initialH);
section.appendChild(renderer.domElement);

// 2. Lighting [00:10:14]
const ambient = new THREE.AmbientLight(0x222222);
scene.add(ambient);

const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(0, 0, 6);
scene.add(light);

// 3. Textures & Materials [00:13:22]
const loader = new THREE.TextureLoader();
const urls = [
    "book_imgs/edge.png", "book_imgs/spine.png",
    "book_imgs/top.png", "book_imgs/bottom.png",
    "book_imgs/front.png", "book_imgs/back.png"
];

const materials = urls.map(url => {
    return new THREE.MeshLambertMaterial({
        map: loader.load(url)
    });
});

// 4. Create Book Geometry [00:08:05]
const geometry = new THREE.BoxGeometry(3.5, 5, 0.5);
const cube = new THREE.Mesh(geometry, materials);
cube.position.set(0, 0, 0);
scene.add(cube);

camera.position.z = 6;

// Scale book: fraction of visible width (or height on mobile). Tuned so MacBook = smaller, large monitor = larger.
const BOOK_WIDTH_WORLD = 3.5;
const BOOK_HEIGHT_WORLD = 5;
const CAMERA_Z = 6;
const MOBILE_BP = 950;           // match CSS stacked breakpoint (max-width: 949px)
const SMALL_MOBILE_BP = 400;     // 400px and below: book at 75% width
const SMALL_MOBILE_FRACTION = 0.75;
const MOBILE_FRACTION = 0.55;
const MOBILE_HEIGHT_FRACTION = 0.75;  // 401–949px: book height = 75% of screen height
const DESKTOP_HEIGHT_CLAMP = 0.92;    // cap book by height on desktop so it never overflows

// Desktop (canvas ≥ MOBILE_BP): fraction increases with canvas size — smaller on MacBook, larger on big monitors.
// Breakpoints: ~550 (0.18), ~750 (0.22), ~1000 (0.28), ~1300 (0.35), ~1600+ (0.42)
function getBookWidthFraction(canvasWidth) {
    if (canvasWidth <= SMALL_MOBILE_BP) return SMALL_MOBILE_FRACTION;
    if (canvasWidth < MOBILE_BP) return MOBILE_FRACTION;
    if (canvasWidth <= 550) return 0.18;
    if (canvasWidth <= 750) return 0.18 + (0.22 - 0.18) * (canvasWidth - 550) / 200;
    if (canvasWidth <= 1000) return 0.22 + (0.28 - 0.22) * (canvasWidth - 750) / 250;
    if (canvasWidth <= 1300) return 0.28 + (0.35 - 0.28) * (canvasWidth - 1000) / 300;
    if (canvasWidth <= 1600) return 0.35 + (0.42 - 0.35) * (canvasWidth - 1300) / 300;
    return 0.42;
}

function updateBookScale() {
    const { w, h } = getBookSize();
    if (w === 0 || h === 0) return;

    const halfFov = (75 * Math.PI / 180) / 2;

    // 400 < width < 950: scale by height so book height = 85% of screen height
    if (w > SMALL_MOBILE_BP && w < MOBILE_BP) {
        const visibleHeightAtZ0 = 2 * CAMERA_Z * Math.tan(halfFov);
        const scale = (MOBILE_HEIGHT_FRACTION * visibleHeightAtZ0) / BOOK_HEIGHT_WORLD;
        cube.scale.setScalar(scale);
        return;
    }

    const fraction = getBookWidthFraction(w);
    const aspect = w / h;
    const visibleWidthAtZ0 = 2 * CAMERA_Z * Math.tan(halfFov) * aspect;
    const scale = (fraction * visibleWidthAtZ0) / BOOK_WIDTH_WORLD;
    cube.scale.setScalar(scale);
}
updateBookScale();

// 5. Slow continuous rotation; on hover: pause and tilt by cursor; on leave: resume rotation
const ROTATION_SPEED = 0.7; // radians per second (~full turn in ~9s)
const TILT_X = 0.35;        // up/down tilt (radians per NDC)
const TILT_Y = 0.5;         // left/right tilt (radians per NDC)
const TILT_LERP = 0.08;     // smooth follow of cursor
let rotationStartTime = performance.now() / 1000;
let hoverOverBook = false;
let wasHovering = false;
let hoverBaseY = 0;         // rotation.y when hover started — tilt is relative to this

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function onPointerMove(event) {
    const rect = section.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObject(cube);
    hoverOverBook = hits.length > 0;
}

function onPointerLeave() {
    hoverOverBook = false;
}

renderer.domElement.addEventListener("pointermove", onPointerMove);
renderer.domElement.addEventListener("pointerleave", onPointerLeave);

const animate = function() {
    if (hoverOverBook && !wasHovering) {
        hoverBaseY = cube.rotation.y;
    }
    wasHovering = hoverOverBook;

    if (hoverOverBook) {
        // Tilt relative to angle when hover started — avoids lerping through π (back face)
        rotationStartTime = performance.now() / 1000 - cube.rotation.y / ROTATION_SPEED;
        const targetX = mouse.y * TILT_X;
        const targetY = hoverBaseY + mouse.x * TILT_Y;
        cube.rotation.x += (targetX - cube.rotation.x) * TILT_LERP;
        cube.rotation.y += (targetY - cube.rotation.y) * TILT_LERP;
    } else {
        const t = performance.now() / 1000 - rotationStartTime;
        cube.rotation.y = t * ROTATION_SPEED;
        cube.rotation.x += (0 - cube.rotation.x) * TILT_LERP;
    }
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
};

animate();

// Handle resize: canvas fills only the left (book) half; keep book centered and scaled
function onResize() {
    const { w, h } = getBookSize();
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    updateBookScale();
}
window.addEventListener("resize", onResize);
window.addEventListener("orientationchange", function() {
    setTimeout(onResize, 100);
});
if (section.offsetWidth === 0) {
    requestAnimationFrame(onResize);
}