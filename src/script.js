import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import gsap from 'gsap'
import GUI from 'lil-gui'

// Post Processing
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'

// GUI
const gui = new GUI()

// World settings
const world = {
  plane: {
    width: 400,
    height: 400,
    widthSegments: 150,
    heightSegments: 150
  },
  waves: {
    amplitude: 2,
    frequency: 0.6,
    speed: 0.6
  },
  lava: {
    glowIntensity: 1.5,
    crackSharpness: 4,
    baseDarkness: 0.15
  }
}

// Scene setup
const scene = new THREE.Scene()
scene.background = new THREE.Color(0x050308)

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
)

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
document.body.appendChild(renderer.domElement)

// Camera + controls
camera.position.set(0, 80, 120)
camera.lookAt(0, 0, 0)

const controls = new OrbitControls(camera, renderer.domElement)
controls.target.set(0, 0, 0)
controls.enableDamping = true
controls.update()

// Lights
const keyLight = new THREE.DirectionalLight(0xff5a2a, 2)
keyLight.position.set(50, 100, 80)
scene.add(keyLight)

const fillLight = new THREE.DirectionalLight(0xff2200, 1)
fillLight.position.set(-60, 40, -40)
scene.add(fillLight)

const rimLight = new THREE.DirectionalLight(0xff8800, 0.8)
rimLight.position.set(0, 120, -100)
scene.add(rimLight)

const ambient = new THREE.AmbientLight(0x330000, 0.6)
scene.add(ambient)

// Fog
scene.fog = new THREE.FogExp2(0x120306, 0.008)

// Ember particle system
const emberCount = 600
const emberGeometry = new THREE.BufferGeometry()
const emberPositions = new Float32Array(emberCount * 3)
const emberVelocities = new Float32Array(emberCount)
const emberSizes = new Float32Array(emberCount)

for (let i = 0; i < emberCount; i++) {
  const i3 = i * 3

  emberPositions[i3] = (Math.random() - 0.5) * world.plane.width * 0.8
  emberPositions[i3 + 1] = 0.5
  emberPositions[i3 + 2] = (Math.random() - 0.5) * world.plane.height * 0.8

  emberVelocities[i] = 0.1 + Math.random() * 0.3
  emberSizes[i] = 0.8 + Math.random() * 1.5
}

emberGeometry.setAttribute(
  'position',
  new THREE.BufferAttribute(emberPositions, 3)
)

function createSparkTexture() {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size

  const ctx = canvas.getContext('2d')

  const gradient = ctx.createRadialGradient(
    size / 2, size / 2, 2,
    size / 2, size / 2, size / 2
  )

  gradient.addColorStop(0, 'rgba(255,180,80,1)')
  gradient.addColorStop(0.3, 'rgba(255,120,40,0.8)')
  gradient.addColorStop(0.6, 'rgba(255,80,20,0.4)')
  gradient.addColorStop(1, 'rgba(0,0,0,0)')

  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)

  const texture = new THREE.CanvasTexture(canvas)
  texture.needsUpdate = true
  return texture
}

const emberMaterial = new THREE.PointsMaterial({
  color: new THREE.Color(1.0, 0.25, 0.05),
  size: 2,
  sizeAttenuation: true,
  transparent: true,
  opacity: 0.9,
  depthWrite: false,
  map: createSparkTexture(),
  alphaTest: 0.1
})

const emberPoints = new THREE.Points(emberGeometry, emberMaterial)
scene.add(emberPoints)

// Plane mesh
let planeMesh

function createPlane() {
  const geometry = new THREE.PlaneGeometry(
    world.plane.width,
    world.plane.height,
    world.plane.widthSegments,
    world.plane.heightSegments
  )

  const material = new THREE.MeshPhongMaterial({
    side: THREE.DoubleSide,
    flatShading: true,
    vertexColors: true,
    shininess: 80
  })

  planeMesh = new THREE.Mesh(geometry, material)
  planeMesh.position.set(0, 0, 0)
  planeMesh.rotation.set(-Math.PI / 2, 0, 0)
  scene.add(planeMesh)
}

