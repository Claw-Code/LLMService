import React, { useRef, useState, useCallback, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PointerLockControls } from '@react-three/drei';
import * as THREE from 'three';

/**
 * Maze and game configuration constants.
 * These can be modified to adjust map size, target count, and wall height.
 */
const MAZE_LENGTH = 80;
const MAZE_WIDTH = 80;
const TARGET_COUNT = 12;
const WALL_HEIGHT = 8;

/**
 * Interface for targets in the game.
 * - id: Unique identifier for each target.
 * - position: THREE.Vector3 position of the target.
 * - hit: Whether the target has been hit by a bullet.
 * - points: Points awarded for hitting this target.
 * - size: Visual size for scaling collision and display.
 */
interface Target {
  id: string;
  position: THREE.Vector3;
  hit: boolean;
  points: number;
  size: number;
}

/**
 * Interface for bullets fired by the player.
 * - id: Unique identifier for the bullet.
 * - position: Current position of the bullet.
 * - direction: Movement vector, normalized.
 */
interface Bullet {
  id: string;
  position: THREE.Vector3;
  direction: THREE.Vector3;
}

/**
 * Character component (player or NPC)
 * - position: starting position
 * - Animates rotation slightly for visual interest
 * - Modular: Can be reused for multiple characters in the scene
 */
const Character: React.FC<{ position: [number, number, number] }> = ({ position }) => {
  const groupRef = useRef<THREE.Group>(null);
  
  // Animate slight rotation to make the character feel alive
  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.1;
    }
  });

  return (
    <group ref={groupRef} position={position}>
      {/* Body, head, arms, legs all modular meshes */}
      <mesh position={[0, 2, 0]} castShadow>
        <boxGeometry args={[1.2, 2.5, 0.8]} />
        <meshLambertMaterial color="#3b82f6" />
      </mesh>
      <mesh position={[0, 4, 0]} castShadow>
        <boxGeometry args={[0.8, 0.8, 0.8]} />
        <meshLambertMaterial color="#fbbf24" />
      </mesh>
      <mesh position={[-0.8, 2.5, 0]} castShadow>
        <boxGeometry args={[0.4, 1.8, 0.4]} />
        <meshLambertMaterial color="#ef4444" />
      </mesh>
      <mesh position={[0.8, 2.5, 0]} castShadow>
        <boxGeometry args={[0.4, 1.8, 0.4]} />
        <meshLambertMaterial color="#ef4444" />
      </mesh>
      <mesh position={[-0.3, 0.8, 0]} castShadow>
        <boxGeometry args={[0.4, 1.6, 0.4]} />
        <meshLambertMaterial color="#1f2937" />
      </mesh>
      <mesh position={[0.3, 0.8, 0]} castShadow>
        <boxGeometry args={[0.4, 1.6, 0.4]} />
        <meshLambertMaterial color="#1f2937" />
      </mesh>
    </group>
  );
};

/**
 * EnvironmentalItems component
 * - Generates random boxes, barrels, and pillars in the maze.
 * - Reusable for any scene to create dynamic, visually varied environments.
 */
const EnvironmentalItems: React.FC = () => {
  const items = React.useMemo(() => {
    const itemList = [];

    // Generate random boxes and barrels
    for (let i = 0; i < 25; i++) {
      const x = (Math.random() - 0.5) * MAZE_WIDTH;
      const z = (Math.random() - 0.5) * MAZE_LENGTH;
      const height = 1 + Math.random() * 3;
      const size = 0.8 + Math.random() * 1.2;
      itemList.push({
        type: Math.random() > 0.5 ? 'box' : 'barrel',
        position: [x, height/2, z],
        size: [size, height, size],
        color: `hsl(${Math.random() * 360}, 50%, ${30 + Math.random() * 40}%)`
      });
    }

    // Generate pillars
    for (let i = 0; i < 8; i++) {
      const x = (Math.random() - 0.5) * MAZE_WIDTH * 0.8;
      const z = (Math.random() - 0.5) * MAZE_LENGTH * 0.8;
      itemList.push({
        type: 'pillar',
        position: [x, 6, z],
        size: [1.5, 12, 1.5],
        color: '#6b7280'
      });
    }

    return itemList;
  }, []);

  // Render all items as meshes
  return (
    <>
      {items.map((item, index) => (
        <mesh key={index} position={item.position as [number, number, number]} castShadow receiveShadow>
          {item.type === 'barrel' ? (
            <cylinderGeometry args={[item.size[0]/2, item.size[0]/2, item.size[1], 8]} />
          ) : (
            <boxGeometry args={item.size as [number, number, number]} />
          )}
          <meshLambertMaterial color={item.color} />
        </mesh>
      ))}
    </>
  );
};

