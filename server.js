import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs-extra";
import chalk from "chalk";
import { v4 as uuidv4 } from "uuid";
import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import TracedLLMProvider from "./lib/llm-providers.js";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import net from "net";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const PROJECTS_DIR = "generated-projects";
const CHAT_HISTORY_DIR = "chat-history";
const TEMPLATES_DIR = "templates";

await fs.ensureDir(PROJECTS_DIR);
await fs.ensureDir(CHAT_HISTORY_DIR);
await fs.ensureDir(TEMPLATES_DIR);

let chatCounter = 1;
const conversationContexts = new Map();

// Initialize traced LLM provider
const llmProvider = new TracedLLMProvider();

// Swagger configuration (unchanged)
const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Web Game AI Generator API",
      version: "2.0.0",
      description: "Streaming API for generating Unity WebGL games using AI chains",
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
              description: "Description of the Unity WebGL game to generate",
              example: "Create a Snake game in Unity WebGL with smooth movement, score system, and mobile controls",
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
                  enum: ["html", "cs", "unity"],
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
  apis: ["./server.js"],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Utility Functions
async function findAvailablePort(startPort = 8000) {
  const checkPort = (port) => {
    return new Promise((resolve) => {
      const server = net.createServer();
      server.once('error', (err) => {
        resolve(false);
      });
      server.once('listening', () => {
        server.close(() => resolve(true));
      });
      server.listen(port, '127.0.0.1');
    });
  };

  for (let port = startPort; port <= startPort + 100; port++) {
    if (await checkPort(port)) {
      console.log(chalk.green(`✅ Found available port: ${port}`));
      return port;
    }
    console.log(chalk.yellow(`⚠️ Port ${port} is in use, trying next...`));
  }
  throw new Error(`No available port found in range ${startPort}-${startPort + 100}`);
}

async function saveGeneratedFiles(projectId, files) {
  const projectPath = path.join(PROJECTS_DIR, projectId);
  await fs.ensureDir(projectPath);

  for (const file of files) {
    const filePath = path.join(projectPath, file.name);
    const dirPath = path.dirname(filePath);
    await fs.ensureDir(dirPath); // Ensure nested directories (e.g., Scenes, Scripts)
    await fs.writeFile(filePath, file.content);
    console.log(chalk.green(`✅ Saved ${file.name} to ${filePath} (${file.content.length} chars)`));
  }

  const packageJson = {
    name: `web-game-${projectId}`,
    version: "1.0.0",
    description: "AI Generated Unity WebGL Game",
    scripts: {
      start: "npx serve . -p 8080",
      dev: "npx serve . -p 8080",
    },
    keywords: ["game", "unity", "webgl"],
    author: "AI Generator",
    license: "MIT",
  };

  await fs.writeFile(path.join(projectPath, 'package.json'), JSON.stringify(packageJson, null, 2));
  console.log(chalk.green(`✅ Saved package.json to ${projectPath}`));
  return projectPath;
}

async function setupAndRunProject(projectPath) {
  return new Promise(async (resolve, reject) => {
    try {
      console.log(chalk.cyan(`📦 Running npm install in ${projectPath}...`));
      const npmInstall = spawn('npm', ['install'], {
        cwd: projectPath,
        shell: true,
        stdio: ['ignore', 'pipe', 'pipe'], // Capture stdout and stderr
      });

      npmInstall.stdout.on('data', (data) => {
        console.log(chalk.gray(`npm install output: ${data.toString()}`));
      });

      npmInstall.stderr.on('data', (data) => {
        console.log(chalk.yellow(`npm install stderr: ${data.toString()}`));
      });

      npmInstall.on('close', async (code) => {
        if (code !== 0) {
          console.log(chalk.yellow('⚠️ npm install failed or skipped, continuing...'));
        }

        const port = await findAvailablePort(8000);
        console.log(chalk.cyan(`🚀 Starting server on port ${port}...`));

        const serverProcess = spawn('npx', ['serve', '.', '-p', port.toString()], {
          cwd: projectPath,
          shell: true,
          stdio: ['ignore', 'pipe', 'pipe'],
          detached: false,
        });

        let serverStarted = false;
        const serverUrl = `http://localhost:${port}`;

        serverProcess.stdout.on('data', (data) => {
          const output = data.toString();
          console.log(chalk.gray(`Server output: ${output}`));
          if (output.includes('Accepting connections') && !serverStarted) {
            serverStarted = true;
            console.log(chalk.green(`✅ Server running at ${serverUrl}`));
            resolve({ url: serverUrl, port: parseInt(port), process: serverProcess });
          }
        });

        serverProcess.stderr.on('data', (data) => {
          console.log(chalk.yellow(`Server stderr: ${data.toString()}`));
        });

        serverProcess.on('error', (error) => {
          console.error(chalk.red(`Server process error: ${error.message}`));
          if (!serverStarted) reject(error);
        });

        // Extended timeout to ensure server starts
        setTimeout(() => {
          if (!serverStarted) {
            console.log(chalk.yellow(`⚠️ Server timeout reached, assuming running at ${serverUrl}`));
            resolve({ url: serverUrl, port: parseInt(port), process: serverProcess });
          }
        }, 10000); // Increased to 10 seconds
      });

      npmInstall.on('error', (error) => {
        console.error(chalk.red(`npm install error: ${error.message}`));
        reject(error);
      });
    } catch (error) {
      console.error(chalk.red(`Setup error: ${error.message}`));
      reject(error);
    }
  });
}

