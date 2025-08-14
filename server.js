import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import fs from "fs-extra"
import chalk from "chalk"
import { v4 as uuidv4 } from "uuid"
import swaggerJsdoc from "swagger-jsdoc"
import swaggerUi from "swagger-ui-express"
import TracedLLMProvider from "./lib/llm-providers.js"
import { spawn } from "child_process"
import path from "path"
import { fileURLToPath } from "url"
import net from "net"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3005

const GENERATED_PROJECTS_PATH = process.env.GENERATED_PROJECTS_PATH || "generated-projects2"
const NGINX_PROJECTS_PATH = process.env.NGINX_PROJECTS_PATH || "nginx-projects"
const DEPLOY_LOG_PATH = process.env.DEPLOY_LOG_PATH || "deploy-log.txt"
const TEMPLATES_DIR = path.join(__dirname, "templates")

app.use(cors())
app.use(express.json())
app.use(express.static("public"))

const PROJECTS_DIR = "generated-projects"
const CHAT_HISTORY_DIR = "chat-history"

await fs.ensureDir(PROJECTS_DIR)
await fs.ensureDir(CHAT_HISTORY_DIR)
await fs.ensureDir(TEMPLATES_DIR)

let chatCounter = 1
const conversationContexts = new Map()

// Initialize traced LLM provider
const llmProvider = new TracedLLMProvider()

// ============================================================================
// TEMPLATE LOADING FUNCTIONS
// ============================================================================

// Load template files from the templates directory
async function loadTemplate(templateName) {
  try {
    const templatePath = path.join(TEMPLATES_DIR, templateName)
    return await fs.readFile(templatePath, "utf8")
  } catch (error) {
    console.warn(chalk.yellow(`⚠️  Template ${templateName} not found, using fallback`))
    return null
  }
}

// Generate configuration files from templates
async function generateConfigFiles(gameName, gameType) {
  const configFiles = []

  // Load templates
  const nextConfigTemplate = await loadTemplate("next-config.js")
  const tailwindConfigTemplate = await loadTemplate("tailwind-config.ts")
  const tsconfigTemplate = await loadTemplate("tsconfig.json")
  const componentsConfigTemplate = await loadTemplate("components.json")
  const postcssConfigTemplate = await loadTemplate("postcss-config.js")
  const gitignoreTemplate = await loadTemplate("gitignore.txt")
  const readmeTemplate = await loadTemplate("readme.md")

  // Add next.config.mjs
  if (nextConfigTemplate) {
    configFiles.push({
      name: "next.config.mjs",
      content: nextConfigTemplate,
      type: "js",
    })
  }

  // Add tailwind.config.ts
  if (tailwindConfigTemplate) {
    configFiles.push({
      name: "tailwind.config.ts",
      content: tailwindConfigTemplate,
      type: "ts",
    })
  }

  // Add tsconfig.json
  if (tsconfigTemplate) {
    configFiles.push({
      name: "tsconfig.json",
      content: tsconfigTemplate,
      type: "json",
    })
  }

  // Add components.json
  if (componentsConfigTemplate) {
    configFiles.push({
      name: "components.json",
      content: componentsConfigTemplate,
      type: "json",
    })
  }

  // Add postcss.config.mjs
  if (postcssConfigTemplate) {
    configFiles.push({
      name: "postcss.config.mjs",
      content: postcssConfigTemplate,
      type: "js",
    })
  }

  // Add .gitignore
  if (gitignoreTemplate) {
    configFiles.push({
      name: ".gitignore",
      content: gitignoreTemplate,
      type: "txt",
    })
  }

  // Add README.md with replacements
  if (readmeTemplate) {
    const gameDisplayName = gameName.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    const gameEngine = gameType === "babylon" ? "Babylon.js" : "Phaser"

    const readmeContent = readmeTemplate
      .replace(/\{GAME_NAME\}/g, gameDisplayName)
      .replace(/\{GAME_ENGINE\}/g, gameEngine)

    configFiles.push({
      name: "README.md",
      content: readmeContent,
      type: "md",
    })
  }

  return configFiles
}

// ============================================================================
// SWAGGER CONFIGURATION
// ============================================================================
const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Web Game AI Generator API",
      version: "2.0.0",
      description: "Streaming API for generating Next.js web games using AI chains",
      contact: {
        name: "Web Game AI Generator",
        email: "support@webgameai.com",
      },
    },
    servers: [
      {
        url: `http://localhost:${PORT}`,
        description: "Development server",
      },
    ],
  },
  apis: ["./server.js"],
}

