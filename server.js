import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import fs from "fs-extra"
import chalk from "chalk"
import { v4 as uuidv4 } from "uuid"
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
const RESPONSE_LOG_DIR = path.join(__dirname, "response-logs")

app.use(cors())
app.use(express.json())
app.use(express.static("public"))

const PROJECTS_DIR = "generated-projects"
const CHAT_HISTORY_DIR = "chat-history"

await fs.ensureDir(PROJECTS_DIR)
await fs.ensureDir(CHAT_HISTORY_DIR)
await fs.ensureDir(TEMPLATES_DIR)
await fs.ensureDir(RESPONSE_LOG_DIR)

let chatCounter = 1
const conversationContexts = new Map()

// Initialize traced LLM provider
const llmProvider = new TracedLLMProvider()

// ============================================================================
// RESPONSE LOGGING FUNCTIONS
// ============================================================================

async function logLLMResponse(chatId, step, provider, prompt, response, metadata = {}) {
  try {
    const timestamp = new Date().toISOString()
    const logEntry = {
      chatId,
      step,
      provider,
      timestamp,
      prompt: prompt.slice(0, 1000) + (prompt.length > 1000 ? "..." : ""),
      response,
      responseLength: response.length,
      metadata,
    }

    const logFileName = `chat-${chatId}-${step}-${provider}-${timestamp.replace(/[:.]/g, "-")}.json`
    const logPath = path.join(RESPONSE_LOG_DIR, logFileName)

    await fs.writeFile(logPath, JSON.stringify(logEntry, null, 2))
    console.log(chalk.blue(`📝 Logged ${provider} response to ${logFileName}`))
  } catch (error) {
    console.error(chalk.red(`Failed to log LLM response:`, error.message))
  }
}

async function logCompleteChain(chatId, chainData) {
  try {
    const timestamp = new Date().toISOString()
    const logEntry = {
      chatId,
      timestamp,
      chainType: chainData.chainUsed || "unknown",
      ...chainData,
    }

    const logFileName = `complete-chain-${chatId}-${timestamp.replace(/[:.]/g, "-")}.json`
    const logPath = path.join(RESPONSE_LOG_DIR, logFileName)

    await fs.writeFile(logPath, JSON.stringify(logEntry, null, 2))
    console.log(chalk.green(`📋 Logged complete chain to ${logFileName}`))
  } catch (error) {
    console.error(chalk.red(`Failed to log complete chain:`, error.message))
  }
}

// ============================================================================
// ENHANCED SVG AND ASSET EXTRACTION
// ============================================================================

function extractAdvancedAssets(generatedCode) {
  const assets = []

  // Extract SVG assets
  const svgPattern = /\/\/ === public\/assets\/([^=]+\.svg) ===([\s\S]*?)(?=\/\/ === |$)/g
  let match
  while ((match = svgPattern.exec(generatedCode)) !== null) {
    const fileName = match[1].trim()
    let svgContent = match[2].trim()

    // Clean up SVG content
    svgContent = svgContent.replace(/```svg\s*/g, "")
    svgContent = svgContent.replace(/```\s*/g, "")
    svgContent = svgContent.trim()

    if (svgContent && svgContent.includes("<svg")) {
      assets.push({
        name: `public/assets/${fileName}`,
        content: svgContent,
        type: "svg",
        source: "llm-generated",
        category: "graphics",
      })
      console.log(chalk.green(`🎨 Extracted SVG asset: ${fileName}`))
    }
  }

  // Extract audio specifications
  const audioPattern = /\/\/ === AUDIO SPECIFICATIONS ===([\s\S]*?)(?=\/\/ === |$)/g
  const audioMatch = audioPattern.exec(generatedCode)
  if (audioMatch) {
    assets.push({
      name: "audio-specifications.json",
      content: audioMatch[1].trim(),
      type: "json",
      source: "llm-generated",
      category: "audio",
    })
    console.log(chalk.green(`🎵 Extracted audio specifications`))
  }

  // Extract asset manifest
  const manifestPattern = /\/\/ === ASSET MANIFEST ===([\s\S]*?)(?=\/\/ === |$)/g
  const manifestMatch = manifestPattern.exec(generatedCode)
  if (manifestMatch) {
    assets.push({
      name: "asset-manifest.json",
      content: manifestMatch[1].trim(),
      type: "json",
      source: "llm-generated",
      category: "manifest",
    })
    console.log(chalk.green(`📋 Extracted asset manifest`))
  }

  return assets
}

// ============================================================================
// TEMPLATE LOADING FUNCTIONS (UNCHANGED)
// ============================================================================

// Load template files from the templates directory
async function loadTemplate(templateName) {
  try {
    const templatePath = path.join(TEMPLATES_DIR, templateName)
    const exists = await fs.pathExists(templatePath)

    if (!exists) {
      console.warn(chalk.yellow(`⚠️  Template ${templateName} not found at ${templatePath}`))
      return null
    }

    const content = await fs.readFile(templatePath, "utf8")
    console.log(chalk.green(`✅ Loaded template ${templateName} (${content.length} chars)`))
    return content
  } catch (error) {
    console.warn(chalk.yellow(`⚠️  Failed to load template ${templateName}:`, error.message))
    return null
  }
}

// Generate configuration files from templates
async function generateConfigFiles(gameName, gameType) {
  const configFiles = []

  // Load templates with proper error handling - only existing ones
  const templates = {
    "next.config.mjs": await loadTemplate("next.config.mjs"),
    "tailwind.config.ts": await loadTemplate("tailwind.config.ts"),
    "tsconfig.json": await loadTemplate("tsconfig.json"),
    "components.json": await loadTemplate("components.json"),
    "postcss.config.mjs": await loadTemplate("postcss.config.mjs"),
    ".gitignore": await loadTemplate(".gitignore"),
    "README.md": await loadTemplate("readme.md"),
  }

  // Process each template
  Object.entries(templates).forEach(([fileName, content]) => {
    if (content) {
      let processedContent = content

      // Process README.md with replacements
      if (fileName === "README.md") {
        const gameDisplayName = gameName.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
        const gameEngine = gameType === "babylon" ? "Babylon.js" : "Canvas API"

        processedContent = content.replace(/\{GAME_NAME\}/g, gameDisplayName).replace(/\{GAME_ENGINE\}/g, gameEngine)
      }

      configFiles.push({
        name: fileName,
        content: processedContent,
        type: fileName.split(".").pop() || "txt",
        source: "template",
      })

      console.log(chalk.green(`✅ Added config file ${fileName} from template`))
    } else {
      console.warn(chalk.yellow(`⚠️  Skipping ${fileName} - template not found`))
    }
  })

  return configFiles
}

// ============================================================================
// UTILITY FUNCTIONS (UNCHANGED)
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
    console.log(chalk.green(`✅ Saved ${file.name} to ${filePath} (${file.content.length} chars)`))
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

// ============================================================================
// FIXED FILE VALIDATION AND PARSING
// ============================================================================

function validateAndParseNextJSFiles(generatedCode, chatId, gameType = "canvas", difficulty = "medium") {
  console.log(chalk.cyan(`🔍 Validating ${difficulty.toUpperCase()} ${gameType} Next.js files...`))
  console.log(chalk.blue(`📄 Generated code length: ${generatedCode.length} characters`))

  if (!generatedCode || typeof generatedCode !== "string") {
    console.log(chalk.red("❌ No generated code provided!"))
    return {
      files: [],
      missingFiles: [
        "package.json",
        "app/layout.tsx",
        "app/page.tsx",
        "app/globals.css",
        "lib/utils.ts",
        "types/game.ts",
      ],
      isComplete: false,
      totalFiles: 0,
      requiredFiles: 6,
      advancedAssets: 0,
      gameType,
      difficulty,
    }
  }

  const files = []
  const missingFiles = []

  const requiredFiles = ["app/page.tsx"]

  // ENHANCED FILE SEPARATORS - More flexible patterns
  const fileSeparators = [
    {
      patterns: [
        /\/\/ === app\/page\.tsx ===([\s\S]*?)(?=\/\/ === |$)/g,
        /\/\/ app\/page\.tsx([\s\S]*?)(?=\/\/ === |\/\/ [a-zA-Z]|$)/g,
        /export default function.*?\{([\s\S]*)/g, // Catch any React component
      ],
      name: "app/page.tsx",
      type: "tsx",
    },
  ]

  // Parse files using multiple patterns
  fileSeparators.forEach(({ patterns, name, type }) => {
    let found = false

    for (const pattern of patterns) {
      const matches = [...generatedCode.matchAll(pattern)]
      if (matches.length > 0) {
        let content = matches[0][1].trim()
        content = cleanupGeneratedCode(content, name)
        if (content && content.length > 10) {
          // Ensure meaningful content
          files.push({ name, content, type })
          console.log(chalk.green(`✅ Found and cleaned ${name} (${content.length} chars)`))
          found = true
          break
        }
      }
    }

    if (!found) {
      missingFiles.push(name)
      console.log(chalk.red(`❌ Missing: ${name}`))
    }
  })

  // Extract advanced assets
  const advancedAssets = extractAdvancedAssets(generatedCode)
  files.push(...advancedAssets)

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
    advancedAssets: advancedAssets.length,
    gameType,
    difficulty,
  }

  console.log(chalk.green(`✅ Parsed ${files.length}/${requiredFiles.length} ${difficulty.toUpperCase()} files`))
  console.log(chalk.green(`🎨 Extracted ${advancedAssets.length} advanced assets`))
  if (uniqueMissingFiles.length > 0) {
    console.log(chalk.red(`❌ Missing files: ${uniqueMissingFiles.join(", ")}`))
  }

  return validationResult
}