function validateAndParseWebGameFiles(webGameCode, chatId) {
  console.log(chalk.cyan("Validating and parsing Unity WebGL files with cleanup..."));

  if (!webGameCode || typeof webGameCode !== "string") {
    console.log(chalk.yellow("No web game code provided, using default structure..."));
    webGameCode = "// Default Unity WebGL structure";
  }

  const files = [];
  const missingFiles = [];

  const requiredFiles = [
    "index.html",
    "Scenes/GameScene.unity",
    "Scripts/GameManager.cs",
    "Scripts/PlayerController.cs",
    "Scripts/EnemyController.cs",
    "Scripts/UIManager.cs",
    "Scripts/AudioManager.cs",
    "Scripts/GameConfig.cs",
    "Scripts/Utility.cs",
    "Scripts/CameraController.cs",
  ];

  const fileSeparators = [
    { pattern: /\/\/ === index\.html ===([\s\S]*?)(?=\/\/ === |$)/g, name: "index.html", type: "html" },
    { pattern: /\/\/ === Scenes\/GameScene\.unity ===([\s\S]*?)(?=\/\/ === |$)/g, name: "Scenes/GameScene.unity", type: "unity" },
    { pattern: /\/\/ === Scripts\/GameManager\.cs ===([\s\S]*?)(?=\/\/ === |$)/g, name: "Scripts/GameManager.cs", type: "cs" },
    { pattern: /\/\/ === Scripts\/PlayerController\.cs ===([\s\S]*?)(?=\/\/ === |$)/g, name: "Scripts/PlayerController.cs", type: "cs" },
    { pattern: /\/\/ === Scripts\/EnemyController\.cs ===([\s\S]*?)(?=\/\/ === |$)/g, name: "Scripts/EnemyController.cs", type: "cs" },
    { pattern: /\/\/ === Scripts\/UIManager\.cs ===([\s\S]*?)(?=\/\/ === |$)/g, name: "Scripts/UIManager.cs", type: "cs" },
    { pattern: /\/\/ === Scripts\/AudioManager\.cs ===([\s\S]*?)(?=\/\/ === |$)/g, name: "Scripts/AudioManager.cs", type: "cs" },
    { pattern: /\/\/ === Scripts\/GameConfig\.cs ===([\s\S]*?)(?=\/\/ === |$)/g, name: "Scripts/GameConfig.cs", type: "cs" },
    { pattern: /\/\/ === Scripts\/Utility\.cs ===([\s\S]*?)(?=\/\/ === |$)/g, name: "Scripts/Utility.cs", type: "cs" },
    { pattern: /\/\/ === Scripts\/CameraController\.cs ===([\s\S]*?)(?=\/\/ === |$)/g, name: "Scripts/CameraController.cs", type: "cs" },
  ];

  fileSeparators.forEach(({ pattern, name, type }) => {
    const matches = [...webGameCode.matchAll(pattern)];
    if (matches.length > 0) {
      let content = matches[0][1].trim();
      content = cleanupGeneratedCode(content, name);
      if (content) {
        files.push({ name, content, type });
        console.log(chalk.green(`✅ Found and cleaned ${name} (${content.length} chars)`));
      }
    } else {
      missingFiles.push(name);
    }
  });

  requiredFiles.forEach((fileName) => {
    if (!files.find((f) => f.name === fileName)) {
      missingFiles.push(fileName);
    }
  });

  return {
    files,
    missingFiles: [...new Set(missingFiles)],
    isComplete: missingFiles.length === 0,
    totalFiles: files.length,
    requiredFiles: requiredFiles.length,
  };
}

