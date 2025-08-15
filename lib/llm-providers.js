"use client"

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

// ENHANCED 4-CHAIN GROQ-POWERED SYSTEM
export class TracedLLMProvider {
  constructor() {
    this.providers = {
      groq: groq,
      anthropic: anthropic,
      openrouter: openRouter,
    }
  }

  // CHAIN 1: Enhanced Game Architecture with Difficulty Levels
  async getEnhancedGameExplanation(gamePrompt, difficulty = "medium", chatId) {
    return await traceFunction(
      "Groq-Enhanced-Game-Architecture",
      async () => {
        console.log(
          chalk.green(`🎯 Getting ${difficulty.toUpperCase()} game architecture from Groq for: ${gamePrompt}`),
        )

        const difficultySpecs = {
          easy: {
            mechanics: "Simple, intuitive controls. Clear visual feedback. Forgiving gameplay.",
            features: "Basic scoring, simple collision detection, easy-to-understand objectives.",
            complexity: "Minimal UI, straightforward game loop, beginner-friendly.",
            assets: "Clean, simple graphics. Basic sound effects. Clear visual hierarchy.",
          },
          medium: {
            mechanics: "Balanced challenge with multiple game mechanics. Progressive difficulty.",
            features: "Advanced scoring system, power-ups, multiple game states, achievements.",
            complexity: "Rich UI with HUD elements, particle effects, smooth animations.",
            assets: "Detailed graphics, ambient sounds, visual effects, responsive design.",
          },
          hard: {
            mechanics: "Complex gameplay with advanced physics, multiple systems interaction.",
            features: "Sophisticated AI, procedural generation, advanced scoring, leaderboards.",
            complexity: "Professional-grade UI, advanced animations, performance optimization.",
            assets: "High-quality graphics, dynamic audio, particle systems, shader effects.",
          },
        }

        const spec = difficultySpecs[difficulty] || difficultySpecs.medium

        const messages = [
          {
            role: "system",
            content: `You are a **SENIOR GAME ARCHITECT** with 15+ years creating **${difficulty.toUpperCase()}-LEVEL** games. Design a complete, production-ready Next.js game with **INSANE ATTENTION TO DETAIL**.

# 🎮 ${difficulty.toUpperCase()} DIFFICULTY SPECIFICATIONS

## 🎯 GAME MECHANICS (${difficulty.toUpperCase()}):
${spec.mechanics}

## ⚡ REQUIRED FEATURES (${difficulty.toUpperCase()}):
${spec.features}

## 🏗️ COMPLEXITY LEVEL (${difficulty.toUpperCase()}):
${spec.complexity}

## 🎨 ASSET REQUIREMENTS (${difficulty.toUpperCase()}):
${spec.assets}

# 🏗️ SINGLE-PAGE ARCHITECTURE MASTERY

## 📁 MANDATORY STRUCTURE:
\`\`\`
├── app/page.tsx (🎯 ALL GAME CODE - ${difficulty.toUpperCase()} COMPLEXITY)
├── components/ui/ (shadcn/ui components)
├── lib/utils.ts (Game utilities + ${difficulty} helpers)
├── types/game.ts (Complete type system)
└── assets/ (Generated SVG/audio assets)
\`\`\`

## 🎮 ${difficulty.toUpperCase()} GAME IMPLEMENTATION REQUIREMENTS:

### EASY MODE FEATURES:
- ✅ Simple controls (1-2 keys max)
- ✅ Clear visual feedback
- ✅ Forgiving collision detection
- ✅ Basic scoring system
- ✅ Simple win/lose conditions
- ✅ Clean, minimal UI
- ✅ Smooth 60fps gameplay

### MEDIUM MODE FEATURES (includes Easy +):
- ✅ Multiple game mechanics
- ✅ Power-ups and collectibles
- ✅ Progressive difficulty scaling
- ✅ Particle effects
- ✅ Sound effects integration
- ✅ Achievement system
- ✅ Advanced HUD with stats
- ✅ Smooth animations

### HARD MODE FEATURES (includes Medium +):
- ✅ Complex physics simulation
- ✅ AI-driven enemies
- ✅ Procedural content generation
- ✅ Advanced particle systems
- ✅ Dynamic lighting effects
- ✅ Performance optimization
- ✅ Professional UI/UX
- ✅ Leaderboard integration
- ✅ Advanced audio system

## 🎨 ASSET GENERATION REQUIREMENTS:

### SVG ASSETS NEEDED:
- Player character (animated states)
- Enemies/obstacles (multiple variants)
- Collectibles and power-ups
- Background elements
- UI icons and decorations
- Particle effect sprites

### AUDIO REQUIREMENTS:
- Background music (Web Audio API)
- Sound effects for actions
- Ambient audio layers
- Dynamic audio mixing

## 📱 RESPONSIVE DESIGN MASTERY:

### MOBILE-FIRST APPROACH:
- Touch controls with haptic feedback
- Responsive canvas scaling
- Performance optimization for mobile
- Battery-efficient rendering
- Cross-device compatibility

### DESKTOP ENHANCEMENTS:
- Keyboard shortcuts
- Mouse interactions
- High-resolution graphics
- Advanced visual effects

## 🚀 PERFORMANCE REQUIREMENTS:

### ${difficulty.toUpperCase()} PERFORMANCE TARGETS:
- 60fps stable framerate
- <100ms input latency
- Smooth animations
- Memory-efficient rendering
- Optimized asset loading

# 📋 YOUR TASK:

Provide a **COMPREHENSIVE ARCHITECTURAL BLUEPRINT** for implementing a ${difficulty.toUpperCase()}-level ${gamePrompt} game:

1. **Game Overview**: Detailed mechanics and objectives
2. **Single-Page Structure**: How everything fits in app/page.tsx
3. **State Management**: Complete useState architecture
4. **Game Loop Design**: Update/render/input cycle
5. **Asset Requirements**: Specific SVG and audio needs
6. **UI/UX Design**: Complete interface specification
7. **Performance Strategy**: Optimization techniques
8. **Mobile Optimization**: Touch controls and responsiveness
9. **Code Architecture**: Clean, maintainable structure
10. **Quality Assurance**: Testing and validation approach

## 🎯 DIFFICULTY-SPECIFIC REQUIREMENTS:

Focus on **${difficulty.toUpperCase()}** complexity level with appropriate:
- Game mechanics depth
- Visual complexity
- Audio sophistication  
- Performance optimization
- User experience polish

Make this a **PRODUCTION-READY** game that showcases **PROFESSIONAL GAME DEVELOPMENT** standards!`,
          },
          {
            role: "user",
            content: `Create a comprehensive architectural blueprint for a **${difficulty.toUpperCase()}-LEVEL** ${gamePrompt} game.

Requirements:
- **Difficulty**: ${difficulty.toUpperCase()} complexity
- **Architecture**: Everything in app/page.tsx
- **Quality**: Production-ready, professional-grade
- **Performance**: 60fps, optimized for all devices
- **Assets**: Detailed SVG and audio specifications
- **UI/UX**: Complete interface design

Provide an extremely detailed blueprint that will guide the creation of an **INSANE QUALITY** ${difficulty} game.`,
          },
        ]

        const chatCompletion = await this.providers.groq.chat.completions.create({
          messages: messages,
          model: "llama-3.3-70b-versatile",
          temperature: 0.4,
          max_tokens: 4000,
          top_p: 1,
          stream: false,
        })

        const response = chatCompletion.choices[0]?.message?.content || ""
        console.log(chalk.green(`✅ Enhanced ${difficulty} architecture: ${response.length} characters`))
        return response
      },
      {
        gamePrompt: gamePrompt,
        difficulty: difficulty,
        chatId: chatId,
      },
      { step: "enhanced-game-architecture", provider: "groq", difficulty: difficulty },
    )
  }

