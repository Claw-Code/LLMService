"use client"

import Groq from "groq-sdk"
import Anthropic from "@anthropic-ai/sdk"
import { traceFunction } from "./langsmith-tracer.js"
import chalk from "chalk"
import dotenv from "dotenv"
import natural from "natural"


import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Convert import.meta.url to __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read the JS file as a string
const minecraftTemplate = fs.readFileSync(path.join(__dirname, '../cache/shooter.tsx'), 'utf-8');
const emptyTemplate = fs.readFileSync(path.join(__dirname, '../cache/empty.tsx'), 'utf-8');
const marioTemplate = fs.readFileSync(path.join(__dirname, '../cache/mario-cache.tsx'), 'utf-8');
const pingpongTemplate = fs.readFileSync(path.join(__dirname, '../cache/ping-pong.tsx'), 'utf-8');


dotenv.config()

// Initialize API clients
const groqClient = new Groq({
  apiKey: process.env.GROQ_API_KEY,
})

const anthropicClient = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// ENHANCED 4-CHAIN GROQ-POWERED SYSTEM
export class TracedLLMProvider {
  constructor() {
    this.providers = {
      groq: groqClient,
      anthropic: anthropicClient,
    };
    // Initialize classifier as a class property to train only once
    this.classifier = null;
    // Define game presets
    this.gamePresets = {
      minecraft: {
        name: "Minecraft",
        description: "An open-world sandbox game with exploration, building, and survival.",
        settings: {
          openWorld: true,
          crafting: true,
          survival: true,
          difficulty: "variable",
        },
        template: minecraftTemplate, // <-- attached template as variable
      },
      pingpong: {
        name: "Ping Pong",
        description: "A fast-paced table tennis game with reflex challenges and multiplayer options.",
        settings: {
          sports: true,
          multiplayer: true,
          physics: true,
          difficulty: "variable",
        },
        template: pingpongTemplate, // <-- attach your pingpong template variable
      },
      mario: {
        name: "Mario",
        description: "A platformer game with action, jumping, and puzzle-solving.",
        settings: {
          platformer: true,
          action: true,
          levels: true,
          difficulty: "medium",
        },
        template: marioTemplate, // <-- attached template as variable
      },
      empty: {
        name: "Empty",
        description: "A generic preset for games that don’t match Minecraft or Mario.",
        settings: {
          generic: true,
          difficulty: "unknown",
        },
        template: emptyTemplate, // <-- attached template as variable
      },
    };
    // Training data for classifier
    this.trainingData = [
      // Minecraft
      { text: "Make a game shooter game", label: "minecraft" },
      { text: "Create a first-person shooter game", label: "minecraft" },
      { text: "Build a game where players shoot enemies", label: "minecraft" },
      { text: "An action shooter with weapons and maps", label: "minecraft" },
      { text: "Make a multiplayer shooting game with PvP", label: "minecraft" },
      { text: "A block-based world where players fight using guns", label: "minecraft" },
      { text: "A sandbox game with exploration and gun-based battles", label: "minecraft" },
      { text: "Create an open-world survival game with firearms and enemies", label: "minecraft" },
      { text: "A game where players mine, craft, and fight opponents", label: "minecraft" },
      { text: "Explore a blocky world with crafting and shooting mechanics", label: "minecraft" },
      { text: "Build structures and defend them using weapons", label: "minecraft" },
      { text: "Open-world adventure with mining, crafting, and PvP combat", label: "minecraft" },
      { text: "A sandbox environment where players can shoot mobs and other players", label: "minecraft" },
      { text: "Craft items and survive by fighting enemies with guns", label: "minecraft" },
      { text: "A block-based world where exploration meets shooting action", label: "minecraft" },

      { text: "Make a fast-paced ping pong game", label: "pingpong" },
      { text: "A table tennis game with realistic ball physics", label: "pingpong" },
      { text: "Create a multiplayer ping pong match online", label: "pingpong" },
      { text: "A game where players compete in intense ping pong rallies", label: "pingpong" },
      { text: "Play table tennis with power-ups and obstacles", label: "pingpong" },
      { text: "Ping pong tournament with AI and online opponents", label: "pingpong" },
      { text: "A fun ping pong game with tricky spins and shots", label: "pingpong" },
      { text: "Fast reflex ping pong challenges with different arenas", label: "pingpong" },
      { text: "Multiplayer ping pong with special moves and combos", label: "pingpong" },
      { text: "Table tennis adventure with levels and skill upgrades", label: "pingpong" },

      // Mario
      { text: "Make a Mario game", label: "mario" },
      { text: "Create a platformer like Mario", label: "mario" },
      { text: "A Mario-style jumping game", label: "mario" },
      { text: "Design a game with Mario running and coins", label: "mario" },
      { text: "A platform game with Mario action", label: "mario" },
      { text: "Build a Mario-inspired adventure", label: "mario" },
      { text: "A side-scroller game with Mario", label: "mario" },
      { text: "Play a Mario game with levels", label: "mario" },
      { text: "Create a Mario-like puzzle platformer", label: "mario" },
      { text: "A Mario Bros style arcade game", label: "mario" },
      { text: "Make a Super Mario game", label: "mario" },
      { text: "A platformer game with jumping and levels", label: "mario" },
      { text: "Create a game like Mario Bros with action", label: "mario" },
      { text: "A game with Mario running and collecting coins", label: "mario" },
      { text: "A platform game with puzzle elements", label: "mario" },


      // Empty (including puzzle games like Pac-Man)
      { text: "Make a pac man game", label: "empty" },
      { text: "A game like pac man with mazes", label: "empty" },
      { text: "A puzzle game to solve logic riddles", label: "empty" },
      { text: "Create a game with brain teasers", label: "empty" },
      { text: "A logic-based maze game", label: "empty" },
      { text: "A generic game with no specific theme", label: "empty" },

    ];
  }

