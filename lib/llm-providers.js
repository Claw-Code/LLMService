import Groq from "groq-sdk"
import Anthropic from "@anthropic-ai/sdk"
import { OpenRouterClient, traceFunction } from "./langsmith-tracer.js"
import chalk from "chalk"
import dotenv from "dotenv"
dotenv.config()

// Initialize API clients
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
})

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const openRouter = new OpenRouterClient()

// Enhanced LLM Provider class with new order: Groq → Qwen3 Coder → Anthropic (Checker) → Qwen3 (Final Fix)
export class TracedLLMProvider {
  constructor() {
    this.providers = {
      groq: groq,
      anthropic: anthropic,
      openrouter: openRouter,
    }
  }

  // Step 1: Enhanced Groq explanation with full template context
  async getGameExplanation(gamePrompt, chatId) {
    return await traceFunction(
      "Groq-Game-Explanation",
      async () => {
        console.log(chalk.green(`Getting comprehensive game explanation from Groq for: ${gamePrompt}`))

        const messages = [
          {
            role: "system",
            content: `You are a senior Next.js game architect with deep expertise in our ESTABLISHED TEMPLATE SYSTEM. You have access to a complete, battle-tested game development framework that MUST be used for all game projects.

# 🏗️ OUR ESTABLISHED TEMPLATE ARCHITECTURE

We have a proven, modular Next.js game architecture that you MUST reference and build upon:

## 📁 EXACT FILE STRUCTURE (NEVER DEVIATE):
\`\`\`
├── package.json (Next.js 15 + all dependencies pre-configured)
├── tsconfig.json (with @/* paths configured)
├── next.config.mjs (optimized for games)
├── postcss.config.mjs (@tailwindcss/postcss configured)
├── components.json (shadcn/ui configured)
├── next-env.d.ts (Next.js types)
├── app/
│   ├── layout.tsx (Root layout with Geist font)
│   ├── page.tsx (Main page that renders <Game />)
│   └── globals.css (Tailwind + custom game animations)
├── components/
│   ├── game.tsx (🎯 MAIN ORCHESTRATOR - coordinates all systems)
│   ├── game/
│   │   ├── game-engine.tsx (🎮 RENDERING ENGINE - canvas, graphics, physics)
│   │   ├── game-logic.tsx (🧠 BUSINESS LOGIC - rules, scoring, progression)
│   │   ├── game-ui.tsx (🎨 USER INTERFACE - menus, HUD, overlays)
│   │   └── game-controls.tsx (⌨️ INPUT HANDLING - keyboard, mouse, touch)
│   └── ui/ (shadcn/ui components - Button, Card, etc.)
├── types/
│   └── game.ts (🔷 TYPE DEFINITIONS - all interfaces and types)
└── lib/
    └── utils.ts (🛠️ UTILITIES - helper functions, collision detection)
\`\`\`

## 🎯 COMPONENT RESPONSIBILITIES (STRICTLY ENFORCED):

### 1. components/game.tsx - MAIN ORCHESTRATOR
- **Role**: Central coordinator that manages all game systems
- **Responsibilities**: 
  - Game state management (score, lives, phase)
  - Component lifecycle coordination
  - Context provision to child components
  - High-level game flow control
- **Imports**: Uses @/ for all imports
- **Pattern**: Functional component with hooks (useState, useRef, useEffect)

### 2. components/game/game-engine.tsx - RENDERING ENGINE
- **Role**: Handles all visual rendering and graphics
- **Responsibilities**:
  - Canvas management and rendering
  - Game object drawing and animation
  - Visual effects and particles
  - Performance-optimized render loops
- **Imports**: \`import type { GameState, GamePhase } from "@/types/game"\`
- **Pattern**: useEffect with requestAnimationFrame loops

### 3. components/game/game-logic.tsx - BUSINESS LOGIC
- **Role**: Manages game rules and state transitions
- **Responsibilities**:
  - Score calculation and validation
  - Game rule enforcement
  - Difficulty progression
  - Achievement and progression systems
- **Imports**: \`import type { GameLogicProps } from "@/types/game-logic"\`
- **Pattern**: useEffect with game state monitoring

### 4. components/game/game-ui.tsx - USER INTERFACE
- **Role**: All user interface elements and overlays
- **Responsibilities**:
  - Menu screens (start, pause, game over)
  - HUD elements (score, lives, timer)
  - Modal dialogs and notifications
  - Responsive design for all screen sizes
- **Imports**: \`import { Button } from "@/components/ui/button"\`
- **Pattern**: Conditional rendering based on game phase

### 5. components/game/game-controls.tsx - INPUT HANDLING
- **Role**: Processes all user input
- **Responsibilities**:
  - Keyboard event handling (WASD, arrows, space)
  - Mouse and touch input processing
  - Input state management
  - Cross-platform input normalization
- **Imports**: \`import type { GameState, GamePhase } from "@/types/game"\`
- **Pattern**: useEffect with event listeners

## 🔷 TYPE SYSTEM (COMPREHENSIVE):

Our types/game.ts includes:
- GamePhase: "menu" | "playing" | "paused" | "gameOver"
- GameState: score, highScore, lives, level, gameOver, paused
- GameObject: id, x, y, width, height, active, type, velocity, etc.
- InputState: up, down, left, right, action, jump, mouse/touch coords
- Vector2D/3D: x, y, z coordinates for positions and velocities
- PhysicsBody: position, velocity, acceleration, mass, friction
- Collision: objectA, objectB, point, normal, penetration

## 🛠️ UTILITY FUNCTIONS (PRE-BUILT):

Our lib/utils.ts provides:
- gameUtils.randomInt(min, max) - Random number generation
- gameUtils.clamp(value, min, max) - Value clamping
- gameUtils.distance(x1, y1, x2, y2) - Distance calculation
- gameUtils.rectCollision() - Rectangle collision detection
- gameUtils.circleCollision() - Circle collision detection
- gameUtils.normalize(x, y) - Vector normalization
- storage.getItem/setItem - Safe localStorage operations

## 🎨 UI COMPONENTS (AVAILABLE):

Pre-configured shadcn/ui components:
- Button (primary, secondary, outline, ghost variants)
- Card, CardContent, CardHeader - For panels and overlays
- All Radix UI components for advanced interactions

## ⚠️ CRITICAL IMPORT PATTERNS (MUST FOLLOW):

✅ CORRECT IMPORTS:
\`\`\`typescript
// Main game component
import GameEngine from "@/components/game/game-engine"
import GameLogic from "@/components/game/game-logic"
import GameUI from "@/components/game/game-ui"
import GameControls from "@/components/game/game-controls"
import type { GameState, GamePhase } from "@/types/game"

// Game subsystems
import type { GameState, GamePhase } from "@/types/game"
import { gameUtils } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
\`\`\`

❌ NEVER USE:
- Relative imports like "../../../types/game"
- Direct file imports without @/ alias
- Missing type imports
- Incorrect component instantiation

## 🎮 GAME DEVELOPMENT PATTERNS:

### Canvas Rendering Pattern:
\`\`\`typescript
useEffect(() => {
  if (!canvasRef.current || gamePhase !== "playing") return
  
  const canvas = canvasRef.current
  const ctx = canvas.getContext("2d")
  if (!ctx) return
  
  const gameLoop = () => {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    
    // Update game objects
    // Render game objects
    // Check collisions
    // Update game state
    
    if (gamePhase === "playing") {
      requestAnimationFrame(gameLoop)
    }
  }
  
  gameLoop()
}, [gamePhase])
\`\`\`

### Input Handling Pattern:
\`\`\`typescript
useEffect(() => {
  const handleKeyDown = (event: KeyboardEvent) => {
    switch (event.code) {
      case "Space":
        event.preventDefault()
        // Handle action
        break
      case "ArrowUp":
      case "KeyW":
        // Handle up movement
        break
    }
  }
  
  window.addEventListener("keydown", handleKeyDown)
  return () => window.removeEventListener("keydown", handleKeyDown)
}, [gamePhase])
\`\`\`

# 📋 YOUR TASK:

When given a game request, provide a DETAILED ARCHITECTURAL EXPLANATION that:

1. **Game Overview**: Describe the specific game mechanics and how they fit our template
2. **Component Mapping**: Explain exactly what goes in each of our 5 core components
3. **Data Flow**: Detail how game state flows between components
4. **Rendering Strategy**: Specify what gets drawn in game-engine.tsx
5. **Logic Distribution**: Define what rules go in game-logic.tsx
6. **UI Layout**: Plan all menus and HUD elements for game-ui.tsx
7. **Input Mapping**: Map all controls to game-controls.tsx
8. **Type Requirements**: List all custom types needed beyond our base types
9. **Utility Usage**: Identify which existing utilities to use
10. **Asset Requirements**: Specify any SVG assets or graphics needed

## 🎨 SVG ASSET GENERATION:

If the game needs custom graphics, provide complete SVG code:
\`\`\`svg
<!-- Example: Game Character -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <circle cx="50" cy="50" r="30" fill="#FFD700"/>
  <circle cx="40" cy="45" r="3" fill="#000"/>
  <path d="M65 50 L80 45 L80 55 Z" fill="#FF6B35"/>
</svg>
\`\`\`

## 🚀 IMPLEMENTATION STRATEGY:

Provide step-by-step implementation approach:
1. How to adapt our template for this specific game
2. Which components need the most customization
3. What new game objects and mechanics to add
4. How to handle game-specific physics or rules
5. Mobile responsiveness considerations
6. Performance optimization strategies

Remember: We have a PROVEN, WORKING template system. Your job is to explain how to adapt and extend it for the specific game request, not to reinvent the architecture.`,
          },
          {
            role: "user",
            content: `Provide a comprehensive architectural explanation for building a ${gamePrompt} using our established Next.js game template system. 

Focus on:
1. How this specific game maps to our 5-component architecture
2. Detailed breakdown of what code goes in each component
3. Game-specific adaptations needed for our template
4. Complete data flow and state management strategy
5. Any custom SVG assets or graphics required

Be extremely detailed and specific about implementation within our existing framework.`,
          },
        ]

        const chatCompletion = await this.providers.groq.chat.completions.create({
          messages: messages,
          model: "llama-3.3-70b-versatile",
          temperature: 0.3,
          max_tokens: 4000,
          top_p: 1,
          stream: false,
        })

        const response = chatCompletion.choices[0]?.message?.content || ""
        console.log(chalk.green(`Groq comprehensive explanation: ${response.length} characters`))
        return response
      },
      {
        gamePrompt: gamePrompt,
        chatId: chatId,
      },
      { step: "comprehensive-game-explanation", provider: "groq" },
    )
  }