  // CHAIN 2: Premium Code Generation with Groq
  async generatePremiumCodeWithGroq(architecture, gamePrompt, difficulty, chatId) {
    return await traceFunction(
      "Groq-Premium-Code-Generation",
      async () => {
        console.log(chalk.green(`🚀 Generating ${difficulty.toUpperCase()} premium code with Groq...`))

        const messages = [
          {
            role: "system",
            content: `You are a **SENIOR NEXT.JS GAME DEVELOPER** creating **${difficulty.toUpperCase()}-QUALITY** games. Generate **PRODUCTION-READY** code with **INSANE ATTENTION TO DETAIL**.

# 🎮 ${difficulty.toUpperCase()} CODE GENERATION STANDARDS

## 🏗️ ARCHITECTURE REQUIREMENTS:
- **Single Page**: Everything in app/page.tsx
- **Performance**: 60fps stable, optimized rendering
- **Responsive**: Mobile-first, cross-device compatibility
- **Clean Code**: TypeScript, proper patterns, maintainable

## 🎯 ${difficulty.toUpperCase()} COMPLEXITY FEATURES:

### EASY MODE CODE:
- Simple game loop with clear structure
- Basic collision detection
- Clean, readable code patterns
- Essential game mechanics only
- Smooth 60fps performance

### MEDIUM MODE CODE:
- Advanced game systems
- Particle effects and animations
- Multiple game states
- Power-up systems
- Performance optimizations

### HARD MODE CODE:
- Complex physics simulation
- Advanced AI systems
- Procedural generation
- Professional-grade architecture
- Cutting-edge optimizations

## 📦 REQUIRED DEPENDENCIES:
All @radix-ui components, clsx, tailwind-merge, lucide-react, Next.js 15, React 19

## 🔗 IMPORT PATTERNS (Relative paths only):
\`\`\`typescript
import { Button } from "../components/ui/button"
import { Card, CardContent } from "../components/ui/card"
import { gameUtils } from "../lib/utils"
import type { GameState, GamePhase } from "../types/game"
import { Play, Pause, RotateCcw, Home } from 'lucide-react'
\`\`\`

## 🎮 GAME IMPLEMENTATION STRUCTURE:

\`\`\`typescript
export default function GamePage() {
  // 1. REFS AND STATE (${difficulty} complexity)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [gamePhase, setGamePhase] = useState<GamePhase>("menu")
  const [gameState, setGameState] = useState<GameState>({...})
  
  // 2. GAME CONTROL METHODS
  const startGame = () => setGamePhase("playing")
  const pauseGame = () => setGamePhase("paused")
  
  // 3. GAME ENGINE - ${difficulty.toUpperCase()} COMPLEXITY
  useEffect(() => {
    // Advanced game loop with ${difficulty} features
  }, [gamePhase, gameState])
  
  // 4. INPUT HANDLING - All device types
  useEffect(() => {
    // Comprehensive input system
  }, [gamePhase])
  
  // 5. RESPONSIVE UI - ${difficulty.toUpperCase()} QUALITY
  return (
    <div className="relative w-full h-screen overflow-hidden bg-background">
      {/* Professional-grade UI implementation */}
    </div>
  )
}
\`\`\`

## 📋 OUTPUT FORMAT (EXACT SEPARATORS):

// === app/page.tsx ===
[Complete ${difficulty.toUpperCase()} game with ALL features]

// === components/ui/button.tsx ===
[Complete Button component]

// === components/ui/card.tsx ===
[Complete Card component]

// === types/game.ts ===
[Complete type definitions for ${difficulty} complexity]

// === lib/utils.ts ===
[Enhanced utilities for ${difficulty} features]

// === app/layout.tsx ===
[Root layout with proper metadata]

// === app/globals.css ===
[Responsive styles with ${difficulty} enhancements]

The code must be **${difficulty.toUpperCase()}-QUALITY**, **PRODUCTION-READY**, and **IMMEDIATELY EXECUTABLE**!`,
          },
          {
            role: "user",
            content: `Generate **${difficulty.toUpperCase()}-QUALITY** production code for ${gamePrompt}.

ARCHITECTURAL BLUEPRINT:
${architecture}

REQUIREMENTS:
1. **Difficulty**: ${difficulty.toUpperCase()} complexity and features
2. **Architecture**: Everything in app/page.tsx
3. **Performance**: 60fps, optimized for all devices
4. **Quality**: Production-ready, professional-grade
5. **Responsive**: Mobile-first, cross-device compatibility
6. **Clean Code**: TypeScript, proper patterns, maintainable

Generate complete, working code that implements the ${difficulty} difficulty level with all specified features and optimizations.`,
          },
        ]

        const chatCompletion = await this.providers.groq.chat.completions.create({
          messages: messages,
          model: "llama-3.3-70b-versatile",
          temperature: 0.2,
          max_tokens: 8000,
          top_p: 1,
          stream: false,
        })

        const response = chatCompletion.choices[0]?.message?.content || ""
        console.log(chalk.green(`✅ Premium ${difficulty} code: ${response.length} characters`))
        return response
      },
      {
        gamePrompt: gamePrompt,
        difficulty: difficulty,
        architecture: architecture.slice(0, 500) + "...",
        chatId: chatId,
      },
      { step: "premium-code-generation", provider: "groq", difficulty: difficulty },
    )
  }

