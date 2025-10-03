"use client"

import Groq from "groq-sdk"
import { traceFunction } from "./langsmith-tracer.js"
import chalk from "chalk"
import dotenv from "dotenv"

dotenv.config()

export class TracedLLMProvider {
  constructor() {
    this.groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY })
  }

  async generateSimple2WebGame(gamePrompt, difficulty = "medium") {
    return await traceFunction(
      "Complete-Simple2-Responsive-Chain-Groq",
      async () => {
        console.log(chalk.blue(`🚀 Starting SIMPLE2 RESPONSIVE chain for: ${gamePrompt}`))

        const architecture = " ";
        
        // Step 3: Initial Responsive Code with Groq
        console.log(chalk.cyan("🚀 STEP 3: Initial Responsive Code Generation (Groq)..."))
        const initialCode = await this.generateInitialCodeWithGroq(gamePrompt, "120")

        console.log(chalk.green("✅ Using initial code as final output - steps 4 and 5 skipped"))
        const finalCode = initialCode;
        console.log(finalCode);

        console.log(chalk.blue(`✅ SIMPLE2 RESPONSIVE chain completed for: ${gamePrompt}`))

        return {
          architecture,
          initialCode,
          feedback: "null",
          finalCode,
          webGameCode: finalCode,
          chainType: "simple2-responsive",
          bugDetection: { hasBugs: false, skipped: true },
        }
      },
      {
        gamePrompt: gamePrompt,
        difficulty: difficulty,
      },
      { operation: "complete-simple2-responsive-chain-groq" },
    )
  }

  async generateInitialCodeWithGroq(gamePrompt, chatId) {
    return await traceFunction(
      "Groq-Initial-Responsive-Code",
      async () => {
        console.log(chalk.green(`🚀 Generating initial responsive Canvas/3D game code based on instructions...`));
        
        const is3D = false;
        
        const promptObject = {
          instruction: "Create a game in exactly this format:",
          
          template: `"use client"
        import React, { useEffect, useRef, useState, useCallback } from 'react';
        
        export default function GameComponent() {
          const canvasRef = useRef<HTMLCanvasElement>(null);
          const [gameState, setGameState] = useState<'menu' | 'playing' | 'gameover'>('menu');
          const [score, setScore] = useState(0);
          
          // ALL GAME CODE GOES HERE
          // - Canvas 2D rendering
          // - Game loop with requestAnimationFrame
          // - Touch/click + keyboard controls
          // - Start menu, gameplay, game over screen
          
          return (
            <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', touchAction: 'none' }}>
              <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
            </div>
          );
        }`,
        
          requirements: [
            "Fill in the GameComponent function with a complete game",
            "Use Canvas 2D API only - no external libraries except React",
            "Must work on mobile (touch) and desktop (keyboard)",
            "Include: start menu, gameplay, score, game over, restart",
            "Canvas must resize properly with window",
            "Simple graphics - just use fillRect, fillCircle, etc",
            "Keep it under 300 lines of code"
          ],
        
          game_request: gamePrompt,
          
          output: "Return ONLY the code starting with 'use client'. No explanations."
        };
  
        const messages = [
          {
            role: "system",
            content: "You are a world-class React + TypeScript game developer."
          },
          {
            role: "user",
            content: JSON.stringify(promptObject)
          }
        ];
  
        const chatCompletion = await this.groqClient.chat.completions.create({
          messages,
          model: "openai/gpt-oss-120b",
          temperature: 0.1,
          max_tokens: 40000,
          top_p: 1,
          stream: false,
        });
  
        const response = chatCompletion.choices[0]?.message?.content || "";
        console.log(chalk.green(`✅ GameComponent generated: ${response} `));
        return response;
      },
      {
        step: "initial-code",
        provider: "openai/gpt-oss-120b",
        engine: "CANVAS_2D_OR_3D",
      },
    );
  }
}

export default TracedLLMProvider