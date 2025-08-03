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
const PORT = process.env.PORT || 3000

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
      
      server.once('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          // Port is in use
          resolve(false)
        } else {
          // Some other error
          resolve(false)
        }
      })
      
      server.once('listening', () => {
        server.close(() => {
          // Port is available
          resolve(true)
        })
      })
      
      server.listen(port, '127.0.0.1')
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
  
  throw new Error('No available port found in range ' + startPort + '-' + (startPort + 100))
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
      dev: "npx serve . -p 8080"
    },
    keywords: ["game", "html5", "canvas"],
    author: "AI Generator",
    license: "MIT"
  }

  await fs.writeFile(
    path.join(projectPath, 'package.json'),
    JSON.stringify(packageJson, null, 2)
  )

  return projectPath
}

// Run npm install and start server
// Replace the setupAndRunProject function with this improved version:
async function setupAndRunProject(projectPath) {
  return new Promise(async (resolve, reject) => {
    try {
      console.log(chalk.cyan(`📦 Running npm install in ${projectPath}...`))

      // Run npm install
      const npmInstall = spawn('npm', ['install'], {
        cwd: projectPath,
        shell: true,
        stdio: 'pipe'
      })

      npmInstall.on('close', async (code) => {
        if (code !== 0) {
          console.log(chalk.yellow('npm install skipped or had issues (continuing anyway)'))
        }

        // Find available port
        const port = await findAvailablePort(8000)
        console.log(chalk.cyan(`🚀 Starting server on port ${port}...`))

        // Start the server
        const serverProcess = spawn('npx', ['serve', '.', '-p', port.toString()], {
          cwd: projectPath,
          shell: true,
          stdio: 'pipe',
          detached: false
        })

        // Check if server started successfully
        let serverStarted = false
        
         serverProcess.stdout.on('data', (data) => {
          const output = data.toString();
          console.log(chalk.gray(`Server output: ${output}`));
        
          // Regex to extract port from Serve's standard message
          const match = output.match(/http:\/\/localhost:(\d+)/);
          if (match && !serverStarted) {
            serverStarted = true;
            const realPort = match[1];
            const serverUrl = `http://localhost:${realPort}`;
            console.log(chalk.green(`✅ Server running at ${serverUrl}`));
            resolve({
              url: serverUrl,
              port: parseInt(realPort),
              process: serverProcess
            });
          } else if (!serverStarted && (output.includes('localhost') || output.includes('Listening'))) {
            // Fallback: if regex doesn't work but message looks server-like
            setTimeout(() => {
              if (!serverStarted) {
                const serverUrl = `http://localhost:${port}`;
                console.log(chalk.yellow(`⚠️  Fall back to assumed URL: ${serverUrl}`));
                resolve({
                  url: serverUrl,
                  port: port,
                  process: serverProcess
                });
              }
            }, 1000);
          }
        });

        serverProcess.stderr.on('data', (data) => {
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
              process: serverProcess
            })
          }
        }, 5000)

        serverProcess.on('error', (error) => {
          console.error(chalk.red('Server error:', error))
          if (!serverStarted) {
            reject(error)
          }
        })
      })

      npmInstall.on('error', (error) => {
        console.error(chalk.red('npm install error:', error))
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

// ============================================================================
// STREAMING API ENDPOINTS
// ============================================================================

/**
 * @swagger
 * /api/generate/simple:
 *   post:
 *     summary: Generate web game using simple 2-step AI chain (Groq → Qwen3)
 *     description: |
 *       Streams the generation process of an HTML5 Canvas web game using a simplified 2-step AI chain.
 *       Returns Server-Sent Events (SSE) with progress updates and all generated files.
 *
 *       **Chain Steps:**
 *       1. Groq (LLaMA 3.3 70B) - Game explanation and architecture
 *       2. Qwen3 Coder - Complete clean code generation
 *
 *       **Stream Events:**
 *       - `progress` - Progress updates with step information
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
 *             snake_game:
 *               summary: Snake Game
 *               value:
 *                 prompt: "Create a Snake game with HTML5 Canvas, smooth movement, food collection, score system, collision detection, and responsive mobile controls"
 *             tetris_game:
 *               summary: Tetris Game
 *               value:
 *                 prompt: "Build a Tetris game with HTML5 Canvas, piece rotation, line clearing, increasing difficulty, and responsive design"
 *     responses:
 *       200:
 *         description: Server-Sent Events stream with generation progress and files
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 *               description: |
 *                 Stream of events in Server-Sent Events format:
 *
 *                 ```
 *                 event: progress
 *                 data: {"step": 1, "totalSteps": 2, "stepName": "Groq Architecture", "progress": 25, "message": "Getting game explanation..."}
 *
 *                 event: file_generated
 *                 data: {"fileName": "index.html", "fileType": "html", "content": "<!DOCTYPE html>...", "size": 1234}
 *
 *                 event: complete
 *                 data: {"chatId": 123, "projectId": "uuid", "totalFiles": 10, "chainUsed": "simple"}
 *                 ```
 *             examples:
 *               progress_event:
 *                 summary: Progress Event
 *                 value: |
 *                   event: progress
 *                   data: {"step": 1, "totalSteps": 2, "stepName": "Groq Architecture", "progress": 50, "message": "Generating game explanation..."}
 *               file_event:
 *                 summary: File Generated Event
 *                 value: |
 *                   event: file_generated
 *                   data: {"fileName": "gameManager.js", "fileType": "js", "content": "class GameManager { ... }", "size": 2048}
 *       400:
 *         description: Invalid request - missing or invalid prompt
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Game description is required"
 *       500:
 *         description: Internal server error during generation
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 *               example: |
 *                 event: error
 *                 data: {"error": "AI generation failed", "details": "Connection timeout", "chatId": 123}
 */
app.post("/api/generate/simple", async (req, res) => {
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

    console.log(chalk.blue(`Starting SIMPLE chain generation for Chat ${chatId}`))
    console.log(chalk.blue(`Game Request: ${prompt}`))

    sendEvent("progress", {
      step: 0,
      totalSteps: 2,
      stepName: "Initialization",
      progress: 0,
      message: "Starting simple AI chain (Groq → Qwen3)...",
    })

    // Step 1: Groq explanation
    sendEvent("progress", {
      step: 1,
      totalSteps: 2,
      stepName: "Groq Architecture",
      progress: 25,
      message: "Getting comprehensive game explanation from Groq...",
    })

    const groqExplanation = await llmProvider.getGameExplanation(prompt, chatId)

    sendEvent("progress", {
      step: 1,
      totalSteps: 2,
      stepName: "Groq Architecture",
      progress: 50,
      message: "Game architecture explanation completed",
    })

    // Step 2: Qwen3 code generation
    sendEvent("progress", {
      step: 2,
      totalSteps: 2,
      stepName: "Qwen3 Code Generation",
      progress: 60,
      message: "Generating clean, production-ready code with Qwen3...",
    })

    const qwenFinalCode = await llmProvider.generateCleanCodeWithQwen(groqExplanation, prompt, chatId)

    sendEvent("progress", {
      step: 2,
      totalSteps: 2,
      stepName: "Qwen3 Code Generation",
      progress: 80,
      message: "Code generation completed, parsing files...",
    })

    // Parse and clean files
    const validationResult = validateAndParseWebGameFiles(qwenFinalCode, chatId)
    const completeFiles = createCompleteFileStructure(validationResult.files, validationResult.missingFiles, prompt)

    // Stream each file
    sendEvent("progress", {
      step: 2,
      totalSteps: 2,
      stepName: "File Processing",
      progress: 90,
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
      step: 2,
      totalSteps: 2,
      stepName: "Project Setup",
      progress: 95,
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
        chainUsed: "simple",
        chainSteps: ["Groq - Game explanation and architecture", "Qwen3 - Complete clean code generation"],
        setupInstructions: {
          npmInstall: "npm install",
          startCommand: "npm start",
          serveCommand: "npx serve . -p 3000",
          url: serverInfo.url,
          liveUrl: serverInfo.url,
          port: serverInfo.port,
          projectPath: projectPath
        },
        validation: {
          isComplete: validationResult.isComplete,
          totalFiles: completeFiles.length,
          originalFiles: validationResult.files.length,
          missingFiles: validationResult.missingFiles,
        },
      })
      console.log(chalk.green(`SIMPLE chain completed for Chat ${chatId}!`))
      console.log(chalk.green(`🎮 Game is running at: ${serverInfo.url}`))    
  
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
 *                 ```
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
 *                 ```
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
        projectPath: projectPath
      },
      validation: {
        isComplete: validationResult.isComplete,
        totalFiles: completeFiles.length,
        originalFiles: validationResult.files.length,
        missingFiles: validationResult.missingFiles,
      },
      chainDetails: {
        groqExplanationLength: groqExplanation.length,
        qwenInitialCodeLength: qwenInitialCode.length,
        anthropicFeedbackLength: anthropicFeedback.length,
        qwenFinalCodeLength: qwenFinalCode.length,
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

// ============================================================================
// ADDITIONAL API ENDPOINTS
// ============================================================================

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Health check endpoint
 *     description: Returns the current status of the API and all connected services
 *     tags:
 *       - System
 *     responses:
 *       200:
 *         description: API is healthy and all services are operational
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "healthy"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 chatCounter:
 *                   type: integer
 *                   description: Number of chat sessions processed
 *                 services:
 *                   type: object
 *                   properties:
 *                     groq:
 *                       type: boolean
 *                       description: Groq API availability
 *                     anthropic:
 *                       type: boolean
 *                       description: Anthropic API availability
 *                     openrouter:
 *                       type: boolean
 *                       description: OpenRouter API availability
 *                     langsmith:
 *                       type: boolean
 *                       description: LangSmith tracing availability
 *                 chains:
 *                   type: object
 *                   properties:
 *                     simple:
 *                       type: string
 *                       example: "Groq → Qwen3"
 *                     full:
 *                       type: string
 *                       example: "Groq → Qwen3 → Anthropic → Qwen3"
 */
app.get("/api/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    chatCounter: chatCounter - 1,
    activeConversations: conversationContexts.size,
    services: {
      groq: Boolean(process.env.GROQ_API_KEY),
      anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
      openrouter: Boolean(process.env.OPENROUTER_API_KEY),
      langsmith: Boolean(process.env.LANGSMITH_API_KEY),
    },
    chains: {
      simple: "Groq → Qwen3 (2 steps)",
      full: "Groq → Qwen3 → Anthropic → Qwen3 (4 steps)",
    },
    features: {
      streaming: true,
      fileGeneration: true,
      codeCleanup: true,
      npmSetup: true,
    },
  })
})

/**
 * @swagger
 * /:
 *   get:
 *     summary: API documentation and testing interface
 *     description: Returns an HTML interface for testing the streaming API endpoints
 *     tags:
 *       - System
 *     responses:
 *       200:
 *         description: HTML testing interface
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 */
app.get("/", (req, res) => {
  res.send(`<!DOCTYPE html>
<html>
<head>
    <title>Web Game AI Generator - Streaming API</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; background: #1a1a2e; color: white; }
        h1 { color: #ff8c00; text-align: center; }
        .api-section { background: #2a2a3e; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .api-section h3 { color: #4CAF50; margin-top: 0; }
        .endpoint { background: #333; padding: 15px; border-radius: 5px; margin: 10px 0; }
        .method { display: inline-block; padding: 5px 10px; border-radius: 3px; font-weight: bold; margin-right: 10px; }
        .post { background: #ff6b35; }
        .get { background: #4CAF50; }
        .form-group { margin: 15px 0; }
        label { display: block; margin-bottom: 5px; color: #ff8c00; font-weight: bold; }
        textarea, select { width: 100%; padding: 10px; background: #444; color: white; border: 1px solid #666; border-radius: 5px; }
        button { background: #ff8c00; color: white; padding: 12px 25px; border: none; border-radius: 5px; cursor: pointer; margin: 5px; }
        button:hover { background: #ff6600; }
        button:disabled { background: #666; cursor: not-allowed; }
        .output { background: #222; padding: 15px; border-radius: 5px; margin-top: 15px; max-height: 400px; overflow-y: auto; font-family: monospace; font-size: 14px; }
        .event { margin: 5px 0; padding: 8px; border-left: 3px solid #4CAF50; background: rgba(76, 175, 80, 0.1); }
        .error { border-left-color: #f44336; background: rgba(244, 67, 54, 0.1); }
        .file { border-left-color: #2196F3; background: rgba(33, 150, 243, 0.1); }
        .complete { border-left-color: #ff8c00; background: rgba(255, 140, 0, 0.1); }
        .links { margin-top: 20px; text-align: center; }
        .links a { display: inline-block; margin: 10px; padding: 15px 25px; background: #007bff; color: white; text-decoration: none; border-radius: 5px; }
        .links a:hover { background: #0056b3; }
        .game-url { color: #4CAF50; font-weight: bold; text-decoration: underline; cursor: pointer; }
    </style>
</head>
<body>
    <h1>🚀 Web Game AI Generator - Streaming API</h1>
    
    <div class="api-section">
        <h3>📡 Available Endpoints</h3>
        <div class="endpoint">
            <span class="method post">POST</span>
            <strong>/api/generate/simple</strong> - 2-Step Chain (Groq → Qwen3)
            <p>Fast generation with clean code output. No validation step.</p>
        </div>
        <div class="endpoint">
            <span class="method post">POST</span>
            <strong>/api/generate/full</strong> - 4-Step Chain (Groq → Qwen3 → Anthropic → Qwen3)
            <p>Complete generation with validation and fixes. Higher quality output.</p>
        </div>
        <div class="endpoint">
            <span class="method get">GET</span>
            <strong>/api/health</strong> - Health Check
            <p>Check API status and service availability.</p>
        </div>
        <div class="endpoint">
            <span class="method get">GET</span>
            <strong>/api-docs</strong> - Swagger Documentation
            <p>Complete OpenAPI documentation with interactive testing.</p>
        </div>
    </div>
    
    <div class="api-section">
        <h3>🧪 Test Streaming API</h3>
        <form id="testForm">
            <div class="form-group">
                <label>API Endpoint:</label>
                <select id="endpoint">
                    <option value="/api/generate/simple">Simple Chain (2 steps)</option>
                    <option value="/api/generate/full">Full Chain (4 steps)</option>
                </select>
            </div>
            <div class="form-group">
                <label>Game Description:</label>
                <textarea id="prompt" rows="4" placeholder="Create a Snake game with HTML5 Canvas, smooth movement, food collection, score system, collision detection, and responsive mobile controls..."></textarea>
            </div>
            <button type="submit" id="generateBtn">🚀 Start Streaming Generation</button>
            <button type="button" id="clearBtn">🗑️ Clear Output</button>
        </form>
        
        <div id="output" class="output" style="display: none;">
            <div id="events"></div>
        </div>
    </div>
    
    <div class="links">
        <a href="/api-docs" target="_blank">📚 Swagger Documentation</a>
        <a href="/api/health" target="_blank">🏥 Health Check</a>
        <a href="https://github.com/your-repo" target="_blank">📦 GitHub Repository</a>
    </div>

    <script>
        let eventSource = null;
        let fileCount = 0;
        
        document.getElementById('testForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const endpoint = document.getElementById('endpoint').value;
            const prompt = document.getElementById('prompt').value;
            const generateBtn = document.getElementById('generateBtn');
            const output = document.getElementById('output');
            const events = document.getElementById('events');
            
            if (!prompt.trim()) {
                alert('Please enter a game description');
                return;
            }
            
            // Close existing connection
            if (eventSource) {
                eventSource.close();
            }
            
            generateBtn.disabled = true;
            generateBtn.textContent = '🔄 Generating...';
            output.style.display = 'block';
            events.innerHTML = '<div class="event">🚀 Starting generation...</div>';
            fileCount = 0;
            
            try {
                // Start Server-Sent Events connection
                eventSource = new EventSource(\`\${endpoint}?\${new URLSearchParams({ prompt })}\`);
                
                // For POST request, we need to use fetch with EventSource simulation
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ prompt })
                });
                
                if (!response.ok) {
                    throw new Error(\`HTTP \${response.status}: \${response.statusText}\`);
                }
                
                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    
                    const chunk = decoder.decode(value);
                    const lines = chunk.split('\\n');
                    
                    for (const line of lines) {
                        if (line.startsWith('event: ')) {
                            const eventType = line.substring(7);
                        } else if (line.startsWith('data: ')) {
                            try {
                                const data = JSON.parse(line.substring(6));
                                handleStreamEvent(eventType || 'message', data);
                            } catch (e) {
                                console.warn('Failed to parse event data:', line);
                            }
                        }
                    }
                }
                
            } catch (error) {
                events.innerHTML += \`<div class="event error">❌ Error: \${error.message}</div>\`;
            } finally {
                generateBtn.disabled = false;
                generateBtn.textContent = '🚀 Start Streaming Generation';
            }
        });
        
        function handleStreamEvent(eventType, data) {
            const events = document.getElementById('events');
            let eventHtml = '';
            
            switch (eventType) {
                case 'progress':
                    eventHtml = \`<div class="event">📊 Progress: Step \${data.step}/\${data.totalSteps} - \${data.stepName} (\${data.progress}%) - \${data.message}</div>\`;
                    break;
                    
                case 'step_complete':
                    eventHtml = \`<div class="event">✅ Step \${data.step} Complete: \${data.stepName} - \${data.output}</div>\`;
                    break;
                    
                case 'file_generated':
                    fileCount++;
                    eventHtml = \`<div class="event file">📄 File \${fileCount}: \${data.fileName} (\${data.fileType}, \${data.size} chars)</div>\`;
                    break;
                    
                case 'complete':
                    eventHtml = \`<div class="event complete">🎉 Generation Complete! Chat ID: \${data.chatId}, Files: \${data.totalFiles}, Chain: \${data.chainUsed}</div>\`;
                    if (data.setupInstructions && data.setupInstructions.liveUrl) {
                        eventHtml += \`<div class="event complete">🎮 Game is now running at: <a href="\${data.setupInstructions.liveUrl}" target="_blank" class="game-url">\${data.setupInstructions.liveUrl}</a></div>\`;
                    }
                    eventHtml += \`<div class="event complete">🛠️ Setup: \${data.setupInstructions.npmInstall} → \${data.setupInstructions.startCommand}</div>\`;
                    break;
                    
                case 'error':
                    eventHtml = \`<div class="event error">❌ Error: \${data.error} - \${data.details || ''}</div>\`;
                    break;
                    
                default:
                    eventHtml = \`<div class="event">📨 \${eventType}: \${JSON.stringify(data)}</div>\`;
            }
            
            events.innerHTML += eventHtml;
            events.scrollTop = events.scrollHeight;
        }
        
        document.getElementById('clearBtn').addEventListener('click', () => {
            document.getElementById('events').innerHTML = '';
            document.getElementById('output').style.display = 'none';
            fileCount = 0;
        });
        
        // Set default prompt
        document.getElementById('prompt').value = 'Create a Snake game with HTML5 Canvas, smooth movement, food collection, score system, collision detection, and responsive mobile controls';
    </script>
</body>
</html>`)
})


/**
 * @swagger
 * /api/followup:
 *   post:
 *     summary: Follow-up API for minor code fixes and queries
 *     description: |
 *       Receives test files, reads them, and uses LLaMA (via Groq) to fix issues or make minor changes.
 *       This endpoint is useful for quick iterations on already generated code.
 *     tags:
 *       - Code Modification
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: ["query", "files"]
 *             properties:
 *               query:
 *                 type: string
 *                 description: The fix or change requested
 *                 example: "Fix the collision detection in gameObjects.js - the player goes through walls"
 *               files:
 *                 type: array
 *                 description: Array of files to analyze and modify
 *                 items:
 *                   type: object
 *                   required: ["name", "content"]
 *                   properties:
 *                     name:
 *                       type: string
 *                       description: File name
 *                       example: "gameObjects.js"
 *                     content:
 *                       type: string
 *                       description: File content
 *               projectId:
 *                 type: string
 *                 description: Optional project ID for context
 *                 example: "uuid-1234-5678"
 *           examples:
 *             fix_collision:
 *               summary: Fix collision detection
 *               value:
 *                 query: "Fix the collision detection - player passes through walls"
 *                 files:
 *                   - name: "gameObjects.js"
 *                     content: "class Player extends GameObject { ... }"
 *                   - name: "config.js"
 *                     content: "const GameConfig = { ... }"
 *             add_feature:
 *               summary: Add new feature
 *               value:
 *                 query: "Add a pause functionality when pressing 'P' key"
 *                 files:
 *                   - name: "inputManager.js"
 *                     content: "class InputManager { ... }"
 *                   - name: "gameManager.js"
 *                     content: "class GameManager { ... }"
 *     responses:
 *       200:
 *         description: Successfully processed the follow-up request
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 query:
 *                   type: string
 *                   description: The original query
 *                 analysis:
 *                   type: string
 *                   description: LLaMA's analysis of the issue
 *                 modifiedFiles:
 *                   type: array
 *                   description: Array of modified files
 *                   items:
 *                     type: object
 *                     properties:
 *                       name:
 *                         type: string
 *                         example: "gameObjects.js"
 *                       content:
 *                         type: string
 *                         description: Updated file content
 *                       changes:
 *                         type: string
 *                         description: Summary of changes made
 *                 suggestions:
 *                   type: array
 *                   description: Additional suggestions from LLaMA
 *                   items:
 *                     type: string
 *                 chatId:
 *                   type: integer
 *                   description: Chat session ID for tracking
 *       400:
 *         description: Invalid request
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Query and files are required"
 *       500:
 *         description: Internal server error
 */
app.post("/api/followup", async (req, res) => {
  const chatId = chatCounter++

  try {
    const { query, files, projectId } = req.body

    // Validation
    if (!query || !query.trim()) {
      return res.status(400).json({
        error: "Query is required",
        chatId,
      })
    }

    if (!files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({
        error: "Files array is required and must not be empty",
        chatId,
      })
    }

    // Validate file structure
    for (const file of files) {
      if (!file.name || !file.content) {
        return res.status(400).json({
          error: "Each file must have 'name' and 'content' properties",
          chatId,
        })
      }
    }

    console.log(chalk.blue(`Processing follow-up request for Chat ${chatId}`))
    console.log(chalk.blue(`Query: ${query}`))
    console.log(chalk.blue(`Files provided: ${files.map(f => f.name).join(", ")}`))

    // Prepare the context for LLaMA
    const fileContext = files.map(file => {
      return `// === ${file.name} ===\n${file.content}`
    }).join("\n\n")

    // Create the prompt for LLaMA
    const followUpPrompt = `You are an expert game developer assistant. A user has already generated a web game and needs help with the following:

USER QUERY: ${query}

PROJECT ID: ${projectId || 'Not specified'}

CURRENT FILES:
${fileContext}

Please:
1. Analyze the issue or requested change
2. Provide the complete updated code for any files that need modification
3. Explain what changes were made and why
4. Suggest any additional improvements if relevant

IMPORTANT: 
- Return the complete file content, not just snippets
- Maintain the same code structure and style
- Ensure all changes are compatible with the existing code
- For each modified file, use the format: // === filename.js === followed by the complete code

Provide your analysis first, then the updated files.`

    // Call LLaMA via Groq for the follow-up
    const groqResponse = await llmProvider.groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: "You are an expert game developer. Help fix issues and make improvements to web games. Always provide complete file contents when making changes."
        },
        {
          role: "user",
          content: followUpPrompt
        }
      ],
      temperature: 0.3,
      max_tokens: 8000,
    })

    const llmResponse = groqResponse.choices[0].message.content

    // Parse the response to extract analysis and modified files
    const analysisMatch = llmResponse.match(/^([\s\S]*?)(?=\/\/ ===|$)/);
    const analysis = analysisMatch ? analysisMatch[1].trim() : "No analysis provided";

    // Extract modified files
    const modifiedFiles = []
    const fileSeparatorPattern = /\/\/ === ([\w.-]+) ===([\s\S]*?)(?=\/\/ === |$)/g
    let match

    while ((match = fileSeparatorPattern.exec(llmResponse)) !== null) {
      const fileName = match[1].trim()
      let fileContent = match[2].trim()
      
      // Clean up the code
      fileContent = cleanupGeneratedCode(fileContent, fileName)
      
      // Find the original file to compare
      const originalFile = files.find(f => f.name === fileName)
      const changes = originalFile 
        ? "File modified based on the requested changes" 
        : "New file created"

      modifiedFiles.push({
        name: fileName,
        content: fileContent,
        changes: changes
      })
    }

    // Extract suggestions from the analysis
    const suggestions = []
    const suggestionMatches = analysis.match(/(?:suggest|recommend|consider|additionally)[\s\S]{0,200}/gi)
    if (suggestionMatches) {
      suggestions.push(...suggestionMatches.map(s => s.trim()))
    }

    // If projectId provided, optionally save the modified files
    if (projectId && modifiedFiles.length > 0) {
      const projectPath = path.join(PROJECTS_DIR, projectId)
      if (await fs.pathExists(projectPath)) {
        for (const file of modifiedFiles) {
          const filePath = path.join(projectPath, file.name)
          await fs.writeFile(filePath, file.content)
          console.log(chalk.green(`✅ Updated ${file.name} in project ${projectId}`))
        }
      }
    }

    // Send response
    res.json({
      success: true,
      query: query,
      analysis: analysis,
      modifiedFiles: modifiedFiles,
      suggestions: suggestions.length > 0 ? suggestions : ["No additional suggestions"],
      chatId: chatId,
      filesAnalyzed: files.length,
      filesModified: modifiedFiles.length,
      projectId: projectId || null
    })

    console.log(chalk.green(`Follow-up request completed for Chat ${chatId}`))
    console.log(chalk.green(`Modified ${modifiedFiles.length} files`))

  } catch (error) {
    console.error(chalk.red(`Error in follow-up Chat ${chatId}:`, error.message))
    res.status(500).json({
      error: "Failed to process follow-up request",
      details: error.message,
      chatId,
    })
  }
})