  // CHAIN 3: Advanced Asset Generation with Groq
  async generateAdvancedAssetsWithGroq(codeBase, gamePrompt, difficulty, chatId) {
    return await traceFunction(
      "Groq-Advanced-Asset-Generation",
      async () => {
        console.log(chalk.green(`🎨 Generating ${difficulty.toUpperCase()} advanced assets with Groq...`))

        const messages = [
          {
            role: "system",
            content: `You are a **SENIOR GAME ASSET DESIGNER** creating **${difficulty.toUpperCase()}-QUALITY** assets. Generate **PROFESSIONAL-GRADE** SVG graphics and audio specifications.

# 🎨 ${difficulty.toUpperCase()} ASSET GENERATION STANDARDS

## 🎯 ASSET QUALITY LEVELS:

### EASY MODE ASSETS:
- Clean, simple SVG graphics
- Basic geometric shapes
- Clear visual hierarchy
- Minimal color palette (3-4 colors)
- Simple animations

### MEDIUM MODE ASSETS:
- Detailed SVG illustrations
- Advanced shapes and gradients
- Rich color palettes (6-8 colors)
- Smooth animations
- Visual effects

### HARD MODE ASSETS:
- Professional-grade SVG artwork
- Complex illustrations with details
- Advanced gradients and filters
- Dynamic color schemes
- Sophisticated animations

## 📦 REQUIRED ASSET TYPES:

### GAME SPRITES:
- Player character (multiple states)
- Enemies/obstacles (variants)
- Collectibles and power-ups
- Background elements
- UI decorations

### VISUAL EFFECTS:
- Particle sprites
- Explosion effects
- Trail effects
- Glow effects
- Impact effects

### UI ELEMENTS:
- Icons and buttons
- Progress bars
- Score displays
- Menu decorations
- Status indicators

## 🎵 AUDIO SPECIFICATIONS:

### SOUND EFFECTS:
- Player actions (jump, shoot, collect)
- Enemy interactions
- UI feedback sounds
- Environmental audio
- Impact and explosion sounds

### BACKGROUND MUSIC:
- Main menu theme
- Gameplay background music
- Victory/defeat themes
- Ambient soundscapes

## 📋 OUTPUT FORMAT:

Generate complete asset specifications with:

// === ASSET MANIFEST ===
[Complete list of all assets needed]

// === public/assets/player.svg ===
[Player character SVG with animations]

// === public/assets/enemy.svg ===
[Enemy sprites with variants]

// === public/assets/collectible.svg ===
[Collectible items SVG]

// === public/assets/background.svg ===
[Background elements]

// === public/assets/effects.svg ===
[Visual effects sprites]

// === AUDIO SPECIFICATIONS ===
[Complete audio system specifications]

// === INTEGRATION GUIDE ===
[How to integrate assets into the game code]

All assets must be **${difficulty.toUpperCase()}-QUALITY** and **PRODUCTION-READY**!`,
          },
          {
            role: "user",
            content: `Generate **${difficulty.toUpperCase()}-QUALITY** advanced assets for ${gamePrompt}.

EXISTING CODE BASE:
${codeBase.slice(0, 2000)}...

REQUIREMENTS:
1. **Quality**: ${difficulty.toUpperCase()} professional-grade assets
2. **Format**: Complete SVG graphics with proper structure
3. **Integration**: Assets that work seamlessly with the code
4. **Performance**: Optimized for web and mobile
5. **Consistency**: Cohesive visual style throughout
6. **Audio**: Complete sound system specifications

Generate all necessary assets with proper integration instructions for the ${difficulty} difficulty level.`,
          },
        ]

        const chatCompletion = await this.providers.groq.chat.completions.create({
          messages: messages,
          model: "llama-3.3-70b-versatile",
          temperature: 0.3,
          max_tokens: 6000,
          top_p: 1,
          stream: false,
        })

        const response = chatCompletion.choices[0]?.message?.content || ""
        console.log(chalk.green(`✅ Advanced ${difficulty} assets: ${response.length} characters`))
        return response
      },
      {
        gamePrompt: gamePrompt,
        difficulty: difficulty,
        codeBase: codeBase.slice(0, 500) + "...",
        chatId: chatId,
      },
      { step: "advanced-asset-generation", provider: "groq", difficulty: difficulty },
    )
  }