createPlane()

// Generate plane geometry with random offsets + lava colours
function regeneratePlane() {
  planeMesh.geometry.dispose()
  planeMesh.geometry = new THREE.PlaneGeometry(
    world.plane.width,
    world.plane.height,
    world.plane.widthSegments,
    world.plane.heightSegments
  )

  const position = planeMesh.geometry.attributes.position
  const { array } = position
  const vertexCount = position.count

  const randomValues = []

  for (let i = 0; i < vertexCount; i++) {
    const i3 = i * 3

    const x = array[i3]
    const y = array[i3 + 1]
    const z = array[i3 + 2]

    array[i3] = x + (Math.random() - 0.5) * 2
    array[i3 + 1] = y + (Math.random() - 0.5) * 0.5
    array[i3 + 2] = z + (Math.random() - 0.5) * 2

    randomValues.push(Math.random() * Math.PI * 2)
  }

  position.randomValues = randomValues
  position.originalPosition = position.array.slice()

  const colours = []
  for (let i = 0; i < vertexCount; i++) {
    const i3 = i * 3
    const x = position.array[i3]
    const z = position.array[i3 + 2]

    const dist = Math.sqrt(x * x + z * z)
    const crackNoise = Math.abs(Math.sin(dist * 0.15))
    const crack = Math.pow(crackNoise, world.lava.crackSharpness)

    const warmBase = {
      r: 0.25,
      g: 0.07,
      b: 0.02
    }

    const base = world.lava.baseDarkness * (1 - crack)
    const glow = crack * world.lava.glowIntensity

    const r = warmBase.r * base + glow * 1.0
    const g = warmBase.g * base + glow * 0.45
    const b = warmBase.b * base + glow * 0.15

    colours.push(r, g, b)
  }
  planeMesh.geometry.setAttribute(
    'color',
    new THREE.BufferAttribute(new Float32Array(colours), 3)
  )
  planeMesh.position.set(0, 0, 0)
  planeMesh.rotation.set(-Math.PI / 2, 0, 0)
}

regeneratePlane()

// GUI
const planeFolder = gui.addFolder('Plane')
planeFolder.add(world.plane, 'width', 100, 800).onFinishChange(regeneratePlane)
planeFolder.add(world.plane, 'height', 100, 800).onFinishChange(regeneratePlane)
planeFolder
  .add(world.plane, 'widthSegments', 10, 200, 1)
  .onFinishChange(regeneratePlane)
planeFolder
  .add(world.plane, 'heightSegments', 10, 200, 1)
  .onFinishChange(regeneratePlane)

const waveFolder = gui.addFolder('Waves')
waveFolder.add(world.waves, 'amplitude', 0, 10, 0.1)
waveFolder.add(world.waves, 'frequency', 0.1, 5, 0.05)
waveFolder.add(world.waves, 'speed', 0.1, 5, 0.05)

const lavaFolder = gui.addFolder('Lava')
lavaFolder.add(world.lava, 'glowIntensity', 0.5, 3, 0.1).onFinishChange(regeneratePlane)
lavaFolder.add(world.lava, 'crackSharpness', 1, 8, 0.5).onFinishChange(regeneratePlane)
lavaFolder.add(world.lava, 'baseDarkness', 0.05, 0.4, 0.01).onFinishChange(regeneratePlane)

// Mouse + raycaster
const mouse = { x: 0, y: 0 }
const raycaster = new THREE.Raycaster()

window.addEventListener('mousemove', (event) => {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1
})

// Resize handling
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
  composer.setSize(window.innerWidth, window.innerHeight)
})