const swaggerSpec = swaggerJsdoc(swaggerOptions)
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec))

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

// Find available port
async function findAvailablePort(startPort = 8100) {
  const checkPort = (port) => {
    return new Promise((resolve) => {
      const server = net.createServer()

      server.once("error", (err) => {
        if (err.code === "EADDRINUSE") {
          resolve(false)
        } else {
          resolve(false)
        }
      })

      server.once("listening", () => {
        server.close(() => {
          resolve(true)
        })
      })

      server.listen(port, "127.0.0.1")
    })
  }

  for (let port = startPort; port <= startPort + 100; port++) {
    const isAvailable = await checkPort(port)
    if (isAvailable) {
      console.log(chalk.green(`✅ Found available port: ${port}`))
      return port
    } else {
      console.log(chalk.yellow(`⚠️  Port ${port} is in use, trying next...`))
    }
  }

  throw new Error("No available port found in range " + startPort + "-" + (startPort + 100))
}

// Save generated files to disk with proper directory structure
async function saveGeneratedFiles(projectId, files) {
  const projectPath = path.join(PROJECTS_DIR, projectId)
  await fs.ensureDir(projectPath)

  // Save each file with proper directory structure
  for (const file of files) {
    const filePath = path.join(projectPath, file.name)

    // Ensure the directory exists for nested files
    const fileDir = path.dirname(filePath)
    await fs.ensureDir(fileDir)

    await fs.writeFile(filePath, file.content)
    console.log(chalk.green(`✅ Saved ${file.name} to ${filePath}`))
  }

  return projectPath
}

// Setup and run Next.js project
async function setupAndRunProject(projectPath) {
  return new Promise(async (resolve, reject) => {
    try {
      console.log(chalk.cyan(`📦 Setting up Next.js project in ${projectPath}...`))

      // Check if this is a Next.js project
      const packageJsonPath = path.join(projectPath, "package.json")
      let isNextJS = false

      try {
        const packageJson = JSON.parse(await fs.readFile(packageJsonPath, "utf8"))
        isNextJS = packageJson.dependencies?.next || packageJson.devDependencies?.next
      } catch (error) {
        console.log(chalk.yellow("Could not read package.json, assuming static files"))
      }

      // Run npm install
      const npmInstall = spawn("npm", ["install"], {
        cwd: projectPath,
        shell: true,
        stdio: "pipe",
      })

      npmInstall.on("close", async (code) => {
        if (code !== 0) {
          console.log(chalk.yellow("npm install had issues, trying to continue..."))
        }

        // Find available port
        const port = await findAvailablePort(isNextJS ? 3000 : 8000)

        let serverProcess
        let serverCommand

        if (isNextJS) {
          console.log(chalk.cyan(`🚀 Starting Next.js dev server on port ${port}...`))
          serverCommand = ["npm", ["run", "dev", "--", "--port", port.toString()]]
        } else {
          console.log(chalk.cyan(`🚀 Starting static server on port ${port}...`))
          serverCommand = ["npx", ["serve", ".", "-p", port.toString()]]
        }

        serverProcess = spawn(serverCommand[0], serverCommand[1], {
          cwd: projectPath,
          shell: true,
          stdio: "pipe",
          detached: false,
        })

        let serverStarted = false

        serverProcess.stdout.on("data", (data) => {
          const output = data.toString()
          console.log(chalk.gray(`Server output: ${output}`))

          // Check for server ready messages
          const isReady = isNextJS
            ? output.includes("Ready") || output.includes("started server") || output.includes("Local:")
            : output.includes("localhost") || output.includes("Listening")

          if (isReady && !serverStarted) {
            serverStarted = true
            const serverUrl = `http://localhost:${port}`
            console.log(chalk.green(`✅ ${isNextJS ? "Next.js" : "Static"} server running at ${serverUrl}`))
            resolve({
              url: serverUrl,
              port: port,
              process: serverProcess,
              type: isNextJS ? "nextjs" : "static",
            })
          }
        })

        serverProcess.stderr.on("data", (data) => {
          const output = data.toString()
          console.log(chalk.gray(`Server stderr: ${output}`))

          // Next.js sometimes outputs ready message to stderr
          if (isNextJS && (output.includes("Ready") || output.includes("started server")) && !serverStarted) {
            serverStarted = true
            const serverUrl = `http://localhost:${port}`
            console.log(chalk.green(`✅ Next.js server running at ${serverUrl}`))
            resolve({
              url: serverUrl,
              port: port,
              process: serverProcess,
              type: "nextjs",
            })
          }
        })

        // Fallback timeout
        setTimeout(
          () => {
            if (!serverStarted) {
              const serverUrl = `http://localhost:${port}`
              console.log(chalk.yellow(`⚠️  Server should be running at ${serverUrl}`))
              resolve({
                url: serverUrl,
                port: port,
                process: serverProcess,
                type: isNextJS ? "nextjs" : "static",
              })
            }
          },
          isNextJS ? 15000 : 5000,
        )

        serverProcess.on("error", (error) => {
          console.error(chalk.red("Server error:", error))
          if (!serverStarted) {
            reject(error)
          }
        })
      })

      npmInstall.on("error", (error) => {
        console.error(chalk.red("npm install error:", error))
        reject(error)
      })
    } catch (error) {
      reject(error)
    }
  })
}