/**
 * MazeStructure component
 * - Defines floor, floor tiles, and walls for the maze.
 * - Modular: Adjust mazePattern to create different maze layouts.
 * - Can be reused for other FPS or maze games by changing MAZE_LENGTH, MAZE_WIDTH, and walls.
 */
const MazeStructure: React.FC = () => {
  const walls = React.useMemo(() => {
    const wallList = [];
    const mazePattern = [
      { pos: [0, WALL_HEIGHT/2, -MAZE_LENGTH/2], size: [MAZE_WIDTH, WALL_HEIGHT, 2] },
      { pos: [0, WALL_HEIGHT/2, MAZE_LENGTH/2], size: [MAZE_WIDTH, WALL_HEIGHT, 2] },
      { pos: [-MAZE_WIDTH/2, WALL_HEIGHT/2, 0], size: [2, WALL_HEIGHT, MAZE_LENGTH] },
      { pos: [MAZE_WIDTH/2, WALL_HEIGHT/2, 0], size: [2, WALL_HEIGHT, MAZE_LENGTH] },
      { pos: [-20, WALL_HEIGHT/2, -20], size: [30, WALL_HEIGHT, 3] },
      { pos: [20, WALL_HEIGHT/2, -20], size: [25, WALL_HEIGHT, 3] },
      { pos: [-20, WALL_HEIGHT/2, 0], size: [3, WALL_HEIGHT, 35] },
      { pos: [15, WALL_HEIGHT/2, 0], size: [3, WALL_HEIGHT, 30] },
      { pos: [0, WALL_HEIGHT/2, 20], size: [40, WALL_HEIGHT, 3] },
      { pos: [-30, WALL_HEIGHT/2, 15], size: [3, WALL_HEIGHT, 20] },
      { pos: [30, WALL_HEIGHT/2, 15], size: [3, WALL_HEIGHT, 25] },
      { pos: [0, WALL_HEIGHT/2, -35], size: [35, WALL_HEIGHT, 3] },
      { pos: [-35, WALL_HEIGHT/2, -10], size: [3, WALL_HEIGHT, 15] },
      { pos: [35, WALL_HEIGHT/2, -5], size: [3, WALL_HEIGHT, 20] },
    ];
    return mazePattern;
  }, []);

  return (
    <group>
      {/* Floor */}
      <mesh position={[0, -0.5, 0]} receiveShadow>
        <boxGeometry args={[MAZE_WIDTH, 1, MAZE_LENGTH]} />
        <meshLambertMaterial color="#4b5563" />
      </mesh>

      {/* Floor tiles for visual pattern */}
      {Array.from({ length: 20 }, (_, i) => 
        Array.from({ length: 20 }, (_, j) => (
          <mesh key={`${i}-${j}`} position={[(i-10)*8, -0.4, (j-10)*8]} receiveShadow>
            <boxGeometry args={[7.5, 0.2, 7.5]} />
            <meshLambertMaterial color={(i + j) % 2 === 0 ? "#374151" : "#6b7280"} />
          </mesh>
        ))
      )}

      {/* Maze walls */}
      {walls.map((wall, index) => (
        <mesh key={index} position={wall.pos as [number, number, number]} receiveShadow castShadow>
          <boxGeometry args={wall.size as [number, number, number]} />
          <meshLambertMaterial color="#1f2937" />
        </mesh>
      ))}
    </group>
  );
};

/**
 * BullseyeTarget component
 * - Targets with animation and click/collision detection
 * - Reusable for any shooting game
 * - Accepts onHit callback for scoring
 */
