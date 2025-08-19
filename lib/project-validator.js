import fs from "fs/promises"
import path from "path"

class ReactProjectValidator {
  constructor(schemaPath = "templates/react-project-schema.json") {
    this.schemaPath = schemaPath
    this.schema = null
  }

  async loadSchema() {
    if (!this.schema) {
      const schemaContent = await fs.readFile(this.schemaPath, "utf8")
      this.schema = JSON.parse(schemaContent)
    }
    return this.schema
  }

  async validateProjectStructure(projectPath, generatedFiles = []) {
    const schema = await this.loadSchema()
    const validation = {
      valid: true,
      errors: [],
      warnings: [],
      summary: {
        required_files: { found: 0, missing: [] },
        forbidden_files: { found: 0, list: [] },
        total_files: 0,
        game_engine: null,
      },
    }

    try {
      // Check if project directory exists
      const projectExists = await this.directoryExists(projectPath)
      if (!projectExists) {
        validation.valid = false
        validation.errors.push(`Project directory does not exist: ${projectPath}`)
        return validation
      }

      // Get all files in project
      const allFiles = await this.getAllFiles(projectPath)
      validation.summary.total_files = allFiles.length

      // Validate required files
      for (const requiredFile of schema.structure.required_files) {
        const filePath = path.join(projectPath, requiredFile)
        const exists = await this.fileExists(filePath)

        if (exists) {
          validation.summary.required_files.found++
          await this.validateFileContent(filePath, requiredFile, schema, validation)
        } else {
          validation.summary.required_files.missing.push(requiredFile)
          validation.errors.push(`Missing required file: ${requiredFile}`)
          validation.valid = false
        }
      }

      // Check for forbidden files
      for (const forbiddenFile of schema.structure.forbidden_files) {
        const filePath = path.join(projectPath, forbiddenFile)
        const exists = await this.fileExists(filePath)

        if (exists) {
          validation.summary.forbidden_files.found++
          validation.summary.forbidden_files.list.push(forbiddenFile)
          validation.errors.push(`Forbidden file found: ${forbiddenFile}`)
          validation.valid = false
        }
      }

      // Validate file count limits
      if (validation.summary.total_files > schema.structure.validation_rules.max_total_files) {
        validation.warnings.push(
          `Too many files: ${validation.summary.total_files} (max: ${schema.structure.validation_rules.max_total_files})`,
        )
      }

      // Detect game engine
      validation.summary.game_engine = await this.detectGameEngine(projectPath)

      // Validate package.json dependencies
      await this.validatePackageJson(projectPath, schema, validation)
    } catch (error) {
      validation.valid = false
      validation.errors.push(`Validation error: ${error.message}`)
    }

    return validation
  }

  async validateFileContent(filePath, fileName, schema, validation) {
    const patterns = schema.structure.file_patterns[fileName]
    if (!patterns) return

    try {
      const content = await fs.readFile(filePath, "utf8")

      // Check required content
      if (patterns.must_contain) {
        for (const required of patterns.must_contain) {
          if (!content.includes(required)) {
            validation.warnings.push(`File ${fileName} missing required content: ${required}`)
          }
        }
      }

      // Check for game engines in App.tsx
      if (fileName === "src/App.tsx" && patterns.game_engines) {
        const hasPhaser = content.toLowerCase().includes("phaser")
        const hasBabylon = content.toLowerCase().includes("babylon")

        if (hasPhaser && hasBabylon) {
          validation.warnings.push("App.tsx contains both Phaser and Babylon - should use only one")
        } else if (hasPhaser) {
          validation.summary.game_engine = "phaser"
        } else if (hasBabylon) {
          validation.summary.game_engine = "babylon"
        }
      }
    } catch (error) {
      validation.warnings.push(`Could not validate content of ${fileName}: ${error.message}`)
    }
  }

  async validatePackageJson(projectPath, schema, validation) {
    const packagePath = path.join(projectPath, "package.json")

    try {
      const packageContent = await fs.readFile(packagePath, "utf8")
      const packageJson = JSON.parse(packageContent)

      const allDeps = { ...packageJson.dependencies, ...packageJson.devDependencies }

      // Check required dependencies
      for (const requiredDep of schema.structure.validation_rules.required_dependencies) {
        if (!allDeps[requiredDep]) {
          validation.errors.push(`Missing required dependency: ${requiredDep}`)
          validation.valid = false
        }
      }

      // Check for Next.js dependencies (forbidden)
      const nextjsDeps = ["next", "@next/font", "next-themes"]
      for (const nextDep of nextjsDeps) {
        if (allDeps[nextDep]) {
          validation.errors.push(`Forbidden Next.js dependency found: ${nextDep}`)
          validation.valid = false
        }
      }
    } catch (error) {
      validation.warnings.push(`Could not validate package.json: ${error.message}`)
    }
  }

  async detectGameEngine(projectPath) {
    try {
      const appPath = path.join(projectPath, "src/App.tsx")
      const content = await fs.readFile(appPath, "utf8")

      const hasPhaser = content.toLowerCase().includes("phaser")
      const hasBabylon = content.toLowerCase().includes("babylon")

      if (hasPhaser && hasBabylon) return "both"
      if (hasPhaser) return "phaser"
      if (hasBabylon) return "babylon"
      return "none"
    } catch {
      return "unknown"
    }
  }

  async getAllFiles(dirPath, fileList = []) {
    const files = await fs.readdir(dirPath)

    for (const file of files) {
      const filePath = path.join(dirPath, file)
      const stat = await fs.stat(filePath)

      if (stat.isDirectory()) {
        if (!file.startsWith(".") && file !== "node_modules") {
          await this.getAllFiles(filePath, fileList)
        }
      } else {
        fileList.push(path.relative(dirPath, filePath))
      }
    }

    return fileList
  }

  async fileExists(filePath) {
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }

  async directoryExists(dirPath) {
    try {
      const stat = await fs.stat(dirPath)
      return stat.isDirectory()
    } catch {
      return false
    }
  }

  generateValidationReport(validation) {
    const report = {
      timestamp: new Date().toISOString(),
      status: validation.valid ? "PASSED" : "FAILED",
      summary: validation.summary,
      details: {
        errors: validation.errors,
        warnings: validation.warnings,
      },
    }

    return report
  }
}
export { ReactProjectValidator }