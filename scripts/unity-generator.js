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

// Unity Game Development Prompt
const UNITY_GAME_DEVELOPMENT_PROMPT = `You are a **senior Unity game developer** with 10+ years of experience. Create a **complete, production-ready Unity game** with clean, modular C# architecture.

## CORE REQUIREMENTS:
- **Unity Version**: 2022.3+ LTS
- **Template**: 3D Core Template
- **Language**: C# only
- **Architecture**: Clean, modular, production-grade code
- **No external plugins** except Unity packages (TextMeshPro, Input System)

## MANDATORY CODE STRUCTURE:
\`\`\`
Assets/
├── Scripts/
│   ├── Managers/
│   │   ├── GameManager.cs (Singleton, game state, core logic)
│   │   ├── UIManager.cs (UI updates, screen management)
│   │   └── AudioManager.cs (sound effects, music)
│   ├── Controllers/
│   │   └── PlayerController.cs (input handling, player logic)
│   ├── Core/
│   │   ├── GameSettings.cs (ScriptableObject for settings)
│   │   └── GameEvents.cs (UnityEvents for decoupling)
│   └── Utilities/
│       └── Extensions.cs (helper methods)
├── Scenes/
│   └── Main.unity
├── Prefabs/
├── Materials/
└── Audio/
\`\`\`

## ESSENTIAL UNITY PATTERNS:
1. **MonoBehaviour Lifecycle**: Proper use of Awake(), Start(), Update(), FixedUpdate()
2. **Singleton Pattern**: For managers (GameManager.Instance)
3. **Object Pooling**: For frequently spawned objects
4. **ScriptableObjects**: For game settings and data
5. **UnityEvents**: For loose coupling between systems
6. **Coroutines**: For time-based operations
7. **Component-based**: Each script has single responsibility

## REQUIRED SYSTEMS:

### GameManager.cs Template:
\`\`\`csharp
using UnityEngine;
using UnityEngine.SceneManagement;

public class GameManager : MonoBehaviour
{
    public static GameManager Instance { get; private set; }
    
    [Header("Game Settings")]
    [SerializeField] private GameSettings gameSettings;
    
    [Header("References")]
    [SerializeField] private UIManager uiManager;
    [SerializeField] private AudioManager audioManager;
    
    // Game state variables
    private int score = 0;
    private bool gameActive = true;
    
    private void Awake()
    {
        if (Instance == null)
        {
            Instance = this;
            DontDestroyOnLoad(gameObject);
        }
        else
        {
            Destroy(gameObject);
        }
    }
    
    private void Start() => InitializeGame();
    private void Update() => HandleGameLoop();
    
    // Core game methods here...
}
\`\`\`

### UIManager.cs Template:
\`\`\`csharp
using UnityEngine;
using UnityEngine.UI;
using TMPro;

public class UIManager : MonoBehaviour
{
    [Header("UI Panels")]
    [SerializeField] private GameObject gamePanel;
    [SerializeField] private GameObject gameOverPanel;
    
    [Header("UI Elements")]
    [SerializeField] private TextMeshProUGUI scoreText;
    [SerializeField] private Button restartButton;
    
    private void Start()
    {
        restartButton.onClick.AddListener(RestartGame);
    }
    
    public void UpdateScore(int score) => scoreText.text = "Score: " + score;
    public void ShowGameOver() => gameOverPanel.SetActive(true);
    
    private void RestartGame() => GameManager.Instance.RestartGame();
}
\`\`\`

## CODING STANDARDS:
- **Naming**: PascalCase for public, camelCase for private
- **Serialization**: [SerializeField] for private fields in inspector
- **Headers**: [Header("Category")] for organization
- **Null Checks**: Always check for null references
- **Performance**: Cache components, avoid GetComponent in Update
- **Comments**: XML documentation for public methods

## GAME MECHANICS TO IMPLEMENT:
1. **Player Input**: Keyboard/mouse/controller support
2. **Game Loop**: Start → Play → GameOver → Restart
3. **Score System**: Points, high score, progression
4. **Audio**: Sound effects, background music
5. **UI**: HUD, menus, game over screen
6. **Physics**: Collision detection, movement
7. **Spawning**: Object creation/destruction
8. **Difficulty**: Progressive challenge increase

## UNITY-SPECIFIC FEATURES:
- **Canvas**: Screen Space - Overlay for UI
- **Audio Source**: 3D/2D audio setup
- **Rigidbody**: Physics-based movement
- **Colliders**: Trigger and collision detection
- **Prefabs**: Reusable game objects
- **Materials**: Visual styling
- **Lighting**: Proper scene illumination
- **Camera**: Positioned for optimal gameplay

## ERROR-FREE REQUIREMENTS:
- All scripts must compile without errors
- Proper using statements (UnityEngine, System.Collections, etc.)
- No missing references or null exceptions
- All public fields assigned in inspector
- Proper scene setup instructions included

## SCENE SETUP INSTRUCTIONS FORMAT:
\`\`\`
Scene Hierarchy:
├── Main Camera (CameraController.cs)
├── Directional Light
├── GameManager (GameManager, UIManager, AudioManager)
├── Player (PlayerController, Rigidbody, Collider)
├── Canvas
│   ├── ScoreText (TextMeshPro)
│   └── GameOverPanel
│       ├── FinalScoreText
│       └── RestartButton
└── Audio
    └── AudioSource
\`\`\`

## OUTPUT FORMAT:
1. **Complete C# scripts** with full implementation
2. **Scene setup instructions** with GameObject hierarchy
3. **Prefab specifications** with components and settings
4. **Material/Audio requirements** with properties
5. **No TODOs or placeholders** - everything functional

Generate a complete, deployable Unity project that can be opened in Unity Editor and played immediately without any additional setup or missing components.`

