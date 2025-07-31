#!/usr/bin/env node

import { execSync } from 'child_process'
import chalk from 'chalk'
import fs from 'fs'

console.log(chalk.blue('🚀 Ollama Setup Script'))
console.log(chalk.blue('=====================\n'))

async function checkOllamaInstallation() {
  try {
    const version = execSync('ollama --version', { encoding: 'utf8' })
    console.log(chalk.green(`✅ Ollama is installed: ${version.trim()}`))
    return true
  } catch (error) {
    console.log(chalk.red('❌ Ollama is not installed'))
    console.log(chalk.yellow('📥 Installing Ollama...'))
    
    try {
      // Detect OS and provide installation instructions
      const platform = process.platform
      if (platform === 'darwin') {
        console.log(chalk.blue('🍎 macOS detected'))
        console.log(chalk.yellow('Run: curl -fsSL https://ollama.ai/install.sh | sh'))
      } else if (platform === 'linux') {
        console.log(chalk.blue('🐧 Linux detected'))
        console.log(chalk.yellow('Run: curl -fsSL https://ollama.ai/install.sh | sh'))
      } else if (platform === 'win32') {
        console.log(chalk.blue('🪟 Windows detected'))
        console.log(chalk.yellow('Download from: https://ollama.ai/download'))
      }
      
      console.log(chalk.yellow('\nAfter installation, restart your terminal and run this script again.'))
      return false
    } catch (installError) {
      console.log(chalk.red('Failed to provide installation instructions'))
      return false
    }
  }
}

async function startOllamaService() {
  try {
    console.log(chalk.blue('🔄 Starting Ollama service...'))
    execSync('ollama serve', { stdio: 'pipe' })
    console.log(chalk.green('✅ Ollama service started'))
    return true
  } catch (error) {
    console.log(chalk.yellow('⚠️  Ollama service might already be running'))
    return true
  }
}

async function pullYiCoderModel() {
  try {
    console.log(chalk.blue('📥 Pulling deepseek-coder:6.7b model...'))
    console.log(chalk.yellow('This may take several minutes depending on your internet connection...'))
    
    execSync('ollama pull deepseek-coder:6.7b', { stdio: 'inherit' })
    console.log(chalk.green('✅ deepseek-coder:6.7b model downloaded successfully'))
    return true
  } catch (error) {
    console.log(chalk.red('❌ Failed to pull deepseek-coder:6.7b model'))
    console.log(chalk.yellow('You can try manually: ollama pull deepseek-coder:6.7b'))
    return false
  }
}

async function testOllamaConnection() {
  try {
    console.log(chalk.blue('🧪 Testing Ollama connection...'))
    
    const response = await fetch('http://localhost:11434/api/tags')
    if (response.ok) {
      const data = await response.json()
      console.log(chalk.green('✅ Ollama is running and accessible'))
      console.log(chalk.blue(`📋 Available models: ${data.models?.map(m => m.name).join(', ') || 'None'}`))
      return true
    } else {
      console.log(chalk.red('❌ Ollama is not responding properly'))
      return false
    }
  } catch (error) {
    console.log(chalk.red('❌ Cannot connect to Ollama'))
    console.log(chalk.yellow('Make sure Ollama is running: ollama serve'))
    return false
  }
}



async function main() {
  console.log(chalk.blue('🔧 Setting up Ollama for local AI coding...\n'))
  
  // Check if Ollama is installed
  const isInstalled = await checkOllamaInstallation()
  if (!isInstalled) {
    console.log(chalk.red('\n❌ Please install Ollama first and run this script again.'))
    process.exit(1)
  }
  
  // Start Ollama service
  await startOllamaService()
  
  // Test connection
  const isConnected = await testOllamaConnection()
  if (!isConnected) {
    console.log(chalk.red('\n❌ Cannot connect to Ollama. Please start the service manually.'))
    process.exit(1)
  }
  
  // Pull the model
  const modelPulled = await pullYiCoderModel()
  if (!modelPulled) {
    console.log(chalk.yellow('\n⚠️  Model pull failed. You can try manually later.'))
  }
  
  // Create environment file
  await createEnvFile()
  
  console.log(chalk.green('\n🎉 Ollama setup completed!'))
  console.log(chalk.blue('\n📝 Next steps:'))
  console.log(chalk.yellow('1. Start your application with: USE_OLLAMA=true node server.js'))
  console.log(chalk.yellow('2. Or set USE_OLLAMA=true in your .env file'))
  console.log(chalk.yellow('3. Test with: curl http://localhost:11434/api/generate -d \'{"model": "deepseek-coder:6.7b", "prompt": "Hello"}\''))
  
  console.log(chalk.blue('\n🔧 To switch back to OpenRouter:'))
  console.log(chalk.yellow('Set USE_OLLAMA=false in your .env file'))
}

main().catch(console.error) 