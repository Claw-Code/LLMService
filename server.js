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

app.use(cors())
app.use(express.json())
app.use(express.static("public"))

const PROJECTS_DIR = "generated-projects"
const CHAT_HISTORY_DIR = "chat-history"

await fs.ensureDir(PROJECTS_DIR)
await fs.ensureDir(CHAT_HISTORY_DIR)

let chatCounter = 1
const conversationContexts = new Map()

// Initialize traced LLM provider
const llmProvider = new TracedLLMProvider()

// ============================================================================
// SWAGGER CONFIGURATION
// ============================================================================
const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Web Game AI Generator API",
      version: "2.0.0",
      description: "Streaming API for generating HTML5 Canvas web games using AI chains",
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
    components: {
      schemas: {
        GamePrompt: {
          type: "object",
          required: ["prompt"],
          properties: {
            prompt: {
              type: "string",
              description: "Description of the web game to generate",
              example: "Create a Snake game with HTML5 Canvas, smooth movement, score system, and mobile controls",
              minLength: 10,
              maxLength: 1000,
            },
          },
        },
        StreamEvent: {
          type: "object",
          properties: {
            event: {
              type: "string",
              enum: ["progress", "step_complete", "file_generated", "complete", "error"],
              description: "Type of stream event",
            },
            data: {
              type: "object",
              description: "Event data payload",
            },
            timestamp: {
              type: "string",
              format: "date-time",
              description: "Event timestamp",
            },
          },
        },
        ProgressEvent: {
          type: "object",
          properties: {
            event: {
              type: "string",
              enum: ["progress"],
            },
            data: {
              type: "object",
              properties: {
                step: {
                  type: "integer",
                  description: "Current step number",
                },
                totalSteps: {
                  type: "integer",
                  description: "Total number of steps",
                },
                stepName: {
                  type: "string",
                  description: "Name of current step",
                },
                progress: {
                  type: "integer",
                  minimum: 0,
                  maximum: 100,
                  description: "Progress percentage",
                },
                message: {
                  type: "string",
                  description: "Progress message",
                },
              },
            },
          },
        },
        FileEvent: {
          type: "object",
          properties: {
            event: {
              type: "string",
              enum: ["file_generated"],
            },
            data: {
              type: "object",
              properties: {
                fileName: {
                  type: "string",
                  description: "Name of the generated file",
                },
                fileType: {
                  type: "string",
                  enum: ["html", "js"],
                  description: "Type of the file",
                },
                content: {
                  type: "string",
                  description: "Clean file content without generation comments",
                },
                size: {
                  type: "integer",
                  description: "File size in characters",
                },
              },
            },
          },
        },
        CompleteEvent: {
          type: "object",
          properties: {
            event: {
              type: "string",
              enum: ["complete"],
            },
            data: {
              type: "object",
              properties: {
                chatId: {
                  type: "integer",
                  description: "Chat session ID",
                },
                projectId: {
                  type: "string",
                  description: "Generated project UUID",
                },
                totalFiles: {
                  type: "integer",
                  description: "Total number of files generated",
                },
                aiGeneratedFiles: {
                  type: "integer",
                  description: "Number of files generated by AI",
                },
                chainUsed: {
                  type: "string",
                  enum: ["simple", "full"],
                  description: "AI chain type used",
                },
                setupInstructions: {
                  type: "object",
                  properties: {
                    npmInstall: {
                      type: "string",
                      example: "npm install",
                    },
                    startCommand: {
                      type: "string",
                      example: "npm start",
                    },
                    url: {
                      type: "string",
                      example: "http://localhost:3000",
                    },
                  },
                },
              },
            },
          },
        },
        ErrorEvent: {
          type: "object",
          properties: {
            event: {
              type: "string",
              enum: ["error"],
            },
            data: {
              type: "object",
              properties: {
                error: {
                  type: "string",
                  description: "Error message",
                },
                details: {
                  type: "string",
                  description: "Detailed error information",
                },
                chatId: {
                  type: "integer",
                  description: "Chat session ID",
                },
              },
            },
          },
        },
      },
    },
  },
  apis: ["./server.js"], // Path to the API docs
}

const swaggerSpec = swaggerJsdoc(swaggerOptions)
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec))

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

