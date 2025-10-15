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
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1],           [0, 1],
  [1, -1], [1, 0], [1, 1],
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

let connection = null; // 相手との接続オブジェクト

// ============== PeerJSの接続設定 ==============
const peer = new Peer({
  host: "osero-p2p-render.onrender.com",
  secure: true,
  path: "/myapp",
});

// ========================================================
// 初期化処理
// ========================================================

/**
 * ページ読み込み時の初期化
 */
function initialize() {
  initializePeerEvents();
  initializeEventListeners();
  initBoard();
  checkUrlParams();
}

/**
 * ページのURLパラメータをチェックして招待IDを自動入力
 */
function checkUrlParams() {
  const params = new URLSearchParams(window.location.search);
  const connectToId = params.get('connect_to');
  if (connectToId) {
    domElements.opponentIdInput.value = connectToId;
    domElements.statusDisplay.textContent = `招待されています！ '接続' ボタンを押してください。`;
  }
}

// ========================================================
// P2P通信関連
// ========================================================

/**
 * PeerJS関連のイベントハンドラを設定
 */
function initializePeerEvents() {
  peer.on("open", (id) => {
    domElements.myIdDisplay.textContent = id;
    updateUI("disconnected");
  });

  peer.on("connection", (conn) => {
    setupConnection(conn);
    gameState.myColor = COLORS.BLACK; // ホスト側が黒（先手）
  });

  peer.on("error", (err) => {
    console.error("PeerJS error:", err);
    alert("接続エラーが発生しました。ページをリロードしてください。");
  });
}

/**
 * 接続を確立し、イベントハンドラを設定する（共通処理）
 * @param {DataConnection} conn - PeerJSのコネクションオブジェクト
 */
function setupConnection(conn) {
  connection = conn;
  connection.on("open", () => {
    startGame();
    updateUI("connected");
  });
  connection.on("data", handleReceivedData);
  connection.on("close", () => {
    alert("接続が切れました。");
    resetToInitialState();
  });
}

/**
 * 受信したデータを処理する
 * @param {object} data - 受信したデータ {type, data}
 */
function handleReceivedData(data) {
  switch (data.type) {
    case MESSAGE_TYPES.MOVE:
      const { x, y, color } = data.data;
      placeStone(x, y, color, false);
      break;
    case MESSAGE_TYPES.RESET:
      // ★修正点: 相手からのリセット要求でもstartGameを実行
      startGame();
      domElements.statusDisplay.textContent = "相手がゲームをリセットしました。";
      break;
  }
}

/**
 * データを相手に送信する
 * @param {string} type - メッセージのタイプ
 * @param {object} data - 送信するデータ
 */
function sendData(type, data) {
  if (connection && connection.open) {
    connection.send({ type, data });
  }
}

/**
 * 全ての状態をアプリの初期起動時に戻す
 */
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

/**
 * ゲームを開始する
 */
function startGame() {
  initBoard();
  gameState.gameStarted = true;
  domElements.statusDisplay.textContent = "ゲーム開始！";
}

/**
 * 盤面とゲームの状態を初期化する
 */
function initBoard() {
  gameState.board = Array(BOARD_SIZE).fill(0).map(() => Array(BOARD_SIZE).fill(COLORS.EMPTY));
  gameState.board[3][3] = COLORS.WHITE;
  gameState.board[3][4] = COLORS.BLACK;
  gameState.board[4][3] = COLORS.BLACK;
  gameState.board[4][4] = COLORS.WHITE;
  gameState.currentTurn = COLORS.BLACK;
  drawBoard();
  updateTurnDisplay();
}

/**
 * 石を置く処理
 * @param {number} x - X座標
 * @param {number} y - Y座標
 * @param {number} color - 石の色
 * @param {boolean} isMyMove - 自分の手番かどうか
 */
function placeStone(x, y, color, isMyMove) {
  if (gameState.board[y][x] !== COLORS.EMPTY) return;

  gameState.board[y][x] = color;
  flipStones(x, y, color);
  drawBoard();

  gameState.currentTurn = (color === COLORS.BLACK) ? COLORS.WHITE : COLORS.BLACK;
  updateTurnDisplay();

  if (isMyMove) {
    sendData(MESSAGE_TYPES.MOVE, { x, y, color });
  }

  checkGameEnd();
}

/**
 * 石を置けるか判定する
 * @param {number} x
 * @param {number} y
 * @param {number} color
 * @returns {boolean}
 */
function isValidMove(x, y, color) {
  if (gameState.board[y][x] !== COLORS.EMPTY) return false;

  const opponentColor = (color === COLORS.BLACK) ? COLORS.WHITE : COLORS.BLACK;

  for (const [dx, dy] of DIRECTIONS) {
    let nx = x + dx;
    let ny = y + dy;
    let hasOpponentStoneBetween = false;

    while (nx >= 0 && nx < BOARD_SIZE && ny >= 0 && ny < BOARD_SIZE) {
      if (gameState.board[ny][nx] === opponentColor) {
        hasOpponentStoneBetween = true;
      } else if (gameState.board[ny][nx] === color) {
        if (hasOpponentStoneBetween) return true;
        break;
      } else { // EMPTY
        break;
      }
      nx += dx;
      ny += dy;
    }
  }
  return false;
}

/**
 * 石をひっくり返す
 * @param {number} x
 * @param {number} y
 * @param {number} color
 */
