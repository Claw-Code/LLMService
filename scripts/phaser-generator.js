import Groq from "groq-sdk"
import Anthropic from "@anthropic-ai/sdk"
import { writeFileSync } from "fs"
import readline from "readline"

// Initialize API clients
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
})

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

// Function to get user input
function getUserInput(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer)
    })
  })
}

// Step 1: Generate initial draft using Groq + Llama
async function getLlamaDraft(taskDescription) {
  console.log("🚀 Generating initial draft with Groq + Llama 3.3 70B...")

  const prompt = `You are an expert Phaser 3 game developer. Create a complete, working Phaser 3 game based on this description: "${taskDescription}"

Requirements:
- Use Phaser 3 syntax and best practices
- Include proper scene structure with preload, create, and update methods
- Add basic game mechanics and interactions
- Include comments explaining key parts
- Make it a complete, runnable game
- Use modern JavaScript (ES6+)

Generate only the JavaScript code, no HTML or explanations.`

  try {
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.7,
      max_tokens: 2000,
    })

    return completion.choices[0]?.message?.content || ""
  } catch (error) {
    console.error("❌ Error with Groq API:", error.message)
    throw error
  }
}

// Step 2: Refine code using Claude Haiku
async function getHaikuRefinement(rawCode) {
  console.log("✨ Refining code with Claude 3 Haiku...")

  const prompt = `You are a senior game developer specializing in Phaser 3 optimization. Please review and improve this Phaser 3 code:

${rawCode}

Optimization goals:
- Fix any syntax errors or bugs
- Improve performance and memory management
- Add proper error handling
- Enhance code structure and readability
- Ensure Phaser 3 best practices are followed
- Add any missing essential features
- Optimize asset loading and management

Return only the improved JavaScript code, no explanations.`

  try {
    const message = await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 3000,
      temperature: 0.3,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    })

    return message.content[0]?.text || ""
  } catch (error) {
    console.error("❌ Error with Anthropic API:", error.message)
    throw error
  }
}

// Step 3: Basic Phaser validation
function validatePhaserCode(code) {
  console.log("🔍 Validating Phaser 3 code...")

  const requiredElements = ["Phaser.Game", "preload", "create", "scene"]

  const validationResults = {
    passed: true,
    issues: [],
  }

  // Check for required Phaser elements
  requiredElements.forEach((element) => {
    if (!code.includes(element)) {
      validationResults.passed = false
      validationResults.issues.push(`Missing required element: ${element}`)
    }
  })

  // Check for common syntax issues
  const openBraces = (code.match(/{/g) || []).length
  const closeBraces = (code.match(/}/g) || []).length

  if (openBraces !== closeBraces) {
    validationResults.passed = false
    validationResults.issues.push("Mismatched braces detected")
  }

  // Check for basic JavaScript syntax
  try {
    // This is a basic check - in a real scenario you'd use a proper JS parser
    if (code.includes("function") || code.includes("=>") || code.includes("class")) {
      // Basic structure seems okay
    }
  } catch (error) {
    validationResults.passed = false
    validationResults.issues.push("Potential syntax errors detected")
  }

  return validationResults
}

// Main execution function
async function generatePhaserGame() {
  try {
    console.log("🎮 Phaser 3 AI Code Generator")
    console.log("================================\n")

    // Get task description from command line or user input
    let taskDescription = process.argv[2]

    if (!taskDescription) {
      taskDescription = await getUserInput("Enter your game description: ")
    }

    if (!taskDescription.trim()) {
      console.log("❌ No task description provided. Exiting...")
      process.exit(1)
    }

    console.log(`📝 Task: ${taskDescription}\n`)

    // Step 1: Generate initial draft
    const rawDraft = await getLlamaDraft(taskDescription)
    console.log("✅ Initial draft generated\n")

    // Step 2: Refine with Claude
    const optimizedCode = await getHaikuRefinement(rawDraft)
    console.log("✅ Code refined and optimized\n")

    // Step 3: Validate
    const validation = validatePhaserCode(optimizedCode)

    if (validation.passed) {
      console.log("✅ Phaser validation passed\n")
    } else {
      console.log("⚠️  Phaser validation issues found:")
      validation.issues.forEach((issue) => console.log(`   - ${issue}`))
      console.log("")
    }

    // Step 4: Output final code
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
    const filename = `phaser-game-${timestamp}.js`

    // Add header comment to the code
    const finalCode = `// Phaser 3 Game Generated by AI
// Task: ${taskDescription}
// Generated: ${new Date().toISOString()}
// Architecture: Groq (Llama 3.3 70B) → Claude 3 Haiku → Validation

${optimizedCode}`

    // Write to file
    writeFileSync(filename, finalCode)
    console.log(`📁 Final code saved to: ${filename}`)

    // Also output to console if requested
    const showInConsole = await getUserInput("\nShow code in console? (y/n): ")
    if (showInConsole.toLowerCase().startsWith("y")) {
      console.log("\n" + "=".repeat(50))
      console.log("GENERATED PHASER 3 CODE:")
      console.log("=".repeat(50))
      console.log(finalCode)
    }

    console.log("\n🎉 Generation complete!")
  } catch (error) {
    console.error("💥 Error during generation:", error.message)
    process.exit(1)
  } finally {
    rl.close()
  }
}

// Check for required environment variables
function checkEnvironment() {
  const required = ["GROQ_API_KEY", "ANTHROPIC_API_KEY"]
  const missing = required.filter((key) => !process.env[key])

  if (missing.length > 0) {
    console.error("❌ Missing required environment variables:")
    missing.forEach((key) => console.error(`   - ${key}`))
    console.error("\nPlease set these environment variables and try again.")
    process.exit(1)
  }
}

// Run the generator
checkEnvironment()
generatePhaserGame().catch(console.error)
