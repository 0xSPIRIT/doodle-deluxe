const MAX_TIME = 60;

export class Room {
  constructor(roomId, username) {
    this.roomId = roomId;
    this.username = username;
    this.players = [];
    this.playerDrawing = null;
    this.answer = "";
    this.timeLeft = MAX_TIME;
    this.timerInterval = null;
  }

  joinPlayer(player) {
    if (player !== this.username) {
      this.players.push({name: player, score: 0, ready_for_round: false, solved: false});
    }
  }

  leavePlayer(player) {
    this.players = this.players.filter(p => p.name !== player);
  }

  playerSolved(player, newScore) {
    for (let i = 0; i < this.players.length; i++) {
      if (this.players[i].name == player) {
        this.players[i].score = newScore;
        this.players[i].solved = true;
      }
    }
  }

  beginRound({ player_drawing, answer }) {
    this.startTimer(MAX_TIME);
    this.setPlayerDrawing(player_drawing);
    this.answer = answer;
  }

  endRound() {
    this.stopTimer();
    this.setPlayerDrawing("");

    for (let i = 0; i < this.players.length; i++) {
      this.players[i].ready_for_round = false;
      this.players[i].solved = false;
    }
  }

  // TODO: What is the point of this?
  setPlayerDrawing(player) {
    this.playerDrawing = player;
  }

  setPlayerReady(player) {
    for (let i = 0; i < this.players.length; i++) {
      if (this.players[i].name === player) {
        this.players[i].ready_for_round = true;
      }
    }
  }

  startTimer() {
    this.timeLeft = MAX_TIME;
    if (this.timerInterval)
      clearInterval(this.timerInterval);

    this.timerInterval = setInterval(() => {
      this.timeLeft--;
      //timerElem.textContent = `${timeLeft}s`;

      if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        clearInterval(this.timerInterval);
        this.onTimerExpiry();
      }
    }, 1000);
  }

  stopTimer() {
    this.timeLeft = 0;
    clearInterval(this.timerInterval);
  }

  onTimerExpiry() {}
}

