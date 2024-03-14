import { getRandomLetter } from "./letters.js";
import { degToRad, radToDeg } from "./angles.js";
import { updateFps, renderFps } from "./fps.js";
import { renderDebugInfo } from "./debug.js";
import { buildDict, findSuccinctWord } from "./dictionary/dictionary.js";

const colors = {
  white: "#fff",
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
colors.unavailableTile = colors.white;
colors.reachableTile = colors.brown1;
colors.reachableUnavailableKeyboard = colors.beige6;

// Important game variables
const NUM_COLUMNS = 7;
const NUM_STARTING_ROWS = 3;
const STARTING_TILE_DESCENT_SPEED = 0.1 // how many new tiles should be added per 1 second
const STARTING_FREEZE_TIME = 500 // how many seconds to freeze time for when a word is formed

let tileDescentSpeed = STARTING_TILE_DESCENT_SPEED;
let freezeTimeMs = STARTING_FREEZE_TIME;

const canvas = document.getElementById("canvas");
const context = canvas.getContext("2d");
let levelWidth = canvas.width; // tileSize * (NUM_COLUMNS + 0.5);
let tileSize = canvas.width / (NUM_COLUMNS + 0.5);
let levelHeight = tileSize * 10;
let rowHeight = tileSize * Math.cos(degToRad(30));

let gameTimeMs = 0; // used for increasing difficulty

let tabOffset = 0;

function calculateKeyboardKeyWidth() {
  const keyboardRowWidth = document.querySelector(".keyboard-row").offsetWidth;
  const maxKeysInRow = 10;
  const margin = 6;
  return (keyboardRowWidth - (8 * 2) - margin * (maxKeysInRow - 1)) / maxKeysInRow;
}

function setKeyboardKeyWidth(width) {
  const keys = document.querySelectorAll(".keyboard-button");
  keys.forEach(key => {
    key.style.width = `${width}px`;
  });
  const deleteButton = document.getElementById("backspace");
  // del and enter button can take up 1 extra key between the two of them

  deleteButton.style.width = `${width * 1.5}px`;
  const enterButton = document.getElementById("enter");
  enterButton.style.width = `${width * 1.5}px`;
}

function setGameDimensions() {
  const keyboardKeyWidth = calculateKeyboardKeyWidth();
  setKeyboardKeyWidth(keyboardKeyWidth);
  const canvasContainer = document.querySelector(".canvas-container");
  canvas.width = canvasContainer.offsetWidth;
  canvas.height = canvasContainer.offsetHeight;

  // recalculate important things
  levelWidth = canvas.width;
  tileSize = canvas.width / (NUM_COLUMNS + 0.5);
  levelHeight = tileSize * 10;
  rowHeight = tileSize * Math.cos(degToRad(30));
}

function handleStartScreenKeyDown (event) {
  if (event.key === "Enter") {
    onStart();
  }
}
function setupStartScreenListener() {
  document.addEventListener("keydown", handleStartScreenKeyDown);
}
function teardownStartScreenListener() {
  document.removeEventListener("keydown", handleStartScreenKeyDown);
}

function handleRestartScreenKeyDown (event) {
  if (event.key === "Enter") {
    onRestart();
  }
}
function setupRestartScreenListener() {
  document.addEventListener("keydown", handleRestartScreenKeyDown);
}
function teardownRestartScreenListener() {
  document.removeEventListener("keydown", handleRestartScreenKeyDown);
}

window.onresize = function() {
  setGameDimensions();
};

window.onload = function() {
  setGameDimensions();

  let lastFrame = 0;

  const gameStates = {
    idle: 0,
    falling: 2,
    removing: 3,
    lose: 4,
  };
  let gameState = gameStates.idle;

  let rowOffset = 0;

  // Options
  const SHOW_FPS = false;
  const SHOW_DEBUG_INFO = false;

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

  const debug = {
    windowInnerWidth: window.innerWidth,
    canvasWidth: canvas.width,
    canvasHeight: canvas.height,
    tileDescentSpeed: tileDescentSpeed,
  };

  const level = {
    x: canvas.width / 2 - levelWidth / 2, // x posn
    y: 0, // y posn
    radius: () => tileSize / 2, // radius of the circle
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
    previousWords: [],
    score: 0,
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
      this.leftAngleBound = null; // calculated when we find reachable tiles
      this.rightAngleBound = null; // calculated when we find reachable tiles
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
      const tileLeftAngleBound = this.leftAngleBound;
      const tileRightAngleBound = this.rightAngleBound;
      aimTurretToAngle((tileLeftAngleBound + tileRightAngleBound) / 2);
    }

    untarget() {
      // find index of word in player.word, starting from end, and remove it
      const idx = player.word.lastIndexOf(this);
      level.availableChars[this.val] += 1;
      player.word.splice(idx, 1);
      this.state = "idle";

      // aim at last tile in word
      if (player.word.length > 0) {
        const lastTile = player.word[player.word.length - 1];
        aimTurretToAngle((lastTile.leftAngleBound + lastTile.rightAngleBound) / 2);
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
    player.score = 0
    freezeTimeMs = STARTING_FREEZE_TIME;
    tileDescentSpeed = STARTING_TILE_DESCENT_SPEED;
    for (let i = 0; i < NUM_STARTING_ROWS; i++) {
      level.tiles[i] = [];
      for (let j = 0; j < NUM_COLUMNS; j++) {
        const val = getRandomLetter();
        const { x, y } = getTileCoordinate(i, j);
        level.tiles[i][j] = new Tile(i, j, val);
      }
    }
    renderTiles()
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

    player.centerX = level.x + levelWidth / 2;
    player.centerY = levelHeight - FLOOR_HEIGHT - TURRET_HEIGHT;

    resetLevel();
    newRound();
    main(0);
  }

  function initKeyboard() {
    document.getElementById("backspace").addEventListener("click", function() {
      deleteLastLetter();
    });

    document.getElementById("enter").addEventListener("click", function() {
      submitWord();
    });

    "abcdefghijklmnopqrstuvwxyz".split("").forEach((char) => {
      // add click listener to each letter
      document.getElementById(char).addEventListener("click", function() {
        const tiles = findTileByChar(char);
        for (const tile of tiles) {
          if (tile.isAvailable()) {
            tile.target();
            player.word.push(tile);
            break;
          }
        }
      });
    });
  }

  function findTileByChar(char) {
    tiles = [];
    for (let i = level.tiles.length - 1; i >= 0; i--) {
      for (let j = 0; j < NUM_COLUMNS; j++) {
        const tile = level.tiles[i][j];
        if (tile && tile.val.toLowerCase() === char) {
          tiles.push(tile);
        }
      }
    }
    return tiles;
  }

  // Main game loop
  function main(tframe) {
    if (gameState == gameStates.lose) {
      showGameOverScreen()
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
    gameState = gameStates.idle;
  }

  function update(tframe) {
    const dt = (tframe - lastFrame) / 1000;
    gameTimeMs += tframe - lastFrame
    lastFrame = tframe;

    updateFps(dt);


    if (gameState == gameStates.idle) {
      moveTilesDown(dt);
      checkIncreaseDifficulty();
      findReachableTiles();
      findAvailableChars();
      checkGameOver();
      clearEmptyRow();
      // Ready for player input
    } else if (gameState == gameStates.removing) {
      stateRemoveTiles(dt);
    } else if (gameState == gameStates.lose) {
      // get game-over-screen from html
      showGameOverScreen()
    }
  }

  function moveTilesDown(dt) {
    if (freezeTimeMs > 0) {
      freezeTimeMs -= dt * 1000;
      return;
    }
    for (let j = 0; j < NUM_COLUMNS; j++) {
      // insert a new top row if the top row is not touching ceiling
      const tile = level.tiles[0][j];
      if (tile && tile.y + tile.shift > level.y) {
        addRowOffscreen();
        break;
      }
    }
    for (let i = level.tiles.length - 1; i >= 0; i--) {
      for (let j = 0; j < NUM_COLUMNS; j++) {
        const tile = level.tiles[i][j];
        if (tile) {
          tile.shift += tileSize * dt * tileDescentSpeed;
        }
      }
    }
  }

  function checkIncreaseDifficulty() {
    // increase difficulty every x seconds
    if (gameTimeMs > 10 * 1000) {
      tileDescentSpeed *= 1.2
      debug.tileDescentSpeed = tileDescentSpeed;
      gameTimeMs = 0;
    }
  }

  function renderKeyboard() {
    document.querySelectorAll(".keyboard-button").forEach((key) => {
      key.style.backgroundColor = colors.unavailableTile;
    });
    for (const tile of level.reachableTiles) {
      if (level.availableChars[tile.val.toUpperCase()] > 0) {
        document.getElementById(tile.val.toLowerCase()).style.backgroundColor = colors.reachableTile;
      } else {
        document.getElementById(tile.val.toLowerCase()).style.backgroundColor = colors.reachableUnavailableKeyboard;
      }
    }
  }

  // Render the game
  function render() {
    if (gameState == gameStates.lose) {
      return;
    }
    renderFrame();
    renderFreezeTime();
    renderTiles();
    renderPlayer();
    renderWord();
    renderScore();
    renderKeyboard();
    if (SHOW_FPS) renderFps(context, level);
    if (SHOW_DEBUG_INFO) renderDebugInfo(context, level, levelHeight, player, debug);
  }

  function getTileCoordinate(row, col) {
    let x = level.x + col * tileSize;
    // If the row is even, the x position is shifted over
    if ((row + rowOffset) % 2 === 0) {
      x += tileSize / 2;
    }
    const y = row * rowHeight;
    const centerX = x + tileSize / 2;
    const centerY = y + tileSize / 2;
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
        j + y >= NUM_COLUMNS
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
    for (let j = 0; j < NUM_COLUMNS; j++) {
      const tile = level.tiles[0][j];
      if (tile) {
        if (tile.shouldRemove) {
          tilesTouchingCeiling[0].push(tileState.missing);
        } else {
          tilesTouchingCeiling[0].push(tileState.connectedToCeiling);
        }
      } else {
        tilesTouchingCeiling[0].push(tileState.unvisited);
      }
    }
    for (let i = 1; i < level.tiles.length; i++) {
      tilesTouchingCeiling[i] = [];
      for (let j = 0; j < NUM_COLUMNS; j++) {
        tilesTouchingCeiling[i].push(tileState.unvisited);
      }
    }

    const stack = [];

    for (let j = 0; j < NUM_COLUMNS; j++) {
      const tile = level.tiles[0][j];
      if (tile && tilesTouchingCeiling[0][j] == tileState.connectedToCeiling) {
        stack.push(tile);
      }
    }

    while (stack.length > 0) {
      const tile = stack.pop();
      const neighborTiles = getNeighbors(tile.i, tile.j);
      for (const neighbor of neighborTiles) {
        if (level.tiles[neighbor.i][neighbor.j] == null || level.tiles[neighbor.i][neighbor.j].shouldRemove) {
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
      for (let j = 0; j < NUM_COLUMNS; j++) {
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

  function addRowOffscreen() {
    rowOffset = rowOffset === 0 ? 1 : 0;
    level.tiles.unshift([]);
    for (let j = 0; j < NUM_COLUMNS; j++) {
      // add new row
      const val = getRandomLetter();
      level.tiles[0][j] = new Tile(0, j, val);
      level.tiles[0][j].shift = -rowHeight;
    }
    // shift -50 on all tiles
    for (let i = 1; i < level.tiles.length; i++) {
      for (let j = 0; j < NUM_COLUMNS; j++) {
        const tile = level.tiles[i][j];
        if (tile) {
          tile.i++;
          tile.shift -= rowHeight;
        }
      }
    }
  }

  function addRow() {
    // remove any falling tiles
    for (let i = level.tiles.length - 1; i >= 0; i--) {
      for (let j = 0; j < NUM_COLUMNS; j++) {
        const tile = level.tiles[i][j];
        if (tile && tile.state == "remove") {
          level.tiles[i][j] = null;
          // level.tiles[i][j].leftAngleBound = null;
          // level.tiles[i][j].rightAngleBound = null;
        }
      }
    }

    rowOffset = rowOffset === 0 ? 1 : 0;
    level.tiles.unshift([]);
    for (let j = 0; j < NUM_COLUMNS; j++) {
      const val = getRandomLetter();
      level.tiles[0][j] = new Tile(0, j, val);
    }
    // shift i of all tiles
    for (let i = 1; i < level.tiles.length; i++) {
      for (let j = 0; j < NUM_COLUMNS; j++) {
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
      for (let j = 0; j < NUM_COLUMNS; j++) {
        const tile = level.tiles[i][j];
        if (tile && tile.shouldRemove) {
          removingTiles = true;
          tile.velocity += 1000 * dt;
          tile.shift += tile.velocity * dt;
          const tileY = getTileCoordinate(i, j).y + tile.shift;

          if (tileY > levelHeight - tileSize) {
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
      levelWidth,
      levelHeight,
    );
    gradient.addColorStop(0, "#fdfbfb"); // Light shade of gray
    gradient.addColorStop(1, "#ebedee"); // Slightly darker shade of gray
    context.fillStyle = gradient;
    context.fillRect(level.x, level.y, levelWidth, levelHeight);

    // Draw Floor
    context.fillStyle = "#000";
    context.fillRect(
      level.x,
      levelHeight - FLOOR_HEIGHT,
      levelWidth,
      levelHeight,
    );
  }

  function renderFreezeTime() {
    if (freezeTimeMs > 0) {
      context.fillStyle = colors.gray1;
      // draw a "pause" symbol in the background with two rectangles
      context.fillRect(level.x + levelWidth / 2 - 10, level.y + levelHeight / 2 - 10, 10, 40);
      context.fillRect(level.x + levelWidth / 2 + 10, level.y + levelHeight / 2 - 10, 10, 40);

    }
  }

  function renderTiles() {
    // Top to bottom
    for (let i = 0; i < level.tiles.length; i++) {
      for (let j = 0; j < NUM_COLUMNS; j++) {
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
            tileX + level.radius(),
            tileY + level.radius(),
            level.radius(),
            0,
            Math.PI * 2,
            false,
          );
          // if (tile == level.tileInPath) {
          //   // context.fillStyle = colors.purple1;
          // } else
          if (
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
          context.font = `${tile.fontSize}px Josefin Sans`;
          context.fillStyle = "#000";
          drawCenterText(
            tile.val,
            tile.fontSize,
            tileX + level.radius(),
            tileY + level.radius(),
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
    angleLoop: for (let angle = LEFT_BOUND; angle >= RIGHT_BOUND; angle -= 0.25) {
      const tile = getFirstTileInPath(angle);

      if (tile) {
        reachableTiles[`${tile.i},${tile.j}`] = tile;
        if (tile.leftAngleBound == null) {
          // Note that we iterate from left to right, so left is the first time we see it
          tile.leftAngleBound = angle;
        }
        if (tile.rightAngleBound == null) {
          tile.rightAngleBound = angle;
        }
        // Note that left is 180 is and right is 0, so we want to take the min to find the right bound
        tile.rightAngleBound = Math.min(angle, tile.rightAngleBound);
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
    const beta = radToDeg(Math.asin(level.radius() / distance));
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

  function checkGameOver() {
    const lastRowIdx = level.tiles.length - 1;
    for (let j = 0; j < NUM_COLUMNS; j++) {
      if (level.tiles[lastRowIdx][j]) {
        const { y } = getTileCoordinate(lastRowIdx, j);
        if (y + tileSize > player.centerY - tileSize / 2) {
          gameState = gameStates.lose;
        }
      }
    }
  }

  function resetWord() {
    for (let i = player.word.length - 1; i >= 0; i--) {
      const tile = player.word[i];
      tile.untarget();
    }
  }

  function submitWord() {
    const word = player.word
      .map((t) => t.val)
      .join("")
      .toLowerCase();
    const isWord = findSuccinctWord(word);
    if (isWord && word.length >= 3) {
      for (const tile of player.word) {
        removeTile(tile.i, tile.j);
      }
      removeFloatingTiles();
      removeTiles();
      player.word = [];
      player.previousWords.push(word);

      if (word.length == 3) {
        player.score += 1
      } else if (word.length == 4) {
        player.score += 2
        freezeTimeMs += 2000;
      } else if (word.length >= 5) {
        const score = Math.pow(2, word.length - 2); // 5 = 4, 6 = 8, 7 = 16
        player.score += score
        const freezeTime = Math.pow(1.5, word.length - 3) * 1000; // 5 = 2800, 6 = 5000, 7 = 8000
        freezeTimeMs += freezeTime
        // TODO: give player a bomb to use?
      }
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
    // if (gameState == gameStates.lose) {
    //   resetLevel();
    //   return;
    // }
    const key = e.key.toUpperCase();
    if (key === "BACKSPACE") {
      deleteLastLetter();
    } else if (key === " ") {
      // addRow();
      resetWord();
    } else if (key === "TAB") {
      e.preventDefault();
      const lastChar = player.word[player.word.length - 1].val;
      cycleTileByChar(lastChar);
    } else if (key === "ENTER") {
      submitWord();
    } else if (key.match(/[A-Z]/)) {
      selectTileByChar(key);
    }
  }

  function selectTileByChar(char) {
    for (const tile of level.reachableTiles) {
      if (tile.val === char && tile.isAvailable()) {
        tile.target();
        player.word.push(tile);
        break;
      }
    }
  }

  function cycleTileByChar(char) {
    const reachableTiles = []
    for (const tile of level.reachableTiles) {
      if (tile.val === char) {
        reachableTiles.push(tile);
      }
    }
    if (reachableTiles.length > 0) {
      tabOffset = (tabOffset + 1) % reachableTiles.length;
      const tile = reachableTiles[tabOffset];
      if (tile.isAvailable()) {
        deleteLastLetter();
        tile.target();
        player.word.push(tile);
      }
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
      for (let j = 0; j < NUM_COLUMNS; j++) {
        const tile = level.tiles[i][j];
        if (tile) {
          const { x: tileX, y: tileY } = getTileCoordinate(i, j);
          if (
            x > tileX &&
            x < tileX + tileSize &&
            y > tileY + tile.shift &&
            y < tileY + tile.shift + tileSize
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
    const centerX = level.x + levelWidth / 2;
    const centerY = levelHeight - TURRET_HEIGHT - FLOOR_HEIGHT;


    // Draw line representing bullet path, stopping at first tile or wall
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
      distance = getDistanceToTileEdge(centerX, centerY, player.angle, tileInPath.centerX, tileInPath.centerY + tileInPath.shift);
    } else {
      level.tileInPath = null;
      distance = levelWidth;
    }
    const x = centerX + distance * Math.cos(degToRad(player.angle));
    const y = centerY - distance * Math.sin(degToRad(player.angle));
    context.lineTo(x, y);
    context.stroke();

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
    context.lineWidth = 13;
    context.strokeStyle = "#000";
    context.setLineDash([0, 0]);
    context.beginPath();
    context.moveTo(centerX, centerY);
    context.lineTo(
      centerX + 0.8 * tileSize * Math.cos(degToRad(player.angle)),
      centerY - 0.8 * tileSize * Math.sin(degToRad(player.angle)),
    );
    context.stroke();
  }

  function getDistanceToTileEdge(xStart, yStart, playerAngle, xTile, yTile) {
    const dxTile = xTile - xStart;
    const dyTile = yStart - yTile;
    const angleToTile = radToDeg(Math.atan2(dyTile, dxTile));
    const theta = Math.abs(playerAngle - angleToTile);
    const distanceToTile = Math.sqrt(
      Math.pow(xTile - xStart, 2) +
      Math.pow(yStart - yTile, 2),
    );

    const a = level.radius();
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
      for (let j = 0; j < NUM_COLUMNS; j++) {
        const tile = level.tiles[i][j];
        if (tile && doesCollide(angle, tile)) {
          return tile;
        }
      }
    }
  }

  function aimTurretToAngle(angle) {
    player.angle = angle;
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
      const y = levelHeight - FLOOR_HEIGHT / 2;
      renderCharBubble(tile.val, x, y);
    }
  }

  function renderScore() {
    context.font = "24px Chivo Mono";
    context.fillStyle = colors.beige1;
    drawCenterText(`Score: ${player.score}`, 24, levelWidth / 2, levelHeight - 24);
  }

  function replaceSeedInQueryParams() {
    const min = 10000;
    const max = 99999;
    const seed = Math.floor(Math.random() * (max - min + 1)) + min;
    const url = new URL(window.location.href);
    url.searchParams.set('seed', seed);
    window.history.pushState({}, '', url);
  }

  function showGameOverScreen() {
    document.getElementById("game-over-screen").style.display = "flex";
    document.getElementById('game-over-score').innerText = player.score
    setupRestartScreenListener()
    // fill <ul> with <li> elements of previous words
    const wordsList = document.getElementById('game-over-words-list')
    wordsList.innerHTML = ''
    player.previousWords.forEach(word => {
      const li = document.createElement('li')
      li.innerText = word
      wordsList.appendChild(li)
    });
  }

  function renderGameOverScreen() {
    // background
    context.fillStyle = colors.beige1;
    context.fillRect(level.x, level.y, levelWidth, levelHeight);

    // show player's previous words
    context.fillStyle = colors.blue3;
    let x = 12;
    let y = 0; // margin + font size
    for (let i = 0; i < player.previousWords.length; i++) {
      const word = player.previousWords[i];
      y += 24;
      if (y > levelHeight) {
        y = 12 + 14;
        x += 120;
      }
      context.font = "14px Josefin Sans";
      context.fillText(word, x, y);
    }

    context.fillStyle = "black";
    context.font = "24px Chivo Mono";
    drawCenterText(`Score`, 24, levelWidth / 2, levelHeight / 2 - 80);
    context.font = "80px Chivo Mono";
    drawCenterText(`${player.score}`, 80, levelWidth / 2, levelHeight / 2);
    context.font = "20px Chivo Mono";
    drawCenterText(
      "Press any key to restart",
      24,
      levelWidth / 2,
      levelHeight / 2 + 80,
    );
    context.fill();
  }

  function setSeedIfNoneExists() {
    const url = new URL(window.location.href);
    const seed = url.searchParams.get('seed');
    if (!seed) {
      replaceSeedInQueryParams()
    }
  }

  function onStart() {
    teardownStartScreenListener()
    setSeedIfNoneExists()
    document.getElementById("start-screen").style.display = "none";
    init();
  }
  function onRestart() {
    teardownRestartScreenListener()
    replaceSeedInQueryParams()
    resetLevel()
    document.getElementById("game-over-screen").style.display = 'none';
  }
  window.onStart = onStart
  window.onRestart = onRestart

  setupStartScreenListener()
};

