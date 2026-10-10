let username;
let remoteUser = null;
let peerConnection = null;
let sendChannel = null;
let receiveChannel = null;

const msgInput = document.querySelector("#msg-input");
const chatTextArea = document.querySelector(".chat-text-area");
const msgSendBtn = document.querySelector(".msg-send-button");
const nextChatBtn = document.querySelector(".next-chat");

const servers = {
  iceServers: [
    {
      urls: [
        "stun:stun1.l.google.com:19302",
        "stun:stun2.l.google.com:19302",
      ],
    },
  ],
};

// Stage 4: Text Chat has its own Socket.IO matchmaking pool.
// It no longer uses MongoDB /get-remote-users or /fetch-next-user to find partners.
const socket = io.connect();
let identityReady = false;
let socketReady = false;
let registeredForTextChat = false;

function registerForTextChat() {
  if (!identityReady || !socketReady || registeredForTextChat) return;

  registeredForTextChat = true;
  console.log("Registering for Text Chat matchmaking:", username);
  socket.emit("userconnect", {
    displayName: username,
    chatMode: "text",
  });
}

socket.on("connect", () => {
  socketReady = true;
  registeredForTextChat = false;
  registerForTextChat();
});

function initializeIdentity() {
  const gnomeID = localStorage.getItem("gnomeID");

  if (gnomeID) {
    $.ajax({
      url: "/new-user-update/" + gnomeID,
      type: "PUT",
      success: function (response) {
        const newGnomeID = response.gnomeID;
        if (newGnomeID) {
          localStorage.setItem("gnomeID", newGnomeID);
          username = newGnomeID;
        } else {
          username = gnomeID;
        }
        identityReady = true;
        registerForTextChat();
      },
      error: function (error) {
        console.error("Unable to restore Text Chat identity:", error);
      },
    });
    return;
  }

  $.ajax({
    type: "POST",
    url: "/api/users",
    data: "demo data",
    success: function (response) {
      localStorage.setItem("gnomeID", response);
      username = response;
      identityReady = true;
      registerForTextChat();
    },
    error: function (error) {
      console.error("Unable to create Text Chat identity:", error);
    },
  });
}

function appendMessage(label, message, labelColor) {
  const row = document.createElement("div");
  row.style.marginTop = "2px";
  row.style.marginBottom = "2px";

  const labelElement = document.createElement("b");
  labelElement.style.color = labelColor;
  labelElement.textContent = label + ": ";

  row.appendChild(labelElement);
  row.appendChild(document.createTextNode(message));
  chatTextArea.appendChild(row);
  chatTextArea.scrollTop = chatTextArea.scrollHeight;
}

function appendSystemMessage(message) {
  const row = document.createElement("div");
  row.style.marginTop = "4px";
  row.style.marginBottom = "4px";
  row.textContent = message;
  chatTextArea.appendChild(row);
}

function clearConversation() {
  chatTextArea.innerHTML = "";
  msgInput.value = "";
}

function cleanupPeerConnection() {
  if (sendChannel) {
    try { sendChannel.close(); } catch (error) {}
    sendChannel = null;
  }
  if (receiveChannel) {
    try { receiveChannel.close(); } catch (error) {}
    receiveChannel = null;
  }
  if (peerConnection) {
    try { peerConnection.close(); } catch (error) {}
    peerConnection = null;
  }
  remoteUser = null;
}

function createPeerConnection() {
  cleanupPeerConnection();
  peerConnection = new RTCPeerConnection(servers);

  peerConnection.onicecandidate = (event) => {
    if (event.candidate && remoteUser) {
      socket.emit("candidateSentToUser", {
        username,
        remoteUser,
        iceCandidateData: event.candidate,
      });
    }
  };

  sendChannel = peerConnection.createDataChannel("sendDataChannel");
  sendChannel.onopen = () => console.log("Text Chat send channel open");
  sendChannel.onclose = () => console.log("Text Chat send channel closed");

  peerConnection.ondatachannel = (event) => {
    receiveChannel = event.channel;
    receiveChannel.onmessage = (messageEvent) => {
      appendMessage("Stranger", messageEvent.data, "rgba(198, 0, 198, 1)");
    };
  };
}