function cleanupGeneratedCode(content, fileName) {
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

async function createCompleteFileStructure(existingFiles, missingFiles, gamePrompt) {
  const completeFiles = [...existingFiles];
  let templates = {};
  try {
    templates = JSON.parse(await fs.readFile(path.join(TEMPLATES_DIR, "templates.json"), "utf-8"));
  } catch (error) {
    console.log(chalk.yellow(`⚠️ Templates not found, using defaults: ${error.message}`));
    templates = { "2d-arcade": {} };
  }

  const gameType = detectGameType(gamePrompt);
  const template = templates[gameType] || templates["2d-arcade"] || {};

  // Fallback templates for critical files
  const defaultTemplates = {
    "index.html": `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${gamePrompt}</title>
    <style>
        body { margin: 0; padding: 0; overflow: hidden; background: #000; }
        #unity-container { width: 100%; height: 100vh; }
        #loading-screen { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: #1a1a2e; display: flex; justify-content: center; align-items: center; color: #fff; }
    </style>
</head>
<body>
    <div id="loading-screen">Loading ${gamePrompt}...</div>
    <div id="unity-container"></div>
    <script src="Build/UnityLoader.js"></script>
    <script>
        UnityLoader.instantiate("unity-container", "Build/${gamePrompt.replace(/\s+/g, '')}.json", {
            onProgress: (gameInstance, progress) => {
                if (progress === 1) document.getElementById("loading-screen").style.display = "none";
            }
        });
    </script>
</body>
</html>`,
    "Scenes/GameScene.unity": `scene: {
  objects: [
    { name: "MainCamera", components: [ { type: "Camera", orthographic: true, size: 10 } ] },
    { name: "GameManager", components: [ { type: "GameManager" }, { type: "GameConfig" } ] },
    { name: "Snake", components: [ { type: "SpriteRenderer" }, { type: "Animator", parameters: [ { name: "Direction", type: "int" }, { name: "IsEating", type: "bool" } ] }, { type: "PlayerController" }, { type: "BoxCollider2D", isTrigger: true } ] },
    { name: "Food", components: [ { type: "SpriteRenderer" }, { type: "Animator", parameters: [ { name: "Pulsing", type: "bool" } ] }, { type: "EnemyController" }, { type: "BoxCollider2D", isTrigger: true } ] },
    { name: "UIManager", components: [ { type: "UIManager" } ] },
    { name: "AudioManager", components: [ { type: "AudioManager" } ] },
    { name: "CameraController", components: [ { type: "CameraController" } ] }
  ]
}`,
    "Scripts/UIManager.cs": `using UnityEngine;
using UnityEngine.UI;

public class UIManager : MonoBehaviour
{
    public Text scoreText;
    public GameObject gameOverPanel;
    public Text gameOverScoreText;

    private void Start()
    {
        gameOverPanel.SetActive(false);
    }

    public void UpdateScore(int score)
    {
        scoreText.text = $"Score: {score}";
    }

    public void ShowGameOver(int score)
    {
        gameOverPanel.SetActive(true);
        gameOverScoreText.text = $"Final Score: {score}";
    }
}`,
    "Scripts/AudioManager.cs": `using UnityEngine;

public class AudioManager : MonoBehaviour
{
    public AudioSource bgMusic;
    public AudioSource sfxSource;
    public AudioClip eatSound;
    public AudioClip gameOverSound;

    private void Start()
    {
        bgMusic.Play();
    }

    public void PlayEatSound()
    {
        sfxSource.PlayOneShot(eatSound);
    }

    public void PlayGameOverSound()
    {
        sfxSource.PlayOneShot(gameOverSound);
    }
}`,
    "Scripts/GameConfig.cs": `using UnityEngine;

public class GameConfig : MonoBehaviour
{
    public float snakeSpeed = 0.1f;
    public int scorePerFood = 1;
    public GameObject segmentPrefab;
    public Vector2Int gridSize = new Vector2Int(20, 20);
}`,
    "Scripts/Utility.cs": `using UnityEngine;

public static class Utility
{
    public static Vector2Int GetRandomGridPosition(Vector2Int gridSize)
    {
        return new Vector2Int(
            Random.Range(0, gridSize.x),
            Random.Range(0, gridSize.y)
        );
    }
}`,
    "Scripts/CameraController.cs": `using UnityEngine;

public class CameraController : MonoBehaviour
{
    public Transform target;
    public Vector3 offset = new Vector3(0, 0, -10);

    private void LateUpdate()
    {
        if (target)
        {
            transform.position = target.position + offset;
        }
    }
}`,
  };

  missingFiles.forEach((fileName) => {
    const templateContent = template[fileName] || defaultTemplates[fileName];
    if (templateContent) {
      completeFiles.push({
        name: fileName,
        content: templateContent.replace("{{gameName}}", gamePrompt),
        type: fileName.endsWith(".html") ? "html" : fileName.endsWith(".cs") ? "cs" : "unity",
      });
      console.log(chalk.yellow(`🔧 Auto-generated ${fileName} from ${template[fileName] ? 'template' : 'default'}`));
    } else {
      console.log(chalk.red(`❌ No template available for ${fileName}`));
    }
  });

  return completeFiles;
}

function detectGameType(prompt) {
  const lowerPrompt = prompt.toLowerCase();
  if (lowerPrompt.includes("pac-man") || lowerPrompt.includes("snake")) return "2d-arcade";
  if (lowerPrompt.includes("amnesia") || lowerPrompt.includes("halo")) return "3d-fps";
  if (lowerPrompt.includes("racing")) return "3d-racing";
  return "2d-arcade";
}

// Streaming API Endpoints
app.post("/api/generate/simple", async (req, res) => {
  const chatId = chatCounter++;
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
    const { prompt } = req.body;
    if (!prompt || !prompt.trim()) {
      sendEvent("error", { error: "Game description is required", chatId });
      res.end();
      return;
    }

    console.log(chalk.blue(`Starting SIMPLE chain generation for Chat ${chatId}`));
    console.log(chalk.blue(`Game Request: ${prompt}`));

    sendEvent("progress", {
      step: 0,
      totalSteps: 2,
      stepName: "Initialization",
      progress: 0,
      message: "Starting simple AI chain (Groq → Grok3)...",
    });

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

    sendEvent("progress", {
      step: 2,
      totalSteps: 2,
      stepName: "Grok3 Code Generation",
      progress: 60,
      message: "Generating clean, production-ready code with Grok3...",
    });

    const grok3FinalCode = await llmProvider.generateCleanCodeWithGrok3(groqExplanation, prompt, chatId);

    sendEvent("progress", {
      step: 2,
      totalSteps: 2,
      stepName: "Grok3 Code Generation",
      progress: 80,
      message: "Code generation completed, parsing files...",
    });

    const validationResult = validateAndParseWebGameFiles(grok3FinalCode, chatId);
    const completeFiles = await createCompleteFileStructure(validationResult.files, validationResult.missingFiles, prompt);

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

    const projectId = uuidv4();
    sendEvent("progress", {
      step: 2,
      totalSteps: 2,
      stepName: "Project Setup",
      progress: 95,
      message: "Saving files and setting up project...",
    });

    const projectPath = await saveGeneratedFiles(projectId, completeFiles);
    let serverInfo;
    try {
      serverInfo = await setupAndRunProject(projectPath);
    } catch (error) {
      console.error(chalk.red(`Failed to start server: ${error.message}`));
      serverInfo = { url: `http://localhost:8080`, port: 8080, process: null };
    }

    sendEvent("complete", {
      chatId,
      projectId,
      totalFiles: completeFiles.length,
      aiGeneratedFiles: validationResult.files.length,
      missingFilesGenerated: validationResult.missingFiles.length,
      chainUsed: "simple",
      chainSteps: ["Groq - Game explanation and architecture", "Grok3 - Complete clean code generation"],
      setupInstructions: {
        npmInstall: "npm install",
        startCommand: "npm start",
        serveCommand: "npx serve . -p 8080",
        url: serverInfo.url,
        liveUrl: serverInfo.url,
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
  } catch (error) {
    console.error(chalk.red(`Error in Simple Chain Chat ${chatId}: ${error.message}`));
    sendEvent("error", { error: "Failed to generate web game", details: error.message, chatId });
  }
  res.end();
});

app.post("/api/generate/full", async (req, res) => {
  const chatId = chatCounter++;
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
    const { prompt } = req.body;
    if (!prompt || !prompt.trim()) {
      sendEvent("error", { error: "Game description is required", chatId });
      res.end();
      return;
    }

    console.log(chalk.blue(`Starting FULL chain generation for Chat ${chatId}`));
    console.log(chalk.blue(`Game Request: ${prompt}`));

    sendEvent("progress", {
      step: 0,
      totalSteps: 4,
      stepName: "Initialization",
      progress: 0,
      message: "Starting full AI chain (Groq → Grok3 → Anthropic → Grok3)...",
    });

    sendEvent("progress", {
      step: 1,
      totalSteps: 4,
      stepName: "Groq Architecture",
      progress: 10,
      message: "Getting comprehensive game explanation from Groq...",
    });

    const groqExplanation = await llmProvider.getGameExplanation(prompt, chatId);

    sendEvent("step_complete", {
      step: 1,
      stepName: "Groq Architecture",
      output: `Game architecture explanation completed (${groqExplanation.length} characters)`,
    });

    sendEvent("progress", {
      step: 2,
      totalSteps: 4,
      stepName: "Grok3 Initial Code",
      progress: 30,
      message: "Generating initial complete code with Grok3...",
    });

    const grok3InitialCode = await llmProvider.generateCleanCodeWithGrok3(groqExplanation, prompt, chatId);

    sendEvent("step_complete", {
      step: 2,
      stepName: "Grok3 Initial Code",
      output: `Initial code generation completed (${grok3InitialCode.length} characters)`,
    });

    sendEvent("progress", {
      step: 3,
      totalSteps: 4,
      stepName: "Anthropic Validation",
      progress: 60,
      message: "Validating code with Anthropic and providing feedback...",
    });

    const anthropicFeedback = await llmProvider.validateWithAnthropic(grok3InitialCode, prompt, chatId);

    sendEvent("step_complete", {
      step: 3,
      stepName: "Anthropic Validation",
      output: `Code validation completed with detailed feedback (${anthropicFeedback.length} characters)`,
    });

    sendEvent("progress", {
      step: 4,
      totalSteps: 4,
      stepName: "Grok3 Final Fixes",
      progress: 80,
      message: "Generating final fixed code with Grok3...",
    });

    const grok3FinalCode = await llmProvider.generateFinalCodeWithGrok3(
      anthropicFeedback,
      grok3InitialCode,
      prompt,
      chatId,
    );

    sendEvent("step_complete", {
      step: 4,
      stepName: "Grok3 Final Fixes",
      output: `Final code generation completed (${grok3FinalCode.length} characters)`,
    });

    sendEvent("progress", {
      step: 4,
      totalSteps: 4,
      stepName: "File Processing",
      progress: 90,
      message: "Parsing and cleaning generated files...",
    });

    const validationResult = validateAndParseWebGameFiles(grok3FinalCode, chatId);
    const completeFiles = await createCompleteFileStructure(validationResult.files, validationResult.missingFiles, prompt);

    sendEvent("progress", {
      step: 4,
      totalSteps: 4,
      stepName: "File Streaming",
      progress: 95,
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

    const projectId = uuidv4();
    sendEvent("progress", {
      step: 4,
      totalSteps: 4,
      stepName: "Project Setup",
      progress: 98,
      message: "Saving files and setting up project...",
    });

    const projectPath = await saveGeneratedFiles(projectId, completeFiles);
    let serverInfo;
    try {
      serverInfo = await setupAndRunProject(projectPath);
    } catch (error) {
      console.error(chalk.red(`Failed to start server: ${error.message}`));
      serverInfo = { url: `http://localhost:8080`, port: 8080, process: null };
    }

    sendEvent("complete", {
      chatId,
      projectId,
      totalFiles: completeFiles.length,
      aiGeneratedFiles: validationResult.files.length,
      missingFilesGenerated: validationResult.missingFiles.length,
      chainUsed: "full",
      chainSteps: [
        "Groq - Game explanation and architecture",
        "Grok3 - Initial complete code generation",
        "Anthropic - Code validation and feedback",
        "Grok3 - Final code fixes and improvements",
      ],
      setupInstructions: {
        npmInstall: "npm install",
        startCommand: "npm start",
        serveCommand: "npx serve . -p 8080",
        url: serverInfo.url,
        liveUrl: serverInfo.url,
        port: serverInfo.port,
        projectPath: projectPath,
      },
      validation: {
        isComplete: validationResult.isComplete,
        totalFiles: completeFiles.length,
        originalFiles: validationResult.files.length,
        missingFiles: validationResult.missingFiles,
      },
      chainDetails: {
        groqExplanationLength: groqExplanation.length,
        grok3InitialCodeLength: grok3InitialCode.length,
        anthropicFeedbackLength: anthropicFeedback.length,
        grok3FinalCodeLength: grok3FinalCode.length,
      },
    });

    console.log(chalk.green(`FULL chain completed for Chat ${chatId}!`));
    console.log(chalk.green(`🎮 Game is running at: ${serverInfo.url}`));
  } catch (error) {
    console.error(chalk.red(`Error in Full Chain Chat ${chatId}: ${error.message}`));
    sendEvent("error", { error: "Failed to generate web game", details: error.message, chatId });
  }
  res.end();
});

// Health endpoint (unchanged)
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
      simple: "Groq → Grok3 (2 steps)",
      full: "Groq → Grok3 → Anthropic → Grok3 (4 steps)",
    },
    features: {
      streaming: true,
      fileGeneration: true,
      codeCleanup: true,
      npmSetup: true,
    },
  });
});

