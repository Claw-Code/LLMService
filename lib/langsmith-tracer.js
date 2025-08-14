import { Client } from "langsmith"
import { v4 as uuidv4 } from "uuid"
import chalk from "chalk"

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