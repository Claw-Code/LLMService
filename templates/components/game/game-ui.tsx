"use client"

import { useState, useEffect } from "react"
import type { GameState } from "@/types/game"

interface GameUIProps {
  gameState: GameState
  isLoading: boolean
  onRestart: () => void
  onPause: () => void
  onResume: () => void
}

export function GameUI({ gameState, isLoading, onRestart, onPause, onResume }: GameUIProps) {
  const [showMenu, setShowMenu] = useState(false)

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      switch (event.key.toLowerCase()) {
        case "p":
          if (!gameState.gameOver) {
            gameState.paused ? onResume() : onPause()
          }
          break
        case "r":
          if (gameState.gameOver) {
            onRestart()
          }
          break
        case "escape":
          setShowMenu(!showMenu)
          break
      }
    }

    window.addEventListener("keydown", handleKeyPress)
    return () => window.removeEventListener("keydown", handleKeyPress)
  }, [gameState.paused, gameState.gameOver, showMenu, onPause, onResume, onRestart])

  if (isLoading) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75 z-50">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
          <h2 className="text-2xl font-bold mb-2">Loading Game...</h2>
          <p className="text-gray-300">Initializing 3D engine and game systems</p>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* HUD - Always visible during gameplay */}
      <div className="absolute top-4 left-4 right-4 z-40 pointer-events-none">
        <div className="flex justify-between items-start">
          {/* Left side - Score and stats */}
          <div className="bg-black bg-opacity-50 rounded-lg p-4 text-white">
            <div className="text-2xl font-bold mb-1">Score: {gameState.score.toLocaleString()}</div>
            <div className="text-sm text-gray-300">Level: {gameState.level}</div>
            <div className="text-sm text-gray-300">Lives: {"❤️".repeat(gameState.lives)}</div>
            <div className="text-xs text-gray-400 mt-1">High: {gameState.highScore.toLocaleString()}</div>
          </div>

          {/* Right side - Controls */}
          <div className="bg-black bg-opacity-50 rounded-lg p-4 text-white text-right">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="pointer-events-auto bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded text-sm mb-2 block ml-auto"
            >
              Menu
            </button>
            {!gameState.gameOver && (
              <button
                onClick={gameState.paused ? onResume : onPause}
                className="pointer-events-auto bg-blue-600 hover:bg-blue-500 px-3 py-1 rounded text-sm block ml-auto"
              >
                {gameState.paused ? "Resume" : "Pause"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Pause Overlay */}
      {gameState.paused && !gameState.gameOver && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75 z-50">
          <div className="text-center text-white">
            <h2 className="text-4xl font-bold mb-4">PAUSED</h2>
            <p className="text-gray-300 mb-6">Press P to resume or click the button below</p>
            <button
              onClick={onResume}
              className="bg-green-600 hover:bg-green-500 px-6 py-3 rounded-lg text-lg font-semibold"
            >
              Resume Game
            </button>
          </div>
        </div>
      )}

      {/* Game Over Overlay */}
      {gameState.gameOver && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75 z-50">
          <div className="text-center text-white bg-gray-900 rounded-lg p-8 max-w-md">
            <h2 className="text-4xl font-bold mb-4 text-red-500">GAME OVER</h2>

            <div className="mb-6">
              <div className="text-2xl font-bold mb-2">Final Score</div>
              <div className="text-3xl text-yellow-400 mb-4">{gameState.score.toLocaleString()}</div>

              {gameState.score === gameState.highScore && gameState.score > 0 && (
                <div className="text-green-400 font-bold mb-2">🎉 NEW HIGH SCORE! 🎉</div>
              )}

              <div className="text-sm text-gray-400">Level Reached: {gameState.level}</div>
            </div>

            <div className="space-y-3">
              <button
                onClick={onRestart}
                className="w-full bg-green-600 hover:bg-green-500 px-6 py-3 rounded-lg text-lg font-semibold"
              >
                Play Again
              </button>

              <button
                onClick={() => setShowMenu(true)}
                className="w-full bg-gray-600 hover:bg-gray-500 px-6 py-3 rounded-lg text-lg font-semibold"
              >
                Main Menu
              </button>
            </div>

            <p className="text-gray-400 text-sm mt-4">Press R to restart quickly</p>
          </div>
        </div>
      )}

      {/* Main Menu Overlay */}
      {showMenu && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75 z-50">
          <div className="text-center text-white bg-gray-900 rounded-lg p-8 max-w-md">
            <h2 className="text-3xl font-bold mb-6">Game Menu</h2>

            <div className="space-y-3">
              {!gameState.gameOver && (
                <button
                  onClick={() => {
                    setShowMenu(false)
                    if (gameState.paused) onResume()
                  }}
                  className="w-full bg-blue-600 hover:bg-blue-500 px-6 py-3 rounded-lg text-lg font-semibold"
                >
                  Continue Game
                </button>
              )}

              <button
                onClick={() => {
                  setShowMenu(false)
                  onRestart()
                }}
                className="w-full bg-green-600 hover:bg-green-500 px-6 py-3 rounded-lg text-lg font-semibold"
              >
                New Game
              </button>

              <button
                onClick={() => setShowMenu(false)}
                className="w-full bg-gray-600 hover:bg-gray-500 px-6 py-3 rounded-lg text-lg font-semibold"
              >
                Close Menu
              </button>
            </div>

            {/* Game Stats */}
            <div className="mt-6 pt-4 border-t border-gray-700">
              <div className="text-sm text-gray-400">
                <div>High Score: {gameState.highScore.toLocaleString()}</div>
                <div>Current Score: {gameState.score.toLocaleString()}</div>
                <div>Level: {gameState.level}</div>
              </div>
            </div>

            {/* Controls Help */}
            <div className="mt-4 pt-4 border-t border-gray-700">
              <div className="text-xs text-gray-500">
                <div className="font-semibold mb-2">Controls:</div>
                <div>WASD / Arrow Keys - Move</div>
                <div>Space - Jump/Action</div>
                <div>P - Pause</div>
                <div>ESC - Menu</div>
                <div>R - Restart (when game over)</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Performance indicator (development only) */}
      {process.env.NODE_ENV === "development" && (
        <div className="absolute bottom-4 right-4 bg-black bg-opacity-50 rounded px-2 py-1 text-xs text-white z-30">
          FPS: {Math.round(1000 / 16)} | Objects: {gameState.score}
        </div>
      )}
    </>
  )
}