// Root endpoint (unchanged)
app.get("/", (req, res) => {
  res.send(String.raw`<!DOCTYPE html>
<html>
<head>
  <title>Unity WebGL Game AI Generator - Streaming API</title>
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
  <h1>🚀 Unity WebGL Game AI Generator - Streaming API</h1>

  <div class="api-section">
    <h3>📡 Available Endpoints</h3>
    <div class="endpoint">
      <span class="method post">POST</span>
      <strong>/api/generate/simple</strong> - 2-Step Chain (Groq → Grok3)
      <p>Fast generation with clean Unity WebGL code output. No validation step.</p>
    </div>
    <div class="endpoint">
      <span class="method post">POST</span>
      <strong>/api/generate/full</strong> - 4-Step Chain (Groq → Grok3 → Anthropic → Grok3)
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
        <textarea id="prompt" rows="4" placeholder="Create a Snake game in Unity WebGL with smooth movement, score system, and mobile controls..."></textarea>
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

      if (eventSource) eventSource.close();

      generateBtn.disabled = true;
      generateBtn.textContent = '🔄 Generating...';
      output.style.display = 'block';
      events.innerHTML = '<div class="event">🚀 Starting generation...</div>';
      fileCount = 0;

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt }),
        });

        if (!response.ok) throw new Error(\`HTTP \${response.status}: \${response.statusText}\`);

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\\n');

          let eventType = 'message';
          for (const line of lines) {
            if (line.startsWith('event: ')) {
              eventType = line.substring(7);
            } else if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.substring(6));
                handleStreamEvent(eventType, data);
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

    document.getElementById('prompt').value = 'Create a Snake game in Unity WebGL with smooth movement, score system, and mobile controls';
  </script>
</body>
</html>`);
});


