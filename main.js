// ============== PeerJSの接続設定 ==============
// ここにRender等でデプロイしたシグナリングサーバーの情報を入力します
// 例：
const peer = new Peer({
  host: "https://osero-p2p-render.onrender.com",
  secure: true,
  key: "peerjs",
});

// ローカルテスト用 (サーバーをローカルで動かす場合)
// const peer = new Peer({
//   host: "https://osero-p2p-render.onrender.com/",
//   port: 10000,
//   path: "/myapp",
// });

// ============== DOM要素の取得 ==============
const myIdDisplay = document.getElementById("my-id");
const opponentIdInput = document.getElementById("opponent-id-input");
const connectBtn = document.getElementById("connect-btn");
const boardEl = document.getElementById("board");
const statusDisplay = document.getElementById("status-display");
const turnDisplay = document.getElementById("turn-display");
const resetBtn = document.getElementById("reset-btn");

// ============== ゲームの状態変数 ==============
const BOARD_SIZE = 8;
let board = []; // 0: empty, 1: black, 2: white
let myColor = null; // 自分がどちらの石か 1:黒, 2:白
let currentTurn = 1; // 1: 黒のターン, 2: 白のターン
let connection = null; // 相手との接続オブジェクト
let gameStarted = false;

// ============== P2P通信関連の処理 ==============

// PeerJSサーバーへの接続が確立したとき
peer.on("open", (id) => {
  myIdDisplay.textContent = id;
});

// 相手からの接続を待つ処理
peer.on("connection", (conn) => {
  setupConnection(conn);
  // 自分がホスト側なので、黒(先手)になる
  myColor = 1;
  startGame();
});

// 相手に接続するボタンの処理
connectBtn.addEventListener("click", () => {
  const opponentId = opponentIdInput.value;
  if (!opponentId) {
    alert("Please enter an opponent's ID.");
    return;
  }
  const conn = peer.connect(opponentId);
  setupConnection(conn);
  // 自分がクライアント側なので、白(後手)になる
  myColor = 2;
});

// 接続のセットアップ（共通処理）
function setupConnection(conn) {
  connection = conn;
  connection.on("open", () => {
    statusDisplay.textContent = `Connected to ${connection.peer}.`;
    opponentIdInput.disabled = true;
    connectBtn.disabled = true;
    if (myColor === 1) {
      // ホスト側だけがゲーム開始をトリガー
      startGame();
    }
  });

  connection.on("data", (data) => {
    handleReceivedData(data);
  });

  connection.on("close", () => {
    statusDisplay.textContent = "Connection lost.";
    gameStarted = false;
    opponentIdInput.disabled = false;
    connectBtn.disabled = false;
  });
}

// データ受信時の処理
function handleReceivedData(data) {
  if (data.type === "move") {
    const { x, y, color } = data.data;
    placeStone(x, y, color, false); // 相手の石を置く
  } else if (data.type === "reset") {
    initGame();
    statusDisplay.textContent = "Opponent requested a game reset.";
  }
}

// データを相手に送信する
function sendData(type, data) {
  if (connection) {
    connection.send({ type, data });
  }
}

// ============== ゲームロジック ==============

// ゲームの初期化
function initGame() {
  board = Array(BOARD_SIZE)
    .fill(0)
    .map(() => Array(BOARD_SIZE).fill(0));
  // 初期配置
  board[3][3] = 2; // 白
  board[3][4] = 1; // 黒
  board[4][3] = 1; // 黒
  board[4][4] = 2; // 白

  currentTurn = 1; // 黒のターンから
  gameStarted = false;
  drawBoard();
  updateTurnDisplay();
}

// ゲーム開始処理
function startGame() {
  if (gameStarted) return;
  initGame();
  gameStarted = true;
  statusDisplay.textContent = "Game started!";
}

// 盤面の描画
function drawBoard() {
  boardEl.innerHTML = "";
  for (let y = 0; y < BOARD_SIZE; y++) {
    const tr = document.createElement("tr");
    for (let x = 0; x < BOARD_SIZE; x++) {
      const td = document.createElement("td");
      td.dataset.x = x;
      td.dataset.y = y;
      if (board[y][x] !== 0) {
        const stone = document.createElement("div");
        stone.className = "stone " + (board[y][x] === 1 ? "black" : "white");
        td.appendChild(stone);
      }
      tr.appendChild(td);
    }
    boardEl.appendChild(tr);
  }
}

// 手番表示の更新
function updateTurnDisplay() {
  if (!gameStarted) {
    turnDisplay.textContent = "";
    return;
  }
  const turnColor = currentTurn === 1 ? "Black" : "White";
  const myRole = myColor === 1 ? "Black" : "White";
  turnDisplay.textContent = `Turn: ${turnColor} (You are ${myRole})`;
  if (currentTurn === myColor) {
    turnDisplay.style.color = "blue";
  } else {
    turnDisplay.style.color = "red";
  }
}

