"use client"

import type React from "react"
import { useEffect, useRef } from "react"

const FullScreenBabylon240FPS: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!canvasRef.current) return

    import("babylonjs")
      .then((BABYLON) => {
        const BABYLONModule = BABYLON.default || BABYLON
        const canvas = canvasRef.current!
        canvas.style.width = "100%"
        canvas.style.height = "100%"
        canvas.style.position = "fixed"
        canvas.style.top = "0"
        canvas.style.left = "0"

        const engine = new BABYLONModule.Engine(canvas, true, {
          preserveDrawingBuffer: true,
          stencil: true,
        })

        engine.setHardwareScalingLevel(1)

        const scene = new BABYLONModule.Scene(engine)

        // Slanted camera
        const camera = new BABYLONModule.ArcRotateCamera(
          "camera",
          -Math.PI / 4,
          Math.PI / 4.2,
          10,
          BABYLONModule.Vector3.Zero(),
          scene,
        )
        camera.attachControl(canvas, true)

        const light = new BABYLONModule.HemisphericLight("light", new BABYLONModule.Vector3(0, 1, 0), scene)
        light.intensity = 1

        const box = BABYLONModule.MeshBuilder.CreateBox("box", { size: 2 }, scene)
        const mat = new BABYLONModule.StandardMaterial("boxMat", scene)
        mat.diffuseColor = new BABYLONModule.Color3(0, 1, 0)
        box.material = mat

        // 240 FPS render loop
        const targetFPS = 240
        const frameInterval = 1000 / targetFPS
        let lastTime = performance.now()

        const renderLoop = () => {
          const now = performance.now()
          const delta = now - lastTime

          if (delta >= frameInterval) {
            box.rotation.y += 0.01
            box.rotation.x += 0.005
            scene.render()
            lastTime = now - (delta % frameInterval) // maintain accuracy
          }

          requestAnimationFrame(renderLoop)
        }

        renderLoop()

        const handleResize = () => engine.resize()
        window.addEventListener("resize", handleResize)

        return () => {
          window.removeEventListener("resize", handleResize)
          engine.dispose()
        }
      })
      .catch((error) => {
        console.error("Failed to load Babylon.js:", error)
      })
  }, [])

  return <canvas ref={canvasRef} />
}

export default FullScreenBabylon240FPS
