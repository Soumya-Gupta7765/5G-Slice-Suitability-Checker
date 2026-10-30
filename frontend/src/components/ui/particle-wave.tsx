import { useEffect, useRef } from 'react'
import * as THREE from 'three'

interface ParticleWaveProps {
  className?: string
}

/**
 * Full-viewport animated particle wave used as the site background.
 * Adaptations for this project (dark-only theme, no Tailwind/shadcn):
 * - colors are hardcoded to the dark palette (white particles on black)
 * - canvas is fixed behind content and ignores pointer events
 * - device pixel ratio is capped at 2 to keep 40k points cheap
 */
const particleVertex = `
  attribute float scale;
  uniform float uTime;
  void main() {
    vec3 p = position;
    float s = scale;
    p.y += (sin(p.x + uTime) * 0.5) + (cos(p.y + uTime) * 0.1) * 2.0;
    p.x += (sin(p.y + uTime) * 0.5);
    s += (sin(p.x + uTime) * 0.5) + (cos(p.y + uTime) * 0.1) * 2.0;
    vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = s * 15.0 * (1.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`

const particleFragment = `
  uniform vec3 uColor;
  void main() {
    gl_FragColor = vec4(uColor, 0.7);
  }
`

export function ParticleWave({ className = '' }: ParticleWaveProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.01, 1000)
    camera.position.set(0, 6, 5)

    const scene = new THREE.Scene()

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setClearColor(0x000000)

    const gap = 0.3
    const amountX = window.innerWidth < 768 ? 120 : 200
    const amountY = amountX
    const particleNum = amountX * amountY
    const particlePositions = new Float32Array(particleNum * 3)
    const particleScales = new Float32Array(particleNum)

    let i = 0
    let j = 0
    for (let ix = 0; ix < amountX; ix++) {
      for (let iy = 0; iy < amountY; iy++) {
        particlePositions[i] = ix * gap - (amountX * gap) / 2
        particlePositions[i + 1] = 0
        particlePositions[i + 2] = iy * gap - (amountX * gap) / 2
        particleScales[j] = 1
        i += 3
        j++
      }
    }

    const particleGeometry = new THREE.BufferGeometry()
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3))
    particleGeometry.setAttribute('scale', new THREE.BufferAttribute(particleScales, 1))

    const particleMaterial = new THREE.ShaderMaterial({
      transparent: true,
      vertexShader: particleVertex,
      fragmentShader: particleFragment,
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Vector3(1, 1, 1) },
      },
    })

    const particles = new THREE.Points(particleGeometry, particleMaterial)
    scene.add(particles)

    let animationId: number | null = null

    const animate = () => {
      particleMaterial.uniforms.uTime.value += 0.05
      camera.lookAt(scene.position)
      renderer.render(scene, camera)
      animationId = requestAnimationFrame(animate)
    }
    animate()

    const handleResize = () => {
      const winWidth = window.innerWidth
      const winHeight = window.innerHeight
      camera.aspect = winWidth / winHeight
      camera.updateProjectionMatrix()
      renderer.setSize(winWidth, winHeight)
    }
    window.addEventListener('resize', handleResize)

    return () => {
      if (animationId) cancelAnimationFrame(animationId)
      window.removeEventListener('resize', handleResize)
      scene.remove(particles)
      particleGeometry.dispose()
      particleMaterial.dispose()
      renderer.dispose()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`particle-wave ${className}`.trim()}
    />
  )
}
