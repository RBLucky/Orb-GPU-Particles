// --- Basic Three.js Setup ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({
canvas: document.getElementById('orb-canvas'),
antialias: true,
});

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
camera.position.z = 3.5; // Moved camera slightly out to see the full orb

// --- Mouse Interaction ---
const mouse = new THREE.Vector2(0, 0);
window.addEventListener('mousemove', (event) => {
mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
});
window.addEventListener('mouseleave', () => {
mouse.set(0, 0);
});

// --- Shaders for High-Performance Particle Orb ---
const vertexShader = `
uniform float uTime;
uniform vec2 uMouse;

// Attributes passed from our geometry
attribute vec3 restingPosition;
attribute float aRandom;

varying vec3 vColor;

void main() {
// --- Repulsion Logic (now on the GPU!) ---
// Project resting position to screen space to compare with mouse
vec4 screenPos = projectionMatrix * modelViewMatrix * vec4(restingPosition, 1.0);
vec2 screenXY = screenPos.xy / screenPos.w;

float distance = length(screenXY - uMouse);

float interactionRadius = 0.8;
float repulsionStrength = 0.0;
if (distance < interactionRadius) {
    repulsionStrength = (1.0 - (distance / interactionRadius)) * 0.5;
}

// Calculate repulsion direction
vec2 direction = normalize(screenXY - uMouse);
vec2 repulsion = direction * repulsionStrength;

// Apply repulsion to the resting position
vec3 finalPosition = restingPosition;
finalPosition.xy += repulsion;

// Add a subtle organic "breathing" motion
finalPosition.x += sin(uTime * 0.5 + aRandom * 10.0) * 0.01;
finalPosition.y += cos(uTime * 0.5 + aRandom * 10.0) * 0.01;
finalPosition.z += sin(uTime * 0.5 + aRandom * 10.0) * 0.01;

// --- Final Vertex Position ---
vec4 modelViewPosition = modelViewMatrix * vec4(finalPosition, 1.0);
gl_Position = projectionMatrix * modelViewPosition;

// --- Particle Size ---
// Make particles smaller when further away for depth perception
gl_PointSize = 4.0 * (1.0 / -modelViewPosition.z);

// --- Coloring ---
// Pass a color based on position to the fragment shader
vColor = vec3(0.5 + restingPosition.x, 0.5 + restingPosition.y, 0.8);
}
`;

const fragmentShader = `
varying vec3 vColor;

void main() {
// Create a soft, circular point instead of a square
float dist = length(gl_PointCoord - vec2(0.5));
float alpha = 1.0 - smoothstep(0.45, 0.5, dist);

if (alpha < 0.01) {
    discard; // Don't render transparent pixels
}

gl_FragColor = vec4(vColor, alpha);
}
`;

// --- Procedural Particle Generation ---
const PARTICLE_COUNT = 100000; // The high particle count is now fast!
const arrangementRadius = 1.5;

const geometry = new THREE.BufferGeometry();
const positions = [];
const restingPositions = [];
const randoms = [];

for (let i = 0; i < PARTICLE_COUNT; i++) {
const theta = Math.random() * 2 * Math.PI;
const phi = Math.acos((Math.random() * 2) - 1);
const r = arrangementRadius * Math.cbrt(Math.random());

const x = r * Math.sin(phi) * Math.cos(theta);
const y = r * Math.sin(phi) * Math.sin(theta);
const z = r * Math.cos(phi);

// We set the initial and resting positions to be the same
positions.push(x, y, z);
restingPositions.push(x, y, z);
randoms.push(Math.random());
}

geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
geometry.setAttribute('restingPosition', new THREE.Float32BufferAttribute(restingPositions, 3));
geometry.setAttribute('aRandom', new THREE.Float32BufferAttribute(randoms, 1));

const material = new THREE.ShaderMaterial({
uniforms: {
    uTime: { value: 0 },
    uMouse: { value: mouse },
},
vertexShader,
fragmentShader,
blending: THREE.AdditiveBlending, // Creates a nice glowing effect
depthWrite: false,
transparent: true,
});

// Create the single THREE.Points object
const particleOrb = new THREE.Points(geometry, material);
scene.add(particleOrb);

// --- Animation Loop (Now extremely simple and fast) ---
const clock = new THREE.Clock();

function animate() {
requestAnimationFrame(animate);

const elapsedTime = clock.getElapsedTime();

// We only need to update the uniforms. The GPU does the rest.
material.uniforms.uTime.value = elapsedTime;
material.uniforms.uMouse.value.copy(mouse);

// Optional: Add a slow rotation to the whole system for more dynamism
particleOrb.rotation.y = elapsedTime * 0.05;

renderer.render(scene, camera);
}

// --- Handle Window Resizing ---
function onWindowResize() {
camera.aspect = window.innerWidth / window.innerHeight;
camera.updateProjectionMatrix();
renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', onWindowResize);

// --- Start the animation ---
animate();