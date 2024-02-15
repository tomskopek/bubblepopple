export function renderDebugInfo(context, player) {
  context.fillStyle = "white";
  context.fillRect(400, 100, 500, 100);
  context.fillStyle = "black";
  context.font = "18px Times";
  context.fillText(`Angle: ${Math.round(player.angle)}`, 400, 100);
  context.fillText(`Word: ${player.word.map((t) => t.val).join("")}`, 400, 120);
}
