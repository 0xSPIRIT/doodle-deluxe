const joinButton = document.getElementById("join");

let players = [];

let username = null;
let room = null;
let guessedCorrectly = false;
let player_drawing = "";

// TODO: Replace this redundancy with players[you].ready_for_round
let ready = false;
let playing = false;
let answer = ""; // What to draw

let solved = false;

const chat_input = document.getElementById("chat-input");
const chat_send = document.getElementById("chat-send");

const ready_button = document.getElementById("ready");

const status_elem = document.getElementById("status");

const timerElem = document.getElementById("timer");

const MAX_TIME = 60;

let timeLeft = MAX_TIME;
let timerInterval = null;

function setPlaying(p) {
  playing = p;
  ready_button.disabled = p;
}

function setStatus(stat) {
  status_elem.textContent = stat;
}

function displayAnswer() {
  setStatus("The answer was " + answer + "!");
}

function setPlayerDrawing(new_player_drawing) {
  player_drawing = new_player_drawing;

  let content = "";

  if (player_drawing === "") {
    content = "Waiting for the game to begin...";
  } else if (player_drawing === username) {
    content = "You are drawing";
  } else {
    content = player_drawing + " is drawing";
  }

  setStatus(content);
}

let inRoom = false;

let ws = null; // websocket

let receivedSync = false;

function startTimer(seconds) {
  timeLeft = seconds;
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    timeLeft--;
    timerElem.textContent = `${timeLeft}s`;

    if (timeLeft <= 0) {
      timeLeft = 0;
      clearInterval(timerInterval);
      const msg = { type: "timer_expired" };
      ws.send(JSON.stringify(msg));
    }
  }, 1000);
}

function stopTimer() {
  timeLeft = 0;
  timerElem.innerHTML = "";
  clearInterval(timerInterval);
}

ready_button.addEventListener("click", () => {
  if (inRoom && !ready) {
    imReady();
  }
});

function pushMessage(text, color = null) {
  const messages = document.getElementById("chat-messages");
  const line = document.createElement("p");
  line.style.margin = "4px 0";
  line.style.color = color ?? "var(--text)";
  line.textContent = text;
  messages.appendChild(line);
  messages.scrollTop = messages.scrollHeight;
}

function chatSend() {
  const text = chat_input.value.trim();

  if (!text)
    return;

  pushMessage(`${username}: ${text}`);
  ws.send(JSON.stringify({ type: "guess", text: text, player: username }));
  chat_input.value = "";
}

function imReady() {
  if (!inRoom || !ws || ready)
    return;

  message = { type: "ready" };

  ready = true;

  ws.send(JSON.stringify(message));
}

chat_send.addEventListener("click", () => chatSend());
chat_input.addEventListener("keydown", e => {
  if (e.key === "Enter") chatSend();
});


function joinRoom() {
  ws = new WebSocket(`http://127.0.0.1:8000/ws/${room}?username=${username}`);

  inRoom = true;

  let pingInterval = null;

  ws.addEventListener("open", () => {
    console.log("CONNECTED");

    pingInterval = setInterval(() => {
      console.log("SENT: ping");
      ws.send(JSON.stringify({"type": "ping"}));
    }, 1000);

    fetch(`http://127.0.0.1:8000/game/${room}/players`)
      .then(response => response.json())
      .then(data => {
        if (ws.readyState == WebSocket.OPEN) {
          players = data;
          renderUI();
        }
      });
  });

  ws.addEventListener("message", e => {
    try {
      const data = JSON.parse(e.data);

      receiveMessage(data);
    } catch (error) {
      console.error("Error parsing JSON: ", error);
    }
  });

  ws.addEventListener("close", e => {
    inRoom = false;
    console.log("DISCONNECT -- Reason: ", e.reason);
    if (e.reason) {
      setStatus(e.reason);
    }
    clearInterval(pingInterval);
    players = [];
    setPlaying(false);
    renderUI();
  });
}

joinButton.addEventListener("click", e => {
  username = document.getElementById("username").value;
  room = document.getElementById("room").value;

  console.log("username: " + username);
  console.log("room: " + room);

  if (!username || !room) {
    console.log("You must set room / username before joining a room!");
    return;
  }

  joinRoom(username, room);
  setPlayerDrawing("");
});

const canvas = document.getElementById("canvas");

const width = canvas.width;
const height = canvas.height;

let mouseDown = false;
let px = 0, py = 0;

const ctx = canvas.getContext("2d");

// Set line width
ctx.lineWidth = 10;
ctx.lineJoin = "round";

canvas.addEventListener("mousedown", (event) => {
  px = event.offsetX;
  py = event.offsetY;
  mouseDown = true;
  doStroke(event);
});

const stopMouse = (event) => { mouseDown = false; };

let count = 0;

