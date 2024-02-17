let fpsTime = 0;
let frameCount = 0;
let fps = 0;

export function updateFps(dt) {
  if (fpsTime > 0.25) {
    fps = Math.round(frameCount / fpsTime);
    fpsTime = 0;
    frameCount = 0;
  }
  fpsTime += dt;
  frameCount++;
}

export function renderFps(context, level) {
  const width = 120;
  const x = level.x + level.width - width;
  const y = level.y + level.height - 100;
  context.fillStyle = "white";
  context.fillRect(x, y, width, 100);
  context.fillStyle = "black";
  context.font = "18px Times";
  context.fillText(`FPS: ${fps}`, x, y + 15);
}
