// ============== 定数定義 ==============
const BOARD_SIZE = 8;
const COLORS = {
  EMPTY: 0,
  BLACK: 1,
  WHITE: 2,
};
const MESSAGE_TYPES = {
  MOVE: "move",
  RESET: "reset",
};
const DIRECTIONS = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
];

// ============== DOM要素の取得 ==============
const domElements = {
  myIdDisplay: document.getElementById("my-id"),
  opponentIdInput: document.getElementById("opponent-id-input"),
  connectBtn: document.getElementById("connect-btn"),
  board: document.getElementById("board"),
  statusDisplay: document.getElementById("status-display"),
  turnDisplay: document.getElementById("turn-display"),
  resetBtn: document.getElementById("reset-btn"),
  shareBtn: document.getElementById("share-btn"),
};

// ============== ゲームの状態管理 ==============
const gameState = {
  board: [],
  myColor: null,
  currentTurn: COLORS.BLACK,
  gameStarted: false,
};

let connection = null;

// ============== PeerJSの接続設定 ==============
const peer = new Peer({
  host: "osero-p2p-render.onrender.com",
  secure: true,
  path: "/myapp",
});

// ========================================================
// 初期化処理
// ========================================================

function initialize() {
  initializePeerEvents();
  initializeEventListeners();
  initBoard();
  checkUrlParams();
}

function checkUrlParams() {
  const params = new URLSearchParams(window.location.search);
  const connectToId = params.get("connect_to");
  if (connectToId) {
    domElements.opponentIdInput.value = connectToId;
    domElements.statusDisplay.textContent = `招待されています！ '接続' ボタンを押してください。`;
  }
}

// ========================================================
// P2P通信関連
// ========================================================

function initializePeerEvents() {
  peer.on("open", (id) => {
    domElements.myIdDisplay.textContent = id;
    updateUI("disconnected");
  });

  // incoming connection: 先に自分の色を決めてから接続セットアップ
  peer.on("connection", (conn) => {
    gameState.myColor = COLORS.BLACK; // 受信側は黒を割り当て
    setupConnection(conn);
  });

  peer.on("error", (err) => {
    console.error("PeerJS error:", err);
    alert("接続エラーが発生しました。ページをリロードしてください。");
  });
}

function setupConnection(conn) {
  connection = conn;
  connection.on("open", () => {
    // safety: ここで myColor が設定されていることを期待するが念のためチェック
    if (!gameState.myColor) {
      console.warn(
        "myColor is not set when connection opened — defaulting to WHITE."
      );
      gameState.myColor = COLORS.WHITE;
    }
    startGame();
    updateUI("connected");
  });
  connection.on("data", handleReceivedData);
  connection.on("close", () => {
    alert("接続が切れました。");
    resetToInitialState();
  });
}

function handleReceivedData(data) {
  switch (data.type) {
    case MESSAGE_TYPES.MOVE: {
      const { x, y, color } = data.data;
      // 相手の手を反映（isMyMove = false）
      placeStone(x, y, color, false);
      break;
    }
    case MESSAGE_TYPES.RESET:
      startGame();
      domElements.statusDisplay.textContent =
        "相手がゲームをリセットしました。";
      break;
    default:
      console.warn("Unknown message type:", data.type);
  }
}

function sendData(type, data) {
  if (connection && connection.open) {
    connection.send({ type, data });
  }
}

function resetToInitialState() {
  connection = null;
  gameState.myColor = null;
  gameState.gameStarted = false;
  initBoard();
  updateUI("disconnected");
}

// ========================================================
// ゲームロジック
// ========================================================

function startGame() {
  initBoard();
  gameState.gameStarted = true;
  domElements.statusDisplay.textContent = "ゲーム開始！";
}

function initBoard() {
  gameState.board = Array(BOARD_SIZE)
    .fill(0)
    .map(() => Array(BOARD_SIZE).fill(COLORS.EMPTY));
  gameState.board[3][3] = COLORS.WHITE;
  gameState.board[3][4] = COLORS.BLACK;
  gameState.board[4][3] = COLORS.BLACK;
  gameState.board[4][4] = COLORS.WHITE;
  gameState.currentTurn = COLORS.BLACK;
  drawBoard();
  updateTurnDisplay();
}

