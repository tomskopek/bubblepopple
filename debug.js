export function renderDebugInfo(context, level, player) {
  const width = 120;
  const x = level.x + level.width - width;
  const y = level.y + level.height - 50;
  context.fillStyle = "white";
  context.fillRect(x, y, width, 100);
  context.fillStyle = "black";
  context.font = "18px Times";
  context.fillText(`Angle: ${Math.round(player.angle)}`, x, y + 15);
  context.fillText(
    `Word: ${player.word.map((t) => t.val).join("")}`,
    x,
    y + 35
  );
}
