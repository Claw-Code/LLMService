const chalk = require("chalk");

function validateAndParseReactFiles(generatedCode, chatId, gameType = "canvas", difficulty = "medium") {
  console.log(chalk.cyan(`🔍 Validating ${difficulty.toUpperCase()} ${gameType} React files...`));
  console.log(chalk.blue(`📄 Generated code length: ${generatedCode.length} characters`));

  if (!generatedCode || typeof generatedCode !== "string") {
    console.log(chalk.red("❌ No generated code provided!"));
    return {
      files: [],
      missingFiles: ["src/App.tsx", "src/main.tsx"],
      isComplete: false,
      totalFiles: 0,
      requiredFiles: 2,
      gameType,
      difficulty,
    };
  }

  const files = [];
  const requiredFiles = ["src/App.tsx", "src/main.tsx"];
  const fileSeparators = [
    {
      patterns: [
        /\/\/ === src\/App\.tsx ===([\s\S]*?)(?=\/\/ === |$)/g,
        /\/\/ src\/App\.tsx([\s\S]*?)(?=\/\/ === |\/\/ [a-zA-Z]|$)/g,
        /import React.*?from ["']react["'][\s\S]*?function App.*?\{([\s\S]*?)export default App/g,
      ],
      name: "src/App.tsx",
      type: "tsx",
    },
    {
      patterns: [
        /\/\/ === src\/main\.tsx ===([\s\S]*?)(?=\/\/ === |$)/g,
        /\/\/ src\/main\.tsx([\s\S]*?)(?=\/\/ === |\/\/ [a-zA-Z]|$)/g,
        /import React from ["']react["'][\s\S]*?import ReactDOM[\s\S]*?createRoot([\s\S]*?)(?=\/\/ === |$)/g,
      ],
      name: "src/main.tsx",
      type: "tsx",
    },
    {
      patterns: [
        /\/\/ === src\/components\/GameComponent\.tsx ===([\s\S]*?)(?=\/\/ === |$)/g,
        /\/\/ src\/components\/GameComponent\.tsx([\s\S]*?)(?=\/\/ === |\/\/ [a-zA-Z]|$)/g,
        /```typescript([\s\S]*?)```/g, // Handle markdown-wrapped code
        /import React.*?from ["']react["'][\s\S]*?const GameComponent =.*?=>.*?\{([\s\S]*?)export default GameComponent/g, // Fallback for plain React component
      ],
      name: "src/components/GameComponent.tsx",
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
  ];

  fileSeparators.forEach((separator) => {
    separator.patterns.forEach((pattern) => {
      const matches = [...generatedCode.matchAll(pattern)];
      matches.forEach((match) => {
        if (match[1] && match[1].trim()) {
          let content = match[1].trim();
          // Ensure imports are preserved by checking for React import
          if (separator.name === "src/components/GameComponent.tsx" && !content.includes("import React")) {
            console.log(chalk.yellow(`⚠️ Missing React import in ${separator.name}, adding fallback`));
            content = `import React, { useEffect, useRef, useState } from 'react';\nimport Phaser from 'phaser';\n${content}`;
          }
          files.push({
            name: separator.name,
            content,
            type: separator.type,
            source: "llm-generated",
          });
          console.log(chalk.green(`✅ Found ${separator.name} (${content.split('\n').length} lines)`));
        }
      });
    });
  });

  const missingFiles = requiredFiles.filter((required) => !files.some((file) => file.name === required));
  return {
    files,
    missingFiles,
    isComplete: missingFiles.length === 0,
    totalFiles: files.length,
    requiredFiles: requiredFiles.length,
    gameType,
    difficulty,
  };
}

module.exports = {
  validateAndParseReactFiles,
  createReactProjectStructure,
};