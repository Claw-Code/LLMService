"use client"

import { useEffect, useRef, useState } from "react"
import { GameEngine } from "./game/game-engine"
import { GameLogic } from "./game/game-logic"
import { GameUI } from "./game/game-ui"
import { GameControls } from "./game/game-controls"
import type { GameState, InputState } from "@/types/game"

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameEngineRef = useRef<GameEngine | null>(null)
  const gameLogicRef = useRef<GameLogic | null>(null)
  const gameControlsRef = useRef<GameControls | null>(null)

  const [gameState, setGameState] = useState<GameState>({
    score: 0,
    level: 1,
    gameOver: false,
    paused: false,
    lives: 3,
    highScore: 0,
  })

  const [inputState, setInputState] = useState<InputState>({
    forward: false,
    backward: false,
    left: false,
    right: false,
    jump: false,
    action: false,
  })

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Initialize game systems
  useEffect(() => {
    const initializeGame = async () => {
      try {
        if (!canvasRef.current) return

        // Initialize game engine (Babylon.js/Phaser)
        gameEngineRef.current = new GameEngine(canvasRef.current)
        await gameEngineRef.current.initialize()

        // Initialize game logic
        gameLogicRef.current = new GameLogic()
        await gameLogicRef.current.initialize()

        // Initialize controls
        gameControlsRef.current = new GameControls(canvasRef.current)
        gameControlsRef.current.initialize()

        // Set up input handling
        gameControlsRef.current.onInputChange = setInputState

        // Set up game state updates
        gameLogicRef.current.onStateChange = setGameState

        setIsLoading(false)
      } catch (err) {
        console.error("Failed to initialize game:", err)
        setError(err instanceof Error ? err.message : "Failed to initialize game")
        setIsLoading(false)
      }
    }

    initializeGame()

    // Cleanup on unmount
    return () => {
      gameControlsRef.current?.dispose()
      gameLogicRef.current?.dispose()
      gameEngineRef.current?.dispose()
    }
  }, [])

  // Game loop
  useEffect(() => {
    if (!gameEngineRef.current || !gameLogicRef.current || isLoading) return

    let animationId: number

    const gameLoop = (timestamp: number) => {
      const deltaTime = gameEngineRef.current!.getDeltaTime()

      // Update game logic
      gameLogicRef.current!.update(deltaTime, inputState)

      // Update graphics
      gameEngineRef.current!.update(deltaTime, gameLogicRef.current!.getGameObjects())

      // Render frame
      gameEngineRef.current!.render()

      animationId = requestAnimationFrame(gameLoop)
    }

    animationId = requestAnimationFrame(gameLoop)

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId)
      }
    }
  }, [inputState, isLoading])

  // Game actions
  const handleRestart = () => {
    gameLogicRef.current?.restart()
  }

  const handlePause = () => {
    gameLogicRef.current?.togglePause()
  }

  const handleResume = () => {
    gameLogicRef.current?.resume()
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-red-900">
        <div className="text-center text-white">
          <h2 className="text-2xl font-bold mb-4">Game Error</h2>
          <p className="mb-4">{error}</p>
          <button onClick={() => window.location.reload()} className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded">
            Reload Game
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen bg-gray-900">
      {/* Game UI Overlay */}
      <GameUI
        gameState={gameState}
        isLoading={isLoading}
        onRestart={handleRestart}
        onPause={handlePause}
        onResume={handleResume}
      />

      {/* Game Canvas */}
      <div className="relative">
        <canvas
          ref={canvasRef}
          className="border border-gray-600 rounded-lg shadow-2xl"
          style={{
            width: "800px",
            height: "600px",
            display: isLoading ? "none" : "block",
          }}
        />

        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-800 rounded-lg">
            <div className="text-white text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
              <p>Loading Game...</p>
            </div>
          </div>
        )}
      </div>

      {/* Controls Help */}
      <div className="mt-4 text-center">
        <p className="text-gray-400 text-sm">Use WASD or Arrow Keys to move • Space for action • P to pause</p>
      </div>
    </div>
  )
}
