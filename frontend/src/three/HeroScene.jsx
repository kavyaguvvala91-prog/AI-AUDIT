import React, { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Stars } from '@react-three/drei'
import AISphere from './AISphere.jsx'
import ParticleBackground from './ParticleBackground.jsx'

export default function HeroScene() {
  return (
    <Canvas
      camera={{ position: [0, 0, 5], fov: 60 }}
      style={{ width: '100%', height: '100%' }}
      gl={{ antialias: true, alpha: true }}
      dpr={[1, 1.5]}
    >
      <ambientLight intensity={0.2} />
      <pointLight position={[5, 5, 5]} intensity={1.5} color="#6ee7f7" />
      <pointLight position={[-5, -5, -5]} intensity={0.5} color="#3a9ab0" />
      <spotLight
        position={[0, 8, 0]}
        intensity={1}
        color="#6ee7f7"
        angle={0.3}
        penumbra={1}
      />

      <Suspense fallback={null}>
        <Stars radius={60} depth={30} count={800} factor={3} fade speed={0.5} />
        <ParticleBackground count={400} />
        <AISphere />
      </Suspense>

      <OrbitControls
        enableZoom={false}
        enablePan={false}
        autoRotate
        autoRotateSpeed={0.4}
        maxPolarAngle={Math.PI / 1.6}
        minPolarAngle={Math.PI / 3}
      />
    </Canvas>
  )
}