// Function to clean up generated code (enhanced)
function cleanupGeneratedCode(content, fileName) {
  console.log(chalk.blue(`🧹 Cleaning ${fileName} (${content.length} chars before cleanup)`))

  // Remove markdown code blocks
  content = content.replace(/```javascript\s*/g, "")
  content = content.replace(/```typescript\s*/g, "")
  content = content.replace(/```tsx\s*/g, "")
  content = content.replace(/```html\s*/g, "")
  content = content.replace(/```css\s*/g, "")
  content = content.replace(/```json\s*/g, "")
  content = content.replace(/```\s*/g, "")

  // Remove generation comments
  content = content.replace(/\/\/ Generated by.*?\n/g, "")
  content = content.replace(/\/\* Generated by.*?\*\//g, "")
  content = content.replace(/<!-- Generated by.*?-->/g, "")

  // Remove AI chain comments
  content = content.replace(/\/\/ Enhanced Chain.*?\n/g, "")
  content = content.replace(/\/\/ Chat ID:.*?\n/g, "")

  // CSS-specific cleanup - Remove any non-CSS text
  if (fileName.endsWith(".css")) {
    // Remove any text that doesn't look like CSS
    const lines = content.split("\n")
    const cleanLines = lines.filter((line) => {
      const trimmed = line.trim()
      // Keep empty lines, CSS rules, comments, and @-rules
      return (
        !trimmed ||
        trimmed.startsWith("/*") ||
        trimmed.endsWith("*/") ||
        trimmed.includes("/*") ||
        trimmed.startsWith("@") ||
        trimmed.includes(":") ||
        trimmed.includes("{") ||
        trimmed.includes("}") ||
        trimmed.startsWith(".") ||
        trimmed.startsWith("#") ||
        /^[a-zA-Z-]+\s*{/.test(trimmed) ||
        /^[a-zA-Z-]+\s*:/.test(trimmed)
      )
    })
    content = cleanLines.join("\n")
  }

  // Remove extra whitespace and normalize
  content = content.replace(/\n\s*\n\s*\n/g, "\n\n")
  content = content.trim()

  // Add import validation
  const validateImports = (content, fileName) => {
    const emptyImports = content.match(/import\s+.*from\s+['"]\s*['"];?/g)
    if (emptyImports) {
      console.warn(chalk.yellow(`⚠️  Found empty imports in ${fileName}: ${emptyImports.join(", ")}`))
      // Fix empty imports
      content = content.replace(/import\s+.*from\s+['"]\s*['"];?/g, "")
    }

    const incompleteImports = content.match(/import\s+.*from\s+['"][^'"]*\/\s*['"];?/g)
    if (incompleteImports) {
      console.warn(chalk.yellow(`⚠️  Found incomplete imports in ${fileName}: ${incompleteImports.join(", ")}`))
    }

    return content
  }

  // Apply import validation
  content = validateImports(content, fileName)

  // Fix corrupted utils.ts files
  if (fileName === "lib/utils.ts") {
    // Remove any stray 'ts' at the beginning
    content = content.replace(/^ts\s*\n?/g, "")

    // Ensure proper imports are present
    if (!content.includes("import { type ClassValue, clsx }")) {
      content = `import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

${content}`
    }
  }

  console.log(chalk.green(`✅ Cleaned ${fileName} (${content.length} chars after cleanup)`))
  return content
}

// ============================================================================
// ENHANCED FILE STRUCTURE CREATION WITH FALLBACKS
// ============================================================================

async function createCompleteNextJSStructure(
  existingFiles,
  missingFiles,
  gamePrompt,
  gameType = "canvas",
  difficulty = "medium",
) {
  const completeFiles = [...existingFiles]
  const gameName =
    gamePrompt
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .trim() || "game"

  console.log(chalk.cyan(`🏗️  Building ${difficulty.toUpperCase()} Next.js structure for ${gameName}...`))

  // Add configuration files from templates FIRST
  const configFiles = await generateConfigFiles(gameName, gameType)
  completeFiles.push(...configFiles)

  // ALWAYS add UI components - they are REQUIRED
  const uiComponents = [
    {
      name: "components/ui/button.tsx",
      content:
        (await loadTemplate("components/ui/button.tsx")) ||
        `import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../../lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
  },
)
Button.displayName = "Button"

export { Button, buttonVariants }`,
      type: "tsx",
      source: "ui-component-required",
    },
    {
      name: "components/ui/card.tsx",
      content:
        (await loadTemplate("components/ui/card.tsx")) ||
        `import * as React from "react"
import { cn } from "../../lib/utils"

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("rounded-lg border bg-card text-card-foreground shadow-sm", className)} {...props} />
))
Card.displayName = "Card"

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
  ),
)
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("text-2xl font-semibold leading-none tracking-tight", className)} {...props} />
  ),
)
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
  ),
)
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />,
)
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center p-6 pt-0", className)} {...props} />
  ),
)
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }`,
      type: "tsx",
      source: "ui-component-required",
    },
  ]

  // Add UI components to completeFiles FIRST - before any other processing
  completeFiles.push(...uiComponents)
  console.log(chalk.green(`✅ Added ${uiComponents.length} required UI components (GUARANTEED)`))

  // Enhanced base templates for different difficulty levels
  const getDifficultyEnhancedPackageJson = (gameName, difficulty) => {
    const baseDependencies = {
      "@hookform/resolvers": "^3.10.0",
      "@radix-ui/react-accordion": "1.2.2",
      "@radix-ui/react-alert-dialog": "1.1.4",
      "@radix-ui/react-aspect-ratio": "1.1.1",
      "@radix-ui/react-avatar": "1.1.2",
      "@radix-ui/react-checkbox": "1.1.3",
      "@radix-ui/react-collapsible": "1.1.2",
      "@radix-ui/react-context-menu": "2.2.4",
      "@radix-ui/react-dialog": "1.1.4",
      "@radix-ui/react-dropdown-menu": "2.1.4",
      "@radix-ui/react-hover-card": "1.1.4",
      "@radix-ui/react-label": "2.1.1",
      "@radix-ui/react-menubar": "1.1.4",
      "@radix-ui/react-navigation-menu": "1.2.3",
      "@radix-ui/react-popover": "1.1.4",
      "@radix-ui/react-progress": "1.1.1",
      "@radix-ui/react-radio-group": "1.2.2",
      "@radix-ui/react-scroll-area": "1.2.2",
      "@radix-ui/react-select": "2.1.4",
      "@radix-ui/react-separator": "1.1.1",
      "@radix-ui/react-slider": "1.2.2",
      "@radix-ui/react-slot": "1.1.1",
      "@radix-ui/react-switch": "1.1.2",
      "@radix-ui/react-tabs": "1.1.2",
      "@radix-ui/react-toast": "1.2.4",
      "@radix-ui/react-toggle": "1.1.1",
      "@radix-ui/react-toggle-group": "1.1.1",
      "@radix-ui/react-tooltip": "1.1.6",
      autoprefixer: "^10.4.20",
      "class-variance-authority": "^0.7.1",
      clsx: "^2.1.1",
      cmdk: "1.0.4",
      "date-fns": "4.1.0",
      "embla-carousel-react": "8.5.1",
      geist: "^1.3.1",
      "input-otp": "1.4.1",
      "lucide-react": "^0.454.0",
      next: "15.2.4",
      "next-themes": "^0.4.6",
      react: "^19.0.0",
      "react-dom": "^19.0.0",
      "react-hook-form": "^7.60.0",
      "react-resizable-panels": "^2.1.7",
      recharts: "2.15.4",
      sonner: "^1.7.4",
      "tailwind-merge": "^2.5.5",
      "tailwindcss-animate": "^1.0.7",
      vaul: "^0.9.9",
      zod: "3.25.67",
    }

    // Add difficulty-specific dependencies
    if (difficulty === "medium" || difficulty === "hard") {
      baseDependencies["framer-motion"] = "^11.0.0"
      baseDependencies["use-sound"] = "^4.0.1"
    }

    if (difficulty === "hard") {
      baseDependencies["three"] = "^0.160.0"
      baseDependencies["@react-three/fiber"] = "^8.15.0"
      baseDependencies["@react-three/drei"] = "^9.95.0"
    }

    return JSON.stringify(
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
        dependencies: baseDependencies,
        devDependencies: {
          "@types/node": "^22",
          "@types/react": "^19",
          "@types/react-dom": "^19",
          postcss: "^8.5",
          tailwindcss: "^3.4.0",
          typescript: "^5",
        },
      },
      null,
      2,
    )
  }

  // ENHANCED FALLBACK TEMPLATES - GUARANTEED TO WORK
  const baseTemplates = {
    "package.json": getDifficultyEnhancedPackageJson(gameName, difficulty),
    "app/layout.tsx": `import type React from "react"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import "./globals.css"