  // CHAIN 4: Final Polish and Integration with Groq
  async generateFinalPolishWithGroq(codeBase, assets, gamePrompt, difficulty, chatId) {
    return await traceFunction(
      "Groq-Final-Polish-Integration",
      async () => {
        console.log(chalk.green(`✨ Applying ${difficulty.toUpperCase()} final polish with Groq...`))

        const messages = [
          {
            role: "system",
            content: `You are a **SENIOR GAME POLISH SPECIALIST** creating **${difficulty.toUpperCase()}-QUALITY** final products. Apply **PROFESSIONAL-GRADE** polish and integrate all assets perfectly.

# ✨ ${difficulty.toUpperCase()} FINAL POLISH STANDARDS

## 🎯 POLISH REQUIREMENTS:

### EASY MODE POLISH:
- Smooth 60fps performance
- Clean code organization
- Basic asset integration
- Simple but polished UI
- Bug-free gameplay

### MEDIUM MODE POLISH:
- Advanced performance optimization
- Sophisticated asset integration
- Rich visual effects
- Professional UI/UX
- Comprehensive testing

### HARD MODE POLISH:
- Cutting-edge optimization
- Seamless asset integration
- Advanced visual systems
- Industry-standard UI/UX
- Production-ready quality

## 🔧 INTEGRATION TASKS:

### CODE OPTIMIZATION:
- Performance profiling and optimization
- Memory management improvements
- Rendering pipeline optimization
- Input system refinement
- Error handling and edge cases

### ASSET INTEGRATION:
- Seamless SVG integration
- Audio system implementation
- Animation system setup
- Visual effects integration
- Performance optimization

### UI/UX POLISH:
- Responsive design refinement
- Accessibility improvements
- Visual hierarchy optimization
- Interaction feedback
- Loading states and transitions

### QUALITY ASSURANCE:
- Cross-device testing
- Performance validation
- Code quality review
- Asset optimization
- Final bug fixes

## 📋 OUTPUT FORMAT:

Generate the complete, polished final product:

// === app/page.tsx ===
[Final polished game with all assets integrated]

// === components/ui/button.tsx ===
[Polished Button component]

// === components/ui/card.tsx ===
[Polished Card component]

// === types/game.ts ===
[Final type definitions]

// === lib/utils.ts ===
[Optimized utilities]

// === app/layout.tsx ===
[Final layout]

// === app/globals.css ===
[Polished styles]

// === public/assets/[all-assets].svg ===
[All integrated assets]

// === PERFORMANCE REPORT ===
[Performance metrics and optimizations]

// === QUALITY CHECKLIST ===
[Final quality validation]

The final product must be **${difficulty.toUpperCase()}-QUALITY**, **PRODUCTION-READY**, and **FLAWLESS**!`,
          },
          {
            role: "user",
            content: `Apply **${difficulty.toUpperCase()}-QUALITY** final polish and integration for ${gamePrompt}.

EXISTING CODE BASE:
${codeBase.slice(0, 2000)}...

GENERATED ASSETS:
${assets.slice(0, 1000)}...

REQUIREMENTS:
1. **Quality**: ${difficulty.toUpperCase()} production-ready polish
2. **Integration**: Seamless asset integration
3. **Performance**: 60fps optimized for all devices
4. **Polish**: Professional-grade final product
5. **Testing**: Comprehensive quality assurance
6. **Optimization**: Cutting-edge performance

Generate the complete, final, polished product with all assets perfectly integrated for the ${difficulty} difficulty level.`,
          },
        ]

        const chatCompletion = await this.providers.groq.chat.completions.create({
          messages: messages,
          model: "llama-3.3-70b-versatile",
          temperature: 0.1,
          max_tokens: 8000,
          top_p: 1,
          stream: false,
        })

        const response = chatCompletion.choices[0]?.message?.content || ""
        console.log(chalk.green(`✅ Final ${difficulty} polish: ${response.length} characters`))
        return response
      },
      {
        gamePrompt: gamePrompt,
        difficulty: difficulty,
        codeBase: codeBase.slice(0, 500) + "...",
        assets: assets.slice(0, 500) + "...",
        chatId: chatId,
      },
      { step: "final-polish-integration", provider: "groq", difficulty: difficulty },
    )
  }

