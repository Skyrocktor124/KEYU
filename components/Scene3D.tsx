import React, { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { EffectComposer, Bloom, ChromaticAberration } from '@react-three/postprocessing';
import * as THREE from 'three';
import { Stars } from '@react-three/drei';
import { Beat, LevelTheme } from '../types';
import { GAME_CONFIG } from '../constants';

// Augment JSX namespace for Three.js elements
// We explicitly type these as 'any' to avoid detailed R3F type dependency issues in this setup
declare global {
  namespace JSX {
    interface IntrinsicElements {
      group: any;
      mesh: any;
      boxGeometry: any;
      sphereGeometry: any;
      octahedronGeometry: any;
      dodecahedronGeometry: any;
      meshStandardMaterial: any;
      meshBasicMaterial: any;
      pointLight: any;
      ambientLight: any;
      directionalLight: any;
      gridHelper: any;
      instancedMesh: any;
      color: any;
      fog: any;
    }
  }
}

// Augment React module directly for React 18+ type resolution
declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      group: any;
      mesh: any;
      boxGeometry: any;
      sphereGeometry: any;
      octahedronGeometry: any;
      dodecahedronGeometry: any;
      meshStandardMaterial: any;
      meshBasicMaterial: any;
      pointLight: any;
      ambientLight: any;
      directionalLight: any;
      gridHelper: any;
      instancedMesh: any;
      color: any;
      fog: any;
    }
  }
}

interface Scene3DProps {
  cursorPos: { x: number; y: number; z: number } | null;
  cursorScale: number;
  beats: Beat[];
  setBeats: React.Dispatch<React.SetStateAction<Beat[]>>;
  onHit: (id: string, accuracy: number) => void;
  onMiss: (id: string) => void;
  theme: LevelTheme;
  isPlaying: boolean;
}

// The Player's "Saber"
const SaberCursor = ({ position, color, scale }: { position: { x: number, y: number } | null, color: string, scale: number }) => {
  const ref = useRef<any>(null);
  
  useFrame(() => {
    if (position && ref.current) {
      // Increased lerp factor from 0.3 to 0.6 for more responsive tracking
      ref.current.position.lerp(new THREE.Vector3(position.x, position.y, 0), 0.6);
      
      // Smooth scale transition
      const currentScale = ref.current.scale.x;
      const targetScale = scale;
      const newScale = THREE.MathUtils.lerp(currentScale, targetScale, 0.2);
      ref.current.scale.set(newScale, newScale, newScale);

      ref.current.rotation.z += 0.1;
      ref.current.rotation.x += 0.1;
    }
  });

  if (!position) return null;

  return (
    <group>
      <mesh ref={ref} position={[position.x, position.y, 0]}>
        <octahedronGeometry args={[0.5, 0]} />
        <meshBasicMaterial color={color} wireframe />
      </mesh>
      <pointLight position={[position.x, position.y, 1]} distance={5} intensity={5} color={color} />
    </group>
  );
};

