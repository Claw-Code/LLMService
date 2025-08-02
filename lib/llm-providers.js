import Groq from "groq-sdk";
import Anthropic from "@anthropic-ai/sdk";
import { OpenRouterClient, traceFunction } from "./langsmith-tracer.js";
import chalk from "chalk";
import dotenv from "dotenv";
import fs from "fs-extra";
import path from "path";

dotenv.config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const openRouter = new OpenRouterClient();

export class TracedLLMProvider {
  constructor() {
    this.providers = {
      groq,
      anthropic,
      openrouter: openRouter,
    };

    if (!process.env.OPENROUTER_API_KEY) {
      throw new Error(chalk.red("OPENROUTER_API_KEY is required"));
    }
    if (!process.env.GROQ_API_KEY) {
      throw new Error(chalk.red("GROQ_API_KEY is required"));
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error(chalk.red("ANTHROPIC_API_KEY is required"));
    }
  }

  async getGameExplanation(gamePrompt, chatId) {
    return await traceFunction(
      "Groq-Game-Explanation",
      async () => {
        console.log(chalk.green(`Getting Unity WebGL game explanation for: ${gamePrompt}`));
        const messages = [
          {
            role: "system",
            content: `You are a senior Unity game developer specializing in WebGL builds. Provide a detailed explanation of how to build a ${gamePrompt} as a Unity WebGL game, deployable as a web game with HTML/CSS integration, supporting 2D games like Snake.

REQUIREMENTS:
- Use Unity 2022 LTS for WebGL export
- Use C# scripts with modular architecture
- Support 2D (Sprite Renderer, Tilemap) games
- Include index.html with embedded CSS for fullscreen mobile rendering and Unity loading screen
- Optimize for 60fps
- Ensure cross-platform support (PC, mobile, console inputs via WebGL)
- Suggest folder/file structure, including prefabs and scenes
- For Snake, include Animator-driven animations (slithering, turning, eating for snake; pulsing for food)

REQUIRED FILES (10):
1. index.html - HTML with CSS for fullscreen and loading screen
2. Scenes/GameScene.unity - Main scene with snake, food, and Tilemap
3. Scripts/GameManager.cs - Game logic (states, scoring, win/lose)
4. Scripts/PlayerController.cs - Snake movement, input, and animations
5. Scripts/EnemyController.cs - Food spawning and pulsing animation
6. Scripts/UIManager.cs - UI (HUD, menus, game over)
7. Scripts/AudioManager.cs - Audio for music and effects
8. Scripts/GameConfig.cs - Game settings
9. Scripts/Utility.cs - Helper functions
10. Scripts/CameraController.cs - 2D follow camera

FORMAT RESPONSE:
1. Game Overview
2. Technical Architecture
3. Required Files
4. Game Mechanics
5. WebGL Integration
6. Rendering and Physics
7. Cross-Platform Support
8. Optimization
9. Animations`,
          },
          {
            role: "user",
            content: `Explain how to build a ${gamePrompt} as a Unity WebGL game with all 10 required files, including Animator-driven animations.`,
          },
        ];

        try {
          const chatCompletion = await this.providers.groq.chat.completions.create({
            messages,
            model: "llama-3.3-70b-versatile",
            temperature: 0.4,
            max_tokens: 4000,
            top_p: 1,
            stream: false,
          });
          const response = chatCompletion.choices[0]?.message?.content || "";
          console.log(chalk.green(`Groq explanation: ${response.length} characters`));
          return response;
        } catch (error) {
          console.error(chalk.red(`Groq API error for chat ${chatId}: ${error.message}`));
          throw new Error(`Failed to get game explanation: ${error.message}`);
        }
      },
      { gamePrompt, chatId },
      { step: "game-explanation", provider: "groq" },
    );
  }