function placeStone(x, y, color, isMyMove) {
  if (gameState.board[y][x] !== COLORS.EMPTY) return;

  const stonesToFlip = getFlippableStones(x, y, color);
  if (stonesToFlip.length === 0 && isMyMove) return;

  // 盤面を更新
  gameState.board[y][x] = color;
  stonesToFlip.forEach(([fx, fy]) => {
    gameState.board[fy][fx] = color;
  });

  // ターンを切り替え（先に切り替えてから描画することで、相手の有効手が正しく表示される）
  gameState.currentTurn = color === COLORS.BLACK ? COLORS.WHITE : COLORS.BLACK;

  // 自分の手なら相手に伝える
  if (isMyMove) {
    sendData(MESSAGE_TYPES.MOVE, { x, y, color });
  }

  // 描画（placed/flipped 情報を渡す）
  drawBoard({ placed: { x, y }, flipped: stonesToFlip });
  updateTurnDisplay();

  checkGameEnd();
}

function isValidMove(x, y, color) {
  if (gameState.board[y][x] !== COLORS.EMPTY) return false;
  return getFlippableStones(x, y, color).length > 0;
}

function getFlippableStones(x, y, color) {
  const opponentColor = color === COLORS.BLACK ? COLORS.WHITE : COLORS.BLACK;
  let allFlippableStones = [];

  for (const [dx, dy] of DIRECTIONS) {
    let line = [];
    let nx = x + dx;
    let ny = y + dy;

    while (nx >= 0 && nx < BOARD_SIZE && ny >= 0 && ny < BOARD_SIZE) {
      if (gameState.board[ny][nx] === opponentColor) {
        line.push([nx, ny]);
      } else if (gameState.board[ny][nx] === color) {
        // 自分の石で挟めたら line をひっくるめて確定
        allFlippableStones = allFlippableStones.concat(line);
        break;
      } else {
        // 空白 or その他 -> この方向は不可
        break;
      }
      nx += dx;
      ny += dy;
    }
  }
  return allFlippableStones;
}

function canPlayerMove(color) {
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (isValidMove(x, y, color)) {
        return true;
      }
    }
  }
  return false;
}

function checkGameEnd() {
  const canBlackMove = canPlayerMove(COLORS.BLACK);
  const canWhiteMove = canPlayerMove(COLORS.WHITE);

  if (!canBlackMove && !canWhiteMove) {
    endGame();
    return;
  }

  const currentPlayerCanMove =
    gameState.currentTurn === COLORS.BLACK ? canBlackMove : canWhiteMove;

  if (!currentPlayerCanMove) {
    domElements.statusDisplay.textContent = `${
      gameState.currentTurn === COLORS.BLACK ? "黒" : "白"
    }は置ける場所がありません。パスします。`;
    gameState.currentTurn =
      gameState.currentTurn === COLORS.BLACK ? COLORS.WHITE : COLORS.BLACK;
    updateTurnDisplay();
    // パス後は盤表示更新（有効手が変わるため）
    drawBoard();
  }
}

function endGame() {
  const counts = gameState.board.flat().reduce(
    (acc, color) => {
      if (color === COLORS.BLACK) acc.black++;
      else if (color === COLORS.WHITE) acc.white++;
      return acc;
    },
    { black: 0, white: 0 }
  );

  let resultMessage = `ゲーム終了！ 黒: ${counts.black}, 白: ${counts.white}。`;
  if (counts.black > counts.white) resultMessage += "黒の勝ち！";
  else if (counts.white > counts.black) resultMessage += "白の勝ち！";
  else resultMessage += "引き分けです！";

  domElements.statusDisplay.textContent = resultMessage;
  gameState.gameStarted = false;
}

// ========================================================
// UI関連
// ========================================================