  // Step 2: Enhanced Qwen3 code generation with full template context
  async generateCleanCodeWithQwen(groqExplanation, gamePrompt, chatId) {
    return await traceFunction(
      "Qwen3-Template-Based-Code-Generation",
      async () => {
        console.log(chalk.green(`Generating template-based code with Qwen3...`))

        const messages = [
          {
            role: "system",
            content: `You are an expert Next.js game developer who MUST use our established template system. You have access to a complete, working game framework that provides all the foundation code.

# 🏗️ MANDATORY TEMPLATE USAGE

You MUST build upon our existing template system, not create new architecture. Here's what's already provided:

## 📦 PRE-CONFIGURED DEPENDENCIES (package.json):
\`\`\`json
{
  "dependencies": {
    "@hookform/resolvers": "^3.10.0",
    "@radix-ui/react-accordion": "1.2.2",
    "@radix-ui/react-alert-dialog": "1.1.4",
    "@radix-ui/react-avatar": "1.1.2",
    "@radix-ui/react-button": "1.1.1",
    "@radix-ui/react-card": "1.1.2",
    "@radix-ui/react-dialog": "1.1.4",
    "@radix-ui/react-dropdown-menu": "2.1.4",
    "@radix-ui/react-slot": "1.1.1",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "geist": "^1.3.1",
    "lucide-react": "^0.454.0",
    "next": "15.2.4",
    "react": "^19",
    "react-dom": "^19",
    "tailwind-merge": "^2.5.5",
    "tailwindcss-animate": "^1.0.7",
    "phaser": "^3.80.0"
  }
}
\`\`\`

## 🔧 PRE-CONFIGURED SETUP:
- ✅ tsconfig.json with @/* paths configured
- ✅ next.config.mjs optimized for games
- ✅ postcss.config.mjs with @tailwindcss/postcss
- ✅ components.json for shadcn/ui
- ✅ Tailwind CSS with custom game animations
- ✅ All shadcn/ui components available

## 🎯 TEMPLATE COMPONENTS (USE THESE EXACTLY):

### 1. components/game.tsx - MAIN ORCHESTRATOR TEMPLATE:
\`\`\`typescript
"use client"

import { useRef, useState } from "react"
import GameEngine from "@/components/game/game-engine"
import GameLogic from "@/components/game/game-logic"
import GameUI from "@/components/game/game-ui"
import GameControls from "@/components/game/game-controls"
import type { GameState, GamePhase } from "@/types/game"

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [gamePhase, setGamePhase] = useState<GamePhase>("menu")
  const [gameState, setGameState] = useState<GameState>({
    score: 0,
    highScore: Number.parseInt(localStorage?.getItem("game-highscore") || "0"),
    lives: 3,
    level: 1,
    gameOver: false,
    paused: false,
  })
  
  // Game control methods
  const startGame = () => setGamePhase("playing")
  const pauseGame = () => setGamePhase("paused")
  const resumeGame = () => setGamePhase("playing")
  const resetGame = () => {
    setGameState(prev => ({ ...prev, score: 0, lives: 3, gameOver: false }))
    setGamePhase("menu")
  }
  
  return (
    <div className="relative w-full h-screen overflow-hidden bg-background">
      {/* Render components based on game phase */}
    </div>
  )
}
\`\`\`

### 2. components/game/game-engine.tsx - RENDERING TEMPLATE:
\`\`\`typescript
"use client"

import { useRef, useEffect } from "react"
import type { GameState, GamePhase } from "@/types/game"

interface GameEngineProps {
  canvasRef?: React.RefObject<HTMLCanvasElement>
  gameState: GameState
  gamePhase: GamePhase
  onGameOver: () => void
  onScoreUpdate: (score: number) => void
}

export default function GameEngine({ canvasRef, gameState, gamePhase, onGameOver, onScoreUpdate }: GameEngineProps) {
  const internalCanvasRef = useRef<HTMLCanvasElement>(null)
  const canvas = canvasRef || internalCanvasRef
  
  useEffect(() => {
    if (!canvas.current || gamePhase !== "playing") return
    
    const ctx = canvas.current.getContext("2d")
    if (!ctx) return
    
    // Game loop implementation
    const gameLoop = () => {
      // Clear, update, render, check collisions
      if (gamePhase === "playing") {
        requestAnimationFrame(gameLoop)
      }
    }
    
    gameLoop()
  }, [gamePhase, gameState])
  
  return <canvas ref={canvas} className="absolute inset-0 w-full h-full" />
}
\`\`\`

### 3. components/game/game-ui.tsx - UI TEMPLATE:
\`\`\`typescript
"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import type { GameState, GamePhase } from "@/types/game"

interface GameUIProps {
  gameState: GameState
  gamePhase: GamePhase
  onStartGame: () => void
  onPauseGame: () => void
  onResumeGame: () => void
  onResetGame: () => void
  isLoading: boolean
  error: string | null
}

export default function GameUI({ gameState, gamePhase, onStartGame, onPauseGame, onResumeGame, onResetGame, isLoading, error }: GameUIProps) {
  // Conditional rendering based on game phase
  if (gamePhase === "menu") {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <Card>
          <CardContent className="p-8 text-center">
            <h1 className="text-6xl font-bold mb-4">Game Title</h1>
            <Button onClick={onStartGame}>Start Game</Button>
          </CardContent>
        </Card>
      </div>
    )
  }
  
  // Other game phases...
  return null
}
\`\`\`

### 4. types/game.ts - TYPE DEFINITIONS TEMPLATE:
\`\`\`typescript
export type GamePhase = "menu" | "playing" | "paused" | "gameOver"

export interface GameState {
  score: number
  highScore: number
  lives: number
  level: number
  gameOver: boolean
  paused: boolean
}

export interface GameObject {
  id: string
  x: number
  y: number
  width: number
  height: number
  active: boolean
  velocity?: { x: number; y: number }
}

// Add game-specific types here
\`\`\`

### 5. lib/utils.ts - UTILITIES TEMPLATE:
\`\`\`typescript
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const gameUtils = {
  randomInt: (min: number, max: number): number => 
    Math.floor(Math.random() * (max - min + 1)) + min,
  
  clamp: (value: number, min: number, max: number): number => 
    Math.max(min, Math.min(max, value)),
  
  distance: (x1: number, y1: number, x2: number, y2: number): number => 
    Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2),
  
  rectCollision: (x1: number, y1: number, w1: number, h1: number, x2: number, y2: number, w2: number, h2: number): boolean => 
    x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2
}
\`\`\`

## ⚠️ CRITICAL REQUIREMENTS:

### IMPORT RULES (STRICTLY ENFORCED):
✅ ALWAYS USE: \`import Component from "@/components/game/component"\`
✅ ALWAYS USE: \`import type { Type } from "@/types/game"\`
✅ ALWAYS USE: \`import { gameUtils } from "@/lib/utils"\`
✅ ALWAYS USE: \`import { Button } from "@/components/ui/button"\`

❌ NEVER USE: Relative imports like "../../../"
❌ NEVER USE: Direct file paths without @/
❌ NEVER USE: Class components (only functional components)
❌ NEVER USE: "new" keyword with React components

### COMPONENT PATTERNS:
- ALL components must be functional with hooks
- ALL components must use "use client" directive when using hooks
- ALL game logic must be distributed across the 5 core components
- ALL UI must use shadcn/ui components
- ALL styling must use Tailwind CSS classes

### GAME ENGINE PATTERNS:
- Canvas rendering in useEffect with requestAnimationFrame
- Game loop with clear/update/render/collision cycle
- Proper cleanup with cancelAnimationFrame
- Event listeners with proper cleanup

### STATE MANAGEMENT:
- Game state in main Game component
- Props drilling to child components
- Callback functions for state updates
- localStorage for persistence

## 🎮 GAME-SPECIFIC ADAPTATIONS:

Based on the architectural explanation, adapt our template by:

1. **Extending GameState interface** with game-specific properties
2. **Adding GameObject types** for game entities
3. **Implementing game loop** in GameEngine component
4. **Creating game rules** in GameLogic component
5. **Designing UI screens** in GameUI component
6. **Mapping controls** in GameControls component

## 📋 OUTPUT FORMAT (EXACT SEPARATORS):

Generate COMPLETE, WORKING code using these exact separators:

// === components/game.tsx ===
[Complete main orchestrator using template]

// === components/game/game-engine.tsx ===
[Complete rendering engine using template]

// === components/game/game-logic.tsx ===
[Complete business logic using template]

// === components/game/game-ui.tsx ===
[Complete user interface using template]

// === components/game/game-controls.tsx ===
[Complete input handling using template]

// === types/game.ts ===
[Complete type definitions extending template]

// === lib/utils.ts ===
[Complete utilities extending template]

// === app/layout.tsx ===
[Root layout - minimal changes needed]

// === app/page.tsx ===
[Main page - just renders <Game />]

// === app/globals.css ===
[Tailwind + custom game animations]

## 🚀 IMPLEMENTATION STRATEGY:

1. **Start with template structure** - Don't reinvent the wheel
2. **Extend, don't replace** - Add game-specific code to existing patterns
3. **Use all available utilities** - Leverage gameUtils, storage, etc.
4. **Follow established patterns** - Canvas rendering, input handling, etc.
5. **Maintain separation of concerns** - Keep logic in appropriate components

Your code must be production-ready, fully functional, and immediately executable. Build upon our proven template system!`,
          },
          {
            role: "user",
            content: `Generate complete, production-ready code for a ${gamePrompt} using our established template system.

ARCHITECTURAL EXPLANATION TO IMPLEMENT:
${groqExplanation}

REQUIREMENTS:
1. Use our exact template structure and components
2. Extend our existing types and utilities
3. Follow our established patterns and imports
4. Generate ALL required files with complete implementations
5. Make it immediately runnable with npm run dev

Focus on adapting our proven template rather than creating new architecture. The game should be fully functional and polished.`,
          },
        ]

        const response = await this.providers.openrouter.createChatCompletion("openai/gpt-oss-20b:free", messages, {
          temperature: 0.1,
          max_tokens: 8000,
        })

        console.log(chalk.green(`Qwen3 template-based code: ${response.length} characters`))
        return response
      },
      {
        gamePrompt: gamePrompt,
        groqExplanation: groqExplanation.slice(0, 500) + "...",
        chatId: chatId,
      },
      { step: "template-based-code-generation", provider: "qwen3-coder" },
    )
  }

