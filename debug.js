export function renderDebugInfo(context, level, levelHeight, player, debug) {
  const numDebugInfo = 7
  const rowHeight = 16
  const width = 320;
  const height = rowHeight * numDebugInfo + 10;
  const x = level.x + 50;
  let y = level.y + levelHeight - height;
  context.fillStyle = "white";
  context.fillRect(x, y, width, height);
  context.fillStyle = "black";
  context.font = "16px Times";


  y += 10
  context.fillText(`tileDescentSpeed: ${debug.tileDescentSpeed}`, x, y);
  y += rowHeight
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
}
