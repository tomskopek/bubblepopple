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
colors.unavailableTile = colors.beige1;
colors.reachableTile = colors.brown1;
colors.reachableUnavailableKeyboard = colors.beige6;

window.onload = function() {
  const canvas = document.getElementById("canvas");
  const context = canvas.getContext("2d");

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight * 0.6;

  let lastFrame = 0;

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
  const SHOW_FPS = false;
  const SHOW_DEBUG_INFO = true;

  const NUM_COLUMNS = 7;
  const TILE_SIZE = Math.min(50, canvas.width / (NUM_COLUMNS + 0.5));
  const LEVEL_WIDTH = TILE_SIZE * (NUM_COLUMNS + 0.5);
  const FONT_SIZE = 24;
  const DROP_SPEED = 1000;

  const FLOOR_HEIGHT = 50;
  const TURRET_HEIGHT = 36;

  const WORD_PREVIEW_BUBBLE_RADIUS = 20;

  const LEFT_BOUND = 172;
  const RIGHT_BOUND = 8;

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
    x: canvas.width / 2 - LEVEL_WIDTH / 2, // x posn
    y: 0, // y posn
    width: LEVEL_WIDTH,
    height: 0, // height - gets calculated
    columns: NUM_COLUMNS, // number of columns
    // rows: 10, // number of possible rows in the level - TODO: not used currently, but do we want this to control the height of the level?
    startingRows: 3, // number of rows to start with
    tileWidth: TILE_SIZE, // width of each tile
    tileHeight: TILE_SIZE, // height of each tile
    rowHeight: TILE_SIZE * Math.cos(degToRad(30)), // height of each row
    radius: TILE_SIZE / 2, // radius of the circle
    tiles: [], // 2d array to hold the tiles
    reachableTiles: [], // tiles that can be reached by the turret
    availableChars: {}, // remaining chars that can be used to form words
    tileInPath: null,
  };

  const player = {
    centerX: 0, // gets calculated
    centerY: 0, // gets calculated
    mouseX: 0, // gets calculated
    mouseY: 0, // gets calculated
    angle: 0, // gets calculated
    word: [],
  };

  class Tile {
    fontSize = FONT_SIZE;

    constructor(i, j, val) {
      this.val = val;
      this.i = i;
      this.j = j;
      this.shift = 0; // Shift the tile when removing
      this.velocity = 0; // Velocity when removing
      this.state = "idle";
    }

    get x() {
      const { x } = getTileCoordinate(this.i, this.j);
      return x;
    }

    get y() {
      const { y } = getTileCoordinate(this.i, this.j);
      return y;
    }

    get centerX() {
      const { centerX } = getTileCoordinate(this.i, this.j);
      return centerX;
    }

    get centerY() {
      const { centerY } = getTileCoordinate(this.i, this.j);
      return centerY;
    }

    target() {
      this.state = "target";
      level.availableChars[this.val] -= 1;
      const { centerX, centerY } = getTileCoordinate(this.i, this.j);
      aimTurret(centerX, centerY);
    }

    untarget() {
      // find index of word in player.word, starting from end, and remove it
      const idx = player.word.lastIndexOf(this);
      level.availableChars[this.val] += 1;
      player.word.splice(idx, 1);
      this.state = "idle";

      // aim at last tile in word
      if (player.word.length > 0) {
        const { x, y } = getTileCoordinate(
          player.word[player.word.length - 1].i,
          player.word[player.word.length - 1].j,
        );
        aimTurret(x, y);
      }
    }

    isReachable() {
      return level.reachableTiles.includes(this);
    }

    isAvailable() {
      return this.isReachable() && this.state == "idle";
    }

    get shouldRemove() {
      return this.state == "remove";
    }
  }

  function resetLevel() {
    rowOffset = 0;
    level.tiles = [];
    for (let i = 0; i < level.startingRows; i++) {
      level.tiles[i] = [];
      for (let j = 0; j < level.columns; j++) {
        const val = getRandomLetter();
        const { x, y } = getTileCoordinate(i, j);
        level.tiles[i][j] = new Tile(i, j, val);
      }
    }
    newRound();
    main(0);
  }

  function init() {
    buildDict();
    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mousedown", onMouseDown);
    // listen for typing
    document.addEventListener("keydown", onKeyDown);

    initKeyboard();

    level.height = canvas.height;
    player.centerX = level.x + level.width / 2;
    player.centerY = level.height - FLOOR_HEIGHT - TURRET_HEIGHT;

    resetLevel();
    newRound();
    main(0);
  }

  function initKeyboard() {
    document
      .getElementById("dumpButton")
      .addEventListener("click", function() {
        addRow();
      });

    document.getElementById("backspace").addEventListener("click", function() {
      deleteLastLetter();
    });

    document.getElementById("enter").addEventListener("click", function() {
      submitWord();
    });

    "abcdefghijklmnopqrstuvwxyz".split("").forEach((char) => {
      // add click listener to each letter
      document.getElementById(char).addEventListener("click", function() {
        const tile = findTileByChar(char);
        if (tile) {
          if (tile.isAvailable()) {
            tile.target();
            player.word.push(tile);
          }
        }
      });
    });
  }

  function findTileByChar(char) {
    for (let i = level.tiles.length - 1; i >= 0; i--) {
      for (let j = 0; j < level.columns; j++) {
        const tile = level.tiles[i][j];
        if (tile && tile.val.toLowerCase() === char) {
          return tile;
        }
      }
    }
  }

  // Main game loop
  function main(tframe) {
    if (gameState == gameStates.lose || gameState == gameStates.win) {
      render();
      return;
    }
    window.requestAnimationFrame(main);
    // TODO: get rid of these. tmp for debugging
    window.level = level;
    window.tiles = level.tiles;
    update(tframe);
    render();
  }

  function newRound() {
    // player.angle = LEFT_BOUND - 1;
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
      findReachableTiles();
      findAvailableChars();
      gameState = gameStates.idle;
    } else if (gameState == gameStates.removing) {
      stateRemoveTiles(dt);
    } else if (gameState == gameStates.lose) {
      renderLoseScreen();
    } else if (gameState == gameStates.win) {
      renderWinScreen();
    }
  }

  function renderKeyboard() {
    const allTiles = "abcdefghijklmnopqrstuvwxyz".split("");
    for (const char of allTiles) {
      const tile = findTileByChar(char);
      if (tile && level.availableChars[char.toUpperCase()] > 0) {
        document.getElementById(char).style.backgroundColor = colors.reachableTile;
      } else if (tile && level.reachableTiles.includes(tile)) {
        document.getElementById(char).style.backgroundColor = colors.reachableUnavailableKeyboard;
      } else {
        document.getElementById(char).style.backgroundColor =
          colors.unavailableTile;
      }
    }
  }

  // Render the game
  function render() {
    if (gameState == gameStates.lose) {
      renderLoseScreen();
      return;
    }
    if (gameState == gameStates.win) {
      renderWinScreen();
      return;
    }
    renderFrame();
    renderTiles();
    renderPlayer();
    renderWord();
    renderKeyboard();
    if (SHOW_FPS) renderFps(context, level);
    if (SHOW_DEBUG_INFO) renderDebugInfo(context, level, player);
  }

  function getTileCoordinate(row, col) {
    let x = level.x + col * level.tileWidth;
    // If the row is even, the x position is shifted over
    if ((row + rowOffset) % 2 === 0) {
      x += level.tileWidth / 2;
    }
    const y = row * level.rowHeight;
    const centerX = x + level.tileWidth / 2;
    const centerY = y + level.tileHeight / 2;
    return { x, y, centerX, centerY };
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
    const tilesTouchingCeiling = [[]];

    const tileState = {
      unvisited: 0,
      connectedToCeiling: 1,
      missing: 2,
    };

    // first pass, mark tiles touching ceiling and populate the rest with "unvisited"
    // mark top tiles
    for (let j = 0; j < level.columns; j++) {
      const tile = level.tiles[0][j];
      if (tile) {
        tilesTouchingCeiling[0].push(tileState.connectedToCeiling);
      } else {
        tilesTouchingCeiling[0].push(tileState.unvisited);
      }
    }
    for (let i = 1; i < level.tiles.length; i++) {
      tilesTouchingCeiling[i] = [];
      for (let j = 0; j < level.columns; j++) {
        tilesTouchingCeiling[i].push(tileState.unvisited);
      }
    }

    const stack = [];

    for (let j = 0; j < level.columns; j++) {
      const tile = level.tiles[0][j];
      if (tile) {
        stack.push(tile);
      }
    }

    while (stack.length > 0) {
      const tile = stack.pop();
      const neighborTiles = getNeighbors(tile.i, tile.j);
      for (const neighbor of neighborTiles) {
        if (tiles[neighbor.i][neighbor.j] == null || tiles[neighbor.i][neighbor.j].shouldRemove) {
          tilesTouchingCeiling[neighbor.i][neighbor.j] = tileState.missing;
          continue;
        }
        if (tilesTouchingCeiling[neighbor.i][neighbor.j] == tileState.unvisited) {
          tilesTouchingCeiling[neighbor.i][neighbor.j] = tileState.connectedToCeiling;
          stack.push(neighbor);
        }
      }
    }

    for (let i = 1; i < level.tiles.length; i++) {
      for (let j = 0; j < level.columns; j++) {
        if (tilesTouchingCeiling[i][j] != tileState.connectedToCeiling) {
          if (level.tiles[i][j]) {
            removeTile(i, j);
          }
        }
      }
    }
  }

  function removeTiles() {
    gameState = gameStates.removing;
  }

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
      level.tiles[0][j] = new Tile(0, j, val);
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
      level.height,
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
      level.height,
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
          // Draw the tile
          context.fillStyle = colors.unavailableTile;
          context.beginPath();
          context.arc(
            tileX + level.radius,
            tileY + level.radius,
            level.radius,
            0,
            Math.PI * 2,
            false,
          );
          if (tile == level.tileInPath) {
            context.fillStyle = colors.purple1;
          } else if (
            tile.state == "target" &&
            player.word[player.word.length - 1] == tile
          ) {
            context.fillStyle = colors.green2;
          } else if (tile.state == "target") {
            context.fillStyle = colors.green1;
          } else if (level.reachableTiles.includes(tile)) {
            context.fillStyle = colors.reachableTile;
          }
          context.fill();
          context.font = `${tile.fontSize}px Times`;
          context.fillStyle = "#000";
          drawCenterText(
            tile.val,
            tile.fontSize,
            tileX + level.radius,
            tileY + level.radius,
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
        ((e.clientX - rect.left) / (rect.right - rect.left)) * canvas.width,
      ),
      y: Math.round(
        ((e.clientY - rect.top) / (rect.bottom - rect.top)) * canvas.height,
      ),
    };
  }

  function findReachableTiles() {
    const reachableTiles = {};
    angleLoop: for (let angle = RIGHT_BOUND; angle < LEFT_BOUND; angle += 1) {
      for (let i = level.tiles.length - 1; i >= 0; i--) {
        for (let j = 0; j < level.columns; j++) {
          const tile = level.tiles[i][j];
          if (tile && doesCollide(angle, tile)) {
            reachableTiles[`${i},${j}`] = tile;
            continue angleLoop;
          }
        }
      }
    }
    level.reachableTiles = Object.values(reachableTiles);
  }

  function findAvailableChars() {
    const availableChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
      .split("")
      .reduce((acc, char) => {
        acc[char] = 0;
        return acc;
      }, {});
    for (const tile of level.reachableTiles) {
      availableChars[tile.val] += 1;
    }
    level.availableChars = availableChars;
  }

  function doesCollide(angle, tile) {
    let tileCenterAngle = 0;
    if (angle < 90) {
      tileCenterAngle = radToDeg(
        Math.atan2(player.centerY - tile.centerY, tile.centerX - player.centerX),
      );
    } else if (angle >= 90 && angle < 180) {
      tileCenterAngle =
        180 -
        radToDeg(
          Math.atan2(
            player.centerY - tile.centerY,
            player.centerX - tile.centerX,
          ),
        );
    }
    const distance = Math.sqrt(
      Math.pow(player.centerX - tile.centerX, 2) +
      Math.pow(player.centerY - tile.centerY, 2),
    );
    const beta = radToDeg(Math.asin(level.radius / distance));
    const rightBound = tileCenterAngle - beta;
    const leftBound = tileCenterAngle + beta;
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

  function submitWord() {
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
  }

  function deleteLastLetter() {
    if (player.word.length === 0) return;
    const lastTile = player.word.slice(-1)[0];
    lastTile.untarget();
  }

  function onKeyDown(e) {
    if (gameState == gameStates.lose || gameState == gameStates.win) {
      resetLevel();
      return;
    }
    const key = e.key.toUpperCase();
    if (key === "BACKSPACE") {
      deleteLastLetter();
    } else if (key === " ") {
      addRow();
      resetWord();
    } else if (key === "TAB") {
      // TODO: target another tile
    } else if (key === "ENTER") {
      submitWord();
    } else if (key.match(/[A-Z]/)) {
      for (const tile of level.reachableTiles) {
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
    if (player.angle < RIGHT_BOUND) {
      gameState = gameStates.waitingForCollisionCheck;
    }
  }

  function onMouseMove(e) {
    // Get the mouse position
    let pos = getMousePos(canvas, e);

    player.x = pos.x;
    player.y = pos.y;

    // Get the mouse angle
    let mouseAngle = radToDeg(
      Math.atan2(player.centerY - pos.y, pos.x - player.centerX),
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

    if (mouseAngle < 270 && mouseAngle > LEFT_BOUND) {
      mouseAngle = LEFT_BOUND;
    } else if (mouseAngle > 270 || mouseAngle < RIGHT_BOUND) {
      mouseAngle = RIGHT_BOUND;
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
    const centerX = level.x + level.width / 2;
    const centerY = level.height - TURRET_HEIGHT - FLOOR_HEIGHT;

    // Draw turret
    context.fillStyle = "#000";
    context.beginPath();
    context.fillRect(
      centerX - TURRET_WIDTH / 2,
      centerY,
      TURRET_WIDTH,
      TURRET_HEIGHT,
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
      centerY - 1 * level.tileHeight * Math.sin(degToRad(player.angle)),
    );
    context.stroke();

    // Draw dashed line representing bullet path, stopping at first tile or wall
    context.lineWidth = 3;
    context.strokeStyle = colors.blue1;
    context.beginPath();
    context.moveTo(centerX, centerY);
    // Make it stop at the first tile that it hits
    const tileInPath = getFirstTileInPath(player.angle);
    // calculate distance from centerX, centerY to the arc of the tileInPath
    let distance = 0;
    if (tileInPath) {
      level.tileInPath = tileInPath;
      distance = getDistanceToTileEdge(centerX, centerY, player.x, player.y, tileInPath.centerX, tileInPath.centerY);
    } else {
      level.tileInPath = null;
      distance = level.width;
    }
    const x = centerX + distance * Math.cos(degToRad(player.angle));
    const y = centerY - distance * Math.sin(degToRad(player.angle));
    context.lineTo(x, y);
    context.stroke();
  }

  function getDistanceToTileEdge(xStart, yStart, xCursor, yCursor, xTile, yTile) {
    const dx = xCursor - xStart;
    const dy = yStart - yCursor;
    const angleToCursor = radToDeg(Math.atan2(dy, dx));
    const dxTile = xTile - xStart;
    const dyTile = yStart - yTile;
    const angleToTile = radToDeg(Math.atan2(dyTile, dxTile));
    const theta = Math.abs(angleToCursor - angleToTile);
    const distanceToTile = Math.sqrt(
      Math.pow(xTile - xStart, 2) +
      Math.pow(yStart - yTile, 2),
    );

    const a = level.radius;
    const b = distanceToTile;
    const angleA = theta;
    const [c1, c2] = solveQuadratic(
      1,
      -2 * b * Math.cos(degToRad(angleA)),
      b * b - a * a,
    );
    const distanceToEdge = Math.min(c1, c2);
    return distanceToEdge;
  }

  function solveQuadratic(a, b, c) {
    const discriminant = b * b - 4 * a * c;
    if (discriminant < 0) {
      return [];
    } else if (discriminant === 0) {
      return [-b / (2 * a)];
    } else {
      const root1 = (-b + Math.sqrt(discriminant)) / (2 * a);
      const root2 = (-b - Math.sqrt(discriminant)) / (2 * a);
      return [root1, root2];
    }
  }


  function getFirstTileInPath(angle) {
    for (let i = level.tiles.length - 1; i >= 0; i--) {
      for (let j = 0; j < level.columns; j++) {
        const tile = level.tiles[i][j];
        if (tile && doesCollide(angle, tile)) {
          return tile;
        }
      }
    }
  }

  function aimTurret(x, y) {
    const dx = x - player.centerX;
    const dy = player.centerY - y;
    const angle = radToDeg(Math.atan2(dy, dx));
    player.angle = angle;
  }

  function renderCharBubble(char, x, y) {
    context.fillStyle = colors.beige1;
    context.beginPath();
    context.arc(x, y, WORD_PREVIEW_BUBBLE_RADIUS, 0, Math.PI * 2, false);
    context.fill();
    context.font = `${WORD_PREVIEW_BUBBLE_RADIUS}px Times`;
    context.fillStyle = "#000";
    drawCenterText(char, WORD_PREVIEW_BUBBLE_RADIUS, x, y);
  }

  function renderWord() {
    // render a bubbles for each letter of the current word
    const CHAR_SPACE = WORD_PREVIEW_BUBBLE_RADIUS * 2;
    for (let i = 0; i < player.word.length; i++) {
      const tile = player.word[i];
      const x = level.x + WORD_PREVIEW_BUBBLE_RADIUS + i * CHAR_SPACE;
      const y = level.height - FLOOR_HEIGHT / 2;
      renderCharBubble(tile.val, x, y);
    }
  }

  function renderLoseScreen() {
    context.fillStyle = colors.beige1;
    context.fillRect(level.x, level.y, level.width, level.height);
    context.fillStyle = "black";
    context.font = "24px Times";
    drawCenterText("You lose!", 24, level.width / 2, level.height / 2);
    context.font = "20px Times";
    drawCenterText(
      "Press any key to restart",
      24,
      level.width / 2,
      level.height / 2 + 30,
    );
    context.fill();
  }

  function renderWinScreen() {
    context.fillStyle = colors.beige1;
    context.fillRect(level.x, level.y, level.width, level.height);
    context.fillStyle = "black";
    context.font = "24px Times";
    drawCenterText("You win!", 24, level.width / 2, level.height / 2);
    context.font = "20px Times";
    drawCenterText(
      "Press any key to restart",
      24,
      level.width / 2,
      level.height / 2 + 30,
    );
    context.fill();
  }

  init();
};
