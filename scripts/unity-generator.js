import Groq from "groq-sdk"
import Anthropic from "@anthropic-ai/sdk"
import { writeFileSync } from "fs"
import readline from "readline"

// Initialize API clients
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
})

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

// Function to get user input
function getUserInput(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer)
    })
  })
}

// Babylon.js Game Development Prompt
const BABYLONJS_GAME_DEVELOPMENT_PROMPT = `You are a **senior Babylon.js game developer** with 10+ years of experience. Create a **complete, production-ready Next.js + Babylon.js game** with clean, modular TypeScript architecture.

## CORE REQUIREMENTS:
- **Framework**: Next.js 15+ with App Router
- **Language**: TypeScript only
- **3D Engine**: Babylon.js 7.0+
- **Styling**: Tailwind CSS
- **Architecture**: Clean, modular, production-grade code
- **No external plugins** except Babylon.js core packages

## MANDATORY FILE STRUCTURE:
\`\`\`
├── package.json (Next.js + Babylon.js dependencies)
├── app/
│   ├── layout.tsx (Root layout with metadata)
│   ├── page.tsx (Main game page)
│   └── globals.css (Tailwind + custom styles)
├── components/
│   └── game.tsx (Main game component)
├── lib/
│   ├── babylon-engine.ts (Babylon.js engine wrapper)
│   ├── game-manager.ts (Game logic and state)
│   ├── input-manager.ts (Input handling)
│   ├── audio-manager.ts (Web Audio API)
│   └── utils.ts (Utility functions)
└── types/
    └── game.ts (TypeScript interfaces)
\`\`\`

## ESSENTIAL BABYLON.JS PATTERNS:
1. **Engine Lifecycle**: Proper initialization, render loop, disposal
2. **Scene Management**: Scene creation, lighting, camera setup
3. **Mesh Creation**: MeshBuilder for primitives, materials, textures
4. **Physics Integration**: Cannon.js or Havok physics (optional)
5. **Input Handling**: ActionManager for keyboard/mouse input
6. **Asset Loading**: AssetsManager for models and textures
7. **Performance**: Proper disposal, LOD, culling
8. **TypeScript**: Strong typing for all Babylon.js objects

## REQUIRED SYSTEMS:

### BabylonEngine.ts Template:
\`\`\`typescript
import {
  Engine,
  Scene,
  FreeCamera,
  Vector3,
  HemisphericLight,
  MeshBuilder,
  StandardMaterial,
  Color3
} from "@babylonjs/core";

export class BabylonEngine {
  private engine: Engine;
  private scene: Scene;
  private camera: FreeCamera;

  constructor(private canvas: HTMLCanvasElement) {
    this.engine = new Engine(canvas, true);
    this.scene = new Scene(this.engine);
    this.camera = new FreeCamera("camera", new Vector3(0, 5, -10), this.scene);
  }

  async initialize(): Promise<void> {
    // Setup camera and lighting
    // Create game objects
    // Start render loop
  }

  dispose(): void {
    this.scene.dispose();
    this.engine.dispose();
  }
}
\`\`\`

### GameManager.ts Template:
\`\`\`typescript
import { Scene, Mesh } from "@babylonjs/core";

export class GameManager {
  private gameState: GameState;
  private gameObjects: Mesh[] = [];

  constructor(private scene: Scene) {
    this.gameState = {
      score: 0,
      level: 1,
      gameOver: false,
      paused: false
    };
  }

  update(deltaTime: number, input: InputState): void {
    // Game logic here
  }
}
\`\`\`

## CODING STANDARDS:
- **Naming**: PascalCase for classes, camelCase for variables
- **Imports**: Explicit Babylon.js imports from "@babylonjs/core"
- **Types**: Strong TypeScript typing for all objects
- **Error Handling**: Try-catch for async operations
- **Performance**: Dispose of resources properly
- **Comments**: JSDoc for public methods

## GAME MECHANICS TO IMPLEMENT:
1. **3D Movement**: WASD + mouse look camera controls
2. **Game Loop**: Initialize → Update → Render → Dispose
3. **Score System**: Points, progression, UI display
4. **Audio**: 3D positional audio, sound effects
5. **UI**: HUD overlay with React components
6. **Physics**: Collision detection, gravity (optional)
7. **Lighting**: Dynamic lighting and shadows
8. **Materials**: PBR materials for realistic rendering

## BABYLON.JS SPECIFIC FEATURES:
- **Scene**: Main 3D scene with proper disposal
- **Camera**: FreeCamera or ArcRotateCamera with controls
- **Lighting**: HemisphericLight + DirectionalLight
- **Meshes**: MeshBuilder for primitives, imported models
- **Materials**: StandardMaterial or PBRMaterial
- **Textures**: Dynamic texture generation
- **Animation**: Animation groups and targets
- **Input**: ActionManager for keyboard/mouse

## ERROR-FREE REQUIREMENTS:
- All TypeScript must compile without errors
- Proper Babylon.js imports and initialization
- No memory leaks (proper disposal)
- Responsive canvas that resizes properly
- Cross-browser compatibility (WebGL support)

## NEXT.JS INTEGRATION:
- Use "use client" directive for client components
- Proper useEffect for Babylon.js initialization
- Canvas ref management with useRef
- Clean component unmounting

## OUTPUT FORMAT:
Generate complete files with full implementation:

// === package.json ===
[Complete Next.js + Babylon.js package.json]

// === app/layout.tsx ===
[Complete Next.js layout with metadata]

// === app/page.tsx ===
[Complete page component]

// === app/globals.css ===
[Tailwind CSS + custom styles]

// === components/game.tsx ===
[Complete React game component]

// === lib/babylon-engine.ts ===
[Complete Babylon.js engine wrapper]

// === lib/game-manager.ts ===
[Complete game logic manager]

// === lib/input-manager.ts ===
[Complete input handling]

// === lib/audio-manager.ts ===
[Complete Web Audio API manager]

// === lib/utils.ts ===
[Complete utility functions]

// === types/game.ts ===
[Complete TypeScript interfaces]

Generate a complete, deployable Next.js + Babylon.js project that can be run with \`npm run dev\` immediately.`

