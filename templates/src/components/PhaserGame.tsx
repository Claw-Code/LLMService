"use client"

import type React from "react"
import { useEffect, useRef } from "react"

const NUM_BALLS = 20
const BALL_SIZE = 40
const BALL_SPEED = 200

type PhaserScene = any
type PhaserImage = any
type PhaserKey = any

class ScreensaverScene {
  private scene!: PhaserScene
  private balls: PhaserImage[] = []
  private velocities: { x: number; y: number }[] = []
  private keys!: { [key: string]: PhaserKey }

  preload(scene: PhaserScene) {
    this.scene = scene

    const graphics = scene.make.graphics({ x: 0, y: 0 })
    graphics.fillStyle(0xffffff, 1)
    graphics.fillCircle(BALL_SIZE / 2, BALL_SIZE / 2, BALL_SIZE / 2)
    graphics.generateTexture("ball", BALL_SIZE, BALL_SIZE)
  }

  create(scene: PhaserScene) {
    this.scene = scene

    // WASD keys
    this.keys = {
      W: scene.input.keyboard!.addKey("W"),
      A: scene.input.keyboard!.addKey("A"),
      S: scene.input.keyboard!.addKey("S"),
      D: scene.input.keyboard!.addKey("D"),
    }

    for (let i = 0; i < NUM_BALLS; i++) {
      const ball = scene.add.image(Math.random() * scene.scale.width, Math.random() * scene.scale.height, "ball")
      ball.setTint((window as any).Phaser?.Display?.Color?.RandomRGB()?.color || 0xffffff)
      this.balls.push(ball)

      // Random initial direction
      const angle = Math.random() * Math.PI * 2
      this.velocities.push({ x: Math.cos(angle) * BALL_SPEED, y: Math.sin(angle) * BALL_SPEED })
    }
  }

  update(time: number, delta: number) {
    const dt = delta / 1000

    // WASD input
    let dirX = 0
    let dirY = 0

    if (this.keys.A?.isDown) dirX = -1
    else if (this.keys.D?.isDown) dirX = 1

    if (this.keys.W?.isDown) dirY = -1
    else if (this.keys.S?.isDown) dirY = 1

    if (dirX !== 0 || dirY !== 0) {
      const length = Math.sqrt(dirX * dirX + dirY * dirY)
      for (let i = 0; i < this.velocities.length; i++) {
        this.velocities[i].x = (dirX / length) * BALL_SPEED
        this.velocities[i].y = (dirY / length) * BALL_SPEED
      }
    }

    // Move balls
    for (let i = 0; i < this.balls.length; i++) {
      const ball = this.balls[i]
      const vel = this.velocities[i]

      ball.x += vel.x * dt
      ball.y += vel.y * dt

      const half = BALL_SIZE / 2
      let bounced = false

      if (ball.x < half) {
        ball.x = half
        vel.x *= -1
        bounced = true
      } else if (ball.x > this.scene.scale.width - half) {
        ball.x = this.scene.scale.width - half
        vel.x *= -1
        bounced = true
      }

      if (ball.y < half) {
        ball.y = half
        vel.y *= -1
        bounced = true
      } else if (ball.y > this.scene.scale.height - half) {
        ball.y = this.scene.scale.height - half
        vel.y *= -1
        bounced = true
      }

      if (bounced) {
        ball.setTint((window as any).Phaser?.Display?.Color?.RandomRGB()?.color || Math.random() * 0xffffff)
      }
    }
  }

  resize({ width, height }: { width: number; height: number }) {}
}

const PhaserScreensaver: React.FC = () => {
  const gameRef = useRef<HTMLDivElement>(null)
  const phaserGameRef = useRef<any>(null)
  const screensaverRef = useRef(new ScreensaverScene())

  useEffect(() => {
    if (!gameRef.current) return

    import("phaser").then((PhaserModule) => {
      const Phaser = PhaserModule.default || PhaserModule

      class ScreensaverPhaserScene extends Phaser.Scene {
        private logic = screensaverRef.current
        preload() {
          this.logic.preload(this)
        }
        create() {
          this.logic.create(this)
        }
        update(time: number, delta: number) {
          this.logic.update(time, delta)
        }
      }

      const config: any = {
        type: Phaser.AUTO,
        width: window.innerWidth,
        height: window.innerHeight,
        parent: gameRef.current,
        backgroundColor: "#000000",
        physics: { default: "arcade", arcade: { gravity: { x: 0, y: 0 }, debug: false } },
        scene: ScreensaverPhaserScene,
        scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH },
      }

      phaserGameRef.current = new Phaser.Game(config)

      const handleResize = () => {
        phaserGameRef.current?.scale.resize(window.innerWidth, window.innerHeight)
        screensaverRef.current.resize({ width: window.innerWidth, height: window.innerHeight })
      }
      window.addEventListener("resize", handleResize)

      return () => window.removeEventListener("resize", handleResize)
    })

    return () => {
      if (phaserGameRef.current) {
        phaserGameRef.current.destroy(true)
        phaserGameRef.current = null
      }
    }
  }, [])

  return <div ref={gameRef} style={{ width: "100vw", height: "100vh" }} />
}

export default PhaserScreensaver