// Enhanced file validation and parsing with code cleanup for Next.js
function validateAndParseNextJSFiles(generatedCode, chatId, gameType = "phaser") {
  console.log(chalk.cyan(`Validating and parsing ${gameType} Next.js files...`))

  if (!generatedCode || typeof generatedCode !== "string") {
    console.log(chalk.yellow("No generated code provided, using default Next.js structure..."))
    generatedCode = "// Default Next.js game structure"
  }

  const files = []
  const missingFiles = []

  const requiredFiles =
    gameType === "babylon"
      ? [
          "package.json",
          "app/layout.tsx",
          "app/page.tsx",
          "app/globals.css",
          "components/game.tsx",
          "lib/babylon-engine.ts",
          "lib/game-manager.ts",
          "lib/input-manager.ts",
          "lib/audio-manager.ts",
          "lib/utils.ts",
          "types/game.ts",
        ]
      : [
          "package.json",
          "app/layout.tsx",
          "app/page.tsx",
          "app/globals.css",
          "components/game.tsx",
          "lib/phaser-config.ts",
          "lib/scenes/main-scene.ts",
          "lib/game-objects/player.ts",
          "lib/managers/audio-manager.ts",
          "lib/utils.ts",
          "types/game.ts",
        ]

  const fileSeparators =
    gameType === "babylon"
      ? [
          { pattern: /\/\/ === package\.json ===([\s\S]*?)(?=\/\/ === |$)/g, name: "package.json", type: "json" },
          { pattern: /\/\/ === app\/layout\.tsx ===([\s\S]*?)(?=\/\/ === |$)/g, name: "app/layout.tsx", type: "tsx" },
          { pattern: /\/\/ === app\/page\.tsx ===([\s\S]*?)(?=\/\/ === |$)/g, name: "app/page.tsx", type: "tsx" },
          { pattern: /\/\/ === app\/globals\.css ===([\s\S]*?)(?=\/\/ === |$)/g, name: "app/globals.css", type: "css" },
          {
            pattern: /\/\/ === components\/game\.tsx ===([\s\S]*?)(?=\/\/ === |$)/g,
            name: "components/game.tsx",
            type: "tsx",
          },
          {
            pattern: /\/\/ === lib\/babylon-engine\.ts ===([\s\S]*?)(?=\/\/ === |$)/g,
            name: "lib/babylon-engine.ts",
            type: "ts",
          },
          {
            pattern: /\/\/ === lib\/game-manager\.ts ===([\s\S]*?)(?=\/\/ === |$)/g,
            name: "lib/game-manager.ts",
            type: "ts",
          },
          {
            pattern: /\/\/ === lib\/input-manager\.ts ===([\s\S]*?)(?=\/\/ === |$)/g,
            name: "lib/input-manager.ts",
            type: "ts",
          },
          {
            pattern: /\/\/ === lib\/audio-manager\.ts ===([\s\S]*?)(?=\/\/ === |$)/g,
            name: "lib/audio-manager.ts",
            type: "ts",
          },
          { pattern: /\/\/ === lib\/utils\.ts ===([\s\S]*?)(?=\/\/ === |$)/g, name: "lib/utils.ts", type: "ts" },
          { pattern: /\/\/ === types\/game\.ts ===([\s\S]*?)(?=\/\/ === |$)/g, name: "types/game.ts", type: "ts" },
        ]
      : [
          { pattern: /\/\/ === package\.json ===([\s\S]*?)(?=\/\/ === |$)/g, name: "package.json", type: "json" },
          { pattern: /\/\/ === app\/layout\.tsx ===([\s\S]*?)(?=\/\/ === |$)/g, name: "app/layout.tsx", type: "tsx" },
          { pattern: /\/\/ === app\/page\.tsx ===([\s\S]*?)(?=\/\/ === |$)/g, name: "app/page.tsx", type: "tsx" },
          { pattern: /\/\/ === app\/globals\.css ===([\s\S]*?)(?=\/\/ === |$)/g, name: "app/globals.css", type: "css" },
          {
            pattern: /\/\/ === components\/game\.tsx ===([\s\S]*?)(?=\/\/ === |$)/g,
            name: "components/game.tsx",
            type: "tsx",
          },
          {
            pattern: /\/\/ === lib\/phaser-config\.ts ===([\s\S]*?)(?=\/\/ === |$)/g,
            name: "lib/phaser-config.ts",
            type: "ts",
          },
          {
            pattern: /\/\/ === lib\/scenes\/main-scene\.ts ===([\s\S]*?)(?=\/\/ === |$)/g,
            name: "lib/scenes/main-scene.ts",
            type: "ts",
          },
          {
            pattern: /\/\/ === lib\/game-objects\/player\.ts ===([\s\S]*?)(?=\/\/ === |$)/g,
            name: "lib/game-objects/player.ts",
            type: "ts",
          },
          {
            pattern: /\/\/ === lib\/managers\/audio-manager\.ts ===([\s\S]*?)(?=\/\/ === |$)/g,
            name: "lib/managers/audio-manager.ts",
            type: "ts",
          },
          { pattern: /\/\/ === lib\/utils\.ts ===([\s\S]*?)(?=\/\/ === |$)/g, name: "lib/utils.ts", type: "ts" },
          { pattern: /\/\/ === types\/game\.ts ===([\s\S]*?)(?=\/\/ === |$)/g, name: "types/game.ts", type: "ts" },
        ]

  // Parse files using separators
  fileSeparators.forEach(({ pattern, name, type }) => {
    const matches = [...generatedCode.matchAll(pattern)]
    if (matches.length > 0) {
      let content = matches[0][1].trim()
      content = cleanupGeneratedCode(content, name)
      if (content) {
        files.push({ name, content, type })
        console.log(chalk.green(`✅ Found and cleaned ${name} (${content.length} chars)`))
      }
    } else {
      missingFiles.push(name)
    }
  })

  // Check for missing required files (remove duplicates)
  const uniqueMissingFiles = [...new Set(missingFiles)]
  requiredFiles.forEach((fileName) => {
    if (!files.find((f) => f.name === fileName) && !uniqueMissingFiles.includes(fileName)) {
      uniqueMissingFiles.push(fileName)
    }
  })

  const validationResult = {
    files,
    missingFiles: uniqueMissingFiles,
    isComplete: uniqueMissingFiles.length === 0,
    totalFiles: files.length,
    requiredFiles: requiredFiles.length,
    gameType,
  }

  console.log(chalk.green(`Parsed and cleaned ${files.length}/${requiredFiles.length} ${gameType} files`))
  if (uniqueMissingFiles.length > 0) {
    console.log(chalk.red(`Missing files: ${uniqueMissingFiles.join(", ")}`))
  }

  return validationResult
}

