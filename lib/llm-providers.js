import { Groq } from "groq-sdk";
import Anthropic from "@anthropic-ai/sdk";
import { traceFunction } from "./langsmith-tracer.js";
import chalk from "chalk";
import dotenv from "dotenv";

dotenv.config();

// Initialize API clients
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Enhanced LLM Provider class for generating 2D web games
class TracedLLMProvider {
  constructor() {
    this.providers = {
      groq: groq,
      anthropic: anthropic,
    };
  }

  // Step 1: Groq provides detailed explanation and file structure
  async getGameExplanation(gamePrompt, chatId) {
    return await traceFunction(
      "Groq-Game-Explanation",
      async () => {
        console.log(chalk.green(`Getting game explanation from Groq for: ${gamePrompt}`));

        const messages = [
          {
            role: "system",
            content: `You are a senior web game developer specializing in Next.js, TypeScript, Tailwind CSS, and SVG rendering for 2D games. When given a game request, provide a detailed explanation of how to build it as a modern 2D web game with custom SVG assets.

**REQUIREMENTS**:
- Use Next.js (TypeScript) with Tailwind CSS for styling and SVG for 2D rendering.
- Structure the project under the Next.js \`app/\` directory with modular components in \`components/\`.
- Use the exact \`package.json\` structure provided below, with the game name derived from the prompt.
- Provide a complete technical breakdown of game mechanics, SVG rendering, UI, and audio.
- Include Web Audio API for sound effects and music.
- Ensure responsive design for mobile and desktop with touch controls.
- Generate custom SVG assets for the game (e.g., player, obstacles, background).
- Ensure the game is cross-checked twice for correctness in the full chain.
- Suggest a specific file structure and component organization.

**REQUIRED PACKAGE.JSON**:
{
  "name": "[Game name derived from prompt, e.g., 'flappy-bird' for 'Flappy Bird']",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "build": "next build",
    "dev": "next dev",
    "lint": "next lint",
    "start": "next start"
  },
  "dependencies": {
    "@radix-ui/react-dialog": "1.1.4",
    "@radix-ui/react-toast": "1.2.4",
    "autoprefixer": "^10.4.20",
    "clsx": "^2.1.1",
    "lucide-react": "^0.454.0",
    "next": "15.2.4",
    "react": "^19",
    "react-dom": "^19",
    "react-hook-form": "^7.60.0",
    "tailwind-merge": "^2.5.5",
    "tailwindcss-animate": "^1.0.7",
    "zod": "3.25.67"
  },
  "devDependencies": {
    "@types/node": "^22",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "postcss": "^8.5",
    "tailwindcss": "^4.1.9",
    "typescript": "^5"
  }
}

**REQUIRED FILE STRUCTURE (MUST MENTION ALL 9 FILES)**:
1. **package.json** - Project dependencies as specified above, with game name from prompt.
2. **pnpm-lock.yaml** - Lockfile for dependency management.
3. **app/globals.css** - Global Tailwind CSS styles with custom theme and animations.
4. **app/layout.tsx** - Root layout with metadata and font setup.
5. **app/page.tsx** - Main page rendering the game component.
6. **components/game.tsx** - Main game component integrating engine, UI, logic, and controls.
7. **components/game-engine.tsx** - 2D SVG rendering and game loop management.
8. **components/game-ui.tsx** - UI components for HUD, start screen, and game over screen.
9. **components/game-controls.tsx** - Input handling for keyboard and touch controls.

**SVG ASSET REQUIREMENTS**:
- Generate SVG assets for: player (e.g., bird), obstacles (e.g., pipes), background.
- Include SVG code in the explanation and integrate into relevant files (e.g., save in public/assets/).

**FORMAT YOUR RESPONSE AS**:
1. **Game Overview**: Brief description and core mechanics (e.g., Flappy Bird with player navigating through obstacles).
2. **Technical Architecture**: Component structure and file organization.
3. **Required Files**: Detailed purpose and key functionality of each file.
4. **Game Mechanics**: Core gameplay systems (player movement, obstacles, scoring).
5. **SVG Rendering**: SVG rendering setup, asset integration, and animation.
6. **UI Design**: Tailwind CSS-based UI with responsive design.
7. **Input Handling**: Keyboard and touch input systems.
8. **Audio Integration**: Web Audio API for sound effects and music.
9. **Responsive Design**: Mobile and desktop considerations.
10. **SVG Assets**: SVG code for player, obstacles, and background.

Be detailed and comprehensive. MENTION ALL 9 REQUIRED FILES with their specific purposes and include SVG asset code.`,
          },
          {
            role: "user",
            content: `Explain how to build a ${gamePrompt} as a modern 2D web game using Next.js, TypeScript, Tailwind CSS, and SVG rendering. Provide a detailed technical approach with all 9 required files and their specific roles in the game architecture. Ensure the package.json uses the exact structure provided, with the game name derived from the prompt. Include custom SVG assets for the player, obstacles, and background.`,
          },
        ];

        const chatCompletion = await this.providers.groq.chat.completions.create({
          messages: messages,
          model: "llama-3.3-70b-versatile",
          temperature: 0.4,
          max_tokens: 3000,
          top_p: 1,
          stream: false,
        });

        const response = chatCompletion.choices[0]?.message?.content || "";
        console.log(chalk.green(`Groq explanation: ${response.length} characters`));
        return response;
      },
      {
        gamePrompt: gamePrompt,
        chatId: chatId,
      },
      { step: "game-explanation", provider: "groq" },
    );
  }

