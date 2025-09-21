import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

// Types
type BottleType = "coke" | "sprite" | "fanta";
type GameState = "menu" | "playing" | "paused" | "gameOver" | "levelComplete";
type ObstacleType = "static" | "moving" | "rotating" | "bouncing";

interface Bottle {
  id: BottleType;
  name: string;
  color: string;
  capColor: string;
  unlocked: boolean;
  flipPower: number;
  stability: number;
}

interface Vector2 {
  x: number;
  y: number;
}

interface PhysicsBottle {
  position: Vector2;
  velocity: Vector2;
  rotation: number;
  angularVelocity: number;
  isFlipping: boolean;
  hasLanded: boolean;
  landedUpright: boolean;
}

interface Obstacle {
  id: string;
  type: ObstacleType;
  position: Vector2;
  size: Vector2;
  movement?: {
    speed: number;
    direction: Vector2;
    bounds: { min: Vector2; max: Vector2 };
  };
  rotation?: number;
}

interface Level {
  id: number;
  name: string;
  difficulty: number;
  obstacles: Obstacle[];
  targetScore: number;
  maxFlips: number;
  timeLimit?: number;
  unlocked: boolean;
}

// Bottle configurations
const bottles: Bottle[] = [
  {
    id: "coke",
    name: "Coca-Cola",
    color: "#DC2626",
    capColor: "#B91C1C",
    unlocked: true,
    flipPower: 1.0,
    stability: 1.0
  },
  {
    id: "sprite",
    name: "Sprite",
    color: "#10B981",
    capColor: "#059669",
    unlocked: false,
    flipPower: 1.1,
    stability: 0.9
  },
  {
    id: "fanta",
    name: "Fanta",
    color: "#F59E0B",
    capColor: "#D97706",
    unlocked: false,
    flipPower: 0.9,
    stability: 1.1
  }
];

// Level configurations
const levels: Level[] = [
  {
    id: 1,
    name: "First Flip",
    difficulty: 1,
    obstacles: [],
    targetScore: 3,
    maxFlips: 10,
    unlocked: true
  },
  {
    id: 2,
    name: "Table Edge",
    difficulty: 2,
    obstacles: [
      { id: "table1", type: "static", position: { x: 300, y: 400 }, size: { x: 200, y: 20 } }
    ],
    targetScore: 5,
    maxFlips: 15,
    unlocked: false
  },
  {
    id: 3,
    name: "Moving Platform",
    difficulty: 3,
    obstacles: [
      {
        id: "platform1",
        type: "moving",
        position: { x: 250, y: 350 },
        size: { x: 100, y: 20 },
        movement: {
          speed: 50,
          direction: { x: 1, y: 0 },
          bounds: { min: { x: 200, y: 350 }, max: { x: 400, y: 350 } }
        }
      }
    ],
    targetScore: 8,
    maxFlips: 20,
    unlocked: false
  },
  {
    id: 4,
    name: "Obstacle Course",
    difficulty: 4,
    obstacles: [
      { id: "wall1", type: "static", position: { x: 200, y: 300 }, size: { x: 20, y: 100 } },
      { id: "wall2", type: "static", position: { x: 400, y: 250 }, size: { x: 20, y: 150 } },
      {
        id: "spinner1",
        type: "rotating",
        position: { x: 300, y: 400 },
        size: { x: 80, y: 20 },
        rotation: 0
      }
    ],
    targetScore: 10,
    maxFlips: 25,
    unlocked: false
  },
  {
    id: 5,
    name: "Master Challenge",
    difficulty: 5,
    obstacles: [
      {
        id: "bouncer1",
        type: "bouncing",
        position: { x: 150, y: 300 },
        size: { x: 60, y: 20 },
        movement: {
          speed: 30,
          direction: { x: 0, y: 1 },
          bounds: { min: { x: 150, y: 250 }, max: { x: 150, y: 400 } }
        }
      },
      {
        id: "bouncer2",
        type: "bouncing",
        position: { x: 450, y: 350 },
        size: { x: 60, y: 20 },
        movement: {
          speed: 40,
          direction: { x: 0, y: -1 },
          bounds: { min: { x: 450, y: 300 }, max: { x: 450, y: 450 } }
        }
      },
      {
        id: "mover1",
        type: "moving",
        position: { x: 300, y: 380 },
        size: { x: 80, y: 15 },
        movement: {
          speed: 60,
          direction: { x: 1, y: 0 },
          bounds: { min: { x: 200, y: 380 }, max: { x: 400, y: 380 } }
        }
      }
    ],
    targetScore: 15,
    maxFlips: 30,
    timeLimit: 60,
    unlocked: false
  }
];