// Find available port
// Find available port - Fixed version
async function findAvailablePort(startPort = 8100) {
  const checkPort = (port) => {
    return new Promise((resolve) => {
      const server = net.createServer()

      server.once("error", (err) => {
        if (err.code === "EADDRINUSE") {
          // Port is in use
          resolve(false)
        } else {
          // Some other error
          resolve(false)
        }
      })

      server.once("listening", () => {
        server.close(() => {
          // Port is available
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

// Save generated files to disk
async function saveGeneratedFiles(projectId, files) {
  const projectPath = path.join(PROJECTS_DIR, projectId)
  await fs.ensureDir(projectPath)

  // Save each file
  for (const file of files) {
    const filePath = path.join(projectPath, file.name)
    await fs.writeFile(filePath, file.content)
    console.log(chalk.green(`✅ Saved ${file.name} to ${filePath}`))
  }

  // Create package.json
  const packageJson = {
    name: `web-game-${projectId}`,
    version: "1.0.0",
    description: "AI Generated Web Game",
    main: "main.js",
    scripts: {
      start: "npx serve . -p 8080",
      dev: "npx serve . -p 8080",
    },
    keywords: ["game", "html5", "canvas"],
    author: "AI Generator",
    license: "MIT",
  }

  await fs.writeFile(path.join(projectPath, "package.json"), JSON.stringify(packageJson, null, 2))

  return projectPath
}

// Run npm install and start server
// Replace the setupAndRunProject function with this improved version:
async function setupAndRunProject(projectPath) {
  return new Promise(async (resolve, reject) => {
    try {
      console.log(chalk.cyan(`📦 Running npm install in ${projectPath}...`))

      // Run npm install
      const npmInstall = spawn("npm", ["install"], {
        cwd: projectPath,
        shell: true,
        stdio: "pipe",
      })

      npmInstall.on("close", async (code) => {
        if (code !== 0) {
          console.log(chalk.yellow("npm install skipped or had issues (continuing anyway)"))
        }

        // Find available port
        const port = await findAvailablePort(8000)
        console.log(chalk.cyan(`🚀 Starting server on port ${port}...`))

        // Start the server
        const serverProcess = spawn("npx", ["serve", ".", "-p", port.toString()], {
          cwd: projectPath,
          shell: true,
          stdio: "pipe",
          detached: false,
        })

        // Check if server started successfully
        let serverStarted = false

        serverProcess.stdout.on("data", (data) => {
          const output = data.toString()
          console.log(chalk.gray(`Server output: ${output}`))

          // Regex to extract port from Serve's standard message
          const match = output.match(/http:\/\/localhost:(\d+)/)
          if (match && !serverStarted) {
            serverStarted = true
            const realPort = match[1]
            const serverUrl = `http://localhost:${realPort}`
            console.log(chalk.green(`✅ Server running at ${serverUrl}`))
            resolve({
              url: serverUrl,
              port: Number.parseInt(realPort),
              process: serverProcess,
            })
          } else if (!serverStarted && (output.includes("localhost") || output.includes("Listening"))) {
            // Fallback: if regex doesn't work but message looks server-like
            setTimeout(() => {
              if (!serverStarted) {
                const serverUrl = `http://localhost:${port}`
                console.log(chalk.yellow(`⚠️  Fall back to assumed URL: ${serverUrl}`))
                resolve({
                  url: serverUrl,
                  port: port,
                  process: serverProcess,
                })
              }
            }, 1000)
          }
        })

        serverProcess.stderr.on("data", (data) => {
          console.log(chalk.gray(`Server stderr: ${data.toString()}`))
        })

        // Fallback: resolve after a timeout even if we don't see server messages
        setTimeout(() => {
          if (!serverStarted) {
            const serverUrl = `http://localhost:${port}`
            console.log(chalk.yellow(`⚠️  Server may be running at ${serverUrl} (timeout reached)`))
            resolve({
              url: serverUrl,
              port: port,
              process: serverProcess,
            })
          }
        }, 5000)

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

// Enhanced file validation and parsing with code cleanup
function validateAndParseWebGameFiles(webGameCode, chatId) {
  console.log(chalk.cyan("Validating and parsing web game files with cleanup..."))

  if (!webGameCode || typeof webGameCode !== "string") {
    console.log(chalk.yellow("No web game code provided, using default structure..."))
    webGameCode = "// Default web game structure"
  }

  const files = []
  const missingFiles = []

  const requiredFiles = [
    "index.html",
    "gameManager.js",
    "audioManager.js",
    "main.js",
    "uiManager.js",
    "inputManager.js",
    "renderer.js",
    "gameObjects.js",
    "utils.js",
    "config.js",
  ]

  const fileSeparators = [
    { pattern: /\/\/ === index\.html ===([\s\S]*?)(?=\/\/ === |$)/g, name: "index.html", type: "html" },
    { pattern: /\/\/ === gameManager\.js ===([\s\S]*?)(?=\/\/ === |$)/g, name: "gameManager.js", type: "js" },
    { pattern: /\/\/ === audioManager\.js ===([\s\S]*?)(?=\/\/ === |$)/g, name: "audioManager.js", type: "js" },
    { pattern: /\/\/ === main\.js ===([\s\S]*?)(?=\/\/ === |$)/g, name: "main.js", type: "js" },
    { pattern: /\/\/ === uiManager\.js ===([\s\S]*?)(?=\/\/ === |$)/g, name: "uiManager.js", type: "js" },
    { pattern: /\/\/ === inputManager\.js ===([\s\S]*?)(?=\/\/ === |$)/g, name: "inputManager.js", type: "js" },
    { pattern: /\/\/ === renderer\.js ===([\s\S]*?)(?=\/\/ === |$)/g, name: "renderer.js", type: "js" },
    { pattern: /\/\/ === gameObjects\.js ===([\s\S]*?)(?=\/\/ === |$)/g, name: "gameObjects.js", type: "js" },
    { pattern: /\/\/ === utils\.js ===([\s\S]*?)(?=\/\/ === |$)/g, name: "utils.js", type: "js" },
    { pattern: /\/\/ === config\.js ===([\s\S]*?)(?=\/\/ === |$)/g, name: "config.js", type: "js" },
  ]

  // Parse files using separators
  fileSeparators.forEach(({ pattern, name, type }) => {
    const matches = [...webGameCode.matchAll(pattern)]
    if (matches.length > 0) {
      let content = matches[0][1].trim()

      // Clean up the content
      content = cleanupGeneratedCode(content, name)

      if (content) {
        files.push({
          name: name,
          content: content,
          type: type,
        })
        console.log(chalk.green(`✅ Found and cleaned ${name} (${content.length} chars)`))
      }
    } else {
      missingFiles.push(name)
    }
  })

  // Check for missing required files
  requiredFiles.forEach((fileName) => {
    if (!files.find((f) => f.name === fileName)) {
      missingFiles.push(fileName)
    }
  })

  const validationResult = {
    files,
    missingFiles: [...new Set(missingFiles)],
    isComplete: missingFiles.length === 0,
    totalFiles: files.length,
    requiredFiles: requiredFiles.length,
  }

  console.log(chalk.green(`Parsed and cleaned ${files.length}/${requiredFiles.length} files`))
  if (missingFiles.length > 0) {
    console.log(chalk.red(`Missing files: ${missingFiles.join(", ")}`))
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

// Create complete file structure with templates
function createCompleteFileStructure(existingFiles, missingFiles, gamePrompt) {
  const completeFiles = [...existingFiles]

  const fileTemplates = {
    "index.html": `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Web Game - ${gamePrompt}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; text-align: center; background: #1a1a2e; color: white; }
        canvas { border: 2px solid #fff; background: #000; margin: 20px 0; }
        .controls { margin: 20px 0; }
        .control-btn { margin: 5px; padding: 10px 20px; font-size: 16px; cursor: pointer; background: #333; color: white; border: none; border-radius: 5px; }
        .control-btn:hover { background: #555; }
        .score { font-size: 18px; margin: 10px 0; }
    </style>
</head>
<body>
    <h1>Web Game - AI Generated</h1>
    <canvas id="gameCanvas" width="400" height="400"></canvas>
    <div class="controls">
        <button class="control-btn" data-direction="up">↑</button><br>
        <button class="control-btn" data-direction="left">←</button>
        <button class="control-btn" data-direction="down">↓</button>
        <button class="control-btn" data-direction="right">→</button>
    </div>
    <div class="score">Score: <span id="score">0</span></div>
    
    <script src="config.js"></script>
    <script src="utils.js"></script>
    <script src="audioManager.js"></script>
    <script src="inputManager.js"></script>
    <script src="renderer.js"></script>
    <script src="gameObjects.js"></script>
    <script src="uiManager.js"></script>
    <script src="gameManager.js"></script>
    <script src="main.js"></script>
</body>
</html>`,

    "config.js": `const GameConfig = {
  CANVAS_WIDTH: 400,
  CANVAS_HEIGHT: 400,
  GRID_SIZE: 20,
  INITIAL_SPEED: 150,
  COLORS: {
    BACKGROUND: '#000000',
    PRIMARY: '#00ff00',
    SECONDARY: '#ff0000',
    UI_TEXT: '#ffffff'
  }
};
window.GameConfig = GameConfig;`,

    "utils.js": `const Utils = {
  randomInt: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min,
  clamp: (value, min, max) => Math.max(min, Math.min(max, value)),
  distance: (x1, y1, x2, y2) => Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
};
window.Utils = Utils;`,

    "gameManager.js": `class GameManager {
  constructor(canvas, audioManager, uiManager, inputManager, renderer) {
    this.canvas = canvas;
    this.audioManager = audioManager;
    this.uiManager = uiManager;
    this.inputManager = inputManager;
    this.renderer = renderer;
    this.score = 0;
    this.gameActive = false;
    this.gameSpeed = GameConfig.INITIAL_SPEED;
    this.setupGame();
  }
  
  setupGame() {
    this.score = 0;
    this.gameActive = true;
    this.uiManager.updateScore(this.score);
    this.gameLoop();
  }
  
  gameLoop() {
    if (this.gameActive) {
      setTimeout(() => {
        this.update();
        this.render();
        this.gameLoop();
      }, this.gameSpeed);
    }
  }
  
  update() {
    const input = this.inputManager.getInput();
    if (input) {
      console.log('Input received:', input);
    }
  }
  
  render() {
    this.renderer.clear();
    this.renderer.drawText('Game Running!', this.canvas.width / 2, this.canvas.height / 2);
    this.renderer.drawText('Score: ' + this.score, this.canvas.width / 2, 50);
  }
  
  addScore(points = 10) {
    this.score += points;
    this.uiManager.updateScore(this.score);
    this.audioManager.playSound('score');
  }
  
  gameOver() {
    this.gameActive = false;
    this.audioManager.playSound('gameOver');
    this.uiManager.showGameOver(this.score);
  }
  
  restart() {
    this.setupGame();
  }
}
window.GameManager = GameManager;`,

    "audioManager.js": `class AudioManager {
  constructor() {
    this.audioContext = null;
    this.sounds = {};
    this.enabled = true;
    this.volume = 0.3;
    this.initAudio();
  }
  
  initAudio() {
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      this.createSounds();
    } catch (error) {
      console.warn('Audio not supported:', error);
      this.enabled = false;
    }
  }
  
  createSounds() {
    this.sounds.score = () => this.createBeep(800, 0.1);
    this.sounds.gameOver = () => this.createBeep(200, 0.5);
    this.sounds.move = () => this.createBeep(400, 0.05);
  }
  
  createBeep(frequency, duration) {
    if (!this.enabled || !this.audioContext) return;
    
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(this.volume, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);
    
    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + duration);
  }
  
  playSound(soundName) {
    if (this.sounds[soundName]) {
      this.sounds[soundName]();
    }
  }
}
window.AudioManager = AudioManager;`,

    "uiManager.js": `class UIManager {
  constructor() {
    this.scoreElement = document.getElementById('score');
    this.setupEventListeners();
  }
  
  setupEventListeners() {
    // UI event listeners can be added here
  }
  
  updateScore(score) {
    if (this.scoreElement) {
      this.scoreElement.textContent = score;
    }
  }
  
  showGameOver(finalScore) {
    setTimeout(() => {
      alert(\`Game Over! Final Score: \${finalScore}\\nClick Restart to play again.\`);
    }, 100);
  }
  
  showMessage(message, duration = 3000) {
    const messageDiv = document.createElement('div');
    messageDiv.textContent = message;
    messageDiv.style.cssText = \`
      position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
      background: rgba(0,0,0,0.9); color: white; padding: 15px 25px;
      border-radius: 8px; z-index: 1000; font-size: 18px;
    \`;
    document.body.appendChild(messageDiv);
    setTimeout(() => messageDiv.remove(), duration);
  }
}
window.UIManager = UIManager;`,

    "inputManager.js": `class InputManager {
  constructor() {
    this.keys = {};
    this.currentInput = null;
    this.lastInput = null;
    this.setupEventListeners();
  }
  
  setupEventListeners() {
    document.addEventListener('keydown', (e) => this.handleKeyDown(e));
    document.addEventListener('keyup', (e) => this.handleKeyUp(e));
    
    const controlBtns = document.querySelectorAll('.control-btn[data-direction]');
    controlBtns.forEach(btn => {
      btn.addEventListener('click', (e) => this.handleControlButton(e));
      btn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.handleControlButton(e);
      });
    });
  }
  
  handleKeyDown(event) {
    const key = event.key.toLowerCase();
    this.keys[key] = true;
    
    if (key === 'w' || key === 'arrowup') this.setInput('up');
    else if (key === 's' || key === 'arrowdown') this.setInput('down');
    else if (key === 'a' || key === 'arrowleft') this.setInput('left');
    else if (key === 'd' || key === 'arrowright') this.setInput('right');
    else if (key === ' ') this.setInput('space');
  }
  
  handleKeyUp(event) {
    const key = event.key.toLowerCase();
    this.keys[key] = false;
  }
  
  handleControlButton(event) {
    const direction = event.target.dataset.direction;
    if (direction) this.setInput(direction);
  }
  
  setInput(input) {
    if (input !== this.lastInput) {
      this.currentInput = input;
      this.lastInput = input;
    }
  }
  
  getInput() {
    const input = this.currentInput;
    this.currentInput = null;
    return input;
  }
  
  isKeyPressed(key) {
    return this.keys[key.toLowerCase()] || false;
  }
}
window.InputManager = InputManager;`,

    "renderer.js": `class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = canvas.width;
    this.height = canvas.height;
  }
  
  clear() {
    this.ctx.fillStyle = GameConfig.COLORS.BACKGROUND;
    this.ctx.fillRect(0, 0, this.width, this.height);
  }
  
  drawRect(x, y, width, height, color = GameConfig.COLORS.PRIMARY) {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x, y, width, height);
  }
  
  drawCircle(x, y, radius, color = GameConfig.COLORS.PRIMARY) {
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, 0, 2 * Math.PI);
    this.ctx.fill();
  }
  
  drawText(text, x, y, color = GameConfig.COLORS.UI_TEXT, font = '20px Arial') {
    this.ctx.fillStyle = color;
    this.ctx.font = font;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(text, x, y);
  }
  
  drawLine(x1, y1, x2, y2, color = '#333333', width = 1) {
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = width;
    this.ctx.beginPath();
    this.ctx.moveTo(x1, y1);
    this.ctx.lineTo(x2, y2);
    this.ctx.stroke();
  }
}
window.Renderer = Renderer;`,

    "gameObjects.js": `class GameObject {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
    this.active = true;
    this.width = GameConfig.GRID_SIZE;
    this.height = GameConfig.GRID_SIZE;
  }
  
  update() {
    // Override in subclasses
  }
  
  render(renderer) {
    // Override in subclasses
    renderer.drawRect(this.x, this.y, this.width, this.height);
  }
  
  destroy() {
    this.active = false;
  }
  
  getBounds() {
    return {
      left: this.x,
      right: this.x + this.width,
      top: this.y,
      bottom: this.y + this.height
    };
  }
  
  collidesWith(other) {
    const a = this.getBounds();
    const b = other.getBounds();
    return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
  }
}

class Player extends GameObject {
  constructor(x, y) {
    super(x, y);
    this.color = GameConfig.COLORS.PRIMARY;
    this.speed = GameConfig.GRID_SIZE;
    this.direction = { x: 1, y: 0 };
  }
  
  update(input) {
    if (input) {
      switch (input) {
        case 'up': this.direction = { x: 0, y: -1 }; break;
        case 'down': this.direction = { x: 0, y: 1 }; break;
        case 'left': this.direction = { x: -1, y: 0 }; break;
        case 'right': this.direction = { x: 1, y: 0 }; break;
      }
    }
  }
  
  move() {
    this.x += this.direction.x * this.speed;
    this.y += this.direction.y * this.speed;
  }
  
  render(renderer) {
    renderer.drawRect(this.x, this.y, this.width, this.height, this.color);
  }
}

window.GameObject = GameObject;
window.Player = Player;`,

    "main.js": `document.addEventListener('DOMContentLoaded', () => {
  console.log('Initializing game...');
  
  const canvas = document.getElementById('gameCanvas');
  
  if (!canvas) {
    console.error('Canvas element not found');
    return;
  }

  function resizeCanvas() {
    const container = canvas.parentElement;
    const maxWidth = Math.min(container.clientWidth - 40, 600);
    const maxHeight = Math.min(container.clientHeight - 200, 600);
    const size = Math.min(maxWidth, maxHeight);
    
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';
  }
  
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  try {
    const audioManager = new AudioManager();
    const uiManager = new UIManager();
    const inputManager = new InputManager();
    const renderer = new Renderer(canvas);
    
    const game = new GameManager(canvas, audioManager, uiManager, inputManager, renderer);
    
    window.game = game;

    console.log('Game initialized successfully!');
    uiManager.showMessage('Game Ready! Use arrow keys or buttons to play.', 3000);
    
  } catch (error) {
    console.error('Failed to initialize game:', error);
    alert('Failed to initialize game. Please refresh the page.');
  }
});`,
  }

  // Add missing files using templates
  missingFiles.forEach((fileName) => {
    if (fileTemplates[fileName]) {
      completeFiles.push({
        name: fileName,
        content: fileTemplates[fileName],
        type: fileName.endsWith(".html") ? "html" : "js",
      })
      console.log(chalk.yellow(`🔧 Auto-generated ${fileName}`))
    }
  })

  return completeFiles
}

// Nginx deployment function
async function deployToNginx(subdomain, files, prompt, chatId, sendEvent) {
  const { exec } = await import("child_process");
  const util = await import("util");
  const execAsync = util.promisify(exec);

  try {
    // Sanitize subdomain
    const sanitizedSubdomain = subdomain
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "")
      .substring(0, 63);
    if (!sanitizedSubdomain) throw new Error("Invalid subdomain");

    // Create generated project directory
    const generatedPath = path.isAbsolute(GENERATED_PROJECTS_PATH)
      ? path.join(GENERATED_PROJECTS_PATH, sanitizedSubdomain)
      : path.join(__dirname, GENERATED_PROJECTS_PATH, sanitizedSubdomain);
    await fs.ensureDir(generatedPath);

    console.log(chalk.cyan(`📁 Creating project in ${generatedPath}`));

    // Save all files
    for (const file of files) {
      const filePath = path.join(generatedPath, file.name);
      await fs.writeFile(filePath, file.content);
      console.log(chalk.green(`✅ Saved ${file.name}`));
    }

    // Create package.json
    const packageJson = {
      name: `web-game-${sanitizedSubdomain}`,
      version: "1.0.0",
      description: `AI Generated Web Game: ${prompt}`,
      main: "index.html",
      scripts: {
        start: "npx serve . -p 3000",
        build: "mkdir -p dist && cp -r *.html *.js *.css *.json dist/ 2>/dev/null || cp -r *.html *.js *.css *.json build/ 2>/dev/null || echo 'Static files copied'",
        dev: "npx serve . -p 3000",
      },
      keywords: ["game", "html5", "canvas", "ai-generated"],
      author: "AI Generator",
      license: "MIT",
    };
    await fs.writeFile(path.join(generatedPath, "package.json"), JSON.stringify(packageJson, null, 2));

    sendEvent("progress", {
      step: 3,
      totalSteps: 4,
      stepName: "Building Project",
      progress: 88,
      message: "Running npm install and build...",
    });

    // Run npm install
    console.log(chalk.cyan(`📦 Running npm install in ${generatedPath}`));
    try {
      await execAsync("npm install", { cwd: generatedPath, timeout: 60000 });
    } catch (installError) {
      console.log(chalk.yellow("npm install had issues, continuing with build..."));
    }

    // Run build
    console.log(chalk.cyan(`🔨 Running build in ${generatedPath}`));
    try {
      await execAsync("npm run build", { cwd: generatedPath, timeout: 30000 });
    } catch (buildError) {
      console.log(chalk.yellow("Build command had issues, using source files directly..."));
    }

    // Determine build output directory
    const distPath = path.join(generatedPath, "dist");
    const buildPath = path.join(generatedPath, "build");
    let buildOutputPath = generatedPath;

    if (await fs.pathExists(distPath)) {
      buildOutputPath = distPath;
      console.log(chalk.green("✅ Using dist/ output"));
    } else if (await fs.pathExists(buildPath)) {
      buildOutputPath = buildPath;
      console.log(chalk.green("✅ Using build/ output"));
    } else {
      console.log(chalk.yellow("⚠️ No build output found, using source files"));
    }

    // Create nginx project directory
    const nginxPath = path.isAbsolute(NGINX_PROJECTS_PATH)
      ? path.join(NGINX_PROJECTS_PATH, sanitizedSubdomain + ".claw.codes")
      : path.join(__dirname, NGINX_PROJECTS_PATH, sanitizedSubdomain + ".claw.codes");
    await fs.ensureDir(nginxPath);

    // Copy build output to nginx directory
    console.log(chalk.cyan(`📋 Copying from ${buildOutputPath} to ${nginxPath}`));
    await fs.copy(buildOutputPath, nginxPath, { overwrite: true });

    sendEvent("progress", {
      step: 3,
      totalSteps: 4,
      stepName: "Reloading Nginx",
      progress: 96,
      message: "Reloading nginx configuration...",
    });

    // Reload nginx with sudo
    console.log(chalk.cyan("🔄 Reloading nginx..."));
    try {
      await execAsync("sudo nginx -t");
      await execAsync("sudo nginx -s reload");
      console.log(chalk.green("✅ Nginx reloaded successfully"));
    } catch (nginxError) {
      console.log(chalk.yellow("⚠️ Nginx reload had issues:", nginxError.message));
      sendEvent("error", {
        error: "Nginx reload failed",
        details: nginxError.message,
        chatId,
      });
    }

    // Log deployment
    const deployLogPath = path.isAbsolute(DEPLOY_LOG_PATH) ? DEPLOY_LOG_PATH : path.join(__dirname, DEPLOY_LOG_PATH);
    const deployTime = new Date().toISOString();
    const logEntry = `${deployTime} - Deployed ${sanitizedSubdomain}.claw.codes (Chat ${chatId}) - ${prompt.slice(0, 100)}\n`;
    try {
      await fs.appendFile(deployLogPath, logEntry);
    } catch (logError) {
      console.log(chalk.yellow("⚠️ Could not write to deploy log:", logError.message));
    }

    // Update DEPLOYED_URLS with both HTTP and HTTPS
    const httpUrl = `http://${sanitizedSubdomain}.claw.codes`;
    const httpsUrl = `https://${sanitizedSubdomain}.claw.codes`;
    try {
      const currentUrls = process.env.DEPLOYED_URLS || "";
      const newUrls = [httpUrl, httpsUrl].filter(url => !currentUrls.includes(url));
      const updatedUrls = [...newUrls, ...currentUrls.split(",").filter(Boolean)].join(",");
      process.env.DEPLOYED_URLS = updatedUrls;
      console.log(chalk.green(`✅ Updated DEPLOYED_URLS: ${updatedUrls}`));
    } catch (envError) {
      console.log(chalk.yellow("⚠️ Could not update DEPLOYED_URLS:", envError.message));
    }

    console.log(chalk.green(`🚀 Successfully deployed to ${httpsUrl} and ${httpUrl}`));
    return { httpUrl, httpsUrl };
  } catch (error) {
    console.error(chalk.red(`❌ Nginx deployment failed:`, error.message));
    sendEvent("error", {
      error: "Deployment failed",
      details: error.message,
      chatId,
    });
    throw new Error(`Deployment failed: ${error.message}`);
  }
}

/**
 * @swagger
 * /api/generate/full:
 *   post:
 *     summary: Generate web game using full 4-step AI chain (Groq → Qwen3 → Anthropic → Qwen3)
 *     description: |
 *       Streams the generation process of an HTML5 Canvas web game using the complete 4-step AI chain.
 *       Returns Server-Sent Events (SSE) with progress updates and all generated files.
 *
 *       **Chain Steps:**
 *       1. Groq (LLaMA 3.3 70B) - Game explanation and architecture
 *       2. Qwen3 Coder - Initial complete code generation
 *       3. Anthropic (Claude 3 Haiku) - Code validation and feedback
 *       4. Qwen3 Coder - Final code fixes and improvements
 *
 *       **Stream Events:**
 *       - `progress` - Progress updates with step information
 *       - `step_complete` - Completion of individual chain steps
 *       - `file_generated` - Individual file content as it's generated
 *       - `complete` - Final completion with project metadata
 *       - `error` - Error information if generation fails
 *     tags:
 *       - Game Generation
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/GamePrompt'
 *           examples:
 *             complex_game:
 *               summary: Complex Game with Validation
 *               value:
 *                 prompt: "Create a complex Pac-Man game with HTML5 Canvas, maze navigation, ghost AI, power pellets, score system, and responsive mobile controls"
 *     responses:
 *       200:
 *         description: Server-Sent Events stream with generation progress and files
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 *               description: |
 *                 Stream of events in Server-Sent Events format with additional step completion events:
 *
 *                 \`\`\`
 *                 event: progress
 *                 data: {"step": 3, "totalSteps": 4, "stepName": "Anthropic Validation", "progress": 75, "message": "Validating generated code..."}
 *
 *                 event: step_complete
 *                 data: {"step": 3, "stepName": "Anthropic Validation", "output": "Code validation completed with 3 issues found"}
 *
 *                 event: file_generated
 *                 data: {"fileName": "gameManager.js", "fileType": "js", "content": "class GameManager { ... }", "size": 3072}
 *
 *                 event: complete
 *                 data: {"chatId": 124, "projectId": "uuid", "totalFiles": 10, "chainUsed": "full"}
 *                 \`\`\`
 *       400:
 *         description: Invalid request - missing or invalid prompt
 *       500:
 *         description: Internal server error during generation
 */
app.post("/api/generate/full", async (req, res) => {
  const chatId = chatCounter++

  // Set up Server-Sent Events
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
    sendEvent("progress", {
      step: 1,
      totalSteps: 4,
      stepName: "Groq Architecture",
      progress: 10,
      message: "Getting comprehensive game explanation from Groq...",
    })

    const groqExplanation = await llmProvider.getGameExplanation(prompt, chatId)

    sendEvent("step_complete", {
      step: 1,
      stepName: "Groq Architecture",
      output: `Game architecture explanation completed (${groqExplanation.length} characters)`,
    })

    // Step 2: Qwen3 initial code
    sendEvent("progress", {
      step: 2,
      totalSteps: 4,
      stepName: "Qwen3 Initial Code",
      progress: 30,
      message: "Generating initial complete code with Qwen3...",
    })

    const qwenInitialCode = await llmProvider.generateCleanCodeWithQwen(groqExplanation, prompt, chatId)

    sendEvent("step_complete", {
      step: 2,
      stepName: "Qwen3 Initial Code",
      output: `Initial code generation completed (${qwenInitialCode.length} characters)`,
    })

    // Step 3: Anthropic validation
    sendEvent("progress", {
      step: 3,
      totalSteps: 4,
      stepName: "Anthropic Validation",
      progress: 60,
      message: "Validating code with Anthropic and providing feedback...",
    })

    const anthropicFeedback = await llmProvider.validateWithAnthropic(qwenInitialCode, prompt, chatId)

    sendEvent("step_complete", {
      step: 3,
      stepName: "Anthropic Validation",
      output: `Code validation completed with detailed feedback (${anthropicFeedback.length} characters)`,
    })

    // Step 4: Qwen3 final fixes
    sendEvent("progress", {
      step: 4,
      totalSteps: 4,
      stepName: "Qwen3 Final Fixes",
      progress: 80,
      message: "Generating final fixed code with Qwen3...",
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

    // Parse and clean files
    sendEvent("progress", {
      step: 4,
      totalSteps: 4,
      stepName: "File Processing",
      progress: 90,
      message: "Parsing and cleaning generated files...",
    })

    const validationResult = validateAndParseWebGameFiles(qwenFinalCode, chatId)
    const completeFiles = createCompleteFileStructure(validationResult.files, validationResult.missingFiles, prompt)

    // Stream each file
    sendEvent("progress", {
      step: 4,
      totalSteps: 4,
      stepName: "File Streaming",
      progress: 95,
      message: `Streaming ${completeFiles.length} files...`,
    })

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

    // Generate project metadata
    const projectId = uuidv4()

    // Save files to disk and setup project
    sendEvent("progress", {
      step: 4,
      totalSteps: 4,
      stepName: "Project Setup",
      progress: 98,
      message: "Saving files and setting up project...",
    })

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
        startCommand: "npm start",
        serveCommand: "npx serve . -p 3000",
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
  const chatId = chatCounter++;
  // Set up Server-Sent Events
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Cache-Control",
  });

  const sendEvent = (event, data) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify({ ...data, timestamp: new Date().toISOString() })}\n\n`);
  };

  try {
    const { prompt, subdomain } = req.body;
    const nginxEnabled = process.env.NGINX_ENABLED === "true";
    console.log(chalk.cyan(`🔍 Debug - NGINX_ENABLED: ${process.env.NGINX_ENABLED}`));
    console.log(chalk.cyan(`🔍 Debug - nginxEnabled: ${nginxEnabled}`));
    console.log(chalk.cyan(`🔍 Debug - subdomain: ${subdomain}`));
    console.log(chalk.cyan(`🔍 Debug - Will deploy to nginx: ${nginxEnabled && subdomain}`));

    if (!prompt || !prompt.trim()) {
      sendEvent("error", {
        error: "Game description is required",
        chatId,
      });
      res.end();
      return;
    }

    // Check if nginx deployment is requested
    if (nginxEnabled && subdomain) {
      console.log(chalk.blue(`Starting NGINX deployment for subdomain: ${subdomain}`));
      sendEvent("progress", {
        step: 0,
        totalSteps: 2,
        stepName: "Initialization",
        progress: 0,
        message: `Starting nginx deployment for ${subdomain}.claw.codes...`,
      });
    } else {
      console.log(chalk.blue(`Starting SIMPLE chain generation for Chat ${chatId}`));
      sendEvent("progress", {
        step: 0,
        totalSteps: 2,
        stepName: "Initialization",
        progress: 0,
        message: "Starting simple AI chain (Groq → Qwen3)...",
      });
    }

    console.log(chalk.blue(`Game Request: ${prompt}`));

    // Step 1: Groq explanation
    sendEvent("progress", {
      step: 1,
      totalSteps: 2,
      stepName: "Groq Architecture",
      progress: 25,
      message: "Getting comprehensive game explanation from Groq...",
    });
    const groqExplanation = await llmProvider.getGameExplanation(prompt, chatId);
    sendEvent("progress", {
      step: 1,
      totalSteps: 2,
      stepName: "Groq Architecture",
      progress: 50,
      message: "Game architecture explanation completed",
    });

    // Step 2: Qwen3 code generation
    sendEvent("progress", {
      step: 2,
      totalSteps: 2,
      stepName: "Qwen3 Code Generation",
      progress: 60,
      message: "Generating clean, production-ready code with Qwen3...",
    });
    const qwenFinalCode = await llmProvider.generateCleanCodeWithQwen(groqExplanation, prompt, chatId);
    sendEvent("progress", {
      step: 2,
      totalSteps: 2,
      stepName: "Qwen3 Code Generation",
      progress: 80,
      message: "Code generation completed, parsing files...",
    });

    // Parse and clean files
    const validationResult = validateAndParseWebGameFiles(qwenFinalCode, chatId);
    const completeFiles = createCompleteFileStructure(validationResult.files, validationResult.missingFiles, prompt);

    // Stream each file
    sendEvent("progress", {
      step: 2,
      totalSteps: 2,
      stepName: "File Processing",
      progress: 90,
      message: `Streaming ${completeFiles.length} files...`,
    });
    completeFiles.forEach((file, index) => {
      sendEvent("file_generated", {
        fileName: file.name,
        fileType: file.type,
        content: file.content,
        size: file.content.length,
        index: index + 1,
        totalFiles: completeFiles.length,
      });
    });

    // Generate project metadata
    const projectId = uuidv4();

    // Check if nginx deployment is enabled and subdomain provided
    if (nginxEnabled && subdomain) {
      // Deploy to nginx
      const { httpUrl, httpsUrl } = await deployToNginx(subdomain, completeFiles, prompt, chatId, sendEvent);
      sendEvent("complete", {
        chatId,
        projectId: subdomain,
        totalFiles: completeFiles.length,
        aiGeneratedFiles: validationResult.files.length,
        missingFilesGenerated: validationResult.missingFiles.length,
        chainUsed: "simple",
        deploymentType: "nginx",
        chainSteps: ["Groq - Game explanation and architecture", "Qwen3 - Complete clean code generation"],
        setupInstructions: {
          previewUrl: httpUrl, // Use HTTPS as previewUrl
          httpUrl: httpsUrl, // Optional: include HTTP for reference
          subdomain: subdomain,
          nginxPath: `/var/www/projects/${subdomain}.claw.codes`,
          generatedPath: `generated/${subdomain}`,
        },
        validation: {
          isComplete: validationResult.isComplete,
          totalFiles: completeFiles.length,
          originalFiles: validationResult.files.length,
          missingFiles: validationResult.missingFiles,
        },
      });
      console.log(chalk.green(`NGINX deployment completed for Chat ${chatId}!`));
      console.log(chalk.green(`🌐 Game deployed at: ${httpUrl}, ${httpsUrl}`));
    } else {
      // Original localhost behavior
      sendEvent("progress", {
        step: 2,
        totalSteps: 2,
        stepName: "Project Setup",
        progress: 95,
        message: "Saving files and setting up project...",
      });
      const projectPath = await saveGeneratedFiles(projectId, completeFiles);
      const serverInfo = await setupAndRunProject(projectPath);
      sendEvent("complete", {
        chatId,
        projectId,
        totalFiles: completeFiles.length,
        aiGeneratedFiles: validationResult.files.length,
        missingFilesGenerated: validationResult.missingFiles.length,
        chainUsed: "simple",
        deploymentType: "localhost",
        chainSteps: ["Groq - Game explanation and architecture", "Qwen3 - Complete clean code generation"],
        setupInstructions: {
          npmInstall: "npm install",
          startCommand: "npm start",
          serveCommand: "npx serve . -p 3000",
          previewUrl: serverInfo.url, // Use serverInfo.url as previewUrl for consistency
          port: serverInfo.port,
          projectPath: projectPath,
        },
        validation: {
          isComplete: validationResult.isComplete,
          totalFiles: completeFiles.length,
          originalFiles: validationResult.files.length,
          missingFiles: validationResult.missingFiles,
        },
      });
      console.log(chalk.green(`SIMPLE chain completed for Chat ${chatId}!`));
      console.log(chalk.green(`🎮 Game is running at: ${serverInfo.url}`));
    }
  } catch (error) {
    console.error(chalk.red(`Error in Simple Chain Chat ${chatId}:`, error.message));
    sendEvent("error", {
      error: "Failed to generate web game",
      details: error.message,
      chatId,
    });
  }
  res.end();
});

// ============================================================================
// START THE SERVER
// ============================================================================

app.listen(PORT, () => {
  console.log(chalk.green(`✅ Server is running on http://localhost:${PORT}`))
  console.log(chalk.blue(`📖 API Docs available at http://localhost:${PORT}/api-docs`))
})
