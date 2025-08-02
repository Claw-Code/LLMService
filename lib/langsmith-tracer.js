import { Client } from "langsmith";
import { v4 as uuidv4 } from "uuid";
import chalk from "chalk";

// Initialize LangSmith client
let langsmithClient = null;

try {
  if (process.env.LANGSMITH_TRACING === "true" && process.env.LANGSMITH_API_KEY) {
    langsmithClient = new Client({
      apiUrl: process.env.LANGSMITH_ENDPOINT || "https://api.smith.langchain.com",
      apiKey: process.env.LANGSMITH_API_KEY,
    });
    console.log(chalk.green("✅ LangSmith tracing initialized"));
  } else {
    console.log(chalk.yellow("⚠️ LangSmith tracing disabled (missing config)"));
  }
} catch (error) {
  console.log(chalk.red("❌ LangSmith initialization failed:", error.message));
}

// Tracing decorator function
export function traceable(name, metadata = {}) {
  return (target, propertyKey, descriptor) => {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args) {
      if (!langsmithClient) {
        return await originalMethod.apply(this, args);
      }

      const runId = uuidv4();
      const startTime = Date.now();

      try {
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
        });

        console.log(chalk.blue(`🔍 LangSmith trace started: ${name} (${runId.slice(0, 8)})`));

        const result = await originalMethod.apply(this, args);

        await langsmithClient.updateRun(runId, {
          outputs: { result: typeof result === "string" ? result.slice(0, 1000) : result },
          end_time: new Date().toISOString(),
          status: "success",
        });

        console.log(chalk.green(`✅ LangSmith trace completed: ${name} (${Date.now() - startTime}ms)`));

        return result;
      } catch (error) {
        if (langsmithClient) {
          try {
            await langsmithClient.updateRun(runId, {
              error: error.message,
              end_time: new Date().toISOString(),
              status: "error",
            });
          } catch (updateError) {
            console.log(chalk.red("Failed to update LangSmith run:", updateError.message));
          }
        }

        console.log(chalk.red(`❌ LangSmith trace failed: ${name} - ${error.message}`));
        throw error;
      }
    };

    return descriptor;
  };
}

// Manual tracing function for non-decorator usage
export async function traceFunction(name, fn, inputs = {}, metadata = {}) {
  if (!langsmithClient) {
    return await fn();
  }

  const runId = uuidv4();
  const startTime = Date.now();

  try {
    await langsmithClient.createRun({
      id: runId,
      name: name,
      run_type: "llm",
      inputs: { ...inputs, metadata },
      project_name: process.env.LANGSMITH_PROJECT || "ClawCode-Unity-Generator",
      start_time: new Date().toISOString(),
    });

    console.log(chalk.blue(`🔍 LangSmith trace started: ${name} (${runId.slice(0, 8)})`));

    const result = await fn();

    await langsmithClient.updateRun(runId, {
      outputs: { result: typeof result === "string" ? result.slice(0, 1000) : result },
      end_time: new Date().toISOString(),
      status: "success",
    });

    console.log(chalk.green(`✅ LangSmith trace completed: ${name} (${Date.now() - startTime}ms)`));

    return result;
  } catch (error) {
    if (langsmithClient) {
      try {
        await langsmithClient.updateRun(runId, {
          error: error.message,
          end_time: new Date().toISOString(),
          status: "error",
        });
      } catch (updateError) {
        console.log(chalk.red("Failed to update LangSmith run:", updateError.message));
      }
    }

    console.log(chalk.red(`❌ LangSmith trace failed: ${name} - ${error.message}`));
    throw error;
  }
}

// OpenRouter integration for additional models
export class OpenRouterClient {
  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY;
    this.baseUrl = "https://openrouter.ai/api/v1";
  }

  async createChatCompletion(model, messages, options = {}) {
    if (!this.apiKey) {
      throw new Error("OPENROUTER_API_KEY not configured");
    }

    const payload = {
      model: model,
      messages: messages,
      temperature: options.temperature || 0.2,
      max_tokens: options.max_tokens || 1000,
      top_p: options.top_p || 1,
      stream: false,
    };

    console.log(chalk.cyan(`OpenRouter request to ${this.baseUrl}/chat/completions: ${JSON.stringify({ model, messages: messages.map(m => ({ role: m.role, content: m.content.slice(0, 100) + "..." }))}, null, 2)}`));

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
          "HTTP-Referer": "https://unity-ai-generator.com",
          "X-Title": "Unity AI Generator",
        },
        body: JSON.stringify(payload),
      });

      const responseBody = await response.text();
      if (!response.ok) {
        console.error(chalk.red(`OpenRouter API error: ${response.status} ${response.statusText}`));
        console.error(chalk.red(`Response body: ${responseBody}`));
        throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}, Details: ${responseBody}`);
      }

      const data = JSON.parse(responseBody);
      console.log(chalk.green(`OpenRouter response: ${data.choices[0]?.message?.content.slice(0, 100) + "..."}`));
      return data;
    } catch (error) {
      console.error(chalk.red(`OpenRouter API request failed: ${error.message}`));
      throw error;
    }
  }
}

export { langsmithClient };