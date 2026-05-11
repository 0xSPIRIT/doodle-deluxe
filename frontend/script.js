import { Game } from "./game.js";
import { readyButton } from "./ui.js";

const game = new Game();

game.clickJoinButton = () => {
  const username = document.getElementById("username").value;
  const room = document.getElementById("room").value;

  console.log("username: " + username);
  console.log("room: " + room);

  if (!username || !room) {
    console.log("You must set room / username before joining a room!");
    return;
  }

  game.joinRoom(room, username);
}

readyButton.addEventListener("click", () => {
  game.ready();
});
