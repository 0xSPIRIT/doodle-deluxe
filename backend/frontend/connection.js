import { ROUTE_BACKEND_SERVER } from "./route.js";

export class Connection {
  constructor(roomId, username) {
    this.roomId = roomId;
    this.username = username;
    this.ws = null;
    this.pingInterval = null;
  }

  connect() {
    console.log("username is ", this.username, "room id is ", this.roomId);
    this.inRoom = true;
    this.ws = new WebSocket(`wss://${ROUTE_BACKEND_SERVER}/ws/${this.roomId}?username=${this.username}`);

    this.ws.addEventListener("open", () => this.onOpen());
    this.ws.addEventListener("message", e => {
      try {
        const data = JSON.parse(e.data);
        this.onReceiveMessage(data);
      } catch (error) {
        console.error("Error parsing JSON: ", error);
      }
    });
    this.ws.addEventListener("close", e => this.onClose(e));
  }

  isConnected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  send(data) {
    if (this.isConnected()) {
      this.ws.send(JSON.stringify(data));
    }
  }

  onReceiveMessage(data) {}
  onOpen() {}
  onClose(e) {}
}

