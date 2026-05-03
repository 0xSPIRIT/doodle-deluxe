import { chat, canvas, joinButton, setReadyButtonDisabled, renderUI } from "./ui.js";
import { Connection } from "./connection.js";
import { Room } from "./room.js";

export class Game {
  constructor() {
    this.room = null;
    this.connection = null;

    this.clearState();

    joinButton.addEventListener("click", () => this.clickJoinButton());
    canvas.doStroke = ({x, y, px, py}) => this.doStroke({x, y, px, py});
  }

  clearState() {
    this.errorMsg = "";
    this.statusMsg = "Waiting for the game to begin...";

    this.isReady = false;
    this.isPlaying = false;
    this.hasSolved = false;
    this.receivedSync = false;
  }

  clickJoinButton() {}

  joinRoom(roomId, username) {
    this.clearState();

    this.room = new Room(roomId, username);
    this.room.onTimerExpiry = () => this.onTimerExpiry();
    this.connection = new Connection(roomId, username);
    this.connection.onOpen = () => this.onOpen();
    this.connection.onClose = (e) => this.onClose(e);
    this.connection.onReceiveMessage = (data) => this.handleMessage(data);

    this.connection.connect();

    chat.onSend = (text) => {
      chat.pushMessage(`You: ${text}`);
      this.connection.send({ type: "guess", text: text, player: this.room.username });
    };
  }

  onOpen() {
    console.log("CONNECTED");

    this.pingInterval = setInterval(() => {
      console.log("SENT: ping");
      this.connection.send({type: "ping"});
    }, 1000);

    fetch(`http://127.0.0.1:8000/game/${this.room.roomId}/players`)
      .then(response => response.json())
      .then(data => {
        if (this.connection.isConnected()) {
          this.room.players = data;
          renderUI({statusMessage: this.statusMsg, players: data, player_drawing: "", playing: false, answer: "", username: this.room.username});
        }
      });
  }

  onClose(e) {
    this.room = null;
    console.log("DISCONNECT -- Reason: ", e.reason);
    if (e.reason) {
      this.setStatus(e.reason);
    }
    clearInterval(this.pingInterval);
    this.isPlaying = false;
  }

  ready() {
    if (!this.room || !this.connection || this.isReady)
      return;

    this.isReady = true;
    this.connection.send({ type: "ready" });
  }

  setError(errorMsg) {
    this.errorMsg = errorMsg;
  }

  setStatus(statusMsg) {
    this.statusMsg = statusMsg;
  }

  displayAnswer() {
    this.setStatus("The answer was " + this.room.answer + "!");
  }

  onTimerExpiry() {
    this.connection.send({ type: "timer_expired" });
  }

  // This function sends canvas state to the server,
  // which then forwards to the particular user destination as requested.
  sendCanvasToPlayer(player) {
    const data_b64 = canvas.getImageDataBase64();
    const message = {
      type: "canvas_sync",
      data: data_b64,
      player_from: this.username,
      player_to: player,
    };
    this.connection.send(message);
  }

  receiveCanvas({ data }) {
    this.receivedSync = true;
    const img = new Image();
    img.src = data;
    img.onload = () => canvas.drawImage(img);
  }

  beginRound({ player_drawing, answer }) {
    chat.pushMessage("Begin round!", "#3eb85f");

    this.room.beginRound({ player_drawing, answer });

    if (player_drawing === this.room.username) {
      chat.setInputDisabled(true);
      chat.setSendDisabled(true);
      canvas.setDisabled(false);
      chat.pushMessage("You are drawing!");
    } else {
      chat.setInputDisabled(false);
      chat.setSendDisabled(false);
      canvas.setDisabled(true);
      chat.pushMessage(player_drawing + " is drawing!");
    }

    if (player_drawing === "") {
      this.statusMsg = "Waiting for the game to begin...";
    } else if (player_drawing === username) {
      this.statusMsg = "You are drawing";
    } else {
      this.statusMsg = player_drawing + " is drawing";
    }

    this.isPlaying = true;
  }

  endRound() {
    const wasDrawing = this.room.playerDrawing === username;

    this.isReady = false;
    this.isPlaying = false;
    setReadyButtonDisabled(false);

    this.room.endRound();

    const messageColor = (this.hasSolved || wasDrawing) ? "#3eb85f" : "var(--accent2)";

    this.displayAnswer();

    chat.pushMessage("Round complete!", messageColor);
    chat.pushMessage("Press \"I\'m ready\" to proceed!", "var(--accent2)");

    chat.setInputDisabled(false);
    chat.setSendDisabled(false);

    this.statusMsg = "Waiting for the game to begin...";
  }

  playerSolved({ player, score }) {
    this.room.playerSolved(player, score);

    let str = "You";

    if (player !== this.room.username) {
      str = player;
      this.displayAnswer();
    } else {
      chat.setInputDisabled(true);
      chat.setSendDisabled(true);
      this.hasSolved = true;
    }

    chat.pushMessage(`${str} guessed correctly!`, "#3eb85f");
  }

  doStroke({x, y, px, py}) {
    if (this.room.playerDrawing !== this.room.username)
      return;

    if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height)
      return;

    const stroke_message = {
      "type": "stroke",
      "player": this.room.username,
      "px": px,
      "py": py,
      "x": x,
      "y": y
    };

    // This sends the stroke to the server, which will then broadcast
    // to all other players.
    this.connection.send(stroke_message);

    canvas.drawStroke(px, py, x, y);
  }

  handleMessage(data) {
    switch (data.type) {
      case "error":
        this.setError(data.error);
        break;
      case "player_joined":
        this.room.joinPlayer(data.player);
        if (data.player !== this.room.username) {
          this.sendCanvasToPlayer(data.player);
        }
        break;
      case "player_left":
        this.room.leavePlayer(data.player);
        break;
      case "ready":
        this.room.setPlayerReady(data.player);
        break;
      case "round_begin":
        this.beginRound(data);
        break;
      case "stroke":
        if (data.player === this.room.username)
          break;

        canvas.drawStroke(data.px, data.py, data.x, data.y);
        break;
      case "round_complete":
        this.endRound();
        this.hasSolved = false;
        break;
      case "guess":
        if (data.player !== this.room.username) {
          chat.pushMessage(`${data.player}: ${data.text}`);
        }
        break;
      case "solved":
        this.playerSolved(data);
        break;
      case "canvas_sync": // Receive the canvas sync
        if (this.receivedSync)
          break;

        this.receiveCanvas(data);
        break;
    }

    renderUI({
      statusMessage: this.statusMsg,
      players: this.room.players,
      player_drawing: this.room.playerDrawing,
      playing: this.isPlaying,
      answer: this.room.answer,
      username: this.room.username
    });
  }
}
