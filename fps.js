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

export function renderFps(context) {
  context.fillStyle = "white";
  context.fillRect(400, 0, 100, 100);
  context.fillStyle = "black";
  context.font = "18px Times";
  context.fillText(`FPS: ${fps}`, 400, 50);
}