  // Step 2: Grok generates clean, production-ready code
  async generateCleanCodeWithGrok(groqExplanation, gamePrompt, chatId) {
    return await traceFunction(
      "Grok-Clean-Code-Generation",
      async () => {
        console.log(chalk.green(`Generating clean, production-ready code with Grok...`));

        const messages = [
          {
            role: "system",
            content: `You are an expert 2D game developer for Next.js and SVG rendering. Generate CLEAN, PRODUCTION-READY code for all 9 required files, using the exact package.json structure provided below.

**CRITICAL REQUIREMENTS**:
- Generate ONLY clean TypeScript, CSS, JSON, and SVG code.
- NO markdown code blocks, NO backticks, NO comments about generation.
- NO "Generated by" comments or metadata.
- Each file should be pure, executable code ready to run.
- Use Next.js (TypeScript) with Tailwind CSS for styling.
- Use SVG for 2D rendering with 60fps performance via requestAnimationFrame.
- Include Web Audio API for sound effects and music.
- Ensure responsive design with mobile touch controls.
- For package.json, use the exact structure provided, with the game name derived from the prompt (e.g., 'flappy-bird' for 'Flappy Bird').
- Include custom SVG assets saved in public/assets/ (e.g., bird.svg, pipe.svg, background.svg).

**REQUIRED PACKAGE.JSON**:
{
  "name": "[Game name derived from prompt, e.g., 'flappy-bird' for 'Flappy Bird']",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "build": "next build",
    "dev": "next dev",
    "lint": "next lint",
    "start": "next start"
  },
  "dependencies": {
    "@radix-ui/react-dialog": "1.1.4",
    "@radix-ui/react-toast": "1.2.4",
    "autoprefixer": "^10.4.20",
    "clsx": "^2.1.1",
    "lucide-react": "^0.454.0",
    "next": "15.2.4",
    "react": "^19",
    "react-dom": "^19",
    "react-hook-form": "^7.60.0",
    "tailwind-merge": "^2.5.5",
    "tailwindcss-animate": "^1.0.7",
    "zod": "3.25.67"
  },
  "devDependencies": {
    "@types/node": "^22",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "postcss": "^8.5",
    "tailwindcss": "^4.1.9",
    "typescript": "^5"
  }
}

**REQUIRED FILES TO GENERATE (ALL 9)**:
1. package.json - Exact structure above with game name from prompt.
2. pnpm-lock.yaml - Dependency lockfile (minimal, valid format).
3. app/globals.css - Tailwind CSS with custom theme and animations.
4. app/layout.tsx - Root layout with metadata and fonts.
5. app/page.tsx - Main page rendering the game component.
6. components/game.tsx - Main game component integrating all modules.
7. components/game-engine.tsx - SVG rendering and game loop management.
8. components/game-ui.tsx - UI components with Tailwind CSS.
9. components/game-controls.tsx - Input handling for keyboard and touch.

**SVG ASSETS**:
- Generate SVG files: public/assets/bird.svg, public/assets/pipe.svg, public/assets/background.svg.
- Integrate SVGs into components/game-engine.tsx for rendering.

**OUTPUT FORMAT - USE EXACT SEPARATORS (NO BACKTICKS)**:
// === package.json ===
[clean JSON code]

// === pnpm-lock.yaml ===
[clean YAML lockfile]

// === app/globals.css ===
[clean CSS code]

// === app/layout.tsx ===
[clean TypeScript code]

// === app/page.tsx ===
[clean TypeScript code]

// === components/game.tsx ===
[clean TypeScript code]

// === components/game-engine.tsx ===
[clean TypeScript code]

// === components/game-ui.tsx ===
[clean TypeScript code]

// === components/game-controls.tsx ===
[clean TypeScript code]

// === public/assets/bird.svg ===
[clean SVG code]

// === public/assets/pipe.svg ===
[clean SVG code]

// === public/assets/background.svg ===
[clean SVG code]

**ABSOLUTELY NO**:
- Markdown code blocks (typescript)
- Generation comments
- Metadata comments
- Backticks or quotes around code
- "Generated by" text

GENERATE ONLY CLEAN, EXECUTABLE CODE.`,
          },
          {
            role: "user",
            content: `Generate clean, production-ready code for a ${gamePrompt} 2D web game using Next.js, TypeScript, Tailwind CSS, and SVG rendering based on this explanation:

${groqExplanation}

Generate ALL 9 required files with clean, executable code, plus 3 SVG assets:
1. package.json - Exact structure provided with game name from prompt.
2. pnpm-lock.yaml - Dependency lockfile.
3. app/globals.css - Tailwind CSS with custom theme.
4. app/layout.tsx - Root layout with metadata.
5. app/page.tsx - Main page with game component.
6. components/game.tsx - Main game component.
7. components/game-engine.tsx - SVG rendering engine.
8. components/game-ui.tsx - UI components.
9. components/game-controls.tsx - Input controls.
10. public/assets/bird.svg - SVG for player.
11. public/assets/pipe.svg - SVG for obstacles.
12. public/assets/background.svg - SVG for background.

Make the code clean, professional, and immediately executable. NO generation comments or metadata.`,
          },
        ];

        const chatCompletion = await this.providers.groq.chat.completions.create({
          messages: messages,
          model: "llama-3.3-70b-versatile",
          temperature: 0.2,
          max_tokens: 8192,
          top_p: 1,
          stream: true,
        });

        let response = "";
        for await (const chunk of chatCompletion) {
          response += chunk.choices[0]?.delta?.content || "";
        }

        console.log(chalk.green(`Grok clean code: ${response.length} characters`));
        return response;
      },
      {
        gamePrompt: gamePrompt,
        groqExplanation: groqExplanation.slice(0, 300) + "...",
        chatId: chatId,
      },
      { step: "clean-code-generation", provider: "groq" },
    );
  }

