// WebRTC configuration
const configuration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

// Variables
let localStream;
let peerConnections = new Map(); // Store multiple peer connections for each viewer
let ws;

// DOM elements
const localVideo = document.getElementById("localVideo");
const startButton = document.getElementById("startButton");
const callButton = document.getElementById("callButton");
const hangupButton = document.getElementById("hangupButton");

// Event listeners
startButton.addEventListener("click", startStream);
callButton.addEventListener("click", startBroadcasting);
hangupButton.addEventListener("click", stopBroadcasting);

// WebSocket setup
function setupWebSocket() {
  ws = new WebSocket("ws://localhost:8080");

  ws.onopen = () => {
    console.log("WebSocket connected");
    // Identify as broadcaster
    ws.send(
      JSON.stringify({
        type: "broadcaster",
        message: "Broadcaster connected",
      })
    );
  };

  ws.onmessage = async (event) => {
    const message = JSON.parse(event.data);

    switch (message.type) {
      case "viewer_connected":
        createPeerConnection();
        break;
      case "answer":
        await handleAnswer(message);
        break;
      case "candidate":
        await handleCandidate(message);
        break;
    }
  };

  ws.onerror = (error) => {
    console.error("WebSocket error:", error);
  };
}

// Start local stream
async function startStream() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true,
    });
    localVideo.srcObject = localStream;
    startButton.disabled = true;
    callButton.disabled = false;
    setupWebSocket();
  } catch (error) {
    console.error("Error accessing media devices:", error);
  }
}

// Create peer connection for new viewer
async function createPeerConnection() {
  try {
    const peerConnection = new RTCPeerConnection(configuration);

    // Add local stream to peer connection
    localStream.getTracks().forEach((track) => {
      peerConnection.addTrack(track, localStream);
    });

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

    // Create and send offer
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    ws.send(
      JSON.stringify({
        type: "offer",
        offer: offer,
      })
    );

    // Store the peer connection
    const connectionId = Date.now().toString();
    peerConnections.set(connectionId, peerConnection);
  } catch (error) {
    console.error("Error creating peer connection:", error);
  }
}

// Start broadcasting
function startBroadcasting() {
  callButton.disabled = true;
  hangupButton.disabled = false;
}

// Handle incoming answer from viewer
async function handleAnswer(message) {
  try {
    // Find the most recent peer connection
    const connectionId = Array.from(peerConnections.keys()).pop();
    const peerConnection = peerConnections.get(connectionId);

    if (peerConnection) {
      await peerConnection.setRemoteDescription(message.answer);
    }
  } catch (error) {
    console.error("Error handling answer:", error);
  }
}

// Handle incoming ICE candidate
async function handleCandidate(message) {
  try {
    // Apply candidate to all peer connections
    for (const peerConnection of peerConnections.values()) {
      await peerConnection.addIceCandidate(message.candidate);
    }
  } catch (error) {
    console.error("Error handling ICE candidate:", error);
  }
}

// Stop broadcasting
function stopBroadcasting() {
  // Close all peer connections
  for (const peerConnection of peerConnections.values()) {
    peerConnection.close();
  }
  peerConnections.clear();

  // Stop local stream
  if (localStream) {
    localStream.getTracks().forEach((track) => track.stop());
    localStream = null;
  }

  localVideo.srcObject = null;

  if (ws) {
    ws.close();
  }

  callButton.disabled = false;
  hangupButton.disabled = true;
  startButton.disabled = false;
}
