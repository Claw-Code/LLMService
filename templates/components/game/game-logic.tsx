import type { GameState, GameObject, InputState } from "@/types/game"

export class GameLogic {
  private gameState: GameState
  private gameObjects: GameObject[] = []
  private player: GameObject | null = null
  private enemies: GameObject[] = []
  private collectibles: GameObject[] = []
  private obstacles: GameObject[] = []

  public onStateChange?: (state: GameState) => void

  private lastUpdate = 0
  private spawnTimer = 0
  private difficultyTimer = 0

  constructor() {
    this.gameState = {
      score: 0,
      level: 1,
      gameOver: false,
      paused: false,
      lives: 3,
      highScore: this.loadHighScore(),
    }
  }

  async initialize(): Promise<void> {
    try {
      // Create player
      this.player = {
        id: "player",
        x: 0,
        y: 1,
        z: 0,
        width: 1,
        height: 1,
        depth: 1,
        active: true,
        type: "player",
        velocity: { x: 0, y: 0, z: 0 },
        health: 100,
        speed: 5,
      }

      this.gameObjects.push(this.player)

      // Create initial collectibles
      this.spawnCollectibles(5)

      // Create initial obstacles
      this.spawnObstacles(3)

      console.log("Game Logic initialized successfully")
    } catch (error) {
      console.error("Failed to initialize game logic:", error)
      throw error
    }
  }

  update(deltaTime: number, input: InputState): void {
    if (this.gameState.gameOver || this.gameState.paused) return

    // Update timers
    this.spawnTimer += deltaTime
    this.difficultyTimer += deltaTime

    // Update player
    if (this.player) {
      this.updatePlayer(this.player, deltaTime, input)
    }

    // Update enemies
    this.enemies.forEach((enemy) => {
      this.updateEnemy(enemy, deltaTime)
    })

    // Update collectibles (rotation animation)
    this.collectibles.forEach((collectible) => {
      if (collectible.rotation) {
        collectible.rotation.y += deltaTime * 2
      } else {
        collectible.rotation = { x: 0, y: 0, z: 0 }
      }
    })

    // Check collisions
    this.checkCollisions()

    // Spawn new objects
    if (this.spawnTimer > 3) {
      this.spawnEnemy()
      this.spawnTimer = 0
    }

    // Increase difficulty
    if (this.difficultyTimer > 30) {
      this.gameState.level++
      this.difficultyTimer = 0
      this.spawnCollectibles(2)
    }

    // Update game state
    this.updateGameState()
  }

  private updatePlayer(player: GameObject, deltaTime: number, input: InputState): void {
    const speed = player.speed || 5

    // Handle movement
    if (input.left) player.velocity!.x = -speed
    else if (input.right) player.velocity!.x = speed
    else player.velocity!.x *= 0.8 // Friction

    if (input.forward) player.velocity!.z = speed
    else if (input.backward) player.velocity!.z = -speed
    else player.velocity!.z *= 0.8 // Friction

    // Handle jumping
    if (input.jump && player.y <= 1) {
      player.velocity!.y = 8
    }

    // Apply gravity
    player.velocity!.y -= 20 * deltaTime

    // Update position
    player.x += player.velocity!.x * deltaTime
    player.y += player.velocity!.y * deltaTime
    player.z += player.velocity!.z * deltaTime

    // Ground collision
    if (player.y < 1) {
      player.y = 1
      player.velocity!.y = 0
    }

    // Boundary constraints
    player.x = Math.max(-20, Math.min(20, player.x))
    player.z = Math.max(-20, Math.min(20, player.z))
  }

  private updateEnemy(enemy: GameObject, deltaTime: number): void {
    if (!this.player) return

    // Simple AI: move towards player
    const dx = this.player.x - enemy.x
    const dz = this.player.z - enemy.z
    const distance = Math.sqrt(dx * dx + dz * dz)

    if (distance > 0.1) {
      const speed = (enemy.speed || 2) * deltaTime
      enemy.x += (dx / distance) * speed
      enemy.z += (dz / distance) * speed
    }

    // Remove enemies that are too far
    if (distance > 30) {
      enemy.active = false
    }
  }