  // Step 3: Enhanced Anthropic validation with template awareness
  async validateWithAnthropic(qwenInitialCode, gamePrompt, chatId) {
    return await traceFunction(
      "Anthropic-Template-Validation",
      async () => {
        console.log(chalk.green(`Validating template compliance with Anthropic...`))

        const prompt = `You are a senior Next.js code reviewer specializing in our established game template system. Review the generated code for compliance with our proven architecture.

# 🏗️ OUR TEMPLATE SYSTEM REQUIREMENTS:

## MANDATORY FILE STRUCTURE:
✅ components/game.tsx - Main orchestrator
✅ components/game/game-engine.tsx - Rendering system
✅ components/game/game-logic.tsx - Business logic
✅ components/game/game-ui.tsx - User interface
✅ components/game/game-controls.tsx - Input handling
✅ types/game.ts - Type definitions
✅ lib/utils.ts - Utility functions
✅ app/layout.tsx - Root layout
✅ app/page.tsx - Main page
✅ app/globals.css - Styles

## MANDATORY IMPORT PATTERNS:
✅ \`import Component from "@/components/game/component"\`
✅ \`import type { Type } from "@/types/game"\`
✅ \`import { gameUtils } from "@/lib/utils"\`
✅ \`import { Button } from "@/components/ui/button"\`

## MANDATORY COMPONENT PATTERNS:
✅ Functional components with hooks only
✅ "use client" directive for client components
✅ Proper TypeScript interfaces
✅ Canvas rendering with useEffect + requestAnimationFrame
✅ Event listeners with cleanup
✅ Props drilling for state management

## MANDATORY ARCHITECTURE COMPLIANCE:
✅ Game state managed in main Game component
✅ Rendering logic isolated in GameEngine
✅ Business rules isolated in GameLogic
✅ UI elements isolated in GameUI
✅ Input handling isolated in GameControls
✅ Types properly defined and imported
✅ Utilities used from existing gameUtils

GAME: ${gamePrompt}

GENERATED CODE TO VALIDATE:
${qwenInitialCode}

# 📋 VALIDATION CHECKLIST:

Provide detailed feedback in this format:

## ✅ TEMPLATE COMPLIANCE SCORE: X/10

### 📁 FILE STRUCTURE VALIDATION:
- [ ] All 10 required files present
- [ ] Correct file naming and locations
- [ ] No extra or missing files

### 🔗 IMPORT VALIDATION:
- [ ] All imports use @/ alias correctly
- [ ] No relative imports (../)
- [ ] Type imports properly declared
- [ ] shadcn/ui components imported correctly

### 🏗️ ARCHITECTURE VALIDATION:
- [ ] Main Game component orchestrates properly
- [ ] GameEngine handles rendering only
- [ ] GameLogic handles business rules only
- [ ] GameUI handles interface only
- [ ] GameControls handles input only
- [ ] Proper separation of concerns

### ⚛️ REACT/NEXT.JS VALIDATION:
- [ ] All components are functional (no classes)
- [ ] "use client" directives present where needed
- [ ] Hooks used correctly (useState, useRef, useEffect)
- [ ] No SSR violations (browser APIs in useEffect)
- [ ] Proper component lifecycle management

### 🔷 TYPESCRIPT VALIDATION:
- [ ] All types properly defined
- [ ] GameState interface extended correctly
- [ ] GameObject interfaces implemented
- [ ] No type errors or any types
- [ ] Proper interface inheritance

### 🎮 GAME LOGIC VALIDATION:
- [ ] Game loop implemented correctly
- [ ] Canvas rendering optimized
- [ ] Input handling comprehensive
- [ ] State management proper
- [ ] Collision detection working

### 🎨 UI/UX VALIDATION:
- [ ] All game phases handled (menu, playing, paused, gameOver)
- [ ] shadcn/ui components used properly
- [ ] Responsive design implemented
- [ ] Loading and error states handled

### 🛠️ UTILITY USAGE VALIDATION:
- [ ] Existing gameUtils functions used
- [ ] No reinvention of existing utilities
- [ ] Proper utility function extensions
- [ ] Storage utilities used for persistence

## 🚨 CRITICAL ISSUES FOUND:
[List any critical issues that prevent compilation or execution]

## ⚠️ TEMPLATE VIOLATIONS:
[List any deviations from our established template system]

## 🔧 REQUIRED FIXES:
[Specific instructions for fixing issues while maintaining template compliance]

## 🎯 OPTIMIZATION OPPORTUNITIES:
[Suggestions for better template utilization]

Focus on template compliance and architectural correctness. The code must work within our established system.`

        const response = await this.providers.anthropic.messages.create({
          model: "claude-3-haiku-20240307",
          max_tokens: 3000,
          temperature: 0.2,
          messages: [{ role: "user", content: prompt }],
        })

        const feedback = response.content[0]?.text || ""
        console.log(chalk.green(`Anthropic template validation: ${feedback.length} characters`))
        return feedback
      },
      {
        gamePrompt: gamePrompt,
        qwenInitialCode: qwenInitialCode.slice(0, 1000) + "...",
        chatId: chatId,
      },
      { step: "template-validation", provider: "anthropic" },
    )
  }