const BullseyeTarget: React.FC<{ target: Target; onHit: (targetId: string, points: number) => void }> = ({ target, onHit }) => {
  const groupRef = useRef<THREE.Group>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  useFrame(() => {
    if (!groupRef.current || target.hit) return;
    groupRef.current.rotation.y += 0.01; // spinning animation
  });

  const handleHit = useCallback(() => {
    if (!target.hit) {
      setIsAnimating(true);
      onHit(target.id, target.points);
      setTimeout(() => setIsAnimating(false), 500);
    }
  }, [target, onHit]);

  return (
    <group ref={groupRef} position={target.position.toArray()} scale={isAnimating ? [1.2,1.2,1.2] : [1,1,1]}>
      {/* Target stand */}
      <mesh position={[0, -target.size/2, 0]}>
        <cylinderGeometry args={[0.1,0.1,target.size]} />
        <meshLambertMaterial color="#8b4513" />
      </mesh>
      {/* Bullseye rings */}
      <mesh position={[0,0,0.1]} onClick={handleHit}>
        <circleGeometry args={[target.size]} />
        <meshLambertMaterial color={target.hit ? "#4ade80" : "#ef4444"} />
      </mesh>
      <mesh position={[0,0,0.11]}><circleGeometry args={[target.size*0.8]} /><meshLambertMaterial color={target.hit ? "#22c55e" : "#ffffff"} /></mesh>
      <mesh position={[0,0,0.12]}><circleGeometry args={[target.size*0.6]} /><meshLambertMaterial color={target.hit ? "#16a34a" : "#ef4444"} /></mesh>
      <mesh position={[0,0,0.13]}><circleGeometry args={[target.size*0.4]} /><meshLambertMaterial color={target.hit ? "#15803d" : "#ffffff"} /></mesh>
      <mesh position={[0,0,0.14]}><circleGeometry args={[target.size*0.2]} /><meshLambertMaterial color={target.hit ? "#166534" : "#ef4444"} /></mesh>
      <mesh position={[0,0,0.15]}><circleGeometry args={[target.size*0.1]} /><meshLambertMaterial color={target.hit ? "#14532d" : "#000000"} /></mesh>
    </group>
  );
};

/**
 * Bullet component with movement and collision detection
 * - Reusable for any shooting mechanic
 * - onRemove callback removes bullet from state
 * - onTargetHit callback notifies when a target is hit
 */
const Bullet: React.FC<{ bullet: Bullet; targets: Target[]; onRemove: () => void; onTargetHit: (targetId: string, points: number) => void }> = ({ bullet, targets, onRemove, onTargetHit }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  let lifetime = 120; // frames to live

  useFrame(() => {
    if (!meshRef.current) return;

    // Move bullet
    bullet.position.add(bullet.direction.clone().multiplyScalar(0.8));
    meshRef.current.position.copy(bullet.position);

    // Check collision with targets
    targets.forEach(target => {
      if (!target.hit && bullet.position.distanceTo(target.position) < target.size) {
        onTargetHit(target.id, target.points);
        onRemove();
      }
    });

    // Check bounds
    if (Math.abs(bullet.position.x) > MAZE_WIDTH/2 || Math.abs(bullet.position.z) > MAZE_LENGTH/2 || bullet.position.y > 25 || bullet.position.y < 0) {
      onRemove();
    }

    lifetime--;
    if (lifetime <= 0) onRemove();
  });

  return (
    <mesh ref={meshRef} position={bullet.position.toArray()}>
      <sphereGeometry args={[0.1]} />
      <meshBasicMaterial color="#fbbf24" />
    </mesh>
  );
};

/**
 * FPSController component
 * - Handles WASD movement, jumping, gravity
 * - Integrates camera movement with PointerLockControls
 * - onShoot callback triggers firing bullets
 * - Can be reused for any FPS game
 */