  private checkCollisions(): void {
    if (!this.player) return

    // Check collectible collisions
    this.collectibles.forEach((collectible) => {
      if (collectible.active && this.isColliding(this.player!, collectible)) {
        collectible.active = false
        this.gameState.score += 10
        this.spawnCollectibles(1)
      }
    })

    // Check enemy collisions
    this.enemies.forEach((enemy) => {
      if (enemy.active && this.isColliding(this.player!, enemy)) {
        this.gameState.lives--
        enemy.active = false

        if (this.gameState.lives <= 0) {
          this.gameOver()
        }
      }
    })

    // Check obstacle collisions
    this.obstacles.forEach((obstacle) => {
      if (obstacle.active && this.isColliding(this.player!, obstacle)) {
        // Push player away from obstacle
        const dx = this.player!.x - obstacle.x
        const dz = this.player!.z - obstacle.z
        const distance = Math.sqrt(dx * dx + dz * dz)

        if (distance > 0) {
          this.player!.x = obstacle.x + (dx / distance) * 2
          this.player!.z = obstacle.z + (dz / distance) * 2
        }
      }
    })

    // Remove inactive objects
    this.gameObjects = this.gameObjects.filter((obj) => obj.active)
    this.enemies = this.enemies.filter((enemy) => enemy.active)
    this.collectibles = this.collectibles.filter((collectible) => collectible.active)
  }

  private isColliding(obj1: GameObject, obj2: GameObject): boolean {
    const dx = obj1.x - obj2.x
    const dy = obj1.y - obj2.y
    const dz = (obj1.z || 0) - (obj2.z || 0)
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz)

    const minDistance = (obj1.width + obj2.width) / 2
    return distance < minDistance
  }

  private spawnEnemy(): void {
    const angle = Math.random() * Math.PI * 2
    const distance = 15 + Math.random() * 10

    const enemy: GameObject = {
      id: `enemy_${Date.now()}`,
      x: Math.cos(angle) * distance,
      y: 1,
      z: Math.sin(angle) * distance,
      width: 1,
      height: 1,
      depth: 1,
      active: true,
      type: "enemy",
      velocity: { x: 0, y: 0, z: 0 },
      speed: 2 + this.gameState.level * 0.5,
    }

    this.enemies.push(enemy)
    this.gameObjects.push(enemy)
  }

  private spawnCollectibles(count: number): void {
    for (let i = 0; i < count; i++) {
      const collectible: GameObject = {
        id: `collectible_${Date.now()}_${i}`,
        x: (Math.random() - 0.5) * 30,
        y: 1.5,
        z: (Math.random() - 0.5) * 30,
        width: 0.8,
        height: 0.5,
        depth: 0.8,
        active: true,
        type: "collectible",
        rotation: { x: 0, y: 0, z: 0 },
      }

      this.collectibles.push(collectible)
      this.gameObjects.push(collectible)
    }
  }

  private spawnObstacles(count: number): void {
    for (let i = 0; i < count; i++) {
      const obstacle: GameObject = {
        id: `obstacle_${Date.now()}_${i}`,
        x: (Math.random() - 0.5) * 40,
        y: 1.5,
        z: (Math.random() - 0.5) * 40,
        width: 2,
        height: 3,
        depth: 1,
        active: true,
        type: "obstacle",
      }

      this.obstacles.push(obstacle)
      this.gameObjects.push(obstacle)
    }
  }

  private updateGameState(): void {
    // Update high score
    if (this.gameState.score > this.gameState.highScore) {
      this.gameState.highScore = this.gameState.score
      this.saveHighScore(this.gameState.highScore)
    }

    // Notify state change
    if (this.onStateChange) {
      this.onStateChange({ ...this.gameState })
    }
  }

  private gameOver(): void {
    this.gameState.gameOver = true
    console.log("Game Over! Final Score:", this.gameState.score)
  }

  private loadHighScore(): number {
    try {
      return Number.parseInt(localStorage.getItem("gameHighScore") || "0")
    } catch {
      return 0
    }
  }

  private saveHighScore(score: number): void {
    try {
      localStorage.setItem("gameHighScore", score.toString())
    } catch {
      // Ignore localStorage errors
    }
  }

  // Public methods
  getGameObjects(): GameObject[] {
    return this.gameObjects
  }

  getGameState(): GameState {
    return { ...this.gameState }
  }

  restart(): void {
    this.gameState = {
      score: 0,
      level: 1,
      gameOver: false,
      paused: false,
      lives: 3,
      highScore: this.gameState.highScore,
    }

    // Reset game objects
    this.gameObjects = []
    this.enemies = []
    this.collectibles = []
    this.obstacles = []

    // Reinitialize
    this.initialize()
  }

  togglePause(): void {
    this.gameState.paused = !this.gameState.paused
  }

  resume(): void {
    this.gameState.paused = false
  }

  dispose(): void {
    // Clean up any resources
    this.gameObjects = []
    this.enemies = []
    this.collectibles = []
    this.obstacles = []
  }
}