// ============================================================================
// SERVER STARTUP
// ============================================================================

function checkEnvironment() {
  const required = ["GROQ_API_KEY", "ANTHROPIC_API_KEY", "OPENROUTER_API_KEY"]
  const missing = required.filter((key) => !process.env[key])

  if (missing.length > 0) {
    console.error(chalk.red("Missing required environment variables:"))
    missing.forEach((key) => console.error(chalk.red(`   - ${key}`)))
    process.exit(1)
  }
}

process.on("SIGINT", () => {
  console.log(chalk.yellow("Shutting down Web Game AI Generator Streaming API..."))
  process.exit(0)
})

checkEnvironment()
app.listen(PORT, () => {
  console.log(chalk.green(`🚀 Web Game AI Generator Streaming API running on http://localhost:${PORT}`))
  console.log(chalk.blue(`📚 Swagger Documentation: http://localhost:${PORT}/api-docs`))
  console.log(chalk.blue(`🏥 Health Check: http://localhost:${PORT}/api/health`))
  console.log(chalk.cyan(`📡 Streaming Endpoints:`))
  console.log(chalk.cyan(`   POST /api/generate/simple - 2-Step Chain (Groq → Qwen3)`))
  console.log(chalk.cyan(`   POST /api/generate/full - 4-Step Chain (Groq → Qwen3 → Anthropic → Qwen3)`))
  console.log(chalk.magenta(`🎯 Features:`))
  console.log(chalk.magenta(`   ✅ Server-Sent Events streaming`))
  console.log(chalk.magenta(`   ✅ Real-time progress updates`))
  console.log(chalk.magenta(`   ✅ Individual file streaming`))
  console.log(chalk.magenta(`   ✅ Clean code generation (no comments)`))
  console.log(chalk.magenta(`   ✅ Complete npm project setup`))
  console.log(chalk.magenta(`   ✅ Auto npm install and server launch`))
  console.log(chalk.magenta(`   ✅ Live game URL in response`))
})