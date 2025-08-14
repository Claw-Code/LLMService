import {
    Engine,
    Scene,
    FreeCamera,
    HemisphericLight,
    Vector3,
    MeshBuilder,
    StandardMaterial,
    Color3,
    type Mesh,
    DirectionalLight,
    ShadowGenerator,
  } from "@babylonjs/core"
  import type { GameObject } from "@/types/game"
  
  export class GameEngine {
    private engine: Engine
    private scene: Scene
    private camera: FreeCamera
    private light: HemisphericLight
    private shadowGenerator?: ShadowGenerator
    private gameObjects: Map<string, Mesh> = new Map()
    private lastTime = 0
  
    constructor(private canvas: HTMLCanvasElement) {
      this.engine = new Engine(canvas, true, {
        preserveDrawingBuffer: true,
        stencil: true,
        antialias: true,
      })
      this.scene = new Scene(this.engine)
      this.camera = new FreeCamera("camera", new Vector3(0, 5, -10), this.scene)
      this.light = new HemisphericLight("light", new Vector3(0, 1, 0), this.scene)
    }
  
    async initialize(): Promise<void> {
      try {
        // Setup camera
        this.camera.setTarget(Vector3.Zero())
        this.camera.attachControls(this.canvas, true)
        this.camera.speed = 0.5
  
        // Setup lighting
        this.light.intensity = 0.7
        this.light.diffuse = new Color3(1, 1, 0.9)
  
        // Add directional light for shadows
        const dirLight = new DirectionalLight("dirLight", new Vector3(-1, -1, -1), this.scene)
        dirLight.position = new Vector3(20, 40, 20)
        dirLight.intensity = 0.5
  
        // Setup shadow generator
        this.shadowGenerator = new ShadowGenerator(1024, dirLight)
        this.shadowGenerator.useBlurExponentialShadowMap = true
  
        // Create environment
        await this.createEnvironment()
  
        // Setup render loop
        this.engine.runRenderLoop(() => {
          this.scene.render()
        })
  
        // Handle window resize
        window.addEventListener("resize", () => {
          this.engine.resize()
        })
  
        console.log("Game Engine initialized successfully")
      } catch (error) {
        console.error("Failed to initialize game engine:", error)
        throw error
      }
    }
  
    private async createEnvironment(): Promise<void> {
      // Create ground
      const ground = MeshBuilder.CreateGround(
        "ground",
        {
          width: 50,
          height: 50,
        },
        this.scene,
      )
  
      const groundMaterial = new StandardMaterial("groundMaterial", this.scene)
      groundMaterial.diffuseColor = new Color3(0.2, 0.6, 0.2)
      groundMaterial.specularColor = new Color3(0, 0, 0)
      ground.material = groundMaterial
      ground.receiveShadows = true
  
      // Create skybox
      const skybox = MeshBuilder.CreateSphere("skyBox", { diameter: 100 }, this.scene)
      const skyboxMaterial = new StandardMaterial("skyBox", this.scene)
      skyboxMaterial.backFaceCulling = false
      skyboxMaterial.diffuseColor = new Color3(0.1, 0.3, 0.8)
      skyboxMaterial.disableLighting = true
      skybox.material = skyboxMaterial
      skybox.infiniteDistance = true
    }
  
    createGameObject(id: string, type: string, position: Vector3, options: any = {}): Mesh {
      let mesh: Mesh
  
      switch (type) {
        case "player":
          mesh = MeshBuilder.CreateBox(id, { size: 1 }, this.scene)
          const playerMaterial = new StandardMaterial(`${id}Material`, this.scene)
          playerMaterial.diffuseColor = new Color3(0.8, 0.2, 0.2)
          mesh.material = playerMaterial
          break
  
        case "enemy":
          mesh = MeshBuilder.CreateSphere(id, { diameter: 1 }, this.scene)
          const enemyMaterial = new StandardMaterial(`${id}Material`, this.scene)
          enemyMaterial.diffuseColor = new Color3(0.8, 0.1, 0.1)
          mesh.material = enemyMaterial
          break
  
        case "collectible":
          mesh = MeshBuilder.CreateCylinder(
            id,
            {
              height: 0.5,
              diameterTop: 0.8,
              diameterBottom: 0.8,
            },
            this.scene,
          )
          const collectibleMaterial = new StandardMaterial(`${id}Material`, this.scene)
          collectibleMaterial.diffuseColor = new Color3(1, 0.8, 0)
          collectibleMaterial.emissiveColor = new Color3(0.2, 0.16, 0)
          mesh.material = collectibleMaterial
          break
  
        case "obstacle":
          mesh = MeshBuilder.CreateBox(
            id,
            {
              width: options.width || 2,
              height: options.height || 3,
              depth: options.depth || 1,
            },
            this.scene,
          )
          const obstacleMaterial = new StandardMaterial(`${id}Material`, this.scene)
          obstacleMaterial.diffuseColor = new Color3(0.4, 0.4, 0.4)
          mesh.material = obstacleMaterial
          break
  
        default:
          mesh = MeshBuilder.CreateBox(id, { size: 1 }, this.scene)
          break
      }
  
      mesh.position = position
  
      // Add shadows
      if (this.shadowGenerator) {
        this.shadowGenerator.addShadowCaster(mesh)
        mesh.receiveShadows = true
      }
  
      this.gameObjects.set(id, mesh)
      return mesh
    }
  
    updateGameObject(id: string, gameObject: GameObject): void {
      const mesh = this.gameObjects.get(id)
      if (mesh && gameObject.active) {
        mesh.position.x = gameObject.x
        mesh.position.y = gameObject.y
        mesh.position.z = gameObject.z || 0
  
        // Update rotation if provided
        if (gameObject.rotation) {
          mesh.rotation.x = gameObject.rotation.x || 0
          mesh.rotation.y = gameObject.rotation.y || 0
          mesh.rotation.z = gameObject.rotation.z || 0
        }
  
        // Update scale if provided
        if (gameObject.scale) {
          mesh.scaling.x = gameObject.scale.x || 1
          mesh.scaling.y = gameObject.scale.y || 1
          mesh.scaling.z = gameObject.scale.z || 1
        }
  
        mesh.setEnabled(true)
      } else if (mesh) {
        mesh.setEnabled(false)
      }
    }
  
    removeGameObject(id: string): void {
      const mesh = this.gameObjects.get(id)
      if (mesh) {
        mesh.dispose()
        this.gameObjects.delete(id)
      }
    }
  
    update(deltaTime: number, gameObjects: GameObject[]): void {
      // Update all game objects
      gameObjects.forEach((obj) => {
        this.updateGameObject(obj.id, obj)
      })
  
      // Update camera to follow player if exists
      const playerMesh = this.gameObjects.get("player")
      if (playerMesh) {
        const targetPosition = playerMesh.position.add(new Vector3(0, 5, -10))
        this.camera.position = Vector3.Lerp(this.camera.position, targetPosition, 0.05)
        this.camera.setTarget(playerMesh.position)
      }
    }
  
    render(): void {
      // Rendering is handled by the engine's render loop
    }
  
    getDeltaTime(): number {
      const currentTime = performance.now()
      const deltaTime = (currentTime - this.lastTime) / 1000
      this.lastTime = currentTime
      return Math.min(deltaTime, 0.016) // Cap at 60fps
    }
  
    getScene(): Scene {
      return this.scene
    }
  
    getCamera(): FreeCamera {
      return this.camera
    }
  
    dispose(): void {
      // Dispose all game objects
      this.gameObjects.forEach((mesh) => mesh.dispose())
      this.gameObjects.clear()
  
      // Dispose scene and engine
      this.scene.dispose()
      this.engine.dispose()
    }
  }
  