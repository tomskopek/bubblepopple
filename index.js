import { getRandomLetter } from "./letters.js";
import { degToRad, radToDeg } from "./angles.js";
import { updateFps, renderFps } from "./fps.js";
import { renderDebugInfo } from "./debug.js";
import { buildDict, findSuccinctWord } from "./dictionary/dictionary.js";

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
    animateCollisionCheck: 1.0,
    waitingForCollisionCheck: 1.1,
    falling: 2,
    removing: 3,
    lose: 4,
    win: 5,
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

  const leftBound = 172;
  const rightBound = 8;

  var neighborOffsets = [
    [
      [0, 1], // right
      [0, -1], // left
      [1, 0], // down
      [-1, 0], // up
      [1, 1], // southeast
      [-1, 1], // northeast
    ], // odd row tiles
    [
      [0, 1], // right
      [0, -1], // left
      [1, 0], // down
      [-1, 0], // up
      [1, -1], // southwest
      [-1, -1], // northwest
    ],
  ]; // even row tiles

  const level = {
    x: 0, // x posn
    y: 0, // y posn
    width: 0, // width - gets calculated
    height: 0, // height - gets calculated
    columns: 7, // number of columns
    // rows: 10, // number of possible rows in the level - TODO: not used currently, but do we want this to control the height of the level?
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
      this.val = val;
      this.i = i;
      this.j = j;
      this.x = x; // Not really used?
      this.y = y; // Not really used?
      this.centerX = x + level.tileWidth / 2;
      this.centerY = y + level.tileHeight / 2;
      this.shift = 0; // Shift the tile when removing
      this.velocity = 0; // Velocity when removing
      this.state = "idle";
    }

    target() {
      this.state = "target";
    }

    untarget() {
      // find index of word in player.word, starting from end, and remove it
      const idx = player.word.lastIndexOf(this);
      player.word.splice(idx, 1);
      this.state = "idle";
    }

    isAvailable() {
      return level.availableTiles.includes(this) && this.state != "target";
    }

    get shouldRemove() {
      return this.state == "remove";
    }
  }

  function init() {
    buildDict();
    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mousedown", onMouseDown);
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

    newRound();

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

  function newRound() {
    player.angle = leftBound - 1;
    gameState = gameStates.animateCollisionCheck;
  }

  function update(tframe) {
    const dt = (tframe - lastFrame) / 1000;
    lastFrame = tframe;

    updateFps(dt);

    if (gameState == gameStates.idle) {
      checkWin();
      checkLose();
      clearEmptyRow();
      // Ready for player input
    } else if (gameState == gameStates.animateCollisionCheck) {
      // animateAim(dt); // TODO: Refine this and bring it back. at the moment it's just worse than nothing
      gameState = gameStates.waitingForCollisionCheck;
    } else if (gameState == gameStates.waitingForCollisionCheck) {
      player.angle = 90;
      findCollisions();
      gameState = gameStates.idle;
    } else if (gameState == gameStates.removing) {
      stateRemoveTiles(dt);
    } else if (gameState == gameStates.lose) {
      console.log("You lose!");
    } else if (gameState == gameStates.win) {
      console.log("You win!");
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

  function getNeighbors(i, j) {
    const res = [];
    for (const [x, y] of neighborOffsets[(i + rowOffset) % 2]) {
      if (
        i + x < 0 ||
        i + x >= level.tiles.length ||
        j + y < 0 ||
        j + y >= level.columns
      )
        continue;
      const neighbor = level.tiles[i + x][j + y];
      if (neighbor) {
        res.push(neighbor);
      }
    }
    return res;
  }

  function removeFloatingTiles() {
    for (let i = level.tiles.length - 1; i >= 0; i--) {
      for (let j = 0; j < level.columns; j++) {
        const tile = level.tiles[i][j];
        if (tile) {
          const neighbors = getNeighbors(i, j);
          let isFloating = true;
          for (const neighbor of neighbors) {
            if (neighbor && !neighbor.shouldRemove) {
              isFloating = false;
              break;
            }
          }
          if (isFloating) {
            removeTile(i, j);
          }
        }
      }
    }
  }

  function removeTiles() {
    gameState = gameStates.removing;
  }

  // TODO: Remove this tmp helper
  window.foo = () =>
    removeTile(Math.floor(Math.random() * 3), Math.floor(Math.random() * 7));

  function addRow() {
    // remove any falling tiles
    for (let i = level.tiles.length - 1; i >= 0; i--) {
      for (let j = 0; j < level.columns; j++) {
        const tile = level.tiles[i][j];
        if (tile && tile.state == "remove") {
          level.tiles[i][j] = null;
        }
      }
    }

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
    newRound();
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
      newRound();
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
    for (let i = 0; i < level.tiles.length; i++) {
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

  function clearEmptyRow() {
    for (let i = level.tiles.length - 1; i >= 0; i--) {
      if (level.tiles[i].every((tile) => !tile)) {
        level.tiles.splice(i, 1);
      } else {
        break;
      }
    }
  }

  function checkLose() {
    const lastRowIdx = level.tiles.length - 1;
    for (let j = 0; j < level.columns; j++) {
      if (level.tiles[lastRowIdx][j]) {
        const { y } = getTileCoordinate(lastRowIdx, j);
        if (y + level.tileHeight > player.centerY - level.tileHeight / 2) {
          gameState = gameStates.lose;
        }
      }
    }
  }

  function checkWin() {
    for (let i = level.tiles.length - 1; i >= 0; i--) {
      for (let j = 0; j < level.columns; j++) {
        if (level.tiles[i][j]) {
          return false;
        }
      }
    }
    gameState = gameStates.win;
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
      const word = player.word
        .map((t) => t.val)
        .join("")
        .toLowerCase();
      const isWord = findSuccinctWord(word);
      if (isWord) {
        for (const tile of player.word) {
          removeTile(tile.i, tile.j);
        }
        removeFloatingTiles();
        removeTiles();
        player.word = [];
      } else {
        // TODO: animate deny word briefly
        resetWord();
      }
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

  function animateAim(dt) {
    player.angle -= dt * 400;
    if (player.angle < rightBound) {
      gameState = gameStates.waitingForCollisionCheck;
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

    if (mouseAngle < 270 && mouseAngle > leftBound) {
      mouseAngle = leftBound;
    } else if (mouseAngle > 270 || mouseAngle < rightBound) {
      mouseAngle = rightBound;
    }

    player.angle = mouseAngle;
  }

  function onMouseDown(e) {
    // Get the mouse position
    let pos = getMousePos(canvas, e);

    // Get the tile underneath the mouse
    let tile = getTileUnderneathMouse(pos.x, pos.y);

    // If the tile is available, target it
    if (tile) {
      if (tile.isAvailable()) {
        tile.target();
        player.word.push(tile);
      } else if (tile.state == "target") {
        tile.untarget();
      }
    }
  }

  function getTileUnderneathMouse(x, y) {
    for (let i = level.tiles.length - 1; i >= 0; i--) {
      for (let j = 0; j < level.columns; j++) {
        const tile = level.tiles[i][j];
        if (tile) {
          const { x: tileX, y: tileY } = getTileCoordinate(i, j);
          if (
            x > tileX &&
            x < tileX + level.tileWidth &&
            y > tileY &&
            y < tileY + level.tileHeight
          ) {
            return tile;
            break;
          }
        }
      }
    }
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
    context.strokeStyle = "#000";
    context.setLineDash([0, 0]);
    context.beginPath();
    context.moveTo(centerX, centerY);
    context.lineTo(
      centerX + 1 * level.tileWidth * Math.cos(degToRad(player.angle)),
      centerY - 1 * level.tileHeight * Math.sin(degToRad(player.angle))
    );
    context.stroke();

    // Draw dashed line representing bullet path
    context.setLineDash([5, 15]);
    context.strokeStyle = colors.blue2;
    context.beginPath();
    context.moveTo(
      centerX + 1.2 * level.tileWidth * Math.cos(degToRad(player.angle)),
      centerY - 1.2 * level.tileHeight * Math.sin(degToRad(player.angle))
    );
    context.lineTo(
      centerX + 4 * level.tileWidth * Math.cos(degToRad(player.angle)),
      centerY - 4 * level.tileHeight * Math.sin(degToRad(player.angle))
    );
    context.stroke();
  }

  init();

  console.log("level.tiles");
  console.log(level.tiles);
};
