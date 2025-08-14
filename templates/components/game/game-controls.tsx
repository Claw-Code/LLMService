import type { InputState } from "@/types/game"

export class GameControls {
  private inputState: InputState = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    jump: false,
    action: false,
  }

  public onInputChange?: (input: InputState) => void

  private keyMap: { [key: string]: keyof InputState } = {
    w: "forward",
    arrowup: "forward",
    s: "backward",
    arrowdown: "backward",
    a: "left",
    arrowleft: "left",
    d: "right",
    arrowright: "right",
    " ": "jump",
    enter: "action",
  }

  private touchStartPos: { x: number; y: number } | null = null
  private touchThreshold = 50

  constructor(private canvas: HTMLCanvasElement) {}

  initialize(): void {
    this.setupKeyboardControls()
    this.setupTouchControls()
    this.setupMouseControls()
    console.log("Game Controls initialized")
  }

  private setupKeyboardControls(): void {
    // Keyboard event listeners
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      if (key in this.keyMap) {
        event.preventDefault()
        const inputKey = this.keyMap[key]
        if (!this.inputState[inputKey]) {
          this.inputState[inputKey] = true
          this.notifyInputChange()
        }
      }
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      if (key in this.keyMap) {
        event.preventDefault()
        const inputKey = this.keyMap[key]
        this.inputState[inputKey] = false
        this.notifyInputChange()
      }
    }

    // Add event listeners
    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)

    // Store references for cleanup
    this.keyDownHandler = handleKeyDown
    this.keyUpHandler = handleKeyUp
  }

  private setupTouchControls(): void {
    // Touch controls for mobile
    const handleTouchStart = (event: TouchEvent) => {
      event.preventDefault()
      const touch = event.touches[0]
      this.touchStartPos = { x: touch.clientX, y: touch.clientY }
    }

    const handleTouchMove = (event: TouchEvent) => {
      event.preventDefault()
      if (!this.touchStartPos) return

      const touch = event.touches[0]
      const deltaX = touch.clientX - this.touchStartPos.x
      const deltaY = touch.clientY - this.touchStartPos.y

      // Reset input state
      this.inputState.left = false
      this.inputState.right = false
      this.inputState.forward = false
      this.inputState.backward = false

      // Determine direction based on swipe
      if (Math.abs(deltaX) > this.touchThreshold || Math.abs(deltaY) > this.touchThreshold) {
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
          // Horizontal movement
          if (deltaX > 0) {
            this.inputState.right = true
          } else {
            this.inputState.left = true
          }
        } else {
          // Vertical movement
          if (deltaY < 0) {
            this.inputState.forward = true
          } else {
            this.inputState.backward = true
          }
        }
        this.notifyInputChange()
      }
    }

    const handleTouchEnd = (event: TouchEvent) => {
      event.preventDefault()
      this.touchStartPos = null

      // Reset all movement inputs
      this.inputState.left = false
      this.inputState.right = false
      this.inputState.forward = false
      this.inputState.backward = false
      this.notifyInputChange()
    }

    // Tap for jump/action
    const handleTouchTap = (event: TouchEvent) => {
      if (event.touches.length === 1) {
        this.inputState.jump = true
        this.notifyInputChange()

        // Reset jump after short delay
        setTimeout(() => {
          this.inputState.jump = false
          this.notifyInputChange()
        }, 100)
      }
    }

    // Add touch event listeners to canvas
    this.canvas.addEventListener("touchstart", handleTouchStart, { passive: false })
    this.canvas.addEventListener("touchmove", handleTouchMove, { passive: false })
    this.canvas.addEventListener("touchend", handleTouchEnd, { passive: false })

    // Store references for cleanup
    this.touchStartHandler = handleTouchStart
    this.touchMoveHandler = handleTouchMove
    this.touchEndHandler = handleTouchEnd
  }

  private setupMouseControls(): void {
    // Mouse controls for additional interaction
    const handleMouseDown = (event: MouseEvent) => {
      if (event.button === 0) {
        // Left click
        this.inputState.action = true
        this.notifyInputChange()
      }
    }

    const handleMouseUp = (event: MouseEvent) => {
      if (event.button === 0) {
        // Left click
        this.inputState.action = false
        this.notifyInputChange()
      }
    }

    // Prevent context menu on right click
    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault()
    }

    // Add mouse event listeners to canvas
    this.canvas.addEventListener("mousedown", handleMouseDown)
    this.canvas.addEventListener("mouseup", handleMouseUp)
    this.canvas.addEventListener("contextmenu", handleContextMenu)

    // Store references for cleanup
    this.mouseDownHandler = handleMouseDown
    this.mouseUpHandler = handleMouseUp
    this.contextMenuHandler = handleContextMenu
  }

  private notifyInputChange(): void {
    if (this.onInputChange) {
      this.onInputChange({ ...this.inputState })
    }
  }

  // Public methods
  getInputState(): InputState {
    return { ...this.inputState }
  }

  // Method to programmatically set input (useful for AI or replay systems)
  setInput(input: Partial<InputState>): void {
    Object.assign(this.inputState, input)
    this.notifyInputChange()
  }

  // Cleanup method
  dispose(): void {
    // Remove keyboard listeners
    if (this.keyDownHandler) {
      window.removeEventListener("keydown", this.keyDownHandler)
    }
    if (this.keyUpHandler) {
      window.removeEventListener("keyup", this.keyUpHandler)
    }

    // Remove touch listeners
    if (this.touchStartHandler) {
      this.canvas.removeEventListener("touchstart", this.touchStartHandler)
    }
    if (this.touchMoveHandler) {
      this.canvas.removeEventListener("touchmove", this.touchMoveHandler)
    }
    if (this.touchEndHandler) {
      this.canvas.removeEventListener("touchend", this.touchEndHandler)
    }

    // Remove mouse listeners
    if (this.mouseDownHandler) {
      this.canvas.removeEventListener("mousedown", this.mouseDownHandler)
    }
    if (this.mouseUpHandler) {
      this.canvas.removeEventListener("mouseup", this.mouseUpHandler)
    }
    if (this.contextMenuHandler) {
      this.canvas.removeEventListener("contextmenu", this.contextMenuHandler)
    }
  }

  // Private properties to store handler references
  private keyDownHandler?: (event: KeyboardEvent) => void
  private keyUpHandler?: (event: KeyboardEvent) => void
  private touchStartHandler?: (event: TouchEvent) => void
  private touchMoveHandler?: (event: TouchEvent) => void
  private touchEndHandler?: (event: TouchEvent) => void
  private mouseDownHandler?: (event: MouseEvent) => void
  private mouseUpHandler?: (event: MouseEvent) => void
  private contextMenuHandler?: (event: MouseEvent) => void
}