async function createOffer(remoteUserId) {
  remoteUser = remoteUserId;
  createPeerConnection();
  // cleanupPeerConnection clears remoteUser, so restore it for signaling.
  remoteUser = remoteUserId;

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);

  socket.emit("offerSentToRemote", {
    username,
    remoteUser,
    offer: peerConnection.localDescription,
  });
}

async function createAnswer(data) {
  remoteUser = data.username;
  const partnerId = remoteUser;
  createPeerConnection();
  remoteUser = partnerId;

  await peerConnection.setRemoteDescription(data.offer);
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);

  socket.emit("answerSentToUser1", {
    answer: peerConnection.localDescription,
    sender: data.remoteUser,
    receiver: data.username,
  });

  nextChatBtn.style.pointerEvents = "auto";
  appendSystemMessage("You are now chatting with a random stranger.");
}

async function addAnswer(data) {
  if (peerConnection && !peerConnection.currentRemoteDescription) {
    await peerConnection.setRemoteDescription(data.answer);
  }
  nextChatBtn.style.pointerEvents = "auto";
  appendSystemMessage("You are now chatting with a random stranger.");
}

function sendData() {
  const message = msgInput.value.trim();
  if (!message) return;

  let channel = null;
  if (sendChannel && sendChannel.readyState === "open") channel = sendChannel;
  else if (receiveChannel && receiveChannel.readyState === "open") channel = receiveChannel;

  if (!channel) {
    console.log("Text message not sent: data channel is not open yet.");
    return;
  }

  channel.send(message);
  appendMessage("You", message, "rgba(5, 126, 37, 1)");
  msgInput.value = "";
}

socket.on("waitingForUser", () => {
  nextChatBtn.style.pointerEvents = "none";
  if (!remoteUser) {
    clearConversation();
    appendSystemMessage("Looking for a stranger...");
  }
});

socket.on("matchedWithUser", (data) => {
  clearConversation();
  appendSystemMessage("Found a stranger. Connecting...");
  createOffer(data.remoteUser).catch((error) => {
    console.error("Unable to create Text Chat offer:", error);
  });
});

socket.on("ReceiveOffer", (data) => {
  clearConversation();
  createAnswer(data).catch((error) => {
    console.error("Unable to answer Text Chat offer:", error);
  });
});

socket.on("ReceiveAnswer", (data) => {
  addAnswer(data).catch((error) => {
    console.error("Unable to apply Text Chat answer:", error);
  });
});

socket.on("candidateReceiver", async (data) => {
  if (!peerConnection) return;
  try {
    await peerConnection.addIceCandidate(data.iceCandidateData);
  } catch (error) {
    console.error("Unable to add Text Chat ICE candidate:", error);
  }
});

socket.on("partnerRequestedNext", () => {
  cleanupPeerConnection();
  clearConversation();
  appendSystemMessage("Stranger disconnected. Looking for someone new...");
  nextChatBtn.style.pointerEvents = "none";
});

socket.on("partnerDisconnected", () => {
  cleanupPeerConnection();
  clearConversation();
  appendSystemMessage("Stranger disconnected. Looking for someone new...");
  nextChatBtn.style.pointerEvents = "none";
});

nextChatBtn.addEventListener("click", () => {
  if (!remoteUser) return;
  cleanupPeerConnection();
  clearConversation();
  appendSystemMessage("Looking for a new stranger...");
  nextChatBtn.style.pointerEvents = "none";
  socket.emit("nextChat");
});

msgSendBtn.addEventListener("click", sendData);
msgInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    sendData();
  }
});

initializeIdentity();