// Function to clean up generated code
function cleanupGeneratedCode(content, fileName) {
  // Remove markdown code blocks
  content = content.replace(/```javascript\s*/g, "")
  content = content.replace(/```html\s*/g, "")
  content = content.replace(/```\s*/g, "")

  // Remove generation comments
  content = content.replace(/\/\/ Generated by.*?\n/g, "")
  content = content.replace(/\/\* Generated by.*?\*\//g, "")
  content = content.replace(/<!-- Generated by.*?-->/g, "")

  // Remove AI chain comments
  content = content.replace(/\/\/ Enhanced Chain V2.*?\n/g, "")
  content = content.replace(/\/\/ Chat ID:.*?\n/g, "")

  // Remove extra whitespace and normalize
  content = content.replace(/\n\s*\n\s*\n/g, "\n\n")
  content = content.trim()

  return content
}

// Update the createCompleteNextJSStructure function to use the new modular structure

// Create complete file structure with templates
async function createCompleteNextJSStructure(existingFiles, missingFiles, gamePrompt, gameType = "phaser") {
  const completeFiles = [...existingFiles]
  const gameName =
    gamePrompt
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .trim() || "game"

  // Add configuration files from templates
  const configFiles = await generateConfigFiles(gameName, gameType)
  completeFiles.push(...configFiles)

  // Load component templates
  const gameTemplate = await loadTemplate("components/game.tsx")
  const gameEngineTemplate = await loadTemplate("components/game/game-engine.tsx")
  const gameLogicTemplate = await loadTemplate("components/game/game-logic.tsx")
  const gameUITemplate = await loadTemplate("components/game/game-ui.tsx")
  const gameControlsTemplate = await loadTemplate("components/game/game-controls.tsx")
  const gameTypesTemplate = await loadTemplate("types/game.ts")

  const baseTemplates = {
    "package.json": JSON.stringify(
      {
        name: gameName,
        version: "0.1.0",
        private: true,
        scripts: {
          build: "next build",
          dev: "next dev",
          lint: "next lint",
          start: "next start",
        },
        dependencies: {
          "@radix-ui/react-dialog": "1.1.4",
          "@radix-ui/react-toast": "1.2.4",
          clsx: "^2.1.1",
          "lucide-react": "^0.454.0",
          next: "15.2.4",
          react: "^19.0.0",
          "react-dom": "^19.0.0",
          "tailwind-merge": "^2.5.5",
          "tailwindcss-animate": "^1.0.7",
          ...(gameType === "babylon"
            ? {
                "@babylonjs/core": "^7.0.0",
                "@babylonjs/gui": "^7.0.0",
                "@babylonjs/loaders": "^7.0.0",
              }
            : {
                phaser: "^3.80.0",
              }),
        },
        devDependencies: {
          "@types/node": "^22",
          "@types/react": "^19",
          "@types/react-dom": "^19",
          autoprefixer: "^10.4.20",
          postcss: "^8.5",
          tailwindcss: "^4.1.9",
          typescript: "^5",
        },
      },
      null,
      2,
    ),

    "app/layout.tsx": `import type { Metadata } from "next";
import { Inter } from 'next/font/google';
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "${gameName.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}",
  description: "A ${gameType === "babylon" ? "3D" : "2D"} web game built with Next.js, TypeScript, and ${gameType === "babylon" ? "Babylon.js" : "Phaser"}",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}`,

    "app/page.tsx": `import Game from "@/components/game";

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-900">
      <Game />
    </main>
  );
}`,

    "app/globals.css": `@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 222.2 84% 4.9%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;
    --primary: 210 40% 98%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 212.7 26.8% 83.9%;
  }
}