// Step 1: Generate initial draft using Groq + Llama
async function getBabylonDraft(taskDescription) {
  console.log("🚀 Generating initial Babylon.js Next.js draft with Groq + Llama 3.3 70B...")

  const prompt = `${BABYLONJS_GAME_DEVELOPMENT_PROMPT}

## SPECIFIC GAME REQUEST:
Create a ${taskDescription} game with the following requirements:
- Complete Next.js + Babylon.js implementation
- All required TypeScript files and components
- Modern React patterns with hooks
- Production-ready code quality
- Responsive 3D canvas
- Proper Babylon.js lifecycle management

Generate ONLY the complete file contents using the exact separators, no explanations.`

  try {
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.7,
      max_tokens: 4000,
    })

    return completion.choices[0]?.message?.content || ""
  } catch (error) {
    console.error("❌ Error with Groq API:", error.message)
    throw error
  }
}

// Step 2: Refine code using Claude Haiku
async function getBabylonRefinement(rawCode) {
  console.log("✨ Refining Babylon.js Next.js code with Claude 3 Haiku...")

  const prompt = `You are a senior Babylon.js and Next.js developer. Please review and improve this Babylon.js + Next.js code:

${rawCode}

Optimization goals:
- Fix any TypeScript compilation errors
- Improve Babylon.js performance and memory management
- Add proper error handling and resource disposal
- Enhance code structure and type safety
- Ensure Next.js best practices are followed
- Add any missing essential Babylon.js features
- Optimize 3D rendering and canvas management
- Ensure proper React component lifecycle

Return only the improved code with the same file separators, no explanations.`

  try {
    const message = await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 4000,
      temperature: 0.3,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    })

    return message.content[0]?.text || ""
  } catch (error) {
    console.error("❌ Error with Anthropic API:", error.message)
    throw error
  }
}

