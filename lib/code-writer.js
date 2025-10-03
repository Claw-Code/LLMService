// lib/code-writer.js
import path from "path";
import fs from "fs-extra";
import chalk from "chalk";

export async function parseGeneratedFiles(generatedCode, projectPath, chatId) {
  console.log(chalk.cyan(`🔍 Parsing LLM-generated code for Chat ${chatId}...`));

  const files = [];
  let parseLog = [];
  let validationResults = { status: "SKIPPED" };

  try {
    if (!generatedCode || typeof generatedCode !== "string") {
      throw new Error("Invalid or empty LLM-generated code");
    }

    const componentsDir = path.join(projectPath, "src", "components");
    await fs.ensureDir(componentsDir);

    const gameComponentPath = path.join("src", "components", "GameComponent.tsx");
    let gameComponentContent = generatedCode.trim();

    if (!gameComponentContent.includes("export default")) {
      gameComponentContent = `
import React from 'react';

${gameComponentContent}

export default GameComponent;
      `;
    }

    files.push({
      name: gameComponentPath,
      content: gameComponentContent,
      type: "tsx",
      source: "llm",
    });

    parseLog.push(`Generated ${gameComponentPath} (${gameComponentContent.length} chars)`);
    console.log(chalk.green(`✅ Parsed GameComponent.tsx from LLM response`));

  } catch (error) {
    parseLog.push(`Error parsing LLM response: ${error.message}`);
    console.error(chalk.red(`❌ Failed to parse LLM response: ${error.message}`));
  }

  console.log(chalk.blue(`Returning parsed files: ${files.length} files`));
  return { files, parseLog, validationResults };
}