  // ENHANCED 4-CHAIN PREMIUM GENERATION
  async generatePremiumWebGame(gamePrompt, difficulty = "medium", chatId) {
    return await traceFunction(
      "Complete-Premium-4-Chain-Groq",
      async () => {
        console.log(
          chalk.blue(`🚀 Starting PREMIUM 4-CHAIN generation for: ${gamePrompt} (${difficulty.toUpperCase()})`),
        )

        // CHAIN 1: Enhanced Game Architecture
        console.log(chalk.cyan("🎯 CHAIN 1: Enhanced Game Architecture..."))
        const architecture = await this.getEnhancedGameExplanation(gamePrompt, difficulty, chatId)

        // CHAIN 2: Premium Code Generation
        console.log(chalk.cyan("🚀 CHAIN 2: Premium Code Generation..."))
        const premiumCode = await this.generatePremiumCodeWithGroq(architecture, gamePrompt, difficulty, chatId)

        // CHAIN 3: Advanced Asset Generation
        console.log(chalk.cyan("🎨 CHAIN 3: Advanced Asset Generation..."))
        const advancedAssets = await this.generateAdvancedAssetsWithGroq(premiumCode, gamePrompt, difficulty, chatId)

        // CHAIN 4: Final Polish and Integration
        console.log(chalk.cyan("✨ CHAIN 4: Final Polish and Integration..."))
        const finalProduct = await this.generateFinalPolishWithGroq(
          premiumCode,
          advancedAssets,
          gamePrompt,
          difficulty,
          chatId,
        )

        console.log(chalk.blue(`✅ PREMIUM 4-CHAIN completed for: ${gamePrompt} (${difficulty.toUpperCase()})`))

        return {
          architecture,
          premiumCode,
          advancedAssets,
          finalProduct,
          webGameCode: finalProduct,
          finalCode: finalProduct,
          difficulty: difficulty,
          chainType: "premium-4-chain",
        }
      },
      {
        gamePrompt: gamePrompt,
        difficulty: difficulty,
        chatId: chatId,
      },
      { operation: "complete-premium-4-chain-groq", difficulty: difficulty },
    )
  }

  // Keep existing methods for backward compatibility
  async getGameExplanation(gamePrompt, chatId) {
    return await this.getEnhancedGameExplanation(gamePrompt, "medium", chatId)
  }

  async generateCleanCodeWithQwen(groqExplanation, gamePrompt, chatId) {
    return await this.generatePremiumCodeWithGroq(groqExplanation, gamePrompt, "medium", chatId)
  }

  async validateWithAnthropic(qwenInitialCode, gamePrompt, chatId) {
    return await traceFunction(
      "Anthropic-Quality-Validation",
      async () => {
        console.log(chalk.green(`🔍 Validating quality with Anthropic...`))

        const prompt = `You are a senior code reviewer. Validate this Next.js game code for production readiness:

${qwenInitialCode.slice(0, 2000)}...

Check for:
- Code quality and structure
- Performance optimizations
- Responsive design
- Error handling
- TypeScript compliance

Provide specific improvement suggestions.`

        const response = await this.providers.anthropic.messages.create({
          model: "claude-3-haiku-20240307",
          max_tokens: 2000,
          temperature: 0.2,
          messages: [{ role: "user", content: prompt }],
        })

        const feedback = response.content[0]?.text || ""
        console.log(chalk.green(`✅ Anthropic validation: ${feedback.length} characters`))
        return feedback
      },
      {
        gamePrompt: gamePrompt,
        qwenInitialCode: qwenInitialCode.slice(0, 1000) + "...",
        chatId: chatId,
      },
      { step: "quality-validation", provider: "anthropic" },
    )
  }

  async generateFinalCodeWithQwen(anthropicFeedback, qwenInitialCode, gamePrompt, chatId) {
    return await this.generateFinalPolishWithGroq(qwenInitialCode, anthropicFeedback, gamePrompt, "medium", chatId)
  }