// Sound effects using Web Audio API
class SoundManager {
  private context: AudioContext | null = null;
  private masterVolume = 0.3;

  constructor() {
    if (typeof window !== 'undefined') {
      this.context = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }

  private createTone(frequency: number, duration: number, type: OscillatorType = 'sine'): void {
    if (!this.context) return;

    const oscillator = this.context.createOscillator();
    const gainNode = this.context.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.context.destination);

    oscillator.frequency.setValueAtTime(frequency, this.context.currentTime);
    oscillator.type = type;

    gainNode.gain.setValueAtTime(0, this.context.currentTime);
    gainNode.gain.linearRampToValueAtTime(this.masterVolume, this.context.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + duration);

    oscillator.start(this.context.currentTime);
    oscillator.stop(this.context.currentTime + duration);
  }

  playFlipSound(): void {
    this.createTone(200, 0.3, 'square');
  }

  playLandSound(): void {
    this.createTone(150, 0.2, 'sine');
  }

  playSuccessSound(): void {
    this.createTone(523, 0.1, 'sine');
    setTimeout(() => this.createTone(659, 0.1, 'sine'), 100);
    setTimeout(() => this.createTone(784, 0.2, 'sine'), 200);
  }

  playFailSound(): void {
    this.createTone(200, 0.5, 'sawtooth');
  }

  playMenuSound(): void {
    this.createTone(400, 0.1, 'sine');
  }

  playLevelCompleteSound(): void {
    const notes = [523, 587, 659, 698, 784, 880, 987];
    notes.forEach((note, index) => {
      setTimeout(() => this.createTone(note, 0.3, 'sine'), index * 100);
    });
  }
}

// SVG Bottle Component
const SVGBottle: React.FC<{ bottle: Bottle; size?: number; className?: string }> = ({ 
  bottle, 
  size = 100, 
  className = "" 
}) => (
  <svg
    width={size}
    height={size * 1.5}
    viewBox="0 0 100 150"
    className={className}
    style={{ filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.3))' }}
  >
    {/* Bottle body */}
    <path
      d="M35 30 L35 90 Q35 100 45 100 L55 100 Q65 100 65 90 L65 30 Q65 25 60 25 L40 25 Q35 25 35 30 Z"
      fill={bottle.color}
      stroke="#000"
      strokeWidth="2"
    />
    
    {/* Bottle neck */}
    <rect
      x="42"
      y="10"
      width="16"
      height="20"
      fill={bottle.color}
      stroke="#000"
      strokeWidth="2"
      rx="2"
    />
    
    {/* Bottle cap */}
    <rect
      x="40"
      y="5"
      width="20"
      height="12"
      fill={bottle.capColor}
      stroke="#000"
      strokeWidth="2"
      rx="6"
    />
    
    {/* Label */}
    <rect
      x="38"
      y="45"
      width="24"
      height="30"
      fill="rgba(255,255,255,0.9)"
      stroke="#000"
      strokeWidth="1"
      rx="2"
    />
    
    {/* Brand text */}
    <text
      x="50"
      y="62"
      textAnchor="middle"
      fontSize="8"
      fontWeight="bold"
      fill="#000"
    >
      {bottle.name.split(' ')[0]}
    </text>
    
    {/* Shine effect */}
    <ellipse
      cx="45"
      cy="40"
      rx="8"
      ry="15"
      fill="rgba(255,255,255,0.3)"
    />
  </svg>
);

