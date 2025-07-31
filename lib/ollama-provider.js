import fetch from "node-fetch"
import chalk from "chalk"

export class OllamaProvider {
  constructor() {
    this.baseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434"
    this.model = process.env.OLLAMA_MODEL || "deepseek-coder:6.7b"
    this.timeout = 300000 // 5 minutes timeout for large code generation
    
    console.log(chalk.blue(`🤖 Ollama initialized with model: ${this.model}`))
  }

  async createChatCompletion(messages, options = {}) {
    try {
      console.log(chalk.blue(`🤖 Ollama: Using model ${this.model}`))
      
      const requestBody = {
        model: this.model,
        messages: messages,
        stream: false,
        options: {
          temperature: options.temperature || 0.2,
          top_p: options.top_p || 1,
          num_predict: options.max_tokens || 8000,
          stop: options.stop || [],
        }
      }

      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
        timeout: this.timeout,
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Ollama API error: ${response.status} ${response.statusText} - ${errorText}`)
      }

      const data = await response.json()
      const content = data.message?.content || ""
      
      console.log(chalk.green(`✅ Ollama response: ${content.length} characters`))
      return content

    } catch (error) {
      console.log(chalk.red(`❌ Ollama error: ${error.message}`))
      
      // Check if Ollama is not running
      if (error.code === "ECONNREFUSED" || error.message.includes("connect")) {
        console.log(chalk.yellow("⚠️  Ollama is not running. Please start Ollama with: ollama serve"))
        console.log(chalk.yellow("   Then pull the model with: ollama pull deepseek-coder:6.7b"))
      }
      
      throw error
    }
  }

  async isAvailable() {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: "GET",
        timeout: 5000,
      })
      return response.ok
    } catch (error) {
      return false
    }
  }

  async listModels() {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: "GET",
        timeout: 5000,
      })
      
      if (!response.ok) {
        throw new Error(`Failed to list models: ${response.statusText}`)
      }
      
      const data = await response.json()
      return data.models || []
    } catch (error) {
      console.log(chalk.red(`❌ Failed to list Ollama models: ${error.message}`))
      return []
    }
  }

  async pullModel(modelName = null) {
    const model = modelName || this.model
    console.log(chalk.blue(`📥 Pulling Ollama model: ${model}`))
    
    try {
      const response = await fetch(`${this.baseUrl}/api/pull`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: model }),
      })

      if (!response.ok) {
        throw new Error(`Failed to pull model: ${response.statusText}`)
      }

      console.log(chalk.green(`✅ Successfully pulled model: ${model}`))
      return true
    } catch (error) {
      console.log(chalk.red(`❌ Failed to pull model ${model}: ${error.message}`))
      return false
    }
  }
}

export default OllamaProvider 