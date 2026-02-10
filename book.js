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

// Scale book: fraction of canvas width increases as screen gets narrower (book appears wider on small viewports)
const BOOK_WIDTH_WORLD = 3.5;
const CAMERA_Z = 6;
const FRACTION_MIN = 0.35;  // wide screens
const FRACTION_MAX = 0.6;   // narrow screens
const WIDTH_AT_MIN = 900;   // canvas width above this → use FRACTION_MIN
const WIDTH_AT_MAX = 380;   // canvas width below this → use FRACTION_MAX

function getBookWidthFraction(canvasWidth) {
    if (canvasWidth >= WIDTH_AT_MIN) return FRACTION_MIN;
    if (canvasWidth <= WIDTH_AT_MAX) return FRACTION_MAX;
    const t = (canvasWidth - WIDTH_AT_MAX) / (WIDTH_AT_MIN - WIDTH_AT_MAX);
    return FRACTION_MIN + (1 - t) * (FRACTION_MAX - FRACTION_MIN);
}

function updateBookScale() {
    const { w, h } = getBookSize();
    if (w === 0 || h === 0) return;

    const fraction = getBookWidthFraction(w);
    const aspect = w / h;
    const halfFov = (75 * Math.PI / 180) / 2;
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