export const metadata: Metadata = {
  title: "${gameName.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}",
  description: "A fun game built with Next.js",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={GeistSans.variable}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  )
}`,
    "app/page.tsx": `"use client"

import { useRef, useState, useEffect, useCallback } from "react"
import { Button } from "../components/ui/button"
import { Card, CardContent } from "../components/ui/card"
import { Play, Pause, RotateCcw, Home, Volume2, VolumeX } from 'lucide-react'

// ============================================================================
// EMBEDDED GAME ASSETS - ALL INLINE
// ============================================================================

const GAME_ASSETS = {
  // Player spaceship SVG
  player: \`<svg width="40" height="30" viewBox="0 0 40 30" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="playerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#00ffff;stop-opacity:1" />
        <stop offset="100%" style="stop-color:#0080ff;stop-opacity:1" />
      </linearGradient>
    </defs>
    <polygon points="20,0 40,30 30,25 20,20 10,25 0,30" fill="url(#playerGrad)" stroke="#ffffff" stroke-width="1"/>
    <circle cx="15" cy="20" r="2" fill="#ff0000"/>
    <circle cx="25" cy="20" r="2" fill="#ff0000"/>
  </svg>\`,

  // Enemy spaceship SVG
  enemy: \`<svg width="30" height="25" viewBox="0 0 30 25" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="enemyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#ff4444;stop-opacity:1" />
        <stop offset="100%" style="stop-color:#aa0000;stop-opacity:1" />
      </linearGradient>
    </defs>
    <polygon points="15,25 0,0 10,5 15,10 20,5 30,0" fill="url(#enemyGrad)" stroke="#ffffff" stroke-width="1"/>
    <circle cx="10" cy="8" r="1.5" fill="#ffff00"/>
    <circle cx="20" cy="8" r="1.5" fill="#ffff00"/>
  </svg>\`,

  // Bullet SVG
  bullet: \`<svg width="4" height="10" viewBox="0 0 4 10" xmlns="http://www.w3.org/2000/svg">
    <rect x="1" y="0" width="2" height="10" fill="#ffff00" rx="1"/>
    <circle cx="2" cy="2" r="1" fill="#ffffff"/>
  </svg>\`,

  // Power-up SVG
  powerup: \`<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="powerGrad" cx="50%" cy="50%" r="50%">
        <stop offset="0%" style="stop-color:#00ff00;stop-opacity:1" />
        <stop offset="100%" style="stop-color:#008800;stop-opacity:1" />
      </radialGradient>
    </defs>
    <circle cx="10" cy="10" r="8" fill="url(#powerGrad)" stroke="#ffffff" stroke-width="2"/>
    <text x="10" y="14" text-anchor="middle" fill="#ffffff" font-size="12" font-weight="bold">P</text>
  </svg>\`,

  // Explosion particles
  particle: \`<svg width="6" height="6" viewBox="0 0 6 6" xmlns="http://www.w3.org/2000/svg">
    <circle cx="3" cy="3" r="2" fill="#ff8800"/>
    <circle cx="3" cy="3" r="1" fill="#ffff00"/>
  </svg>\`,

  // Background stars
  star: \`<svg width="2" height="2" viewBox="0 0 2 2" xmlns="http://www.w3.org/2000/svg">
    <circle cx="1" cy="1" r="1" fill="#ffffff"/>
  </svg>\`,

  // Sound effects as data URLs (simplified beep sounds)
  sounds: {
    shoot: "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT",
    explosion: "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT",
    powerup: "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT"
  }
}

// ============================================================================
// GAME TYPES AND INTERFACES
// ============================================================================

type GamePhase = "menu" | "playing" | "paused" | "gameOver" | "levelComplete"
type DifficultyLevel = "easy" | "medium" | "hard"

interface GameState {
  score: number
  highScore: number
  lives: number
  level: number
  difficulty: DifficultyLevel
  gameOver: boolean
  paused: boolean
  time: number
  enemiesKilled: number
  powerUpsCollected: number
}

interface GameObject {
  id: string
  x: number
  y: number
  width: number
  height: number
  vx: number
  vy: number
  active: boolean
  type: string
  health?: number
  damage?: number
  color?: string
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  color: string
  size: number
}

interface Star {
  x: number
  y: number
  speed: number
  size: number
  opacity: number
}

// ============================================================================
// MAIN GAME COMPONENT - EVERYTHING IN ONE PLACE
// ============================================================================

export default function SpaceShooterGame() {
  // Canvas and game refs
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameLoopRef = useRef<number>()
  const lastTimeRef = useRef<number>(0)
  const keysRef = useRef<Set<string>>(new Set())
  const audioContextRef = useRef<AudioContext | null>(null)

  // Game state management
  const [gamePhase, setGamePhase] = useState<GamePhase>("menu")
  const [gameState, setGameState] = useState<GameState>({
    score: 0,
    highScore: Number.parseInt(localStorage?.getItem("space-shooter-highscore") || "0"),
    lives: 3,
    level: 1,
    difficulty: "medium",
    gameOver: false,
    paused: false,
    time: 0,
    enemiesKilled: 0,
    powerUpsCollected: 0,
  })

  // Game settings
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [isLoading, setIsLoading] = useState(false)

  // Game objects state
  const [player, setPlayer] = useState<GameObject>({
    id: "player",
    x: 400,
    y: 500,
    width: 40,
    height: 30,
    vx: 0,
    vy: 0,
    active: true,
    type: "player",
    health: 100,
  })

  const [bullets, setBullets] = useState<GameObject[]>([])
  const [enemies, setEnemies] = useState<GameObject[]>([])
  const [powerUps, setPowerUps] = useState<GameObject[]>([])
  const [particles, setParticles] = useState<Particle[]>([])
  const [stars, setStars] = useState<Star[]>([])

  // ============================================================================
  // GAME UTILITY FUNCTIONS - ALL INLINE
  // ============================================================================

  const randomInt = (min: number, max: number): number => 
    Math.floor(Math.random() * (max - min + 1)) + min

  const randomFloat = (min: number, max: number): number => 
    Math.random() * (max - min) + min

  const clamp = (value: number, min: number, max: number): number => 
    Math.max(min, Math.min(max, value))

  const distance = (x1: number, y1: number, x2: number, y2: number): number => 
    Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)

  const checkCollision = (obj1: GameObject, obj2: GameObject): boolean => {
    return obj1.x < obj2.x + obj2.width &&
           obj1.x + obj1.width > obj2.x &&
           obj1.y < obj2.y + obj2.height &&
           obj1.y + obj1.height > obj2.y
  }

  const formatScore = (score: number): string => score.toLocaleString()

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return \`\${mins}:\${secs.toString().padStart(2, '0')}\`
  }

  // ============================================================================
  // AUDIO SYSTEM - INLINE WEB AUDIO API
  // ============================================================================

  const initAudio = useCallback(() => {
    if (!audioContextRef.current && soundEnabled) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
    }
  }, [soundEnabled])

  const playSound = useCallback((soundKey: keyof typeof GAME_ASSETS.sounds) => {
    if (!soundEnabled || !audioContextRef.current) return

    try {
      const audioData = GAME_ASSETS.sounds[soundKey]
      const audio = new Audio(audioData)
      audio.volume = 0.3
      audio.play().catch(() => {}) // Ignore errors
    } catch (error) {
      console.warn("Audio playback failed:", error)
    }
  }, [soundEnabled])

  // ============================================================================
  // GAME OBJECT CREATION FUNCTIONS
  // ============================================================================

  const createBullet = (x: number, y: number, vx: number = 0, vy: number = -8): GameObject => ({
    id: \`bullet-\${Date.now()}-\${Math.random()}\`,
    x,
    y,
    width: 4,
    height: 10,
    vx,
    vy,
    active: true,
    type: "bullet",
    damage: 25,
  })

  const createEnemy = (x: number, y: number, level: number): GameObject => {
    const difficultyMultiplier = gameState.difficulty === "easy" ? 0.7 : gameState.difficulty === "hard" ? 1.5 : 1
    return {
      id: \`enemy-\${Date.now()}-\${Math.random()}\`,
      x,
      y,
      width: 30,
      height: 25,
      vx: randomFloat(-2, 2) * difficultyMultiplier,
      vy: randomFloat(1, 3) * difficultyMultiplier,
      active: true,
      type: "enemy",
      health: 25 + (level * 10),
    }
  }

  const createPowerUp = (x: number, y: number): GameObject => ({
    id: \`powerup-\${Date.now()}-\${Math.random()}\`,
    x,
    y,
    width: 20,
    height: 20,
    vx: 0,
    vy: 2,
    active: true,
    type: "powerup",
  })

  const createParticle = (x: number, y: number, color: string = "#ff8800"): Particle => ({
    x,
    y,
    vx: randomFloat(-5, 5),
    vy: randomFloat(-5, 5),
    life: 30,
    maxLife: 30,
    color,
    size: randomFloat(2, 6),
  })

  const createStar = (canvasWidth: number, canvasHeight: number): Star => ({
    x: randomFloat(0, canvasWidth),
    y: randomFloat(0, canvasHeight),
    speed: randomFloat(0.5, 3),
    size: randomFloat(1, 3),
    opacity: randomFloat(0.3, 1),
  })

  // ============================================================================
  // GAME CONTROL FUNCTIONS
  // ============================================================================

  const startGame = useCallback((difficulty: DifficultyLevel = "medium") => {
    setGamePhase("playing")
    setGameState(prev => ({
      ...prev,
      score: 0,
      lives: difficulty === "easy" ? 5 : difficulty === "hard" ? 2 : 3,
      level: 1,
      difficulty,
      gameOver: false,
      paused: false,
      time: 0,
      enemiesKilled: 0,
      powerUpsCollected: 0,
    }))
    
    // Reset game objects
    setBullets([])
    setEnemies([])
    setPowerUps([])
    setParticles([])
    
    // Initialize stars
    const canvas = canvasRef.current
    if (canvas) {
      const newStars = Array.from({ length: 100 }, () => createStar(canvas.width, canvas.height))
      setStars(newStars)
    }
    
    initAudio()
  }, [initAudio])

  const pauseGame = useCallback(() => {
    setGamePhase("paused")
    setGameState(prev => ({ ...prev, paused: true }))
  }, [])

  const resumeGame = useCallback(() => {
    setGamePhase("playing")
    setGameState(prev => ({ ...prev, paused: false }))
  }, [])

  const resetGame = useCallback(() => {
    setGamePhase("menu")
    setGameState(prev => ({
      ...prev,
      score: 0,
      lives: 3,
      level: 1,
      gameOver: false,
      paused: false,
      time: 0,
      enemiesKilled: 0,
      powerUpsCollected: 0,
    }))
    setBullets([])
    setEnemies([])
    setPowerUps([])
    setParticles([])
    setStars([])
  }, [])

  const updateScore = useCallback((points: number) => {
    setGameState(prev => {
      const newScore = prev.score + points
      const newHighScore = Math.max(newScore, prev.highScore)
      if (newHighScore > prev.highScore) {
        localStorage?.setItem("space-shooter-highscore", newHighScore.toString())
      }
      return { ...prev, score: newScore, highScore: newHighScore }
    })
  }, [])

  const gameOver = useCallback(() => {
    setGamePhase("gameOver")
    setGameState(prev => ({ ...prev, gameOver: true }))
    playSound("explosion")
  }, [playSound])

  // ============================================================================
  // GAME PHYSICS AND COLLISION SYSTEM
  // ============================================================================

  const updatePlayer = useCallback((deltaTime: number, canvasWidth: number, canvasHeight: number) => {
    setPlayer(prev => {
      let newX = prev.x
      let newY = prev.y
      const speed = 5

      // Handle input
      if (keysRef.current.has("ArrowLeft") || keysRef.current.has("KeyA")) {
        newX -= speed
      }
      if (keysRef.current.has("ArrowRight") || keysRef.current.has("KeyD")) {
        newX += speed
      }
      if (keysRef.current.has("ArrowUp") || keysRef.current.has("KeyW")) {
        newY -= speed
      }
      if (keysRef.current.has("ArrowDown") || keysRef.current.has("KeyS")) {
        newY += speed
      }

      // Clamp to screen bounds
      newX = clamp(newX, 0, canvasWidth - prev.width)
      newY = clamp(newY, 0, canvasHeight - prev.height)

      return { ...prev, x: newX, y: newY }
    })
  }, [])

  const updateBullets = useCallback((deltaTime: number, canvasHeight: number) => {
    setBullets(prev => prev
      .map(bullet => ({
        ...bullet,
        x: bullet.x + bullet.vx,
        y: bullet.y + bullet.vy,
      }))
      .filter(bullet => bullet.y > -bullet.height && bullet.y < canvasHeight + bullet.height)
    )
  }, [])

  const updateEnemies = useCallback((deltaTime: number, canvasWidth: number, canvasHeight: number) => {
    setEnemies(prev => prev
      .map(enemy => {
        let newX = enemy.x + enemy.vx
        let newY = enemy.y + enemy.vy

        // Bounce off walls
        if (newX <= 0 || newX >= canvasWidth - enemy.width) {
          enemy.vx *= -1
          newX = clamp(newX, 0, canvasWidth - enemy.width)
        }

        return { ...enemy, x: newX, y: newY }
      })
      .filter(enemy => enemy.y < canvasHeight + 100 && enemy.active)
    )
  }, [])

  const updatePowerUps = useCallback((deltaTime: number, canvasHeight: number) => {
    setPowerUps(prev => prev
      .map(powerup => ({
        ...powerup,
        y: powerup.y + powerup.vy,
      }))
      .filter(powerup => powerup.y < canvasHeight + powerup.height)
    )
  }, [])

  const updateParticles = useCallback((deltaTime: number) => {
    setParticles(prev => prev
      .map(particle => ({
        ...particle,
        x: particle.x + particle.vx,
        y: particle.y + particle.vy,
        life: particle.life - 1,
        vx: particle.vx * 0.98,
        vy: particle.vy * 0.98,
      }))
      .filter(particle => particle.life > 0)
    )
  }, [])

  const updateStars = useCallback((deltaTime: number, canvasHeight: number) => {
    setStars(prev => prev.map(star => {
      const newY = star.y + star.speed
      return newY > canvasHeight ? { ...star, y: -star.size } : { ...star, y: newY }
    }))
  }, [])

  // ============================================================================
  // COLLISION DETECTION SYSTEM
  // ============================================================================

  const handleCollisions = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Bullet vs Enemy collisions
    setBullets(prevBullets => {
      const remainingBullets = [...prevBullets]
      
      setEnemies(prevEnemies => {
        const remainingEnemies = [...prevEnemies]
        
        for (let i = remainingBullets.length - 1; i >= 0; i--) {
          const bullet = remainingBullets[i]
          
          for (let j = remainingEnemies.length - 1; j >= 0; j--) {
            const enemy = remainingEnemies[j]
            
            if (checkCollision(bullet, enemy)) {
              // Remove bullet
              remainingBullets.splice(i, 1)
              
              // Damage enemy
              enemy.health = (enemy.health || 25) - (bullet.damage || 25)
              
              if (enemy.health <= 0) {
                // Remove enemy
                remainingEnemies.splice(j, 1)
                
                // Add score
                updateScore(100 * gameState.level)
                
                // Create explosion particles
                const newParticles = Array.from({ length: 8 }, () => 
                  createParticle(enemy.x + enemy.width/2, enemy.y + enemy.height/2)
                )
                setParticles(prev => [...prev, ...newParticles])
                
                // Update enemies killed
                setGameState(prev => ({ ...prev, enemiesKilled: prev.enemiesKilled + 1 }))
                
                // Chance to spawn power-up
                if (Math.random() < 0.2) {
                  const newPowerUp = createPowerUp(enemy.x, enemy.y)
                  setPowerUps(prev => [...prev, newPowerUp])
                }
                
                playSound("explosion")
              }
              break
            }
          }
        }
        
        return remainingEnemies
      })
      
      return remainingBullets
    })

    // Player vs Enemy collisions
    enemies.forEach(enemy => {
      if (checkCollision(player, enemy)) {
        // Damage player
        setGameState(prev => {
          const newLives = prev.lives - 1
          if (newLives <= 0) {
            gameOver()
          }
          return { ...prev, lives: newLives }
        })
        
        // Create explosion particles
        const newParticles = Array.from({ length: 12 }, () => 
          createParticle(player.x + player.width/2, player.y + player.height/2, "#ff4444")
        )
        setParticles(prev => [...prev, ...newParticles])
        
        // Remove enemy
        setEnemies(prev => prev.filter(e => e.id !== enemy.id))
        
        playSound("explosion")
      }
    })

    // Player vs PowerUp collisions
    powerUps.forEach(powerup => {
      if (checkCollision(player, powerup)) {
        // Remove power-up
        setPowerUps(prev => prev.filter(p => p.id !== powerup.id))
        
        // Apply power-up effect
        updateScore(500)
        setGameState(prev => ({ 
          ...prev, 
          powerUpsCollected: prev.powerUpsCollected + 1,
          lives: Math.min(prev.lives + 1, 5) // Max 5 lives
        }))
        
        // Create collection particles
        const newParticles = Array.from({ length: 6 }, () => 
          createParticle(powerup.x + powerup.width/2, powerup.y + powerup.height/2, "#00ff00")
        )
        setParticles(prev => [...prev, ...newParticles])
        
        playSound("powerup")
      }
    })
  }, [player, enemies, powerUps, gameState.level, updateScore, gameOver, playSound])

  // ============================================================================
  // ENEMY SPAWNING SYSTEM
  // ============================================================================

  const spawnEnemies = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || gamePhase !== "playing") return

    const maxEnemies = gameState.difficulty === "easy" ? 3 : gameState.difficulty === "hard" ? 8 : 5
    const spawnRate = gameState.difficulty === "easy" ? 0.02 : gameState.difficulty === "hard" ? 0.08 : 0.05

    if (enemies.length < maxEnemies && Math.random() < spawnRate) {
      const newEnemy = createEnemy(
        randomInt(0, canvas.width - 30),
        -25,
        gameState.level
      )
      setEnemies(prev => [...prev, newEnemy])
    }
  }, [enemies.length, gameState.difficulty, gameState.level, gamePhase])

  // ============================================================================
  // RENDERING SYSTEM - ALL INLINE
  // ============================================================================

  const renderSVGToCanvas = (ctx: CanvasRenderingContext2D, svgString: string, x: number, y: number, width: number, height: number) => {
    const img = new Image()
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(svgBlob)
    
    img.onload = () => {
      ctx.drawImage(img, x, y, width, height)
      URL.revokeObjectURL(url)
    }
    img.src = url
  }

  const render = useCallback((ctx: CanvasRenderingContext2D, canvasWidth: number, canvasHeight: number) => {
    // Clear canvas with space background
    const gradient = ctx.createLinearGradient(0, 0, 0, canvasHeight)
    gradient.addColorStop(0, "#000011")
    gradient.addColorStop(1, "#000033")
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, canvasWidth, canvasHeight)

    // Render stars
    stars.forEach(star => {
      ctx.fillStyle = \`rgba(255, 255, 255, \${star.opacity})\`
      ctx.fillRect(star.x, star.y, star.size, star.size)
    })

    // Render player
    if (player.active) {
      renderSVGToCanvas(ctx, GAME_ASSETS.player, player.x, player.y, player.width, player.height)
    }

    // Render bullets
    bullets.forEach(bullet => {
      renderSVGToCanvas(ctx, GAME_ASSETS.bullet, bullet.x, bullet.y, bullet.width, bullet.height)
    })

    // Render enemies
    enemies.forEach(enemy => {
      renderSVGToCanvas(ctx, GAME_ASSETS.enemy, enemy.x, enemy.y, enemy.width, enemy.height)
      
      // Health bar
      if (enemy.health && enemy.health < 25) {
        const healthPercent = enemy.health / 25
        ctx.fillStyle = "#ff0000"
        ctx.fillRect(enemy.x, enemy.y - 5, enemy.width, 2)
        ctx.fillStyle = "#00ff00"
        ctx.fillRect(enemy.x, enemy.y - 5, enemy.width * healthPercent, 2)
      }
    })

    // Render power-ups
    powerUps.forEach(powerup => {
      renderSVGToCanvas(ctx, GAME_ASSETS.powerup, powerup.x, powerup.y, powerup.width, powerup.height)
    })

    // Render particles
    particles.forEach(particle => {
      const alpha = particle.life / particle.maxLife
      ctx.fillStyle = particle.color + Math.floor(alpha * 255).toString(16).padStart(2, '0')
      ctx.fillRect(particle.x, particle.y, particle.size, particle.size)
    })

    // Render UI overlay
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)"
    ctx.fillRect(0, 0, canvasWidth, 60)
    
    ctx.fillStyle = "#ffffff"
    ctx.font = "16px Arial"
    ctx.fillText(\`Score: \${formatScore(gameState.score)}\`, 10, 25)
    ctx.fillText(\`Lives: \${gameState.lives}\`, 10, 45)
    ctx.fillText(\`Level: \${gameState.level}\`, 200, 25)
    ctx.fillText(\`Time: \${formatTime(gameState.time)}\`, 200, 45)
    ctx.fillText(\`Difficulty: \${gameState.difficulty.toUpperCase()}\`, 400, 25)
    ctx.fillText(\`Enemies: \${gameState.enemiesKilled}\`, 400, 45)
  }, [player, bullets, enemies, powerUps, particles, stars, gameState])

  // ============================================================================
  // MAIN GAME LOOP - ALL INLINE
  // ============================================================================

  const gameLoop = useCallback((currentTime: number) => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx || gamePhase !== "playing") return

    const deltaTime = currentTime - lastTimeRef.current
    lastTimeRef.current = currentTime

    // Update game timer
    setGameState(prev => ({ ...prev, time: prev.time + deltaTime / 1000 }))

    // Update all game objects
    updatePlayer(deltaTime, canvas.width, canvas.height)
    updateBullets(deltaTime, canvas.height)
    updateEnemies(deltaTime, canvas.width, canvas.height)
    updatePowerUps(deltaTime, canvas.height)
    updateParticles(deltaTime)
    updateStars(deltaTime, canvas.height)

    // Handle collisions
    handleCollisions()

    // Spawn enemies
    spawnEnemies()

    // Check level progression
    if (gameState.enemiesKilled > 0 && gameState.enemiesKilled % 10 === 0 && enemies.length === 0) {
      setGameState(prev => ({ ...prev, level: prev.level + 1 }))
    }

    // Render everything
    render(ctx, canvas.width, canvas.height)

    // Continue game loop
    gameLoopRef.current = requestAnimationFrame(gameLoop)
  }, [gamePhase, updatePlayer, updateBullets, updateEnemies, updatePowerUps, updateParticles, updateStars, handleCollisions, spawnEnemies, render, gameState.enemiesKilled, enemies.length])

  // ============================================================================
  // INPUT HANDLING SYSTEM - ALL INLINE
  // ============================================================================

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    keysRef.current.add(event.code)
    
    if (event.code === "Space" && gamePhase === "playing") {
      event.preventDefault()
      // Shoot bullet
      const newBullet = createBullet(player.x + player.width/2 - 2, player.y)
      setBullets(prev => [...prev, newBullet])
      playSound("shoot")
    }
    
    if (event.code === "Escape" && gamePhase === "playing") {
      event.preventDefault()
      pauseGame()
    }
  }, [gamePhase, player.x, player.y, player.width, playSound, pauseGame])

  const handleKeyUp = useCallback((event: KeyboardEvent) => {
    keysRef.current.delete(event.code)
  }, [])

  // ============================================================================
  // CANVAS SETUP AND LIFECYCLE
  // ============================================================================

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      const ctx = canvas.getContext("2d")
      if (ctx) {
        ctx.scale(dpr, dpr)
      }
      canvas.style.width = rect.width + "px"
      canvas.style.height = rect.height + "px"
    }

    resizeCanvas()
    window.addEventListener("resize", resizeCanvas)

    return () => {
      window.removeEventListener("resize", resizeCanvas)
    }
  }, [])

  useEffect(() => {
    if (gamePhase === "playing") {
      gameLoopRef.current = requestAnimationFrame(gameLoop)
    } else if (gameLoopRef.current) {
      cancelAnimationFrame(gameLoopRef.current)
    }

    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current)
      }
    }
  }, [gamePhase, gameLoop])

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
    }
  }, [handleKeyDown, handleKeyUp])

  // ============================================================================
  // RESPONSIVE UI RENDERING - ALL INLINE
  // ============================================================================

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black">
      {/* Game Canvas */}
      {(gamePhase === "playing" || gamePhase === "paused") && (
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full block cursor-crosshair"
          style={{
            imageRendering: "pixelated",
            touchAction: "none",
          }}
        />
      )}

      {/* Main Menu */}
      {gamePhase === "menu" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-blue-900/50 to-purple-900/50 z-40 p-4">
          <Card className="w-full max-w-md lg:max-w-lg">
            <CardContent className="p-6 md:p-8 text-center">
              <h1 className="text-5xl md:text-6xl font-bold mb-4 text-blue-400">🚀 SPACE SHOOTER</h1>
              <p className="text-lg md:text-xl mb-8 text-gray-300">Defend Earth from alien invasion!</p>
              
              <div className="space-y-4 mb-6">
                <Button
                  onClick={() => startGame("easy")}
                  size="lg"
                  className="w-full text-lg bg-green-600 hover:bg-green-700"
                >
                  <Play className="w-5 h-5 mr-2" />
                  Easy Mode (5 Lives)
                </Button>
                <Button
                  onClick={() => startGame("medium")}
                  size="lg"
                  className="w-full text-lg bg-yellow-600 hover:bg-yellow-700"
                >
                  <Play className="w-5 h-5 mr-2" />
                  Medium Mode (3 Lives)
                </Button>
                <Button
                  onClick={() => startGame("hard")}
                  size="lg"
                  className="w-full text-lg bg-red-600 hover:bg-red-700"
                >
                  <Play className="w-5 h-5 mr-2" />
                  Hard Mode (2 Lives)
                </Button>
              </div>

              <div className="flex items-center justify-center gap-4 mb-6">
                <Button
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  variant="outline"
                  size="sm"
                >
                  {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                  {soundEnabled ? "Sound On" : "Sound Off"}
                </Button>
              </div>

              <div className="text-center">
                <p className="text-sm text-gray-400 mb-2">High Score</p>
                <p className="text-2xl font-bold text-yellow-400">{formatScore(gameState.highScore)}</p>
              </div>

              <div className="mt-6 text-xs text-gray-500">
                <p>Controls: WASD/Arrow Keys to move, Space to shoot, Escape to pause</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Pause Menu */}
      {gamePhase === "paused" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/75 z-50 p-4">
          <Card className="w-full max-w-md">
            <CardContent className="p-6 md:p-8 text-center">
              <h2 className="text-4xl font-bold mb-6 text-blue-400">⏸️ PAUSED</h2>
              <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
                <div>
                  <p className="text-gray-400">Score</p>
                  <p className="text-xl font-bold text-yellow-400">{formatScore(gameState.score)}</p>
                </div>
                <div>
                  <p className="text-gray-400">Level</p>
                  <p className="text-xl font-bold text-blue-400">{gameState.level}</p>
                </div>
                <div>
                  <p className="text-gray-400">Lives</p>
                  <p className="text-xl font-bold text-red-400">{gameState.lives}</p>
                </div>
                <div>
                  <p className="text-gray-400">Time</p>
                  <p className="text-xl font-bold text-green-400">{formatTime(gameState.time)}</p>
                </div>
              </div>
              <div className="space-y-3">
                <Button onClick={resumeGame} size="lg" className="w-full text-lg">
                  <Play className="w-5 h-5 mr-2" />
                  Resume Game
                </Button>
                <Button
                  onClick={resetGame}
                  variant="outline"
                  size="lg"
                  className="w-full text-lg bg-transparent"
                >
                  <Home className="w-5 h-5 mr-2" />
                  Main Menu
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Game Over Screen */}
      {gamePhase === "gameOver" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/75 z-50 p-4">
          <Card className="w-full max-w-md">
            <CardContent className="p-6 md:p-8 text-center">
              <h2 className="text-4xl font-bold mb-4 text-red-400">💥 GAME OVER</h2>

              {gameState.score === gameState.highScore && gameState.score > 0 && (
                <div className="text-2xl font-bold text-yellow-400 mb-4 animate-pulse">
                  🎉 NEW HIGH SCORE! 🎉
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
                <div>
                  <p className="text-gray-400">Final Score</p>
                  <p className="text-2xl font-bold text-yellow-400">{formatScore(gameState.score)}</p>
                </div>
                <div>
                  <p className="text-gray-400">Level Reached</p>
                  <p className="text-2xl font-bold text-blue-400">{gameState.level}</p>
                </div>
                <div>
                  <p className="text-gray-400">Enemies Killed</p>
                  <p className="text-2xl font-bold text-red-400">{gameState.enemiesKilled}</p>
                </div>
                <div>
                  <p className="text-gray-400">Time Survived</p>
                  <p className="text-2xl font-bold text-green-400">{formatTime(gameState.time)}</p>
                </div>
              </div>

              <div className="mb-4">
                <p className="text-sm text-gray-400">High Score: {formatScore(gameState.highScore)}</p>
                <p className="text-sm text-gray-400">Power-ups Collected: {gameState.powerUpsCollected}</p>
              </div>

              <div className="space-y-3">
                <Button onClick={() => startGame(gameState.difficulty)} size="lg" className="w-full text-lg">
                  <RotateCcw className="w-5 h-5 mr-2" />
                  Play Again
                </Button>
                <Button
                  onClick={resetGame}
                  variant="outline"
                  size="lg"
                  className="w-full text-lg bg-transparent"
                >
                  <Home className="w-5 h-5 mr-2" />
                  Main Menu
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Loading Screen */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/90 z-60">
          <Card className="w-full max-w-sm">
            <CardContent className="p-6 text-center">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-400 mx-auto mb-4"></div>
              <h2 className="text-xl font-bold mb-2 text-blue-400">Loading Game...</h2>
              <p className="text-sm text-gray-400">Initializing space systems...</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}`,
    "app/globals.css": `@import "tailwindcss";

:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0 0);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.97 0 0);
  --secondary-foreground: oklch(0.205 0 0);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.205 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --destructive-foreground: oklch(0.577 0.245 27.325);
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);
  --radius: 0.625rem;
}

.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  --card: oklch(0.145 0 0);
  --card-foreground: oklch(0.985 0 0);
  --popover: oklch(0.145 0 0);
  --popover-foreground: oklch(0.985 0 0);
  --primary: oklch(0.985 0 0);
  --primary-foreground: oklch(0.205 0 0);
  --secondary: oklch(0.269 0 0);
  --secondary-foreground: oklch(0.985 0 0);
  --muted: oklch(0.269 0 0);
  --muted-foreground: oklch(0.708 0 0);
  --accent: oklch(0.269 0 0);
  --accent-foreground: oklch(0.985 0 0);
  --destructive: oklch(0.396 0.141 25.723);
  --destructive-foreground: oklch(0.637 0.237 25.331);
  --border: oklch(0.269 0 0);
  --input: oklch(0.269 0 0);
  --ring: oklch(0.439 0 0);
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
  canvas {
    display: block;
    margin: 0 auto;
    touch-action: none;
  }
}`,
    "lib/utils.ts": `import { type ClassValue, clsx } from "clsx"
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
  
  lerp: (start: number, end: number, factor: number): number => 
    start + (end - start) * factor,
    
  normalize: (x: number, y: number): { x: number; y: number } => {
    const length = Math.sqrt(x * x + y * y)
    return length > 0 ? { x: x / length, y: y / length } : { x: 0, y: 0 }
  },
  
  formatScore: (score: number): string => score.toLocaleString(),
  
  formatTime: (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return \`\${mins}:\${secs.toString().padStart(2, '0')}\`
  }
}`,
    "types/game.ts": `export type GamePhase = "menu" | "playing" | "paused" | "gameOver"

export interface GameState {
  score: number
  highScore: number
  lives: number
  level: number
  gameOver: boolean
  paused: boolean
  time?: number
}

export interface GameConfig {
  width: number
  height: number
  backgroundColor: string
  physics?: {
    gravity: number
    friction: number
  }
}

export interface Vector2D {
  x: number
  y: number
}

export interface GameObject {
  id: string
  x: number
  y: number
  width: number
  height: number
  active: boolean
  type?: string
  velocity?: Vector2D
  rotation?: number
  scale?: number
  health?: number
  speed?: number
  color?: string
  sprite?: string
}

export interface Player extends GameObject {
  lives: number
  score: number
  level: number
  powerUps?: string[]
  inventory?: string[]
}

export interface InputState {
  up: boolean
  down: boolean
  left: boolean
  right: boolean
  action: boolean
  jump: boolean
  shoot: boolean
  mouseX?: number
  mouseY?: number
  mouseDown?: boolean
  touchX?: number
  touchY?: number
  touchActive?: boolean
}`,
  }

  // Add missing files with GUARANTEED fallbacks
  const allowedFiles = ["package.json", "app/layout.tsx", "app/page.tsx"]

  missingFiles.forEach((fileName) => {
    if (allowedFiles.includes(fileName)) {
      const fallbackContent = baseTemplates[fileName]
      if (fallbackContent) {
        completeFiles.push({
          name: fileName,
          content: fallbackContent,
          type: fileName.split(".").pop() || "txt",
          source: "fallback-template",
        })
        console.log(chalk.yellow(`🔧 Added ${fileName} from FALLBACK template (${fallbackContent.length} chars)`))
      }
    } else {
      console.log(chalk.gray(`⏭️  Skipping ${fileName} - not needed for single-page architecture`))
    }
  })

  console.log(chalk.green(`✅ Complete ${difficulty.toUpperCase()} structure built with ${completeFiles.length} files`))

  // CROSS-CHECK: Verify all required files are present
  const finalCheck = allowedFiles.every((fileName) => completeFiles.some((file) => file.name === fileName))

  if (finalCheck) {
    console.log(chalk.green(`✅ CROSS-CHECK PASSED: All required files present`))
  } else {
    console.log(chalk.red(`❌ CROSS-CHECK FAILED: Missing required files`))
  }

  return completeFiles
}

