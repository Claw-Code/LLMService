import Groq from "groq-sdk"
import Anthropic from "@anthropic-ai/sdk"
import { OpenRouterClient, traceFunction } from "./langsmith-tracer.js"
import { OllamaProvider } from "./ollama-provider.js"
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
const ollama = new OllamaProvider()

// Determine which provider to use based on environment variable
const USE_OLLAMA = process.env.USE_OLLAMA === "true"
const CODING_PROVIDER = USE_OLLAMA ? "ollama" : "openrouter"

// Model configuration from environment variables
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "qwen/qwen3-14b:free"
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "deepseek-coder:6.7b"

// Enhanced LLM Provider class with new order: Groq → Qwen3 Coder → Anthropic (Checker) → Qwen3 (Final Fix)
export class TracedLLMProvider {
  constructor() {
    this.providers = {
      groq: groq,
      anthropic: anthropic,
      openrouter: openRouter,
      ollama: ollama,
    }
    
    // Log which provider is being used
    console.log(chalk.cyan(`🔧 Using coding provider: ${CODING_PROVIDER.toUpperCase()}`))
    if (USE_OLLAMA) {
      console.log(chalk.blue(`🤖 Ollama model: ${OLLAMA_MODEL}`))
    } else {
      console.log(chalk.blue(`🌐 OpenRouter model: ${OPENROUTER_MODEL}`))
    }
  }

  // Step 1: Groq provides detailed explanation and file structure
  async getGameExplanation(gamePrompt, chatId) {
    return await traceFunction(
      "Groq-Game-Explanation",
      async () => {
        console.log(chalk.green(`Getting game explanation from Groq for: ${gamePrompt}`))

        const messages = [
          {
            role: "system",
            content: `You are a senior web game developer and architect. When given a game request, provide a detailed explanation of how to build it as a modern web game.

REQUIREMENTS:
- Focus on HTML5 Canvas games with JavaScript classes
- Use modular architecture with separate files
- Provide complete technical breakdown
- Explain game mechanics and implementation approach
- Consider responsive design for mobile and desktop
- Suggest specific file structure and class organization

REQUIRED FILE STRUCTURE (MUST MENTION ALL 10 FILES):
1. **index.html** - Complete HTML with embedded CSS and basic structure
2. **gameManager.js** - Main game logic class with constructor, game loop, rendering
3. **audioManager.js** - Audio management class for sound effects
4. **uiManager.js** - UI management for score, menus, game over screen
5. **inputManager.js** - Input handling for keyboard, mouse, touch
6. **renderer.js** - Canvas drawing utilities and visual effects
7. **gameObjects.js** - Game entity classes (Player, Enemy, Collectible, etc.)
8. **utils.js** - Utility functions and helpers
9. **config.js** - Game configuration and settings
10. **main.js** - Game initialization and setup

FORMAT YOUR RESPONSE AS:
1. **Game Overview**: Brief description and core mechanics
2. **Technical Architecture**: Class structure and file organization
3. **Required Files**: Detailed breakdown of each file's purpose and key methods
4. **Game Mechanics**: Core gameplay systems to implement
5. **Implementation Strategy**: Step-by-step development approach
6. **Canvas Rendering**: Drawing and animation techniques
7. **Responsive Design**: Mobile and desktop considerations

Be detailed and comprehensive. MENTION ALL 10 REQUIRED FILES with their specific purposes.`,
          },
          {
            role: "user",
            content: `Explain how to build a ${gamePrompt} as a modern HTML5 Canvas web game. Provide detailed technical approach with all 10 required files and their specific roles in the game architecture.`,
          },
        ]

        const chatCompletion = await this.providers.groq.chat.completions.create({
          messages: messages,
          model: "llama-3.3-70b-versatile",
          temperature: 0.4, // Slightly higher for creative explanation
          max_tokens: 3000,
          top_p: 1,
          stream: false,
        })

        const response = chatCompletion.choices[0]?.message?.content || ""
        console.log(chalk.green(`Groq explanation: ${response.length} characters`))
        return response
      },
      {
        gamePrompt: gamePrompt,
        chatId: chatId,
      },
      { step: "game-explanation", provider: "groq" },
    )
  }

