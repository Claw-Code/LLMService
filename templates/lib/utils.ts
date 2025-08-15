import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { localStorage } from "window"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * GAME UTILITY FUNCTIONS
 *
 * Collection of utility functions for single-page game development
 */
export const gameUtils = {
  /**
   * Generate random integer between min and max (inclusive)
   */
  randomInt: (min: number, max: number): number => Math.floor(Math.random() * (max - min + 1)) + min,

  /**
   * Clamp a value between min and max
   */
  clamp: (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value)),

  /**
   * Calculate distance between two points
   */
  distance: (x1: number, y1: number, x2: number, y2: number): number => Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2),

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