// ============================================================================
// SIMPLE2 API: THINKING STAGE + OPENAI FEEDBACK LOOP + 1000+ LINES
// ============================================================================

app.post("/api/generate/simple2", async (req, res) => {
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

    console.log(chalk.blue(`🚀 Starting SIMPLE2 chain generation for Chat ${chatId}`))
    console.log(chalk.blue(`🎮 Game Request: ${prompt}`))

    sendEvent("progress", {
      step: 0,
      totalSteps: 6,
      stepName: "Initialization",
      progress: 0,
      message: "Starting Simple2 chain (Architecture → Thinking → OpenAI → Feedback → Final → Cross-Check)...",
    })

    // Step 1: Game Architecture
    sendEvent("progress", {
      step: 1,
      totalSteps: 6,
      stepName: "Game Architecture",
      progress: 16,
      message: "Designing game architecture...",
    })

    const result = await llmProvider.generateSimple2WebGame(prompt, chatId)
    await logLLMResponse(chatId, "architecture", "groq", prompt, result.architecture)

    sendEvent("step_complete", {
      step: 1,
      stepName: "Game Architecture",
      output: `Architecture completed (${result.architecture.length} characters)`,
    })

    // Step 2: Thinking Stage
    sendEvent("progress", {
      step: 2,
      totalSteps: 6,
      stepName: "Thinking Stage",
      progress: 33,
      message: "Analyzing implementation strategy...",
    })

    await logLLMResponse(chatId, "thinking-analysis", "groq", result.architecture, result.thinkingAnalysis)

    sendEvent("step_complete", {
      step: 2,
      stepName: "Thinking Stage",
      output: `Thinking analysis completed (${result.thinkingAnalysis.length} characters)`,
    })

    // Step 3: Initial Code with OpenAI
    sendEvent("progress", {
      step: 3,
      totalSteps: 6,
      stepName: "OpenAI Code Generation",
      progress: 50,
      message: "Generating initial code with OpenAI 20B...",
    })

    await logLLMResponse(chatId, "initial-code", "groq-openai-20b", result.thinkingAnalysis, result.initialCode)

    sendEvent("step_complete", {
      step: 3,
      stepName: "OpenAI Code Generation",
      output: `Initial code completed (${result.initialCode.length} characters)`,
    })

    // Step 4: Feedback Loop
    sendEvent("progress", {
      step: 4,
      totalSteps: 6,
      stepName: "Feedback Loop",
      progress: 66,
      message: "Analyzing code and providing feedback...",
    })

    await logLLMResponse(chatId, "feedback-loop", "groq", result.initialCode, result.feedback)

    sendEvent("step_complete", {
      step: 4,
      stepName: "Feedback Loop",
      output: `Feedback analysis completed (${result.feedback.length} characters)`,
    })

    // Step 5: Final Expanded Code
    sendEvent("progress", {
      step: 5,
      totalSteps: 6,
      stepName: "Final Expanded Code",
      progress: 83,
      message: "Generating final 1000+ lines code...",
    })

    await logLLMResponse(chatId, "final-code", "groq-openai-20b", result.initialCode, result.finalCode)

    sendEvent("step_complete", {
      step: 5,
      stepName: "Final Expanded Code",
      output: `Final code completed (${result.finalCode.length} characters) - Target: 1000+ lines`,
    })

    // Step 6: Cross-Check and File Writing
    sendEvent("progress", {
      step: 6,
      totalSteps: 6,
      stepName: "Cross-Check & File Writing",
      progress: 100,
      message: "Cross-checking files and writing to disk...",
    })

    // Process and validate the final product
    const gameType = "canvas"
    const validationResult = validateAndParseNextJSFiles(result.finalCode, chatId, gameType, "medium")
    const completeFiles = await createCompleteNextJSStructure(
      validationResult.files,
      validationResult.missingFiles,
      prompt,
      gameType,
      "medium",
    )

    // Count lines in main game file
    const mainGameFile = completeFiles.find((f) => f.name === "app/page.tsx")
    const lineCount = mainGameFile ? mainGameFile.content.split("\n").length : 0

    console.log(chalk.blue(`📏 Main game file (app/page.tsx): ${lineCount} lines`))

    completeFiles.forEach((file, index) => {
      sendEvent("file_generated", {
        fileName: file.name,
        fileType: file.type,
        content: file.content,
        size: file.content.length,
        lines: file.content.split("\n").length,
        source: file.source || "llm",
        index: index + 1,
        totalFiles: completeFiles.length,
      })
    })

    const projectId = uuidv4()
    const projectPath = await saveGeneratedFiles(projectId, completeFiles)

    // CROSS-CHECK: Verify app directory exists
    const appDir = path.join(projectPath, "app")
    const appDirExists = await fs.pathExists(appDir)
    console.log(chalk.blue(`📁 App directory exists: ${appDirExists}`))

    // CROSS-CHECK: Verify app/page.tsx exists and has content
    const pageFile = path.join(projectPath, "app", "page.tsx")
    const pageFileExists = await fs.pathExists(pageFile)
    console.log(chalk.blue(`📄 app/page.tsx exists: ${pageFileExists}`))

    if (pageFileExists) {
      const pageContent = await fs.readFile(pageFile, "utf8")
      console.log(
        chalk.green(`✅ app/page.tsx verified: ${pageContent.length} chars, ${pageContent.split("\n").length} lines`),
      )
    } else {
      console.log(chalk.red(`❌ app/page.tsx missing! This will cause the Next.js error.`))
    }

    const serverInfo = await setupAndRunProject(projectPath)

    sendEvent("step_complete", {
      step: 6,
      stepName: "Cross-Check & File Writing",
      output: `Files written and cross-checked. App directory: ${appDirExists}, page.tsx: ${pageFileExists}`,
    })

    const simple2ChainData = {
      chatId,
      projectId,
      totalFiles: completeFiles.length,
      mainGameFileLines: lineCount,
      aiGeneratedFiles: validationResult.files.length,
      missingFilesGenerated: validationResult.missingFiles.length,
      advancedAssetsGenerated: validationResult.advancedAssets || 0,
      chainUsed: "simple2",
      chainSteps: [
        "Game Architecture Design",
        "Thinking Stage Analysis",
        "OpenAI Initial Code Generation",
        "Feedback Loop Analysis",
        "Final Expanded Code (1000+ lines)",
        "Cross-Check & File Writing",
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
        advancedAssets: validationResult.advancedAssets || 0,
        mainGameFileLines: lineCount,
        targetLines: 1000,
        linesAchieved: lineCount >= 1000,
        appDirectoryExists: appDirExists,
        pageFileExists: pageFileExists,
      },
      responses: {
        architecture: result.architecture.length,
        thinkingAnalysis: result.thinkingAnalysis.length,
        initialCode: result.initialCode.length,
        feedback: result.feedback.length,
        finalCode: result.finalCode.length,
      },
    }

    await logCompleteChain(chatId, simple2ChainData)

    sendEvent("complete", simple2ChainData)

    console.log(chalk.green(`🎉 SIMPLE2 chain completed for Chat ${chatId}!`))
    console.log(chalk.green(`🎮 Game running at: ${serverInfo.url}`))
    console.log(chalk.green(`📏 Main game file: ${lineCount} lines (Target: 1000+)`))
    console.log(lineCount >= 1000 ? chalk.green(`✅ Target achieved!`) : chalk.yellow(`⚠️  Target not reached`))
    console.log(chalk.green(`📁 App directory: ${appDirExists ? "✅ EXISTS" : "❌ MISSING"}`))
    console.log(chalk.green(`📄 page.tsx: ${pageFileExists ? "✅ EXISTS" : "❌ MISSING"}`))
  } catch (error) {
    console.error(chalk.red(`💥 Error in Simple2 Chain Chat ${chatId}:`, error.message))
    sendEvent("error", {
      error: "Failed to generate Simple2 web game",
      details: error.message,
      chatId,
    })
  }

  res.end()
})