* {
  border-color: hsl(var(--border));
}

body {
  color: hsl(var(--foreground));
  background: hsl(var(--background));
}

canvas {
  display: block;
  margin: 0 auto;
}

/* Game-specific animations */
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

@keyframes bounce {
  0%, 20%, 53%, 80%, 100% { transform: translate3d(0,0,0); }
  40%, 43% { transform: translate3d(0,-30px,0); }
  70% { transform: translate3d(0,-15px,0); }
  90% { transform: translate3d(0,-4px,0); }
}

.game-pulse { animation: pulse 2s infinite; }
.game-bounce { animation: bounce 1s infinite; }`,

    "lib/utils.ts": `import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const gameUtils = {
  randomInt: (min: number, max: number): number => 
    Math.floor(Math.random() * (max - min + 1)) + min,
  
  clamp: (value: number, min: number, max: number): number => 
    Math.max(min, Math.min(max, value)),
  
  distance: (x1: number, y1: number, x2: number, y2: number): number => 
    Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2),
  
  distance3D: (x1: number, y1: number, z1: number, x2: number, y2: number, z2: number): number => 
    Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2 + (z2 - z1) ** 2),
  
  lerp: (start: number, end: number, factor: number): number => 
    start + (end - start) * factor,
    
  normalize: (x: number, y: number): { x: number; y: number } => {
    const length = Math.sqrt(x * x + y * y);
    return length > 0 ? { x: x / length, y: y / length } : { x: 0, y: 0 };
  },
  
  radToDeg: (radians: number): number => radians * (180 / Math.PI),
  degToRad: (degrees: number): number => degrees * (Math.PI / 180),
  
  formatScore: (score: number): string => score.toLocaleString(),
  
  formatTime: (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return \`\${mins}:\${secs.toString().padStart(2, '0')}\`;
  }
};`,

    // Add modular component templates
    "components/game.tsx": gameTemplate || `// Fallback game component`,
    "components/game/game-engine.tsx": gameEngineTemplate || `// Fallback game engine`,
    "components/game/game-logic.tsx": gameLogicTemplate || `// Fallback game logic`,
    "components/game/game-ui.tsx": gameUITemplate || `// Fallback game UI`,
    "components/game/game-controls.tsx": gameControlsTemplate || `// Fallback game controls`,
    "types/game.ts": gameTypesTemplate || `// Fallback game types`,
  }

  // Add missing files using templates
  missingFiles.forEach((fileName) => {
    if (baseTemplates[fileName]) {
      completeFiles.push({
        name: fileName,
        content: baseTemplates[fileName],
        type: fileName.split(".").pop() || "txt",
      })
      console.log(chalk.yellow(`🔧 Auto-generated ${fileName}`))
    }
  })

  return completeFiles
}

