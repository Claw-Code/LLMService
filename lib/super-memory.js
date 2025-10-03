// supermemory-client.js
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import chalk from "chalk";

export class SupermemoryMCPClient {
  constructor() {
    this.client = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      const transport = new StdioClientTransport({
        command: "npx",
        args: ["-y", "@supermemory/mcp"]
      });

      this.client = new Client({
        name: "game-generator-client",
        version: "1.0.0",
      }, {
        capabilities: {}
      });

      await this.client.connect(transport);
      this.isConnected = true;
      console.log(chalk.green("✅ Connected to Supermemory MCP"));

      // List available tools
      const tools = await this.client.listTools();
      console.log(chalk.blue("Available Supermemory tools:"), tools);

      return true;
    } catch (error) {
      console.error(chalk.red("❌ Failed to connect to Supermemory MCP:"), error);
      return false;
    }
  }

  async addMemory(content, metadata = {}) {
    if (!this.isConnected) {
      await this.connect();
    }

    try {
      const result = await this.client.callTool("add_memory", {
        content,
        metadata: JSON.stringify(metadata)
      });
      console.log(chalk.green("✅ Memory added to Supermemory"));
      return result;
    } catch (error) {
      console.error(chalk.red("❌ Failed to add memory:"), error);
      throw error;
    }
  }

  async searchMemories(query, limit = 10) {
    if (!this.isConnected) {
      await this.connect();
    }

    try {
      const result = await this.client.callTool("search_memories", {
        query,
        limit
      });
      console.log(chalk.blue(`📚 Found ${result.results?.length || 0} memories`));
      return result;
    } catch (error) {
      console.error(chalk.red("❌ Failed to search memories:"), error);
      throw error;
    }
  }

  async close() {
    if (this.client) {
      await this.client.close();
      this.isConnected = false;
      console.log(chalk.yellow("👋 Disconnected from Supermemory MCP"));
    }
  }
}