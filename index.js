import { getRandomLetter } from "./letters.js";
import { degToRad } from "./angles.js";
import { updateFps, renderFps } from "./fps.js";

window.onload = function () {
  const canvas = document.getElementById("viewport");
  const context = canvas.getContext("2d");

  let lastFrame = 0;

  let initialized = false;

  let animationState = 0;
  let animationTime = 0;

  const gameStates = {
    idle: 0,
    falling: 1,
    removing: 2,
  };
  let gameState = gameStates.idle;

  // Options
  const SHOW_FPS = true;

  const TILE_SIZE = 50;
  const FONT_SIZE = 24;
  const DROP_SPEED = 1000;

  const FLOOR_HEIGHT = 5;

  const level = {
    x: 0, // x posn
    y: 0, // y posn
    width: 0, // width - gets calculated
    height: 0, // height - gets calculated
    columns: 7, // number of columns
    rows: 10, // number of possible rows in the level
    startingRows: 3, // number of rows to start with
    tileWidth: TILE_SIZE, // width of each tile
    tileHeight: TILE_SIZE, // height of each tile
    rowHeight: TILE_SIZE * Math.cos(degToRad(30)), // height of each row
    radius: TILE_SIZE / 2, // radius of the circle
    tiles: [], // 2d array to hold the tiles
  };

  class Tile {
    fontSize = FONT_SIZE;

    constructor(x, y, val) {
      this.x = x; // Not really used?
      this.y = y; // Not really used?
      this.val = val;
      this.shift = 0; // Shift the tile when removing
      this.velocity = 0; // Velocity when removing
      this.state = "idle";
    }

    remove() {
      console.log(`remove: ${this.val}`);
      this.shift = 1;
      this.velocity = DROP_SPEED;
      this.state = "remove";
    }

    get shouldRemove() {
      return this.state == "remove";
    }
  }

  function init() {
    level.width = level.columns * level.tileWidth + level.tileWidth / 2;
    level.height = canvas.height;

    // Initialize the 2d array of tiles
    for (let i = 0; i < level.startingRows; i++) {
      level.tiles[i] = [];
      for (let j = 0; j < level.columns; j++) {
        const val = getRandomLetter();
        level.tiles[i][j] = new Tile(
          j * level.tileWidth,
          i * level.rowHeight,
          val
        );
      }
    }

    main(0);
  }

  // Main game loop
  function main(tframe) {
    window.requestAnimationFrame(main);
    // TODO: get rid of these. tmp for debugging
    window.level = level;
    window.tiles = level.tiles;
    update(tframe);
    render();
  }

  function update(tframe) {
    const dt = (tframe - lastFrame) / 1000;
    lastFrame = tframe;

    updateFps(dt);

    if (gameState == gameStates.idle) {
      // Ready for player input
    } else if (gameState == gameStates.removing) {
      // Remove tiles and drop tiles
      stateRemoveTiles(dt);
    }
  }

  // Render the game
  function render() {
    renderFrame();
    renderTiles();
    if (SHOW_FPS) {
      renderFps(context);
    }
  }

  function getTileCoordinate(row, col) {
    let x = col * level.tileWidth;
    // If the row is even, the x position is shifted over
    if (row % 2 === 0) {
      x += level.tileWidth / 2;
    }
    const y = row * level.rowHeight;
    return { x, y };
  }

  function drawCenterText(text, fontSize, x, y) {
    const textWidth = context.measureText(text).width;
    const textHeight = fontSize;
    const centerX = x - textWidth / 2;
    const centerY = y + textHeight / 4; // 4 is somewhat arbitrary but works well
    context.fillText(text, centerX, centerY);
  }

  function removeTile(row, col) {
    const tile = level.tiles[row][col];
    tile.remove();
    removeTiles();
  }

  function removeTiles() {
    gameState = gameStates.removing;
  }

  // TODO: Remove this tmp helper
  window.foo = () =>
    removeTile(Math.floor(Math.random() * 3), Math.floor(Math.random() * 7));

  function stateRemoveTiles(dt) {
    // Remove tiles and drop tiles
    for (let i = level.tiles.length - 1; i >= 0; i--) {
      for (let j = 0; j < level.columns; j++) {
        const tile = level.tiles[i][j];
        if (tile && tile.shouldRemove) {
          tile.velocity += 1000 * dt;
          tile.shift += tile.velocity * dt;
          const tileY = getTileCoordinate(i, j).y + tile.shift;

          if (tileY > level.height - TILE_SIZE) {
            // Remove the tile when it's below the floor
            level.tiles[i][j] = null;
          }
        }
      }
    }
    render();
  }

  function renderFrame() {
    const gradient = context.createLinearGradient(
      0,
      0,
      level.width,
      level.height
    );
    gradient.addColorStop(0, "#fdfbfb"); // Light shade of gray
    gradient.addColorStop(1, "#ebedee"); // Slightly darker shade of gray
    context.fillStyle = gradient;
    context.fillRect(level.x, level.y, level.width, level.height);

    // Draw Floor
    context.fillStyle = "#000";
    context.fillRect(
      level.x,
      level.height - FLOOR_HEIGHT,
      level.width,
      level.height
    );
  }

  function renderTiles() {
    // Top to bottom
    for (let i = 0; i < level.rows; i++) {
      for (let j = 0; j < level.columns; j++) {
        const row = level.tiles[i];
        if (!row) continue;
        const tile = level.tiles[i][j];
        if (tile) {
          const shift = tile.shift || 0;
          let { x: tileX, y: tileY } = getTileCoordinate(i, j);
          tileY += shift;
          //   if (tile.state == "remove") {
          //     console.log(tileY);
          //   }
          // Draw the tile
          context.fillStyle = "#ddd";
          context.beginPath();
          context.arc(
            tileX + level.radius,
            tileY + level.radius,
            level.radius,
            0,
            Math.PI * 2,
            false
          );
          context.fill();
          context.font = `${tile.fontSize}px Times`;
          context.fillStyle = "#000";
          drawCenterText(
            tile.val,
            tile.fontSize,
            tileX + level.radius,
            tileY + level.radius
          );
        }
      }
    }
  }

  init();

  console.log("level.tiles");
  console.log(level.tiles);
};