canvas.addEventListener("mouseup", stopMouse);
canvas.addEventListener("mouseleave", stopMouse);

function drawPoint(x, y) {
  ctx.arc(x0, y1, ctx.lineWidth / 5, 0, Math.PI * 2);
  ctx.fillStyle = ctx.strokeStyle;
  ctx.fill();
}

// TODO: Fix
function drawStroke(x0, y0, x1, y1) {
  ctx.beginPath();

  if (x0 == x1 && y0 == y1) {
    drawPoint(x0, y0);
  } else {
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.closePath();
    ctx.stroke();
  }
}

function renderUI() {
  const list = document.getElementById("players-list");

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

  const answer_elem = document.getElementById("answer");
  answer_elem.textContent = (playing && answer && username === player_drawing) ? "Draw: " + answer : "";
}

function receiveMessage(data) {
  switch (data.type) {
    case "error":
      console.log("Got error ", data.error);
      setStatus(data.error);
      break;
    case "player_joined":
      console.log("Player joined:", data.player);

      if (data.player !== username) {
        players.push({name: data.player, score: 0, ready_for_round: false, solved: false});
        renderUI();

        // Send current canvas state to the new player
        const data_b64 = canvas.toDataURL("image/png");
        const message = {
          "type": "canvas_sync",
          "data": data_b64,
          "player_from": username,
          "player_to": data.player,
        };

        ws.send(JSON.stringify(message));
      }

      break;
    case "player_left":
      console.log("Player left:", data.player);

      if (data.player !== username) {
        players = players.filter(p => p.name !== data.player);
        renderUI();
      }

      break;
    case "ready":
      player = data.player;

      for (let i = 0; i < players.length; i++) {
        if (players[i].name === player) {
          players[i].ready_for_round = true;
        }
      }

      renderUI();
      break;
    case "round_begin":
      pushMessage("Begin round!", "#3eb85f");

      startTimer(MAX_TIME);

      setPlayerDrawing(data.player_drawing);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Answer is stored for everyone, including non-drawing players,
      // so we can display it if we win
      answer = data.answer;

      if (player_drawing === username) {
        chat_input.disabled = chat_send.disabled = true;
        pushMessage("You are drawing!");
      } else {
        chat_input.disabled = chat_send.disabled = false;
        pushMessage(data.player_drawing + " is drawing!");
      }

      setPlaying(true);

      renderUI();
      break;
    case "stroke":
      if (data.player === username)
        break;

      drawStroke(data.px, data.py, data.x, data.y);
      break;
    case "round_complete":
      const wasDrawing = player_drawing === username;
      ready = false;
      setPlaying(false);
      setPlayerDrawing("");
      stopTimer();

      const messageColor = (solved || wasDrawing) ? "#3eb85f" : "var(--accent2)";

      displayAnswer();

      for (let i = 0; i < players.length; i++) {
        players[i].ready_for_round = false;
        players[i].solved = false;
      }
      solved = false;

      renderUI();

      pushMessage("Round complete!", messageColor);
      pushMessage("Press \"I\'m ready\" to proceed!", "var(--accent2)");

      chat_input.disabled = chat_send.disabled = false;
      break;
    case "guess":
      if (data.player !== username) {
        pushMessage(`${data.player}: ${data.text}`);
      }
      break;
    case "solved":
      for (let i = 0; i < players.length; i++) {
        if (players[i].name == data.player) {
          players[i].score = data.score;
          players[i].solved = true;
        }
      }

      renderUI();

      player = "You";

      if (data.player !== username) {
        player = data.player;
        displayAnswer();
      } else {
        chat_input.disabled = chat_send.disabled = true;
        solved = true;
      }

      console.log("S:", solved);

      pushMessage(`${player} guessed correctly!`, "#3eb85f");
      break;
    case "canvas_sync": // Receive the canvas sync
      if (receivedSync)
        break;

      receivedSync = true;
      const img = new Image();
      img.src = data.data;
      img.onload = () => ctx.drawImage(img, 0, 0);
      break;
    case "guess":
      break;
  }
}

function doStroke(mouseEvent) {
  const x = event.offsetX;
  const y = event.offsetY;

  if (x < 0 || y < 0 || x >= width || y >= height)
    return;

  const stroke_message = {
    "type": "stroke",
    "player": username,
    "px": px,
    "py": py,
    "x": x,
    "y": y
  };

  // This sends the stroke to the server, which will then broadcast
  // to all other players.
  ws.send(JSON.stringify(stroke_message));

  console.log(`Draw stroke: ${px} ${py} ${x} ${y}`);
  drawStroke(px, py, x, y);

  count++;
  //console.log(count);

  px = x;
  py = y;
}

canvas.addEventListener("mousemove", (event) => {
  if (!inRoom)
    return;

  if (player_drawing !== username)
    return;

  if (mouseDown) {
    doStroke(event);
  }
});
