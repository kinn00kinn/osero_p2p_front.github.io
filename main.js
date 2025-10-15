// ============== PeerJSの接続設定 ==============
const peer = new Peer({
  host: "osero-p2p-render.onrender.com",
  secure: true,
  path: "/myapp",
});


// ============== DOM要素の取得 ==============
const myIdDisplay = document.getElementById("my-id");
const opponentIdInput = document.getElementById("opponent-id-input");
const connectBtn = document.getElementById("connect-btn");
const boardEl = document.getElementById("board");
const statusDisplay = document.getElementById("status-display");
const turnDisplay = document.getElementById("turn-display");
const resetBtn = document.getElementById("reset-btn");
const shareBtn = document.getElementById("share-btn"); // ★ 追加

// ============== ゲームの状態変数 ==============
const BOARD_SIZE = 8;
let board = []; // 0: empty, 1: black, 2: white
let myColor = null; // 自分がどちらの石か 1:黒, 2:白
let currentTurn = 1; // 1: 黒のターン, 2: 白のターン
let connection = null; // 相手との接続オブジェクト
let gameStarted = false;


// ★★★ ここから追加 ★★★
// ページ読み込み時にURLパラメータをチェックする
window.addEventListener('load', () => {
    const params = new URLSearchParams(window.location.search);
    const connectToId = params.get('connect_to');
    if (connectToId) {
        opponentIdInput.value = connectToId;
        statusDisplay.textContent = `Invitation received! Click 'Connect' to start.`;
    }
});
// ★★★ ここまで追加 ★★★


// ============== P2P通信関連の処理 ==============

// PeerJSサーバーへの接続が確立したとき
peer.on("open", (id) => {
  myIdDisplay.textContent = id;
  shareBtn.style.display = 'inline-block'; // ★ ID取得後にシェアボタンを表示

  // ★★★ ここから追加 ★★★
  // シェアボタンのクリックイベント
  shareBtn.addEventListener('click', () => {
      const baseUrl = window.location.href.split('?')[0];
      const shareUrl = `${baseUrl}?connect_to=${id}`;

      navigator.clipboard.writeText(shareUrl).then(() => {
          statusDisplay.textContent = 'Invitation link copied!';
      }).catch(err => {
          console.error('Failed to copy: ', err);
          statusDisplay.textContent = 'Could not copy link.';
      });
  });
  // ★★★ ここまで追加 ★★★
});

// 相手からの接続を待つ処理
peer.on("connection", (conn) => {
  setupConnection(conn);
  myColor = 1; // 自分がホスト側なので、黒(先手)になる
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
  myColor = 2; // 自分がクライアント側なので、白(後手)になる
});

// 接続のセットアップ（共通処理）
function setupConnection(conn) {
  connection = conn;
  connection.on("open", () => {
    statusDisplay.textContent = `Connected to ${connection.peer}.`;
    opponentIdInput.disabled = true;
    connectBtn.disabled = true;
    shareBtn.disabled = true; // ★ 接続後はシェアボタンも無効化
    startGame();
  });

  connection.on("data", (data) => {
    handleReceivedData(data);
  });

  connection.on("close", () => {
    statusDisplay.textContent = "Connection lost.";
    gameStarted = false;
    opponentIdInput.disabled = false;
    connectBtn.disabled = false;
    shareBtn.disabled = false; // ★ 切断されたら再度有効化
    myColor = null;
  });
}

// （以降のゲームロジックは変更ありません）
// ... (昨日完成したコードのまま) ...
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
  gameStarted = false; // startGameが呼ばれるまでfalse
  drawBoard();
  updateTurnDisplay();
}

// ゲーム開始処理
function startGame() {
  initGame(); // 盤面をリセット
  gameStarted = true;
  statusDisplay.textContent = "Game started!";
  updateTurnDisplay(); // 役割表示を更新
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
  if (!gameStarted || !myColor) {
    turnDisplay.textContent = "Waiting for connection...";
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
  const directions = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1], [0, 1],
    [1, -1], [1, 0], [1, 1],
  ];

  let canFlipSomething = false;
  for (const [dx, dy] of directions) {
    let nx = x + dx;
    let ny = y + dy;

    if (
      nx >= 0 && nx < BOARD_SIZE &&
      ny >= 0 && ny < BOARD_SIZE &&
      board[ny][nx] === opponentColor
    ) {
      while (true) {
        nx += dx;
        ny += dy;
        if (
          nx < 0 || nx >= BOARD_SIZE ||
          ny < 0 || ny >= BOARD_SIZE ||
          board[ny][nx] === 0
        ) {
          break;
        }
        if (board[ny][nx] === color) {
          canFlipSomething = true;
          break;
        }
      }
    }
    if (canFlipSomething) break;
  }
  return canFlipSomething;
}

// 石をひっくり返す処理
function flipStones(x, y, color) {
  const opponentColor = color === 1 ? 2 : 1;
  const directions = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1], [0, 1],
    [1, -1], [1, 0], [1, 1],
  ];

  for (const [dx, dy] of directions) {
    let stonesToFlip = [];
    let nx = x + dx;
    let ny = y + dy;

    while (nx >= 0 && nx < BOARD_SIZE && ny >= 0 && ny < BOARD_SIZE) {
      if (board[ny][nx] === 0) break;
      if (board[ny][nx] === color) {
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
  const canBlackMove = canPlayerMove(1);
  const canWhiteMove = canPlayerMove(2);

  if (!canBlackMove && !canWhiteMove) {
    endGame();
  } else if (currentTurn === 1 && !canBlackMove) {
    currentTurn = 2;
    updateTurnDisplay();
    statusDisplay.textContent = "Black has no moves, passes turn.";
  } else if (currentTurn === 2 && !canWhiteMove) {
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
  sendData("reset", {});
  startGame(); // 自分も相手もリセット
  statusDisplay.textContent = "Game has been reset.";
});

// ============== 初期化処理 ==============
initGame();