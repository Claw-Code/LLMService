export interface GameConfig {
    width: number
    height: number
    backgroundColor: string
    physics?: {
      default: string
      arcade?: {
        gravity: { y: number }
        debug: boolean
      }
    }
  }
  
  export interface Vector3D {
    x: number
    y: number
    z: number
  }
  
  export interface GameObject {
    id: string
    x: number
    y: number
    z?: number
    width: number
    height: number
    depth?: number
    active: boolean
    type?: string
    velocity?: Vector3D
    rotation?: Vector3D
    scale?: Vector3D
    health?: number
    speed?: number
    color?: string
    material?: string
  }
  
  export interface Player extends GameObject {
    lives: number
    score: number
    level: number
    powerUps?: string[]
  }
  
  export interface GameState {
    score: number
    level: number
    gameOver: boolean
    paused: boolean
    lives: number
    highScore: number
    time?: number
    powerUps?: string[]
  }
  
  export interface InputState {
    forward: boolean
    backward: boolean
    left: boolean
    right: boolean
    jump: boolean
    action: boolean
    mouseX?: number
    mouseY?: number
    touchX?: number
    touchY?: number
  }
  
  export interface GameSettings {
    difficulty: "easy" | "medium" | "hard"
    soundEnabled: boolean
    musicEnabled: boolean
    graphics: "low" | "medium" | "high"
    controls: "keyboard" | "touch" | "gamepad"
  }
  
  export interface GameEvent {
    type: string
    data: any
    timestamp: number
  }
  
  // Audio interfaces
  export interface SoundEffect {
    name: string
    url: string
    volume: number
    loop: boolean
  }
  
  export interface AudioManager {
    playSound(name: string): void
    stopSound(name: string): void
    setVolume(volume: number): void
    loadSound(sound: SoundEffect): Promise<void>
  }
  
  // Physics interfaces
  export interface PhysicsBody {
    position: Vector3D
    velocity: Vector3D
    acceleration: Vector3D
    mass: number
    friction: number
    restitution: number
  }
  
  export interface Collision {
    objectA: GameObject
    objectB: GameObject
    point: Vector3D
    normal: Vector3D
    penetration: number
  }
  