  // Step 2: Qwen3 Coder generates clean, production-ready code
  async generateCleanCodeWithQwen(groqExplanation, gamePrompt, chatId) {
    return await traceFunction(
      "Qwen3-Clean-Code-Generation",
      async () => {
        console.log(chalk.green(`Generating clean, production-ready code with Qwen3...`))

        const messages = [
          {
            role: "system",
            content: `You are an expert HTML5 Canvas game developer. Generate CLEAN, PRODUCTION-READY code for all 10 required files.

CRITICAL REQUIREMENTS:
- Generate ONLY clean JavaScript and HTML code
- NO markdown code blocks, NO backticks, NO comments about generation
- NO "Generated by" comments or metadata
- Each file should be pure, clean code ready to run
- Use modern JavaScript ES6+ with proper class structure
- Implement HTML5 Canvas rendering with 60fps performance
- Include responsive design and mobile touch controls

REQUIRED FILES TO GENERATE (ALL 10):
1. index.html - Complete HTML with embedded CSS
2. gameManager.js - Main game class with game loop
3. audioManager.js - Web Audio API implementation
4. uiManager.js - UI management system
5. inputManager.js - Input handling (keyboard, mouse, touch)
6. renderer.js - Canvas drawing utilities
7. gameObjects.js - Game entity classes
8. utils.js - Utility functions
9. config.js - Game configuration
10. main.js - Game initialization

OUTPUT FORMAT - USE EXACT SEPARATORS (NO BACKTICKS):
// === index.html ===
[clean HTML code without any comments]

// === gameManager.js ===
[clean JavaScript class without generation comments]

// === audioManager.js ===
[clean JavaScript class without generation comments]

// === uiManager.js ===
[clean JavaScript class without generation comments]

// === inputManager.js ===
[clean JavaScript class without generation comments]

// === renderer.js ===
[clean JavaScript class without generation comments]

// === gameObjects.js ===
[clean JavaScript classes without generation comments]

// === utils.js ===
[clean utility functions without generation comments]

// === config.js ===
[clean configuration object without generation comments]

// === main.js ===
[clean initialization code without generation comments]

ABSOLUTELY NO:
- Markdown code blocks (\`\`\`javascript)
- Generation comments
- Metadata comments
- Backticks or quotes around code
- "Generated by" text

GENERATE ONLY CLEAN, EXECUTABLE CODE.`,
          },
          {
            role: "user",
            content: `Generate clean, production-ready code for a ${gamePrompt} HTML5 Canvas game based on this explanation:

${groqExplanation}

Generate ALL 10 required files with clean, executable code:
1. index.html - Complete HTML structure
2. gameManager.js - Main game logic
3. audioManager.js - Audio management
4. uiManager.js - UI management
5. inputManager.js - Input handling
6. renderer.js - Canvas rendering
7. gameObjects.js - Game entities
8. utils.js - Utilities
9. config.js - Configuration
10. main.js - Initialization

Make the code clean, professional, and immediately executable. NO generation comments or metadata.`,
          },
        ]

        // Use Ollama or OpenRouter based on environment variable
        let response
        if (USE_OLLAMA) {
          response = await this.providers.ollama.createChatCompletion(messages, {
            temperature: 0.2, // Very low for clean, consistent code
            max_tokens: 8000,
          })
        } else {
          response = await this.providers.openrouter.createChatCompletion(OPENROUTER_MODEL, messages, {
            temperature: 0.2, // Very low for clean, consistent code
            max_tokens: 8000,
          })
        }

        console.log(chalk.green(`Qwen3 clean code: ${response.length} characters`))
        return response
      },
      {
        gamePrompt: gamePrompt,
        groqExplanation: groqExplanation.slice(0, 300) + "...",
        chatId: chatId,
      },
      { step: "clean-code-generation", provider: "qwen3-coder" },
    )
  }

  // Step 3: Anthropic validates and provides detailed feedback (shorter response)
  async validateWithAnthropic(qwenInitialCode, gamePrompt, chatId) {
    return await traceFunction(
      "Anthropic-Code-Validation",
      async () => {
        console.log(chalk.green(`Validating code with Anthropic...`))

        const prompt = `You are a senior code reviewer specializing in HTML5 Canvas games. Review the generated code and provide detailed validation feedback.

GAME: ${gamePrompt}

GENERATED CODE TO REVIEW:
${qwenInitialCode}

VALIDATION CHECKLIST:
1. **File Completeness**: Are all 10 required files present?
   - index.html, gameManager.js, audioManager.js, uiManager.js, inputManager.js
   - renderer.js, gameObjects.js, utils.js, config.js, main.js

2. **Code Quality**: Check for syntax errors, missing methods, incomplete implementations

3. **Game Functionality**: Validate game loop, input handling, rendering, audio

4. **Mobile Compatibility**: Check responsive design and touch controls

5. **Integration**: Verify files work together properly

PROVIDE CONCISE FEEDBACK IN THIS FORMAT:

## VALIDATION RESULTS

### ✅ COMPLETE FILES:
[List files that are properly implemented]

### ❌ MISSING/INCOMPLETE FILES:
[List missing or incomplete files]

### 🔧 CRITICAL ISSUES:
[List major problems that need fixing]

### 📋 REQUIRED FIXES:
[Specific instructions for what needs to be corrected]

### 🎯 PRIORITY IMPROVEMENTS:
[Most important changes needed]

Keep feedback concise but comprehensive. Focus on critical issues that prevent the game from working.`

        const response = await this.providers.anthropic.messages.create({
          model: "claude-3-haiku-20240307",
          max_tokens: 2000, // Shorter response to avoid cutoff
          temperature: 0.2, // Low temperature for precise validation
          messages: [{ role: "user", content: prompt }],
        })

        const feedback = response.content[0]?.text || ""
        console.log(chalk.green(`Anthropic validation: ${feedback.length} characters`))
        return feedback
      },
      {
        gamePrompt: gamePrompt,
        qwenInitialCode: qwenInitialCode.slice(0, 500) + "...",
        chatId: chatId,
      },
      { step: "code-validation", provider: "anthropic" },
    )
  }

