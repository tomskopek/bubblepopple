export function renderDebugInfo(context, level, player, debug) {
  const numDebugInfo = 8
  const rowHeight = 16
  const width = 320;
  const height = rowHeight * numDebugInfo + 10;
  const x = level.x + 50;
  let y = level.y + level.height - height;
  context.fillStyle = "white";
  context.fillRect(x, y, width, height);
  context.fillStyle = "black";
  context.font = "16px Times";

  y += 10
  context.fillText(`x: ${Math.round(player.x)}, y: ${Math.round(player.y)}`, x, y);
  y += rowHeight
  context.fillText(`Angle: ${Math.round(player.angle)}`, x, y);
  y += rowHeight
  context.fillText(`Word: ${player.word.map((t) => t.val).join("")}`, x, y);
  y += rowHeight
  context.fillText(`windowInnerWidth: ${debug.windowInnerWidth}`, x, y);
  y += rowHeight
  context.fillText(`canvasWidth: ${debug.canvasWidth}`, x, y);
  y += rowHeight
  context.fillText(`canvasHeight: ${debug.canvasHeight}`, x, y);
  y += rowHeight
  context.fillText(`keyboardRowWidth: ${debug.keyboardRowWidth}`, x, y);
  y += rowHeight
  context.fillText(`keyboardKeyWidth: ${debug.keyboardKeyWidth}`, x, y);
}