  // Step 4: Enhanced Qwen3 final fixes with template enforcement
  async generateFinalCodeWithQwen(anthropicFeedback, qwenInitialCode, gamePrompt, chatId) {
    return await traceFunction(
      "Qwen3-Template-Compliant-Final-Code",
      async () => {
        console.log(chalk.green(`Generating template-compliant final code with Qwen3...`))

        const messages = [
          {
            role: "system",
            content: `You are an expert Next.js game developer who MUST fix code to be 100% compliant with our established template system. You have the validation feedback and must address ALL issues while maintaining our proven architecture.

# 🏗️ TEMPLATE SYSTEM ENFORCEMENT

You MUST ensure the final code perfectly matches our template requirements:

## 📁 EXACT FILE STRUCTURE (NON-NEGOTIABLE):
\`\`\`
components/game.tsx - Main orchestrator with game state management
components/game/game-engine.tsx - Canvas rendering and game loop
components/game/game-logic.tsx - Business rules and scoring
components/game/game-ui.tsx - All UI elements and screens
components/game/game-controls.tsx - Input handling and events
types/game.ts - TypeScript interfaces and types
lib/utils.ts - Utility functions and helpers
app/layout.tsx - Next.js root layout
app/page.tsx - Main page component
app/globals.css - Tailwind CSS and animations
\`\`\`

## 🔗 MANDATORY IMPORT PATTERNS:
\`\`\`typescript
// In components/game.tsx
import GameEngine from "@/components/game/game-engine"
import GameLogic from "@/components/game/game-logic"
import GameUI from "@/components/game/game-ui"
import GameControls from "@/components/game/game-controls"
import type { GameState, GamePhase } from "@/types/game"

// In game subsystems
import type { GameState, GamePhase } from "@/types/game"
import { gameUtils } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
\`\`\`

## ⚛️ COMPONENT PATTERNS (STRICTLY ENFORCED):
\`\`\`typescript
"use client" // For components using hooks

export default function ComponentName(props: PropsInterface) {
  // Functional component with hooks
  const [state, setState] = useState(initialState)
  const ref = useRef<HTMLElement>(null)
  
  useEffect(() => {
    // Side effects with cleanup
    return () => {
      // Cleanup
    }
  }, [dependencies])
  
  return (
    // JSX with Tailwind classes
  )
}
\`\`\`

## 🎮 GAME ENGINE PATTERN (MANDATORY):
\`\`\`typescript
useEffect(() => {
  if (!canvasRef.current || gamePhase !== "playing") return
  
  const canvas = canvasRef.current
  const ctx = canvas.getContext("2d")
  if (!ctx) return
  
  let animationId: number
  
  const gameLoop = () => {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    
    // Update game objects
    // Render game objects
    // Check collisions
    // Update game state
    
    if (gamePhase === "playing") {
      animationId = requestAnimationFrame(gameLoop)
    }
  }
  
  gameLoop()
  
  return () => {
    if (animationId) {
      cancelAnimationFrame(animationId)
    }
  }
}, [gamePhase, gameState])
\`\`\`

## 🔷 TYPE SYSTEM (EXTEND, DON'T REPLACE):
\`\`\`typescript
// Base types (already provided)
export type GamePhase = "menu" | "playing" | "paused" | "gameOver"

export interface GameState {
  score: number
  highScore: number
  lives: number
  level: number
  gameOver: boolean
  paused: boolean
}

// Extend with game-specific types
export interface GameSpecificState extends GameState {
  // Add game-specific properties
}

export interface GameSpecificObject extends GameObject {
  // Add game-specific properties
}
\`\`\`

## 🛠️ UTILITY USAGE (USE EXISTING):
\`\`\`typescript
// Use existing utilities
import { gameUtils } from "@/lib/utils"

// In your code
const randomValue = gameUtils.randomInt(1, 10)
const distance = gameUtils.distance(x1, y1, x2, y2)
const collision = gameUtils.rectCollision(x1, y1, w1, h1, x2, y2, w2, h2)
\`\`\`

## 🎨 UI PATTERNS (USE SHADCN/UI):
\`\`\`typescript
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

// In render
<Card>
  <CardContent className="p-8 text-center">
    <h1 className="text-6xl font-bold mb-4">Game Title</h1>
    <Button onClick={onStartGame} size="lg">
      Start Game
    </Button>
  </CardContent>
</Card>
\`\`\`

# 📋 FIXING REQUIREMENTS:

Based on the validation feedback, you MUST:

1. **Fix ALL critical issues** that prevent compilation
2. **Correct ALL template violations** to match our architecture
3. **Implement ALL required fixes** specified in the feedback
4. **Maintain template compliance** while fixing issues
5. **Ensure immediate executability** with npm run dev

## 🚨 CRITICAL FIX PRIORITIES:

1. **Import Errors**: Fix all @/ import paths
2. **Component Structure**: Ensure functional components only
3. **Type Errors**: Fix all TypeScript compilation errors
4. **Architecture Violations**: Maintain separation of concerns
5. **Missing Files**: Generate any missing required files
6. **Syntax Errors**: Fix all JavaScript/TypeScript syntax issues

## 📋 OUTPUT FORMAT (EXACT SEPARATORS):

Generate the COMPLETE, FIXED code using exact separators:

// === components/game.tsx ===
[Fixed main orchestrator - fully compliant]

// === components/game/game-engine.tsx ===
[Fixed rendering engine - fully compliant]

// === components/game/game-logic.tsx ===
[Fixed business logic - fully compliant]

// === components/game/game-ui.tsx ===
[Fixed user interface - fully compliant]

// === components/game/game-controls.tsx ===
[Fixed input handling - fully compliant]

// === types/game.ts ===
[Fixed type definitions - fully compliant]

// === lib/utils.ts ===
[Fixed utilities - fully compliant]

// === app/layout.tsx ===
[Fixed root layout - fully compliant]

// === app/page.tsx ===
[Fixed main page - fully compliant]

// === app/globals.css ===
[Fixed styles - fully compliant]

The final code must be 100% template compliant and immediately executable!`,
          },
          {
            role: "user",
            content: `Fix and generate the final, template-compliant code for ${gamePrompt}.

VALIDATION FEEDBACK TO ADDRESS:
${anthropicFeedback}

ORIGINAL CODE TO FIX:
${qwenInitialCode}

REQUIREMENTS:
1. Address ALL issues mentioned in the validation feedback
2. Ensure 100% compliance with our template system
3. Fix all import errors, syntax errors, and type errors
4. Maintain our established architecture patterns
5. Generate complete, immediately executable code
6. Use our existing utilities and components
7. Follow our exact file structure and naming

The final code must compile without errors and run immediately with npm run dev. Focus on template compliance while maintaining game functionality.`,
          },
        ]

        const response = await this.providers.openrouter.createChatCompletion("openai/gpt-oss-20b:free", messages, {
          temperature: 0.1,
          max_tokens: 8000,
        })

        console.log(chalk.green(`Qwen3 template-compliant final code: ${response.length} characters`))
        return response
      },
      {
        gamePrompt: gamePrompt,
        anthropicFeedback: anthropicFeedback.slice(0, 500) + "...",
        qwenInitialCode: qwenInitialCode.slice(0, 500) + "...",
        chatId: chatId,
      },
      { step: "template-compliant-final-code", provider: "qwen3-coder" },
    )
  }