  // Step 4: Qwen3 generates final fixed code based on validation feedback
  async generateFinalCodeWithQwen(anthropicFeedback, qwenInitialCode, gamePrompt, chatId) {
    return await traceFunction(
      "Qwen3-Final-Code-Generation",
      async () => {
        console.log(chalk.green(`Generating final fixed code with Qwen3...`))

        const messages = [
          {
            role: "system",
            content: `You are an expert HTML5 Canvas game developer. Fix and improve the generated code based on the validation feedback provided.

YOUR TASK:
- Review the validation feedback carefully
- Fix all identified issues and problems
- Generate complete, working code for ALL 10 files
- Ensure the game is fully functional and ready to play
- Address all missing files, methods, and functionality
- Implement proper error handling and validation

REQUIREMENTS:
- Generate ALL 10 files with complete implementations
- Fix all syntax errors and missing methods
- Ensure proper file integration and dependencies
- Add any missing functionality identified in feedback
- Optimize for 60fps performance
- Include mobile touch controls and responsive design
- Implement complete Web Audio API integration

OUTPUT FORMAT - USE EXACT SEPARATORS:
// === index.html ===
[complete, fixed HTML file]

// === gameManager.js ===
[complete, fixed GameManager class]

// === audioManager.js ===
[complete, fixed AudioManager class]

// === uiManager.js ===
[complete, fixed UIManager class]

// === inputManager.js ===
[complete, fixed InputManager class]

// === renderer.js ===
[complete, fixed Renderer class]

// === gameObjects.js ===
[complete, fixed game entity classes]

// === utils.js ===
[complete, fixed utility functions]

// === config.js ===
[complete, fixed game configuration]

// === main.js ===
[complete, fixed game initialization]

CRITICAL: Address ALL issues mentioned in the validation feedback. Generate complete, working files that integrate properly and create a fully functional game.`,
          },
          {
            role: "user",
            content: `Fix and improve the code for ${gamePrompt} based on this validation feedback:

VALIDATION FEEDBACK:
${anthropicFeedback}

ORIGINAL CODE TO FIX:
${qwenInitialCode}

Generate the complete, fixed code for ALL 10 files:
1. index.html - Fix HTML structure and CSS issues
2. gameManager.js - Fix game loop and logic issues
3. audioManager.js - Fix Web Audio API implementation
4. uiManager.js - Fix UI management issues
5. inputManager.js - Fix input handling problems
6. renderer.js - Fix canvas drawing issues
7. gameObjects.js - Fix game entity problems
8. utils.js - Fix utility function issues
9. config.js - Fix configuration problems
10. main.js - Fix initialization issues

Address ALL problems identified in the validation feedback. Make sure the final game is complete and fully functional.`,
          },
        ]

        // Use Ollama or OpenRouter based on environment variable
        let response
        if (USE_OLLAMA) {
          response = await this.providers.ollama.createChatCompletion(messages, {
            temperature: 0.0, // Very low temperature for precise fixes
            max_tokens: 8000, // High token limit for complete code
          })
        } else {
          response = await this.providers.openrouter.createChatCompletion(OPENROUTER_MODEL, messages, {
            temperature: 0.0, // Very low temperature for precise fixes
            max_tokens: 8000, // High token limit for complete code
          })
        }

        console.log(chalk.green(`Qwen3 final code: ${response.length} characters`))
        return response
      },
      {
        gamePrompt: gamePrompt,
        anthropicFeedback: anthropicFeedback.slice(0, 300) + "...",
        qwenInitialCode: qwenInitialCode.slice(0, 300) + "...",
        chatId: chatId,
      },
      { step: "final-code-generation", provider: "qwen3-coder" },
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