// API Routes remain the same...
app.post("/api/generate/full", async (req, res) => {
  const chatId = chatCounter++

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Cache-Control",
  })

  const sendEvent = (event, data) => {
    res.write(`event: ${event}\n`)
    res.write(`data: ${JSON.stringify({ ...data, timestamp: new Date().toISOString() })}\n\n`)
  }

  try {
    const { prompt } = req.body

    if (!prompt || !prompt.trim()) {
      sendEvent("error", {
        error: "Game description is required",
        chatId,
      })
      res.end()
      return
    }

    console.log(chalk.blue(`Starting FULL chain generation for Chat ${chatId}`))
    console.log(chalk.blue(`Game Request: ${prompt}`))

    sendEvent("progress", {
      step: 0,
      totalSteps: 4,
      stepName: "Initialization",
      progress: 0,
      message: "Starting full AI chain (Groq → Qwen3 → Anthropic → Qwen3)...",
    })

    const groqExplanation = await llmProvider.getGameExplanation(prompt, chatId)
    sendEvent("step_complete", {
      step: 1,
      stepName: "Groq Architecture",
      output: `Game architecture explanation completed (${groqExplanation.length} characters)`,
    })

    const qwenInitialCode = await llmProvider.generateCleanCodeWithQwen(groqExplanation, prompt, chatId)
    sendEvent("step_complete", {
      step: 2,
      stepName: "Qwen3 Initial Code",
      output: `Initial code generation completed (${qwenInitialCode.length} characters)`,
    })

    const anthropicFeedback = await llmProvider.validateWithAnthropic(qwenInitialCode, prompt, chatId)
    sendEvent("step_complete", {
      step: 3,
      stepName: "Anthropic Validation",
      output: `Code validation completed with detailed feedback (${anthropicFeedback.length} characters)`,
    })

    const qwenFinalCode = await llmProvider.generateFinalCodeWithQwen(
      anthropicFeedback,
      qwenInitialCode,
      prompt,
      chatId,
    )
    sendEvent("step_complete", {
      step: 4,
      stepName: "Qwen3 Final Fixes",
      output: `Final code generation completed (${qwenFinalCode.length} characters)`,
    })

    const gameType = "phaser"
    const validationResult = validateAndParseNextJSFiles(qwenFinalCode, chatId, gameType)
    const completeFiles = await createCompleteNextJSStructure(
      validationResult.files,
      validationResult.missingFiles,
      prompt,
      gameType,
    )

    completeFiles.forEach((file, index) => {
      sendEvent("file_generated", {
        fileName: file.name,
        fileType: file.type,
        content: file.content,
        size: file.content.length,
        index: index + 1,
        totalFiles: completeFiles.length,
      })
    })

    const projectId = uuidv4()
    const projectPath = await saveGeneratedFiles(projectId, completeFiles)
    const serverInfo = await setupAndRunProject(projectPath)

    sendEvent("complete", {
      chatId,
      projectId,
      totalFiles: completeFiles.length,
      aiGeneratedFiles: validationResult.files.length,
      missingFilesGenerated: validationResult.missingFiles.length,
      chainUsed: "full",
      chainSteps: [
        "Groq - Game explanation and architecture",
        "Qwen3 - Initial complete code generation",
        "Anthropic - Code validation and feedback",
        "Qwen3 - Final code fixes and improvements",
      ],
      setupInstructions: {
        npmInstall: "npm install",
        startCommand: "npm run dev",
        url: serverInfo.url,
        liveUrl: serverInfo.url,
        port: serverInfo.port,
        projectPath: `${PROJECTS_DIR}/${projectId}`,
        deploymentType: "localhost",
        subdomain: null,
      },
      validation: {
        isComplete: validationResult.isComplete,
        totalFiles: completeFiles.length,
        originalFiles: validationResult.files.length,
        missingFiles: validationResult.missingFiles,
      },
    })

    console.log(chalk.green(`FULL chain completed for Chat ${chatId}!`))
    console.log(chalk.green(`🎮 Game is running at: ${serverInfo.url}`))
  } catch (error) {
    console.error(chalk.red(`Error in Full Chain Chat ${chatId}:`, error.message))
    sendEvent("error", {
      error: "Failed to generate web game",
      details: error.message,
      chatId,
    })
  }

  res.end()
})

