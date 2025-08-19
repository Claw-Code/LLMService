"use client"

import Groq from "groq-sdk"
import Anthropic from "@anthropic-ai/sdk"
import { OpenRouterClient, traceFunction } from "./langsmith-tracer.js"
import chalk from "chalk"
import dotenv from "dotenv"
dotenv.config()

// Initialize API clients
const groqClient = new Groq({
  apiKey: process.env.GROQ_API_KEY,
})

const anthropicClient = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const openRouterClient = new OpenRouterClient()

// ENHANCED 4-CHAIN GROQ-POWERED SYSTEM
export class TracedLLMProvider {
  constructor() {
    this.providers = {
      groq: groqClient,
      anthropic: anthropicClient,
      openrouter: openRouterClient,
    }
  }

  async generateText(prompt, options = {}) {
    const { model = "groq", maxTokens = 4000 } = options

    try {
      let result

      if (model === "groq" && this.providers.groq) {
        const response = await this.providers.groq.chat.completions.create({
          messages: [{ role: "user", content: prompt }],
          model: "llama-3.1-70b-versatile",
          max_tokens: maxTokens,
          stream: false,
        })
        result = response.choices[0]?.message?.content || ""
      } else if (model === "anthropic" && this.providers.anthropic) {
        const response = await this.providers.anthropic.messages.create({
          model: "claude-3-sonnet-20240229",
          max_tokens: maxTokens,
          temperature: 0.2,
          messages: [{ role: "user", content: prompt }],
        })
        result = response.content[0]?.text || ""
      } else if (model === "openrouter" && this.providers.openrouter) {
        const response = await this.providers.openrouter.generate({
          model: "meta-llama/llama-3.1-70b-instruct",
          prompt: prompt,
          max_tokens: maxTokens,
        })
        result = response.text
      } else {
        throw new Error(`Unsupported model: ${model}`)
      }

      return result
    } catch (error) {
      console.error(`Error generating text with ${model}:`, error)
      throw error
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
            content: `You are a **SENIOR GAME ARCHITECT** with 15+ years creating **${difficulty.toUpperCase()}-LEVEL** React games. Design a complete, production-ready React game with **INSANE ATTENTION TO DETAIL**.

# 🎮 ${difficulty.toUpperCase()} DIFFICULTY SPECIFICATIONS

## 🎯 GAME MECHANICS (${difficulty.toUpperCase()}):
${spec.mechanics}

## ⚡ REQUIRED FEATURES (${difficulty.toUpperCase()}):
${spec.features}

## 🏗️ COMPLEXITY LEVEL (${difficulty.toUpperCase()}):
${spec.complexity}

## 🎨 ASSET REQUIREMENTS (${difficulty.toUpperCase()}):
${spec.assets}

# 🏗️ REACT SINGLE-COMPONENT ARCHITECTURE MASTERY

## 📁 MANDATORY REACT STRUCTURE:
\`\`\`
├── src/App.tsx (🎯 MAIN APP - Choose Phaser OR Babylon)
├── src/components/GameComponent.tsx (🎮 ALL GAME CODE - ${difficulty.toUpperCase()} COMPLEXITY)
├── src/main.tsx (React entry point)
├── index.html (HTML template)
└── package.json (React + Vite dependencies)
\`\`\`

## 🎮 ENGINE SELECTION STRATEGY:

### CHOOSE PHASER FOR:
- 2D games, platformers, puzzle games
- Sprite-based games, retro-style games
- Games with complex 2D physics
- Arcade-style games, side-scrollers

### CHOOSE BABYLON FOR:
- 3D games, first-person games
- 3D physics simulations
- Complex 3D environments
- Modern 3D graphics requirements

## 🎯 SINGLE COMPONENT IMPLEMENTATION:

You MUST create ONE GameComponent.tsx file that contains:
- Complete game logic (1000+ lines)
- All game systems in one file
- Either PhaserGame OR BabylonGame (NOT BOTH)
- All assets embedded as strings
- Complete responsive design
- Device detection and optimization

## 📱 RESPONSIVE DESIGN REQUIREMENTS:

### MOBILE (320px - 768px):
- Touch controls with large tap targets (44px minimum)
- Swipe gestures and touch feedback
- Portrait and landscape orientation support
- Battery-efficient rendering
- Simplified UI for small screens

### TABLET (768px - 1024px):
- Hybrid touch/mouse support
- Medium complexity graphics
- Enhanced UI spacing
- Orientation awareness

### DESKTOP (1024px+):
- Full keyboard and mouse support
- High-resolution graphics
- Advanced visual effects
- Professional UI layout

## 🎮 ${difficulty.toUpperCase()} GAME IMPLEMENTATION REQUIREMENTS:

### EASY MODE FEATURES:
- Simple controls (1-2 keys max)
- Clear visual feedback
- Forgiving collision detection
- Basic scoring system
- Simple win/lose conditions
- Clean, minimal UI
- Smooth 60fps gameplay

### MEDIUM MODE FEATURES (includes Easy +):
- Multiple game mechanics
- Power-ups and collectibles
- Progressive difficulty scaling
- Particle effects
- Sound effects integration
- Achievement system
- Advanced HUD with stats
- Smooth animations

### HARD MODE FEATURES (includes Medium +):
- Complex physics simulation
- Advanced AI systems
- Multiple game modes
- Sophisticated visual effects
- Dynamic difficulty adjustment
- Comprehensive statistics
- Professional UI/UX
- Advanced optimization
`,
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

  // CHAIN 2: Premium Code Generation with Groq - NOW INCLUDES LAYOUT.TSX
  async generatePremiumCodeWithGroq(architecture, gamePrompt, difficulty, chatId) {
    return await traceFunction(
      "Groq-Premium-Code-Generation",
      async () => {
        console.log(chalk.green(`🚀 Generating ${difficulty.toUpperCase()} premium code with Groq...`))

        const messages = [
          {
            role: "system",
            content: `You are a **SENIOR REACT GAME DEVELOPER** creating **${difficulty.toUpperCase()}-QUALITY** games. Generate **PRODUCTION-READY** code with **PERFECT RESPONSIVE DESIGN** for PC, Mobile, and Tablet.

# 🎮 ${difficulty.toUpperCase()} REACT GAME GENERATION STANDARDS

## 🏗️ REQUIRED FILE STRUCTURE:
- src/App.tsx (main app component - imports GameComponent)
- src/components/GameComponent.tsx (ALL GAME LOGIC - 1000+ lines)
- src/main.tsx (React entry point)
- index.html (HTML template)

## 🎯 GAMECOMPONENT REQUIREMENTS:
The GameComponent.tsx file MUST contain:
- Complete game engine integration (Phaser OR Babylon)
- Device detection and responsive design
- All game logic, state management, and rendering
- Touch, keyboard, and mouse input handling
- Embedded assets as strings
- Error handling and loading states
- Performance optimization for all devices

## 📱 RESPONSIVE DESIGN PATTERNS:
- Mobile (320px-768px): Touch controls, simplified graphics, battery efficiency
- Tablet (768px-1024px): Hybrid controls, medium graphics, orientation support  
- Desktop (1024px+): Full features, high graphics, advanced controls

Generate complete React structure with GameComponent containing ALL game functionality!`,
          },
          {
            role: "user",
            content: `Generate **${difficulty.toUpperCase()}-QUALITY** production code for ${gamePrompt} with PERFECT responsive design.

ARCHITECTURAL BLUEPRINT:
${architecture}

REQUIREMENTS:
1. **Difficulty**: ${difficulty.toUpperCase()} complexity and features
2. **Responsive**: PERFECT for PC, Mobile, Tablet
3. **Layout**: Generate complete app/layout.tsx
4. **Performance**: 60fps, optimized for all devices
5. **Quality**: Production-ready, professional-grade
6. **Controls**: Touch, keyboard, mouse support
7. **Clean Code**: TypeScript, proper patterns, maintainable

Generate complete, working, PERFECTLY RESPONSIVE code that works flawlessly on PC, Mobile, and Tablet.`,
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
        console.log(chalk.green(`✅ Premium ${difficulty} responsive code: ${response.length} characters`))
        return response
      },
      {
        gamePrompt: gamePrompt,
        difficulty: difficulty,
        architecture: architecture.slice(0, 500) + "...",
        chatId: chatId,
      },
      { step: "premium-responsive-code-generation", provider: "groq", difficulty: difficulty },
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
            content: `You are a **SENIOR GAME POLISH SPECIALIST** creating **${difficulty.toUpperCase()}-QUALITY** final products. Apply **PROFESSIONAL-GRADE** polish and integrate all assets perfectly with **PERFECT RESPONSIVE DESIGN**.

# ✨ ${difficulty.toUpperCase()} FINAL POLISH STANDARDS

## 🎯 REACT STRUCTURE REQUIREMENTS:
- src/App.tsx (main app component)
- src/components/GameComponent.tsx (1000+ lines of game code)
- src/main.tsx (React entry point)
- index.html (HTML template)
- package.json (React + Vite dependencies)

## 🎮 SINGLE COMPONENT ARCHITECTURE:
Everything in src/components/GameComponent.tsx:
- Complete game engine (Phaser OR Babylon)
- All game logic and systems
- Responsive design for all devices
- Embedded assets as strings
- Device detection and optimization
- Input handling (touch/keyboard/mouse)
- Audio system integration
- Performance optimization

Generate COMPLETE React project with proper file structure!`,
          },
          {
            role: "user",
            content: `Apply **${difficulty.toUpperCase()}-QUALITY** final polish and integration for ${gamePrompt} with PERFECT responsive design.

EXISTING CODE BASE:
${codeBase.slice(0, 2000)}...

GENERATED ASSETS:
${assets.slice(0, 1000)}...

REQUIREMENTS:
1. **Quality**: ${difficulty.toUpperCase()} production-ready polish
2. **Responsive**: PERFECT for PC, Mobile, Tablet
3. **Integration**: Seamless asset integration
4. **Performance**: 60fps optimized for all devices
5. **Polish**: Professional-grade final product
6. **Testing**: Comprehensive quality assurance
7. **Optimization**: Cutting-edge performance

Generate the complete, final, polished product with perfect responsive design and all assets perfectly integrated for the ${difficulty} difficulty level.`,
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
        console.log(chalk.green(`✅ Final ${difficulty} responsive polish: ${response.length} characters`))
        return response
      },
      {
        gamePrompt: gamePrompt,
        difficulty: difficulty,
        codeBase: codeBase.slice(0, 500) + "...",
        assets: assets.slice(0, 500) + "...",
        chatId: chatId,
      },
      { step: "final-responsive-polish-integration", provider: "groq" },
    )
  }

  // ENHANCED 4-CHAIN PREMIUM GENERATION WITH RESPONSIVE DESIGN
  async generatePremiumWebGame(gamePrompt, difficulty = "medium") {
    return await traceFunction(
      "Complete-Premium-4-Chain-Responsive-Groq",
      async () => {
        console.log(
          chalk.blue(
            `🚀 Starting PREMIUM RESPONSIVE 4-CHAIN generation for: ${gamePrompt} (${difficulty.toUpperCase()})`,
          ),
        )

        // CHAIN 1: Enhanced Game Architecture
        console.log(chalk.cyan("🎯 CHAIN 1: Enhanced Game Architecture..."))
        const architecture = await this.getEnhancedGameExplanation(gamePrompt, difficulty)

        // CHAIN 2: Premium Responsive Code Generation
        console.log(chalk.cyan("🚀 CHAIN 2: Premium Responsive Code Generation..."))
        const premiumCode = await this.generatePremiumCodeWithGroq(architecture, gamePrompt, difficulty)

        // CHAIN 3: Advanced Asset Generation
        console.log(chalk.cyan("🎨 CHAIN 3: Advanced Asset Generation..."))
        const advancedAssets = await this.generateAdvancedAssetsWithGroq(premiumCode, gamePrompt, difficulty)

        // CHAIN 4: Final Responsive Polish and Integration
        console.log(chalk.cyan("✨ CHAIN 4: Final Responsive Polish and Integration..."))
        const finalProduct = await this.generateFinalPolishWithGroq(premiumCode, advancedAssets, gamePrompt, difficulty)

        console.log(
          chalk.blue(`✅ PREMIUM RESPONSIVE 4-CHAIN completed for: ${gamePrompt} (${difficulty.toUpperCase()})`),
        )

        return {
          architecture,
          premiumCode,
          advancedAssets,
          finalProduct,
          webGameCode: finalProduct,
          finalCode: finalProduct,
          difficulty: difficulty,
          chainType: "premium-responsive-4-chain",
        }
      },
      {
        gamePrompt: gamePrompt,
        difficulty: difficulty,
      },
      { operation: "complete-premium-responsive-4-chain-groq", difficulty: difficulty },
    )
  }

  // SIMPLE2 CHAIN: Enhanced with Responsive Design
  async getThinkingStageAnalysis(gamePrompt, architecture, chatId) {
    return await traceFunction(
      "Groq-Thinking-Stage-Analysis",
      async () => {
        console.log(chalk.green(`🧠 Thinking stage analysis for: ${gamePrompt}`))

        const messages = [
          {
            role: "system",
            content: `You are a **SENIOR GAME ARCHITECT** in the **THINKING STAGE**. Analyze the game requirements and determine the BEST GAME ENGINE to use.

# 🧠 THINKING STAGE ANALYSIS

## 🎯 ENGINE SELECTION CRITERIA:

### PHASER.JS - Use for:
- 2D games (platformers, shooters, puzzle games)
- Sprite-based games
- Simple physics requirements
- Retro/pixel art style games
- Games with 2D animations

### BABYLON.JS - Use for:
- 3D games (first-person, third-person, racing)
- Complex 3D environments
- Advanced lighting and materials
- VR/AR experiences
- Games requiring 3D physics

## 📊 REQUIRED OUTPUT FORMAT:

**ENGINE_CHOICE: [PHASER or BABYLON]**

**REASONING:**
[Detailed explanation why this engine is best for the game]

**GAME_TYPE:**
[2D or 3D classification]

**COMPLEXITY_ASSESSMENT:**
[Game complexity analysis]

**IMPLEMENTATION_STRATEGY:**
[How to implement using chosen engine]

You MUST start your response with "ENGINE_CHOICE: PHASER" or "ENGINE_CHOICE: BABYLON"`,
          },
          {
            role: "user",
            content: `Analyze and determine the best game engine for: ${gamePrompt}

ARCHITECTURE BLUEPRINT:
${architecture}

Determine whether to use PHASER.JS (2D) or BABYLON.JS (3D) and provide detailed reasoning.`,
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
        console.log(chalk.green(`✅ Engine selection analysis: ${response.length} characters`))
        return response
      },
      {
        gamePrompt: gamePrompt,
        architecture: architecture.slice(0, 500) + "...",
        chatId: chatId,
      },
      { step: "engine-selection-analysis", provider: "groq" },
    )
  }

  extractEngineChoice(thinkingAnalysis) {
    const engineMatch = thinkingAnalysis.match(/ENGINE_CHOICE:\s*(PHASER|BABYLON)/i)
    return engineMatch ? engineMatch[1].toUpperCase() : "PHASER" // Default to PHASER
  }

  async generateInitialCodeWithOpenAI(thinkingAnalysis, gamePrompt, chatId) {
    return await traceFunction(
      "Groq-OpenAI-Initial-Responsive-Code",
      async () => {
        console.log(chalk.green(`🚀 Generating initial responsive code with Groq + OpenAI 20B...`))

        const engineChoice = this.extractEngineChoice(thinkingAnalysis)
        console.log(chalk.yellow(`🎮 Selected Engine: ${engineChoice}`))

        const messages = [
          {
            role: "system",
            content: `You are an **EXPERT REACT GAME DEVELOPER** specializing in **${engineChoice}.JS**. 

# 🎮 GAMECOMPONENT GENERATION TASK

## 🎯 YOUR MISSION:
Generate a **COMPLETE GAMECOMPONENT.TSX** file with **1000+ lines** of production-ready ${engineChoice}.js game code.

## 📋 STRICT REQUIREMENTS:

### 1. FILE STRUCTURE:
- Generate ONLY src/components/GameComponent.tsx
- NO other files, NO app/page.tsx, NO Next.js code
- Pure React component using ${engineChoice}.js

### 2. ${engineChoice}.JS IMPLEMENTATION:
${
  engineChoice === "PHASER"
    ? `
- Import Phaser from 'phaser'
- Create Phaser.Game instance
- Implement complete game scenes
- Handle 2D sprites, animations, physics
- Add sound effects and music
`
    : `
- Import * as BABYLON from '@babylonjs/core'
- Create BABYLON.Engine and Scene
- Implement 3D meshes, cameras, lighting
- Add physics with @babylonjs/core
- Handle 3D animations and materials
`
}

### 3. COMPONENT STRUCTURE:
\`\`\`tsx
import React, { useEffect, useRef, useState } from 'react'
${engineChoice === "PHASER" ? "import Phaser from 'phaser'" : "import * as BABYLON from '@babylonjs/core'"}

interface GameComponentProps {
  // Props interface
}

const GameComponent: React.FC<GameComponentProps> = () => {
  // 1000+ lines of complete game implementation
  // All game logic, assets, controls in ONE component
  
  return (
    <div className="game-container">
      <canvas ref={gameRef} />
      {/* Game UI elements */}
    </div>
  )
}

export default GameComponent
\`\`\`

### 4. CODE REQUIREMENTS:
- 1000+ lines minimum
- Complete game functionality
- Responsive design
- Error handling
- Performance optimization
- Embedded assets as base64 strings
- Full game loop implementation

Generate the complete GameComponent.tsx file now.`,
          },
          {
            role: "user",
            content: `Generate a complete GameComponent.tsx using ${engineChoice}.JS for: ${gamePrompt}

THINKING ANALYSIS:
${thinkingAnalysis}

ENGINE SELECTED: ${engineChoice}

Requirements:
- 1000+ lines of ${engineChoice}.js game code
- Complete React component
- All game logic in ONE file
- Responsive design
- Production quality

Generate the complete GameComponent.tsx file.`,
          },
        ]

        const chatCompletion = await this.providers.groq.chat.completions.create({
          messages: messages,
          model: "llama-3.3-70b-versatile",
          temperature: 0.7,
          max_tokens: 8000,
          top_p: 1,
          stream: false,
        })

        const response = chatCompletion.choices[0]?.message?.content || ""
        console.log(chalk.green(`✅ ${engineChoice} GameComponent generated: ${response.length} characters`))
        return response
      },
      {
        gamePrompt: gamePrompt,
        thinkingAnalysis: thinkingAnalysis.slice(0, 500) + "...",
        chatId: chatId,
      },
      { step: "engine-specific-code-generation", provider: "groq", engine: this.extractEngineChoice(thinkingAnalysis) },
    )
  }

  async generateFinalExpandedCode(initialCode, feedback, gamePrompt, chatId) {
    return await traceFunction(
      "Groq-Final-Expanded-Responsive-Code",
      async () => {
        console.log(chalk.green(`✨ Generating final expanded responsive code for: ${gamePrompt}`))

        const messages = [
          {
            role: "system",
            content: `You are a **SENIOR REACT DEVELOPER** creating the **FINAL RESPONSIVE VERSION** with **1000+ LINES** and **PERFECT DEVICE SUPPORT**.

# ✨ REACT SINGLE COMPONENT FINAL VERSION

## 🎯 REQUIREMENTS:
- **EVERYTHING in src/components/GameComponent.tsx** - One massive responsive component
- **src/App.tsx** - Simple app wrapper
- **src/main.tsx** - React entry point
- **index.html** - HTML template
- **MINIMUM 1000 LINES** in GameComponent.tsx
- **PERFECT for PC, Mobile, Tablet**
- **NO EXTERNAL DEPENDENCIES** except UI components
- **EMBEDDED ASSETS** - All SVG, audio, images as strings

## 📱 RESPONSIVE EXPANSION STRATEGY:

### 1. DEVICE DETECTION SYSTEM (100+ lines):
- Complete device detection logic
- Orientation change handling
- Viewport size monitoring
- Performance scaling per device

### 2. RESPONSIVE GAME ENGINE (400+ lines):
- Device-optimized physics system
- Adaptive collision detection
- Scalable particle systems
- Device-specific animations
- Performance optimization per device

### 3. MULTI-DEVICE INPUT SYSTEM (200+ lines):
- Touch controls for mobile/tablet
- Keyboard controls for desktop
- Mouse controls for desktop
- Gesture recognition
- Input method switching

### 4. RESPONSIVE UI SYSTEM (400+ lines):
- Mobile-first menu system
- Tablet-optimized HUD
- Desktop professional interface
- Responsive game over screens
- Adaptive settings panels
- Cross-device layouts

### 5. EMBEDDED RESPONSIVE ASSETS (100+ lines):
- Device-optimized SVG sprites
- Responsive audio system
- Adaptive visual effects
- Scalable UI elements

## 📋 FINAL OUTPUT:

Generate ONLY:

// === src/App.tsx ===
[Simple React app wrapper]

// === src/components/GameComponent.tsx ===
[1000+ lines of complete, perfectly responsive game]

// === src/main.tsx ===
[React entry point with proper setup]

// === index.html ===
[HTML template with proper viewport and metadata]

Create the **ULTIMATE RESPONSIVE REACT GAME** with **1000+ LINES** of **PRODUCTION-QUALITY** code!`,
          },
          {
            role: "user",
            content: `Generate the final expanded RESPONSIVE version for: ${gamePrompt}

INITIAL CODE:
${initialCode.slice(0, 2000)}...

FEEDBACK FOR IMPROVEMENTS:
${feedback}

REQUIREMENTS:
- MINIMUM 1000 lines in src/components/GameComponent.tsx
- LLM-generated app/layout.tsx
- PERFECT responsive design (PC, Mobile, Tablet)
- Apply all feedback improvements
- Production-ready quality
- Comprehensive implementation
- Professional-grade code

Generate the complete, final, expanded, PERFECTLY RESPONSIVE implementation.`,
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
        console.log(chalk.green(`✅ Final expanded responsive code: ${response.length} characters`))
        return response
      },
      {
        gamePrompt: gamePrompt,
        initialCode: initialCode.slice(0, 500) + "...",
        feedback: feedback.slice(0, 500) + "...",
        chatId: chatId,
      },
      { step: "final-expanded-responsive-code", provider: "groq" },
    )
  }

  // SIMPLE2 COMPLETE RESPONSIVE CHAIN
  async generateSimple2WebGame(gamePrompt, difficulty = "medium") {
    return await traceFunction(
      "Complete-Simple2-Responsive-Chain-Groq",
      async () => {
        console.log(chalk.blue(`🚀 Starting SIMPLE2 RESPONSIVE chain for: ${gamePrompt}`))

        // Step 1: Game Architecture
        console.log(chalk.cyan("🎯 STEP 1: Game Architecture..."))
        const architecture = await this.getEnhancedGameExplanation(gamePrompt)

        // Step 2: Responsive Thinking Stage Analysis
        console.log(chalk.cyan("🧠 STEP 2: Responsive Thinking Stage Analysis..."))
        const thinkingAnalysis = await this.getThinkingStageAnalysis(gamePrompt, architecture)

        // Step 3: Initial Responsive Code with OpenAI
        console.log(chalk.cyan("🚀 STEP 3: Initial Responsive Code Generation (OpenAI)..."))
        const initialCode = await this.generateInitialCodeWithOpenAI(thinkingAnalysis, gamePrompt)

        // Step 4: Responsive Feedback Loop
        console.log(chalk.cyan("🔄 STEP 4: Responsive Feedback Loop Analysis..."))
        const feedback = await this.feedbackLoopImprovement(initialCode, gamePrompt)

        // Step 5: Final Expanded Responsive Code
        console.log(chalk.cyan("✨ STEP 5: Final Expanded Responsive Code (1000+ lines)..."))
        const finalCode = await this.generateFinalExpandedCode(initialCode, feedback, gamePrompt)

        console.log(chalk.blue(`✅ SIMPLE2 RESPONSIVE chain completed for: ${gamePrompt}`))

        return {
          architecture,
          thinkingAnalysis,
          initialCode,
          feedback,
          finalCode,
          webGameCode: finalCode,
          chainType: "simple2-responsive",
        }
      },
      {
        gamePrompt: gamePrompt,
        difficulty: difficulty,
      },
      { operation: "complete-simple2-responsive-chain-groq" },
    )
  }

  // Keep existing methods for backward compatibility
  async getGameExplanation(gamePrompt) {
    return await this.getEnhancedGameExplanation(gamePrompt, "medium")
  }

  async generateCleanCodeWithQwen(groqExplanation, gamePrompt) {
    return await this.generatePremiumCodeWithGroq(groqExplanation, gamePrompt, "medium")
  }

  async validateWithAnthropic(qwenInitialCode, gamePrompt) {
    return await traceFunction(
      "Anthropic-Quality-Validation",
      async () => {
        console.log(chalk.green(`🔍 Validating quality with Anthropic...`))

        const prompt = `You are a senior code reviewer. Validate this React game code for production readiness:

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
      },
      { step: "quality-validation", provider: "anthropic" },
    )
  }

  async generateFinalCodeWithQwen(anthropicFeedback, qwenInitialCode, gamePrompt) {
    return await this.generateFinalPolishWithGroq(qwenInitialCode, anthropicFeedback, gamePrompt, "medium")
  }

  // Legacy method for existing simple chain
  async generateWebGame(gamePrompt, skipValidation = false) {
    return await this.generatePremiumWebGame(gamePrompt, "medium")
  }

  async feedbackLoopImprovement(initialCode, gamePrompt) {
    const prompt = `
You are a senior game developer reviewing and improving React game code.

GAME REQUEST: ${gamePrompt}

INITIAL CODE TO IMPROVE:
${initialCode}

FEEDBACK ANALYSIS TASK:
1. Analyze the code for potential improvements
2. Identify performance optimizations
3. Suggest responsive design enhancements
4. Check for missing game mechanics
5. Recommend code structure improvements

Provide specific, actionable feedback in JSON format:
{
  "performance_issues": ["list of performance concerns"],
  "missing_features": ["list of missing game features"],
  "responsive_improvements": ["list of responsive design suggestions"],
  "code_quality": ["list of code quality improvements"],
  "recommendations": ["list of specific implementation suggestions"]
}
`

    try {
      const response = await this.providers.groq.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: "llama-3.1-70b-versatile",
        max_tokens: 2000,
        temperature: 0.3,
      })

      const feedback = response.choices[0]?.message?.content || "No feedback generated"
      console.log(chalk.green(`✅ Feedback analysis: ${feedback.length} characters`))

      return feedback
    } catch (error) {
      console.error(chalk.red(`❌ Feedback loop error: ${error.message}`))
      return "Feedback analysis failed - proceeding with initial code"
    }
  }
}

export default TracedLLMProvider
