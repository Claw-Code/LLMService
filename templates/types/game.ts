/**
 * SIMPLIFIED GAME TYPE DEFINITIONS
 *
 * TypeScript interfaces for single-page game architecture
 */

/**
 * Game Phase Types
 * Represents the current state/phase of the game
 */
export type GamePhase = "menu" | "playing" | "paused" | "gameOver"

/**
 * Game State Interface
 * Represents the current state of the game
 */
export interface GameState {
  score: number // Current score
  highScore: number // Best score achieved
  lives: number // Lives remaining
  level: number // Current level
  gameOver: boolean // Game over flag
  paused: boolean // Pause state
  time?: number // Game time (optional)
}

/**
 * Game Configuration Interface
 * Defines the basic setup parameters for the game
 */
export interface GameConfig {
  width: number
  height: number
  backgroundColor: string
  physics?: {
    gravity: number
    friction: number
  }
}

/**
 * 2D Vector Interface
 * Used for positions, velocities, and directions
 */
export interface Vector2D {
  x: number
  y: number
}

/**
 * Game Object Interface
 * Base interface for all interactive objects in the game
 */
export interface GameObject {
  id: string // Unique identifier
  x: number // X position
  y: number // Y position
  width: number // Object width
  height: number // Object height
  active: boolean // Whether object is active/visible
  type?: string // Object type (player, enemy, collectible, etc.)
  velocity?: Vector2D // Movement velocity
  rotation?: number // Rotation angle
  scale?: number // Scale factor
  health?: number // Health points
  speed?: number // Movement speed
  color?: string // Object color
  sprite?: string // Sprite/texture name
}

/**
 * Player Interface
 * Extends GameObject with player-specific properties
 */
export interface Player extends GameObject {
  lives: number // Number of lives remaining
  score: number // Current score
  level: number // Current level
  powerUps?: string[] // Active power-ups
  inventory?: string[] // Player inventory
}

/**
 * Input State Interface
 * Tracks the current state of all input controls
 */
export interface InputState {
  // Movement keys
  up: boolean // W key or up arrow
  down: boolean // S key or down arrow
  left: boolean // A key or left arrow
  right: boolean // D key or right arrow

  // Action keys
  action: boolean // Space key or Enter
  jump: boolean // Space key (alternative)
  shoot: boolean // Mouse click or action key

  // Mouse/Touch input
  mouseX?: number // Mouse X position
  mouseY?: number // Mouse Y position
  mouseDown?: boolean // Mouse button state
  touchX?: number // Touch X position
  touchY?: number // Touch Y position
  touchActive?: boolean // Touch state
}

/**
 * Game Settings Interface
 * User preferences and configuration options
 */
export interface GameSettings {
  difficulty: "easy" | "medium" | "hard" // Difficulty level
  soundEnabled: boolean // Sound effects on/off
  musicEnabled: boolean // Background music on/off
  graphics: "low" | "medium" | "high" // Graphics quality
  controls: "keyboard" | "touch" | "gamepad" // Control scheme
  volume: number // Master volume (0-1)
}

/**
 * Rectangle Interface
 * Represents a rectangular area
 */
export interface Rectangle {
  x: number // X position
  y: number // Y position
  width: number // Width
  height: number // Height
}

/**
 * Circle Interface
 * Represents a circular area
 */
export interface Circle {
  x: number // Center X position
  y: number // Center Y position
  radius: number // Radius
}

/**
 * Color Interface
 * Represents a color with different formats
 */
export interface Color {
  r: number // Red (0-255)
  g: number // Green (0-255)
  b: number // Blue (0-255)
  a?: number // Alpha (0-1, optional)
  hex?: string // Hex representation
  hsl?: string // HSL representation
}