  async generateCleanCodeWithGrok3(groqExplanation, gamePrompt, chatId) {
    return await traceFunction(
      "Grok3-Clean-Code-Generation",
      async () => {
        console.log(chalk.green(`Generating clean Unity WebGL code for ${gamePrompt}...`));
        const gameType = this.detectGameType(gamePrompt);
        const templates = JSON.parse(await fs.readFile(path.join("templates", "templates.json"), "utf-8"))[gameType] || {};
        const dynamicFiles = [
          "Scripts/GameManager.cs",
          "Scripts/PlayerController.cs",
          "Scripts/EnemyController.cs",
        ];
        const cachedFiles = {
          "index.html": templates["index.html"]?.replace("{{gameName}}", gamePrompt) || "",
          "Scenes/GameScene.unity": templates["Scenes/GameScene.unity"] || "",
          "Scripts/UIManager.cs": templates["Scripts/UIManager.cs"] || "",
          "Scripts/AudioManager.cs": templates["Scripts/AudioManager.cs"] || "",
          "Scripts/GameConfig.cs": templates["Scripts/GameConfig.cs"] || "",
          "Scripts/Utility.cs": templates["Scripts/Utility.cs"] || "",
          "Scripts/CameraController.cs": templates["Scripts/CameraController.cs"] || "",
        };

        const dynamicResults = [];
        for (const file of dynamicFiles) {
          const result = await this.generateSingleFileWithRetry(file, groqExplanation, gamePrompt, chatId);
          dynamicResults.push(result);
        }

        const response = [
          ...Object.entries(cachedFiles).filter(([_, content]) => content),
          ...dynamicResults,
        ].map(([file, content]) => `// === ${file} ===\n${content}`).join("\n");

        console.log(chalk.green(`Grok3 clean code: ${response.length} characters`));
        return response;
      },
      { gamePrompt, groqExplanation: groqExplanation.slice(0, 300) + "...", chatId },
      { step: "clean-code-generation", provider: "openrouter" },
    );
  }

