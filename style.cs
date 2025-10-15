body {
    font-family: sans-serif;
    display: flex;
    flex-direction: column;
    align-items: center;
    background-color: #f0f0f0;
}

.connection-area {
    display: flex;
    gap: 20px;
    align-items: center;
    margin-bottom: 15px;
    padding: 10px;
    background-color: white;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

#my-id {
    color: #007bff;
    background-color: #e9f5ff;
    padding: 2px 6px;
    border-radius: 4px;
}

input, button {
    padding: 8px;
    border-radius: 4px;
    border: 1px solid #ccc;
}

button {
    cursor: pointer;
    background-color: #007bff;
    color: white;
    border: none;
}

button:hover {
    background-color: #0056b3;
}

#status-display, #turn-display {
    margin-bottom: 10px;
    font-size: 1.1em;
    font-weight: bold;
}

#board {
    border-collapse: collapse;
    background-color: #008000; /* 緑色の盤面 */
    border: 2px solid #333;
}

td {
    width: 50px;
    height: 50px;
    border: 1px solid #333;
    text-align: center;
    vertical-align: middle;
    cursor: pointer;
}

.stone {
    width: 80%;
    height: 80%;
    border-radius: 50%;
    margin: 0 auto;
}

.black {
    background-color: #000;
}

.white {
    background-color: #fff;
}