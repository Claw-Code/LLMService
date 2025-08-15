"use client"

import { useRef, useState, useEffect } from "react"
import { Button } from "../components/ui/button"
import { Card, CardContent } from "../components/ui/card"
import { Play, Pause, RotateCcw, Home } from "lucide-react" // Proper icon imports
import type { GameState, GamePhase } from "../types/game"

/**
 * MAIN GAME PAGE - ALL GAME LOGIC IN ONE PLACE
 *
 * This page handles everything:
 * - Game state management
 * - Canvas rendering and game loop
 * - User interface (menus, HUD, overlays)
 * - Input handling (keyboard, mouse, touch)
 * - Game logic and rules
 * - Responsive design for all devices
 */
export default function GamePage() {
  // Canvas reference for game rendering
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Game state management
  const [gamePhase, setGamePhase] = useState<GamePhase>("menu")
  const [gameState, setGameState] = useState<GameState>({
    score: 0,
    highScore: Number.parseInt(localStorage?.getItem("game-highscore") || "0"),
    lives: 3,
    level: 1,
    gameOver: false,
    paused: false,
  })

  // Loading and error states
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * GAME CONTROL METHODS
   */
  const startGame = () => {
    setGamePhase("playing")
    setGameState((prev) => ({ ...prev, gameOver: false, paused: false }))
  }

  const pauseGame = () => {
    setGamePhase("paused")
    setGameState((prev) => ({ ...prev, paused: true }))
  }

  const resumeGame = () => {
    setGamePhase("playing")
    setGameState((prev) => ({ ...prev, paused: false }))
  }

  const resetGame = () => {
    setGameState((prev) => ({
      ...prev,
      score: 0,
      lives: 3,
      level: 1,
      gameOver: false,
      paused: false,
    }))
    setGamePhase("menu")
  }

  const updateScore = (score: number) => {
    setGameState((prev) => {
      const newHighScore = Math.max(score, prev.highScore)
      if (newHighScore > prev.highScore) {
        localStorage?.setItem("game-highscore", newHighScore.toString())
      }
      return { ...prev, score, highScore: newHighScore }
    })
  }

  const gameOver = () => {
    setGamePhase("gameOver")
    setGameState((prev) => ({ ...prev, gameOver: true }))
  }

  /**
   * GAME ENGINE - CANVAS RENDERING AND GAME LOOP
   */
  useEffect(() => {
    if (!canvasRef.current || gamePhase !== "playing") return

    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Responsive canvas sizing with DPI scaling
    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1
      const rect = canvas.getBoundingClientRect()

      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr

      ctx.scale(dpr, dpr)
      canvas.style.width = rect.width + "px"
      canvas.style.height = rect.height + "px"
    }

    resizeCanvas()
    window.addEventListener("resize", resizeCanvas)

    // Game objects initialization
    const game = {
      // Initialize your game objects here
      player: {
        x: canvas.width * 0.1,
        y: canvas.height / 2,
        width: 40,
        height: 30,
        velocity: { x: 0, y: 0 },
        speed: 5,
      },
      // Add more game objects as needed
    }

    let animationId: number

    /**
     * MAIN GAME LOOP
     */
    const gameLoop = () => {
      if (gamePhase !== "playing") return

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width / (window.devicePixelRatio || 1), canvas.height / (window.devicePixelRatio || 1))

      // UPDATE GAME OBJECTS
      // Add your game update logic here

      // RENDER GAME OBJECTS
      // Add your rendering code here

      // Example: Draw player
      ctx.fillStyle = "#FFD700"
      ctx.fillRect(game.player.x, game.player.y, game.player.width, game.player.height)

      // COLLISION DETECTION
      // Add collision detection logic here

      // GAME LOGIC
      // Add scoring, win/lose conditions here

      // Continue game loop
      if (gamePhase === "playing") {
        animationId = requestAnimationFrame(gameLoop)
      }
    }

    gameLoop()

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId)
      }
      window.removeEventListener("resize", resizeCanvas)
    }
  }, [gamePhase, gameState])

  /**
   * INPUT HANDLING - KEYBOARD, MOUSE, TOUCH
   */
  useEffect(() => {
    if (gamePhase !== "playing") return

    // Keyboard controls
    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.code) {
        case "Space":
          event.preventDefault()
          // Handle space key action
          break
        case "ArrowUp":
        case "KeyW":
          event.preventDefault()
          // Handle up movement
          break
        case "ArrowDown":
        case "KeyS":
          event.preventDefault()
          // Handle down movement
          break
        case "ArrowLeft":
        case "KeyA":
          event.preventDefault()
          // Handle left movement
          break
        case "ArrowRight":
        case "KeyD":
          event.preventDefault()
          // Handle right movement
          break
        case "Escape":
          event.preventDefault()
          pauseGame()
          break
      }
    }

    // Mouse controls
    const handleMouseDown = (event: MouseEvent) => {
      if (event.button === 0) {
        event.preventDefault()
        // Handle mouse click
      }
    }

    // Touch controls for mobile
    const handleTouchStart = (event: TouchEvent) => {
      event.preventDefault()
      const touch = event.touches[0]
      const rect = canvasRef.current?.getBoundingClientRect()
      if (rect) {
        const x = touch.clientX - rect.left
        const y = touch.clientY - rect.top
        // Handle touch with proper scaling
      }
    }

    // Add event listeners
    window.addEventListener("keydown", handleKeyDown)
    document.addEventListener("mousedown", handleMouseDown)
    document.addEventListener("touchstart", handleTouchStart, { passive: false })

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      document.removeEventListener("mousedown", handleMouseDown)
      document.removeEventListener("touchstart", handleTouchStart)
    }
  }, [gamePhase])

  /**
   * RESPONSIVE UI RENDERING
   */

  // Error State
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-destructive/90 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-4 sm:p-6 md:p-8 text-center">
            <h2 className="text-xl sm:text-2xl font-bold mb-4">Game Error</h2>
            <p className="text-sm sm:text-base mb-4">{error}</p>
            <Button onClick={() => window.location.reload()} className="w-full sm:w-auto">
              Reload Game
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Loading State
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black/75 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-4 sm:p-6 md:p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 sm:h-16 sm:w-16 border-b-2 border-primary mx-auto mb-4"></div>
            <h2 className="text-xl sm:text-2xl font-bold mb-2">Loading Game...</h2>
            <p className="text-sm sm:text-base text-muted-foreground">Initializing game systems...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="relative w-full h-screen overflow-hidden bg-background">
      {/* GAME CANVAS - Only render when playing or paused */}
      {(gamePhase === "playing" || gamePhase === "paused") && (
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full block cursor-pointer"
          style={{
            imageRendering: "pixelated",
            touchAction: "none",
          }}
        />
      )}

      {/* MENU SCREEN - Responsive main menu */}
      {gamePhase === "menu" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-primary/20 to-secondary/20 z-40 p-4">
          <Card className="w-full max-w-sm sm:max-w-md lg:max-w-lg">
            <CardContent className="p-4 sm:p-6 md:p-8 text-center">
              <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-4 text-primary">🎮 Game</h1>
              <p className="text-lg sm:text-xl md:text-2xl mb-6 sm:mb-8 text-muted-foreground">Ready to play?</p>
              <div className="space-y-3 sm:space-y-4 mb-4 sm:mb-6">
                <Button
                  onClick={startGame}
                  size="lg"
                  className="w-full sm:w-auto text-base sm:text-lg md:text-xl px-8 sm:px-12"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Start Game
                </Button>
              </div>
              <div className="text-center">
                <p className="text-xs sm:text-sm text-muted-foreground mb-2">High Score</p>
                <p className="text-xl sm:text-2xl font-bold text-primary">{gameState.highScore}</p>
              </div>
            </CardContent>
          </Card>
          <div className="absolute bottom-4 sm:bottom-8 text-center text-muted-foreground text-xs sm:text-sm px-4">
            <p>🎮 Use keyboard, mouse, or touch controls</p>
          </div>
        </div>
      )}

      {/* PLAYING HUD - Responsive game interface */}
      {gamePhase === "playing" && (
        <div className="absolute inset-0 pointer-events-none z-30">
          {/* Score Display - Top left */}
          <div className="absolute top-2 sm:top-4 left-2 sm:left-4">
            <Card className="bg-background/80 backdrop-blur-sm">
              <CardContent className="p-2 sm:p-3 md:p-4">
                <div className="text-xs sm:text-sm text-muted-foreground">Score</div>
                <div className="text-lg sm:text-xl md:text-2xl font-bold text-primary">{gameState.score}</div>
              </CardContent>
            </Card>
          </div>

          {/* Lives Display - Top right */}
          <div className="absolute top-2 sm:top-4 right-2 sm:right-4">
            <Card className="bg-background/80 backdrop-blur-sm">
              <CardContent className="p-2 sm:p-3 md:p-4">
                <div className="text-xs sm:text-sm text-muted-foreground">Lives</div>
                <div className="text-lg sm:text-xl md:text-2xl font-bold text-primary">{gameState.lives}</div>
              </CardContent>
            </Card>
          </div>

          {/* Pause Button - Top center */}
          <div className="absolute top-2 sm:top-4 left-1/2 transform -translate-x-1/2">
            <Button
              onClick={pauseGame}
              className="pointer-events-auto bg-background/80 backdrop-blur-sm text-xs sm:text-sm"
              variant="outline"
              size="sm"
            >
              <Pause className="w-4 h-4 mr-2" />
              Pause
            </Button>
          </div>

          {/* Mobile touch hint */}
          <div className="sm:hidden absolute bottom-4 left-1/2 transform -translate-x-1/2">
            <div className="bg-background/80 backdrop-blur-sm rounded-lg px-3 py-2">
              <p className="text-xs text-center text-muted-foreground">Tap to play</p>
            </div>
          </div>
        </div>
      )}

      {/* PAUSED SCREEN - Responsive pause menu */}
      {gamePhase === "paused" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/75 z-50 p-4">
          <Card className="w-full max-w-sm sm:max-w-md">
            <CardContent className="p-4 sm:p-6 md:p-8 text-center">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4 sm:mb-6">⏸️ Paused</h2>
              <div className="text-lg sm:text-xl mb-4 sm:mb-6">Score: {gameState.score}</div>
              <div className="space-y-3 sm:space-y-4">
                <Button onClick={resumeGame} size="lg" className="w-full text-base sm:text-lg">
                  <Play className="w-4 h-4 mr-2" />
                  Resume
                </Button>
                <Button
                  onClick={resetGame}
                  variant="outline"
                  size="lg"
                  className="w-full bg-transparent text-base sm:text-lg"
                >
                  <Home className="w-4 h-4 mr-2" />
                  Main Menu
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* GAME OVER SCREEN - Responsive game over */}
      {gamePhase === "gameOver" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/75 z-50 p-4">
          <Card className="w-full max-w-sm sm:max-w-md">
            <CardContent className="p-4 sm:p-6 md:p-8 text-center">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-destructive">💥 Game Over</h2>

              {gameState.score === gameState.highScore && gameState.score > 0 && (
                <div className="text-lg sm:text-xl md:text-2xl font-bold text-yellow-500 mb-4 animate-pulse">
                  🎉 NEW HIGH SCORE! 🎉
                </div>
              )}

              <div className="mb-4 sm:mb-6 space-y-2">
                <div className="text-lg sm:text-xl md:text-2xl font-bold">Final Score</div>
                <div className="text-2xl sm:text-3xl md:text-4xl text-primary font-bold">{gameState.score}</div>
                <div className="text-xs sm:text-sm text-muted-foreground">High Score: {gameState.highScore}</div>
              </div>

              <div className="space-y-3">
                <Button onClick={startGame} size="lg" className="w-full text-base sm:text-lg">
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Play Again
                </Button>
                <Button
                  onClick={resetGame}
                  variant="outline"
                  size="lg"
                  className="w-full bg-transparent text-base sm:text-lg"
                >
                  <Home className="w-4 h-4 mr-2" />
                  Main Menu
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
