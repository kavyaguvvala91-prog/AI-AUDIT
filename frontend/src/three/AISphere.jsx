import React, { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Sphere, MeshDistortMaterial } from '@react-three/drei'

export default function AISphere() {
  const meshRef = useRef()

  useFrame(({ clock }) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = clock.getElapsedTime() * 0.3
      meshRef.current.rotation.x = Math.sin(clock.getElapsedTime() * 0.2) * 0.2
    }
  })

  return (
    <group>
      {/* Core sphere */}
      <Sphere ref={meshRef} args={[1.4, 64, 64]}>
        <MeshDistortMaterial
          color="#6ee7f7"
          attach="material"
          distort={0.35}
          speed={2}
          roughness={0.1}
          metalness={0.8}
          transparent
          opacity={0.15}
          wireframe={false}
        />
      </Sphere>

      {/* Wireframe shell */}
      <Sphere args={[1.45, 24, 24]}>
        <meshBasicMaterial
          color="#6ee7f7"
          wireframe
          transparent
          opacity={0.12}
        />
      </Sphere>

      {/* Inner core glow */}
      <Sphere args={[0.7, 32, 32]}>
        <meshBasicMaterial
          color="#6ee7f7"
          transparent
          opacity={0.08}
        />
      </Sphere>

      {/* Orbiting ring */}
      <mesh rotation={[Math.PI / 2.5, 0, 0]}>
        <torusGeometry args={[2, 0.015, 8, 100]} />
        <meshBasicMaterial color="#6ee7f7" transparent opacity={0.3} />
      </mesh>

      <mesh rotation={[Math.PI / 3, Math.PI / 4, 0]}>
        <torusGeometry args={[2.2, 0.01, 8, 100]} />
        <meshBasicMaterial color="#3a9ab0" transparent opacity={0.2} />
      </mesh>
    </group>
  )
}