  // Step 3 & 4: Anthropic validates and provides detailed feedback (run twice)
  async validateWithAnthropic(grokInitialCode, gamePrompt, chatId) {
    return await traceFunction(
      "Anthropic-Code-Validation",
      async () => {
        console.log(chalk.green(`Validating code with Anthropic...`));

        const prompt = `You are a senior code reviewer specializing in Next.js and SVG-based 2D games. Review the generated code and provide detailed validation feedback.

**GAME**: ${gamePrompt}

**GENERATED CODE TO REVIEW**:
${grokInitialCode}

**VALIDATION CHECKLIST**:
1. **File Completeness**: Are all 9 required files present, plus 3 SVG assets?
   - package.json (must match provided structure), pnpm-lock.yaml, app/globals.css, app/layout.tsx, app/page.tsx
   - components/game.tsx, components/game-engine.tsx, components/game-ui.tsx, components/game-controls.tsx
   - public/assets/bird.svg, public/assets/pipe.svg, public/assets/background.svg
2. **Code Quality**: Check for syntax errors, TypeScript errors, missing methods, incomplete implementations.
3. **Game Functionality**: Validate SVG rendering, game loop, UI rendering, input handling, and audio.
4. **Mobile Compatibility**: Check responsive design and touch controls.
5. **Integration**: Verify files work together with proper imports and dependencies.
6. **SVG Assets**: Ensure SVGs are valid, integrated, and animated correctly.

**PROVIDE CONCISE FEEDBACK IN THIS FORMAT**:
## VALIDATION RESULTS
### ✅ COMPLETE FILES:
[List files that are properly implemented]
### ❌ MISSING/INCOMPLETE FILES:
[List missing or incomplete files]
### 🔧 CRITICAL ISSUES:
[List major problems that prevent the game from working]
### 📋 REQUIRED FIXES:
[Specific instructions for corrections]
### 🎯 PRIORITY IMPROVEMENTS:
[Most important changes needed]

Keep feedback concise but comprehensive. Focus on critical issues that prevent the game from working. Verify that package.json matches the provided structure with the correct game name and that SVG assets are included and functional.`;

        const response = await this.providers.anthropic.messages.create({
          model: "claude-3-haiku-20240307",
          max_tokens: 2000,
          temperature: 0.2,
          messages: [{ role: "user", content: prompt }],
        });

        const feedback = response.content[0]?.text || "";
        console.log(chalk.green(`Anthropic validation: ${feedback.length} characters`));
        return feedback;
      },
      {
        gamePrompt: gamePrompt,
        groqInitialCode: grokInitialCode.slice(0, 500) + "...",
        chatId: chatId,
      },
      { step: "code-validation", provider: "anthropic" },
    );
  }

