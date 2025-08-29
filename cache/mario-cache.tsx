"use client"
import React, { useEffect, useRef, useState, useCallback } from 'react';

export default function GameComponent() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [gameMode, setGameMode] = useState<"game" | "editor">("game")
  const [selectedTool, setSelectedTool] = useState<"platform" | "enemy" | "coin" | "powerUp" | "goal" | "erase">(
    "platform",
  )

  const gameStateRef = useRef({
    currentLevel: 1,
    levelComplete: false,
    showResults: false,
    mode: "game" as "game" | "editor",
    player: {
      x: 50,
      y: 300,
      width: 20,
      height: 20,
      velocityX: 0,
      velocityY: 0,
      speed: 3, // Reduced from 5 to 3
      jumpPower: 10, // Reduced from 12 to 10
      onGround: false,
      wasOnGround: false,
      color: "#ff4444",
      wallSliding: false,
      wallSlideDirection: 0,
      animFrame: 0,
      animTimer: 0,
      facing: 1,
      powerUp: "normal" as "normal" | "super" | "fire",
      invulnerable: 0,
      fireballCooldown: 0,
    },
    enemies: [] as any[],
    coins: [] as any[],
    powerUps: [] as any[],
    platforms: [] as any[],
    fireballs: [] as any[],
    boss: null as any,
    goal: { x: 750, y: 320, width: 30, height: 40, color: "#ffd700" },
    clouds: [
      { x: 100, y: 50, speed: 0.1, size: 1 }, // Reduced cloud speed
      { x: 300, y: 80, speed: 0.08, size: 1.2 },
      { x: 500, y: 40, speed: 0.12, size: 0.8 },
      { x: 700, y: 70, speed: 0.09, size: 1.1 },
    ],
    backgroundLayers: [
      { x: 0, speed: 0.05, color: "#4a90e2" }, // Reduced background speeds
      { x: 0, speed: 0.15, color: "#5ba0f2" },
      { x: 0, speed: 0.25, color: "#6bb0ff" },
    ],
    keys: {},
    gameWon: false,
    gameOver: false,
    camera: { x: 0, y: 0 },
    score: 0,
    lives: 3,
    particles: [] as Array<{
      x: number
      y: number
      velocityX: number
      velocityY: number
      life: number
      maxLife: number
      color: string
      size: number
      type: "coin" | "enemy" | "landing" | "wallSlide" | "powerUp" | "boss"
    }>,
    playerTrail: [] as Array<{
      x: number
      y: number
      age: number
      maxAge: number
      type: "normal" | "jump"
    }>,
    editor: {
      selectedTool: "platform" as "platform" | "enemy" | "coin" | "powerUp" | "goal" | "erase",
      mouseX: 0,
      mouseY: 0,
      isDragging: false,
    },
  })

  const [gameStatus, setGameStatus] = useState<"playing" | "won" | "lost" | "results">("playing")

  // Comprehensive level configurations (12 levels + boss levels)
  const levels = {
    1: {
      enemies: [
        {
          x: 200,
          y: 340,
          width: 15,
          height: 15,
          velocityX: 0.8, // Reduced enemy speeds
          color: "#8b4513",
          minX: 180,
          maxX: 280,
          animFrame: 0,
          animTimer: 0,
        },
        {
          x: 400,
          y: 290,
          width: 15,
          height: 15,
          velocityX: -0.8,
          color: "#8b4513",
          minX: 350,
          maxX: 500,
          animFrame: 0,
          animTimer: 0,
        },
      ],
      coins: [
        { x: 120, y: 270, width: 12, height: 12, collected: false, color: "#ffd700" },
        { x: 320, y: 210, width: 12, height: 12, collected: false, color: "#ffd700" },
        { x: 480, y: 160, width: 12, height: 12, collected: false, color: "#ffd700" },
      ],
      powerUps: [{ x: 250, y: 280, width: 16, height: 16, type: "mushroom", collected: false }],
      platforms: [
        { x: 0, y: 360, width: 800, height: 40, color: "#4a5d23", type: "ground" },
        { x: 150, y: 300, width: 100, height: 20, color: "#654321", type: "platform" },
        { x: 300, y: 250, width: 80, height: 20, color: "#654321", type: "platform" },
        { x: 450, y: 200, width: 100, height: 20, color: "#654321", type: "platform" },
      ],
      goal: { x: 750, y: 320, width: 30, height: 40, color: "#ffd700" },
    },
    2: {
      enemies: [
        {
          x: 150,
          y: 340,
          width: 15,
          height: 15,
          velocityX: 1,
          color: "#8b4513",
          minX: 100,
          maxX: 250,
          animFrame: 0,
          animTimer: 0,
        },
        {
          x: 350,
          y: 240,
          width: 15,
          height: 15,
          velocityX: -1.2,
          color: "#8b4513",
          minX: 300,
          maxX: 450,
          animFrame: 0,
          animTimer: 0,
        },
        {
          x: 550,
          y: 190,
          width: 15,
          height: 15,
          velocityX: 1.1,
          color: "#8b4513",
          minX: 500,
          maxX: 650,
          animFrame: 0,
          animTimer: 0,
        },
      ],
      coins: [
        { x: 80, y: 320, width: 12, height: 12, collected: false, color: "#ffd700" },
        { x: 200, y: 280, width: 12, height: 12, collected: false, color: "#ffd700" },
        { x: 400, y: 200, width: 12, height: 12, collected: false, color: "#ffd700" },
        { x: 580, y: 150, width: 12, height: 12, collected: false, color: "#ffd700" },
      ],
      powerUps: [{ x: 180, y: 260, width: 16, height: 16, type: "fireFlower", collected: false }],
      platforms: [
        { x: 0, y: 360, width: 900, height: 40, color: "#4a5d23", type: "ground" },
        { x: 100, y: 300, width: 80, height: 20, color: "#654321", type: "platform" },
        { x: 250, y: 260, width: 60, height: 20, color: "#654321", type: "platform" },
        { x: 350, y: 220, width: 100, height: 20, color: "#654321", type: "platform" },
        { x: 500, y: 170, width: 80, height: 20, color: "#654321", type: "platform" },
        { x: 750, y: 300, width: 100, height: 20, color: "#654321", type: "platform" },
      ],
      goal: { x: 820, y: 260, width: 30, height: 40, color: "#ffd700" },
    },
    3: {
      // Boss Level 1
      enemies: [],
      coins: [
        { x: 200, y: 300, width: 12, height: 12, collected: false, color: "#ffd700" },
        { x: 400, y: 250, width: 12, height: 12, collected: false, color: "#ffd700" },
        { x: 600, y: 200, width: 12, height: 12, collected: false, color: "#ffd700" },
      ],
      powerUps: [
        { x: 100, y: 320, width: 16, height: 16, type: "fireFlower", collected: false },
        { x: 700, y: 280, width: 16, height: 16, type: "star", collected: false },
      ],
      platforms: [
        { x: 0, y: 360, width: 800, height: 40, color: "#4a5d23", type: "ground" },
        { x: 150, y: 320, width: 100, height: 20, color: "#654321", type: "platform" },
        { x: 350, y: 280, width: 100, height: 20, color: "#654321", type: "platform" },
        { x: 550, y: 240, width: 100, height: 20, color: "#654321", type: "platform" },
      ],
      boss: {
        x: 600,
        y: 280,
        width: 40,
        height: 40,
        health: 5,
        maxHealth: 5,
        velocityX: 0.8, // Reduced boss speed
        minX: 500,
        maxX: 700,
        attackTimer: 0,
        animFrame: 0,
        animTimer: 0,
        type: "goombaKing",
        color: "#654321",
      },
      goal: { x: 750, y: 320, width: 30, height: 40, color: "#ffd700" },
    },
    4: {
      enemies: [
        {
          x: 120,
          y: 340,
          width: 15,
          height: 15,
          velocityX: 1.2,
          color: "#8b4513",
          minX: 80,
          maxX: 200,
          animFrame: 0,
          animTimer: 0,
        },
        {
          x: 280,
          y: 290,
          width: 15,
          height: 15,
          velocityX: -1,
          color: "#8b4513",
          minX: 250,
          maxX: 380,
          animFrame: 0,
          animTimer: 0,
        },
        {
          x: 480,
          y: 240,
          width: 15,
          height: 15,
          velocityX: 1.4,
          color: "#8b4513",
          minX: 450,
          maxX: 580,
          animFrame: 0,
          animTimer: 0,
        },
        {
          x: 680,
          y: 190,
          width: 15,
          height: 15,
          velocityX: -1.1,
          color: "#8b4513",
          minX: 650,
          maxX: 750,
          animFrame: 0,
          animTimer: 0,
        },
      ],
      coins: [
        { x: 140, y: 300, width: 12, height: 12, collected: false, color: "#ffd700" },
        { x: 300, y: 250, width: 12, height: 12, collected: false, color: "#ffd700" },
        { x: 500, y: 200, width: 12, height: 12, collected: false, color: "#ffd700" },
        { x: 700, y: 150, width: 12, height: 12, collected: false, color: "#ffd700" },
        { x: 600, y: 120, width: 12, height: 12, collected: false, color: "#ffd700" },
      ],
      powerUps: [
        { x: 320, y: 250, width: 16, height: 16, type: "mushroom", collected: false },
        { x: 520, y: 200, width: 16, height: 16, type: "fireFlower", collected: false },
      ],
      platforms: [
        { x: 0, y: 360, width: 800, height: 40, color: "#4a5d23", type: "ground" },
        { x: 80, y: 320, width: 120, height: 20, color: "#654321", type: "platform" },
        { x: 250, y: 270, width: 100, height: 20, color: "#654321", type: "platform" },
        { x: 400, y: 220, width: 80, height: 20, color: "#654321", type: "platform" },
        { x: 520, y: 170, width: 100, height: 20, color: "#654321", type: "platform" },
        { x: 650, y: 140, width: 80, height: 20, color: "#654321", type: "platform" },
      ],
      goal: { x: 750, y: 320, width: 30, height: 40, color: "#ffd700" },
    },
    5: {
      enemies: [
        {
          x: 100,
          y: 340,
          width: 15,
          height: 15,
          velocityX: 1.5,
          color: "#8b4513",
          minX: 50,
          maxX: 200,
          animFrame: 0,
          animTimer: 0,
        },
        {
          x: 300,
          y: 240,
          width: 15,
          height: 15,
          velocityX: -1.4,
          color: "#8b4513",
          minX: 250,
          maxX: 400,
          animFrame: 0,
          animTimer: 0,
        },
        {
          x: 500,
          y: 140,
          width: 15,
          height: 15,
          velocityX: 1.3,
          color: "#8b4513",
          minX: 450,
          maxX: 600,
          animFrame: 0,
          animTimer: 0,
        },
        {
          x: 700,
          y: 290,
          width: 15,
          height: 15,
          velocityX: -1.7,
          color: "#8b4513",
          minX: 650,
          maxX: 780,
          animFrame: 0,
          animTimer: 0,
        },
      ],
      coins: [
        { x: 150, y: 300, width: 12, height: 12, collected: false, color: "#ffd700" },
        { x: 250, y: 200, width: 12, height: 12, collected: false, color: "#ffd700" },
        { x: 350, y: 200, width: 12, height: 12, collected: false, color: "#ffd700" },
        { x: 450, y: 100, width: 12, height: 12, collected: false, color: "#ffd700" },
        { x: 550, y: 100, width: 12, height: 12, collected: false, color: "#ffd700" },
        { x: 720, y: 250, width: 12, height: 12, collected: false, color: "#ffd700" },
      ],
      powerUps: [
        { x: 180, y: 300, width: 16, height: 16, type: "star", collected: false },
        { x: 480, y: 100, width: 16, height: 16, type: "fireFlower", collected: false },
      ],
      platforms: [
        { x: 0, y: 360, width: 800, height: 40, color: "#4a5d23", type: "ground" },
        { x: 50, y: 320, width: 150, height: 20, color: "#654321", type: "platform" },
        { x: 250, y: 220, width: 150, height: 20, color: "#654321", type: "platform" },
        { x: 450, y: 120, width: 150, height: 20, color: "#654321", type: "platform" },
        { x: 650, y: 270, width: 130, height: 20, color: "#654321", type: "platform" },
      ],
      goal: { x: 750, y: 320, width: 30, height: 40, color: "#ffd700" },
    },
    6: {
      // Boss Level 2
      enemies: [
        {
          x: 200,
          y: 340,
          width: 15,
          height: 15,
          velocityX: 1.8,
          color: "#8b4513",
          minX: 150,
          maxX: 300,
          animFrame: 0,
          animTimer: 0,
        },
        {
          x: 500,
          y: 340,
          width: 15,
          height: 15,
          velocityX: -1.8,
          color: "#8b4513",
          minX: 450,
          maxX: 600,
          animFrame: 0,
          animTimer: 0,
        },
      ],
      coins: [
        { x: 100, y: 280, width: 12, height: 12, collected: false, color: "#ffd700" },
        { x: 300, y: 200, width: 12, height: 12, collected: false, color: "#ffd700" },
        { x: 500, y: 200, width: 12, height: 12, collected: false, color: "#ffd700" },
        { x: 700, y: 280, width: 12, height: 12, collected: false, color: "#ffd700" },
      ],
      powerUps: [
        { x: 150, y: 280, width: 16, height: 16, type: "fireFlower", collected: false },
        { x: 650, y: 280, width: 16, height: 16, type: "star", collected: false },
      ],
      platforms: [
        { x: 0, y: 360, width: 800, height: 40, color: "#4a5d23", type: "ground" },
        { x: 100, y: 300, width: 100, height: 20, color: "#654321", type: "platform" },
        { x: 250, y: 220, width: 100, height: 20, color: "#654321", type: "platform" },
        { x: 450, y: 220, width: 100, height: 20, color: "#654321", type: "platform" },
        { x: 600, y: 300, width: 100, height: 20, color: "#654321", type: "platform" },
      ],
      boss: {
        x: 400,
        y: 200,
        width: 50,
        height: 50,
        health: 8,
        maxHealth: 8,
        velocityX: 1.2,
        minX: 300,
        maxX: 500,
        attackTimer: 0,
        animFrame: 0,
        animTimer: 0,
        type: "koopaTroopa",
        color: "#228b22",
      },
      goal: { x: 750, y: 320, width: 30, height: 40, color: "#ffd700" },
    },
    // Continue with levels 7-12 with reduced speeds...
    7: {
      enemies: [
        {
          x: 80,
          y: 340,
          width: 15,
          height: 15,
          velocityX: 1.4,
          color: "#8b4513",
          minX: 50,
          maxX: 150,
          animFrame: 0,
          animTimer: 0,
        },
        {
          x: 220,
          y: 290,
          width: 15,
          height: 15,
          velocityX: -1.6,
          color: "#8b4513",
          minX: 180,
          maxX: 320,
          animFrame: 0,
          animTimer: 0,
        },
        {
          x: 380,
          y: 240,
          width: 15,
          height: 15,
          velocityX: 1.2,
          color: "#8b4513",
          minX: 350,
          maxX: 480,
          animFrame: 0,
          animTimer: 0,
        },
        {
          x: 540,
          y: 190,
          width: 15,
          height: 15,
          velocityX: -1.4,
          color: "#8b4513",
          minX: 500,
          maxX: 640,
          animFrame: 0,
          animTimer: 0,
        },
        {
          x: 700,
          y: 340,
          width: 15,
          height: 15,
          velocityX: 1.7,
          color: "#8b4513",
          minX: 650,
          maxX: 780,
          animFrame: 0,
          animTimer: 0,
        },
      ],
      coins: [
        { x: 100, y: 300, width: 12, height: 12, collected: false, color: "#ffd700" },
        { x: 250, y: 250, width: 12, height: 12, collected: false, color: "#ffd700" },
        { x: 400, y: 200, width: 12, height: 12, collected: false, color: "#ffd700" },
        { x: 560, y: 150, width: 12, height: 12, collected: false, color: "#ffd700" },
        { x: 720, y: 300, width: 12, height: 12, collected: false, color: "#ffd700" },
        { x: 300, y: 120, width: 12, height: 12, collected: false, color: "#ffd700" },
        { x: 500, y: 80, width: 12, height: 12, collected: false, color: "#ffd700" },
      ],
      powerUps: [
        { x: 120, y: 300, width: 16, height: 16, type: "mushroom", collected: false },
        { x: 420, y: 200, width: 16, height: 16, type: "fireFlower", collected: false },
        { x: 580, y: 150, width: 16, height: 16, type: "star", collected: false },
      ],
      platforms: [
        { x: 0, y: 360, width: 800, height: 40, color: "#4a5d23", type: "ground" },
        { x: 50, y: 320, width: 100, height: 20, color: "#654321", type: "platform" },
        { x: 180, y: 270, width: 80, height: 20, color: "#654321", type: "platform" },
        { x: 300, y: 140, width: 60, height: 20, color: "#654321", type: "platform" },
        { x: 350, y: 220, width: 100, height: 20, color: "#654321", type: "platform" },
        { x: 480, y: 100, width: 80, height: 20, color: "#654321", type: "platform" },
        { x: 500, y: 170, width: 100, height: 20, color: "#654321", type: "platform" },
        { x: 650, y: 320, width: 130, height: 20, color: "#654321", type: "platform" },
      ],
      goal: { x: 750, y: 320, width: 30, height: 40, color: "#ffd700" },
    },
    8: {
      enemies: [
        {
          x: 100,
          y: 340,
          width: 15,
          height: 15,
          velocityX: 1.8,
          color: "#8b4513",
          minX: 50,
          maxX: 200,
          animFrame: 0,
          animTimer: 0,
        },
        {
          x: 280,
          y: 240,
          width: 15,
          height: 15,
          velocityX: -1.6,
          color: "#8b4513",
          minX: 230,
          maxX: 380,
          animFrame: 0,
          animTimer: 0,
        },
        {
          x: 450,
          y: 140,
          width: 15,
          height: 15,
          velocityX: 2,
          color: "#8b4513",
          minX: 400,
          maxX: 550,
          animFrame: 0,
          animTimer: 0,
        },
        {
          x: 620,
          y: 240,
          width: 15,
          height: 15,
          velocityX: -1.8,
          color: "#8b4513",
          minX: 570,
          maxX: 720,
          animFrame: 0,
          animTimer: 0,
        },
        {
          x: 350,
          y: 90,
          width: 15,
          height: 15,
          velocityX: 1.4,
          color: "#8b4513",
          minX: 300,
          maxX: 450,
          animFrame: 0,
          animTimer: 0,
        },
      ],
      coins: [
        { x: 120, y: 300, width: 12, height: 12, collected: false, color: "#ffd700" },
        { x: 300, y: 200, width: 12, height: 12, collected: false, color: "#ffd700" },
        { x: 380, y: 50, width: 12, height: 12, collected: false, color: "#ffd700" },
        { x: 470, y: 100, width: 12, height: 12, collected: false, color: "#ffd700" },
        { x: 640, y: 200, width: 12, height: 12, collected: false, color: "#ffd700" },
        { x: 200, y: 180, width: 12, height: 12, collected: false, color: "#ffd700" },
        { x: 500, y: 40, width: 12, height: 12, collected: false, color: "#ffd700" },
        { x: 680, y: 160, width: 12, height: 12, collected: false, color: "#ffd700" },
      ],
      powerUps: [
        { x: 150, y: 300, width: 16, height: 16, type: "fireFlower", collected: false },
        { x: 320, y: 200, width: 16, height: 16, type: "star", collected: false },
        { x: 520, y: 100, width: 16, height: 16, type: "mushroom", collected: false },
      ],
      platforms: [
        { x: 0, y: 360, width: 800, height: 40, color: "#4a5d23", type: "ground" },
        { x: 50, y: 320, width: 150, height: 20, color: "#654321", type: "platform" },
        { x: 230, y: 220, width: 150, height: 20, color: "#654321", type: "platform" },
        { x: 180, y: 160, width: 80, height: 20, color: "#654321", type: "platform" },
        { x: 300, y: 70, width: 100, height: 20, color: "#654321", type: "platform" },
        { x: 450, y: 120, width: 100, height: 20, color: "#654321", type: "platform" },
        { x: 480, y: 60, width: 80, height: 20, color: "#654321", type: "platform" },
        { x: 570, y: 220, width: 150, height: 20, color: "#654321", type: "platform" },
      ],
      goal: { x: 750, y: 320, width: 30, height: 40, color: "#ffd700" },
    },
    9: {
      // Boss Level 3
      enemies: [
        {
          x: 150,
          y: 340,
          width: 15,
          height: 15,
          velocityX: 2.2,
          color: "#8b4513",
          minX: 100,
          maxX: 250,
          animFrame: 0,
          animTimer: 0,
        },
        {
          x: 350,
          y: 290,
          width: 15,
          height: 15,
          velocityX: -2,
          color: "#8b4513",
          minX: 300,
          maxX: 450,
          animFrame: 0,
          animTimer: 0,
        },
        {
          x: 550,
          y: 240,
          width: 15,
          height: 15,
          velocityX: 2.4,
          color: "#8b4513",
          minX: 500,
          maxX: 650,
          animFrame: 0,
          animTimer: 0,
        },
      ],
      coins: [
        { x: 80, y: 300, width: 12, height: 12, collected: false, color: "#ffd700" },
        { x: 200, y: 250, width: 12, height: 12, collected: false, color: "#ffd700" },
        { x: 400, y: 200, width: 12, height: 12, collected: false, color: "#ffd700" },
        { x: 600, y: 150, width: 12, height: 12, collected: false, color: "#ffd700" },
        { x: 300, y: 120, width: 12, height: 12, collected: false, color: "#ffd700" },
      ],
      powerUps: [
        { x: 120, y: 300, width: 16, height: 16, type: "fireFlower", collected: false },
        { x: 320, y: 200, width: 16, height: 16, type: "star", collected: false },
        { x: 620, y: 150, width: 16, height: 16, type: "fireFlower", collected: false },
      ],
      platforms: [
        { x: 0, y: 360, width: 800, height: 40, color: "#4a5d23", type: "ground" },
        { x: 50, y: 320, width: 120, height: 20, color: "#654321", type: "platform" },
        { x: 200, y: 270, width: 100, height: 20, color: "#654321", type: "platform" },
        { x: 250, y: 140, width: 100, height: 20, color: "#654321", type: "platform" },
        { x: 400, y: 220, width: 100, height: 20, color: "#654321", type: "platform" },
        { x: 550, y: 170, width: 120, height: 20, color: "#654321", type: "platform" },
      ],
      boss: {
        x: 400,
        y: 180,
        width: 60,
        height: 60,
        health: 12,
        maxHealth: 12,
        velocityX: 1.5,
        minX: 250,
        maxX: 550,
        attackTimer: 0,
        animFrame: 0,
        animTimer: 0,
        type: "bowserJr",
        color: "#ff4500",
      },
      goal: { x: 750, y: 320, width: 30, height: 40, color: "#ffd700" },
    },
    10: {
      enemies: [
        {
          x: 80,
          y: 340,
          width: 15,
          height: 15,
          velocityX: 2,
          color: "#8b4513",
          minX: 30,
          maxX: 180,
          animFrame: 0,
          animTimer: 0,
        },
        {
          x: 220,
          y: 290,
          width: 15,
          height: 15,
          velocityX: -2.2,
          color: "#8b4513",
          minX: 170,
          maxX: 320,
          animFrame: 0,
          animTimer: 0,
        },
        {
          x: 360,
          y: 190,
          width: 15,
          height: 15,
          velocityX: 1.8,
          color: "#8b4513",
          minX: 310,
          maxX: 460,
          animFrame: 0,
          animTimer: 0,
        },
        {
          x: 500,
          y: 140,
          width: 15,
          height: 15,
          velocityX: -2,
          color: "#8b4513",
          minX: 450,
          maxX: 600,
          animFrame: 0,
          animTimer: 0,
        },
        {
          x: 640,
          y: 240,
          width: 15,
          height: 15,
          velocityX: 2.4,
          color: "#8b4513",
          minX: 590,
          maxX: 740,
          animFrame: 0,
          animTimer: 0,
        },
        {
          x: 400,
          y: 90,
          width: 15,
          height: 15,
          velocityX: -1.6,
          color: "#8b4513",
          minX: 350,
          maxX: 500,
          animFrame: 0,
          animTimer: 0,
        },
      ],
      coins: [
        { x: 100, y: 300, width: 12, height: 12, collected: false, color: "#ffd700" },
        { x: 240, y: 250, width: 12, height: 12, collected: false, color: "#ffd700" },
        { x: 380, y: 150, width: 12, height: 12, collected: false, color: "#ffd700" },
        { x: 420, y: 50, width: 12, height: 12, collected: false, color: "#ffd700" },
        { x: 520, y: 100, width: 12, height: 12, collected: false, color: "#ffd700" },
        { x: 660, y: 200, width: 12, height: 12, collected: false, color: "#ffd700" },
        { x: 200, y: 180, width: 12, height: 12, collected: false, color: "#ffd700" },
        { x: 300, y: 120, width: 12, height: 12, collected: false, color: "#ffd700" },
        { x: 580, y: 60, width: 12, height: 12, collected: false, color: "#ffd700" },
      ],
      powerUps: [
        { x: 120, y: 300, width: 16, height: 16, type: "mushroom", collected: false },
        { x: 260, y: 250, width: 16, height: 16, type: "fireFlower", collected: false },
        { x: 440, y: 50, width: 16, height: 16, type: "star", collected: false },
        { x: 680, y: 200, width: 16, height: 16, type: "fireFlower", collected: false },
      ],
      platforms: [
        { x: 0, y: 360, width: 800, height: 40, color: "#4a5d23", type: "ground" },
        { x: 30, y: 320, width: 150, height: 20, color: "#654321", type: "platform" },
        { x: 200, y: 200, width: 80, height: 20, color: "#654321", type: "platform" },
        { x: 170, y: 270, width: 150, height: 20, color: "#654321", type: "platform" },
        { x: 300, y: 140, width: 80, height: 20, color: "#654321", type: "platform" },
        { x: 350, y: 70, width: 100, height: 20, color: "#654321", type: "platform" },
        { x: 310, y: 170, width: 150, height: 20, color: "#654321", type: "platform" },
        { x: 500, y: 80, width: 80, height: 20, color: "#654321", type: "platform" },
        { x: 450, y: 120, width: 150, height: 20, color: "#654321", type: "platform" },
        { x: 590, y: 220, width: 150, height: 20, color: "#654321", type: "platform" },
      ],
      goal: { x: 750, y: 320, width: 30, height: 40, color: "#ffd700" },
    },
    11: {
      enemies: [
        {
          x: 60,
          y: 340,
          width: 15,
          height: 15,
          velocityX: 2.4,
          color: "#8b4513",
          minX: 20,
          maxX: 160,
          animFrame: 0,
          animTimer: 0,
        },
        {
          x: 200,
          y: 290,
          width: 15,
          height: 15,
          velocityX: -2.6,
          color: "#8b4513",
          minX: 150,
          maxX: 300,
          animFrame: 0,
          animTimer: 0,
        },
        {
          x: 340,
          y: 240,
          width: 15,
          height: 15,
          velocityX: 2.2,
          color: "#8b4513",
          minX: 290,
          maxX: 440,
          animFrame: 0,
          animTimer: 0,
        },
        {
          x: 480,
          y: 190,
          width: 15,
          height: 15,
          velocityX: -2.4,
          color: "#8b4513",
          minX: 430,
          maxX: 580,
          animFrame: 0,
          animTimer: 0,
        },
        {
          x: 620,
          y: 140,
          width: 15,
          height: 15,
          velocityX: 2,
          color: "#8b4513",
          minX: 570,
          maxX: 720,
          animFrame: 0,
          animTimer: 0,
        },
        {
          x: 380,
          y: 90,
          width: 15,
          height: 15,
          velocityX: -1.8,
          color: "#8b4513",
          minX: 330,
          maxX: 480,
          animFrame: 0,
          animTimer: 0,
        },
        {
          x: 520,
          y: 40,
          width: 15,
          height: 15,
          velocityX: 2.8,
          color: "#8b4513",
          minX: 470,
          maxX: 620,
          animFrame: 0,
          animTimer: 0,
        },
      ],
      coins: [
        { x: 80, y: 300, width: 12, height: 12, collected: false, color: "#ffd700" },
        { x: 220, y: 250, width: 12, height: 12, collected: false, color: "#ffd700" },
        { x: 360, y: 200, width: 12, height: 12, collected: false, color: "#ffd700" },
        { x: 500, y: 150, width: 12, height: 12, collected: false, color: "#ffd700" },
        { x: 640, y: 100, width: 12, height: 12, collected: false, color: "#ffd700" },
        { x: 400, y: 50, width: 12, height: 12, collected: false, color: "#ffd700" },
        { x: 540, y: 0, width: 12, height: 12, collected: false, color: "#ffd700" },
        { x: 180, y: 180, width: 12, height: 12, collected: false, color: "#ffd700" },
        { x: 320, y: 120, width: 12, height: 12, collected: false, color: "#ffd700" },
        { x: 460, y: 80, width: 12, height: 12, collected: false, color: "#ffd700" },
      ],
      powerUps: [
        { x: 100, y: 300, width: 16, height: 16, type: "fireFlower", collected: false },
        { x: 240, y: 250, width: 16, height: 16, type: "star", collected: false },
        { x: 380, y: 200, width: 16, height: 16, type: "mushroom", collected: false },
        { x: 520, y: 150, width: 16, height: 16, type: "fireFlower", collected: false },
        { x: 660, y: 100, width: 16, height: 16, type: "star", collected: false },
      ],
      platforms: [
        { x: 0, y: 360, width: 800, height: 40, color: "#4a5d23", type: "ground" },
        { x: 20, y: 320, width: 140, height: 20, color: "#654321", type: "platform" },
        { x: 180, y: 200, width: 60, height: 20, color: "#654321", type: "platform" },
        { x: 150, y: 270, width: 150, height: 20, color: "#654321", type: "platform" },
        { x: 320, y: 140, width: 60, height: 20, color: "#654321", type: "platform" },
        { x: 290, y: 220, width: 150, height: 20, color: "#654321", type: "platform" },
        { x: 460, y: 100, width: 60, height: 20, color: "#654321", type: "platform" },
        { x: 430, y: 170, width: 150, height: 20, color: "#654321", type: "platform" },
        { x: 600, y: 60, width: 60, height: 20, color: "#654321", type: "platform" },
        { x: 570, y: 120, width: 150, height: 20, color: "#654321", type: "platform" },
        { x: 330, y: 70, width: 150, height: 20, color: "#654321", type: "platform" },
        { x: 470, y: 20, width: 150, height: 20, color: "#654321", type: "platform" },
      ],
      goal: { x: 750, y: 320, width: 30, height: 40, color: "#ffd700" },
    },
    12: {
      // Final Boss Level
      enemies: [
        {
          x: 100,
          y: 340,
          width: 15,
          height: 15,
          velocityX: 2.8,
          color: "#8b4513",
          minX: 50,
          maxX: 200,
          animFrame: 0,
          animTimer: 0,
        },
        {
          x: 300,
          y: 290,
          width: 15,
          height: 15,
          velocityX: -2.6,
          color: "#8b4513",
          minX: 250,
          maxX: 400,
          animFrame: 0,
          animTimer: 0,
        },
        {
          x: 500,
          y: 240,
          width: 15,
          height: 15,
          velocityX: 3,
          color: "#8b4513",
          minX: 450,
          maxX: 600,
          animFrame: 0,
          animTimer: 0,
        },
        {
          x: 650,
          y: 190,
          width: 15,
          height: 15,
          velocityX: -2.8,
          color: "#8b4513",
          minX: 600,
          maxX: 750,
          animFrame: 0,
          animTimer: 0,
        },
      ],
      coins: [
        { x: 120, y: 300, width: 12, height: 12, collected: false, color: "#ffd700" },
        { x: 320, y: 250, width: 12, height: 12, collected: false, color: "#ffd700" },
        { x: 520, y: 200, width: 12, height: 12, collected: false, color: "#ffd700" },
        { x: 670, y: 150, width: 12, height: 12, collected: false, color: "#ffd700" },
        { x: 200, y: 180, width: 12, height: 12, collected: false, color: "#ffd700" },
        { x: 400, y: 120, width: 12, height: 12, collected: false, color: "#ffd700" },
      ],
      powerUps: [
        { x: 80, y: 300, width: 16, height: 16, type: "fireFlower", collected: false },
        { x: 280, y: 250, width: 16, height: 16, type: "star", collected: false },
        { x: 480, y: 200, width: 16, height: 16, type: "fireFlower", collected: false },
        { x: 630, y: 150, width: 16, height: 16, type: "star", collected: false },
      ],
      platforms: [
        { x: 0, y: 360, width: 800, height: 40, color: "#4a5d23", type: "ground" },
        { x: 50, y: 320, width: 150, height: 20, color: "#654321", type: "platform" },
        { x: 250, y: 270, width: 150, height: 20, color: "#654321", type: "platform" },
        { x: 450, y: 220, width: 150, height: 20, color: "#654321", type: "platform" },
        { x: 600, y: 170, width: 150, height: 20, color: "#654321", type: "platform" },
        { x: 150, y: 200, width: 100, height: 20, color: "#654321", type: "platform" },
        { x: 350, y: 140, width: 100, height: 20, color: "#654321", type: "platform" },
      ],
      boss: {
        x: 400,
        y: 100,
        width: 80,
        height: 80,
        health: 20,
        maxHealth: 20,
        velocityX: 1.8, // Reduced final boss speed
        minX: 200,
        maxX: 600,
        attackTimer: 0,
        animFrame: 0,
        animTimer: 0,
        type: "bowser",
        color: "#8b0000",
      },
      goal: { x: 750, y: 320, width: 30, height: 40, color: "#ffd700" },
    },
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const game = gameStateRef.current
    game.mode = gameMode

    // Initialize level function
    const initializeLevel = (levelNum: number) => {
      const level = levels[levelNum as keyof typeof levels]
      if (!level) return

      game.enemies = [...level.enemies]
      game.coins = [...level.coins]
      game.powerUps = [...level.powerUps]
      game.platforms = [...level.platforms]
      game.goal = { ...level.goal }
      game.boss = level.boss ? { ...level.boss } : null
      game.fireballs = []
      game.player.x = 50
      game.player.y = 300
      game.camera.x = 0
      game.levelComplete = false
      game.showResults = false
    }

    initializeLevel(1)

    // Handle keyboard input
    const handleKeyDown = (e: KeyboardEvent) => {
      game.keys[e.key.toLowerCase()] = true

      // Fire power usage
      if (e.key.toLowerCase() === "x" && game.player.powerUp === "fire" && game.player.fireballCooldown === 0) {
        game.fireballs.push({
          x: game.player.x + (game.player.facing === 1 ? game.player.width : 0),
          y: game.player.y + game.player.height / 2,
          velocityX: game.player.facing * 6, // Reduced fireball speed
          velocityY: -1.5,
          life: 120,
          width: 8,
          height: 8,
        })
        game.player.fireballCooldown = 20
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      game.keys[e.key.toLowerCase()] = false
    }

    // Mouse handling for level editor
    const handleMouseDown = (e: MouseEvent) => {
      if (game.mode !== "editor") return

      const rect = canvas.getBoundingClientRect()
      const mouseX = e.clientX - rect.left + game.camera.x
      const mouseY = e.clientY - rect.top

      game.editor.mouseX = mouseX
      game.editor.mouseY = mouseY
      game.editor.isDragging = true

      if (game.editor.selectedTool === "erase") {
        // Remove objects at mouse position
        game.platforms = game.platforms.filter(
          (p) => !(mouseX >= p.x && mouseX <= p.x + p.width && mouseY >= p.y && mouseY <= p.y + p.height),
        )
        game.enemies = game.enemies.filter(
          (e) => !(mouseX >= e.x && mouseX <= e.x + e.width && mouseY >= e.y && mouseY <= e.y + e.height),
        )
        game.coins = game.coins.filter(
          (c) => !(mouseX >= c.x && mouseX <= c.x + c.width && mouseY >= c.y && mouseY <= c.y + c.height),
        )
        game.powerUps = game.powerUps.filter(
          (p) => !(mouseX >= p.x && mouseX <= p.x + p.width && mouseY >= p.y && mouseY <= p.y + p.height),
        )
      } else {
        // Add new object
        const snapX = Math.floor(mouseX / 20) * 20
        const snapY = Math.floor(mouseY / 20) * 20

        switch (game.editor.selectedTool) {
          case "platform":
            game.platforms.push({
              x: snapX,
              y: snapY,
              width: 80,
              height: 20,
              color: "#654321",
              type: "platform",
            })
            break
          case "enemy":
            game.enemies.push({
              x: snapX,
              y: snapY,
              width: 15,
              height: 15,
              velocityX: 1,
              color: "#8b4513",
              minX: snapX - 50,
              maxX: snapX + 50,
              animFrame: 0,
              animTimer: 0,
            })
            break
          case "coin":
            game.coins.push({
              x: snapX,
              y: snapY,
              width: 12,
              height: 12,
              collected: false,
              color: "#ffd700",
            })
            break
          case "powerUp":
            game.powerUps.push({
              x: snapX,
              y: snapY,
              width: 16,
              height: 16,
              type: "mushroom",
              collected: false,
            })
            break
          case "goal":
            game.goal = { x: snapX, y: snapY, width: 30, height: 40, color: "#ffd700" }
            break
        }
      }
    }

    const handleMouseUp = () => {
      if (game.mode !== "editor") return
      game.editor.isDragging = false
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (game.mode !== "editor") return

      const rect = canvas.getBoundingClientRect()
      game.editor.mouseX = e.clientX - rect.left + game.camera.x
      game.editor.mouseY = e.clientY - rect.top
    }

    // Collision detection
    const checkCollision = (rect1: any, rect2: any) => {
      return (
        rect1.x < rect2.x + rect2.width &&
        rect1.x + rect1.width > rect2.x &&
        rect1.y < rect2.y + rect2.height &&
        rect1.y + rect1.height > rect2.y
      )
    }

    // Particle creation functions
    const createLandingImpact = (x: number, y: number) => {
      for (let i = 0; i < 6; i++) {
        game.particles.push({
          x: x + Math.random() * 20 - 10,
          y: y,
          velocityX: (Math.random() - 0.5) * 3, // Reduced particle speeds
          velocityY: Math.random() * -2 - 1,
          life: 15,
          maxLife: 15,
          color: "#8b7355",
          size: Math.random() * 2 + 1,
          type: "landing",
        })
      }
    }

    const createWallSlideParticles = (x: number, y: number) => {
      if (Math.random() < 0.3) {
        game.particles.push({
          x: x,
          y: y + Math.random() * 10,
          velocityX: (Math.random() - 0.5) * 1.5,
          velocityY: Math.random() * 1.5 + 0.5,
          life: 20,
          maxLife: 20,
          color: "#a0a0a0",
          size: Math.random() * 1.5 + 0.5,
          type: "wallSlide",
        })
      }
    }

    const createPowerUpEffect = (x: number, y: number) => {
      for (let i = 0; i < 10; i++) {
        game.particles.push({
          x: x,
          y: y,
          velocityX: (Math.random() - 0.5) * 4,
          velocityY: (Math.random() - 0.5) * 4 - 1.5,
          life: 25,
          maxLife: 25,
          color: "#ff69b4",
          size: Math.random() * 3 + 1,
          type: "powerUp",
        })
      }
    }

    const createBossHitEffect = (x: number, y: number) => {
      for (let i = 0; i < 15; i++) {
        game.particles.push({
          x: x,
          y: y,
          velocityX: (Math.random() - 0.5) * 7,
          velocityY: (Math.random() - 0.5) * 7 - 2,
          life: 30,
          maxLife: 30,
          color: "#ff0000",
          size: Math.random() * 4 + 2,
          type: "boss",
        })
      }
    }

    // Update game logic
    const update = () => {
      if (game.mode === "editor") return
      if (game.gameWon || game.gameOver || game.showResults) return

      const player = game.player

      // Update cooldowns
      if (player.fireballCooldown > 0) {
        player.fireballCooldown--
      }

      // Update player animation
      player.animTimer++
      if (player.animTimer > 10) {
        // Slower animation
        player.animFrame = (player.animFrame + 1) % 4
        player.animTimer = 0
      }

      // Update invulnerability
      if (player.invulnerable > 0) {
        player.invulnerable--
      }

      // Store previous ground state
      player.wasOnGround = player.onGround

      // Handle input
      if (game.keys["a"] || game.keys["arrowleft"]) {
        player.velocityX = -player.speed
        player.facing = -1
      } else if (game.keys["d"] || game.keys["arrowright"]) {
        player.velocityX = player.speed
        player.facing = 1
      } else {
        player.velocityX *= 0.85 // Slightly more friction
      }

      if ((game.keys["w"] || game.keys["arrowup"] || game.keys[" "]) && (player.onGround || player.wallSliding)) {
        player.velocityY = -player.jumpPower
        player.onGround = false
        player.wallSliding = false
      }

      // Apply gravity (reduced)
      player.velocityY += 0.4

      // Update player position
      player.x += player.velocityX
      player.y += player.velocityY

      // Update fireballs
      game.fireballs = game.fireballs.filter((fireball) => {
        fireball.x += fireball.velocityX
        fireball.y += fireball.velocityY
        fireball.velocityY += 0.25 // Reduced gravity
        fireball.life--

        // Check fireball collision with enemies
        for (let i = 0; i < game.enemies.length; i++) {
          const enemy = game.enemies[i]
          if (checkCollision(fireball, enemy)) {
            // Remove enemy and fireball
            game.enemies.splice(i, 1)
            game.score += 150

            // Create explosion effect
            for (let j = 0; j < 8; j++) {
              game.particles.push({
                x: enemy.x + enemy.width / 2,
                y: enemy.y + enemy.height / 2,
                velocityX: (Math.random() - 0.5) * 6,
                velocityY: (Math.random() - 0.5) * 6 - 2,
                life: 20,
                maxLife: 20,
                color: "#ff6600",
                size: Math.random() * 3 + 2,
                type: "enemy",
              })
            }

            return false // Remove fireball
          }
        }

        // Check fireball collision with boss
        if (game.boss && checkCollision(fireball, game.boss)) {
          game.boss.health--
          createBossHitEffect(game.boss.x + game.boss.width / 2, game.boss.y + game.boss.height / 2)
          game.score += 200

          if (game.boss.health <= 0) {
            game.boss = null
            game.score += 1000
          }

          return false // Remove fireball
        }

        return fireball.life > 0 && fireball.x > -50 && fireball.x < 1000
      })

      // Update player trail
      const playerSpeed = Math.abs(player.velocityX)
      const speedThreshold = 2 // Reduced threshold
      const isJumping = !player.onGround

      if (playerSpeed > speedThreshold || isJumping) {
        game.playerTrail.unshift({
          x: player.x + player.width / 2,
          y: player.y + player.height / 2,
          age: 0,
          maxAge: isJumping ? 10 : 6, // Shorter trails
          type: isJumping ? "jump" : "normal",
        })

        if (game.playerTrail.length > (isJumping ? 10 : 6)) {
          game.playerTrail.pop()
        }
      }

      game.playerTrail = game.playerTrail.filter((point) => {
        point.age++
        return point.age < point.maxAge
      })

      // Platform collision and wall sliding
      player.onGround = false
      player.wallSliding = false

      for (const platform of game.platforms) {
        if (checkCollision(player, platform)) {
          if (player.velocityY > 0 && player.y < platform.y) {
            if (!player.wasOnGround && player.velocityY > 4) {
              // Reduced threshold
              createLandingImpact(player.x + player.width / 2, platform.y)
            }
            player.y = platform.y - player.height
            player.velocityY = 0
            player.onGround = true
          } else if (player.velocityY < 0 && player.y > platform.y) {
            player.y = platform.y + platform.height
            player.velocityY = 0
          } else if (player.velocityY > 0 && !player.onGround) {
            if (player.velocityX > 0 && player.x < platform.x) {
              player.x = platform.x - player.width
              player.velocityX = 0
              player.wallSliding = true
              player.wallSlideDirection = -1
              player.velocityY = Math.min(player.velocityY, 1.5) // Reduced wall slide speed
              createWallSlideParticles(platform.x, player.y + player.height / 2)
            } else if (player.velocityX < 0 && player.x > platform.x) {
              player.x = platform.x + platform.width
              player.velocityX = 0
              player.wallSliding = true
              player.wallSlideDirection = 1
              player.velocityY = Math.min(player.velocityY, 1.5)
              createWallSlideParticles(platform.x + platform.width, player.y + player.height / 2)
            }
          }
        }
      }

      // Update enemies with animation
      for (const enemy of game.enemies) {
        enemy.x += enemy.velocityX
        enemy.animTimer++
        if (enemy.animTimer > 15) {
          // Slower enemy animation
          enemy.animFrame = (enemy.animFrame + 1) % 2
          enemy.animTimer = 0
        }

        if (enemy.x <= enemy.minX || enemy.x >= enemy.maxX - enemy.width) {
          enemy.velocityX *= -1
        }

        if (checkCollision(player, enemy) && player.invulnerable === 0) {
          if (player.velocityY > 0 && player.y < enemy.y - 5) {
            player.velocityY = -6 // Reduced bounce

            for (let i = 0; i < 12; i++) {
              game.particles.push({
                x: enemy.x + enemy.width / 2,
                y: enemy.y + enemy.height / 2,
                velocityX: (Math.random() - 0.5) * 6,
                velocityY: (Math.random() - 0.5) * 6 - 2,
                life: 25,
                maxLife: 25,
                color: i % 2 === 0 ? "#ff6b6b" : "#ffa500",
                size: Math.random() * 3 + 2,
                type: "enemy",
              })
            }

            enemy.x = -100
            game.score += 100
          } else {
            if (player.powerUp === "super" || player.powerUp === "fire") {
              player.powerUp = "normal"
              player.invulnerable = 120
            } else {
              game.lives--
              if (game.lives <= 0) {
                game.gameOver = true
                setGameStatus("lost")
              } else {
                player.x = 50
                player.y = 300
                player.invulnerable = 120
              }
            }
          }
        }
      }

      // Update boss
      if (game.boss) {
        const boss = game.boss
        boss.x += boss.velocityX
        boss.animTimer++

        if (boss.animTimer > 20) {
          // Slower boss animation
          boss.animFrame = (boss.animFrame + 1) % 3
          boss.animTimer = 0
        }

        if (boss.x <= boss.minX || boss.x >= boss.maxX - boss.width) {
          boss.velocityX *= -1
        }

        boss.attackTimer++
        if (boss.attackTimer > 150) {
          // Slower boss attacks
          // Boss attack - create projectiles or jump
          if (boss.type === "bowser") {
            // Bowser breathes fire
            for (let i = 0; i < 3; i++) {
              game.particles.push({
                x: boss.x + (boss.velocityX > 0 ? boss.width : 0),
                y: boss.y + boss.height / 2 + i * 10 - 10,
                velocityX: boss.velocityX > 0 ? 3 : -3, // Reduced fire speed
                velocityY: (Math.random() - 0.5) * 1.5,
                life: 60,
                maxLife: 60,
                color: "#ff4500",
                size: Math.random() * 4 + 3,
                type: "boss",
              })
            }
          }
          boss.attackTimer = 0
        }

        // Boss collision with player
        if (checkCollision(player, boss) && player.invulnerable === 0) {
          if (player.velocityY > 0 && player.y < boss.y - 10) {
            // Player jumps on boss
            player.velocityY = -8 // Reduced bounce
            boss.health--
            createBossHitEffect(boss.x + boss.width / 2, boss.y + boss.height / 2)
            game.score += 500

            if (boss.health <= 0) {
              game.boss = null
              game.score += 2000

              // Create victory explosion
              for (let i = 0; i < 20; i++) {
                game.particles.push({
                  x: boss.x + boss.width / 2,
                  y: boss.y + boss.height / 2,
                  velocityX: (Math.random() - 0.5) * 8,
                  velocityY: (Math.random() - 0.5) * 8 - 3,
                  life: 40,
                  maxLife: 40,
                  color: "#ffd700",
                  size: Math.random() * 5 + 3,
                  type: "boss",
                })
              }
            }
          } else {
            // Player takes damage
            if (player.powerUp === "super" || player.powerUp === "fire") {
              player.powerUp = "normal"
              player.invulnerable = 120
            } else {
              game.lives--
              if (game.lives <= 0) {
                game.gameOver = true
                setGameStatus("lost")
              } else {
                player.x = 50
                player.y = 300
                player.invulnerable = 120
              }
            }
          }
        }
      }

      // Check coin collection
      for (const coin of game.coins) {
        if (!coin.collected && checkCollision(player, coin)) {
          coin.collected = true
          game.score += 50

          for (let i = 0; i < 8; i++) {
            game.particles.push({
              x: coin.x + coin.width / 2,
              y: coin.y + coin.height / 2,
              velocityX: (Math.random() - 0.5) * 4,
              velocityY: (Math.random() - 0.5) * 4 - 1.5,
              life: 30,
              maxLife: 30,
              color: "#ffd700",
              size: 3,
              type: "coin",
            })
          }
        }
      }

      // Check power-up collection
      for (const powerUp of game.powerUps) {
        if (!powerUp.collected && checkCollision(player, powerUp)) {
          powerUp.collected = true
          createPowerUpEffect(powerUp.x + powerUp.width / 2, powerUp.y + powerUp.height / 2)

          if (powerUp.type === "mushroom") {
            player.powerUp = "super"
            game.score += 200
          } else if (powerUp.type === "fireFlower") {
            player.powerUp = "fire"
            game.score += 300
          } else if (powerUp.type === "star") {
            player.invulnerable = 300
            game.score += 500
          }
        }
      }

      // Check goal collision (only if boss is defeated or no boss)
      if ((!game.boss || game.boss.health <= 0) && checkCollision(player, game.goal)) {
        game.levelComplete = true
        if (game.currentLevel < 12) {
          game.showResults = true
          setGameStatus("results")
        } else {
          game.gameWon = true
          setGameStatus("won")
        }
      }

      // Update clouds
      for (const cloud of game.clouds) {
        cloud.x += cloud.speed
        if (cloud.x > 850) {
          cloud.x = -100
        }
      }

      // Update background layers
      for (const layer of game.backgroundLayers) {
        layer.x += layer.speed
        if (layer.x > 800) {
          layer.x = 0
        }
      }

      // Camera follow player (smoother)
      const maxCameraX = game.currentLevel === 1 ? 0 : 900 - canvas.width
      const targetCameraX = Math.max(0, Math.min(player.x - canvas.width / 2, maxCameraX))
      game.camera.x += (targetCameraX - game.camera.x) * 0.1 // Smooth camera

      // Update particles
      game.particles = game.particles.filter((particle) => {
        particle.x += particle.velocityX
        particle.y += particle.velocityY

        if (particle.type !== "wallSlide") {
          particle.velocityY += 0.15 // Reduced particle gravity
        }

        particle.life--

        if (particle.type === "coin" || particle.type === "powerUp") {
          particle.velocityX *= 0.98
          particle.velocityY *= 0.98
        }

        return particle.life > 0
      })

      // Prevent player from falling off the world
      if (player.y > 500) {
        game.lives--
        if (game.lives <= 0) {
          game.gameOver = true
          setGameStatus("lost")
        } else {
          player.x = 50
          player.y = 300
          player.invulnerable = 120
        }
      }

      // Keep player in bounds
      const maxX = game.currentLevel === 1 ? 800 - player.width : 900 - player.width
      player.x = Math.max(0, Math.min(player.x, maxX))
    }

    // Draw functions
    const drawCloud = (cloud: any) => {
      ctx.save()
      ctx.globalAlpha = 0.8
      ctx.fillStyle = "#ffffff"

      const baseX = cloud.x - game.camera.x * 0.1
      const baseY = cloud.y
      const size = cloud.size

      ctx.beginPath()
      ctx.arc(baseX, baseY, 15 * size, 0, Math.PI * 2)
      ctx.arc(baseX + 15 * size, baseY, 20 * size, 0, Math.PI * 2)
      ctx.arc(baseX + 30 * size, baseY, 15 * size, 0, Math.PI * 2)
      ctx.arc(baseX + 10 * size, baseY - 10 * size, 12 * size, 0, Math.PI * 2)
      ctx.arc(baseX + 20 * size, baseY - 8 * size, 14 * size, 0, Math.PI * 2)
      ctx.fill()

      ctx.restore()
    }

    const drawParallaxBackground = () => {
      // Far mountains
      ctx.fillStyle = "#4a90e2"
      for (let i = -1; i <= 2; i++) {
        const x = i * 400 - ((game.camera.x * 0.1) % 400)
        ctx.beginPath()
        ctx.moveTo(x, 300)
        ctx.lineTo(x + 100, 200)
        ctx.lineTo(x + 200, 250)
        ctx.lineTo(x + 300, 180)
        ctx.lineTo(x + 400, 300)
        ctx.closePath()
        ctx.fill()
      }

      // Mid mountains
      ctx.fillStyle = "#5ba0f2"
      for (let i = -1; i <= 2; i++) {
        const x = i * 350 - ((game.camera.x * 0.3) % 350)
        ctx.beginPath()
        ctx.moveTo(x, 320)
        ctx.lineTo(x + 80, 240)
        ctx.lineTo(x + 160, 280)
        ctx.lineTo(x + 240, 220)
        ctx.lineTo(x + 350, 320)
        ctx.closePath()
        ctx.fill()
      }

      // Near hills
      ctx.fillStyle = "#6bb0ff"
      for (let i = -1; i <= 2; i++) {
        const x = i * 300 - ((game.camera.x * 0.5) % 300)
        ctx.beginPath()
        ctx.moveTo(x, 340)
        ctx.lineTo(x + 60, 280)
        ctx.lineTo(x + 120, 300)
        ctx.lineTo(x + 180, 260)
        ctx.lineTo(x + 240, 290)
        ctx.lineTo(x + 300, 340)
        ctx.closePath()
        ctx.fill()
      }
    }

    const drawAnimatedMario = () => {
      const player = game.player
      const isMoving = Math.abs(player.velocityX) > 0.5

      ctx.save()
      if (player.facing === -1) {
        ctx.scale(-1, 1)
        ctx.translate(-player.x * 2 - player.width, 0)
      }

      // Flashing effect when invulnerable
      if (player.invulnerable > 0 && Math.floor(player.invulnerable / 5) % 2 === 0) {
        ctx.globalAlpha = 0.5
      }

      // Adjust size based on power-up
      const sizeMultiplier = player.powerUp === "super" || player.powerUp === "fire" ? 1.2 : 1
      const height = player.height * sizeMultiplier

      // Body
      const bodyColor = player.powerUp === "fire" ? "#ff6666" : "#ff4444"
      ctx.fillStyle = bodyColor
      ctx.fillRect(player.x + 2, player.y + 8, player.width - 4, height - 8)

      // Head
      ctx.fillStyle = "#ffdbac"
      ctx.fillRect(player.x + 4, player.y, player.width - 8, 10)

      // Hat
      ctx.fillStyle = "#cc0000"
      ctx.fillRect(player.x + 2, player.y, player.width - 4, 6)
      ctx.fillRect(player.x + 4, player.y - 2, player.width - 8, 4)

      // Eyes (animated)
      ctx.fillStyle = "#000"
      const eyeOffset = isMoving ? player.animFrame % 2 : 0
      ctx.fillRect(player.x + 6 + eyeOffset, player.y + 3, 2, 2)
      ctx.fillRect(player.x + 12 + eyeOffset, player.y + 3, 2, 2)

      // Mustache
      ctx.fillStyle = "#8b4513"
      ctx.fillRect(player.x + 6, player.y + 6, 8, 2)

      // Overalls
      ctx.fillStyle = "#0066cc"
      ctx.fillRect(player.x + 4, player.y + 10, player.width - 8, 6)

      // Buttons
      ctx.fillStyle = "#ffff00"
      ctx.fillRect(player.x + 7, player.y + 12, 1, 1)
      ctx.fillRect(player.x + 12, player.y + 12, 1, 1)

      // Legs (animated when moving)
      if (isMoving) {
        const legOffset = player.animFrame % 2 === 0 ? 1 : -1
        ctx.fillStyle = "#0066cc"
        ctx.fillRect(player.x + 5 + legOffset, player.y + height - 4, 3, 4)
        ctx.fillRect(player.x + 12 - legOffset, player.y + height - 4, 3, 4)
      }

      ctx.restore()
    }

    const drawAnimatedEnemy = (enemy: any) => {
      if (enemy.x <= -50) return

      const bodyOffset = enemy.animFrame === 0 ? 0 : 1
      ctx.fillStyle = "#8b4513"
      ctx.fillRect(enemy.x, enemy.y + bodyOffset, enemy.width, enemy.height - bodyOffset)

      ctx.fillStyle = "#654321"
      ctx.fillRect(enemy.x + 2, enemy.y + 2 + bodyOffset, enemy.width - 4, 2)
      ctx.fillRect(enemy.x + 2, enemy.y + 6 + bodyOffset, enemy.width - 4, 2)
      ctx.fillRect(enemy.x + 2, enemy.y + 10 + bodyOffset, enemy.width - 4, 2)

      const eyeColor = enemy.animFrame === 1 ? "#000" : "#ff0000"
      ctx.fillStyle = eyeColor
      ctx.fillRect(enemy.x + 3, enemy.y + 3 + bodyOffset, 2, 2)
      ctx.fillRect(enemy.x + 10, enemy.y + 3 + bodyOffset, 2, 2)

      ctx.fillStyle = "#000"
      const footOffset = enemy.animFrame === 0 ? 0 : 1
      ctx.fillRect(enemy.x + 1 + footOffset, enemy.y + enemy.height, 3, 2)
      ctx.fillRect(enemy.x + enemy.width - 4 - footOffset, enemy.y + enemy.height, 3, 2)
    }

    const drawBoss = (boss: any) => {
      if (!boss) return

      ctx.save()

      // Flashing when damaged
      if (boss.health < boss.maxHealth / 2 && Math.floor(Date.now() / 100) % 2 === 0) {
        ctx.globalAlpha = 0.7
      }

      if (boss.type === "goombaKing") {
        // Large Goomba King
        ctx.fillStyle = "#654321"
        ctx.fillRect(boss.x, boss.y, boss.width, boss.height)

        // Crown
        ctx.fillStyle = "#ffd700"
        ctx.fillRect(boss.x + 5, boss.y - 8, boss.width - 10, 8)
        ctx.fillRect(boss.x + 10, boss.y - 12, 5, 4)
        ctx.fillRect(boss.x + 20, boss.y - 12, 5, 4)
        ctx.fillRect(boss.x + 30, boss.y - 12, 5, 4)

        // Eyes
        ctx.fillStyle = "#ff0000"
        ctx.fillRect(boss.x + 8, boss.y + 8, 6, 6)
        ctx.fillRect(boss.x + 26, boss.y + 8, 6, 6)

        // Angry eyebrows
        ctx.fillStyle = "#000"
        ctx.fillRect(boss.x + 6, boss.y + 6, 10, 2)
        ctx.fillRect(boss.x + 24, boss.y + 6, 10, 2)
      } else if (boss.type === "koopaTroopa") {
        // Koopa Troopa Boss
        ctx.fillStyle = "#228b22"
        ctx.fillRect(boss.x, boss.y, boss.width, boss.height)

        // Shell pattern
        ctx.fillStyle = "#006400"
        for (let i = 0; i < 4; i++) {
          ctx.fillRect(boss.x + 5, boss.y + 5 + i * 10, boss.width - 10, 4)
        }

        // Spikes
        ctx.fillStyle = "#ffffff"
        for (let i = 0; i < 5; i++) {
          ctx.beginPath()
          ctx.moveTo(boss.x + 5 + i * 8, boss.y)
          ctx.lineTo(boss.x + 9 + i * 8, boss.y - 6)
          ctx.lineTo(boss.x + 13 + i * 8, boss.y)
          ctx.closePath()
          ctx.fill()
        }
      } else if (boss.type === "bowserJr") {
        // Bowser Jr
        ctx.fillStyle = "#ff4500"
        ctx.fillRect(boss.x, boss.y, boss.width, boss.height)

        // Shell
        ctx.fillStyle = "#228b22"
        ctx.fillRect(boss.x + 10, boss.y + 15, boss.width - 20, boss.height - 25)

        // Spikes on shell
        ctx.fillStyle = "#ffffff"
        for (let i = 0; i < 3; i++) {
          ctx.beginPath()
          ctx.moveTo(boss.x + 15 + i * 10, boss.y + 15)
          ctx.lineTo(boss.x + 20 + i * 10, boss.y + 8)
          ctx.lineTo(boss.x + 25 + i * 10, boss.y + 15)
          ctx.closePath()
          ctx.fill()
        }

        // Eyes
        ctx.fillStyle = "#000"
        ctx.fillRect(boss.x + 15, boss.y + 8, 4, 4)
        ctx.fillRect(boss.x + 35, boss.y + 8, 4, 4)
      } else if (boss.type === "bowser") {
        // Final Boss Bowser
        ctx.fillStyle = "#8b0000"
        ctx.fillRect(boss.x, boss.y, boss.width, boss.height)

        // Shell
        ctx.fillStyle = "#228b22"
        ctx.fillRect(boss.x + 15, boss.y + 20, boss.width - 30, boss.height - 30)

        // Large spikes
        ctx.fillStyle = "#ffffff"
        for (let i = 0; i < 6; i++) {
          ctx.beginPath()
          ctx.moveTo(boss.x + 20 + i * 10, boss.y + 20)
          ctx.lineTo(boss.x + 25 + i * 10, boss.y + 5)
          ctx.lineTo(boss.x + 30 + i * 10, boss.y + 20)
          ctx.closePath()
          ctx.fill()
        }

        // Horns
        ctx.fillStyle = "#ffff00"
        ctx.beginPath()
        ctx.moveTo(boss.x + 10, boss.y + 10)
        ctx.lineTo(boss.x + 5, boss.y - 5)
        ctx.lineTo(boss.x + 15, boss.y + 5)
        ctx.closePath()
        ctx.fill()

        ctx.beginPath()
        ctx.moveTo(boss.x + boss.width - 10, boss.y + 10)
        ctx.lineTo(boss.x + boss.width - 5, boss.y - 5)
        ctx.lineTo(boss.x + boss.width - 15, boss.y + 5)
        ctx.closePath()
        ctx.fill()

        // Eyes
        ctx.fillStyle = "#ff0000"
        ctx.fillRect(boss.x + 20, boss.y + 15, 8, 8)
        ctx.fillRect(boss.x + boss.width - 28, boss.y + 15, 8, 8)

        // Angry mouth
        ctx.fillStyle = "#000"
        ctx.fillRect(boss.x + 25, boss.y + 35, boss.width - 50, 8)

        // Teeth
        ctx.fillStyle = "#ffffff"
        for (let i = 0; i < 4; i++) {
          ctx.fillRect(boss.x + 30 + i * 8, boss.y + 35, 3, 6)
        }
      }

      // Health bar
      const barWidth = boss.width
      const barHeight = 4
      const healthPercent = boss.health / boss.maxHealth

      ctx.fillStyle = "#ff0000"
      ctx.fillRect(boss.x, boss.y - 15, barWidth, barHeight)
      ctx.fillStyle = "#00ff00"
      ctx.fillRect(boss.x, boss.y - 15, barWidth * healthPercent, barHeight)
      ctx.strokeStyle = "#000"
      ctx.lineWidth = 1
      ctx.strokeRect(boss.x, boss.y - 15, barWidth, barHeight)

      ctx.restore()
    }

    const drawPowerUp = (powerUp: any) => {
      if (powerUp.collected) return

      const centerX = powerUp.x + powerUp.width / 2
      const centerY = powerUp.y + powerUp.height / 2

      if (powerUp.type === "mushroom") {
        ctx.fillStyle = "#ff4444"
        ctx.beginPath()
        ctx.arc(centerX, centerY - 2, 8, 0, Math.PI * 2)
        ctx.fill()

        ctx.fillStyle = "#ffffff"
        ctx.fillRect(centerX - 3, centerY - 5, 2, 2)
        ctx.fillRect(centerX + 1, centerY - 3, 2, 2)

        ctx.fillStyle = "#ffdbac"
        ctx.fillRect(centerX - 2, centerY + 2, 4, 6)
      } else if (powerUp.type === "fireFlower") {
        ctx.fillStyle = "#ff6600"
        for (let i = 0; i < 4; i++) {
          const angle = (i * Math.PI) / 2
          const x = centerX + Math.cos(angle) * 6
          const y = centerY + Math.sin(angle) * 6
          ctx.beginPath()
          ctx.arc(x, y, 3, 0, Math.PI * 2)
          ctx.fill()
        }

        ctx.fillStyle = "#ffff00"
        ctx.beginPath()
        ctx.arc(centerX, centerY, 3, 0, Math.PI * 2)
        ctx.fill()
      } else if (powerUp.type === "star") {
        ctx.fillStyle = "#ffff00"
        ctx.beginPath()
        for (let i = 0; i < 5; i++) {
          const angle = (i * Math.PI * 2) / 5 - Math.PI / 2
          const x = centerX + Math.cos(angle) * 8
          const y = centerY + Math.sin(angle) * 8
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)

          const innerAngle = angle + Math.PI / 5
          const innerX = centerX + Math.cos(innerAngle) * 4
          const innerY = centerY + Math.sin(innerAngle) * 4
          ctx.lineTo(innerX, innerY)
        }
        ctx.closePath()
        ctx.fill()
      }
    }

    const drawFireball = (fireball: any) => {
      ctx.save()

      // Fireball body
      ctx.fillStyle = "#ff4500"
      ctx.beginPath()
      ctx.arc(fireball.x + fireball.width / 2, fireball.y + fireball.height / 2, fireball.width / 2, 0, Math.PI * 2)
      ctx.fill()

      // Inner fire
      ctx.fillStyle = "#ffff00"
      ctx.beginPath()
      ctx.arc(fireball.x + fireball.width / 2, fireball.y + fireball.height / 2, fireball.width / 3, 0, Math.PI * 2)
      ctx.fill()

      // Fire trail
      ctx.fillStyle = "#ff6600"
      ctx.globalAlpha = 0.6
      ctx.beginPath()
      ctx.arc(
        fireball.x + fireball.width / 2 - fireball.velocityX,
        fireball.y + fireball.height / 2,
        fireball.width / 3,
        0,
        Math.PI * 2,
      )
      ctx.fill()

      ctx.restore()
    }

    // Main render function
    const render = () => {
      // Sky gradient background
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height)
      gradient.addColorStop(0, "#87ceeb")
      gradient.addColorStop(1, "#b0e0e6")
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      if (game.mode === "game") {
        // Draw parallax background
        drawParallaxBackground()

        // Draw clouds
        for (const cloud of game.clouds) {
          drawCloud(cloud)
        }
      }

      ctx.save()
      ctx.translate(-game.camera.x, 0)

      // Draw platforms
      for (const platform of game.platforms) {
        if (platform.type === "ground") {
          ctx.fillStyle = "#4a5d23"
          ctx.fillRect(platform.x, platform.y, platform.width, platform.height)
          ctx.fillStyle = "#5a7d33"
          for (let i = 0; i < platform.width; i += 8) {
            ctx.fillRect(platform.x + i, platform.y, 2, 4)
            ctx.fillRect(platform.x + i + 4, platform.y, 1, 6)
          }
        } else {
          ctx.fillStyle = "#8b4513"
          ctx.fillRect(platform.x, platform.y, platform.width, platform.height)
          ctx.fillStyle = "#654321"
          ctx.fillRect(platform.x, platform.y + 2, platform.width, 2)
          ctx.fillRect(platform.x, platform.y + platform.height - 4, platform.width, 2)
          for (let i = 0; i < platform.width; i += 20) {
            ctx.fillStyle = "#5a3a1a"
            ctx.fillRect(platform.x + i, platform.y, 1, platform.height)
          }
        }
      }

      // Draw enemies
      for (const enemy of game.enemies) {
        drawAnimatedEnemy(enemy)
      }

      // Draw boss
      if (game.boss) {
        drawBoss(game.boss)
      }

      // Draw coins
      for (const coin of game.coins) {
        if (!coin.collected) {
          const centerX = coin.x + coin.width / 2
          const centerY = coin.y + coin.height / 2

          ctx.fillStyle = "#ffd700"
          ctx.beginPath()
          ctx.arc(centerX, centerY, coin.width / 2, 0, Math.PI * 2)
          ctx.fill()

          ctx.fillStyle = "#ffed4e"
          ctx.beginPath()
          ctx.arc(centerX, centerY, coin.width / 3, 0, Math.PI * 2)
          ctx.fill()

          ctx.fillStyle = "#ffd700"
          for (let i = 0; i < 5; i++) {
            const angle = (i * Math.PI * 2) / 5
            const x = centerX + Math.cos(angle) * 2
            const y = centerY + Math.sin(angle) * 2
            ctx.fillRect(x - 0.5, y - 0.5, 1, 1)
          }
        }
      }

      // Draw power-ups
      for (const powerUp of game.powerUps) {
        drawPowerUp(powerUp)
      }

      // Draw fireballs
      for (const fireball of game.fireballs) {
        drawFireball(fireball)
      }

      if (game.mode === "game") {
        // Draw player trail
        for (let i = game.playerTrail.length - 1; i >= 0; i--) {
          const point = game.playerTrail[i]
          const alpha = 1 - point.age / point.maxAge
          const size = (1 - point.age / point.maxAge) * game.player.width * 0.8

          ctx.save()
          ctx.globalAlpha = alpha * (point.type === "jump" ? 0.8 : 0.6)

          const trailColor = point.type === "jump" ? "#ff6b6b" : "#ff4444"
          const gradient = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, size / 2)
          gradient.addColorStop(0, trailColor)
          gradient.addColorStop(1, "transparent")

          ctx.fillStyle = gradient
          ctx.beginPath()
          ctx.arc(point.x, point.y, size / 2, 0, Math.PI * 2)
          ctx.fill()

          ctx.restore()
        }
      }

      // Draw flag (ALWAYS draw the flag, regardless of mode)
      const goal = game.goal
      ctx.fillStyle = "#8b4513"
      ctx.fillRect(goal.x + 2, goal.y, 4, goal.height)
      ctx.fillStyle = "#ff0000"
      ctx.fillRect(goal.x + 6, goal.y, 20, 15)
      ctx.fillStyle = "#ffffff"
      ctx.fillRect(goal.x + 6, goal.y + 3, 20, 2)
      ctx.fillRect(goal.x + 6, goal.y + 8, 20, 2)
      ctx.fillRect(goal.x + 6, goal.y + 13, 20, 2)
      ctx.fillStyle = "#000"
      ctx.fillRect(goal.x + 12, goal.y + 5, 8, 6)
      ctx.fillStyle = "#ffff00"
      ctx.fillRect(goal.x + 14, goal.y + 7, 4, 2)

      // Draw Mario
      if (game.mode === "game") {
        drawAnimatedMario()
      }

      // Draw particles
      for (const particle of game.particles) {
        const alpha = particle.life / particle.maxLife
        ctx.save()
        ctx.globalAlpha = alpha

        if (particle.type === "coin") {
          ctx.fillStyle = particle.color
          ctx.beginPath()
          ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = "#ffffff"
          ctx.fillRect(particle.x - 1, particle.y - 1, 2, 2)
        } else if (particle.type === "powerUp") {
          ctx.fillStyle = particle.color
          ctx.beginPath()
          ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2)
          ctx.fill()
        } else if (particle.type === "landing") {
          ctx.fillStyle = particle.color
          ctx.beginPath()
          ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2)
          ctx.fill()
        } else if (particle.type === "wallSlide") {
          ctx.fillStyle = particle.color
          ctx.fillRect(particle.x - particle.size / 2, particle.y - particle.size / 2, particle.size, particle.size)
        } else if (particle.type === "boss") {
          ctx.fillStyle = particle.color
          ctx.beginPath()
          ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2)
          ctx.fill()
        } else {
          ctx.fillStyle = particle.color
          ctx.fillRect(particle.x - particle.size / 2, particle.y - particle.size / 2, particle.size, particle.size)
        }

        ctx.restore()
      }

      // Editor mode cursor
      if (game.mode === "editor") {
        const snapX = Math.floor(game.editor.mouseX / 20) * 20
        const snapY = Math.floor(game.editor.mouseY / 20) * 20

        ctx.strokeStyle = "#ff0000"
        ctx.lineWidth = 2
        ctx.setLineDash([5, 5])

        if (game.editor.selectedTool === "platform") {
          ctx.strokeRect(snapX, snapY, 80, 20)
        } else if (game.editor.selectedTool === "enemy") {
          ctx.strokeRect(snapX, snapY, 15, 15)
        } else if (game.editor.selectedTool === "coin") {
          ctx.beginPath()
          ctx.arc(snapX + 6, snapY + 6, 6, 0, Math.PI * 2)
          ctx.stroke()
        } else if (game.editor.selectedTool === "powerUp") {
          ctx.strokeRect(snapX, snapY, 16, 16)
        } else if (game.editor.selectedTool === "goal") {
          ctx.strokeRect(snapX, snapY, 30, 40)
        }

        ctx.setLineDash([])
      }

      ctx.restore()

      // Draw UI
      if (game.mode === "game") {
        ctx.fillStyle = "rgba(0, 0, 0, 0.7)"
        ctx.fillRect(0, 0, canvas.width, 70)

        ctx.fillStyle = "#fff"
        ctx.font = "bold 16px Arial"
        ctx.fillText("WASD/Arrows: Move | Space: Jump | X: Fire (when powered)", 10, 25)
        ctx.fillText(`Score: ${game.score}`, 10, 45)
        ctx.fillText(`Lives: ${game.lives}`, 150, 45)
        ctx.fillText(`Level: ${game.currentLevel}`, 250, 45)
        ctx.fillText(`Power: ${game.player.powerUp.toUpperCase()}`, 350, 45)

        // Boss level indicator
        if ([3, 6, 9, 12].includes(game.currentLevel)) {
          ctx.fillStyle = "#ff0000"
          ctx.font = "bold 18px Arial"
          ctx.fillText("BOSS LEVEL!", 500, 25)
          if (game.boss) {
            ctx.fillText(`Boss HP: ${game.boss.health}/${game.boss.maxHealth}`, 500, 45)
          }
        }

        // Results screen
        if (game.showResults) {
          ctx.fillStyle = "rgba(0, 0, 0, 0.8)"
          ctx.fillRect(0, 0, canvas.width, canvas.height)
          ctx.fillStyle = "#fff"
          ctx.font = "bold 32px Arial"
          ctx.textAlign = "center"
          ctx.fillText("Level Complete!", canvas.width / 2, canvas.height / 2 - 60)
          ctx.font = "24px Arial"
          ctx.fillText(`Score: ${game.score}`, canvas.width / 2, canvas.height / 2 - 20)
          ctx.fillText(`Lives: ${game.lives}`, canvas.width / 2, canvas.height / 2 + 10)
          ctx.font = "18px Arial"
          ctx.fillText("Press SPACE to continue to next level", canvas.width / 2, canvas.height / 2 + 50)
          ctx.textAlign = "left"
        }

        if (game.gameWon) {
          ctx.fillStyle = "rgba(0, 255, 0, 0.9)"
          ctx.fillRect(0, 0, canvas.width, canvas.height)
          ctx.fillStyle = "#000"
          ctx.font = "bold 32px Arial"
          ctx.textAlign = "center"
          ctx.fillText("🎉 ALL LEVELS COMPLETE! 🎉", canvas.width / 2, canvas.height / 2 - 40)
          ctx.fillText("You defeated all the bosses!", canvas.width / 2, canvas.height / 2 - 10)
          ctx.font = "bold 24px Arial"
          ctx.fillText(`Final Score: ${game.score}`, canvas.width / 2, canvas.height / 2 + 20)
          ctx.font = "16px Arial"
          ctx.fillText("Press R to restart", canvas.width / 2, canvas.height / 2 + 50)
          ctx.textAlign = "left"
        }

        if (game.gameOver) {
          ctx.fillStyle = "rgba(255, 0, 0, 0.9)"
          ctx.fillRect(0, 0, canvas.width, canvas.height)
          ctx.fillStyle = "#fff"
          ctx.font = "bold 32px Arial"
          ctx.textAlign = "center"
          ctx.fillText("Game Over!", canvas.width / 2, canvas.height / 2 - 20)
          ctx.font = "bold 24px Arial"
          ctx.fillText(`Final Score: ${game.score}`, canvas.width / 2, canvas.height / 2 + 10)
          ctx.font = "16px Arial"
          ctx.fillText("Press R to restart", canvas.width / 2, canvas.height / 2 + 40)
          ctx.textAlign = "left"
        }
      } else {
        // Editor UI
        ctx.fillStyle = "rgba(0, 0, 0, 0.8)"
        ctx.fillRect(0, 0, canvas.width, 100)

        ctx.fillStyle = "#fff"
        ctx.font = "bold 18px Arial"
        ctx.fillText("LEVEL EDITOR", 10, 25)
        ctx.font = "14px Arial"
        ctx.fillText("Click to place objects | Mouse wheel to scroll", 10, 45)
        ctx.fillText(`Selected Tool: ${game.editor.selectedTool.toUpperCase()}`, 10, 65)
        ctx.fillText("S: Save Level | L: Load Level | T: Test Level", 10, 85)
      }
    }

    // Game loop
    const gameLoop = () => {
      update()
      render()
      requestAnimationFrame(gameLoop)
    }

    // Save/Load level functions
    const saveCustomLevel = () => {
      const levelData = {
        platforms: game.platforms,
        enemies: game.enemies,
        coins: game.coins,
        powerUps: game.powerUps,
        goal: game.goal,
      }
      localStorage.setItem("customLevel", JSON.stringify(levelData))
      alert("Level saved!")
    }

    const loadCustomLevel = () => {
      const savedLevel = localStorage.getItem("customLevel")
      if (savedLevel) {
        const levelData = JSON.parse(savedLevel)
        game.platforms = levelData.platforms || []
        game.enemies = levelData.enemies || []
        game.coins = levelData.coins || []
        game.powerUps = levelData.powerUps || []
        game.goal = levelData.goal || { x: 750, y: 320, width: 30, height: 40, color: "#ffd700" }
        alert("Level loaded!")
      } else {
        alert("No saved level found!")
      }
    }

    // Restart game
    const restartGame = () => {
      game.currentLevel = 1
      game.player = {
        x: 50,
        y: 300,
        width: 20,
        height: 20,
        velocityX: 0,
        velocityY: 0,
        speed: 3,
        jumpPower: 10,
        onGround: false,
        wasOnGround: false,
        color: "#ff4444",
        wallSliding: false,
        wallSlideDirection: 0,
        animFrame: 0,
        animTimer: 0,
        facing: 1,
        powerUp: "normal",
        invulnerable: 0,
        fireballCooldown: 0,
      }
      game.gameWon = false
      game.gameOver = false
      game.camera.x = 0
      game.score = 0
      game.lives = 3
      game.particles = []
      game.playerTrail = []
      game.fireballs = []
      game.boss = null
      initializeLevel(1)
      setGameStatus("playing")
    }

    const handleRestart = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "r" && (game.gameWon || game.gameOver)) {
        restartGame()
      }
      if (e.key === " " && game.showResults) {
        game.currentLevel++
        initializeLevel(game.currentLevel)
        setGameStatus("playing")
      }

      // Editor controls
      if (game.mode === "editor") {
        if (e.key.toLowerCase() === "s") {
          saveCustomLevel()
        } else if (e.key.toLowerCase() === "l") {
          loadCustomLevel()
        } else if (e.key.toLowerCase() === "t") {
          setGameMode("game")
          game.mode = "game"
          game.player.x = 50
          game.player.y = 300
          game.camera.x = 0
        }
      }
    }

    // Event listeners
    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)
    window.addEventListener("keydown", handleRestart)

    if (game.mode === "editor") {
      canvas.addEventListener("mousedown", handleMouseDown)
      canvas.addEventListener("mouseup", handleMouseUp)
      canvas.addEventListener("mousemove", handleMouseMove)
    }

    // Start game loop
    gameLoop()

    // Cleanup
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
      window.removeEventListener("keydown", handleRestart)
      canvas.removeEventListener("mousedown", handleMouseDown)
      canvas.removeEventListener("mouseup", handleMouseUp)
      canvas.removeEventListener("mousemove", handleMouseMove)
    }
  }, [gameMode])

  // Update selected tool when UI changes
  useEffect(() => {
    if (gameStateRef.current) {
      gameStateRef.current.editor.selectedTool = selectedTool
    }
  }, [selectedTool])

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      <div className="mb-4 text-center">
        <h1 className="text-3xl font-bold mb-2">Super Mario Platformer Deluxe</h1>
        <p className="text-gray-600">12 levels, boss battles, power-ups, and level editor!</p>
      </div>

      {/* Mode Toggle */}
      <div className="mb-4 flex gap-4">
        <button
          onClick={() => setGameMode("game")}
          className={`px-6 py-2 rounded-lg font-bold ${
            gameMode === "game" ? "bg-blue-600 text-white" : "bg-gray-300 text-gray-700 hover:bg-gray-400"
          }`}
        >
          Play Game
        </button>
        <button
          onClick={() => setGameMode("editor")}
          className={`px-6 py-2 rounded-lg font-bold ${
            gameMode === "editor" ? "bg-green-600 text-white" : "bg-gray-300 text-gray-700 hover:bg-gray-400"
          }`}
        >
          Level Editor
        </button>
      </div>

      {/* Editor Tools */}
      {gameMode === "editor" && (
        <div className="mb-4 flex flex-wrap gap-2 justify-center">
          {["platform", "enemy", "coin", "powerUp", "goal", "erase"].map((tool) => (
            <button
              key={tool}
              onClick={() => setSelectedTool(tool as any)}
              className={`px-4 py-2 rounded font-semibold ${
                selectedTool === tool ? "bg-orange-600 text-white" : "bg-gray-300 text-gray-700 hover:bg-gray-400"
              }`}
            >
              {tool.charAt(0).toUpperCase() + tool.slice(1)}
            </button>
          ))}
        </div>
      )}

      <div className="border-4 border-gray-800 rounded-lg overflow-hidden shadow-lg">
        <canvas ref={canvasRef} width={800} height={400} className="block bg-sky-200" tabIndex={0} />
      </div>

      <div className="mt-4 text-center text-sm text-gray-600 max-w-2xl">
        {gameMode === "game" ? (
          <>
            <p>
              <strong>Game Controls:</strong>
            </p>
            <p>WASD or Arrow Keys to move • Space or W/↑ to jump • X to shoot fireballs (Fire power)</p>
            <p>🍄 Mushroom (Super Mario) • 🌸 Fire Flower (Shoot fireballs) • ⭐ Star (Invincible)</p>
            <p>Boss battles on levels 3, 6, 9, and 12! Complete all 12 levels to win!</p>
            {gameStatus !== "playing" && <p className="mt-2 font-semibold">Press R to restart or SPACE to continue</p>}
          </>
        ) : (
          <>
            <p>
              <strong>Level Editor:</strong>
            </p>
            <p>Click to place objects • Select tools above • S: Save • L: Load • T: Test level</p>
            <p>Create your own custom Mario levels and share them!</p>
          </>
        )}
      </div>
    </div>
  )
}