app.post("/api/generate/simple", async (req, res) => {
  const chatId = chatCounter++

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Cache-Control",
  })

  const sendEvent = (event, data) => {
    res.write(`event: ${event}\n`)
    res.write(`data: ${JSON.stringify({ ...data, timestamp: new Date().toISOString() })}\n\n`)
  }

  try {
    const { prompt, subdomain } = req.body
    const nginxEnabled = process.env.NGINX_ENABLED === "true"

    if (!prompt || !prompt.trim()) {
      sendEvent("error", {
        error: "Game description is required",
        chatId,
      })
      res.end()
      return
    }

    console.log(chalk.blue(`Starting SIMPLE chain generation for Chat ${chatId}`))
    console.log(chalk.blue(`Game Request: ${prompt}`))

    const groqExplanation = await llmProvider.getGameExplanation(prompt, chatId)
    const qwenFinalCode = await llmProvider.generateCleanCodeWithQwen(groqExplanation, prompt, chatId)

    const gameType = subdomain && subdomain.includes("babylon") ? "babylon" : "phaser"
    const validationResult = validateAndParseNextJSFiles(qwenFinalCode, chatId, gameType)
    const completeFiles = await createCompleteNextJSStructure(
      validationResult.files,
      validationResult.missingFiles,
      prompt,
      gameType,
    )

    completeFiles.forEach((file, index) => {
      sendEvent("file_generated", {
        fileName: file.name,
        fileType: file.type,
        content: file.content,
        size: file.content.length,
        index: index + 1,
        totalFiles: completeFiles.length,
      })
    })

    const projectId = uuidv4()

    if (nginxEnabled && subdomain) {
      // Deploy to nginx (implementation would go here)
      sendEvent("complete", {
        chatId,
        projectId: subdomain,
        totalFiles: completeFiles.length,
        chainUsed: "simple",
        deploymentType: "nginx",
      })
    } else {
      const projectPath = await saveGeneratedFiles(projectId, completeFiles)
      const serverInfo = await setupAndRunProject(projectPath)

      sendEvent("complete", {
        chatId,
        projectId,
        totalFiles: completeFiles.length,
        chainUsed: "simple",
        deploymentType: "localhost",
        setupInstructions: {
          npmInstall: "npm install",
          startCommand: "npm run dev",
          previewUrl: serverInfo.url,
          port: serverInfo.port,
          projectPath: projectPath,
        },
      })

      console.log(chalk.green(`SIMPLE chain completed for Chat ${chatId}!`))
      console.log(chalk.green(`🎮 Game is running at: ${serverInfo.url}`))
    }
  } catch (error) {
    console.error(chalk.red(`Error in Simple Chain Chat ${chatId}:`, error.message))
    sendEvent("error", {
      error: "Failed to generate web game",
      details: error.message,
      chatId,
    })
  }

  res.end()
})

// ============================================================================
// START THE SERVER
// ============================================================================

app.listen(PORT, () => {
  console.log(chalk.green(`✅ Server is running on http://localhost:${PORT}`))
  console.log(chalk.blue(`📖 API Docs available at http://localhost:${PORT}/api-docs`))
  console.log(chalk.cyan(`📁 Templates directory: ${TEMPLATES_DIR}`))
})
