// ============================================================================
// REACT VITE FILE VALIDATION AND PARSING
// ============================================================================

const chalk = require("chalk")

function validateAndParseReactFiles(generatedCode, chatId, gameType = "canvas", difficulty = "medium") {
  console.log(chalk.cyan(`🔍 Validating ${difficulty.toUpperCase()} ${gameType} React files...`))
  console.log(chalk.blue(`📄 Generated code length: ${generatedCode.length} characters`))

  if (!generatedCode || typeof generatedCode !== "string") {
    console.log(chalk.red("❌ No generated code provided!"))
    return {
      files: [],
      missingFiles: ["src/App.tsx", "src/main.tsx"],
      isComplete: false,
      totalFiles: 0,
      requiredFiles: 2,
      gameType,
      difficulty,
    }
  }

  const files = []
  const requiredFiles = ["src/App.tsx", "src/main.tsx"]

  // React file separators
  const fileSeparators = [
    {
      patterns: [
        /\/\/ === src\/App\.tsx ===([\s\S]*?)(?=\/\/ === |$)/g,
        /\/\/ src\/App\.tsx([\s\S]*?)(?=\/\/ === |\/\/ [a-zA-Z]|$)/g,
        /import React.*?from "react"[\s\S]*?function App.*?\{([\s\S]*?)export default App/g,
      ],
      name: "src/App.tsx",
      type: "tsx",
    },
    {
      patterns: [
        /\/\/ === src\/main\.tsx ===([\s\S]*?)(?=\/\/ === |$)/g,
        /\/\/ src\/main\.tsx([\s\S]*?)(?=\/\/ === |\/\/ [a-zA-Z]|$)/g,
        /import React from "react"[\s\S]*?import ReactDOM[\s\S]*?createRoot([\s\S]*?)(?=\/\/ === |$)/g,
      ],
      name: "src/main.tsx",
      type: "tsx",
    },
    {
      patterns: [
        /\/\/ === src\/components\/PhaserGame\.tsx ===([\s\S]*?)(?=\/\/ === |$)/g,
        /\/\/ src\/components\/PhaserGame\.tsx([\s\S]*?)(?=\/\/ === |\/\/ [a-zA-Z]|$)/g,
      ],
      name: "src/components/PhaserGame.tsx",
      type: "tsx",
    },
    {
      patterns: [
        /\/\/ === src\/components\/BabylonGame\.tsx ===([\s\S]*?)(?=\/\/ === |$)/g,
        /\/\/ src\/components\/BabylonGame\.tsx([\s\S]*?)(?=\/\/ === |\/\/ [a-zA-Z]|$)/g,
      ],
      name: "src/components/BabylonGame.tsx",
      type: "tsx",
    },
    {
      patterns: [
        /\/\/ === src\/App\.css ===([\s\S]*?)(?=\/\/ === |$)/g,
        /\/\/ src\/App\.css([\s\S]*?)(?=\/\/ === |\/\/ [a-zA-Z]|$)/g,
      ],
      name: "src/App.css",
      type: "css",
    },
    {
      patterns: [
        /\/\/ === src\/index\.css ===([\s\S]*?)(?=\/\/ === |$)/g,
        /\/\/ src\/index\.css([\s\S]*?)(?=\/\/ === |\/\/ [a-zA-Z]|$)/g,
      ],
      name: "src/index.css",
      type: "css",
    },
  ]

  // Parse files from generated code
  fileSeparators.forEach((separator) => {
    separator.patterns.forEach((pattern) => {
      const matches = [...generatedCode.matchAll(pattern)]
      matches.forEach((match) => {
        if (match[1] && match[1].trim()) {
          files.push({
            name: separator.name,
            content: match[1].trim(),
            type: separator.type,
            source: "llm-generated",
          })
          console.log(chalk.green(`✅ Found ${separator.name}`))
        }
      })
    })
  })

  // Check for missing required files
  const missingFiles = requiredFiles.filter((required) => !files.some((file) => file.name === required))

  return {
    files,
    missingFiles,
    isComplete: missingFiles.length === 0,
    totalFiles: files.length,
    requiredFiles: requiredFiles.length,
    gameType,
    difficulty,
  }
}

// ============================================================================
// REACT VITE PROJECT STRUCTURE CREATION
// ============================================================================

function createReactProjectStructure(
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

  console.log(chalk.cyan(`🏗️ Building React Vite structure for ${gameName}...`))

  // Add missing required files with fallbacks
  const fallbackTemplates = {
    "src/App.tsx": `import React from 'react';
import './App.css';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>${gameName.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</h1>
        <p>Your game will appear here!</p>
      </header>
    </div>
  );
}

export default App;`,

    "src/main.tsx": `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);`,

    "src/App.css": `#root {
  max-width: 1280px;
  margin: 0 auto;
  padding: 2rem;
  text-align: center;
}

.App {
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.App-header {
  background-color: #282c34;
  padding: 20px;
  color: white;
  border-radius: 8px;
}`,

    "src/index.css": `:root {
  font-family: Inter, system-ui, Avenir, Helvetica, Arial, sans-serif;
  line-height: 1.5;
  font-weight: 400;
  color-scheme: light dark;
  color: rgba(255, 255, 255, 0.87);
  background-color: #242424;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  display: flex;
  place-items: center;
  min-width: 320px;
  min-height: 100vh;
}

#root {
  width: 100%;
}`,
  }

  // Add missing files
  missingFiles.forEach((fileName) => {
    const fallbackContent = fallbackTemplates[fileName]
    if (fallbackContent) {
      completeFiles.push({
        name: fileName,
        content: fallbackContent,
        type: fileName.split(".").pop() || "txt",
        source: "fallback-template",
      })
      console.log(chalk.green(`✅ Added fallback ${fileName}`))
    }
  })

  console.log(chalk.green(`✅ React structure built with ${completeFiles.length} files`))
  return completeFiles
}

module.exports = {
  validateAndParseReactFiles,
  createReactProjectStructure,
}
