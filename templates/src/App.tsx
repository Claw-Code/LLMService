"use client"

import type React from "react"
import { useState } from "react"
import ScreensaverScene from "./components/PhaserGame"
import BabylonGame from "./components/BabylonGame"

const App: React.FC = () => {
  const [gameMode, setGameMode] = useState<"phaser" | "babylon">("phaser")

  return (
    <div>
      {/* Toggle button */}
      <div style={{ position: "absolute", zIndex: 10, top: 10, left: 10 }}>
        <button onClick={() => setGameMode("phaser")} style={{ marginRight: 10 }}>
          Phaser Game
        </button>
        <button onClick={() => setGameMode("babylon")}>Babylon Game</button>
      </div>

      {/* Render selected game */}
      {gameMode === "phaser" ? <ScreensaverScene /> : <BabylonGame />}
    </div>
  )
}

export default App
