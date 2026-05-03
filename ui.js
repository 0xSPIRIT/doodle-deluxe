class Chat {
  constructor() {
    this.chat_input    = document.getElementById("chat-input");
    this.chat_messages = document.getElementById("chat-messages");
    this.chat_send     = document.getElementById("chat-send");

    this.chat_send.addEventListener("click", () => this.send());
    this.chat_input.addEventListener("keydown", e => {
      if (e.key === "Enter") this.send();
    });

    this.chat_messages.scrollTop = this.chat_messages.scrollHeight;
  }

  pushMessage(text, color = null) {
    const line = document.createElement("p");
    line.style.margin = "4px 0"; line.style.color = color ?? "var(--text)";
    line.textContent = text;
    this.chat_messages.appendChild(line);
  }

  send() {
    const text = this.chat_input.value.trim();

    if (!text)
      return;

    this.chat_input.value = "";
    this.onSend(text);
  }

  onSend(text) {}

  setInputDisabled(disabled) {
    this.chat_input.disabled = disabled;
  }

  setSendDisabled(disabled) {
    this.chat_send.disabled = disabled;
  }
}

class Canvas {
  constructor() {
    this.canvas = document.getElementById("canvas");
    this.ctx = this.canvas.getContext("2d");
    this.width = this.canvas.width;
    this.height = this.canvas.height;
    this.mouseDown = false;
    this.px = this.py = 0;

    // Set line width
    this.ctx.lineWidth = 10;
    this.ctx.lineJoin = "round";

    this.canvas.addEventListener("mousedown", (event) => {
      this.px = event.offsetX;
      this.py = event.offsetY;
      this.mouseDown = true;

      const x = event.offsetX;
      const y = event.offsetY;

      this.doStroke({x: x, y: y, px: this.px, py: this.py});

      this.px = x;
      this.py = y;
    });

    const stopMouse = (event) => { this.mouseDown = false; };

    this.canvas.addEventListener("mouseup", stopMouse);
    this.canvas.addEventListener("mouseleave", stopMouse);
    this.canvas.addEventListener("mousemove", (event) => {
      if (this.mouseDown) {
        const x = event.offsetX;
        const y = event.offsetY;

        this.doStroke({x: x, y: y, px: this.px, py: this.py});

        this.px = x;
        this.py = y;
      }
    });
  }

  doStroke({x, y, px, py}) {}

  getImageDataBase64() {
    return this.canvas.toDataURL("image/png");
  }

  setDisabled(disabled) {
    this.canvas.disabled = disabled;
  }

  drawPoint(x, y) {
    this.ctx.arc(x, y, this.ctx.lineWidth / 5, 0, Math.PI * 2);
    this.ctx.fillStyle = this.ctx.strokeStyle;
    this.ctx.fill();
  }

  // TODO: Fix
  drawStroke(x0, y0, x1, y1) {
    this.ctx.beginPath();

    if (x0 == x1 && y0 == y1) {
      this.drawPoint(x0, y0);
    } else {
      this.ctx.moveTo(x0, y0);
      this.ctx.lineTo(x1, y1);
      this.ctx.closePath();
      this.ctx.stroke();
    }
  }

  drawImage(img) {
    this.ctx.drawImage(img, 0, 0);
  }
}

export const chat = new Chat();
export const canvas = new Canvas();

const list = document.getElementById("players-list");

export const joinButton = document.getElementById("join");
export const readyButton = document.getElementById("ready");

const answerElem = document.getElementById("answer");
const statusElem = document.getElementById("status");

export function setReadyButtonDisabled(disabled) {
  readyButton.disabled = disabled;
}

export function renderUI({statusMessage, players, player_drawing, playing, answer, username}) {
  statusElem.textContent = statusMessage;

  list.innerHTML = players.map(p => {
    let readyBadge = "";

    if (playing) {
      if (p.name === player_drawing) {
        readyBadge = `<span style="color: red; font-size: 0.75rem; font-weight: 700;">Drawing</span>`;
      } else if (p.solved) {
      readyBadge = `<span style="color: #32a852; font-size: 0.75rem; font-weight: 700;">Solved</span>`;
      }
    } else if (p.ready_for_round) {
      readyBadge = `<span style="color: #4ecdc4; font-size: 0.75rem; font-weight: 700;">Ready</span>`;
    } else {
      readyBadge = `<span style="color: #8892a4; font-size: 0.75rem;">waiting...</span>`;
    }

    const isYou = p.name === username;
    const name = p.name + (isYou ? " (you)" : "");
    const style = isYou ? "font-weight: 1000;" : "font-weight: 200;";

    return `
      <li>
        <span style="${style}">${name}</span>
        <div style="display: flex; align-items: center; gap: 10px;">
          ${readyBadge}
          <span class="player-score">${p.score}pts</span>
        </div>
      </li>`;
  }).join("");

  answerElem.textContent = (playing && answer && username === player_drawing) ? "Draw: " + answer : "";
}
