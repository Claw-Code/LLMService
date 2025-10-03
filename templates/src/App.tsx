"use client"

import type React from "react"
import { useState } from "react"
import ScreensaverScene from "./components/PhaserGame"
import BabylonGame from "./components/BabylonGame"
import GameComponent from "./components/GameComponent"

const App: React.FC = () => {
  const [gameMode, setGameMode] = useState<"phaser" | "babylon">("phaser")

  return (
    <div>
    <GameComponent></GameComponent>
    </div>
  )
}

export default App