// Step 3: Babylon.js + Next.js validation
function validateBabylonCode(code) {
  console.log("🔍 Validating Babylon.js + Next.js code...")

  const requiredElements = [
    'from "@babylonjs/core"',
    "Engine",
    "Scene",
    "next",
    "react",
    "useEffect",
    "useRef",
    "export default function",
  ]

  const validationResults = {
    passed: true,
    issues: [],
  }

  // Check for required elements
  requiredElements.forEach((element) => {
    if (!code.includes(element)) {
      validationResults.passed = false
      validationResults.issues.push(`Missing required element: ${element}`)
    }
  })

  // Check for Babylon.js patterns
  const babylonPatterns = ["new Engine(", "new Scene(", "MeshBuilder", "camera", "render"]

  babylonPatterns.forEach((pattern) => {
    if (!code.includes(pattern)) {
      validationResults.issues.push(`Missing Babylon.js pattern: ${pattern}`)
    }
  })

  // Check for Next.js patterns
  const nextPatterns = ['"use client"', "export default function", "className=", "useEffect"]

  nextPatterns.forEach((pattern) => {
    if (!code.includes(pattern)) {
      validationResults.issues.push(`Missing Next.js pattern: ${pattern}`)
    }
  })

  return validationResults
}

// Main execution function
async function generateBabylonGame() {
  try {
    console.log("🎮 Babylon.js + Next.js AI Code Generator")
    console.log("==========================================\n")

    // Get task description from command line or user input
    let taskDescription = process.argv[2]

    if (!taskDescription) {
      taskDescription = await getUserInput("Enter your 3D game description: ")
    }

    if (!taskDescription.trim()) {
      console.log("❌ No task description provided. Exiting...")
      process.exit(1)
    }

    console.log(`📝 Task: ${taskDescription}\n`)

    // Step 1: Generate initial draft
    const rawDraft = await getBabylonDraft(taskDescription)
    console.log("✅ Initial Babylon.js + Next.js draft generated\n")

    // Step 2: Refine with Claude
    const optimizedCode = await getBabylonRefinement(rawDraft)
    console.log("✅ Code refined and optimized\n")

    // Step 3: Validate
    const validation = validateBabylonCode(optimizedCode)

    if (validation.passed) {
      console.log("✅ Babylon.js + Next.js validation passed\n")
    } else {
      console.log("⚠️  Validation issues found:")
      validation.issues.forEach((issue) => console.log(`   - ${issue}`))
      console.log("")
    }

    // Step 4: Output final code
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
    const filename = `babylonjs-nextjs-game-${timestamp}.txt`

    // Add header comment to the code
    const finalCode = `// Babylon.js + Next.js Game Generated by AI
// Task: ${taskDescription}
// Generated: ${new Date().toISOString()}
// Architecture: Groq (Llama 3.3 70B) → Claude 3 Haiku → Validation
// Stack: Next.js 15 + Babylon.js 7 + TypeScript + Tailwind CSS

${optimizedCode}`

    // Write to file
    writeFileSync(filename, finalCode)
    console.log(`📁 Final code saved to: ${filename}`)

    // Also output to console if requested
    const showInConsole = await getUserInput("\nShow code in console? (y/n): ")
    if (showInConsole.toLowerCase().startsWith("y")) {
      console.log("\n" + "=".repeat(50))
      console.log("GENERATED BABYLON.JS + NEXT.JS CODE:")
      console.log("=".repeat(50))
      console.log(finalCode)
    }

    console.log("\n🎉 Babylon.js + Next.js generation complete!")
    console.log("📋 Next steps:")
    console.log("   1. Create a new Next.js project")
    console.log("   2. Copy the generated files")
    console.log("   3. Run 'npm install' to install dependencies")
    console.log("   4. Run 'npm run dev' to start the development server")
  } catch (error) {
    console.error("💥 Error during generation:", error.message)
    process.exit(1)
  } finally {
    rl.close()
  }
}

// Check for required environment variables
function checkEnvironment() {
  const required = ["GROQ_API_KEY", "ANTHROPIC_API_KEY"]
  const missing = required.filter((key) => !process.env[key])

  if (missing.length > 0) {
    console.error("❌ Missing required environment variables:")
    missing.forEach((key) => console.error(`   - ${key}`))
    console.error("\nPlease set these environment variables and try again.")
    process.exit(1)
  }
}

// Run the generator
checkEnvironment()
generateBabylonGame().catch(console.error)
