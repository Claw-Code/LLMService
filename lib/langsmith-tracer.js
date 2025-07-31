import { Client } from "langsmith"
import { v4 as uuidv4 } from "uuid"
import chalk from "chalk"

// Initialize LangSmith client
let langsmithClient = null

try {
  if (process.env.LANGSMITH_TRACING === "true" && process.env.LANGSMITH_API_KEY) {
    langsmithClient = new Client({
      apiUrl: process.env.LANGSMITH_ENDPOINT || "https://api.smith.langchain.com",
      apiKey: process.env.LANGSMITH_API_KEY,
    })
    console.log(chalk.green("✅ LangSmith tracing initialized"))
  } else {
    console.log(chalk.yellow("⚠️  LangSmith tracing disabled (missing config)"))
  }
} catch (error) {
  console.log(chalk.red("❌ LangSmith initialization failed:", error.message))
}

// Tracing decorator function
export function traceable(name, metadata = {}) {
  return (target, propertyKey, descriptor) => {
    const originalMethod = descriptor.value

    descriptor.value = async function (...args) {
      if (!langsmithClient) {
        // If LangSmith is not available, just run the original function
        return await originalMethod.apply(this, args)
      }

      const runId = uuidv4()
      const startTime = Date.now()

      try {
        // Create run in LangSmith
        await langsmithClient.createRun({
          id: runId,
          name: name,
          run_type: "llm",
          inputs: {
            args: args.length > 0 ? args[0] : {},
            metadata: metadata,
          },
          project_name: process.env.LANGSMITH_PROJECT || "ClawCode-Unity-Generator",
          start_time: new Date().toISOString(),
        })

        console.log(chalk.blue(`🔍 LangSmith trace started: ${name} (${runId.slice(0, 8)})`))

        // Execute the original method
        const result = await originalMethod.apply(this, args)

        // Update run with success
        await langsmithClient.updateRun(runId, {
          outputs: { result: typeof result === "string" ? result.slice(0, 1000) : result },
          end_time: new Date().toISOString(),
          status: "success",
        })

        console.log(chalk.green(`✅ LangSmith trace completed: ${name} (${Date.now() - startTime}ms)`))

        return result
      } catch (error) {
        // Update run with error
        if (langsmithClient) {
          try {
            await langsmithClient.updateRun(runId, {
              error: error.message,
              end_time: new Date().toISOString(),
              status: "error",
            })
          } catch (updateError) {
            console.log(chalk.red("Failed to update LangSmith run:", updateError.message))
          }
        }

        console.log(chalk.red(`❌ LangSmith trace failed: ${name} - ${error.message}`))
        throw error
      }
    }

    return descriptor
  }
}

// Manual tracing function for non-decorator usage
export async function traceFunction(name, fn, inputs = {}, metadata = {}) {
  if (!langsmithClient) {
    return await fn()
  }

  const runId = uuidv4()
  const startTime = Date.now()

  try {
    await langsmithClient.createRun({
      id: runId,
      name: name,
      run_type: "llm",
      inputs: { ...inputs, metadata },
      project_name: process.env.LANGSMITH_PROJECT || "ClawCode-Unity-Generator",
      start_time: new Date().toISOString(),
    })

    console.log(chalk.blue(`🔍 LangSmith trace started: ${name} (${runId.slice(0, 8)})`))

    const result = await fn()

    await langsmithClient.updateRun(runId, {
      outputs: { result: typeof result === "string" ? result.slice(0, 1000) : result },
      end_time: new Date().toISOString(),
      status: "success",
    })

    console.log(chalk.green(`✅ LangSmith trace completed: ${name} (${Date.now() - startTime}ms)`))

    return result
  } catch (error) {
    if (langsmithClient) {
      try {
        await langsmithClient.updateRun(runId, {
          error: error.message,
          end_time: new Date().toISOString(),
          status: "error",
        })
      } catch (updateError) {
        console.log(chalk.red("Failed to update LangSmith run:", updateError.message))
      }
    }

    console.log(chalk.red(`❌ LangSmith trace failed: ${name} - ${error.message}`))
    throw error
  }
}

// OpenRouter integration for additional models with multiple API keys
export class OpenRouterClient {
  constructor() {
    // Support multiple OpenRouter API keys for load balancing
    this.apiKeys = [
      process.env.OPENROUTER_API_KEY,
      process.env.OPENROUTER_API_KEY_2,
      process.env.OPENROUTER_API_KEY_3,
    ].filter(key => key) // Remove undefined/empty keys
    
    this.currentKeyIndex = 0
    this.baseUrl = "https://openrouter.ai/api/v1"
    
    if (this.apiKeys.length === 0) {
      throw new Error("No OpenRouter API keys configured. Please set OPENROUTER_API_KEY, OPENROUTER_API_KEY_2, and/or OPENROUTER_API_KEY_3")
    }
    
    console.log(chalk.green(`✅ OpenRouter initialized with ${this.apiKeys.length} API key(s)`))
  }

  // Round-robin key selection to distribute load
  getNextApiKey() {
    const key = this.apiKeys[this.currentKeyIndex]
    this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length
    return key
  }

  async createChatCompletion(model, messages, options = {}) {
    const maxRetries = this.apiKeys.length
    let lastError = null

    // Try each API key in case of rate limiting
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const apiKey = this.getNextApiKey()
      
      try {
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
            "HTTP-Referer": "https://claw.codes",
            "X-Title": "Claw Code Generator",
          },
          body: JSON.stringify({
            model: model,
            messages: messages,
            temperature: options.temperature || 0.7,
            max_tokens: options.max_tokens || 4000,
            top_p: options.top_p || 1,
            stream: false,
          }),
        })

        if (!response.ok) {
          const errorText = await response.text()
          lastError = new Error(`OpenRouter API error: ${response.status} ${response.statusText} - ${errorText}`)
          
          // If rate limited, try next key
          if (response.status === 429) {
            console.log(chalk.yellow(`⚠️  Rate limited on key ${attempt + 1}, trying next key...`))
            continue
          }
          
          throw lastError
        }

        const data = await response.json()
        return data.choices[0]?.message?.content || ""
        
      } catch (error) {
        lastError = error
        console.log(chalk.yellow(`⚠️  Attempt ${attempt + 1} failed: ${error.message}`))
        
        // If this is the last attempt, throw the error
        if (attempt === maxRetries - 1) {
          throw lastError
        }
      }
    }

    throw lastError || new Error("All OpenRouter API keys failed")
  }
}

export { langsmithClient }