  // Legacy method for existing simple chain
  async generateWebGame(gamePrompt, chatId, skipValidation = false) {
    return await this.generatePremiumWebGame(gamePrompt, "medium", chatId)
  }

  // SIMPLE2 CHAIN: Thinking Stage + OpenAI Feedback Loop + 1000+ Lines Code
  async getThinkingStageAnalysis(gamePrompt, architecture, chatId) {
    return await traceFunction(
      "Groq-Thinking-Stage-Analysis",
      async () => {
        console.log(chalk.green(`🧠 Thinking stage analysis for: ${gamePrompt}`))

        const messages = [
          {
            role: "system",
            content: `You are a **SENIOR GAME ARCHITECT** in the **THINKING STAGE**. Analyze the game requirements and create a comprehensive implementation strategy.

# 🧠 THINKING STAGE ANALYSIS

## 📋 YOUR TASK:
Analyze the game architecture and create a detailed implementation plan that will result in **1000+ lines of production code**.

## 🎯 ANALYSIS REQUIREMENTS:

### 1. CODE COMPLEXITY ANALYSIS:
- Identify all major systems needed
- Estimate code complexity for each system
- Plan for 1000+ lines of clean, functional code

### 2. GAME SYSTEMS BREAKDOWN:
- Core game loop and rendering
- Input handling (keyboard, mouse, touch)
- Game state management
- UI/UX systems (menu, HUD, overlays)
- Audio system integration
- Performance optimization
- Asset management

### 3. IMPLEMENTATION STRATEGY:
- Single-page architecture in app/page.tsx
- Comprehensive useState management
- Multiple useEffect hooks for different systems
- Responsive design patterns
- Error handling and edge cases

### 4. CODE EXPANSION AREAS:
- Detailed game mechanics
- Rich visual effects
- Comprehensive UI states
- Advanced input handling
- Performance monitoring
- Accessibility features

## 📊 OUTPUT FORMAT:

Provide detailed analysis in this format:

**GAME COMPLEXITY ASSESSMENT:**
[Detailed breakdown of game complexity]

**SYSTEM ARCHITECTURE PLAN:**
[Complete system architecture with estimated line counts]

**IMPLEMENTATION ROADMAP:**
[Step-by-step implementation plan]

**CODE EXPANSION STRATEGY:**
[How to achieve 1000+ lines with quality code]

**POTENTIAL CHALLENGES:**
[Technical challenges and solutions]

**QUALITY ASSURANCE PLAN:**
[Testing and validation approach]

Focus on creating a comprehensive plan that will result in **PRODUCTION-QUALITY** code with **1000+ lines**.`,
          },
          {
            role: "user",
            content: `Analyze and create implementation strategy for: ${gamePrompt}

ARCHITECTURE BLUEPRINT:
${architecture}

Requirements:
- Single-page architecture (app/page.tsx)
- 1000+ lines of production code
- Comprehensive game systems
- Professional quality implementation

Provide detailed thinking stage analysis.`,
          },
        ]

        const chatCompletion = await this.providers.groq.chat.completions.create({
          messages: messages,
          model: "llama-3.3-70b-versatile",
          temperature: 0.4,
          max_tokens: 3000,
          top_p: 1,
          stream: false,
        })

        const response = chatCompletion.choices[0]?.message?.content || ""
        console.log(chalk.green(`✅ Thinking stage analysis: ${response.length} characters`))
        return response
      },
      {
        gamePrompt: gamePrompt,
        architecture: architecture.slice(0, 500) + "...",
        chatId: chatId,
      },
      { step: "thinking-stage-analysis", provider: "groq" },
    )
  }

