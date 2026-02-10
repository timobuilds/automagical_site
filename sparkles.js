/**
 * Cursor sparkles overlay — based on https://github.com/max-van-leeuwen/Three.js-Particles
 * Renders a trail of particles at the cursor (mouse or touch).
 */
(function () {
    var maxParticleCount = 50;
    var particleSpawnIntervalMS = 20;

    var container = document.getElementById("sparkles-overlay");
    if (!container || typeof THREE === "undefined") return;

    var displaySizes = { width: window.innerWidth, height: window.innerHeight };
    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(
        75,
        displaySizes.width / displaySizes.height,
        0.1,
        1000
    );
    camera.position.z = 5;

    var renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(displaySizes.width, displaySizes.height);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    function updateResize() {
        displaySizes.width = window.innerWidth;
        displaySizes.height = window.innerHeight;
        camera.aspect = displaySizes.width / displaySizes.height;
        camera.updateProjectionMatrix();
        renderer.setSize(displaySizes.width, displaySizes.height);
    }
    window.addEventListener("resize", updateResize);

    // Particle geometry
    var particlesGeometry = new THREE.BufferGeometry();
    var positions = new Float32Array(maxParticleCount * 3);
    var sizes = new Float32Array(maxParticleCount);
    var startTimes = new Float32Array(maxParticleCount);
    for (var i = 0; i < maxParticleCount; i++) {
        sizes[i] = Math.pow(Math.random(), 2) / 2 + 0.5;
        startTimes[i] = -1;
    }
    particlesGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    particlesGeometry.setAttribute("startTime", new THREE.BufferAttribute(startTimes, 1));
    particlesGeometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

    var particleTexture = new THREE.TextureLoader().load("sparkles.png");
    var particlesMaterial = new THREE.ShaderMaterial({
        uniforms: {
            tex: { value: particleTexture },
            currentTime: { value: 0 }
        },
        transparent: true,
        depthWrite: false,
        vertexShader: [
            "uniform float currentTime;",
            "attribute float startTime;",
            "attribute float size;",
            "varying float vColor;",
            "float remap(float value, float minSrc, float maxSrc, float minDst, float maxDst) {",
            "  return minDst + (value - minSrc) * (maxDst - minDst) / (maxSrc - minSrc);",
            "}",
            "float cubicInOut(float t) {",
            "  if (t < 0.5) return 4.0 * t * t * t;",
            "  float f = (2.0 * t) - 2.0;",
            "  return 0.5 * f * f * f + 1.0;",
            "}",
            "float random(float seed) {",
            "  return fract(sin(seed) * 43758.5453123);",
            "}",
            "void main() {",
            "  float lifeTime = random(startTime + 10.0) * 0.5 + 0.5;",
            "  float t = startTime < 0.0 ? 0.0 : (currentTime - startTime) * 0.45;",
            "  float horDirection = remap(random(startTime + 20.0), 0.0, 1.0, -0.35, 0.35);",
            "  float horMultiplier = 1.0 - pow(1.0 - (t / (lifeTime * 0.7)), 3.0);",
            "  float unititializedOffset = t == 0.0 ? 9999.0 : 0.0;",
            "  vec4 mvPosition = modelViewMatrix * vec4(position + vec3(horDirection * horMultiplier + unititializedOffset, -t * t * 0.4 - t * 0.3, 0.0), 1.0);",
            "  gl_Position = projectionMatrix * mvPosition;",
            "  float fluctuatingSize = sin(t * 10.0 + random(startTime + 30.0) * 6.0) * 0.25 + 0.75;",
            "  float inTime = 0.18;",
            "  float particleInOutScale = t > inTime ? 1.0 - pow(1.0 - remap(t, inTime, lifeTime, 1.0, 0.0), 2.0) : cubicInOut(t / inTime);",
            "  float particleScale = 300.0;",
            "  gl_PointSize = t > lifeTime ? 0.0 : size * (particleScale / -mvPosition.z) * particleInOutScale * fluctuatingSize;",
            "  vColor = sin(random(startTime + 40.0) * 6.0 + t * 20.0) * 0.5 + 0.5;",
            "}"
        ].join("\n"),
        fragmentShader: [
            "uniform sampler2D tex;",
            "varying float vColor;",
            "void main() {",
            "  gl_FragColor = texture2D(tex, gl_PointCoord);",
            "  gl_FragColor.rgb *= pow(vColor, 6.0) * 1.2 + 1.0;",
            "}"
        ].join("\n")
    });

    var particleSystem = new THREE.Points(particlesGeometry, particlesMaterial);
    scene.add(particleSystem);

    var crrParticleIndex = 0;
    function addParticle(x, y, z, startTime) {
        positions[crrParticleIndex * 3] = x;
        positions[crrParticleIndex * 3 + 1] = y;
        positions[crrParticleIndex * 3 + 2] = z;
        particlesGeometry.attributes.position.needsUpdate = true;
        startTimes[crrParticleIndex] = startTime;
        particlesGeometry.attributes.startTime.needsUpdate = true;
        crrParticleIndex++;
        if (crrParticleIndex >= maxParticleCount) crrParticleIndex = 0;
    }

    var startTime = Date.now() / 1000;
    function getElapsedTime() {
        return Date.now() / 1000 - startTime;
    }

    var prvTime = Date.now();
    var totalSpawnCount = 0;
    function particlesToSpawn(reset) {
        var currentTime = Date.now();
        if (reset) prvTime = currentTime;
        var thisFrameCount = (currentTime - prvTime) / particleSpawnIntervalMS;
        prvTime = currentTime;
        totalSpawnCount += thisFrameCount;
        if (totalSpawnCount >= 1) {
            var floored = Math.floor(totalSpawnCount);
            totalSpawnCount -= floored;
            return floored;
        }
        return 0;
    }

    var lastMouseMoveEvent;
    var prvPos = null;
    var isCursorInWindow = true;

    function requestParticles(event, resetParticleSpawnCounter) {
        lastMouseMoveEvent = event;
        var n = particlesToSpawn(resetParticleSpawnCounter);
        if (n === 0 || !isCursorInWindow) return;

        var x = (event.clientX / displaySizes.width) * 2 - 1;
        var y = -(event.clientY / displaySizes.height) * 2 + 1;
        var vector = new THREE.Vector3(x, y, 0.5);
        vector.unproject(camera);
        var dir = vector.sub(camera.position).normalize();
        var distance = -camera.position.z / dir.z;
        var pos = camera.position.clone().add(dir.multiplyScalar(distance));

        var currentTime = getElapsedTime();
        for (var i = 0; i < n; i++) {
            var ratio = (i + 1) / n;
            var p = pos;
            if (prvPos) p = prvPos.clone().lerp(pos, ratio);
            addParticle(p.x, p.y, p.z, currentTime + ratio * 0.001);
        }
        prvPos = pos.clone();
    }

    var isFirstMove = true;
    function onMouseMove(event) {
        requestParticles(event, isFirstMove);
        if (isFirstMove) isFirstMove = false;
    }

    var activeTouchEvent;
    function onTouchStart(event) {
        prvPos = null;
        if (event.touches[0]) requestParticles(event.touches[0], true);
    }
    function onTouchMove(event) {
        if (event.touches[0]) requestParticles(event.touches[0], false);
    }
    function touchEnd() {
        activeTouchEvent = null;
        prvPos = null;
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("touchstart", onTouchStart);
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", touchEnd);

    document.addEventListener("mouseleave", function () {
        isCursorInWindow = false;
        prvPos = null;
    });
    document.addEventListener("mouseenter", function () {
        isCursorInWindow = true;
    });

    function animate() {
        requestAnimationFrame(animate);
        particlesMaterial.uniforms.currentTime.value = getElapsedTime();
        if (activeTouchEvent) requestParticles(activeTouchEvent, false);
        else if (lastMouseMoveEvent) requestParticles(lastMouseMoveEvent, false);
        renderer.render(scene, camera);
    }
    animate();
})();