  // Complete enhanced chain with optional validation steps
  async generateWebGame(gamePrompt, chatId, skipValidation = false) {
    return await traceFunction(
      "Complete-Enhanced-Web-Game-Chain-V2",
      async () => {
        console.log(chalk.blue(`Starting enhanced web game generation chain V2 for: ${gamePrompt}`))

        if (skipValidation) {
          console.log(chalk.yellow("⚠️  VALIDATION STEPS DISABLED - Using Qwen3 initial code as final"))
        }

        // Step 1: Groq explains the game and provides comprehensive architecture
        console.log(chalk.cyan("Step 1: Getting comprehensive game explanation from Groq..."))
        const groqExplanation = await this.getGameExplanation(gamePrompt, chatId)

        // Step 2: Qwen3 generates initial complete code for all files
        console.log(chalk.cyan("Step 2: Generating complete code with Qwen3 Coder..."))
        const qwenInitialCode = await this.generateCleanCodeWithQwen(groqExplanation, gamePrompt, chatId)

        let anthropicFeedback = null
        let qwenFinalCode = null

        if (!skipValidation) {
          // Step 3: Anthropic validates the code and provides detailed feedback
          console.log(chalk.cyan("Step 3: Validating code with Anthropic (concise feedback)..."))
          anthropicFeedback = await this.validateWithAnthropic(qwenInitialCode, gamePrompt, chatId)

          // Step 4: Qwen3 generates final fixed code based on validation feedback
          console.log(chalk.cyan("Step 4: Generating final fixed code with Qwen3 (complete implementation)..."))
          qwenFinalCode = await this.generateFinalCodeWithQwen(anthropicFeedback, qwenInitialCode, gamePrompt, chatId)
        } else {
          console.log(chalk.yellow("Steps 3 & 4 skipped - using Qwen3 initial code as final"))
          qwenFinalCode = qwenInitialCode
          anthropicFeedback = "Validation steps skipped by user request"
        }

        console.log(chalk.blue(`Enhanced web game chain V2 completed for: ${gamePrompt}`))

        return {
          groqExplanation,
          qwenInitialCode,
          anthropicFeedback,
          qwenFinalCode,
          webGameCode: qwenFinalCode,
          finalCode: qwenFinalCode,
          validationSkipped: skipValidation,
        }
      },
      {
        gamePrompt: gamePrompt,
        chatId: chatId,
        skipValidation: skipValidation,
      },
      { operation: "complete-enhanced-web-game-chain-v2" },
    )
  }
}

export default TracedLLMProvider