  // Step 5: Grok generates final fixed code based on double validation feedback
  async generateFinalCodeWithGrok(anthropicFeedback, grokInitialCode, gamePrompt, chatId) {
    return await traceFunction(
      "Grok-Final-Code-Generation",
      async () => {
        console.log(chalk.green(`Generating final fixed code with Grok...`));

        const messages = [
          {
            role: "system",
            content: `You are an expert 2D game developer for Next.js and SVG rendering. Fix and improve the generated code based on the double validation feedback provided, using the exact package.json structure provided below.

**YOUR TASK**:
- Review the validation feedback carefully (two rounds of Anthropic feedback).
- Fix all identified issues and problems.
- Generate complete, working code for ALL 9 files plus 3 SVG assets.
- Ensure the game is fully functional and ready to play.
- Address all missing files, methods, and functionality.
- Optimize for 60fps performance with SVG rendering via requestAnimationFrame.
- Include Web Audio API for audio integration.
- Ensure responsive design with Tailwind CSS and mobile touch controls.
- For package.json, use the exact structure provided, with the game name derived from the prompt.
- Include SVG assets in public/assets/ (bird.svg, pipe.svg, background.svg).

**REQUIRED PACKAGE.JSON**:
{
  "name": "[Game name derived from prompt, e.g., 'flappy-bird' for 'Flappy Bird']",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "build": "next build",
    "dev": "next dev",
    "lint": "next lint",
    "start": "next start"
  },
  "dependencies": {
    "@radix-ui/react-dialog": "1.1.4",
    "@radix-ui/react-toast": "1.2.4",
    "autoprefixer": "^10.4.20",
    "clsx": "^2.1.1",
    "lucide-react": "^0.454.0",
    "next": "15.2.4",
    "react": "^19",
    "react-dom": "^19",
    "react-hook-form": "^7.60.0",
    "tailwind-merge": "^2.5.5",
    "tailwindcss-animate": "^1.0.7",
    "zod": "3.25.67"
  },
  "devDependencies": {
    "@types/node": "^22",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "postcss": "^8.5",
    "tailwindcss": "^4.1.9",
    "typescript": "^5"
  }
}

**OUTPUT FORMAT - USE EXACT SEPARATORS**:
// === package.json ===
[complete, fixed JSON file]

// === pnpm-lock.yaml ===
[complete, fixed lockfile]

// === app/globals.css ===
[complete, fixed CSS file]

// === app/layout.tsx ===
[complete, fixed TypeScript file]

// === app/page.tsx ===
[complete, fixed TypeScript file]

// === components/game.tsx ===
[complete, fixed TypeScript file]

// === components/game-engine.tsx ===
[complete, fixed TypeScript file]

// === components/game-ui.tsx ===
[complete, fixed TypeScript file]

// === components/game-controls.tsx ===
[complete, fixed TypeScript file]

// === public/assets/bird.svg ===
[complete, fixed SVG file]

// === public/assets/pipe.svg ===
[complete, fixed SVG file]

// === public/assets/background.svg ===
[complete, fixed SVG file]

**CRITICAL**: Address ALL issues mentioned in the validation feedback. Generate complete, working files that integrate properly and create a fully functional game. Ensure package.json matches the provided structure with the correct game name and that SVG assets are included and functional.`,
          },
          {
            role: "user",
            content: `Fix and improve the code for ${gamePrompt} based on this validation feedback:

**VALIDATION FEEDBACK**:
${anthropicFeedback}

**ORIGINAL CODE TO FIX**:
${grokInitialCode}

Generate the complete, fixed code for ALL 9 files plus 3 SVG assets:
1. package.json - Exact structure provided with game name from prompt.
2. pnpm-lock.yaml - Fix lockfile issues.
3. app/globals.css - Fix Tailwind CSS and theme issues.
4. app/layout.tsx - Fix layout and metadata issues.
5. app/page.tsx - Fix page rendering issues.
6. components/game.tsx - Fix game component integration.
7. components/game-engine.tsx - Fix SVG rendering issues.
8. components/game-ui.tsx - Fix UI rendering issues.
9. components/game-controls.tsx - Fix input handling issues.
10. public/assets/bird.svg - Fix player SVG.
11. public/assets/pipe.svg - Fix obstacle SVG.
12. public/assets/background.svg - Fix background SVG.

Address ALL problems identified in the validation feedback. Make sure the final game is complete and fully functional.`,
          },
        ];

        const chatCompletion = await this.providers.groq.chat.completions.create({
          messages: messages,
          model: "llama-3.3-70b-versatile",
          temperature: 0.2,
          max_tokens: 8192,
          top_p: 1,
          stream: true,
        });

        let response = "";
        for await (const chunk of chatCompletion) {
          response += chunk.choices[0]?.delta?.content || "";
        }

        console.log(chalk.green(`Grok final code: ${response.length} characters`));
        return response;
      },
      {
        gamePrompt: gamePrompt,
        anthropicFeedback: anthropicFeedback.slice(0, 300) + "...",
        grokInitialCode: grokInitialCode.slice(0, 300) + "...",
        chatId: chatId,
      },
      { step: "final-code-generation", provider: "groq" },
    );
  }