const FPSController: React.FC<{ position: THREE.Vector3; onShoot: (direction: THREE.Vector3) => void }> = ({ position, onShoot }) => {
  const { camera } = useThree();
  const keys = useRef<{ [key: string]: boolean }>({});
  const velocity = useRef(new THREE.Vector3());

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keys.current[e.code] = true;
      if (e.code === 'Space') { e.preventDefault(); velocity.current.y = 0.25; }
    };
    const handleKeyUp = (e: KeyboardEvent) => { keys.current[e.code] = false; };
    const handleClick = () => {
      const direction = new THREE.Vector3();
      camera.getWorldDirection(direction);
      onShoot(direction);
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('click', handleClick);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('click', handleClick);
    };
  }, [camera, onShoot]);

  useFrame(() => {
    // Movement logic
    const move = new THREE.Vector3();
    const speed = 0.2;
    if (keys.current['KeyW']) move.z -= 1;
    if (keys.current['KeyS']) move.z += 1;
    if (keys.current['KeyA']) move.x -= 1;
    if (keys.current['KeyD']) move.x += 1;
    if (move.length() > 0) {
      move.normalize();
      const forward = new THREE.Vector3();
      camera.getWorldDirection(forward);
      forward.y = 0; forward.normalize();
      const right = new THREE.Vector3();
      right.crossVectors(forward, camera.up);
      const movement = new THREE.Vector3();
      movement.addScaledVector(forward, -move.z * speed);
      movement.addScaledVector(right, move.x * speed);

      // Boundary checks
      const newPos = position.clone().add(movement);
      if (Math.abs(newPos.x) < MAZE_WIDTH/2 - 3 && Math.abs(newPos.z) < MAZE_LENGTH/2 - 3) {
        position.add(movement);
      }
    }

    // Gravity
    velocity.current.y -= 0.015;
    position.y += velocity.current.y;
    const groundHeight = 1.8;
    if (position.y <= groundHeight) { position.y = groundHeight; velocity.current.y = 0; }

    camera.position.copy(position);
  });

  return null;
};

/**
 * GameScene component
 * - Combines maze, environment, characters, targets, bullets, and FPSController
 * - Modular for reuse: swap out MazeStructure, EnvironmentalItems, or Character
 */
const GameScene: React.FC<{
  onShoot: (direction: THREE.Vector3) => void;
  onTargetHit: (targetId: string, points: number) => void;
  playerPosition: THREE.Vector3;
  targets: Target[];
  bullets: Bullet[];
  removeBullet: (id: string) => void;
}> = ({ onShoot, onTargetHit, playerPosition, targets, bullets, removeBullet }) => {
  return (
    <>
      {/* Lighting setup */}
      <color attach="background" args={['#87CEEB']} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[50,50,50]} intensity={1.2} castShadow shadow-mapSize={[2048,2048]} shadow-camera-far={200} shadow-camera-left={-50} shadow-camera-right={50} shadow-camera-top={50} shadow-camera-bottom={-50} />
      <hemisphereLight args={["#87CEEB", "#8B7355", 0.4]} />

      <MazeStructure />
      <EnvironmentalItems />

      {/* Add multiple NPC characters */}
      <Character position={[15,0,15]} />
      <Character position={[-20,0,-10]} />
      <Character position={[25,0,-25]} />
      <Character position={[-15,0,20]} />

      <FPSController position={playerPosition} onShoot={onShoot} />

      {targets.map(target => <BullseyeTarget key={target.id} target={target} onHit={onTargetHit} />)}
      {bullets.map(bullet => <Bullet key={bullet.id} bullet={bullet} targets={targets} onRemove={() => removeBullet(bullet.id)} onTargetHit={onTargetHit} />)}

      <PointerLockControls />
    </>
  );
};