function updateUI(state) {
  const isConnected = state === "connected";
  domElements.opponentIdInput.disabled = isConnected;
  domElements.connectBtn.disabled = isConnected;
  domElements.shareBtn.style.display = isConnected ? "none" : "inline-block";
  domElements.resetBtn.style.display = isConnected ? "inline-block" : "none";
}

function drawBoard(animations = {}) {
  domElements.board.innerHTML = "";
  const validMoves =
    gameState.currentTurn === gameState.myColor
      ? getValidMoves(gameState.myColor)
      : [];

  for (let y = 0; y < BOARD_SIZE; y++) {
    const tr = document.createElement("tr");
    for (let x = 0; x < BOARD_SIZE; x++) {
      const td = document.createElement("td");
      td.dataset.x = x;
      td.dataset.y = y;

      const color = gameState.board[y][x];
      if (color !== COLORS.EMPTY) {
        const stone = document.createElement("div");
        stone.className =
          "stone " + (color === COLORS.BLACK ? "black" : "white");

        // アニメーションクラスの追加
        if (
          animations.placed &&
          animations.placed.x === x &&
          animations.placed.y === y
        ) {
          stone.classList.add("placed");
        } else if (
          animations.flipped &&
          animations.flipped.some(([fx, fy]) => fx === x && fy === y)
        ) {
          stone.classList.add("flipping");
        }

        td.appendChild(stone);
      } else {
        if (validMoves.some((move) => move.x === x && move.y === y)) {
          td.classList.add("valid-move");
        }
      }
      tr.appendChild(td);
    }
    domElements.board.appendChild(tr);
  }
}

function getValidMoves(color) {
  const moves = [];
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (isValidMove(x, y, color)) {
        moves.push({ x, y });
      }
    }
  }
  return moves;
}

function updateTurnDisplay() {
  if (!connection || !gameState.myColor) {
    domElements.turnDisplay.textContent = "接続待機中...";
    return;
  }
  const turnColorName = gameState.currentTurn === COLORS.BLACK ? "黒" : "白";
  const myColorName = gameState.myColor === COLORS.BLACK ? "黒" : "白";
  domElements.turnDisplay.textContent = `手番: ${turnColorName} (あなたは ${myColorName})`;

  if (gameState.currentTurn === gameState.myColor) {
    domElements.turnDisplay.style.fontWeight = "bold";
    domElements.turnDisplay.style.color = "blue";
  } else {
    domElements.turnDisplay.style.fontWeight = "normal";
    domElements.turnDisplay.style.color = "red";
  }
}

// ========================================================
// イベントリスナー設定
// ========================================================

function initializeEventListeners() {
  domElements.connectBtn.addEventListener("click", () => {
    const opponentId = domElements.opponentIdInput.value;
    if (!opponentId) return alert("相手のIDを入力してください。");

    // 発信側は白を割り当ててから接続
    gameState.myColor = COLORS.WHITE;
    const conn = peer.connect(opponentId);
    setupConnection(conn);
  });

  domElements.shareBtn.addEventListener("click", () => {
    const myId = domElements.myIdDisplay.textContent;
    if (!myId) return;
    const shareUrl = `${window.location.href.split("?")[0]}?connect_to=${myId}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      domElements.statusDisplay.textContent = "招待リンクをコピーしました！";
    });
  });

  domElements.board.addEventListener("click", (e) => {
    // デバッグ（必要なければ削除）
    // console.log('board click target:', e.target);

    if (!gameState.gameStarted || gameState.currentTurn !== gameState.myColor)
      return;

    const td = e.target.closest("td");
    if (!td || !td.classList.contains("valid-move")) return;

    const x = parseInt(td.dataset.x, 10);
    const y = parseInt(td.dataset.y, 10);
    if (Number.isNaN(x) || Number.isNaN(y)) return;

    placeStone(x, y, gameState.myColor, true);
  });

  domElements.resetBtn.addEventListener("click", () => {
    if (!connection) return;
    sendData(MESSAGE_TYPES.RESET, {});
    startGame();
    domElements.statusDisplay.textContent = "ゲームをリセットしました。";
  });
}

// ============== アプリケーションの実行開始 ==============
initialize();
