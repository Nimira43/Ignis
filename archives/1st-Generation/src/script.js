import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import gsap from 'gsap'
import GUI from 'lil-gui'

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

// Fog for volcanic atmosphere
scene.fog = new THREE.FogExp2(0x120306, 0.008)




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
  planeMesh.rotation.set(-Math.PI / 2, 0, 0) // ground plane
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

    // Slight crust variation
    array[i3] = x + (Math.random() - 0.5) * 2
    array[i3 + 1] = y + (Math.random() - 0.5) * 0.5
    array[i3 + 2] = z + (Math.random() - 0.5) * 2

    randomValues.push(Math.random() * Math.PI * 2)
  }

  position.randomValues = randomValues
  position.originalPosition = position.array.slice()

  // Lava vertex colours (dark crust + glowing cracks)
  const colours = []
  for (let i = 0; i < vertexCount; i++) {
    const i3 = i * 3
    const x = position.array[i3]
    const z = position.array[i3 + 2]

    const dist = Math.sqrt(x * x + z * z)
    const crackNoise = Math.abs(Math.sin(dist * 0.15)) // radial-ish cracks

    const crack = Math.pow(crackNoise, world.lava.crackSharpness)

    const base = world.lava.baseDarkness * (1 - crack)
    const glow = crack * world.lava.glowIntensity

    const r = base + glow * 1.0
    const g = base + glow * 0.35
    const b = base + glow * 0.05

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

// lil‑gui controls
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
waveFolder.add(world.waves, 'amplitude', 0, 6, 0.1)
waveFolder.add(world.waves, 'frequency', 0.1, 2, 0.05)
waveFolder.add(world.waves, 'speed', 0.1, 2, 0.05)

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
})

// Animation loop
let frame = 0
function animate() {
  requestAnimationFrame(animate)
  controls.update()

  frame += 0.01 * world.waves.speed

  const position = planeMesh.geometry.attributes.position
  const { array, originalPosition, randomValues } = position
  const vertexCount = position.count

  for (let i = 0; i < vertexCount; i++) {
    const i3 = i * 3

    const ox = originalPosition[i3]
    const oy = originalPosition[i3 + 1]
    const oz = originalPosition[i3 + 2]

    const wave =
      Math.sin(frame * world.waves.frequency + randomValues[i]) *
      world.waves.amplitude

    array[i3] = ox
    array[i3 + 1] = oy + wave
    array[i3 + 2] = oz
  }

  position.needsUpdate = true

  // Hover interaction: glow pulse
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

    // Subtle camera shake when close to the surface
    const dist = point.length()
    const shake = Math.max(0, 1 - dist / (world.plane.width * 0.7)) * 0.2
    camera.position.x += (Math.random() - 0.5) * shake
    camera.position.y += (Math.random() - 0.5) * shake
  }

  renderer.render(scene, camera)
}

animate()
