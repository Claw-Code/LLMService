import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { localStorage } from "window"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * GAME UTILITY FUNCTIONS
 *
 * Collection of utility functions commonly used in game development
 */

export const gameUtils = {
  /**
   * Generate random integer between min and max (inclusive)
   */
  randomInt: (min: number, max: number): number => Math.floor(Math.random() * (max - min + 1)) + min,

  /**
   * Generate random float between min and max
   */
  randomFloat: (min: number, max: number): number => Math.random() * (max - min) + min,

  /**
   * Clamp a value between min and max
   */
  clamp: (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value)),

  /**
   * Calculate distance between two points
   */
  distance: (x1: number, y1: number, x2: number, y2: number): number => Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2),

  /**
   * Calculate distance between two points in 3D
   */
  distance3D: (x1: number, y1: number, z1: number, x2: number, y2: number, z2: number): number =>
    Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2 + (z2 - z1) ** 2),

  /**
   * Linear interpolation between two values
   */
  lerp: (start: number, end: number, factor: number): number => start + (end - start) * factor,

  /**
   * Normalize a 2D vector
   */
  normalize: (x: number, y: number): { x: number; y: number } => {
    const length = Math.sqrt(x * x + y * y)
    return length > 0 ? { x: x / length, y: y / length } : { x: 0, y: 0 }
  },

  /**
   * Convert radians to degrees
   */
  radToDeg: (radians: number): number => radians * (180 / Math.PI),

  /**
   * Convert degrees to radians
   */
  degToRad: (degrees: number): number => degrees * (Math.PI / 180),

  /**
   * Format score with commas
   */
  formatScore: (score: number): string => score.toLocaleString(),

  /**
   * Format time in MM:SS format
   */
  formatTime: (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, "0")}`
  },

  /**
   * Check if two rectangles are colliding
   */
  rectCollision: (
    x1: number,
    y1: number,
    w1: number,
    h1: number,
    x2: number,
    y2: number,
    w2: number,
    h2: number,
  ): boolean => {
    return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2
  },

  /**
   * Check if a point is inside a rectangle
   */
  pointInRect: (px: number, py: number, rx: number, ry: number, rw: number, rh: number): boolean => {
    return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh
  },

  /**
   * Check if two circles are colliding
   */
  circleCollision: (x1: number, y1: number, r1: number, x2: number, y2: number, r2: number): boolean => {
    const distance = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
    return distance < r1 + r2
  },

  /**
   * Generate a unique ID
   */
  generateId: (): string => {
    return Math.random().toString(36).substr(2, 9)
  },

  /**
   * Debounce function calls
   */
  debounce: <T extends (...args: any[]) => any>(func: T, wait: number): T => {
    let timeout: NodeJS.Timeout
    return ((...args: any[]) => {
      clearTimeout(timeout)
      timeout = setTimeout(() => func.apply(null, args), wait)
    }) as T
  },

  /**
   * Throttle function calls
   */
  throttle: <T extends (...args: any[]) => any>(func: T, limit: number): T => {
    let inThrottle: boolean
    return ((...args: any[]) => {
      if (!inThrottle) {
        func.apply(null, args)
        inThrottle = true
        setTimeout(() => (inThrottle = false), limit)
      }
    }) as T
  },
}

/**
 * LOCAL STORAGE UTILITIES
 *
 * Safe localStorage operations with fallbacks
 */
export const storage = {
  /**
   * Get item from localStorage with fallback
   */
  getItem: (key: string, fallback = ""): string => {
    try {
      return localStorage.getItem(key) || fallback
    } catch {
      return fallback
    }
  },

  /**
   * Set item in localStorage safely
   */
  setItem: (key: string, value: string): boolean => {
    try {
      localStorage.setItem(key, value)
      return true
    } catch {
      return false
    }
  },

  /**
   * Get JSON from localStorage with fallback
   */
  getJSON: <T>(key: string, fallback: T): T => {\
    try {\
      const item = localStorage.getItem(key)
      return item ? JSON.parse(item) : fallback
    } catch {\
      return fallback
    }
  },

  /**
   * Set JSON in localStorage safely
   */
  setJSON: (key: string, value: any): boolean => {\
    try {
      localStorage.setItem(key, JSON.stringify(value))\
      return true
    } catch {\
      return false
    }
  }\
}