// Step 1: Generate initial draft using Groq + Llama
async function getUnityDraft(taskDescription) {
  console.log("🚀 Generating initial Unity C# draft with Groq + Llama 3.3 70B...")

  const prompt = `${UNITY_GAME_DEVELOPMENT_PROMPT}

## SPECIFIC GAME REQUEST:
Create a ${taskDescription} game with the following requirements:
- Complete Unity C# implementation
- All required scripts and components
- Scene setup instructions
- Production-ready code quality
- No external dependencies beyond Unity packages

Generate ONLY the C# code and setup instructions, no explanations.`

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
      max_tokens: 4000,
    })

    return completion.choices[0]?.message?.content || ""
  } catch (error) {
    console.error("❌ Error with Groq API:", error.message)
    throw error
  }
}

// Step 2: Refine code using Claude Haiku
async function getUnityRefinement(rawCode) {
  console.log("✨ Refining Unity code with Claude 3 Haiku...")

  const prompt = `You are a senior Unity developer specializing in C# optimization. Please review and improve this Unity C# code:

${rawCode}

Optimization goals:
- Fix any syntax errors or compilation issues
- Improve performance and memory management
- Add proper error handling and null checks
- Enhance code structure and readability
- Ensure Unity best practices are followed
- Add any missing essential Unity components
- Optimize MonoBehaviour lifecycle usage
- Ensure proper serialization and inspector setup

Return only the improved C# code and setup instructions, no explanations.`

  try {
    const message = await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 4000,
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

// Step 3: Unity C# validation
function validateUnityCode(code) {
  console.log("🔍 Validating Unity C# code...")

  const requiredElements = ["using UnityEngine", "MonoBehaviour", "void Start", "void Update", "GameManager"]

  const validationResults = {
    passed: true,
    issues: [],
  }

  // Check for required Unity elements
  requiredElements.forEach((element) => {
    if (!code.includes(element)) {
      validationResults.passed = false
      validationResults.issues.push(`Missing required element: ${element}`)
    }
  })

  // Check for Unity-specific patterns
  const unityPatterns = ["[SerializeField]", "[Header(", "public class", "private void", "public void"]

  unityPatterns.forEach((pattern) => {
    if (!code.includes(pattern)) {
      validationResults.issues.push(`Missing Unity pattern: ${pattern}`)
    }
  })

  // Check for basic C# syntax
  const openBraces = (code.match(/{/g) || []).length
  const closeBraces = (code.match(/}/g) || []).length

  if (openBraces !== closeBraces) {
    validationResults.passed = false
    validationResults.issues.push("Mismatched braces detected")
  }

  return validationResults
}

// Main execution function
async function generateUnityGame() {
  try {
    console.log("🎮 Unity AI Code Generator")
    console.log("============================\n")

    // Get task description from command line or user input
    let taskDescription = process.argv[2]

    if (!taskDescription) {
      taskDescription = await getUserInput("Enter your Unity game description: ")
    }

    if (!taskDescription.trim()) {
      console.log("❌ No task description provided. Exiting...")
      process.exit(1)
    }

    console.log(`📝 Task: ${taskDescription}\n`)

    // Step 1: Generate initial draft
    const rawDraft = await getUnityDraft(taskDescription)
    console.log("✅ Initial Unity draft generated\n")

    // Step 2: Refine with Claude
    const optimizedCode = await getUnityRefinement(rawDraft)
    console.log("✅ Unity code refined and optimized\n")

    // Step 3: Validate
    const validation = validateUnityCode(optimizedCode)

    if (validation.passed) {
      console.log("✅ Unity validation passed\n")
    } else {
      console.log("⚠️  Unity validation issues found:")
      validation.issues.forEach((issue) => console.log(`   - ${issue}`))
      console.log("")
    }

    // Step 4: Output final code
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
    const filename = `unity-game-${timestamp}.cs`

    // Add header comment to the code
    const finalCode = `// Unity Game Generated by AI
// Task: ${taskDescription}
// Generated: ${new Date().toISOString()}
// Architecture: Groq (Llama 3.3 70B) → Claude 3 Haiku → Unity Validation

${optimizedCode}`

    // Write to file
    writeFileSync(filename, finalCode)
    console.log(`📁 Final Unity code saved to: ${filename}`)

    // Also output to console if requested
    const showInConsole = await getUserInput("\nShow code in console? (y/n): ")
    if (showInConsole.toLowerCase().startsWith("y")) {
      console.log("\n" + "=".repeat(50))
      console.log("GENERATED UNITY C# CODE:")
      console.log("=".repeat(50))
      console.log(finalCode)
    }

    console.log("\n🎉 Unity generation complete!")
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
generateUnityGame().catch(console.error)
