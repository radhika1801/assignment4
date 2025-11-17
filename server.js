import express from "express";
import http from "http";
import { Server } from "socket.io";

// Use the port Render provides, or default to 3000 for local dev
const PORT = process.env.PORT || 3000;

const app = express();
const server = http.createServer(app);

// Enable CORS so your GH Pages or React app can connect
const io = new Server(server, {
  cors: {
    origin: "*",             // you can restrict this later
    methods: ["GET", "POST"]
  }
});

app.use(express.static("docs"));

io.on("connection", (socket) => {
  console.log("New user connected:", socket.id);

  socket.on("draw", (data) => {
    // rebroadcast to everyone except the sender
    socket.broadcast.emit("draw", data);
  });

  // when a client clears their canvas, notify other clients to clear as well
  socket.on("clear", () => {
    // rebroadcast clear to everyone except the sender
    socket.broadcast.emit("clear");
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

server.listen(PORT, "0.0.0.0", () => console.log(`Server running on port ${3000}`));
