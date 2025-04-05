// WebRTC configuration
const configuration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

// Variables
let peerConnection;
let ws;

// DOM elements
const remoteVideo = document.getElementById("remoteVideo");
const watchButton = document.getElementById("watchButton");
const stopButton = document.getElementById("stopButton");

// Event listeners
watchButton.addEventListener("click", startWatching);
stopButton.addEventListener("click", stopWatching);

// WebSocket setup
function setupWebSocket() {
  ws = new WebSocket("ws://localhost:8080");

  ws.onopen = () => {
    console.log("WebSocket connected");
    // Send a message to indicate this is a viewer
    ws.send(
      JSON.stringify({
        type: "viewer",
        message: "Viewer connected",
      })
    );
  };

  ws.onmessage = async (event) => {
    const message = JSON.parse(event.data);

    switch (message.type) {
      case "offer":
        await handleOffer(message);
        break;
      case "candidate":
        await handleCandidate(message);
        break;
    }
  };

  ws.onerror = (error) => {
    console.error("WebSocket error:", error);
  };

  ws.onclose = () => {
    console.log("WebSocket connection closed");
  };
}

// Start watching
async function startWatching() {
  try {
    peerConnection = new RTCPeerConnection(configuration);

    // Handle incoming stream
    peerConnection.ontrack = (event) => {
      remoteVideo.srcObject = event.streams[0];
    };

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        ws.send(
          JSON.stringify({
            type: "candidate",
            candidate: event.candidate,
          })
        );
      }
    };

    setupWebSocket();
    watchButton.disabled = true;
    stopButton.disabled = false;
  } catch (error) {
    console.error("Error starting to watch:", error);
  }
}

// Handle incoming offer
async function handleOffer(message) {
  try {
    await peerConnection.setRemoteDescription(message.offer);
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    ws.send(
      JSON.stringify({
        type: "answer",
        answer: answer,
      })
    );
  } catch (error) {
    console.error("Error handling offer:", error);
  }
}

// Handle incoming ICE candidate
async function handleCandidate(message) {
  try {
    if (peerConnection) {
      await peerConnection.addIceCandidate(message.candidate);
    }
  } catch (error) {
    console.error("Error handling ICE candidate:", error);
  }
}

// Stop watching
function stopWatching() {
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  if (ws) {
    ws.close();
  }
  remoteVideo.srcObject = null;
  watchButton.disabled = false;
  stopButton.disabled = true;
}
