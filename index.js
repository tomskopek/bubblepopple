import { getRandomLetter } from "./letters.js";
import { degToRad, radToDeg } from "./angles.js";
import { updateFps, renderFps } from "./fps.js";
import { renderDebugInfo } from "./debug.js";

const colors = {
  beige1: "#eee1c4",
  beige2: "#e6d9bd",
  beige3: "#dbcfb1",
  beige4: "#d6c7a3",
  beige5: "#c3b797",
  beige6: "#ada387",
  brown1: "#cc9970",
  brown2: "#a97e5c",
  brown3: "#937b6a",
  gray1: "#a0a0a0",
  gray2: "#838383",
  blue1: "#9eb5c0",
  blue2: "#839ca9",
  blue3: "#6d838e",
  red1: "#c87e7e",
  red2: "#a05e5e",
  purple1: "#b089ab",
  purple2: "#8e6d89",
  yellow1: "#b9ab73",
  yellow2: "#978c63",
  green1: "#87a985",
  green2: "#6f8b6e",
};

window.onload = function () {
  const canvas = document.getElementById("viewport");
  const context = canvas.getContext("2d");

  let lastFrame = 0;

  let initialized = false;

  let animationState = 0;
  let animationTime = 0;

  const gameStates = {
    idle: 0,
    waitingForCollisionCheck: 1,
    falling: 2,
    removing: 3,
  };
  let gameState = gameStates.idle;

  let rowOffset = 0;

  // Options
  const SHOW_FPS = true;

  const TILE_SIZE = 50;
  const FONT_SIZE = 24;
  const DROP_SPEED = 1000;

  const FLOOR_HEIGHT = 5;
  const TURRET_HEIGHT = 36;

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
    availableTiles: [], // tiles that are available to be removed
  };

  const player = {
    centerX: 0, // gets calculated
    centerY: 0, // gets calculated
    angle: 0,
    word: [],
  };

  class Tile {
    fontSize = FONT_SIZE;

    constructor(i, j, x, y, val) {
      this.i = i;
      this.j = j;
      this.x = x; // Not really used?
      this.y = y; // Not really used?
      this.centerX = x + level.tileWidth / 2;
      this.centerY = y + level.tileHeight / 2;
      this.val = val;
      this.shift = 0; // Shift the tile when removing
      this.velocity = 0; // Velocity when removing
      this.state = "idle";
    }

    target() {
      this.state = "target";
    }

    isAvailable() {
      return this.state != "target";
    }

    get shouldRemove() {
      return this.state == "remove";
    }
  }

  function init() {
    canvas.addEventListener("mousemove", onMouseMove);
    // listen for typing
    document.addEventListener("keydown", onKeyDown);

    level.width = level.columns * level.tileWidth + level.tileWidth / 2;
    level.height = canvas.height;
    player.centerX = level.width / 2;
    player.centerY = level.height - FLOOR_HEIGHT - TURRET_HEIGHT;

    // Initialize the 2d array of tiles
    for (let i = 0; i < level.startingRows; i++) {
      level.tiles[i] = [];
      for (let j = 0; j < level.columns; j++) {
        const val = getRandomLetter();
        const { x, y } = getTileCoordinate(i, j);
        level.tiles[i][j] = new Tile(i, j, x, y, val);
      }
    }

    gameState = gameStates.waitingForCollisionCheck;

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
    } else if (gameState == gameStates.waitingForCollisionCheck) {
      findCollisions();
      gameState = gameState.idle;
    } else if (gameState == gameStates.removing) {
      stateRemoveTiles(dt);
    }
  }

  // Render the game
  function render() {
    renderFrame();
    renderTiles();
    renderPlayer();
    if (SHOW_FPS) {
      renderFps(context);
      renderDebugInfo(context, player);
    }
  }

  function getTileCoordinate(row, col) {
    let x = col * level.tileWidth;
    // If the row is even, the x position is shifted over
    if ((row + rowOffset) % 2 === 0) {
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
    tile.state = "remove";
    tile.shift = 1;
    tile.velocity = DROP_SPEED;
    removeTiles();
  }

  function removeFloatingTiles() {}

  function removeTiles() {
    gameState = gameStates.removing;
  }

  // TODO: Remove this tmp helper
  window.foo = () =>
    removeTile(Math.floor(Math.random() * 3), Math.floor(Math.random() * 7));

  function addRow() {
    rowOffset = rowOffset === 0 ? 1 : 0;
    level.tiles.unshift([]);
    for (let j = 0; j < level.columns; j++) {
      const val = getRandomLetter();
      const { x, y } = getTileCoordinate(0, j);
      level.tiles[0][j] = new Tile(0, j, x, y, val);
    }
    // shift i of all tiles
    for (let i = 1; i < level.tiles.length; i++) {
      for (let j = 0; j < level.columns; j++) {
        const tile = level.tiles[i][j];
        if (tile) {
          tile.i++;
        }
      }
    }
    // Recalculate available tiles
    gameState = gameStates.waitingForCollisionCheck;
  }

  function stateRemoveTiles(dt) {
    let removingTiles = false;
    for (let i = level.tiles.length - 1; i >= 0; i--) {
      for (let j = 0; j < level.columns; j++) {
        const tile = level.tiles[i][j];
        if (tile && tile.shouldRemove) {
          removingTiles = true;
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
    if (!removingTiles) {
      gameState = gameStates.waitingForCollisionCheck;
    }
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
          context.fillStyle = colors.gray1;
          context.beginPath();
          context.arc(
            tileX + level.radius,
            tileY + level.radius,
            level.radius,
            0,
            Math.PI * 2,
            false
          );
          if (
            tile.state == "target" &&
            player.word[player.word.length - 1] == tile
          ) {
            context.fillStyle = colors.green2;
          } else if (tile.state == "target") {
            context.fillStyle = colors.green1;
          } else if (level.availableTiles.includes(tile)) {
            context.fillStyle = colors.beige2;
          }
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
  // Get the mouse position
  function getMousePos(canvas, e) {
    var rect = canvas.getBoundingClientRect();
    return {
      x: Math.round(
        ((e.clientX - rect.left) / (rect.right - rect.left)) * canvas.width
      ),
      y: Math.round(
        ((e.clientY - rect.top) / (rect.bottom - rect.top)) * canvas.height
      ),
    };
  }

  function findCollisions() {
    const availableTiles = {};
    angleLoop: for (let angle = 65; angle < 110; angle += 1) {
      for (let i = level.tiles.length - 1; i >= 0; i--) {
        for (let j = 0; j < level.columns; j++) {
          const tile = level.tiles[i][j];
          if (tile && doesCollide(angle, tile)) {
            availableTiles[`${i},${j}`] = tile;
            continue angleLoop;
          }
        }
      }
    }
    level.availableTiles = Object.values(availableTiles);
  }

  function doesCollide(angle, tile) {
    let centerAngle = 0;
    if (angle < 90) {
      centerAngle = radToDeg(
        Math.atan2(player.centerY - tile.centerY, tile.centerX - player.centerX)
      );
    } else if (angle >= 90 && angle < 180) {
      centerAngle =
        180 -
        radToDeg(
          Math.atan2(
            player.centerY - tile.centerY,
            player.centerX - tile.centerX
          )
        );
    }
    const distance = Math.sqrt(
      Math.pow(player.centerX - tile.centerX, 2) +
        Math.pow(player.centerY - tile.centerY, 2)
    );
    const beta = radToDeg(Math.asin(level.radius / distance));
    const rightBound = centerAngle - beta;
    const leftBound = centerAngle + beta;
    if (angle >= rightBound && angle <= leftBound) {
      return true;
    } else {
      return false;
    }
  }

  function resetWord() {
    for (const tile of player.word) {
      tile.state = "idle";
    }
    player.word = [];
  }

  function onKeyDown(e) {
    const key = e.key.toUpperCase();
    if (key === "BACKSPACE") {
      const lastTile = player.word.slice(-1);
      lastTile[0].state = "idle";
      player.word = player.word.slice(0, -1);
    } else if (key === " ") {
      addRow();
      resetWord();
    } else if (key === "TAB") {
      // TODO: target another tile
    } else if (key === "ENTER") {
      for (const tile of player.word) {
        removeTile(tile.i, tile.j);
      }
      removeFloatingTiles();
      removeTiles();
      player.word = [];
    } else if (key.match(/[A-Z]/)) {
      for (const tile of level.availableTiles) {
        if (tile.val === key && tile.isAvailable()) {
          tile.target();
          player.word.push(tile);
          break;
        }
      }
    }
  }

  function onMouseMove(e) {
    // Get the mouse position
    let pos = getMousePos(canvas, e);

    // Get the mouse angle
    let mouseAngle = radToDeg(
      Math.atan2(player.centerY - pos.y, pos.x - player.centerX)
    );

    // Convert range to 0, 360 degrees
    if (mouseAngle < 0) {
      mouseAngle = 180 + (180 + mouseAngle);
    }

    //         90
    //       ___
    // 180  /   \ 0
    //      \___/
    //       270

    const lBound = 172;
    const rBound = 8;

    if (mouseAngle < 270 && mouseAngle > lBound) {
      mouseAngle = lBound;
    } else if (mouseAngle > 270 || mouseAngle < rBound) {
      mouseAngle = rBound;
    }

    player.angle = mouseAngle;
  }

  function renderPlayer() {
    const TURRET_WIDTH = 60;
    const centerX = level.width / 2;
    const centerY = level.height - TURRET_HEIGHT - FLOOR_HEIGHT;

    // Draw turret
    context.fillStyle = "#000";
    context.beginPath();
    context.fillRect(
      centerX - TURRET_WIDTH / 2,
      centerY,
      TURRET_WIDTH,
      TURRET_HEIGHT
    );
    context.arc(centerX, centerY, 30, 0, Math.PI * 2, false);
    context.fill();

    // Draw cannon
    context.lineWidth = 2;
    context.strokeStyle = "#0000ff";
    context.beginPath();
    context.moveTo(centerX, centerY);
    context.lineTo(
      centerX + 1.5 * level.tileWidth * Math.cos(degToRad(player.angle)),
      centerY - 1.5 * level.tileHeight * Math.sin(degToRad(player.angle))
    );
    context.stroke();
  }

  init();

  console.log("level.tiles");
  console.log(level.tiles);
};