  async generateSingleFileWithRetry(file, groqExplanation, gamePrompt, chatId, retries = 3, delay = 1000) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await this.generateSingleFile(file, groqExplanation, gamePrompt, chatId);
      } catch (error) {
        console.log(chalk.yellow(`Retrying ${file} (attempt ${attempt + 1}/${retries}) after error: ${error.message}`));
        if (attempt === retries) {
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, attempt)));
      }
    }
  }

  async generateSingleFile(file, groqExplanation, gamePrompt, chatId) {
    return await traceFunction(
      "Grok3-Single-File-Generation",
      async () => {
        console.log(chalk.green(`Generating ${file} for ${gamePrompt}...`));
        const isPlayer = file === "Scripts/PlayerController.cs";
        const isEnemy = file === "Scripts/EnemyController.cs";
        const systemPrompt = isPlayer
          ? `You are an expert Unity developer for WebGL. Generate CLEAN, PRODUCTION-READY C# code for a single file (${file}) for a ${gamePrompt} Unity WebGL game.

CRITICAL REQUIREMENTS:
- Generate clean C# code (no comments, no markdown, no backticks)
- Output pure, executable code for Unity 2022 LTS WebGL build
- Optimize for 60fps (minimal draw calls, efficient logic)
- Support 2D (Sprite Renderer, Tilemap) based on game type
- Handle cross-platform inputs using Unity's Input System (PC, mobile, console via WebGL)
- Ensure compatibility with other project files (GameManager.cs, EnemyController.cs, GameConfig.cs)
- For Snake game, use grid-based movement (Vector2Int for discrete steps) and Animator with parameters: 'Direction' (int: 0=up, 1=right, 2=down, 3=left), 'IsEating' (bool) for slithering, turning, eating animations

OUTPUT FORMAT:
// === ${file} ===
[complete C# code]`
          : isEnemy
          ? `You are an expert Unity developer for WebGL. Generate CLEAN, PRODUCTION-READY C# code for a single file (${file}) for a ${gamePrompt} Unity WebGL game.

CRITICAL REQUIREMENTS:
- Generate clean C# code (no comments, no markdown, no backticks)
- Output pure, executable code for Unity 2022 LTS WebGL build
- Optimize for 60fps (minimal draw calls, efficient logic)
- Support 2D (Sprite Renderer, Tilemap) based on game type
- Ensure compatibility with other project files (GameManager.cs, PlayerController.cs, GameConfig.cs)
- For Snake game, implement food pellet spawning on valid Tilemap grid positions (via GameManager.IsPositionValid) with a pulsing animation using Animator parameter 'Pulsing' (bool)

OUTPUT FORMAT:
// === ${file} ===
[complete C# code]`
          : `You are an expert Unity developer for WebGL. Generate CLEAN, PRODUCTION-READY C# code for a single file (${file}) for a ${gamePrompt} Unity WebGL game.

CRITICAL REQUIREMENTS:
- Generate clean C# code (no comments, no markdown, no backticks)
- Output pure, executable code for Unity 2022 LTS WebGL build
- Optimize for 60fps (minimal draw calls, efficient logic)
- Support 2D (Sprite Renderer, Tilemap) based on game type
- Handle cross-platform inputs using Unity's Input System (PC, mobile, console via WebGL)
- Ensure compatibility with other project files

OUTPUT FORMAT:
// === ${file} ===
[complete C# code]`;

        const messages = [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Generate only ${file} for a ${gamePrompt} Unity WebGL game based on:\n${groqExplanation}\nEnsure 60fps optimization, cross-platform support, and Animator-driven animations where applicable.`,
          },
        ];

        try {
          const response = await this.providers.openrouter.createChatCompletion("meta-llama/llama-3.3-70b-instruct", messages, {
            temperature: 0.2,
            max_tokens: 1000,
          });

          let content = response.choices[0]?.message?.content || "";
          console.log(chalk.cyan(`OpenRouter response for ${file}: ${content.slice(0, 200)}...`));
          if (content.startsWith(`// === ${file} ===\n`)) {
            content = content.replace(`// === ${file} ===\n`, "").trim();
          }
          content = this.cleanupGeneratedCode(content, file);
          console.log(chalk.green(`Generated ${file}: ${content.length} characters`));
          return [file, content];
        } catch (error) {
          console.error(chalk.red(`OpenRouter API error for ${file} in chat ${chatId}: ${error.message}`));
          throw new Error(`Failed to generate ${file}: OpenRouter API error: ${error.message}`);
        }
      },
      { gamePrompt, file, chatId },
      { step: "single-file-generation", provider: "openrouter" },
    );
  }

  async validateWithAnthropic(grok3InitialCode, gamePrompt, chatId) {
    return await traceFunction(
      "Anthropic-Code-Validation",
      async () => {
        console.log(chalk.green(`Validating Unity WebGL code with Anthropic...`));
        const prompt = `You are a senior Unity WebGL code reviewer. Review the generated Unity WebGL code for a ${gamePrompt} game.

GENERATED CODE:
${grok3InitialCode}

VALIDATION CHECKLIST:
1. File Completeness: Are all 10 required files present?
2. Code Quality: Check for syntax errors, missing methods, incomplete implementations
3. Unity WebGL Compatibility: Verify Unity APIs and WebGL settings
4. Game Functionality: Validate game loop, input handling, physics, rendering, animations
5. Web Integration: Check index.html for fullscreen mobile CSS and loading screen
6. Performance: Ensure 60fps optimization
7. Cross-Platform Support: Verify input compatibility
8. Animations: Verify Animator usage for snake (Direction, IsEating) and food (Pulsing)

PROVIDE FEEDBACK IN FORMAT:
## VALIDATION RESULTS
### ✅ COMPLETE FILES
### ❌ MISSING/INCOMPLETE FILES
### 🔧 CRITICAL ISSUES
### 📋 REQUIRED FIXES
### 🎯 PRIORITY IMPROVEMENTS`;

        try {
          const response = await this.providers.anthropic.messages.create({
            model: "claude-3-haiku-20240307",
            max_tokens: 2000,
            temperature: 0.2,
            messages: [{ role: "user", content: prompt }],
          });

          const feedback = response.content[0]?.text || "";
          console.log(chalk.green(`Anthropic validation: ${feedback.length} characters`));
          return feedback;
        } catch (error) {
          console.error(chalk.red(`Anthropic API error for chat ${chatId}: ${error.message}`));
          throw new Error(`Failed to validate code: ${error.message}`);
        }
      },
      { gamePrompt, grok3InitialCode: grok3InitialCode.slice(0, 500) + "...", chatId },
      { step: "code-validation", provider: "anthropic" },
    );
  }

  async generateFinalCodeWithGrok3(anthropicFeedback, grok3InitialCode, gamePrompt, chatId) {
    return await traceFunction(
      "Grok3-Final-Code-Generation",
      async () => {
        console.log(chalk.green(`Generating final fixed Unity WebGL code for ${gamePrompt}...`));
        const gameType = this.detectGameType(gamePrompt);
        const templates = JSON.parse(await fs.readFile(path.join("templates", "templates.json"), "utf-8"))[gameType] || {};
        const dynamicFiles = [
          "Scripts/GameManager.cs",
          "Scripts/PlayerController.cs",
          "Scripts/EnemyController.cs",
        ];
        const cachedFiles = {
          "index.html": templates["index.html"]?.replace("{{gameName}}", gamePrompt) || "",
          "Scenes/GameScene.unity": templates["Scenes/GameScene.unity"] || "",
          "Scripts/UIManager.cs": templates["Scripts/UIManager.cs"] || "",
          "Scripts/AudioManager.cs": templates["Scripts/AudioManager.cs"] || "",
          "Scripts/GameConfig.cs": templates["Scripts/GameConfig.cs"] || "",
          "Scripts/Utility.cs": templates["Scripts/Utility.cs"] || "",
          "Scripts/CameraController.cs": templates["Scripts/CameraController.cs"] || "",
        };

        const dynamicResults = [];
        for (const file of dynamicFiles) {
          const result = await this.generateSingleFinalFileWithRetry(file, anthropicFeedback, grok3InitialCode, gamePrompt, chatId);
          dynamicResults.push(result);
        }

        const response = [
          ...Object.entries(cachedFiles).filter(([_, content]) => content),
          ...dynamicResults,
        ].map(([file, content]) => `// === ${file} ===\n${content}`).join("\n");

        console.log(chalk.green(`Grok3 final code: ${response.length} characters`));
        return response;
      },
      {
        gamePrompt,
        anthropicFeedback: anthropicFeedback.slice(0, 300) + "...",
        grok3InitialCode: grok3InitialCode.slice(0, 300) + "...",
        chatId,
      },
      { step: "final-code-generation", provider: "openrouter" },
    );
  }

  async generateSingleFinalFileWithRetry(file, anthropicFeedback, grok3InitialCode, gamePrompt, chatId, retries = 3, delay = 1000) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await this.generateSingleFinalFile(file, anthropicFeedback, grok3InitialCode, gamePrompt, chatId);
      } catch (error) {
        console.log(chalk.yellow(`Retrying final ${file} (attempt ${attempt + 1}/${retries}) after error: ${error.message}`));
        if (attempt === retries) {
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, attempt)));
      }
    }
  }

  async generateSingleFinalFile(file, anthropicFeedback, grok3InitialCode, gamePrompt, chatId) {
    return await traceFunction(
      "Grok3-Single-Final-File-Generation",
      async () => {
        console.log(chalk.green(`Generating final ${file} for ${gamePrompt}...`));
        const isPlayer = file === "Scripts/PlayerController.cs";
        const isEnemy = file === "Scripts/EnemyController.cs";
        const systemPrompt = isPlayer
          ? `You are an expert Unity WebGL developer. Fix and improve the generated code for a single file (${file}) based on validation feedback.

YOUR TASK:
- Review feedback and fix all issues
- Generate clean, production-ready C# code (no comments, no markdown, no backticks)
- Ensure functionality in Unity 2022 LTS WebGL build
- Optimize for 60fps (minimal draw calls)
- Support cross-platform inputs using Unity's Input System
- For Snake game, use grid-based movement (Vector2Int) and Animator with 'Direction' (int: 0=up, 1=right, 2=down, 3=left), 'IsEating' (bool)

OUTPUT FORMAT:
// === ${file} ===
[fixed C# code]`
          : isEnemy
          ? `You are an expert Unity WebGL developer. Fix and improve the generated code for a single file (${file}) based on validation feedback.

YOUR TASK:
- Review feedback and fix all issues
- Generate clean, production-ready C# code (no comments, no markdown, no backticks)
- Ensure functionality in Unity 2022 LTS WebGL build
- Optimize for 60fps
- For Snake game, implement food spawning on Tilemap grid (via GameManager.IsPositionValid) with Animator 'Pulsing' (bool)

OUTPUT FORMAT:
// === ${file} ===
[fixed C# code]`
          : `You are an expert Unity WebGL developer. Fix and improve the generated code for a single file (${file}) based on validation feedback.

YOUR TASK:
- Review feedback and fix all issues
- Generate clean, production-ready C# code (no comments, no markdown, no backticks)
- Ensure functionality in Unity 2022 LTS WebGL build
- Optimize for 60fps
- Support cross-platform inputs using Unity's Input System

OUTPUT FORMAT:
// === ${file} ===
[fixed C# code]`;

        const messages = [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Fix ${file} for a ${gamePrompt} Unity WebGL game based on:

VALIDATION FEEDBACK:
${anthropicFeedback}

ORIGINAL CODE:
${grok3InitialCode.split(`// === ${file} ===`)[1]?.split("// === ")[0]?.trim() || ""}

Ensure 60fps, cross-platform support, and Animator-driven animations where applicable.`,
          },
        ];

        try {
          const response = await this.providers.openrouter.createChatCompletion("meta-llama/llama-3.3-70b-instruct", messages, {
            temperature: 0.2,
            max_tokens: 1000,
          });

          let content = response.choices[0]?.message?.content || "";
          console.log(chalk.cyan(`OpenRouter response for final ${file}: ${content.slice(0, 200)}...`));
          if (content.startsWith(`// === ${file} ===\n`)) {
            content = content.replace(`// === ${file} ===\n`, "").trim();
          }
          content = this.cleanupGeneratedCode(content, file);
          console.log(chalk.green(`Generated final ${file}: ${content.length} characters`));
          return [file, content];
        } catch (error) {
          console.error(chalk.red(`OpenRouter API error for final ${file} in chat ${chatId}: ${error.message}`));
          throw new Error(`Failed to generate final ${file}: OpenRouter API error: ${error.message}`);
        }
      },
      { gamePrompt, file, chatId },
      { step: "single-final-file-generation", provider: "openrouter" },
    );
  }

  cleanupGeneratedCode(content, fileName) {
    content = content.replace(/```csharp\s*/g, "");
    content = content.replace(/```html\s*/g, "");
    content = content.replace(/```\s*/g, "");
    content = content.replace(/\/\/ Generated by.*?\n/g, "");
    content = content.replace(/\/\* Generated by.*?\*\//g, "");
    content = content.replace(/<!-- Generated by.*?-->/g, "");
    content = content.replace(/\/\/ Enhanced Chain V2.*?\n/g, "");
    content = content.replace(/\/\/ Chat ID:.*?\n/g, "");
    content = content.replace(/\n\s*\n\s*\n/g, "\n\n");
    return content.trim();
  }

  async generateWebGame(gamePrompt, chatId, skipValidation = false) {
    return await traceFunction(
      "Complete-Web-Game-Chain",
      async () => {
        console.log(chalk.blue(`Starting Unity WebGL game generation for: ${gamePrompt}`));
        if (skipValidation) {
          console.log(chalk.yellow("⚠️ Validation steps disabled"));
        }

        console.log(chalk.cyan("Step 1: Getting game explanation from Groq..."));
        const groqExplanation = await this.getGameExplanation(gamePrompt, chatId);

        console.log(chalk.cyan("Step 2: Generating code with OpenRouter..."));
        const grok3InitialCode = await this.generateCleanCodeWithGrok3(groqExplanation, gamePrompt, chatId);

        let anthropicFeedback = null;
        let grok3FinalCode = null;

        if (!skipValidation) {
          console.log(chalk.cyan("Step 3: Validating code with Anthropic..."));
          anthropicFeedback = await this.validateWithAnthropic(grok3InitialCode, gamePrompt, chatId);

          console.log(chalk.cyan("Step 4: Generating final code with OpenRouter..."));
          grok3FinalCode = await this.generateFinalCodeWithGrok3(anthropicFeedback, grok3InitialCode, gamePrompt, chatId);
        } else {
          console.log(chalk.yellow("Steps 3 & 4 skipped"));
          grok3FinalCode = grok3InitialCode;
          anthropicFeedback = "Validation skipped";
        }

        console.log(chalk.blue(`Game generation completed for: ${gamePrompt}`));
        return {
          groqExplanation,
          grok3InitialCode,
          anthropicFeedback,
          grok3FinalCode,
          webGameCode: grok3FinalCode,
          finalCode: grok3FinalCode,
          validationSkipped: skipValidation,
        };
      },
      { gamePrompt, chatId, skipValidation },
      { operation: "complete-web-game-chain" },
    );
  }

  detectGameType(prompt) {
    const lowerPrompt = prompt.toLowerCase();
    if (lowerPrompt.includes("snake")) return "2d-arcade";
    return "2d-arcade";
  }
}

export default TracedLLMProvider;