// Keep existing routes for backward compatibility
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

    // Step 1: Groq explanation
    const groqExplanation = await llmProvider.getGameExplanation(prompt, chatId)
    await logLLMResponse(chatId, "explanation", "groq", prompt, groqExplanation)

    sendEvent("step_complete", {
      step: 1,
      stepName: "Groq Architecture",
      output: `Game architecture explanation completed (${groqExplanation.length} characters)`,
    })

    // Step 2: Qwen3 initial code
    const qwenInitialCode = await llmProvider.generateCleanCodeWithQwen(groqExplanation, prompt, chatId)
    await logLLMResponse(chatId, "initial-code", "qwen3", groqExplanation, qwenInitialCode)

    sendEvent("step_complete", {
      step: 2,
      stepName: "Qwen3 Initial Code",
      output: `Initial code generation completed (${qwenInitialCode.length} characters)`,
    })

    // Step 3: Anthropic validation
    const anthropicFeedback = await llmProvider.validateWithAnthropic(qwenInitialCode, prompt, chatId)
    await logLLMResponse(chatId, "validation", "anthropic", qwenInitialCode, anthropicFeedback)

    sendEvent("step_complete", {
      step: 3,
      stepName: "Anthropic Validation",
      output: `Code validation completed with detailed feedback (${anthropicFeedback.length} characters)`,
    })

    // Step 4: Qwen3 final code
    const qwenFinalCode = await llmProvider.generateFinalCodeWithQwen(
      anthropicFeedback,
      qwenInitialCode,
      prompt,
      chatId,
    )
    await logLLMResponse(chatId, "final-code", "qwen3", anthropicFeedback, qwenFinalCode)

    sendEvent("step_complete", {
      step: 4,
      stepName: "Qwen3 Final Fixes",
      output: `Final code generation completed (${qwenFinalCode.length} characters)`,
    })

    const gameType = "canvas"
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
        source: file.source || "llm",
        index: index + 1,
        totalFiles: completeFiles.length,
      })
    })

    const projectId = uuidv4()
    const projectPath = await saveGeneratedFiles(projectId, completeFiles)
    const serverInfo = await setupAndRunProject(projectPath)

    const completeChainData = {
      chatId,
      projectId,
      totalFiles: completeFiles.length,
      aiGeneratedFiles: validationResult.files.length,
      missingFilesGenerated: validationResult.missingFiles.length,
      svgAssetsGenerated: validationResult.svgAssets,
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
        svgAssets: validationResult.svgAssets,
      },
      responses: {
        groqExplanation: groqExplanation.length,
        qwenInitialCode: qwenInitialCode.length,
        anthropicFeedback: anthropicFeedback.length,
        qwenFinalCode: qwenFinalCode.length,
      },
    }

    await logCompleteChain(chatId, completeChainData)

    sendEvent("complete", completeChainData)

    console.log(chalk.green(`FULL chain completed for Chat ${chatId}!`))
    console.log(chalk.green(`🎮 Game is running at: ${serverInfo.url}`))
    console.log(chalk.green(`🎨 Generated ${validationResult.svgAssets} SVG assets`))
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
    await logLLMResponse(chatId, "explanation", "groq", prompt, groqExplanation)

    const qwenFinalCode = await llmProvider.generateCleanCodeWithQwen(groqExplanation, prompt, chatId)
    await logLLMResponse(chatId, "final-code", "qwen3", groqExplanation, qwenFinalCode)

    const gameType = subdomain && subdomain.includes("babylon") ? "babylon" : "canvas"
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
        source: file.source || "llm",
        index: index + 1,
        totalFiles: completeFiles.length,
      })
    })

    const projectId = uuidv4()

    if (nginxEnabled && subdomain) {
      // Deploy to nginx (implementation would go here)
      const simpleChainData = {
        chatId,
        projectId: subdomain,
        totalFiles: completeFiles.length,
        chainUsed: "simple",
        deploymentType: "nginx",
        svgAssetsGenerated: validationResult.svgAssets,
      }

      await logCompleteChain(chatId, simpleChainData)
      sendEvent("complete", simpleChainData)
    } else {
      const projectPath = await saveGeneratedFiles(projectId, completeFiles)
      const serverInfo = await setupAndRunProject(projectPath)

      const simpleChainData = {
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
        responses: {
          groqExplanation: groqExplanation.length,
          qwenFinalCode: qwenFinalCode.length,
        },
        validation: {
          svgAssets: validationResult.svgAssets,
        },
      }

      await logCompleteChain(chatId, simpleChainData)
      sendEvent("complete", simpleChainData)

      console.log(chalk.green(`SIMPLE chain completed for Chat ${chatId}!`))
      console.log(chalk.green(`🎮 Game is running at: ${serverInfo.url}`))
      console.log(chalk.green(`🎨 Generated ${validationResult.svgAssets} SVG assets`))
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
  console.log(chalk.cyan(`📋 Response logs directory: ${RESPONSE_LOG_DIR}`))
  console.log(chalk.magenta(`🚀 FIXED: Simple2 API at /api/generate/simple2`))
  console.log(chalk.magenta(`🧠 Features: Thinking Stage + OpenAI Feedback Loop + 1000+ Lines + Cross-Check`))
  console.log(chalk.green(`🔧 FIXED: Enhanced file parsing, fallback templates, and cross-checking`))
})