  async generateInitialCodeWithOpenAI(thinkingAnalysis, gamePrompt, chatId) {
    return await traceFunction(
      "Groq-OpenAI-Initial-Code",
      async () => {
        console.log(chalk.green(`🚀 Generating initial code with Groq + OpenAI 20B...`))

        const messages = [
          {
            role: "system",
            content: `You are a **SENIOR NEXT.JS DEVELOPER** generating **1000+ LINES** of production-ready game code in **ONE SINGLE FILE**.

# 🚀 SINGLE FILE ARCHITECTURE - app/page.tsx ONLY

## 📋 REQUIREMENTS:
- **EVERYTHING in app/page.tsx** - No separate functions, no external assets
- **Minimum 1000 lines** of functional code in ONE FILE
- **Embedded assets** - SVG strings, audio data URLs, everything inline
- **All game logic** - State, rendering, input, UI, everything in one place

## 🎯 SINGLE FILE STRUCTURE:

\`\`\`typescript
"use client"

import { useRef, useState, useEffect } from "react"
import { Button } from "../components/ui/button"
import { Card, CardContent } from "../components/ui/card"
import { Play, Pause, RotateCcw, Home } from 'lucide-react'

// EMBEDDED ASSETS - All SVG/audio as strings
const GAME_ASSETS = {
  player: \`<svg>...</svg>\`,
  enemy: \`<svg>...</svg>\`,
  sounds: {
    shoot: "data:audio/wav;base64,..."
  }
}

export default function GamePage() {
  // 1. ALL STATE (100+ lines)
  // 2. ALL GAME LOGIC (300+ lines)  
  // 3. ALL RENDERING (400+ lines)
  // 4. ALL INPUT HANDLING (200+ lines)
  // 5. ALL UI COMPONENTS (300+ lines)
  // Total: 1300+ lines in ONE FILE
}
\`\`\`

## 🎮 EMBEDDED EVERYTHING:

### ASSETS AS STRINGS:
- Player sprites as SVG strings
- Enemy sprites as SVG strings  
- Sound effects as data URLs
- Background patterns as CSS
- All visual effects inline

### GAME SYSTEMS INLINE:
- Physics calculations
- Collision detection
- Particle systems
- Audio management
- Score tracking
- Level progression

### UI COMPONENTS INLINE:
- Menu screens
- HUD elements
- Game over screens
- Settings panels
- All responsive layouts

## 📦 OUTPUT FORMAT:

Generate ONLY:

// === app/page.tsx ===
[1000+ lines of complete game with embedded assets]

NO OTHER FILES. Everything must be in this single page.tsx file.

Generate **COMPREHENSIVE, DETAILED** code with **1000+ LINES** in **ONE SINGLE FILE**!`,
          },
          {
            role: "user",
            content: `Generate 1000+ lines of comprehensive game code for: ${gamePrompt}

THINKING STAGE ANALYSIS:
${thinkingAnalysis}

REQUIREMENTS:
- Minimum 1000 lines in app/page.tsx
- Single-page architecture
- Production-ready quality
- Comprehensive game systems
- Detailed implementation

Generate complete, extensive code implementation.`,
          },
        ]

        const chatCompletion = await this.providers.groq.chat.completions.create({
          messages: messages,
          model: "openai/gpt-oss-20b", // Using OpenAI 20B OSS model through Groq
          temperature: 0.2,
          max_tokens: 8000,
          top_p: 1,
          stream: false,
        })

        const response = chatCompletion.choices[0]?.message?.content || ""
        console.log(chalk.green(`✅ Initial OpenAI code: ${response.length} characters`))
        return response
      },
      {
        gamePrompt: gamePrompt,
        thinkingAnalysis: thinkingAnalysis.slice(0, 500) + "...",
        chatId: chatId,
      },
      { step: "openai-initial-code", provider: "groq-openai-20b" },
    )
  }

  async feedbackLoopImprovement(initialCode, gamePrompt, chatId) {
    return await traceFunction(
      "Groq-Feedback-Loop-Improvement",
      async () => {
        console.log(chalk.green(`🔄 Feedback loop improvement for: ${gamePrompt}`))

        const messages = [
          {
            role: "system",
            content: `You are a **SENIOR CODE REVIEWER** providing feedback to improve code quality and ensure **1000+ lines** of production code.

# 🔄 FEEDBACK LOOP IMPROVEMENT

## 📋 REVIEW CRITERIA:

### 1. CODE QUANTITY CHECK:
- Ensure minimum 1000 lines in app/page.tsx
- Identify areas for expansion if needed
- Suggest additional features and systems

### 2. CODE QUALITY REVIEW:
- Check TypeScript compliance
- Verify responsive design patterns
- Ensure proper error handling
- Validate performance optimizations

### 3. GAME SYSTEMS COMPLETENESS:
- Verify all game systems are implemented
- Check for missing features
- Ensure comprehensive UI coverage

### 4. IMPROVEMENT SUGGESTIONS:
- Code structure improvements
- Additional features to add
- Performance optimizations
- User experience enhancements

## 📊 OUTPUT FORMAT:

**CODE ANALYSIS:**
[Detailed analysis of current code]

**LINE COUNT ASSESSMENT:**
[Current line count and expansion suggestions]

**QUALITY IMPROVEMENTS:**
[Specific code quality improvements needed]

**FEATURE ADDITIONS:**
[Additional features to reach 1000+ lines]

**IMPLEMENTATION SUGGESTIONS:**
[Specific implementation improvements]

**FINAL RECOMMENDATIONS:**
[Summary of all improvements needed]

Provide comprehensive feedback to achieve **1000+ LINES** of **PRODUCTION-QUALITY** code.`,
          },
          {
            role: "user",
            content: `Review and provide improvement feedback for: ${gamePrompt}

INITIAL CODE:
${initialCode.slice(0, 3000)}...

REQUIREMENTS:
- Ensure 1000+ lines in app/page.tsx
- Production-ready quality
- Comprehensive game systems
- Professional implementation

Provide detailed feedback for improvements.`,
          },
        ]

        const chatCompletion = await this.providers.groq.chat.completions.create({
          messages: messages,
          model: "llama-3.3-70b-versatile",
          temperature: 0.3,
          max_tokens: 2000,
          top_p: 1,
          stream: false,
        })

        const response = chatCompletion.choices[0]?.message?.content || ""
        console.log(chalk.green(`✅ Feedback loop analysis: ${response.length} characters`))
        return response
      },
      {
        gamePrompt: gamePrompt,
        initialCode: initialCode.slice(0, 500) + "...",
        chatId: chatId,
      },
      { step: "feedback-loop-improvement", provider: "groq" },
    )
  }