  // Complete enhanced chain with double validation
  async generateWebGame(gamePrompt, chatId, skipValidation = false) {
    return await traceFunction(
      "Complete-Enhanced-Web-Game-Chain-V3",
      async () => {
        console.log(chalk.blue(`Starting enhanced web game generation chain V3 for: ${gamePrompt}`));

        if (skipValidation) {
          console.log(chalk.yellow("⚠️ VALIDATION STEPS DISABLED - Using Grok initial code as final"));
        }

        // Step 1: Groq explains the game and provides comprehensive architecture
        console.log(chalk.cyan("Step 1: Getting comprehensive game explanation from Groq..."));
        const groqExplanation = await this.getGameExplanation(gamePrompt, chatId);

        // Step 2: Grok generates initial complete code for all files
        console.log(chalk.cyan("Step 2: Generating complete code with Grok..."));
        const grokInitialCode = await this.generateCleanCodeWithGrok(groqExplanation, gamePrompt, chatId);

        let anthropicFeedback1 = null;
        let anthropicFeedback2 = null;
        let grokFinalCode = null;

        if (!skipValidation) {
          // Step 3: Anthropic validates the code (first pass)
          console.log(chalk.cyan("Step 3: First validation with Anthropic..."));
          anthropicFeedback1 = await this.validateWithAnthropic(grokInitialCode, gamePrompt, chatId);

          // Step 4: Anthropic validates the code (second pass for cross-checking)
          console.log(chalk.cyan("Step 4: Second validation with Anthropic..."));
          anthropicFeedback2 = await this.validateWithAnthropic(grokInitialCode, gamePrompt, chatId);

          // Step 5: Grok generates final fixed code based on double validation feedback
          console.log(chalk.cyan("Step 5: Generating final fixed code with Grok..."));
          grokFinalCode = await this.generateFinalCodeWithGrok(
            `${anthropicFeedback1}\n\nSecond Validation:\n${anthropicFeedback2}`,
            grokInitialCode,
            gamePrompt,
            chatId
          );
        } else {
          console.log(chalk.yellow("Steps 3 & 4 skipped - using Grok initial code as final"));
          grokFinalCode = grokInitialCode;
          anthropicFeedback1 = "First validation skipped by user request";
          anthropicFeedback2 = "Second validation skipped by user request";
        }

        console.log(chalk.blue(`Enhanced web game chain V3 completed for: ${gamePrompt}`));

        return {
          groqExplanation,
          grokInitialCode,
          anthropicFeedback1,
          anthropicFeedback2,
          grokFinalCode,
          webGameCode: grokFinalCode,
          finalCode: grokFinalCode,
          validationSkipped: skipValidation,
        };
      },
      {
        gamePrompt: gamePrompt,
        chatId: chatId,
        skipValidation: skipValidation,
      },
      { operation: "complete-enhanced-web-game-chain-v3" },
    );
  }
}

export default TracedLLMProvider;