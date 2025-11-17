const socket = io();
const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");

let drawing = false;
let lastX, lastY;

//adding color picker functionality
const colorPicker = document.getElementById("colorPicker");
let currentColor = colorPicker.value;

colorPicker.addEventListener("input", (e) => {
  currentColor = e.target.value;
});

//adding brush stroke size functionality
const brushSize = document.getElementById("brushSize");
let currentLineWidth = brushSize.value;

brushSize.addEventListener("input", (e) => {
  currentLineWidth = e.target.value;
});

canvas.addEventListener("mousedown", (e) => {
  drawing = true;
  [lastX, lastY] = [e.offsetX, e.offsetY];
});

canvas.addEventListener("mouseup", () => (drawing = false));

canvas.addEventListener("mousemove", (e) => {
  if (!drawing) return;
  const [x, y] = [e.offsetX, e.offsetY];
  drawLine(lastX, lastY, x, y, true, currentColor);
  [lastX, lastY] = [x, y];
});

function drawLine(x1, y1, x2, y2, emit, color = currentColor) {
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = currentLineWidth;
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  //socket emits our draing data as a JSON object
  if (emit) socket.emit("draw", { x1, y1, x2, y2, color });
}

//when socket receives "draw" event, it passes the JSON data to our drawLine function
socket.on("draw", ({ x1, y1, x2, y2, color }) => drawLine(x1, y1, x2, y2, false, color));

const clearButton = document.getElementById("clear");
clearButton.addEventListener("click", () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  socket.emit("clear");
});

socket.on("clear", () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
});




