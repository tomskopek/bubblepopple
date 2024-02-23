export function renderDebugInfo(context, level, player) {
  const width = 120;
  const x = level.x + level.width - width;
  const y = level.y + level.height - 70;
  context.fillStyle = "white";
  context.fillRect(x, y, width, 100);
  context.fillStyle = "black";
  context.font = "16px Times";
  context.fillText(`x: ${Math.round(player.x)}, y: ${Math.round(player.y)}`, x, y + 10);
  context.fillText(`Angle: ${Math.round(player.angle)}`, x, y + 30);
  context.fillText(
    `Word: ${player.word.map((t) => t.val).join("")}`,
    x,
    y + 50,
  );
}