  // Initialize classifier only once
  initializeClassifier() {
    // If already initialized, return it
    if (this.classifier) return this.classifier;

    // Create a new Bayes classifier
    this.classifier = new natural.BayesClassifier();

    // Add training data dynamically
    this.trainingData.forEach(({ text, label }) => {
      this.classifier.addDocument(text, label);
    });

    // Train classifier
    this.classifier.train();
    return this.classifier;
  }



  async generateText(prompt, options = {}) {
    const { model = "groq", maxTokens = 4000 } = options

    try {
      let result

      if (model === "groq" && this.providers.groq) {
        const response = await this.providers.groq.chat.completions.create({
          messages: [{ role: "user", content: prompt }],
          model: "meta-llama/llama-4-scout-17b-16e-instruct",
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
        console.log(chalk.green(`🎯 Generating simplified game ideas (with optional CDN assets) for: ${gamePrompt}`));

        const difficultySpecs = {
          easy: "Simple mechanics: click/tap, basic movement, collisions. Few objects. Solid-colored shapes. Optional small CDN images allowed.",
          medium: "Moderate mechanics: movement, collectibles, obstacles. Some interactions. Shapes only, but may use lightweight CDN assets for visuals.",
          hard: "Complex mechanics: physics, enemies, multiple interactions. Shapes preferred, can fetch external assets if needed for clarity."
        };

        const spec = difficultySpecs[difficulty] || difficultySpecs.medium;

        const messages = [
          {
            role: "system",
            content: `
You are a **React game architect**. Generate a **concise, actionable game design outline**.
- Focus on mechanics, objects, interactions, and optional assets.
- Use simple geometric shapes (rectangles, circles, triangles) as primary visuals.
- CDN assets (images, textures) are allowed if it improves clarity or polish.
- Include scoring, input, collisions, reset logic.
- Keep it brief and implementation-ready for a single React GameComponent.
Difficulty: ${difficulty}
Specs: ${spec}
Game Prompt: "${gamePrompt}"
          `
          },
          {
            role: "user",
            content: `Provide a simple, clear game idea and outline for: "${gamePrompt}". Use shapes primarily, but you can suggest lightweight CDN assets for objects or backgrounds.`
          }
        ];

        const chatCompletion = await this.providers.groq.chat.completions.create({
          messages: messages,
          model: "meta-llama/llama-4-scout-17b-16e-instruct",
          temperature: 0.3,
          max_tokens: 1200,
          top_p: 1,
          stream: false,
        });

        const response = chatCompletion.choices[0]?.message?.content || "";
        console.log(chalk.green(`✅ Simplified architecture generated: ${response.length} chars`));
        return response;
      },
      { gamePrompt, difficulty, chatId },
      { step: "enhanced-game-architecture", provider: "groq", difficulty },
    );
  }


  // CHAIN 2: Premium Code Generation with Groq - NOW INCLUDES LAYOUT.TSX
  async generatePremiumCodeWithGroq(architecture, gamePrompt, difficulty, chatId) {
    return await traceFunction(
      "Groq-Premium-Code-Generation",
      async () => {
        console.log(chalk.green(`🚀 Generating ${difficulty} premium code with Groq...`))

        const messages = [
          {
            role: "system",
            content: `You are a **SENIOR REACT GAME DEVELOPER** creating games using ONLY Phaser.js built-in objects.

# 🎮 PHASER OBJECTS-ONLY GAMECOMPONENT GENERATION

## 🚨 CRITICAL REQUIREMENTS:
- Generate ONLY src/components/GameComponent.tsx - NO OTHER FILES!
- Use ONLY Phaser built-in objects: Rectangle, Circle, Graphics
- NO external assets, images, or sprites
- NO sound implementation
- Maximum 6000 characters to prevent truncation

## 🎯 PHASER OBJECTS TO USE:
\`\`\`javascript
// Player character
this.player = this.add.rectangle(x, y, 40, 60, 0x00ff00); // Green rectangle

// Enemies
this.enemy = this.add.circle(x, y, 20, 0xff0000); // Red circle

// Collectibles
this.coin = this.add.triangle(x, y, 15, 15, 0xffff00); // Yellow triangle

// Platforms
this.platform = this.add.rectangle(x, y, 200, 20, 0x8B4513); // Brown rectangle

// Bullets/Projectiles
this.bullet = this.add.circle(x, y, 5, 0xffffff); // White circle
\`\`\`

## 📱 RESPONSIVE DESIGN:
- Mobile: Touch controls, larger shapes for easier interaction
- Desktop: Keyboard controls, precise movement
- All devices: Smooth 60fps performance

Generate a complete, working GameComponent.tsx using ONLY these Phaser objects!`,
          },
          {
            role: "user",
            content: `Generate **${difficulty} QUALITY** GameComponent.tsx for: ${gamePrompt}

ARCHITECTURE BLUEPRINT:
${architecture.slice(0, 1000)}...

REQUIREMENTS:
- Use ONLY Phaser.GameObjects.Rectangle, Circle, Graphics
- Create visually appealing game with colored shapes
- Complete game mechanics and responsive design
- Maximum 6000 characters to prevent response truncation
- Make it look realistic and cool with creative shape usage

Generate ONLY GameComponent.tsx with complete game functionality!`,
          },
        ]

        const chatCompletion = await this.providers.groq.chat.completions.create({
          messages: messages,
          model: "meta-llama/llama-4-scout-17b-16e-instruct",
          temperature: 0.2,
          max_tokens: 6000, // Reduced to prevent truncation
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
      "Groq-Simple-Objects-Enhancement",
      async () => {
        console.log(chalk.green(`🎨 Enhancing ${difficulty} Phaser objects...`))

        const messages = [
          {
            role: "system",
            content: `You are enhancing Phaser games using ONLY built-in objects and shapes.

# 🎨 PHASER OBJECTS ENHANCEMENT

## 🚨 CONSTRAINTS:
- Use ONLY Phaser.GameObjects.Rectangle, Circle, Graphics
- NO external assets or complex graphics
- Focus on creative color combinations and animations
- Maximum 3000 characters to prevent truncation

## 🎯 ENHANCEMENT TECHNIQUES:
- Gradient colors using Graphics.fillGradientStyle()
- Shape animations with tweens
- Particle effects using simple circles
- Creative layering of basic shapes
- Color transitions and pulsing effects

Provide simple enhancements that make basic shapes look more appealing.`,
          },
          {
            role: "user",
            content: `Enhance the Phaser objects for: ${gamePrompt}

EXISTING CODE:
${codeBase.slice(0, 1500)}...

Add creative enhancements using ONLY Phaser built-in shapes and effects.
Maximum 3000 characters response.`,
          },
        ]

        const chatCompletion = await this.providers.groq.chat.completions.create({
          messages: messages,
          model: "meta-llama/llama-4-scout-17b-16e-instruct",
          temperature: 0.3,
          max_tokens: 3000, // Reduced to prevent truncation
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
        console.log(chalk.green(`✨ Applying ${difficulty} final polish with Groq...`))

        const messages = [
          {
            role: "system",
            content: `You are a **SENIOR GAME POLISH SPECIALIST** creating **${difficulty}-QUALITY** GameComponent.tsx ONLY.

# ✨ ${difficulty} GAMECOMPONENT FINAL POLISH

## 🚨 CRITICAL REQUIREMENT:
Polish and perfect ONLY the GameComponent.tsx file - NO OTHER FILES!

## 🎯 GAMECOMPONENT POLISH REQUIREMENTS:
Perfect the single GameComponent.tsx with:
- Complete game engine (Phaser OR Babylon) - 1000+ lines minimum
- ALL game logic and systems in one component
- Responsive design for all devices
- Embedded assets as strings within the component
- Device detection and optimization
- Input handling (touch/keyboard/mouse)
- Audio system integration
- Performance optimization
- Professional code quality

Generate the final, polished GameComponent.tsx with everything embedded in one massive component!`,
          },
          {
            role: "user",
            content: `Apply **${difficulty} QUALITY** final polish and integration for ${gamePrompt} with PERFECT responsive design.

EXISTING CODE BASE:
${codeBase.slice(0, 2000)}...

GENERATED ASSETS:
${assets.slice(0, 1000)}...

REQUIREMENTS:
1. **Quality**: ${difficulty} production-ready polish
2. **Responsive**: PERFECT for PC, Mobile, Tablet
3. **Integration**: Seamless asset integration
4. **Performance**: 60fps optimized for all devices
5. **Polish**: Professional-grade final product
6. **Testing**: Comprehensive quality assurance
7. **Optimization**: Cutting-edge performance

Generate ONLY the complete GameComponent.tsx file.`,
          },
        ]

        const chatCompletion = await this.providers.groq.chat.completions.create({
          messages: messages,
          model: "meta-llama/llama-4-scout-17b-16e-instruct",
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
            `🚀 Starting PREMIUM RESPONSIVE 4-CHAIN generation for: ${gamePrompt} (${difficulty})`,
          ),
        )

        // CHAIN 1: Enhanced Game Architecture
        console.log(chalk.cyan("🎯 CHAIN 1: Enhanced Game Architecture..."))
        const architecture = await this.getEnhancedGameExplanation(gamePrompt, difficulty)

        // CHAIN 2: Premium Responsive Code Generation
        console.log(chalk.cyan("🚀 CHAIN 2: Premium Responsive Code Generation..."))
        const premiumCode = await this.generatePremiumCodeWithGroq(architecture, gamePrompt, difficulty)
        console.log(premiumCode);
        // CHAIN 3: Advanced Asset Generation
        console.log(chalk.cyan("🎨 CHAIN 3: Advanced Asset Generation..."))
        const advancedAssets = await this.generateAdvancedAssetsWithGroq(premiumCode, gamePrompt, difficulty)

        // CHAIN 4: Final Responsive Polish and Integration
        console.log(chalk.cyan("✨ CHAIN 4: Final Responsive Polish and Integration..."))
        const finalProduct = await this.generateFinalPolishWithGroq(premiumCode, advancedAssets, gamePrompt, difficulty)

        console.log(
          chalk.blue(`✅ PREMIUM RESPONSIVE 4-CHAIN completed for: ${gamePrompt} (${difficulty})`),
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
  async generateSimple2WebGame(gamePrompt, difficulty = "medium") {
    return await traceFunction(
      "Complete-Simple2-Responsive-Chain-Groq",
      async () => {
        console.log(chalk.blue(`🚀 Starting SIMPLE2 RESPONSIVE chain for: ${gamePrompt}`))

        // // Step 1: Game Architecture
        // console.log(chalk.cyan("🎯 STEP 1: Game Architecture..."))
        // const architecture = await this.getEnhancedGameExplanation(gamePrompt, difficulty)

        // // Step 2: Responsive Thinking Stage Analysis
        // (chalk.cyan("🧠 STEP 2: Responsive Thinking Stage Analysis..."))
        const typeOfGame = await this.get_typeOfGame(gamePrompt)
        await console.log(typeOfGame);
        // thinkingAnalysis = " ";
        const architecture = " ";
        // Step 3: Initial Responsive Code with Groq
        console.log(chalk.cyan("🚀 STEP 3: Initial Responsive Code Generation (Groq)..."))
        const initialCode = await this.generateInitialCodeWithGroq(typeOfGame, gamePrompt, difficulty)

        console.log(chalk.green("✅ Using initial code as final output - steps 4 and 5 skipped"))
        const finalCode = initialCode;
        console.log(finalCode);
        //  // Step 4: Conditional Responsive Feedback Loop
        // console.log(chalk.cyan("🔄 STEP 4: Responsive Feedback Loop Analysis..."))
        // const bugDetection = await this.detectCodeBugs(initialCode, gamePrompt)

        // let feedback = null
        // let finalCode = initialCode

        // if (bugDetection.hasBugs) {
        //   console.log(chalk.yellow(`🐛 Bugs detected: ${bugDetection.bugCount} issues found`))
        //   console.log(chalk.cyan("🔧 Proceeding with feedback loop to fix bugs..."))

        //   feedback = await this.feedbackLoopImprovement(initialCode, gamePrompt, bugDetection)

        //   // Step 5: Final Expanded Responsive Code with bug fixes
        //   console.log(chalk.cyan("✨ STEP 5: Final Expanded Responsive Code with bug fixes..."))
        //   finalCode = await this.generateFinalExpandedCode(initialCode, feedback, gamePrompt, difficulty)
        // } else {
        //   console.log(chalk.green("✅ No bugs detected - skipping feedback loop"))
        //   console.log(chalk.cyan("✨ Using initial code as final code"))
        // }


        console.log(chalk.blue(`✅ SIMPLE2 RESPONSIVE chain completed for: ${gamePrompt}`))

        return {
          architecture,
          initialCode,
          //feedback,
          feedback: "null",
          finalCode,
          webGameCode: finalCode,
          chainType: "simple2-responsive",
          //  bugDetection,
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

  async detectCodeBugs(code, gamePrompt) {
    const prompt = `
You are a senior code reviewer specializing in React game development. Analyze this code for CRITICAL BUGS ONLY.

GAME CODE TO ANALYZE:
${code}

CRITICAL BUG DETECTION TASK:
Look for these CRITICAL issues only:
1. Syntax errors that prevent compilation
2. Missing imports or dependencies
3. Undefined variables or functions
4. Type errors in TypeScript
5. React lifecycle issues
6. Game engine integration problems
7. Critical performance issues that break the game

IGNORE minor issues like:
- Code style preferences
- Minor optimizations
- Cosmetic improvements

Respond in JSON format:
{
  "hasBugs": true/false,
  "bugCount": number,
  "criticalBugs": ["list of critical bugs found"],
  "severity": "low/medium/high",
  "canProceed": true/false
}

If no CRITICAL bugs found, return hasBugs: false.
`

    try {
      const response = await this.providers.groq.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: "meta-llama/llama-4-scout-17b-16e-instruct",
        max_tokens: 1500,
        temperature: 0.1,
      })

      const bugAnalysis = response.choices[0]?.message?.content || ""

      // Parse JSON response
      try {
        const bugData = JSON.parse(bugAnalysis)
        console.log(chalk.green(`🔍 Bug detection: ${bugData.hasBugs ? "BUGS FOUND" : "NO BUGS"}`))
        return bugData
      } catch (parseError) {
        // Fallback if JSON parsing fails
        const hasBugs =
          bugAnalysis.toLowerCase().includes("true") ||
          bugAnalysis.toLowerCase().includes("error") ||
          bugAnalysis.toLowerCase().includes("bug")

        return {
          hasBugs,
          bugCount: hasBugs ? 1 : 0,
          criticalBugs: hasBugs ? ["Parse error in bug detection"] : [],
          severity: hasBugs ? "medium" : "low",
          canProceed: true,
        }
      }
    } catch (error) {
      console.error(chalk.red(`❌ Bug detection error: ${error.message}`))
      // Default to no bugs if detection fails
      return {
        hasBugs: false,
        bugCount: 0,
        criticalBugs: [],
        severity: "low",
        canProceed: true,
      }
    }
  }

  async feedbackLoopImprovement(initialCode, gamePrompt, bugDetection = null) {
    const prompt = `
You are a senior game developer fixing CRITICAL BUGS in React game code.

GAME REQUEST: ${gamePrompt}

INITIAL CODE WITH BUGS:
${initialCode}

${
  bugDetection
        ? `
DETECTED BUGS TO FIX:
${JSON.stringify(bugDetection, null, 2)}
`
        : ""
      }

BUG FIXING TASK:
1. Fix all critical bugs identified
2. Ensure code compiles and runs
3. Maintain game functionality
4. Provide specific fixes for each bug
5. Merge initial code with bug fixes

Provide specific bug fixes in JSON format:
{
  "fixes_applied": ["list of specific fixes made"],
  "code_changes": ["list of code modifications"],
  "remaining_issues": ["any issues that still need attention"],
  "merge_strategy": "how to merge fixes with initial code",
  "final_recommendations": ["final implementation suggestions"]
}
`

    try {
      const response = await this.providers.groq.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: "meta-llama/llama-4-scout-17b-16e-instruct",
        max_tokens: 2500,
        temperature: 0.2,
      })

      const feedback = response.choices[0]?.message?.content || "No feedback generated"
      console.log(chalk.green(`✅ Bug fixing feedback: ${feedback.length} characters`))

      return feedback
    } catch (error) {
      console.error(chalk.red(`❌ Feedback loop error: ${error.message}`))
      return "Bug fixing failed - proceeding with initial code"
    }
  }

  // CHAIN 5: Final Expanded Responsive Code
  async generateFinalExpandedCode(initialCode, feedback, gamePrompt, difficulty, chatId) {
    return await traceFunction(
      "Groq-Final-Expanded-Responsive-Code",
      async () => {
        console.log(chalk.green(`✨ Generating final expanded responsive code for: ${gamePrompt}`))

        const messages = [
          {
            role: "system",
            content: `You are a **SENIOR REACT DEVELOPER** creating the **FINAL GAMECOMPONENT.TSX** with **1000+ LINES**.

# ✨ GAMECOMPONENT FINAL VERSION

## 🚨 CRITICAL CONSTRAINTS:
- Use ONLY Phaser.GameObjects.Rectangle, Circle, Triangle
- Use ONLY Phaser.GameObjects.Graphics for drawing shapes
- Use ONLY solid colors: 0xff0000, 0x00ff00, 0x0000ff, etc.
- NO external images, sprites, or asset files
- NO sound implementation
- Focus on game mechanics with simple colored shapes

## 🎯 SINGLE GAMECOMPONENT ARCHITECTURE:
Design ONE GameComponent.tsx (1000+ lines) containing:
- Complete Phaser game using only built-in shapes
- All game objects as colored rectangles/circles/triangles
- Responsive design with device detection
- Complete game loop with simple geometric graphics`,
          },
          {
            role: "user",
            content: `Generate the final expanded RESPONSIVE version for: ${gamePrompt}

INITIAL CODE:
${initialCode.slice(0, 2000)}...

FEEDBACK FOR IMPROVEMENTS:
${feedback}

REQUIREMENTS:
- Use ONLY Phaser.GameObjects.Rectangle, Circle, Graphics
- Create visually appealing game with colored shapes
- Complete game mechanics and responsive design
- Maximum 6000 characters to prevent response truncation
- Make it look realistic and cool with creative shape usage

Generate ONLY GameComponent.tsx with complete game functionality!`,
          },
        ]

        const chatCompletion = await this.providers.groq.chat.completions.create({
          messages: messages,
          model: "meta-llama/llama-4-scout-17b-16e-instruct",
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

  // Legacy method for existing simple chain
  async generateWebGame(gamePrompt, skipValidation = false) {
    return await this.generatePremiumWebGame(gamePrompt, "medium")
  }

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
          model: "meta-llama/llama-4-scout-17b-16e-instruct",
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


  async generateInitialCodeWithGroq(typeOfGame, gamePrompt, difficulty, chatId) {
    return await traceFunction(
      "Groq-Initial-Responsive-Code",
      async () => {
        console.log(chalk.green(`🚀 Generating initial responsive Canvas/3D game code based on instructions...`));

        // Ensure dynamic template is correctly passed
        const baseTemplate = typeOfGame?.suggestedTemplate || "";
        const is3D = typeOfGame?.is3D || false; // optional flag for 3D games like Three.js

        const messages = [
          {
            role: "system",
            content: `You are a **world-class React + TypeScript game developer**.  
Your task is to generate a **complete, fully playable game** in a **single GameComponent.tsx** that dynamically adapts to the game type requested.  

# 🔹 OBJECTIVE
- Produce only working, clean, executable TypeScript code.  
- Do NOT leave placeholders, TODOs, or incomplete sections.  
- Include **all game logic**: player, obstacles, collectibles, scoring, input handling, reset, game over, instructions, and rendering.  
- Include styles fully inline in the Game Component.  
- The game must be **fully functional and ready to run** in a React app.  

# 🚨 REQUIREMENTS
- ${is3D ? "Use Three.js and react-three/fiber for 3D rendering" : "Use Canvas 2D API only"}  
- All visuals should be simple shapes (rectangles, circles, triangles) unless 3D.  
- Implement physics-like motion manually (gravity, velocity, collisions).  
- Input handling: keyboard + tap/click support.  
- Include on-screen instructions for the player.  
- Support multiple game genres: Flappy-style, car games, endless runners, puzzle games, shooter, sandbox (Minecraft-style), etc.  
- Scoring system must work correctly.  
- Reset mechanics and Game Over screen must work.  
- Responsive design: adapts to window resize.  
- Use requestAnimationFrame for the game loop.  
- Include **all necessary imports**: React, Canvas API, or Three.js depending on game type.  

# 📋 GAME CONTEXT
- Base the game on this description: "${gamePrompt}"  
- Use the following game template as a starting point (dynamic for game type):
${baseTemplate || "If no template exists, generate code from scratch, fully functional"}

- Include full implementation for any unspecified details:
  - Canvas or 3D Scene: full viewport
  - Player: appropriate shape (square, circle, car, character)
  - Obstacles: visible and dynamic
  - Collectibles: visible and dynamic
  - Ground / environment: colored shapes
  - Gravity, velocity, collision detection
  - Input: space bar / tap / click
  - Overlay: reset, score, and instruction screens

# ⚡ DELIVERABLE
- **One file**: GameComponent.tsx  
- Fully working, ready to run in a React project  
- No markdown, no code fences, no explanations  
- Code must be production-ready, clean, and fully reusable across game types.`
          }
        ];

        const chatCompletion = await this.providers.groq.chat.completions.create({
          messages,
          model: "openai/gpt-oss-120b",
          temperature: 0.1,
          max_tokens: 40000,
          top_p: 1,
          stream: false,
        });

        const response = chatCompletion.choices[0]?.message?.content || "";
        console.log(chalk.green(`✅ GameComponent generated: ${response.length} characters`));
        return response;
      },
      {
        gamePrompt,
        typeOfGame,
        chatId,
        difficulty,
      },
      {
        step: "initial-code",
        provider: "llama-3.370b-versatile",
        engine: "CANVAS_2D_OR_3D",
      },
    );
  }


  async get_typeOfGame(gamePrompt) {
    try {
      if (!gamePrompt || typeof gamePrompt !== "string") {
        throw new Error("Invalid game prompt. Please provide a valid string.");
      }

      // Initialize classifier
      const classifierInstance = this.initializeClassifier();
      if (!classifierInstance) throw new Error("Classifier is not initialized properly.");

      // Get top prediction synchronously
      const selectedGameType = classifierInstance.classify(gamePrompt);

      // Get all classifications to compute confidence
      const classifications = classifierInstance.getClassifications(gamePrompt);

      // Compute confidence for selected game type
      const confidence = classifications.find(c => c.label === selectedGameType)?.value * 100 || 0;

      // Get the template string directly
      const suggestedTemplate =
        this.gamePresets[selectedGameType]?.template ||
        this.gamePresets.empty.template;

      // console.log("Selected game type:", selectedGameType);
      // console.log("Confidence:", confidence);
      // console.log("Suggested template:", suggestedTemplate);

      return {
        gameType: this.gamePresets[selectedGameType]?.name || "Unknown",
        suggestedTemplate,
        confidence: Number(confidence.toFixed(2)),
      };
    } catch (error) {
      console.error("Error determining game type:", error.message);
      return {
        gameType: "Unknown",
        suggestedTemplate: null,
        confidence: 0,
        error: error.message,
      };
    }
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
}

export default TracedLLMProvider
