const WebSocket = require("ws");

const wss = new WebSocket.Server({ port: 8080 });
const viewers = new Set();
let broadcaster = null;

console.log("WebSocket Signaling Server running on port 8080");

wss.on("connection", (ws) => {
  console.log("New client connected");

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message.toString());

      if (data.type === "viewer") {
        viewers.add(ws);
        console.log("Viewer connected");
        // If there's a broadcaster, send them the new viewer
        if (broadcaster) {
          broadcaster.send(
            JSON.stringify({
              type: "viewer_connected",
            })
          );
        }
      } else if (data.type === "broadcaster") {
        broadcaster = ws;
        console.log("Broadcaster connected");
      } else if (data.type === "offer") {
        // Broadcast offer to all viewers
        viewers.forEach((viewer) => {
          if (viewer.readyState === WebSocket.OPEN) {
            viewer.send(message.toString());
          }
        });
      } else if (data.type === "answer") {
        // Send answer back to broadcaster
        if (broadcaster && broadcaster.readyState === WebSocket.OPEN) {
          broadcaster.send(message.toString());
        }
      } else if (data.type === "candidate") {
        // Send ICE candidate to all peers
        if (ws === broadcaster) {
          viewers.forEach((viewer) => {
            if (viewer.readyState === WebSocket.OPEN) {
              viewer.send(message.toString());
            }
          });
        } else if (broadcaster && broadcaster.readyState === WebSocket.OPEN) {
          broadcaster.send(message.toString());
        }
      }
    } catch (error) {
      console.error("Error processing message:", error);
    }
  });

  ws.on("close", () => {
    if (ws === broadcaster) {
      broadcaster = null;
      console.log("Broadcaster disconnected");
    } else {
      viewers.delete(ws);
      console.log("Viewer disconnected");
    }
  });

  ws.on("error", (error) => {
    console.error("WebSocket error:", error);
    if (ws === broadcaster) {
      broadcaster = null;
    } else {
      viewers.delete(ws);
    }
  });
});
