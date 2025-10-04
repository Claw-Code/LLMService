"use client"

import Groq from "groq-sdk"
import { traceFunction } from "./langsmith-tracer.js"
import chalk from "chalk"
import dotenv from "dotenv"

dotenv.config()

export class TracedLLMProvider {
  constructor() {
    this.groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY })
    this.superMemoryApiKey = process.env.SUPERMEMORY_API_KEY
    this.superMemoryApiUrl = "https://api.supermemory.ai/v3"
  }

  // Search SuperMemory using v3 API
  async searchSimilarGames(gamePrompt) {
    try {
      const response = await fetch(`${this.superMemoryApiUrl}/search`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.superMemoryApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          q: gamePrompt  // Note: API uses 'q' not 'query'
        })
      })
      
      if (!response.ok) {
        const error = await response.text()
        throw new Error(`SuperMemory search failed: ${error}`)
      }
      
      const data = await response.json()
      return data.results || []
    } catch (error) {
      console.warn("SuperMemory search failed:", error)
      return []
    }
  }
  
  // Comprehensive game analysis with thinking stage and assets
  async analyzeGameMechanics(gamePrompt) {
    return await traceFunction(
      "Comprehensive-Game-Analysis",
      async () => {
        console.log(chalk.magenta("🧠 Starting comprehensive game analysis with thinking stage..."))
        
        const analysisPrompt = {
          task: "Comprehensive game design analysis with thinking process and assets",
          game_idea: gamePrompt,
          instructions: [
            "STEP 1: Think step by step about what type of game this is",
            "STEP 2: Break down the core gameplay mechanics (4 bullet points with •)",
            "STEP 3: List visual assets needed (sprites, backgrounds, UI, effects)",
            "STEP 4: List audio assets needed (sounds, music)",
            "STEP 5: Provide JavaScript code snippets for generating each asset with Canvas 2D API",
            "STEP 6: Add implementation notes and technical considerations"
          ],
          output_format: "Provide complete analysis in structured format - all sections will be passed to code generator"
        }

        const messages = [
          {
            role: "system",
            content: "You are an expert game designer and technical architect. Provide comprehensive analysis that will be directly passed to a code generator. Be thorough and technical."
          },
          {
            role: "user",
            content: JSON.stringify(analysisPrompt)
          }
        ]

        const chatCompletion = await this.groqClient.chat.completions.create({
          messages,
          model: "llama-3.3-70b-versatile",
          temperature: 0.7,
          max_tokens: 3000,
          top_p: 0.9,
          stream: false,
        })

        const fullAnalysis = chatCompletion.choices[0]?.message?.content || ""
        console.log(chalk.yellow(`📋 Complete Game Analysis:\n${fullAnalysis}`))
        return fullAnalysis
      },
      {
        step: "comprehensive-analysis",
        provider: "llama-3.3-70b-versatile",
        gamePrompt: gamePrompt
      }
    )
  }

  async generateSimple2WebGame(gamePrompt, difficulty = "medium") {
    return await traceFunction(
      "Complete-Enhanced-Game-Generation-Chain",
      async () => {
        console.log(chalk.blue(`🚀 Starting ENHANCED GAME GENERATION chain for: ${gamePrompt}`))

        // STEP 1: Comprehensive Analysis with Thinking Stage
        console.log(chalk.cyan("🧠 STEP 1: Comprehensive game analysis with thinking process..."))
        const gameAnalysis = await this.analyzeGameMechanics(gamePrompt)

        // STEP 2: Search for Similar Games
        console.log(chalk.cyan("🔍 STEP 2: Searching SuperMemory for similar games..."))
        const similarGames = await this.searchSimilarGames(gamePrompt)
        
        if (similarGames.length > 0) {
          console.log(chalk.yellow(`📚 Found ${similarGames.length} similar games in memory`))
          similarGames.slice(0, 3).forEach((result, index) => {
            const snippet = result.content?.substring(0, 100) || 'No content'
            console.log(chalk.gray(`   ${index + 1}. ${snippet}...`))
          })
        }

        // STEP 3: Generate Code with Complete Analysis
        console.log(chalk.cyan("🚀 STEP 3: Enhanced Code Generation with Analysis..."))
        const initialCode = await this.generateInitialCodeWithGroq(
          gamePrompt, 
          "120",
          similarGames,
          gameAnalysis  // Pass full analysis directly
        )

        console.log(chalk.green("✅ Using enhanced code as final output"))
        const finalCode = initialCode;
        console.log(chalk.blue("📝 Final code preview:"), finalCode.substring(0, 200) + "...")

        console.log(chalk.blue(`✅ ENHANCED GAME GENERATION chain completed for: ${gamePrompt}`))

        return {
          architecture: gameAnalysis,
          gameAnalysis: gameAnalysis,
          initialCode,
          feedback: "null",
          finalCode,
          webGameCode: finalCode,
          chainType: "enhanced-responsive-with-assets",
          bugDetection: { hasBugs: false, skipped: true },
          similarGamesFound: similarGames.length
        }
      },
      {
        gamePrompt: gamePrompt,
        difficulty: difficulty,
      },
      { operation: "complete-enhanced-game-generation-chain" },
    )
  }

  async updateCodeWithGroq(existingCode, fixPrompt, originalGamePrompt) {
    return await traceFunction(
      "Update-Code-With-Fix",
      async () => {
        console.log(chalk.magenta(`🔧 Updating existing game code with fix request...`))
        console.log(chalk.yellow(`🎯 Fix Request: ${fixPrompt}`))
        
        const updatePrompt = {
          task: "Update and fix existing game code",
          original_game_prompt: originalGamePrompt,
          fix_request: fixPrompt,
          existing_code: existingCode,
          
          instructions: [
            "Analyze the existing game code thoroughly",
            "Understand what needs to be fixed/improved based on the fix request",
            "Make ONLY the necessary changes to address the fix request",
            "Preserve all existing functionality that works correctly",
            "Ensure the updated code is still complete and functional",
            "Maintain the same code structure and React patterns"
          ],
          
          requirements: [
            "Return the COMPLETE updated game code, not just the changes",
            "The code must start with 'use client' and be a complete React component",
            "Fix the specific issues mentioned in the fix request",
            "Keep all working features intact",
            "Maintain Canvas 2D API usage and responsive design",
            "Ensure mobile and desktop compatibility is preserved"
          ],
          
          output: "Return ONLY the complete updated game code starting with 'use client'. No explanations."
        }

        const messages = [
          {
            role: "system",
            content: `You are an expert React game developer specializing in code fixes and improvements.

CRITICAL INSTRUCTIONS:
1. You will receive existing game code and a specific fix request
2. Analyze what needs to be changed based on the fix request
3. Make targeted improvements while preserving working functionality
4. Return the COMPLETE updated code, not just snippets
5. Ensure the game remains fully functional after your changes`
          },
          {
            role: "user",
            content: JSON.stringify(updatePrompt)
          }
        ]

        const chatCompletion = await this.groqClient.chat.completions.create({
          messages,
          model: "openai/gpt-oss-120b",
          temperature: 0.1,
          max_tokens: 40000,
          top_p: 1,
          stream: false,
        })

        const updatedCode = chatCompletion.choices[0]?.message?.content || ""
        console.log(chalk.green(`✅ Code updated successfully (${updatedCode.length} characters)`))
        return updatedCode
      },
      {
        step: "code-update",
        provider: "openai/gpt-oss-120b",
        fixPrompt: fixPrompt,
        originalPrompt: originalGamePrompt
      }
    )
  }
  
  async generateInitialCodeWithGroq(gamePrompt, chatId, similarGames = [], gameAnalysis = "") {
    return await traceFunction(
      "Enhanced-Code-Generation",
      async () => {
        console.log(chalk.green(`🚀 Generating enhanced game code with comprehensive analysis...`));
        
        // Build context from similar games
        let contextMessage = "";
        if (similarGames.length > 0) {
          contextMessage = "\n\n=== SIMILAR GAMES REFERENCE ===\n";
          similarGames.slice(0, 3).forEach((result, index) => {
            const content = result.content || '';
            const promptMatch = content.match(/Prompt: (.+?)(?:\n|$)/);
            const gamePromptFromMemory = promptMatch ? promptMatch[1] : 'Similar game';
            
            contextMessage += `Example ${index + 1}: ${gamePromptFromMemory}\n`;
            
            const codeMatch = content.match(/export default function GameComponent\(\) {[\s\S]{0,300}/);
            if (codeMatch) {
              contextMessage += `Code pattern: ${codeMatch[0]}...\n\n`;
            }
          });
        }

        const promptObject = {
          instruction: "Create a complete game using the comprehensive analysis provided below",
          
          template: `"use client"
import React, { useEffect, useRef, useState, useCallback } from 'react';

export default function GameComponent() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<'menu' | 'playing' | 'gameover'>('menu');
  const [score, setScore] = useState(0);
  
  // IMPLEMENT COMPLETE GAME BASED ON ANALYSIS
  // - Use the thinking process and mechanics from analysis
  // - Implement asset generation code provided
  // - Include all visual and audio elements specified
  // - Canvas 2D rendering with game loop
  // - Touch/click + keyboard controls
  // - Start menu, gameplay, game over screen
  
  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', touchAction: 'none' }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
    </div>
  );
}`,
        
          requirements: [
            "CRITICAL: Use the comprehensive game analysis as your implementation blueprint",
            "Implement ALL mechanics and features mentioned in the analysis",
            "Use the asset generation code snippets provided in the analysis", 
            "Canvas 2D API only - no external libraries except React",
            "Mobile (touch) and desktop (keyboard) compatible",
            "Include: start menu, gameplay, score system, game over, restart",
            "Responsive canvas that resizes properly",
            "Generate all assets programmatically as specified",
            "Keep under 400 lines but make it feature-complete",
            "Follow all implementation notes from the analysis"
          ],
        
          game_request: gamePrompt,
          similar_games_context: contextMessage,
          
          // DIRECT ANALYSIS PARAMETER - No parsing needed!
          comprehensive_game_analysis: gameAnalysis,
          
          output: "Return ONLY the complete game code starting with 'use client'. No explanations."
        };
  
        const messages = [
          {
            role: "system",
            content: `You are an expert React + TypeScript game developer. 

CRITICAL: You have been provided a comprehensive game analysis that includes:
- Step-by-step thinking process
- Core mechanics breakdown
- Asset requirements and generation code
- Implementation notes

Use this analysis as your complete blueprint. Implement every mechanic, asset, and feature mentioned.`
          },
          {
            role: "user",
            content: JSON.stringify(promptObject)
          }
        ];
  
        const chatCompletion = await this.groqClient.chat.completions.create({
          messages,
          model: "openai/gpt-oss-120b",
          temperature: 0.2,
          max_tokens: 40000,
          top_p: 1,
          stream: false,
        });
  
        const response = chatCompletion.choices[0]?.message?.content || "";
        console.log(chalk.green(`✅ Enhanced GameComponent generated with analysis integration`));
        return response;
      },
      {
        step: "enhanced-code-generation",
        provider: "openai/gpt-oss-120b",
        engine: "CANVAS_2D_WITH_ASSETS",
      },
    );
  }
}

export default TracedLLMProvider