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
const PORT = 3009;
const GENERATED_PROJECTS_PATH = process.env.GENERATED_PROJECTS_PATH || "generated-projects";
const NGINX_PROJECTS_PATH = process.env.NGINX_PROJECTS_PATH || "nginx-projects";
const DEPLOY_LOG_PATH = process.env.DEPLOY_LOG_PATH || "deploy-log.txt";

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const PROJECTS_DIR = "generated-projects";
const CHAT_HISTORY_DIR = "chat-history";

await fs.ensureDir(PROJECTS_DIR);
await fs.ensureDir(CHAT_HISTORY_DIR);

let chatCounter = 1;
const conversationContexts = new Map();

// Initialize traced LLM provider
const llmProvider = new TracedLLMProvider();

// Swagger Configuration
const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Web Game AI Generator API",
      version: "2.1.0",
      description: "Streaming API for generating Next.js 2D web games using AI chains",
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
              description: "Description of the 2D web game to generate",
              example: "Create a Flappy Bird game with custom SVG assets",
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
                  enum: ["json", "yaml", "css", "tsx", "svg", "mp3"],
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
                  description: "Generated project UUID or subdomain",
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
                      example: "npm run dev",
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
async function findAvailablePort(startPort = 3000) {
  const checkPort = (port) => {
    return new Promise((resolve) => {
      const server = net.createServer();
      server.once("error", () => resolve(false));
      server.once("listening", () => server.close(() => resolve(true)));
      server.listen(port, "127.0.0.1");
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

async function generateBaseFiles(gamePrompt) {
  const gameName = gamePrompt
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .trim() || "game";

  const packageJson = {
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
      autoprefixer: "^10.4.20",
      clsx: "^2.1.1",
      "lucide-react": "^0.454.0",
      next: "15.2.4",
      react: "^19",
      "react-dom": "^19",
      "react-hook-form": "^7.60.0",
      "tailwind-merge": "^2.5.5",
      "tailwindcss-animate": "^1.0.7",
      zod: "3.25.67",
    },
    devDependencies: {
      "@types/node": "^22",
      "@types/react": "^19",
      "@types/react-dom": "^19",
      postcss: "^8.5",
      tailwindcss: "^4.1.9",
      typescript: "^5",
    },
  };

  const pnpmLockYaml = `
lockfileVersion: '6.0'
dependencies:
  '@radix-ui/react-dialog':
    specifier: 1.1.4
    version: 1.1.4
  '@radix-ui/react-toast':
    specifier: 1.2.4
    version: 1.2.4
  autoprefixer:
    specifier: ^10.4.20
    version: 10.4.20
  clsx:
    specifier: ^2.1.1
    version: 2.1.1
  'lucide-react':
    specifier: ^0.454.0
    version: 0.454.0
  next:
    specifier: 15.2.4
    version: 15.2.4
  react:
    specifier: ^19
    version: 19.0.0
  'react-dom':
    specifier: ^19
    version: 19.0.0
  'react-hook-form':
    specifier: ^7.60.0
    version: 7.60.0
  'tailwind-merge':
    specifier: ^2.5.5
    version: 2.5.5
  'tailwindcss-animate':
    specifier: ^1.0.7
    version: 1.0.7
  zod:
    specifier: 3.25.67
    version: 3.25.67
devDependencies:
  '@types/node':
    specifier: ^22
    version: 22.0.0
  '@types/react':
    specifier: ^19
    version: 19.0.0
  '@types/react-dom':
    specifier: ^19
    version: 19.0.0
  postcss:
    specifier: ^8.5
    version: 8.5.0
  tailwindcss:
    specifier: ^4.1.9
    version: 4.1.9
  typescript:
    specifier: ^5
    version: 5.0.0
`;

  const layoutTsx = `
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "${gameName.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase())}",
  description: "A 2D Flappy Bird game built with Next.js, TypeScript, Tailwind CSS, and SVG rendering",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
`;

  const pageTsx = `
import Game from "@/components/game";

export default function Home() {
  return (
    <main className="min-h-screen">
      <Game />
    </main>
  );
}
`;

  return [
    { name: "package.json", content: JSON.stringify(packageJson, null, 2), type: "json" },
    { name: "pnpm-lock.yaml", content: pnpmLockYaml, type: "yaml" },
    { name: "app/layout.tsx", content: layoutTsx, type: "tsx" },
    { name: "app/page.tsx", content: pageTsx, type: "tsx" },
  ];
}

async function saveGeneratedFiles(projectId, files) {
  const projectPath = path.join(PROJECTS_DIR, projectId);
  await fs.ensureDir(projectPath);
  await fs.ensureDir(path.join(projectPath, "app"));
  await fs.ensureDir(path.join(projectPath, "components"));
  await fs.ensureDir(path.join(projectPath, "public/assets"));

  for (const file of files) {
    let filePath = path.join(projectPath, file.name);
    await fs.ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, file.content);
    console.log(chalk.green(`✅ Saved ${file.name} to ${filePath}`));
  }
  return projectPath;
}

async function setupAndRunProject(projectPath) {
  return new Promise(async (resolve, reject) => {
    try {
      console.log(chalk.cyan(`📦 Running npm install in ${projectPath}...`));
      const npmInstall = spawn("npm", ["install"], {
        cwd: projectPath,
        shell: true,
        stdio: "pipe",
      });

      npmInstall.on("close", async (code) => {
        if (code !== 0) {
          console.log(chalk.yellow("npm install had issues (continuing anyway)"));
        }
        const port = await findAvailablePort(3000);
        console.log(chalk.cyan(`🚀 Starting Next.js server on port ${port}...`));
        const serverProcess = spawn("npm", ["run", "dev", "--", "-p", port.toString()], {
          cwd: projectPath,
          shell: true,
          stdio: "pipe",
          detached: false,
        });

        let serverStarted = false;
        serverProcess.stdout.on("data", (data) => {
          const output = data.toString();
          console.log(chalk.gray(`Server output: ${output}`));
          if (output.includes("ready") && output.includes("http://localhost")) {
            serverStarted = true;
            const serverUrl = `http://localhost:${port}`;
            console.log(chalk.green(`✅ Server running at ${serverUrl}`));
            resolve({
              url: serverUrl,
              port,
              process: serverProcess,
            });
          }
        });

        serverProcess.stderr.on("data", (data) => {
          console.log(chalk.gray(`Server stderr: ${data.toString()}`));
        });

        setTimeout(() => {
          if (!serverStarted) {
            const serverUrl = `http://localhost:${port}`;
            console.log(chalk.yellow(`⚠️ Server may be running at ${serverUrl} (timeout reached)`));
            resolve({
              url: serverUrl,
              port,
              process: serverProcess,
            });
          }
        }, 10000);

        serverProcess.on("error", (error) => {
          if (!serverStarted) {
            reject(error);
          }
        });
      });

      npmInstall.on("error", (error) => {
        console.error(chalk.red("npm install error:", error));
        reject(error);
      });
    } catch (error) {
      reject(error);
    }
  });
}

function validateAndParseNextJsFiles(webGameCode, gamePrompt, chatId) {
  console.log(chalk.cyan("Validating and parsing Next.js game files..."));
  
  // Ensure webGameCode is a string
  if (!webGameCode || typeof webGameCode !== "string") {
    console.log(chalk.yellow("No valid web game code provided, generating base files only..."));
    return {
      files: generateBaseFiles(gamePrompt),
      missingFiles: [
        "app/globals.css",
        "components/game.tsx",
        "components/game-engine.tsx",
        "components/game-ui.tsx",
        "components/game-controls.tsx",
        "public/assets/bird.svg",
        "public/assets/pipe.svg",
        "public/assets/background.svg",
      ],
      isComplete: false,
      totalFiles: 4,
      requiredFiles: 9,
    };
  }

  const files = [];
  const missingFiles = [];
  const requiredFiles = [
    "package.json",
    "pnpm-lock.yaml",
    "app/globals.css",
    "app/layout.tsx",
    "app/page.tsx",
    "components/game.tsx",
    "components/game-engine.tsx",
    "components/game-ui.tsx",
    "components/game-controls.tsx",
  ];

  const fileSeparators = [
    { pattern: /\/\/ === app\/globals\.css ===([\s\S]*?)(?=\/\/ === |$)/g, name: "app/globals.css", type: "css" },
    { pattern: /\/\/ === components\/game\.tsx ===([\s\S]*?)(?=\/\/ === |$)/g, name: "components/game.tsx", type: "tsx" },
    { pattern: /\/\/ === components\/game-engine\.tsx ===([\s\S]*?)(?=\/\/ === |$)/g, name: "components/game-engine.tsx", type: "tsx" },
    { pattern: /\/\/ === components\/game-ui\.tsx ===([\s\S]*?)(?=\/\/ === |$)/g, name: "components/game-ui.tsx", type: "tsx" },
    { pattern: /\/\/ === components\/game-controls\.tsx ===([\s\S]*?)(?=\/\/ === |$)/g, name: "components/game-controls.tsx", type: "tsx" },
    { pattern: /\/\/ === public\/assets\/(.+\.svg) ===([\s\S]*?)(?=\/\/ === |$)/g, name: (match) => `public/assets/${match[1]}`, type: () => "svg" },
  ];

  fileSeparators.forEach(({ pattern, name, type }) => {
    try {
      const matches = webGameCode.matchAll(pattern);
      if (!matches || typeof matches[Symbol.iterator] !== "function") {
        console.log(chalk.yellow(`⚠️ No valid matches for ${typeof name === "function" ? "SVG assets" : name}`));
        return;
      }
      for (const match of matches) {
        let fileName = typeof name === "function" ? name(match) : name;
        let fileType = typeof type === "function" ? type(match) : type;
        let content = match[1].trim();
        content = cleanupGeneratedCode(content, fileName);
        if (content && content.length > 0) {
          files.push({
            name: fileName,
            content,
            type: fileType,
          });
          console.log(chalk.green(`✅ Found and cleaned ${fileName} (${content.length} chars)`));
        } else {
          console.log(chalk.yellow(`⚠️ Empty or invalid content for ${fileName}`));
        }
      }
    } catch (error) {
      console.log(chalk.red(`❌ Error parsing ${typeof name === "function" ? "SVG assets" : name}: ${error.message}`));
    }
  });

  const baseFiles = generateBaseFiles(gamePrompt);
  files.push(...baseFiles);

  requiredFiles.forEach((fileName) => {
    if (!files.find((f) => f.name === fileName)) {
      missingFiles.push(fileName);
    }
  });

  const validationResult = {
    files,
    missingFiles: [...new Set(missingFiles)],
    isComplete: missingFiles.length === 0,
    totalFiles: files.length,
    requiredFiles: requiredFiles.length,
  };

  console.log(chalk.green(`Parsed and cleaned ${files.length}/${requiredFiles.length} files`));
  if (missingFiles.length > 0) {
    console.log(chalk.red(`Missing files: ${missingFiles.join(", ")}`));
  }
  return validationResult;
}

function cleanupGeneratedCode(content, fileName) {
  content = content.replace(/```(typescript|css|json|yaml|svg)?\s*/g, "");
  content = content.replace(/```\s*/g, "");
  content = content.replace(/\/\/ Generated by.*?\n/g, "");
  content = content.replace(/\/\* Generated by.*?\*\//g, "");
  content = content.replace(/<!-- Generated by.*?-->/g, "");
  content = content.replace(/\n\s*\n\s*\n/g, "\n\n");
  return content.trim();
}

async function deployToNginx(subdomain, files, prompt, chatId, sendEvent) {
  const { exec } = await import("child_process");
  const util = await import("util");
  const execAsync = util.promisify(exec);

  try {
    const sanitizedSubdomain = subdomain
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "")
      .substring(0, 63);
    if (!sanitizedSubdomain) throw new Error("Invalid subdomain");

    const generatedPath = path.isAbsolute(GENERATED_PROJECTS_PATH)
      ? path.join(GENERATED_PROJECTS_PATH, sanitizedSubdomain)
      : path.join(__dirname, GENERATED_PROJECTS_PATH, sanitizedSubdomain);

    await fs.ensureDir(generatedPath);
    for (const file of files) {
      const filePath = path.join(generatedPath, file.name);
      await fs.ensureDir(path.dirname(filePath));
      await fs.writeFile(filePath, file.content);
      console.log(chalk.green(`✅ Saved ${file.name}`));
    }

    sendEvent("progress", {
      step: 3,
      totalSteps: 4,
      stepName: "Building Project",
      progress: 88,
      message: "Running npm install and build...",
    });

    console.log(chalk.cyan(`📦 Running npm install in ${generatedPath}`));
    try {
      await execAsync("npm install", { cwd: generatedPath, timeout: 60000 });
    } catch (installError) {
      console.log(chalk.yellow("npm install had issues, continuing with build..."));
    }

    console.log(chalk.cyan(`🔨 Running next build in ${generatedPath}`));
    try {
      await execAsync("npm run build", { cwd: generatedPath, timeout: 60000 });
    } catch (buildError) {
      console.log(chalk.yellow("Build command had issues, continuing..."));
    }

    const buildOutputPath = path.join(generatedPath, "out");
    if (!(await fs.pathExists(buildOutputPath))) {
      console.log(chalk.yellow("⚠️ No build output found, attempting to use .next directory"));
    }

    const nginxPath = path.isAbsolute(NGINX_PROJECTS_PATH)
      ? path.join(NGINX_PROJECTS_PATH, sanitizedSubdomain + ".claw.codes")
      : path.join(__dirname, NGINX_PROJECTS_PATH, sanitizedSubdomain + ".claw.codes");

    await fs.ensureDir(nginxPath);
    console.log(chalk.cyan(`📋 Copying from ${buildOutputPath} to ${nginxPath}`));
    if (await fs.pathExists(buildOutputPath)) {
      await fs.copy(buildOutputPath, nginxPath, { overwrite: true });
    } else {
      await fs.copy(generatedPath, nginxPath, { overwrite: true });
    }

    sendEvent("progress", {
      step: 3,
      totalSteps: 4,
      stepName: "Reloading Nginx",
      progress: 96,
      message: "Reloading nginx configuration...",
    });

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

    const deployLogPath = path.isAbsolute(DEPLOY_LOG_PATH) ? DEPLOY_LOG_PATH : path.join(__dirname, DEPLOY_LOG_PATH);
    const deployTime = new Date().toISOString();
    const logEntry = `${deployTime} - Deployed ${sanitizedSubdomain}.claw.codes (Chat ${chatId}) - ${prompt.slice(0, 100)}\n`;
    try {
      await fs.appendFile(deployLogPath, logEntry);
    } catch (logError) {
      console.log(chalk.yellow("⚠️ Could not write to deploy log:", logError.message));
    }

    const httpUrl = `http://${sanitizedSubdomain}.claw.codes`;
    const httpsUrl = `https://${sanitizedSubdomain}.claw.codes`;
    try {
      const currentUrls = process.env.DEPLOYED_URLS || "";
      const newUrls = [httpUrl, httpsUrl].filter((url) => !currentUrls.includes(url));
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
 *     summary: Generate 2D web game using full 5-step AI chain
 *     description: Streams the generation process of a Next.js 2D web game using a 5-step AI chain with double validation.
 *     tags:
 *       - Game Generation
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/GamePrompt'
 *     responses:
 *       200:
 *         description: Server-Sent Events stream with generation progress and files
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 *       400:
 *         description: Invalid request - missing or invalid prompt
 *       500:
 *         description: Internal server error during generation
 */
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
      totalSteps: 5,
      stepName: "Initialization",
      progress: 0,
      message: "Starting full AI chain (Groq → Grok → Anthropic → Anthropic → Grok)...",
    });

    sendEvent("progress", {
      step: 1,
      totalSteps: 5,
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
      totalSteps: 5,
      stepName: "Grok Initial Code",
      progress: 30,
      message: "Generating initial code with Grok...",
    });

    const grokInitialCode = await llmProvider.generateCleanCodeWithGrok(groqExplanation, prompt, chatId);
    sendEvent("step_complete", {
      step: 2,
      stepName: "Grok Initial Code",
      output: `Initial code generation completed (${grokInitialCode.length} characters)`,
    });

    sendEvent("progress", {
      step: 3,
      totalSteps: 5,
      stepName: "Anthropic Validation 1",
      progress: 50,
      message: "First validation with Anthropic...",
    });

    const anthropicFeedback1 = await llmProvider.validateWithAnthropic(grokInitialCode, prompt, chatId);
    sendEvent("step_complete", {
      step: 3,
      stepName: "Anthropic Validation 1",
      output: `First validation completed (${anthropicFeedback1.length} characters)`,
    });

    sendEvent("progress", {
      step: 4,
      totalSteps: 5,
      stepName: "Anthropic Validation 2",
      progress: 70,
      message: "Second validation with Anthropic for cross-checking...",
    });

    const anthropicFeedback2 = await llmProvider.validateWithAnthropic(grokInitialCode, prompt, chatId);
    sendEvent("step_complete", {
      step: 4,
      stepName: "Anthropic Validation 2",
      output: `Second validation completed (${anthropicFeedback2.length} characters)`,
    });

    sendEvent("progress", {
      step: 5,
      totalSteps: 5,
      stepName: "Grok Final Fixes",
      progress: 80,
      message: "Generating final fixed code with Grok...",
    });

    const grokFinalCode = await llmProvider.generateFinalCodeWithGrok(
      `${anthropicFeedback1}\n\nSecond Validation:\n${anthropicFeedback2}`,
      grokInitialCode,
      prompt,
      chatId
    );
    sendEvent("step_complete", {
      step: 5,
      stepName: "Grok Final Fixes",
      output: `Final code generation completed (${grokFinalCode.length} characters)`,
    });

    sendEvent("progress", {
      step: 5,
      totalSteps: 5,
      stepName: "File Processing",
      progress: 90,
      message: "Parsing and cleaning generated files...",
    });

    const validationResult = validateAndParseNextJsFiles(grokFinalCode, prompt, chatId);
    sendEvent("progress", {
      step: 5,
      totalSteps: 5,
      stepName: "File Streaming",
      progress: 95,
      message: `Streaming ${validationResult.files.length} files...`,
    });

    validationResult.files.forEach((file, index) => {
      sendEvent("file_generated", {
        fileName: file.name,
        fileType: file.type,
        content: file.content,
        size: file.content.length,
        index: index + 1,
        totalFiles: validationResult.files.length,
      });
    });

    const projectId = uuidv4();
    sendEvent("progress", {
      step: 5,
      totalSteps: 5,
      stepName: "Project Setup",
      progress: 98,
      message: "Saving files and setting up project...",
    });

    const projectPath = await saveGeneratedFiles(projectId, validationResult.files);
    const serverInfo = await setupAndRunProject(projectPath);

    sendEvent("complete", {
      chatId,
      projectId,
      totalFiles: validationResult.files.length,
      aiGeneratedFiles: validationResult.files.length - 4,
      missingFilesGenerated: validationResult.missingFiles.length,
      chainUsed: "full",
      chainSteps: [
        "Groq - Game explanation and architecture",
        "Grok - Initial code generation",
        "Anthropic - First code validation",
        "Anthropic - Second code validation",
        "Grok - Final code fixes",
      ],
      setupInstructions: {
        npmInstall: "npm install",
        startCommand: "npm run dev",
        url: serverInfo.url,
        port: serverInfo.port,
        projectPath: `${PROJECTS_DIR}/${projectId}`,
        deploymentType: "localhost",
        subdomain: null,
      },
      validation: {
        isComplete: validationResult.isComplete,
        totalFiles: validationResult.files.length,
        originalFiles: validationResult.files.length,
        missingFiles: validationResult.missingFiles,
      },
    });

    console.log(chalk.green(`FULL chain completed for Chat ${chatId}!`));
    console.log(chalk.green(`🎮 Game is running at: ${serverInfo.url}`));
  } catch (error) {
    console.error(chalk.red(`Error in Full Chain Chat ${chatId}:`, error.message));
    sendEvent("error", {
      error: "Failed to generate web game",
      details: error.message,
      chatId,
    });
  }
  res.end();
});