app.post("/api/followup", async (req, res) => {
  const chatId = chatCounter++;
  try {
    const { query, files, projectId } = req.body;
    if (!query || !query.trim()) {
      return res.status(400).json({ error: "Query is required", chatId });
    }
    if (!files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: "Files array is required and must not be empty", chatId });
    }
    for (const file of files) {
      if (!file.name || !file.content) {
        return res.status(400).json({ error: "Each file must have 'name' and 'content' properties", chatId });
      }
    }

    console.log(chalk.blue(`Processing follow-up request for Chat ${chatId}`));
    console.log(chalk.blue(`Query: ${query}`));
    console.log(chalk.blue(`Files provided: ${files.map(f => f.name).join(", ")}`));

    const fileContext = files.map(file => `// === ${file.name} ===\n${file.content}`).join("\n\n");
    const followUpPrompt = `You are an expert Unity WebGL developer. A user needs help with:

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
- Return complete file content
- Maintain Unity WebGL compatibility (2022 LTS)
- Use format: // === filename.cs === or // === filename.html === for each modified file
- Ensure 60fps optimization and mobile support`;

    const groqResponse = await llmProvider.groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: "You are an expert Unity WebGL developer. Provide complete file contents for fixes." },
        { role: "user", content: followUpPrompt },
      ],
      temperature: 0.3,
      max_tokens: 8000,
    });

    const llmResponse = groqResponse.choices[0].message.content;
    const analysisMatch = llmResponse.match(/^([\s\S]*?)(?=\/\/ ===|$)/);
    const analysis = analysisMatch ? analysisMatch[1].trim() : "No analysis provided";

    const modifiedFiles = [];
    const fileSeparatorPattern = /\/\/ === ([\w\/.-]+) ===([\s\S]*?)(?=\/\/ === |$)/g;
    let match;
    while ((match = fileSeparatorPattern.exec(llmResponse)) !== null) {
      const fileName = match[1].trim();
      let fileContent = match[2].trim();
      fileContent = cleanupGeneratedCode(fileContent, fileName);
      const originalFile = files.find(f => f.name === fileName);
      const changes = originalFile ? "File modified based on the requested changes" : "New file created";
      modifiedFiles.push({ name: fileName, content: fileContent, changes });
    }

    const suggestions = [];
    const suggestionMatches = analysis.match(/(?:suggest|recommend|consider|additionally)[\s\S]{0,200}/gi);
    if (suggestionMatches) {
      suggestions.push(...suggestionMatches.map(s => s.trim()));
    }

    if (projectId && modifiedFiles.length > 0) {
      const projectPath = path.join(PROJECTS_DIR, projectId);
      if (await fs.pathExists(projectPath)) {
        for (const file of modifiedFiles) {
          const filePath = path.join(projectPath, file.name);
          const dirPath = path.dirname(filePath);
          await fs.ensureDir(dirPath);
          await fs.writeFile(filePath, file.content);
          console.log(chalk.green(`✅ Updated ${file.name} in project ${projectId}`));
        }
      }
    }

    res.json({
      success: true,
      query,
      analysis,
      modifiedFiles,
      suggestions: suggestions.length > 0 ? suggestions : ["No additional suggestions"],
      chatId,
      filesAnalyzed: files.length,
      filesModified: modifiedFiles.length,
      projectId: projectId || null,
    });

    console.log(chalk.green(`Follow-up request completed for Chat ${chatId}`));
    console.log(chalk.green(`Modified ${modifiedFiles.length} files`));
  } catch (error) {
    console.error(chalk.red(`Error in follow-up Chat ${chatId}: ${error.message}`));
    res.status(500).json({ error: "Failed to process follow-up request", details: error.message, chatId });
  }
});

