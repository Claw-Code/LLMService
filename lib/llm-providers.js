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

// LLM Provider class with new flow: Groq → Mistral → LLaMA → Anthropic
export class TracedLLMProvider {
  constructor() {
    this.providers = {
      groq: groq,
      anthropic: anthropic,
      openrouter: openRouter,
    }
  }

  // Step 1: Groq provides detailed explanation and file structure
  async getGameExplanation(gamePrompt, chatId) {
    return await traceFunction(
      "Groq-Game-Explanation",
      async () => {
        console.log(chalk.green(`🎮 Getting game explanation from Groq for: ${gamePrompt}`))

        const messages = [
          {
            role: "system",
            content: `You are a senior web game developer and architect. When given a game request, provide a detailed explanation of how to build it as a modern web game.

REQUIREMENTS:
- Focus on HTML5 Canvas games with JavaScript classes
- Use modular architecture with separate files: GameManager, AudioManager, main.js, index.html
- Provide complete technical breakdown
- Explain game mechanics and implementation approach
- Consider responsive design for mobile and desktop
- Suggest specific file structure and class organization

REQUIRED FILE STRUCTURE:
1. **index.html** - Complete HTML with embedded CSS and basic structure
2. **gameManager.js** - Main game logic class with constructor, game loop, rendering
3. **audioManager.js** - Audio management class for sound effects
4. **main.js** - Game initialization and setup

FORMAT YOUR RESPONSE AS:
1. **Game Overview**: Brief description and core mechanics
2. **Technical Architecture**: Class structure and file organization
3. **File Structure**: Detailed breakdown of each file's purpose
4. **Game Mechanics**: Core gameplay systems to implement
5. **Implementation Strategy**: Step-by-step development approach
6. **Canvas Rendering**: Drawing and animation techniques
7. **Responsive Design**: Mobile and desktop considerations

Be detailed and comprehensive in your technical explanation.`,
          },
          {
            role: "user",
            content: `Explain how to build a ${gamePrompt} as a modern HTML5 Canvas web game. Provide detailed technical approach with GameManager, AudioManager, and modular file structure.`,
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
        console.log(chalk.green(`✅ Groq explanation: ${response} characters`))
        return response
      },
      {
        gamePrompt: gamePrompt,
        chatId: chatId,
      },
      { step: "game-explanation", provider: "groq" },
    )
  }

  // Step 2: Mistral processes the explanation and creates implementation plan
  async processMistralPlan(groqExplanation, gamePrompt, chatId) {
    return await traceFunction(
      "Mistral-Implementation-Plan",
      async () => {
        console.log(chalk.green(`🧠 Processing with Mistral 7B...`))

        const messages = [
          {
            role: "system",
            content: `You are a web development implementation specialist. Take the game explanation and create a concrete implementation plan with specific code structure.

YOUR TASK:
- Analyze the provided game explanation
- Create detailed class structure for GameManager and AudioManager
- Plan the HTML5 Canvas rendering pipeline
- Define specific methods and properties for each class
- Plan the game loop, input handling, and state management
- Create responsive design implementation strategy
- Define audio system architecture

FOCUS ON:
- Modular JavaScript class architecture
- HTML5 Canvas 2D rendering techniques
- Game loop optimization and timing
- Input handling (keyboard, touch, mouse)
- Audio management with Web Audio API
- Responsive design for all screen sizes
- Performance optimization strategies

Provide a structured implementation plan with specific class methods, properties, and technical details.`,
          },
          {
            role: "user",
            content: `Based on this game explanation for ${gamePrompt}:

${groqExplanation}

Create a detailed implementation plan with specific class structure, methods, and technical implementation details for a modular HTML5 Canvas web game.`,
          },
        ]

        const response = await this.providers.openrouter.createChatCompletion(
          "deepseek/deepseek-r1-0528:free",
          messages,
          {
            temperature: 0.4,
            max_tokens: 3000,
          },
        )

        console.log(chalk.green(`✅ Mistral plan: ${response} characters`))
        
        return response

      },
      {
        gamePrompt: gamePrompt,
        groqExplanation: groqExplanation.slice(0, 300) + "...",
        chatId: chatId,
      },
      { step: "implementation-plan", provider: "mistral" },
    )
  }

  // Step 3: LLaMA Versatile checks file structure and provides feedback
  async validateWithLLaMA(mistralPlan, gamePrompt, chatId) {
    return await traceFunction(
      "LLaMA-Structure-Validation",
      async () => {
        console.log(chalk.green(`🔍 Validating structure with LLaMA Versatile...`))

        const messages = [
          {
            role: "system",
            content: `You are a senior code reviewer and architecture validator specializing in HTML5 Canvas games. Review implementation plans and provide detailed feedback.

VALIDATION CRITERIA:
- Class architecture and separation of concerns
- HTML5 Canvas rendering optimization
- Game loop performance and timing
- Input handling architecture
- Audio system design
- Responsive design implementation
- Code organization and modularity
- Performance considerations

PROVIDE FEEDBACK ON:
1. **Class Structure**: Are GameManager and AudioManager well-designed?
2. **Canvas Rendering**: Is the drawing pipeline efficient?
3. **Game Loop**: Is the update/render cycle optimized?
4. **Input Handling**: Are controls responsive and well-organized?
5. **Audio Architecture**: Is sound management properly structured?
6. **File Organization**: Is the modular structure appropriate?
7. **Performance**: Any potential bottlenecks or optimizations?
8. **Recommendations**: Specific improvements and best practices

Be constructive and specific in your technical feedback.`,
          },
          {
            role: "user",
            content: `Review this implementation plan for ${gamePrompt} HTML5 Canvas game and provide detailed technical feedback:

${mistralPlan}

Focus on class architecture validation, Canvas rendering optimization, and provide specific recommendations for improvement.`,
          },
        ]

        const response = await this.providers.openrouter.createChatCompletion(
          "meta-llama/llama-3.1-70b-instruct",
          messages,
          {
            temperature: 0.2,
            max_tokens: 3000,
          },
        )

        console.log(chalk.green(`✅ LLaMA validation: ${response}`))
        return response
      },
      {
        gamePrompt: gamePrompt,
        mistralPlan: mistralPlan.slice(0, 300) + "...",
        chatId: chatId,
      },
      { step: "structure-validation", provider: "llama" },
    )
  }

  // Step 4: Anthropic generates final web game code with specific file structure
  async generateWebGameCode(llamaFeedback, mistralPlan, gamePrompt, chatId) {
    return await traceFunction(
      "Anthropic-Web-Game-Generation",
      async () => {
        console.log(chalk.green(`🚀 Generating final web game code with Anthropic...`))

        const prompt = `You are a senior HTML5 Canvas game developer. Create a complete, production-ready web game with comprehensive modular file structure including asset classes.

GAME REQUEST: ${gamePrompt}

IMPLEMENTATION FEEDBACK:
${llamaFeedback}

REQUIRED COMPREHENSIVE FILE STRUCTURE:
1. **index.html** - Complete HTML file with embedded CSS and game structure
2. **gameManager.js** - Main game logic class (core game loop, state management)
3. **audioManager.js** - Audio management class (Web Audio API sounds)
4. **main.js** - Game initialization and setup
5. **uiManager.js** - UI management class (score, menus, game over screen)
6. **inputManager.js** - Input handling class (keyboard, mouse, touch)
7. **renderer.js** - Rendering utilities and visual effects
8. **gameObjects.js** - Game entity classes (Player, Enemy, Collectible, etc.)
9. **utils.js** - Utility functions and helpers
10. **config.js** - Game configuration and settings

TECHNICAL REQUIREMENTS:
- HTML5 Canvas 2D rendering with modular architecture
- Each file should be a focused, single-responsibility module
- Professional class-based JavaScript (ES6+)
- Responsive design (mobile + desktop)
- Touch controls + keyboard controls
- Web Audio API for sounds
- 60fps game loop with optimized rendering
- Complete game functionality with all features

MODULAR ARCHITECTURE REQUIREMENTS:
- GameManager: Core game loop, state management, coordination
- UIManager: Score display, menus, game over screens, HUD
- InputManager: Centralized input handling for all control types
- AudioManager: Sound effects, music, audio context management
- Renderer: Canvas drawing utilities, effects, animations
- GameObjects: Entity classes for all game elements
- Utils: Helper functions, math utilities, common operations
- Config: Game settings, constants, configuration values

CODE STRUCTURE REQUIREMENTS:
- Each class should have clear constructor, methods, and properties
- Professional commenting and documentation
- Error handling and validation
- Performance optimization
- Clean separation of concerns
- Modular imports/exports where applicable

OUTPUT FORMAT:
Generate each file with clear separators like:
// === filename.js ===
[file content]

Generate ONLY the code files with separators, no explanations. Make it a complete, professional web game with comprehensive modular architecture.`

        const response = await this.providers.anthropic.messages.create({
          model: "claude-3-haiku-20240307",
          max_tokens: 4000,
          temperature: 0.1,
          messages: [{ role: "user", content: prompt }],
        })

        const finalCode = response.content[0]?.text || ""
        console.log(chalk.green(`✅ Anthropic web game code: ${finalCode.length} characters`))
        return finalCode
      },
      {
        gamePrompt: gamePrompt,
        llamaFeedback: llamaFeedback.slice(0, 200) + "...",
        chatId: chatId,
      },
      { step: "web-game-generation", provider: "anthropic" },
    )
  }

  // Complete chain: Groq → Mistral → LLaMA → Anthropic
  async generateWebGame(gamePrompt, chatId) {
    return await traceFunction(
      "Complete-Web-Game-Chain",
      async () => {
        console.log(chalk.blue(`🔗 Starting complete web game generation chain for: ${gamePrompt}`))

        // Step 1: Groq explains the game and provides file structure
        console.log(chalk.cyan("Step 1: Getting game explanation from Groq..."))
        const groqExplanation = await this.getGameExplanation(gamePrompt, chatId)

        // Step 2: Mistral processes and creates implementation plan
        console.log(chalk.cyan("Step 2: Processing with Mistral..."))
        const mistralPlan = await this.processMistralPlan(groqExplanation, gamePrompt, chatId)

        // Step 3: LLaMA validates file structure and provides feedback
        console.log(chalk.cyan("Step 3: Validating with LLaMA..."))
        const llamaFeedback = await this.validateWithLLaMA(mistralPlan, gamePrompt, chatId)

        // Step 4: Anthropic generates final web game code
        console.log(chalk.cyan("Step 4: Generating final web game code with Anthropic..."))
        const webGameCode = await this.generateWebGameCode(llamaFeedback, mistralPlan, gamePrompt, chatId)

        console.log(chalk.blue(`✅ Complete web game chain completed for: ${gamePrompt}`))

        return {
          groqExplanation,
          mistralPlan,
          llamaFeedback,
          webGameCode,
          finalCode: webGameCode,
        }
      },
      {
        gamePrompt: gamePrompt,
        chatId: chatId,
      },
      { operation: "complete-web-game-chain" },
    )
  }
}

export default TracedLLMProvider
