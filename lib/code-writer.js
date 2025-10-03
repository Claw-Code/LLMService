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

    // Extract code from markdown code blocks or clean up the response
    let gameComponentContent = extractCodeFromResponse(generatedCode);

    // Validate that we have actual code
    if (!gameComponentContent || gameComponentContent.length < 50) {
      throw new Error("No valid code found in LLM response");
    }

    // Ensure the component has proper structure
    gameComponentContent = ensureComponentStructure(gameComponentContent);

    const gameComponentPath = path.join("src", "components", "GameComponent.tsx");

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

function extractCodeFromResponse(response) {
  let code = response.trim();

  // Pattern to extract code from markdown code blocks
  const codeBlockPatterns = [
    /```(?:tsx?|typescript|javascript|jsx?)\s*\n([\s\S]*?)```/gim,
    /```\s*\n([\s\S]*?)```/gim,
    /```([\s\S]*?)```/gim
  ];

  // Try to extract from code blocks
  for (const pattern of codeBlockPatterns) {
    const matches = [...code.matchAll(pattern)];
    if (matches.length > 0) {
      // If multiple code blocks, concatenate them
      code = matches.map(match => match[1]).join('\n\n');
      break;
    }
  }

  // Remove common explanatory prefixes
  const explanationPatterns = [
    /^(?:Here's|Here is|This is|I've created|I have created|Below is)[\s\S]*?(?="use client"|import|export|function|const|let|var|class)/i,
    /^.*?(?="use client"|import|export|function|const|let|var|class)/,
  ];

  for (const pattern of explanationPatterns) {
    if (pattern.test(code)) {
      code = code.replace(pattern, '');
      break;
    }
  }

  // Remove trailing explanations
  const trailingPatterns = [
    /\n\n(?:This code|The code|This implementation|This component|This game)[\s\S]*$/i,
    /\n\n(?:You can|To use|Usage|Note:|Notes:)[\s\S]*$/i,
    /\n\n#+\s*[\s\S]*$/,  // Remove markdown headers and everything after
  ];

  for (const pattern of trailingPatterns) {
    code = code.replace(pattern, '');
  }

  // Clean up any remaining markdown artifacts
  code = code
    .replace(/^#+\s+.*$/gm, '')  // Remove markdown headers
    .replace(/^\*\s+/gm, '')      // Remove markdown lists
    .replace(/^>\s+/gm, '')       // Remove markdown quotes
    .replace(/$$([^$$]+)\]$[^)]+$/g, '$1')  // Remove markdown links

  // Final cleanup
  code = code.trim();

  // Validate that we have actual code
  const hasCodeIndicators = [
    'import',
    'export',
    'function',
    'const',
    'let',
    'var',
    'class',
    'interface',
    'type',
    'React',
    'useState',
    'useEffect'
  ].some(indicator => code.includes(indicator));

  if (!hasCodeIndicators) {
    console.warn(chalk.yellow('⚠️ Extracted text does not appear to be valid code'));
    return '';
  }

  return code;
}

function ensureComponentStructure(code) {
  // Check if it's already properly structured
  if (code.includes('export default') && 
      (code.includes('function GameComponent') || code.includes('const GameComponent'))) {
    return code;
  }

  // Extract the component name if it exists
  const componentNameMatch = code.match(/(?:function|const)\s+(\w+Component)/);
  const componentName = componentNameMatch ? componentNameMatch[1] : 'GameComponent';

  // Check if we need to add imports
  let imports = '';
  if (!code.includes("import React")) {
    imports = "import React from 'react';\n";
    
    // Add common game-related imports if they're used but not imported
    if (code.includes('useState') && !code.includes('import.*useState')) {
      imports = "import React, { useState, useEffect, useRef, useCallback } from 'react';\n";
    }
    if (code.includes('* as THREE') && !code.includes('import.*THREE')) {
      imports += "import * as THREE from 'three';\n";
    }
  }

  // Check if we need to add export
  let exportStatement = '';
  if (!code.includes('export default')) {
    exportStatement = `\nexport default ${componentName};`;
  }

  // If the code doesn't have a proper component structure, wrap it
  if (!code.includes('function') && !code.includes('const') && !code.includes('class')) {
    code = `
${imports}

function GameComponent() {
  ${code}
  
  return (
    <div>
      <canvas ref={canvasRef} />
    </div>
  );
}

export default GameComponent;
    `;
  } else {
    code = imports + code + exportStatement;
  }

  return code.trim();
}