function checkEnvironment() {
  const required = ["GROQ_API_KEY", "OPENROUTER_API_KEY"];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error(chalk.red("Missing required environment variables:"));
    missing.forEach((key) => console.error(chalk.red(`   - ${key}`)));
    process.exit(1);
  }
}

process.on("SIGINT", () => {
  console.log(chalk.yellow("Shutting down Unity WebGL Game AI Generator Streaming API..."));
  process.exit(0);
});

checkEnvironment();
app.listen(PORT, () => {
  console.log(chalk.green(`🚀 Unity WebGL Game AI Generator Streaming API running on http://localhost:${PORT}`));
  console.log(chalk.blue(`📚 Swagger Documentation: http://localhost:${PORT}/api-docs`));
  console.log(chalk.blue(`🏥 Health Check: http://localhost:${PORT}/api/health`));
  console.log(chalk.cyan(`📡 Streaming Endpoints:`));
  console.log(chalk.cyan(`   POST /api/generate/simple - 2-Step Chain (Groq → Grok3)`));
  console.log(chalk.cyan(`   POST /api/generate/full - 4-Step Chain (Groq → Grok3 → Anthropic → Grok3)`));
  console.log(chalk.magenta(`🎯 Features:`));
  console.log(chalk.magenta(`   ✅ Server-Sent Events streaming`));
  console.log(chalk.magenta(`   ✅ Real-time progress updates`));
  console.log(chalk.magenta(`   ✅ Individual file streaming`));
  console.log(chalk.magenta(`   ✅ Clean code generation (no comments)`));
  console.log(chalk.magenta(`   ✅ Complete npm project setup`));
  console.log(chalk.magenta(`   ✅ Auto npm install and server launch`));
  console.log(chalk.magenta(`   ✅ Live game URL in response`));
});