const GameComponent = () => {
  // Game state
  const [gameState, setGameState] = useState<GameState>("menu");
  const [selectedBottle, setSelectedBottle] = useState<Bottle>(bottles[0]);
  const [currentLevel, setCurrentLevel] = useState<Level>(levels[0]);
  const [unlockedBottles, setUnlockedBottles] = useState<Set<string>>(new Set(["coke"]));
  const [unlockedLevels, setUnlockedLevels] = useState<Set<number>>(new Set([1]));
  
  // Responsive dimensions
  const [gameArea, setGameArea] = useState({ width: 400, height: 600 });
  
  // Game mechanics
  const [physicsBottle, setPhysicsBottle] = useState<PhysicsBottle>({
    position: { x: 0.5, y: 0.15 }, // Using relative positions (0-1)
    velocity: { x: 0, y: 0 },
    rotation: 0,
    angularVelocity: 0,
    isFlipping: false,
    hasLanded: false,
    landedUpright: false
  });
  
  // Scoring and progress
  const [score, setScore] = useState(0);
  const [flipsUsed, setFlipsUsed] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  
  // Animation and effects
  const [particles, setParticles] = useState<Array<{
    id: string;
    position: Vector2;
    velocity: Vector2;
    life: number;
    color: string;
  }>>([]);
  
  // Refs
  const gameCanvasRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number>();
  const soundManager = useRef(new SoundManager());
  const lastTimeRef = useRef<number>(0);

  // Dynamic physics constants based on screen size
  const GRAVITY = 0.5;
  const GROUND_Y_RATIO = 0.85; // 85% from top
  const BOUNCE_DAMPING = 0.7;
  const ANGULAR_DAMPING = 0.98;
  const UPRIGHT_TOLERANCE = 0.3;

  // Update game area dimensions
  useEffect(() => {
    const updateDimensions = () => {
      if (gameCanvasRef.current) {
        const rect = gameCanvasRef.current.getBoundingClientRect();
        setGameArea({
          width: rect.width,
          height: rect.height
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, [gameState]);

  // Initialize game
  useEffect(() => {
    const gameLoop = (currentTime: number) => {
      const deltaTime = currentTime - lastTimeRef.current;
      lastTimeRef.current = currentTime;
      
      if (gameState === "playing") {
        updatePhysics(deltaTime);
        updateObstacles(deltaTime);
        updateParticles(deltaTime);
        updateTimer(deltaTime);
      }
      
      animationFrameRef.current = requestAnimationFrame(gameLoop);
    };
    
    animationFrameRef.current = requestAnimationFrame(gameLoop);
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [gameState]);

  // Physics simulation
  const updatePhysics = useCallback((deltaTime: number) => {
    setPhysicsBottle(prev => {
      if (!prev.isFlipping) return prev;
      
      const newBottle = { ...prev };
      const groundY = gameArea.height * GROUND_Y_RATIO;
      
      // Apply gravity
      newBottle.velocity.y += GRAVITY;
      
      // Update position (convert relative to absolute for physics)
      const absolutePos = {
        x: prev.position.x * gameArea.width,
        y: prev.position.y * gameArea.height
      };
      
      absolutePos.x += newBottle.velocity.x * (deltaTime / 16);
      absolutePos.y += newBottle.velocity.y * (deltaTime / 16);
      
      // Convert back to relative
      newBottle.position = {
        x: absolutePos.x / gameArea.width,
        y: absolutePos.y / gameArea.height
      };
      
      // Update rotation
      newBottle.rotation += newBottle.angularVelocity * (deltaTime / 16);
      newBottle.angularVelocity *= ANGULAR_DAMPING;
      
      // Ground collision
      if (absolutePos.y >= groundY && newBottle.velocity.y > 0) {
        newBottle.position.y = groundY / gameArea.height;
        newBottle.velocity.y *= -BOUNCE_DAMPING;
        newBottle.velocity.x *= 0.8;
        
        // Check if bottle has settled
        if (Math.abs(newBottle.velocity.y) < 2 && Math.abs(newBottle.velocity.x) < 1) {
          newBottle.isFlipping = false;
          newBottle.hasLanded = true;
          newBottle.velocity = { x: 0, y: 0 };
          
          // Check if landed upright
          const normalizedRotation = ((newBottle.rotation % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
          const isUpright = normalizedRotation < UPRIGHT_TOLERANCE || normalizedRotation > (Math.PI * 2 - UPRIGHT_TOLERANCE);
          
          newBottle.landedUpright = isUpright;
          
          // Handle landing result
          setTimeout(() => handleLanding(isUpright), 100);
        }
        
        soundManager.current.playLandSound();
      }
      
      // Wall collisions
      if (newBottle.position.x <= 0 || newBottle.position.x >= 1) {
        newBottle.velocity.x *= -0.8;
        newBottle.position.x = Math.max(0, Math.min(1, newBottle.position.x));
      }
      
      return newBottle;
    });
  }, [gameArea]);

  // Update moving obstacles
  const updateObstacles = useCallback((deltaTime: number) => {
    // This would update moving/rotating obstacles
    // Implementation depends on obstacle system complexity
  }, []);

  // Update particle effects
  const updateParticles = useCallback((deltaTime: number) => {
    setParticles(prev => prev
      .map(particle => ({
        ...particle,
        position: {
          x: particle.position.x + particle.velocity.x * (deltaTime / 16),
          y: particle.position.y + particle.velocity.y * (deltaTime / 16)
        },
        life: particle.life - (deltaTime / 1000)
      }))
      .filter(particle => particle.life > 0)
    );
  }, []);

  // Update timer
  const updateTimer = useCallback((deltaTime: number) => {
    if (currentLevel.timeLimit && timeLeft !== null) {
      setTimeLeft(prev => {
        if (prev === null) return null;
        const newTime = prev - (deltaTime / 1000);
        if (newTime <= 0) {
          handleGameOver();
          return 0;
        }
        return newTime;
      });
    }
  }, [currentLevel.timeLimit]);

  // Game actions
  const flipBottle = useCallback(() => {
    if (physicsBottle.isFlipping || flipsUsed >= currentLevel.maxFlips) return;
    
    const power = selectedBottle.flipPower;
    const flipStrength = 8 + Math.random() * 4;
    const spinStrength = 0.2 + Math.random() * 0.1;
    
    setPhysicsBottle(prev => ({
      ...prev,
      velocity: {
        x: (Math.random() - 0.5) * 2,
        y: -flipStrength * power
      },
      angularVelocity: (Math.random() - 0.5) * spinStrength,
      isFlipping: true,
      hasLanded: false,
      landedUpright: false
    }));
    
    setFlipsUsed(prev => prev + 1);
    soundManager.current.playFlipSound();
  }, [physicsBottle.isFlipping, flipsUsed, currentLevel.maxFlips, selectedBottle.flipPower]);

  // Handle landing result
  const handleLanding = useCallback((success: boolean) => {
    if (success) {
      const comboBonus = combo + 1;
      const points = 10 * comboBonus;
      
      setScore(prev => prev + points);
      setCombo(prev => prev + 1);
      setBestCombo(prev => Math.max(prev, combo + 1));
      
      // Create success particles
      createParticles({
        x: physicsBottle.position.x * gameArea.width,
        y: physicsBottle.position.y * gameArea.height
      }, "#10B981", 15);
      
      soundManager.current.playSuccessSound();
      toast.success(`Perfect flip! +${points} points (${comboBonus}x combo)`, {
        duration: 2000,
      });
      
      // Check level completion
      if (score + points >= currentLevel.targetScore) {
        setTimeout(() => handleLevelComplete(), 1000);
      }
    } else {
      setCombo(0);
      createParticles({
        x: physicsBottle.position.x * gameArea.width,
        y: physicsBottle.position.y * gameArea.height
      }, "#EF4444", 10);
      soundManager.current.playFailSound();
      toast.error("Bottle fell over! Combo broken!", {
        duration: 2000,
      });
    }
    
    // Check game over
    if (flipsUsed >= currentLevel.maxFlips && score < currentLevel.targetScore) {
      setTimeout(() => handleGameOver(), 1500);
    }
  }, [combo, physicsBottle.position, score, currentLevel, flipsUsed, gameArea]);

  // Create particle effects
  const createParticles = useCallback((position: Vector2, color: string, count: number) => {
    const newParticles = Array.from({ length: count }, (_, i) => ({
      id: `particle-${Date.now()}-${i}`,
      position: { ...position },
      velocity: {
        x: (Math.random() - 0.5) * 200,
        y: (Math.random() - 0.5) * 200 - 100
      },
      life: 1 + Math.random(),
      color
    }));
    
    setParticles(prev => [...prev, ...newParticles]);
  }, []);

  // Game state handlers
  const startLevel = useCallback((level: Level) => {
    setCurrentLevel(level);
    setGameState("playing");
    setScore(0);
    setFlipsUsed(0);
    setCombo(0);
    setTimeLeft(level.timeLimit || null);
    setPhysicsBottle({
      position: { x: 0.5, y: 0.15 }, // Center horizontally, 15% from top
      velocity: { x: 0, y: 0 },
      rotation: 0,
      angularVelocity: 0,
      isFlipping: false,
      hasLanded: false,
      landedUpright: false
    });
    setParticles([]);
  }, []);

  const handleLevelComplete = useCallback(() => {
    setGameState("levelComplete");
    soundManager.current.playLevelCompleteSound();
    
    // Unlock next level
    const nextLevelId = currentLevel.id + 1;
    if (nextLevelId <= levels.length) {
      setUnlockedLevels(prev => new Set([...prev, nextLevelId]));
    }
    
    // Unlock bottles based on progress
    if (currentLevel.id >= 2 && !unlockedBottles.has("sprite")) {
      setUnlockedBottles(prev => new Set([...prev, "sprite"]));
      toast.success("🥤 Sprite bottle unlocked!");
    }
    if (currentLevel.id >= 4 && !unlockedBottles.has("fanta")) {
      setUnlockedBottles(prev => new Set([...prev, "fanta"]));
      toast.success("🍊 Fanta bottle unlocked!");
    }
    
    toast.success(`Level ${currentLevel.id} completed! 🎉`, {
      duration: 3000,
    });
  }, [currentLevel, unlockedBottles]);

  const handleGameOver = useCallback(() => {
    setGameState("gameOver");
    toast.error("Game Over! Better luck next time!", {
      duration: 3000,
    });
  }, []);

  const resetToMenu = useCallback(() => {
    setGameState("menu");
    soundManager.current.playMenuSound();
  }, []);

  // Menu Screen
  if (gameState === "menu") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center p-2 sm:p-4">
        <div className="max-w-6xl w-full">
          {/* Title */}
          <div className="text-center mb-6 sm:mb-12">
            <h1 className="text-3xl sm:text-6xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent mb-2 sm:mb-4">
              🍾 Bottle Flip Mania
            </h1>
            <p className="text-sm sm:text-xl text-muted-foreground">
              Master the perfect flip across challenging levels!
            </p>
          </div>

          {/* Bottle Selection */}
          <div className="mb-6 sm:mb-12">
            <h2 className="text-xl sm:text-2xl font-bold text-center mb-4 sm:mb-6">Choose Your Bottle</h2>
            <div className="grid grid-cols-3 sm:grid-cols-1 md:grid-cols-3 gap-2 sm:gap-6">
              {bottles.map((bottle) => (
                <Card
                  key={bottle.id}
                  className={`relative overflow-hidden cursor-pointer transform transition-all duration-300 hover:scale-105 ${
                    selectedBottle.id === bottle.id ? 'ring-2 sm:ring-4 ring-primary' : ''
                  } ${
                    unlockedBottles.has(bottle.id) ? 'opacity-100' : 'opacity-50'
                  }`}
                  onClick={() => {
                    if (unlockedBottles.has(bottle.id)) {
                      setSelectedBottle(bottle);
                      soundManager.current.playMenuSound();
                    }
                  }}
                >
                  <div className="p-2 sm:p-8 text-center">
                    <div className="mb-2 sm:mb-6 flex justify-center">
                      <SVGBottle bottle={bottle} size={window.innerWidth < 640 ? 50 : 80} />
                    </div>
                    <h3 className="text-sm sm:text-xl font-bold mb-1 sm:mb-2">{bottle.name}</h3>
                    <div className="text-xs sm:text-sm text-muted-foreground mb-2 sm:mb-4">
                      <div>Power: {bottle.flipPower}x</div>
                      <div>Stability: {bottle.stability}x</div>
                    </div>
                    {!unlockedBottles.has(bottle.id) && (
                      <div className="text-xs sm:text-sm font-semibold text-destructive">🔒 Locked</div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* Level Selection */}
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-center mb-4 sm:mb-6">Select Level</h2>
            <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4">
              {levels.map((level) => (
                <Card
                  key={level.id}
                  className={`cursor-pointer transform transition-all duration-300 hover:scale-105 ${
                    unlockedLevels.has(level.id) ? 'opacity-100' : 'opacity-50'
                  }`}
                  onClick={() => {
                    if (unlockedLevels.has(level.id)) {
                      startLevel(level);
                    }
                  }}
                >
                  <div className="p-3 sm:p-6">
                    <div className="flex items-center justify-between mb-2 sm:mb-4">
                      <h3 className="text-sm sm:text-lg font-bold">{level.name}</h3>
                      <div className="text-xs sm:text-sm bg-primary/20 px-2 py-1 rounded">
                        Level {level.id}
                      </div>
                    </div>
                    <div className="text-xs sm:text-sm text-muted-foreground space-y-1">
                      <div>🎯 Target: {level.targetScore} points</div>
                      <div>🍾 Max flips: {level.maxFlips}</div>
                      {level.timeLimit && <div>⏱️ Time: {level.timeLimit}s</div>}
                    </div>
                    {!unlockedLevels.has(level.id) && (
                      <div className="mt-2 text-xs sm:text-sm font-semibold text-destructive">🔒 Locked</div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Game Screen
  if (gameState === "playing") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/20 to-secondary/20 flex flex-col">
        {/* Header */}
        <header className="p-2 sm:p-4 border-b border-border/20 bg-card/50 backdrop-blur-sm">
          <div className="flex items-center justify-between max-w-6xl mx-auto">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              <SVGBottle bottle={selectedBottle} size={30} className="sm:w-10 sm:h-15 flex-shrink-0" />
              <div className="min-w-0">
                <h2 className="text-sm sm:text-xl font-bold truncate">{currentLevel.name}</h2>
                <p className="text-xs sm:text-sm text-muted-foreground">Level {currentLevel.id}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-6">
              <div className="text-center min-w-0">
                <div className="text-sm sm:text-2xl font-bold text-primary">{score}</div>
                <div className="text-xs text-muted-foreground hidden sm:block">Score</div>
              </div>
              <div className="text-center min-w-0">
                <div className="text-sm sm:text-2xl font-bold">{currentLevel.maxFlips - flipsUsed}</div>
                <div className="text-xs text-muted-foreground hidden sm:block">Flips</div>
              </div>
              <div className="text-center min-w-0">
                <div className="text-sm sm:text-2xl font-bold text-secondary">{combo}</div>
                <div className="text-xs text-muted-foreground hidden sm:block">Combo</div>
              </div>
              {timeLeft !== null && (
                <div className="text-center min-w-0">
                  <div className={`text-sm sm:text-2xl font-bold ${timeLeft < 10 ? 'text-destructive' : ''}`}>
                    {Math.ceil(timeLeft)}
                  </div>
                  <div className="text-xs text-muted-foreground hidden sm:block">Time</div>
                </div>
              )}
              <Button variant="outline" onClick={resetToMenu} size="sm" className="text-xs sm:text-sm">
                Menu
              </Button>
            </div>
          </div>
        </header>

        {/* Game Area */}
        <main className="flex-1 relative overflow-hidden" ref={gameCanvasRef}>
          {/* Game Canvas */}
          <div className="absolute inset-0 bg-gradient-to-b from-sky-200 to-green-200">
            {/* Ground */}
            <div 
              className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-green-600 to-green-400"
              style={{ height: `${gameArea.height * (1 - GROUND_Y_RATIO)}px` }}
            />
            
            {/* Obstacles */}
            {currentLevel.obstacles.map(obstacle => (
              <div
                key={obstacle.id}
                className="absolute bg-gradient-to-br from-stone-400 to-stone-600 shadow-lg"
                style={{
                  left: `${(obstacle.position.x / 600) * gameArea.width}px`,
                  top: `${(obstacle.position.y / 600) * gameArea.height}px`,
                  width: `${(obstacle.size.x / 600) * gameArea.width}px`,
                  height: `${(obstacle.size.y / 600) * gameArea.height}px`,
                  transform: obstacle.rotation ? `rotate(${obstacle.rotation}rad)` : undefined
                }}
              />
            ))}
            
            {/* Bottle */}
            <div
              className="absolute transition-none pointer-events-none"
              style={{
                left: `${physicsBottle.position.x * gameArea.width - 25}px`,
                top: `${physicsBottle.position.y * gameArea.height - 60}px`,
                transform: `rotate(${physicsBottle.rotation}rad)`,
                zIndex: 10
              }}
            >
              <SVGBottle 
                bottle={selectedBottle} 
                size={Math.min(50, gameArea.width * 0.12)} 
                className={physicsBottle.landedUpright ? 'animate-bounce' : ''}
              />
            </div>
            
            {/* Particles */}
            {particles.map(particle => (
              <div
                key={particle.id}
                className="absolute w-2 h-2 rounded-full pointer-events-none"
                style={{
                  left: particle.position.x,
                  top: particle.position.y,
                  backgroundColor: particle.color,
                  opacity: particle.life,
                  transform: `scale(${particle.life})`
                }}
              />
            ))}
          </div>

          {/* Controls */}
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
            <Button
              size="lg"
              className="text-base sm:text-lg px-6 sm:px-8 py-3 sm:py-4 bg-gradient-to-r from-primary to-secondary hover:scale-105 transform transition-all duration-200 touch-none"
              onClick={flipBottle}
              disabled={physicsBottle.isFlipping || flipsUsed >= currentLevel.maxFlips}
            >
              {physicsBottle.isFlipping ? '🌪️ Flipping...' : '🍾 Flip Bottle!'}
            </Button>
          </div>

          {/* Progress Bar */}
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 w-80 max-w-[90vw]">
            <div className="bg-card/50 backdrop-blur-sm rounded-full p-2">
              <div className="flex items-center justify-between text-sm mb-2">
                <span>Progress</span>
                <span>{score}/{currentLevel.targetScore}</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div 
                  className="bg-gradient-to-r from-primary to-secondary h-2 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, (score / currentLevel.targetScore) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Level Complete Screen
  if (gameState === "levelComplete") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center p-4">
        <Card className="max-w-sm sm:max-w-md w-full p-4 sm:p-8 text-center">
          <div className="text-4xl sm:text-6xl mb-4">🎉</div>
          <h1 className="text-2xl sm:text-3xl font-bold mb-4">Level Complete!</h1>
          <div className="space-y-2 mb-6">
            <div className="text-sm sm:text-lg">Final Score: <span className="font-bold text-primary">{score}</span></div>
            <div className="text-sm sm:text-lg">Best Combo: <span className="font-bold text-secondary">{bestCombo}</span></div>
            <div className="text-sm sm:text-lg">Flips Used: <span className="font-bold">{flipsUsed}/{currentLevel.maxFlips}</span></div>
          </div>
          <div className="space-y-3">
            <Button 
              onClick={resetToMenu} 
              className="w-full"
              size="lg"
            >
              Back to Menu
            </Button>
            {currentLevel.id < levels.length && (
              <Button 
                onClick={() => startLevel(levels[currentLevel.id])} 
                variant="outline"
                className="w-full"
                size="lg"
              >
                Next Level
              </Button>
            )}
          </div>
        </Card>
      </div>
    );
  }

  // Game Over Screen
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center p-4">
      <Card className="max-w-sm sm:max-w-md w-full p-4 sm:p-8 text-center">
        <div className="text-4xl sm:text-6xl mb-4">💥</div>
        <h1 className="text-2xl sm:text-3xl font-bold mb-4">Game Over!</h1>
        <div className="space-y-2 mb-6">
          <div className="text-sm sm:text-lg">Final Score: <span className="font-bold text-primary">{score}</span></div>
          <div className="text-sm sm:text-lg">Target: <span className="font-bold">{currentLevel.targetScore}</span></div>
          <div className="text-sm sm:text-lg">Best Combo: <span className="font-bold text-secondary">{bestCombo}</span></div>
        </div>
        <div className="space-y-3">
          <Button 
            onClick={() => startLevel(currentLevel)} 
            className="w-full"
            size="lg"
          >
            Try Again
          </Button>
          <Button 
            onClick={resetToMenu} 
            variant="outline"
            className="w-full"
            size="lg"
          >
            Back to Menu
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default GameComponent;