function flipStones(x, y, color) {
  const opponentColor = (color === COLORS.BLACK) ? COLORS.WHITE : COLORS.BLACK;

  for (const [dx, dy] of DIRECTIONS) {
    const stonesToFlip = [];
    let nx = x + dx;
    let ny = y + dy;

    while (nx >= 0 && nx < BOARD_SIZE && ny >= 0 && ny < BOARD_SIZE) {
      if (gameState.board[ny][nx] === COLORS.EMPTY) break;
      if (gameState.board[ny][nx] === color) {
        stonesToFlip.forEach(([fx, fy]) => {
          gameState.board[fy][fx] = color;
        });
        break;
      }
      stonesToFlip.push([nx, ny]);
      nx += dx;
      ny += dy;
    }
  }
}

/**
 * 特定の色のプレイヤーが動けるかチェック
 * @param {number} color
 * @returns {boolean}
 */
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

/**
 * ゲーム終了をチェックする
 */
function checkGameEnd() {
  const canBlackMove = canPlayerMove(COLORS.BLACK);
  const canWhiteMove = canPlayerMove(COLORS.WHITE);

  if (!canBlackMove && !canWhiteMove) {
    endGame();
    return;
  }
  
  const currentPlayerCanMove = (gameState.currentTurn === COLORS.BLACK) ? canBlackMove : canWhiteMove;

  if (!currentPlayerCanMove) {
    domElements.statusDisplay.textContent = `${gameState.currentTurn === COLORS.BLACK ? '黒' : '白'}は置ける場所がありません。パスします。`;
    gameState.currentTurn = (gameState.currentTurn === COLORS.BLACK) ? COLORS.WHITE : COLORS.BLACK;
    updateTurnDisplay();
  }
}

/**
 * ゲームを終了し、結果を表示する
 */
function endGame() {
  const counts = gameState.board.flat().reduce((acc, color) => {
    if (color === COLORS.BLACK) acc.black++;
    else if (color === COLORS.WHITE) acc.white++;
    return acc;
  }, { black: 0, white: 0 });

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

/**
 * ゲームの状態に応じてUI要素（ボタンなど）の表示を更新する
 * @param {'disconnected' | 'connected'} state
 */
function updateUI(state) {
  if (state === "disconnected") {
    domElements.opponentIdInput.disabled = false;
    domElements.connectBtn.disabled = false;
    domElements.shareBtn.style.display = 'inline-block';
    domElements.resetBtn.style.display = 'none'; // 未接続時はリセット不要
  } else if (state === "connected") {
    domElements.opponentIdInput.disabled = true;
    domElements.connectBtn.disabled = true;
    domElements.shareBtn.style.display = 'none';
    domElements.resetBtn.style.display = 'inline-block';
  }
}

/**
 * 盤面を描画する
 */
function drawBoard() {
  domElements.board.innerHTML = "";
  for (let y = 0; y < BOARD_SIZE; y++) {
    const tr = document.createElement("tr");
    for (let x = 0; x < BOARD_SIZE; x++) {
      const td = document.createElement("td");
      td.dataset.x = x;
      td.dataset.y = y;
      const color = gameState.board[y][x];
      if (color !== COLORS.EMPTY) {
        const stone = document.createElement("div");
        stone.className = "stone " + (color === COLORS.BLACK ? "black" : "white");
        td.appendChild(stone);
      }
      tr.appendChild(td);
    }
    domElements.board.appendChild(tr);
  }
}

/**
 * 手番表示を更新する
 */
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

/**
 * DOM要素のイベントリスナーをまとめて設定
 */
function initializeEventListeners() {
  // 接続ボタン
  domElements.connectBtn.addEventListener("click", () => {
    const opponentId = domElements.opponentIdInput.value;
    if (!opponentId) {
      alert("相手のIDを入力してください。");
      return;
    }
    const conn = peer.connect(opponentId);
    setupConnection(conn);
    gameState.myColor = COLORS.WHITE; // クライアント側が白（後手）
  });

  // 招待リンク共有ボタン
  domElements.shareBtn.addEventListener('click', () => {
    const myId = domElements.myIdDisplay.textContent;
    if (!myId) return;
    const baseUrl = window.location.href.split('?')[0];
    const shareUrl = `${baseUrl}?connect_to=${myId}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      domElements.statusDisplay.textContent = '招待リンクをコピーしました！';
    }).catch(err => {
      console.error('Failed to copy: ', err);
      domElements.statusDisplay.textContent = 'リンクのコピーに失敗しました。';
    });
  });

  // 盤面クリック
  domElements.board.addEventListener("click", (e) => {
    if (!gameState.gameStarted || gameState.currentTurn !== gameState.myColor) return;

    const td = e.target.closest("td");
    if (!td) return;

    const x = parseInt(td.dataset.x);
    const y = parseInt(td.dataset.y);

    if (isValidMove(x, y, gameState.myColor)) {
      placeStone(x, y, gameState.myColor, true);
    }
  });
  
  // リセットボタン
  domElements.resetBtn.addEventListener("click", () => {
    if (!connection) return;
    // ★修正点: 相手にリセットを通知し、自分もゲームを開始する
    sendData(MESSAGE_TYPES.RESET, {});
    startGame();
    domElements.statusDisplay.textContent = "ゲームをリセットしました。";
  });
}

// ============== アプリケーションの実行開始 ==============
initialize();