// Enhanced HUD (Outside Canvas)
const ShootingRangeHUD: React.FC<{ 
  score: number; 
  accuracy: number;
  targetsHit: number;
  totalShots: number;
}> = ({ score, accuracy, targetsHit, totalShots }) => (
  <div className="fixed inset-0 pointer-events-none z-50">
    {/* Crosshair */}
    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
      <div className="w-0.5 h-6 bg-red-500"></div>
      <div className="w-6 h-0.5 bg-red-500 absolute top-2.5 -left-2.5"></div>
      <div className="w-2 h-2 border border-red-500 rounded-full absolute -top-1 -left-1"></div>
    </div>
    
    {/* Stats */}
    <div className="absolute top-4 left-4 text-white space-y-2">
      <div className="text-2xl font-bold">Score: {score}</div>
      <div className="text-lg">Targets Hit: {targetsHit}/{TARGET_COUNT}</div>
      <div className="text-lg">Accuracy: {accuracy.toFixed(1)}%</div>
      <div className="text-sm text-gray-300">Shots: {totalShots}</div>
    </div>
    
    {/* Controls */}
    <div className="absolute bottom-4 right-4 text-white text-sm space-y-1">
      <div>WASD: Move</div>
      <div>Mouse: Look Around</div>
      <div>Click: Shoot</div>
      <div>Space: Jump</div>
    </div>
    
    {/* Game Title */}
    <div className="absolute top-4 right-4 text-white">
      <div className="text-xl font-bold">MAZE SHOOTER</div>
      <div className="text-sm text-gray-300">Navigate & eliminate targets!</div>
    </div>
  </div>
);

// Loading fallback component
const LoadingFallback: React.FC = () => (
  <div className="w-full h-screen bg-slate-900 flex items-center justify-center">
    <div className="text-white text-xl">Loading Shooting Range...</div>
  </div>
);

// Main Component with proper state management - fully self-contained
const MinecraftFPS: React.FC<{ width?: string; height?: string; className?: string }> = ({ 
  width = "100%", 
  height = "100vh", 
  className = "" 
}) => {
  const [playerPosition] = useState(() => new THREE.Vector3(0, 2, 0));
  const [targets, setTargets] = useState<Target[]>([]);
  const [bullets, setBullets] = useState<Bullet[]>([]);
  const [score, setScore] = useState(0);
  const [totalShots, setTotalShots] = useState(0);
  const [targetsHit, setTargetsHit] = useState(0);

  // Initialize targets
  React.useEffect(() => {
    const newTargets: Target[] = [];
    for (let i = 0; i < TARGET_COUNT; i++) {
      const angle = (i / TARGET_COUNT) * Math.PI * 2;
      const radius = 15 + Math.random() * 25;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const height = 2 + Math.random() * 4;
      const size = 0.8 + Math.random() * 0.7;
      
      newTargets.push({
        id: `target-${i}`,
        position: new THREE.Vector3(x, height, z),
        hit: false,
        points: Math.floor(150 / size),
        size: size
      });
    }
    setTargets(newTargets);
  }, []);

  const handleShoot = useCallback((direction: THREE.Vector3) => {
    setTotalShots(prev => prev + 1);
    setBullets(prev => [...prev.slice(-4), {
      id: Math.random().toString(),
      position: playerPosition.clone(),
      direction: direction.normalize()
    }]);
  }, [playerPosition]);

  const handleTargetHit = useCallback((targetId: string, points: number) => {
    setTargets(prev => prev.map(t => 
      t.id === targetId ? { ...t, hit: true } : t
    ));
    setScore(prev => prev + points);
    setTargetsHit(prev => prev + 1);
  }, []);

  const removeBullet = useCallback((id: string) => {
    setBullets(prev => prev.filter(b => b.id !== id));
  }, []);

  const accuracy = totalShots > 0 ? (targetsHit / totalShots) * 100 : 0;

  return (
    <div 
      className={`overflow-hidden bg-sky-200 ${className}`}
      style={{ width, height }}
    >
      <Suspense fallback={<LoadingFallback />}>
        <Canvas 
          camera={{ fov: 75, near: 0.1, far: 1000 }}
          shadows
          gl={{ antialias: true, alpha: false }}
          dpr={[1, 2]}
        >
          <GameScene 
            onShoot={handleShoot}
            onTargetHit={handleTargetHit}
            playerPosition={playerPosition}
            targets={targets}
            bullets={bullets}
            removeBullet={removeBullet}
          />
        </Canvas>
        
        <ShootingRangeHUD 
          score={score} 
          accuracy={accuracy}
          targetsHit={targetsHit}
          totalShots={totalShots}
        />
      </Suspense>
    </div>
  );
};

export default MinecraftFPS;