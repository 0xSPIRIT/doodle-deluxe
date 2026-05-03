from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from dataclasses import dataclass, field
import threading
from typing import Optional

import random

app = FastAPI()

# all lowercase
WORD_POOL = [
    # Animals
    "cat", "dog", "elephant", "giraffe", "penguin", "shark", "butterfly", "crocodile",

    # Food
    "pizza", "sushi", "hamburger", "taco", "ice cream", "pancake", "watermelon", "pretzel",

    # Objects
    "umbrella", "telescope", "backpack", "scissors", "lightbulb", "compass", "hourglass",

    # Places
    "volcano", "lighthouse", "pyramid", "igloo", "castle", "treehouse", "skyscraper",

    # Actions
    "swimming", "juggling", "surfing", "skydiving", "sleeping", "dancing", "fishing",

    # Misc
    "rainbow", "tornado", "thunderstorm", "spaceship", "treasure", "ghost", "robot", "ninja",
]

def pick_random_word() -> str:
    return random.choice(WORD_POOL)

# TODO: In prod, change this to my server address
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"]
)

@dataclass
class Player:
    name: str
    score: int = 0
    solved: bool = False  # Reset after each round
    ready_for_round: bool = False

@dataclass
class Room:
    id: int
    current_drawing: int = -1  # Index of player currently needing to draw
    answer: str = ""      # Current answer
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
        # Convert to lowercase and remove all spaces -- "thunder storm" => "thunderstorm"
        guess = guess.lower().replace(" ", "")

        if self.answer == "":
            return False

        return self.answer.lower() == guess

    def get_player(self, name: str) -> Player:
        for p in self.players:
            if p.name == name:
                return p

        return None

    def get_current_player_name(self) -> str:
        return self.players[self.current_drawing].name

    def end_round(self):
        # Reset all the flags
        for p in self.players:
            p.solved = False
            p.ready_for_round = False

    def begin_round(self):
        self.answer = pick_random_word()
        self.current_drawing = (self.current_drawing + 1) % len(self.players)

rooms = []

def get_room_by_id(room_id: int) -> Room:
    return next((r for r in rooms if r.id == room_id), None)

r = Room(id=100)
rooms.append(r)

# TODO: Move all the websocket logic into the ConnectionManager
# Holds a dictionary of lists of websocket connections; key=room_id
class ConnectionManager:
    def __init__(self):
        self.connections: dict[int, dict[str, list[WebSocket]]] = {}

    async def connect(self, room_id: int, username: str, ws: WebSocket):
        if room_id not in self.connections:
            self.connections[room_id] = {}
    
        self.connections[room_id][username] = ws

    async def end_round(self, ws: WebSocket, room_id: int, time_expired: bool):
        room = get_room_by_id(room_id)
        room.end_round()
        complete_message = { "type": "round_complete", "time_expired": time_expired }
        await manager.broadcast(room_id, complete_message)

    def disconnect(self, room_id: int, username: str, ws: WebSocket):
        # Remove from connections list
        if room_id in self.connections:
            self.connections[room_id].pop(username, None)

    async def broadcast(self, room_id: int, msg: dict):
        for ws in self.connections[room_id].values():
            await ws.send_json(msg)

    async def send_to_user(self, room_id: int, username: str, msg: dict):
        ws = self.connections[room_id].get(username)

        if ws:
            print(f"Found {username}, sending message {msg}")
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
    await websocket.accept()

    room = get_room_by_id(room_id)

    if room is None:
        await websocket.close(code=1008, reason="Room not found")
        return

    if room.has_player(username):
        await websocket.close(code=1008, reason="Username already taken")
        return

    await manager.connect(room_id, username, websocket)
    room.add_player(username)
    await manager.broadcast(room_id, {"type": "player_joined", "player": username})

    try:
        while True:
            data = await websocket.receive_json()

            if "type" not in data:
                print("Invalid message received!")
                continue

            match data["type"]:
                case "timer_expired":
                    await manager.end_round(websocket, room_id, True)
                case "ready":
                    msg = { "type": "ready", "player": username }
                    await manager.broadcast(room_id, msg)

                    room.get_player(username).ready_for_round = True

                    if len(room.players) < 2:
                        msg = { "type": "error", "error": "A room must contain at least 2 players" }
                        await websocket.send_json(msg)
                    else:
                        all_ready = True
                        for p in room.players:
                            if not p.ready_for_round:
                                all_ready = False
    
                        if all_ready:
                            room.begin_round()
                            # Broadcast that the round has begun
                            player_drawing = room.get_current_player_name()
                            message = { "type": "round_begin", "player_drawing": player_drawing, "answer": room.answer }
                            await manager.broadcast(room_id, message)
                case "canvas_sync":
                    await manager.send_to_user(room_id, data["player_to"], data)
                case "stroke":
                    await manager.broadcast(room_id, data)
                case "guess":
                    guess = data["text"]

                    if room.check_guess(guess):
                        score = 0

                        # Broadcast that this player has solved the round
                        for p in room.players:
                            if p.name == username:
                                p.solved = True
                                p.score += 1
                                score = p.score
                                break

                        found_message = { "type": "solved", "player": username, "score": score }
                        await manager.broadcast(room_id, found_message)
                    else:
                        await manager.broadcast(room_id, data)

                    # Check if all players have solved
                    all_solved = True
                    drawer = room.get_current_player_name()

                    for p in room.players:
                        if p.name != drawer and not p.solved:
                            all_solved = False

                    if all_solved:
                        await manager.end_round(websocket, room_id, False)
                        # Now we wait for all the clients to say ready again
    except WebSocketDisconnect:
        manager.disconnect(room_id, username, websocket)
        room.remove_player(username)
        await manager.broadcast(room_id, {"type": "player_left", "player": username })