  async generateFinalExpandedCode(initialCode, feedback, gamePrompt, chatId) {
    return await traceFunction(
      "Groq-Final-Expanded-Code",
      async () => {
        console.log(chalk.green(`✨ Generating final expanded code for: ${gamePrompt}`))

        const messages = [
          {
            role: "system",
            content: `You are a **SENIOR NEXT.JS DEVELOPER** creating the **FINAL SINGLE-FILE VERSION** with **1000+ LINES** in **app/page.tsx ONLY**.

# ✨ SINGLE FILE FINAL VERSION

## 🎯 REQUIREMENTS:
- **EVERYTHING in app/page.tsx** - One massive file
- **MINIMUM 1000 LINES** in the single file
- **NO EXTERNAL DEPENDENCIES** except UI components
- **EMBEDDED ASSETS** - All SVG, audio, images as strings

## 📈 SINGLE FILE EXPANSION:

### 1. EMBEDDED ASSETS (200+ lines):
- Complete SVG sprites as template literals
- Audio data URLs for sound effects
- CSS animations and effects
- Color palettes and themes

### 2. GAME ENGINE (400+ lines):
- Complete physics system
- Collision detection algorithms
- Particle system implementation
- Animation systems
- Performance optimization

### 3. GAME LOGIC (300+ lines):
- Player mechanics
- Enemy AI systems
- Power-up systems
- Level progression
- Scoring algorithms

### 4. UI SYSTEM (400+ lines):
- Complete menu system
- HUD with all elements
- Game over screens
- Settings panels
- Responsive layouts

## 📋 FINAL OUTPUT:

Generate ONLY:

// === app/page.tsx ===
[1000+ lines of complete, self-contained game]

Create the **ULTIMATE SINGLE FILE** with **1000+ LINES** of **PRODUCTION-QUALITY** code!`,
          },
          {
            role: "user",
            content: `Generate the final expanded version for: ${gamePrompt}

INITIAL CODE:
${initialCode.slice(0, 2000)}...

FEEDBACK FOR IMPROVEMENTS:
${feedback}

REQUIREMENTS:
- MINIMUM 1000 lines in app/page.tsx
- Apply all feedback improvements
- Production-ready quality
- Comprehensive implementation
- Professional-grade code

Generate the complete, final, expanded implementation.`,
          },
        ]

        const chatCompletion = await this.providers.groq.chat.completions.create({
          messages: messages,
          model: "openai/gpt-oss-20b", // Using OpenAI 20B OSS model through Groq
          temperature: 0.1,
          max_tokens: 8000,
          top_p: 1,
          stream: false,
        })

        const response = chatCompletion.choices[0]?.message?.content || ""
        console.log(chalk.green(`✅ Final expanded code: ${response.length} characters`))
        return response
      },
      {
        gamePrompt: gamePrompt,
        initialCode: initialCode.slice(0, 500) + "...",
        feedback: feedback.slice(0, 500) + "...",
        chatId: chatId,
      },
      { step: "final-expanded-code", provider: "groq-openai-20b" },
    )
  }

  // SIMPLE2 COMPLETE CHAIN
  async generateSimple2WebGame(gamePrompt, chatId) {
    return await traceFunction(
      "Complete-Simple2-Chain-Groq",
      async () => {
        console.log(chalk.blue(`🚀 Starting SIMPLE2 chain for: ${gamePrompt}`))

        // Step 1: Game Architecture
        console.log(chalk.cyan("🎯 STEP 1: Game Architecture..."))
        const architecture = await this.getGameExplanation(gamePrompt, chatId)

        // Step 2: Thinking Stage Analysis
        console.log(chalk.cyan("🧠 STEP 2: Thinking Stage Analysis..."))
        const thinkingAnalysis = await this.getThinkingStageAnalysis(gamePrompt, architecture, chatId)

        // Step 3: Initial Code with OpenAI
        console.log(chalk.cyan("🚀 STEP 3: Initial Code Generation (OpenAI)..."))
        const initialCode = await this.generateInitialCodeWithOpenAI(thinkingAnalysis, gamePrompt, chatId)

        // Step 4: Feedback Loop
        console.log(chalk.cyan("🔄 STEP 4: Feedback Loop Analysis..."))
        const feedback = await this.feedbackLoopImprovement(initialCode, gamePrompt, chatId)

        // Step 5: Final Expanded Code
        console.log(chalk.cyan("✨ STEP 5: Final Expanded Code (1000+ lines)..."))
        const finalCode = await this.generateFinalExpandedCode(initialCode, feedback, gamePrompt, chatId)

        console.log(chalk.blue(`✅ SIMPLE2 chain completed for: ${gamePrompt}`))

        return {
          architecture,
          thinkingAnalysis,
          initialCode,
          feedback,
          finalCode,
          webGameCode: finalCode,
          chainType: "simple2",
        }
      },
      {
        gamePrompt: gamePrompt,
        chatId: chatId,
      },
      { operation: "complete-simple2-chain-groq" },
    )
  }
}

export default TracedLLMProvider