// Heat Have Shader
const HeatHazeShader = {
  uniforms: {
    tDiffuse: { value: null },
    time: { value: 0 },
    intensity: { value: 0.015 }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float time;
    uniform float intensity;
    varying vec2 vUv;

    float noise(vec2 p) {
      return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453);
    }

    void main() {
      float n = noise(vUv * 10.0 + time * 0.5);
      vec2 distorted = vUv + (n - 0.5) * intensity;
      gl_FragColor = texture2D(tDiffuse, distorted);
    }
  `
}

// Post Processing Setup
const composer = new EffectComposer(renderer)
composer.addPass(new RenderPass(scene, camera))

const heatHazePass = new ShaderPass(HeatHazeShader)
composer.addPass(heatHazePass)

// Animation Loop
let frame = 0
function animate() {
  requestAnimationFrame(animate)
  controls.update()

  frame += 0.01 * world.waves.speed

  const position = planeMesh.geometry.attributes.position
  const { array, originalPosition, randomValues } = position
  const vertexCount = position.count

  const t = frame

  for (let i = 0; i < vertexCount; i++) {
    const i3 = i * 3

    const ox = originalPosition[i3]
    const oy = originalPosition[i3 + 1]
    const oz = originalPosition[i3 + 2]

    // Layered Lava Flow
    const wave =
      Math.sin((ox + t * 0.6) * world.waves.frequency + randomValues[i]) *
      world.waves.amplitude * 0.6 +
      Math.cos((oz + t * 0.4) * world.waves.frequency * 0.7 + randomValues[i] * 1.3) *
      world.waves.amplitude * 0.4

    array[i3] = ox
    array[i3 + 1] = oy + wave
    array[i3 + 2] = oz
  }

  position.needsUpdate = true

  // Hover interaction
  raycaster.setFromCamera(mouse, camera)
  const intersects = raycaster.intersectObject(planeMesh)

  if (intersects.length > 0) {
    const { face, object, point } = intersects[0]
    const colourAttr = object.geometry.attributes.color

    const initialColour = { r: 0.8, g: 0.2, b: 0.05 }
    const hoverColour = { r: 1.5, g: 0.6, b: 0.2 }

    const applyColour = (index, c) => {
      colourAttr.setX(index, c.r)
      colourAttr.setY(index, c.g)
      colourAttr.setZ(index, c.b)
    }

    const indices = [face.a, face.b, face.c]
    indices.forEach((idx) => applyColour(idx, hoverColour))
    colourAttr.needsUpdate = true

    gsap.to(hoverColour, {
      r: initialColour.r,
      g: initialColour.g,
      b: initialColour.b,
      duration: 1.2,
      onUpdate: () => {
        indices.forEach((idx) => applyColour(idx, hoverColour))
        colourAttr.needsUpdate = true
      }
    })

    const dist = point.length()
    const shake = Math.max(0, 1 - dist / (world.plane.width * 0.7)) * 0.2
    camera.position.x += (Math.random() - 0.5) * shake
    camera.position.y += (Math.random() - 0.5) * shake
  }

  // Ember animation
  const emberPos = emberGeometry.attributes.position.array

  for (let i = 0; i < emberCount; i++) {
    const i3 = i * 3

    emberPos[i3 + 1] += emberVelocities[i]

    emberPos[i3] += (Math.random() - 0.5) * 0.1
    emberPos[i3 + 2] += (Math.random() - 0.5) * 0.1

    const height = emberPos[i3 + 1]
    const fade = Math.max(0, 1 - height / 80)
    emberMaterial.opacity = fade

    if (height > 80) {
      emberPos[i3] = (Math.random() - 0.5) * world.plane.width * 0.8
      emberPos[i3 + 1] = 0.5
      emberPos[i3 + 2] = (Math.random() - 0.5) * world.plane.height * 0.8
    }
  }

  emberGeometry.attributes.position.needsUpdate = true

  // Heat haze update
  heatHazePass.uniforms.time.value = frame
  composer.render()
}

animate()