/**
 * @swagger
 * /api/generate/simple:
 *   post:
 *     summary: Generate 2D web game using simple 2-step AI chain
 *     description: Streams the generation process of a Next.js 2D web game using a 2-step AI chain (Groq → Grok).
 *     tags:
 *       - Game Generation
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/GamePrompt'
 *           examples:
 *             simple_game:
 *               summary: Simple 2D Game
 *               value:
 *                 prompt: "Create a Flappy Bird game with custom SVG assets"
 *     responses:
 *       200:
 *         description: Server-Sent Events stream with generation progress and files
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 *       400:
 *         description: Invalid request - missing or invalid prompt
 *       500:
 *         description: Internal server error during generation
 */
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
    const { prompt, subdomain } = req.body;
    const nginxEnabled = process.env.NGINX_ENABLED === "true";

    if (!prompt || !prompt.trim()) {
      sendEvent("error", { error: "Game description is required", chatId });
      res.end();
      return;
    }

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
        message: "Starting simple AI chain (Groq → Grok)...",
      });
    }

    console.log(chalk.blue(`Game Request: ${prompt}`));

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
      stepName: "Grok Code Generation",
      progress: 60,
      message: "Generating clean, production-ready code with Grok...",
    });

    const grokFinalCode = await llmProvider.generateCleanCodeWithGrok(groqExplanation, prompt, chatId);
    sendEvent("progress", {
      step: 2,
      totalSteps: 2,
      stepName: "Grok Code Generation",
      progress: 80,
      message: "Code generation completed, parsing files...",
    });

    const validationResult = validateAndParseNextJsFiles(grokFinalCode, prompt, chatId);
    sendEvent("progress", {
      step: 2,
      totalSteps: 2,
      stepName: "File Processing",
      progress: 90,
      message: `Streaming ${validationResult.files.length} files...`,
    });

    validationResult.files.forEach((file, index) => {
      sendEvent("file_generated", {
        fileName: file.name,
        fileType: file.type,
        content: file.content,
        size: file.content.length,
        index: index + 1,
        totalFiles: validationResult.files.length,
      });
    });

    const projectId = uuidv4();
    if (nginxEnabled && subdomain) {
      const { httpUrl, httpsUrl } = await deployToNginx(subdomain, validationResult.files, prompt, chatId, sendEvent);
      sendEvent("complete", {
        chatId,
        projectId: subdomain,
        totalFiles: validationResult.files.length,
        aiGeneratedFiles: validationResult.files.length - 4,
        missingFilesGenerated: validationResult.missingFiles.length,
        chainUsed: "simple",
        deploymentType: "nginx",
        chainSteps: ["Groq - Game explanation and architecture", "Grok - Complete clean code generation"],
        setupInstructions: {
          previewUrl: httpsUrl,
          httpUrl,
          subdomain,
          nginxPath: `/var/www/projects/${subdomain}.claw.codes`,
          generatedPath: `generated/${subdomain}`,
        },
        validation: {
          isComplete: validationResult.isComplete,
          totalFiles: validationResult.files.length,
          originalFiles: validationResult.files.length,
          missingFiles: validationResult.missingFiles,
        },
      });
      console.log(chalk.green(`NGINX deployment completed for Chat ${chatId}!`));
      console.log(chalk.green(`🌐 Game deployed at: ${httpUrl}, ${httpsUrl}`));
    } else {
      sendEvent("progress", {
        step: 2,
        totalSteps: 2,
        stepName: "Project Setup",
        progress: 95,
        message: "Saving files and setting up project...",
      });

      const projectPath = await saveGeneratedFiles(projectId, validationResult.files);
      const serverInfo = await setupAndRunProject(projectPath);

      sendEvent("complete", {
        chatId,
        projectId,
        totalFiles: validationResult.files.length,
        aiGeneratedFiles: validationResult.files.length - 4,
        missingFilesGenerated: validationResult.missingFiles.length,
        chainUsed: "simple",
        deploymentType: "localhost",
        chainSteps: ["Groq - Game explanation and architecture", "Grok - Complete clean code generation"],
        setupInstructions: {
          npmInstall: "npm install",
          startCommand: "npm run dev",
          previewUrl: serverInfo.url,
          port: serverInfo.port,
          projectPath,
        },
        validation: {
          isComplete: validationResult.isComplete,
          totalFiles: validationResult.files.length,
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

app.listen(PORT, () => {
  console.log(chalk.green(`✅ Server is running on http://localhost:${PORT}`));
  console.log(chalk.blue(`📖 API Docs available at http://localhost:${PORT}/api-docs`));
});