// The Beat Manager - Handles movement and rendering of beats
const BeatSystem = ({ beats, setBeats, cursorPos, onHit, onMiss, theme, isPlaying, cursorScale }: Scene3DProps) => {
  const speed = 0.2 * theme.speedMultiplier;
  
  // Instance mesh refs for performance
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame((state, delta) => {
    if (!isPlaying) return;

    let hitOccurred = false;
    const nextBeats = beats.map(beat => {
      // Move beat towards camera
      const newZ = beat.z + speed * (delta * 60); // Normalize to approx 60fps
      
      // Collision Logic
      if (!beat.hit && cursorPos) {
        // Widen hit window Z from 2 to 3 for more forgiveness
        if (Math.abs(newZ - GAME_CONFIG.HIT_Z) < 3.0) {
            const dx = beat.x - cursorPos.x;
            const dy = beat.y - cursorPos.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            
            // Adjust hit radius based on cursor scale!
            const effectiveHitRadius = GAME_CONFIG.HIT_RADIUS * (0.8 + (cursorScale * 0.5));

            if (dist < effectiveHitRadius) {
                onHit(beat.id, 1);
                return { ...beat, z: newZ, hit: true };
            }
        }
      }

      // Miss Logic
      if (!beat.hit && newZ > GAME_CONFIG.DESPAWN_Z) {
          onMiss(beat.id);
          return { ...beat, z: newZ, hit: true }; // Mark hit/processed to remove later
      }

      return { ...beat, z: newZ };
    });
    
    // Optimized Rendering Loop
    if (meshRef.current) {
        let activeCount = 0;
        beats.forEach((beat, i) => {
            if (beat.hit) return; // Don't render hit beats
            
            // Interpolate position visually
            beat.z += speed; 
            
            dummy.position.set(beat.x, beat.y, beat.z);
            dummy.rotation.x += 0.05;
            dummy.rotation.y += 0.05;
            
            // Pulse to the music (simulated)
            const scale = 1 + Math.sin(state.clock.elapsedTime * 10) * 0.2;
            dummy.scale.set(scale, scale, scale);
            
            dummy.updateMatrix();
            meshRef.current.setMatrixAt(activeCount, dummy.matrix);
            // We can also set color instance if we wanted multi-colored beats
            activeCount++;
            
            // Collision logic in render loop for instant feedback (optional redundancy)
            if (cursorPos && !beat.hit && Math.abs(beat.z - GAME_CONFIG.HIT_Z) < 3.0) {
                const dx = beat.x - cursorPos.x;
                const dy = beat.y - cursorPos.y;
                // Visual check uses same scaled radius logic
                const effectiveHitRadius = GAME_CONFIG.HIT_RADIUS * (0.8 + (cursorScale * 0.5));
                
                if (Math.sqrt(dx*dx + dy*dy) < effectiveHitRadius) {
                    beat.hit = true;
                    onHit(beat.id, 1);
                    // Hide instantly
                    dummy.scale.set(0,0,0);
                    dummy.updateMatrix();
                    meshRef.current.setMatrixAt(activeCount-1, dummy.matrix);
                }
            }
        });
        meshRef.current.count = activeCount;
        meshRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, 100]}>
      <dodecahedronGeometry args={[0.6, 0]} />
      <meshStandardMaterial 
        color={theme.colors[0]} 
        emissive={theme.colors[1]} 
        emissiveIntensity={2} 
        toneMapped={false}
      />
    </instancedMesh>
  );
};

const MovingGrid = ({ color, speed }: { color: string, speed: number }) => {
    const gridRef = useRef<any>(null);
    useFrame((state, delta) => {
        if (gridRef.current) {
            gridRef.current.position.z += delta * 10 * speed;
            if (gridRef.current.position.z > 10) {
                gridRef.current.position.z = 0;
            }
        }
    });
    return (
        <group ref={gridRef}>
            <gridHelper args={[100, 40, color, color]} position={[0, -4, -40]} />
            <gridHelper args={[100, 40, color, color]} position={[0, 10, -40]} rotation={[Math.PI, 0, 0]}/>
        </group>
    );
}

const SceneContent: React.FC<Scene3DProps> = (props) => {
  return (
    <>
      <color attach="background" args={[props.theme.colors[2]]} />
      <fog attach="fog" args={[props.theme.colors[2], 10, 50]} />

      <ambientLight intensity={0.5} />
      <directionalLight position={[0, 10, 5]} intensity={1} />
      
      <MovingGrid color={props.theme.colors[3]} speed={props.theme.speedMultiplier} />
      
      {/* Dynamic particles in background */}
      <Stars radius={100} depth={50} count={5000} factor={4} saturation={1} fade speed={2} />

      <BeatSystem {...props} />
      <SaberCursor position={props.cursorPos} color={props.theme.colors[1]} scale={props.cursorScale} />

      <EffectComposer disableNormalPass>
        <Bloom luminanceThreshold={1} mipmapBlur intensity={1.5} radius={0.6} />
        <ChromaticAberration offset={new THREE.Vector2(0.002, 0.002)} />
      </EffectComposer>
    </>
  );
};

const Scene3D = React.forwardRef<HTMLCanvasElement, Scene3DProps>((props, ref) => {
  return (
    <div className="w-full h-full">
      <Canvas
        camera={{ position: [0, 0, 8], fov: 60 }}
        gl={{ preserveDrawingBuffer: true, antialias: false }} // Optimization for postprocessing
        dpr={[1, 2]} // Quality scaling
        ref={ref as any}
      >
        <SceneContent {...props} />
      </Canvas>
    </div>
  );
});

Scene3D.displayName = 'Scene3D';

export default Scene3D;