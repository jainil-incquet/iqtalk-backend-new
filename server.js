const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);

// Connect and Configure Socket.io
const io = new Server(server, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST"]
  }
});

app.use(express.static(path.join(__dirname, "public")));

const users = {}; 
const rooms = {}; 

function broadcastStateUpdate() {
  io.emit("state-broadcast", {
    users,
    rooms,
    lobbyCount: Object.keys(users).length
  });
}

io.on("connection", (socket) => {
  console.log(`[+] Socket Connected: ${socket.id}`);
  users[socket.id] = { name: "Anonymous", roomId: "Lobby" };

  socket.on("sync-profile", ({ name }) => {
    if (users[socket.id]) {
      users[socket.id].name = name;
      broadcastStateUpdate();
    }
  });

  socket.on("cmd-create-room", ({ id, name }) => {
    if (!rooms[id]) rooms[id] = [];
    broadcastStateUpdate();
  });

  socket.on("join-room", ({ roomId }) => {
    const oldRoomId = users[socket.id].roomId;
    if (oldRoomId) {
      socket.leave(oldRoomId);
      if (rooms[oldRoomId]) {
        rooms[oldRoomId] = rooms[oldRoomId].filter(id => id !== socket.id);
        socket.to(oldRoomId).emit("peer-left-room", { peerId: socket.id });
        if (rooms[oldRoomId].length === 0 && oldRoomId !== "Lobby") {
          delete rooms[oldRoomId];
        }
      }
    }

    socket.join(roomId);
    users[socket.id].roomId = roomId;

    if (!rooms[roomId]) rooms[roomId] = [];
    const peersInRoom = rooms[roomId].filter(id => id !== socket.id);
    
    socket.emit("all-peers-in-room", peersInRoom.map(pId => ({
      id: pId,
      name: users[pId]?.name || "Anonymous"
    })));

    rooms[roomId].push(socket.id);
    socket.to(roomId).emit("peer-joined-room", { peerId: socket.id, name: users[socket.id].name });
    broadcastStateUpdate();
  });

  socket.on("send-webrtc-offer", ({ targetPeerId, sdp }) => {
    io.to(targetPeerId).emit("receive-webrtc-offer", { senderPeerId: socket.id, sdp });
  });

  socket.on("send-webrtc-answer", ({ targetPeerId, sdp }) => {
    io.to(targetPeerId).emit("receive-webrtc-answer", { senderPeerId: socket.id, sdp });
  });

  socket.on("send-ice-candidate", ({ targetPeerId, candidate }) => {
    io.to(targetPeerId).emit("receive-ice-candidate", { senderPeerId: socket.id, candidate });
  });

  socket.on("disconnect", () => {
    console.log(`[-] Socket Disconnected: ${socket.id}`);
    const roomId = users[socket.id]?.roomId;
    if (roomId && rooms[roomId]) {
      rooms[roomId] = rooms[roomId].filter(id => id !== socket.id);
      socket.to(roomId).emit("peer-left-room", { peerId: socket.id });
      if (rooms[roomId].length === 0 && roomId !== "Lobby") {
        delete rooms[roomId];
      }
    }
    delete users[socket.id];
    broadcastStateUpdate();
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`[✓] Signaling Server running on port ${PORT}`);
});