// マスがクリックされたときの処理
boardEl.addEventListener("click", (e) => {
  if (!gameStarted || currentTurn !== myColor) return; // 自分のターンじゃないと操作不可

  const td = e.target.closest("td");
  if (!td) return;

  const x = parseInt(td.dataset.x);
  const y = parseInt(td.dataset.y);

  if (isValidMove(x, y, myColor)) {
    placeStone(x, y, myColor, true); // 自分の石を置く
  }
});

// 石を置く処理
function placeStone(x, y, color, isMyMove) {
  if (board[y][x] !== 0) return;
  board[y][x] = color;
  flipStones(x, y, color);
  drawBoard();

  currentTurn = color === 1 ? 2 : 1; // ターン交代
  updateTurnDisplay();

  if (isMyMove) {
    sendData("move", { x, y, color });
  }

  checkGameEnd();
}

// 石を置けるか判定する
function isValidMove(x, y, color) {
  if (board[y][x] !== 0) return false;

  const opponentColor = color === 1 ? 2 : 1;
  // 8方向をチェック
  const directions = [
    [-1, -1],
    [-1, 0],
    [-1, 1],
    [0, -1],
    [0, 1],
    [1, -1],
    [1, 0],
    [1, 1],
  ];

  for (const [dx, dy] of directions) {
    let stonesToFlip = [];
    let nx = x + dx;
    let ny = y + dy;

    // 隣が相手の石かチェック
    if (
      nx >= 0 &&
      nx < BOARD_SIZE &&
      ny >= 0 &&
      ny < BOARD_SIZE &&
      board[ny][nx] === opponentColor
    ) {
      stonesToFlip.push([nx, ny]);
      // その方向に自分の石があるまで進む
      while (true) {
        nx += dx;
        ny += dy;
        if (
          nx < 0 ||
          nx >= BOARD_SIZE ||
          ny < 0 ||
          ny >= BOARD_SIZE ||
          board[ny][nx] === 0
        ) {
          break; // 盤外か空マスなら失敗
        }
        if (board[ny][nx] === color) {
          return true; // 自分の石を見つけたら成功
        }
        stonesToFlip.push([nx, ny]);
      }
    }
  }
  return false;
}

// 石をひっくり返す処理
function flipStones(x, y, color) {
  const opponentColor = color === 1 ? 2 : 1;
  const directions = [
    [-1, -1],
    [-1, 0],
    [-1, 1],
    [0, -1],
    [0, 1],
    [1, -1],
    [1, 0],
    [1, 1],
  ];

  for (const [dx, dy] of directions) {
    let stonesToFlip = [];
    let nx = x + dx;
    let ny = y + dy;

    while (nx >= 0 && nx < BOARD_SIZE && ny >= 0 && ny < BOARD_SIZE) {
      if (board[ny][nx] === 0) break;
      if (board[ny][nx] === color) {
        // 自分の石を見つけたら、間の石をすべてひっくり返す
        for (const [fx, fy] of stonesToFlip) {
          board[fy][fx] = color;
        }
        break;
      }
      stonesToFlip.push([nx, ny]);
      nx += dx;
      ny += dy;
    }
  }
}

// ゲーム終了のチェック
function checkGameEnd() {
  // プレイヤーが石を置ける場所があるかチェック
  const canBlackMove = canPlayerMove(1);
  const canWhiteMove = canPlayerMove(2);

  if (!canBlackMove && !canWhiteMove) {
    // どちらも置けないならゲーム終了
    endGame();
  } else if (currentTurn === 1 && !canBlackMove) {
    // 黒のターンだが置けない -> パスして白のターンへ
    currentTurn = 2;
    updateTurnDisplay();
    statusDisplay.textContent = "Black has no moves, passes turn.";
  } else if (currentTurn === 2 && !canWhiteMove) {
    // 白のターンだが置けない -> パスして黒のターンへ
    currentTurn = 1;
    updateTurnDisplay();
    statusDisplay.textContent = "White has no moves, passes turn.";
  }
}

// 特定の色のプレイヤーが動けるか
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

// ゲーム終了処理
function endGame() {
  let blackCount = 0;
  let whiteCount = 0;
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (board[y][x] === 1) blackCount++;
      if (board[y][x] === 2) whiteCount++;
    }
  }

  let resultMessage = `Game Over! Black: ${blackCount}, White: ${whiteCount}. `;
  if (blackCount > whiteCount) resultMessage += "Black wins!";
  else if (whiteCount > blackCount) resultMessage += "White wins!";
  else resultMessage += "It's a draw!";

  statusDisplay.textContent = resultMessage;
  gameStarted = false;
}

// リセットボタンの処理
resetBtn.addEventListener("click", () => {
  initGame();
  sendData("reset", {});
  statusDisplay.textContent = "Game has been reset.";
});

// ============== 初期化処理 ==============
initGame();
