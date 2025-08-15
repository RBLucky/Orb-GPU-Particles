// --- Basic Three.js Setup ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
const renderer = new THREE.WebGLRenderer({
  canvas: document.getElementById("orb-canvas"),
  antialias: true,
});

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
camera.position.z = 3.5;

// --- Mouse Interaction ---
const mouse = new THREE.Vector2(0, 0);
window.addEventListener("mousemove", (event) => {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
});
window.addEventListener("mouseleave", () => {
  mouse.set(0, 0);
});

// --- Shaders ---
const vertexShader = `
uniform float uTime;
uniform vec2 uMouse;
uniform float uInteractionRadius;
uniform float uRepulsionStrength;
uniform vec3 uColor1;
uniform vec3 uColor2;

attribute vec3 restingPosition;
attribute float aRandom;

varying vec3 vColor;

void main() {
    vec4 screenPos = projectionMatrix * modelViewMatrix * vec4(restingPosition, 1.0);
    vec2 screenXY = screenPos.xy / screenPos.w;

    float distance = length(screenXY - uMouse);
    float repulsionStrength = 0.0;
    if (distance < uInteractionRadius) {
        repulsionStrength = (1.0 - (distance / uInteractionRadius)) * uRepulsionStrength;
    }

    vec2 direction = normalize(screenXY - uMouse);
    vec2 repulsion = direction * repulsionStrength;

    vec3 finalPosition = restingPosition;
    finalPosition.xy += repulsion;

    finalPosition.x += sin(uTime * 0.5 + aRandom * 10.0) * 0.01;
    finalPosition.y += cos(uTime * 0.5 + aRandom * 10.0) * 0.01;
    finalPosition.z += sin(uTime * 0.5 + aRandom * 10.0) * 0.01;

    vec4 modelViewPosition = modelViewMatrix * vec4(finalPosition, 1.0);
    gl_Position = projectionMatrix * modelViewPosition;
    gl_PointSize = 4.0 * (1.0 / -modelViewPosition.z);

    vColor = mix(uColor1, uColor2, (restingPosition.y + 1.5) / 3.0);
}
`;

const fragmentShader = `
varying vec3 vColor;

void main() {
    float dist = length(gl_PointCoord - vec2(0.5));
    float alpha = 1.0 - smoothstep(0.45, 0.5, dist);

    if (alpha < 0.01) {
        discard;
    }

    gl_FragColor = vec4(vColor, alpha);
}
`;

// --- Particle Generation ---
let PARTICLE_COUNT = 100000;
const arrangementRadius = 1.5;
let geometry, material, particleOrb;

function createParticles() {
  if (particleOrb) {
    scene.remove(particleOrb);
    geometry.dispose();
    material.dispose();
  }

  geometry = new THREE.BufferGeometry();
  const positions = [];
  const restingPositions = [];
  const randoms = [];

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const theta = Math.random() * 2 * Math.PI;
    const phi = Math.acos(Math.random() * 2 - 1);
    const r = arrangementRadius * Math.cbrt(Math.random());

    const x = r * Math.sin(phi) * Math.cos(theta);
    const y = r * Math.sin(phi) * Math.sin(theta);
    const z = r * Math.cos(phi);

    positions.push(x, y, z);
    restingPositions.push(x, y, z);
    randoms.push(Math.random());
  }

  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3)
  );
  geometry.setAttribute(
    "restingPosition",
    new THREE.Float32BufferAttribute(restingPositions, 3)
  );
  geometry.setAttribute(
    "aRandom",
    new THREE.Float32BufferAttribute(randoms, 1)
  );

  material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uMouse: { value: mouse },
      uInteractionRadius: { value: 0.8 },
      uRepulsionStrength: { value: 0.5 },
      uColor1: { value: new THREE.Color("#ff0080") },
      uColor2: { value: new THREE.Color("#00ffff") },
    },
    vertexShader,
    fragmentShader,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
  });

  particleOrb = new THREE.Points(geometry, material);
  scene.add(particleOrb);
}

createParticles();

// --- GUI Customizer ---
const gui = new lil.GUI({
  container: document.getElementById("gui-container"),
});
const params = {
  particleCount: PARTICLE_COUNT,
  backgroundColor: "#0a0a0a",
  color1: "#ff0080",
  color2: "#00ffff",
  interactionRadius: 0.8,
  repulsionStrength: 0.5,
};

gui
  .add(params, "particleCount", 10000, 200000, 1000)
  .name("Particle Count")
  .onFinishChange(() => {
    PARTICLE_COUNT = params.particleCount;
    createParticles();
  });
gui
  .addColor(params, "backgroundColor")
  .name("Background Color")
  .onChange(() => {
    document.body.style.background = params.backgroundColor;
  });
gui
  .addColor(params, "color1")
  .name("Particle Color 1")
  .onChange(() => {
    material.uniforms.uColor1.value.set(params.color1);
  });
gui
  .addColor(params, "color2")
  .name("Particle Color 2")
  .onChange(() => {
    material.uniforms.uColor2.value.set(params.color2);
  });
gui
  .add(params, "interactionRadius", 0.1, 2, 0.1)
  .name("Interaction Radius")
  .onChange(() => {
    material.uniforms.uInteractionRadius.value = params.interactionRadius;
  });
gui
  .add(params, "repulsionStrength", 0.1, 2, 0.1)
  .name("Repulsion Strength")
  .onChange(() => {
    material.uniforms.uRepulsionStrength.value = params.repulsionStrength;
  });

// --- Animation Loop ---
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const elapsedTime = clock.getElapsedTime();

  material.uniforms.uTime.value = elapsedTime;
  material.uniforms.uMouse.value.copy(mouse);
  particleOrb.rotation.y = elapsedTime * 0.05;

  renderer.render(scene, camera);
}

// --- Window Resizing ---
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener("resize", onWindowResize);

animate();
