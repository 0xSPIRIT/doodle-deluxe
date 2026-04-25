from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from dataclasses import dataclass, field
from pydantic import BaseModel

app = FastAPI()

# TODO: In prod, change this to my server address
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"]
)

class AddPlayersRequest(BaseModel):
    names: list[str] = field(default_factory=list)

@dataclass
class Player:
    name: str
    score: int = 0
    solved: bool = False  # Reset after each round

@dataclass
class Room:
    id: int
    current_drawing: int = 0  # Index of player currently needing to draw
    answer: str = "Test"      # Current answer
    players: list[Player] = field(default_factory=list)

    def has_player(self, name: str) -> bool:
        return any(p.name == name for p in self.players)

    def add_player(self, name: str) -> bool:
        if self.has_player(name):
            return False

        self.players.append(Player(name=name))
        return True

    def remove_player(self, name: str) -> bool:
        self.players = [p for p in self.players if p.name != name]

    def check_guess(self, guess: str) -> bool:
        return self.answer == guess

rooms = []

def get_room_by_id(room_id: int) -> Room:
    return next((r for r in rooms if r.id == room_id), None)

r = Room(id=100)
rooms.append(r)

# Holds a dictionary of lists of websocket connections; key=room_id
class ConnectionManager:
    def __init__(self):
        self.connections: dict[int, list[WebSocket]] = {}

    async def connect(self, room_id: int, ws: WebSocket):
        await ws.accept()

        if room_id not in self.connections:
            self.connections[room_id] = []
    
        self.connections[room_id].append(ws)

        print(f"Opened connection {ws}")

    def disconnect(self, room_id: int, name: str, ws: WebSocket):
        # Remove from connections list
        if room_id in self.connections:
            self.connections[room_id] = [w for w in self.connections[room_id] if w != ws]

        # Remove from room
        room = get_room_by_id(room_id)
        if room:
            room.remove_player(name)

    async def broadcast(self, room_id: int, msg: dict):
        for ws in self.connections[room_id]:
            await ws.send_json(msg)

manager = ConnectionManager()

@app.get("/game/{room_id}/players")
def read_players_state(room_id: int):
    room = get_room_by_id(room_id)

    if room:
        return room.players
    else:
        raise HTTPException(status_code=404, detail="Room not found")

@app.websocket("/ws/{room_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: int, username: str):
    room = get_room_by_id(room_id)

    if room is None:
        await websocket.close(code=1008, reason="Room not found")
        return

    if room.has_player(username):
        await websocket.close(code=1008, reaosn="Username already taken")
        return

    await manager.connect(room_id, websocket)
    room.add_player(username)

    await manager.broadcast(room_id, {"type": "player_joined", "player": username})

    try:
        while True:
            data = await websocket.receive_json()

            if "type" not in data:
                print("Invalid message received!")
                continue

            match data["type"]:
                case "stroke":
                    await manager.broadcast(room_id, data)
                case "guess":
                    guess = data["text"]

                    if room.check_guess(guess):
                        # Broadcast that this player has solved the round
                        for p in room.players:
                            if p.name == username:
                                p.solved = True
                                p.score += 1
                                break

                        found_message = { "type": "solved", "player": username }
                        await manager.broadcast(room_id, found_message)
    except WebSocketDisconnect:
        manager.disconnect(room_id, username, websocket)
        await manager.broadcast(room_id, {"type": "player_left", "player": username })
