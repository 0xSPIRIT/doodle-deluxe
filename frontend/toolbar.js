export class Toolbar {
  constructor() {
    this.activeTool = "pen"
    this.activeColor = "#000000"

    this.palette = document.getElementById("color-palette")
    this.activeColorEl = document.getElementById("active-color")

    this.disabled = false;

    this.buildPalette()
    this.bindTools()
  }

  buildPalette() {
    const COLORS = [
      "#000000", "#ffffff", "#ef4444", "#f97316",
      "#eab308", "#22c55e", "#3b82f6", "#8b5cf6",
      "#ec4899", "#14b8a6", "#a16207", "#6b7280",
    ]

    COLORS.forEach(color => {
      const swatch = document.createElement("div")
      swatch.className = "color-swatch" + (color === this.activeColor ? " active" : "")
      swatch.style.background = color
      swatch.addEventListener("click", () => this.selectColor(color, swatch))
      this.palette.appendChild(swatch)
    })

    this.activeColorEl.style.background = this.activeColor
  }

  selectColor(color, swatch) {
    if (this.disabled)
      return;

    document.querySelectorAll(".color-swatch").forEach(s => s.classList.remove("active"))
    swatch.classList.add("active")
    this.activeColor = color
    this.activeColorEl.style.background = color
    this.onColorChange(color)
  }

  setTool(tool) {
    if (this.disabled)
      return;

    this.activeTool = tool
    document.querySelectorAll(".tool-btn").forEach(b => b.classList.remove("active"))
    document.getElementById(`tool-${tool}`).classList.add("active")
    this.onToolChange(tool)
  }

  bindTools() {
    document.getElementById("tool-pen").addEventListener("click", () => this.setTool("pen"))
    document.getElementById("tool-bucket").addEventListener("click", () => this.setTool("bucket"))
  }

  // callbacks
  onColorChange(color) {}
  onToolChange(tool) {}
}
