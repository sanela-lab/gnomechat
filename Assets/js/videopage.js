// TODO: Make sure 'next' works.  something to do with icecandidate not being sent because
// the ready state is not opened and doesn't allow the offer receiver to add their answer to localdescr

// prevent video chat ppl from being able to talk to text chat ppl. update schema
// handle error when not connected to nyone but click send  or skip button.

// For later:
// splashpage: gender select
// udate schema for gender matching and textpage vs videopage matching.
// user account ?
// canvas ?
// stranger to friend ?

/**
 * BASICS
 * - user-1 sends an offer to user-2.
 * -- user-2 sets the offer to the localDescription.
 * -- user-2 creates an answer and sends it to user-1.
 * ---- user-1 receives the answer and sets it to the remoteDescription.
 * ----- exchange ICE candidate (contains users' network information). Browsers must know each users' network information.
 */

//HINT The local user is identified using their username, AKA their 'gnomeID' (in localstorage), AKA their '_id' (in mongoDB).

let localStream;
let username;
let remoteUser;
let url = new URL(window.location.href);
let peerConnection;
let remoteStream;
let sendChannel;
let receiveChannel;
var msgInput = document.querySelector("#msg-input");
var chatTextArea = document.querySelector(".chat-text-area");
var msgSendBtn = document.querySelector(".msg-send-button");

async function enforceTOSAndPerms() {
  document.getElementById("overlay").style.display = "block";
}
enforceTOSAndPerms();

async function handleAgree() {
  document.getElementById("tosModal").style.display = "none";
  getGnomeIDThenRunUser();
}

function handleDisagree() {
  window.location.href = "http://localhost:3000/";
}

function getGnomeIDThenRunUser() {
  //console.log("Attempting to retrieve gnomeID from localstorage...");
  var gnomeID = localStorage.getItem("gnomeID");
  // if found in localstorage + DB, update the user. if found in LS but not DB, will return newGnomeID.
  if (gnomeID) {
    $.ajax({
      url: "/new-user-update/" + gnomeID,
      type: "PUT",
      success: function (response) {
        const newGnomeID = response.gnomeID;
        // console.log(
        //   `gnomeID exists in localstorage: ${gnomeID}, if gnomeID exists in DB, newGnomeID will be undefined: `,
        //   newGnomeID
        // );
        if (newGnomeID) {
          localStorage.removeItem("gnomeID");
          localStorage.setItem("gnomeID", newGnomeID);
          username = newGnomeID;
          console.log("1. Here username is: ", username);
          runUser();
        } else {
          username = gnomeID;
          console.log("2. Here username is: ", username);
          runUser();
        }
      },
    });
  } else {
    var postData = "demo data";
    $.ajax({
      type: "POST",
      url: "/api/users",
      data: postData,
      // response will contain the _id returned by DB.
      success: function (response) {
        console.log("3. Here username is: ", response);
        localStorage.setItem("gnomeID", response);
        username = response;
        runUser();
      },
      error: function (error) {
        // console.log("Error retrieving or setting gnomeID:", error);
      },
    });
  }
}

/**
 *
 *
 * Stage 3 note: the OLD video matchmaking responsibilities below are OBSOLETE.
 * They are preserved here as comments for reference and are NOT executed:
 *
 * OBSOLETE (pre-Stage-1):
 * 1. Get user's media permissions and set them on the local video element.
 * 2. POST to /get-remote-users so MongoDB/controller.remoteUserFind chooses a partner.
 * 3. Validate that returned MongoDB user and assign remoteUser.
 * 4. Immediately call createOffer() for that database-selected user.
 *
 * CURRENT behavior: runUser() gets media permission, registers this browser with
 * Socket.IO, and waits for server.js to emit matchedWithUser. The listener then
 * assigns remoteUser and calls the existing createOffer() WebRTC code.
 *
 *
 */
async function runUser() {
  // Initial matchmaking is now owned by Socket.IO. MongoDB still provides
  // the anonymous gnomeID, but it no longer selects a real-time chat partner.
  // This removes the race where multiple browsers could select the same
  // status=0 MongoDB user before that user's status changed to 1.
  await getUserMediaPermissions();

  /**
   *
   *
   *
   *
      + socket.on("connect") uses the Socket.IO library to establish a bidirectional communication channel for 2-way realtime communication.
      
      - It creates the channel using io.connect() which is referenced as 'socket'.

      + It confirms that the channel stored in 'socket' is connected by checking if the .connected boolean property is true.

      + It emits a 'userconnect' event to the server, the new user's username is included in the emission. This announces the
        user to the rest of the chatroom. The 'userconnect' event adds the user to the 'userConnection' array (located in server.js).
   *
   *
   *
   */
  // console.log("After init().");
  let socket = io.connect();
  // Creates channel.
  socket.on("connect", () => {
    //console.log("socket.on'connect' > ");
    // It checks if the socket is connected before proceeding. The socket.connected property is true when the socket is connected.
    if (socket.connected) {
      // console.log("socket.on'connect' > (socket.connected) true ");
      // Emit 'userconnect' which adds user to userConnection arr.
      // console.log(
      //   "From socket.on'connect' > Emitting 'userconnect' for: ",
      //   username
      // );
      socket.emit("userconnect", {
        displayName: username,
        chatMode: "video",
      });
    }
  });

  // The server either leaves this browser waiting or assigns it exactly one
  // partner. Only the newly-arrived matched browser creates the WebRTC offer.
  socket.on("waitingForUser", function () {
    console.log("[MATCH] Waiting for another user...");
  });

  socket.on("matchedWithUser", function (data) {
    if (!data || !data.remoteUser || data.remoteUser === username) {
      return;
    }

    console.log("[MATCH] Matched with user:", data.remoteUser);
    remoteUser = data.remoteUser;
    createOffer(remoteUser);
  });
  let servers = {
    iceServers: [
      {
        urls: [
          "stun:stun1.1.google.com:19302",
          "stun:stun2.1.google.com:19302",
        ],
      },
    ],
  };

  /**
   *
   *
    Role of socket.io and RTCPeerConnection: 
    WebRTC does not specify a signaling protocol, so developers often use WebSocket (or other channels like HTTP) for signaling purposes. 
    socket.io is a common library for implementing WebSocket communication, and the io.connect is used to establish a connection to the WebSocket server.

    RTCPeerConnection:
    The RTCPeerConnection object is responsible for setting up and managing the peer-to-peer connection between browsers. It handles the actual exchange of 
    audio, video, and data streams directly between peers.

    Peer-to-Peer Communication: Once the signaling phase (handled by WebSocket) is complete, and peers have exchanged the necessary information, the 
    RTCPeerConnection takes over for direct communication. It manages the negotiation of media capabilities, establishes secure connections, and handles the 
    flow of real-time data between the peers.

    ICE and NAT Traversal: The RTCPeerConnection object also manages ICE (Interactive Connectivity Establishment) to handle issues related to NAT traversal, 
    enabling communication between devices behind different network configurations.
    
    In short, the WebSocket serves as a signaling channel for coordinating the setup of the peer connection, exchanging necessary information, and 
    handling session management. The RTCPeerConnection is responsible for the actual peer-to-peer communication once the signaling phase is complete. 
    Together, they form a comprehensive solution for establishing and maintaining real-time communication between peers in a WebRTC application.

   *
   */

  /**
   +-+-+ createPeerConnection() function +-+-+-+
    
    Handles local stream: 
    It iterates through each track in the localStream and adds them to the RTCPeerConnection using the addTrack method.

    Handles remote stream:
    When the remote peer adds tracks to the connection, the ontrack event is triggered. This event handler extracts the tracks from the incoming event 
    and adds them to the remoteStream. This way, the remoteStream now contains the audio and video tracks received from the remote user.

    Handle inactive remote stream:
    If the remoteStream becomes inactive, this code toggles the enabled property of each track in the stream, effectively disabling them. 
    It then closes the RTCPeerConnection.

    +-+-+-+-+

    Handles .onicecandidate event.

    +-+-+-+-+

    Uses .createDataChannel method to create sendChannel.

    +-+-+-+-+

    Handles .ondatachannel event.
   *
   *
   */
  let createPeerConnection = async () => {
    // Direct line between peers.
    peerConnection = new RTCPeerConnection(servers);

    // Prep remote stream.
    remoteStream = new MediaStream();
    const user2Element = document.getElementById("user-2");
    user2Element.srcObject = remoteStream;

    // handle local stream
    //document.getElementById("user-2").srcObject = remoteStream;
    if (localStream) {
      localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStream);
      });
    } else {
      //console.log("LOCALSTREAM NOT TRUE");
    }

    // handle remote stream
    // The ontrack event is crucial for handling the dynamic nature of real-time communication, where peers may join or leave a session, and new media tracks may be added or removed during the session. It allows you to respond to changes in the media stream and update your application accordingly.
    peerConnection.ontrack = async (event) => {
      //console.log("ONTRACK EVENT FIRED");
      event.streams[0].getTracks().forEach((track) => {
        //console.log("GETTRACKS METHOD FIRED");
        remoteStream.addTrack(track);
      });
    };
    remoteStream.oninactive = () => {
      //  console.log("ONINACTIVE EVENT FIRED");
      remoteStream.getTracks().forEach((track) => {
        //  console.log("GETTRACKS EVENT FIRED");
        track.enabled = !track.enabled;
      });
      peerConnection.close();
    };

    /**
     +-+-+ .onicecandidate event +-+-+
        - 'onicecandidate' and 'oninactive' are RTCPeerConnection object properties which accept a handler function as their value.
        + This handler is automatically executed when the 'onicecandidate' event occurs. 
            + Not specific to any one user; this event is triggered whenever an ICE candidate is generated by the local peer.
        + Exchanges users icecandidate data (network info) which comes from the 'event' param.
           + 'event' param generated by '.onicecandidate' method.
           + ICE is a framework used in WebRTC to establish a connection between peers when behind NAT or firewalls. 
           + ICE candidates represent the possible network paths for media transmission between peers.
        + The condition checks if the event object contains a valid ICE candidate. 
           + The event.candidate property holds information about a network path that can be used for communication.
     +-+-+
     */
    peerConnection.onicecandidate = async (event) => {
      if (event.candidate) {
        // exchange user's networking information, firewall etc, next is 'candidateReceiver'.
        socket.emit("candidateSentToUser", {
          username: username,
          remoteUser: remoteUser,
          iceCandidateData: event.candidate,
        });
      }
    };

    /**
      +-+-+
    +   'createDataChannel' method: Creates a channel for sending arbitrary data types, e.g., text, game data, etc. 
         It does NOT deal with the transmission of audio/video media. Media streaming is instead handled through the peerConnection obj ^. 
    -   '.onopen' event: when sendChannel is open, the handler will fire. Handler calls 'onSendChannelStateChange()' to log current status of sendChannel.
      +-+-+
    */
    sendChannel = peerConnection.createDataChannel("sendDataChannel");
    sendChannel.onopen = () => {
      //console.log("sendChannel is now open");
      onSendChannelStateChange();
    };

    /**
     +-+-+
      'ondatachannel' event: The handler function 'receiveChannelCallback' will be fired. 'ondatachannel' is a property to which we assign the function.
      'ondatachannel' event is triggered when a data channel is created, as in the 'sendChannel' channel above.
       The event handler func is called: receiveChannelCallback().
     +-+-+
     */
    peerConnection.ondatachannel = receiveChannelCallback;
  };
  function receiveChannelCallback(event) {
    // console.log(
    //   "receiveChannelCallback fired in response to .ondatachannel which is in response to sendChannel opening."
    // );
    // Creates receiveChannel.
    receiveChannel = event.channel;
    // Displays the received msg to chatwindow with prefix 'Stranger: '.
    receiveChannel.onmessage = onReceiveChannelMessageCallback;
    receiveChannel.onopen = onReceiveChannelStateChange;
    receiveChannel.onclose = onReceiveChannelStateChange;
  }

  /**
  +-+-+
  sendData(): Sends either the senders or receivers msg thru the appropriate channel depending on which channel is open (sendChannel or receiveChannel).
  +   Extracts text input, stores it in 'msgData' var. Displays msgData in chatwindow with prefix 'You: '.
  +-+-+
  -   If sendChannel open, use .send method to send msgData thru sendChannel.
       - The sender (whoever sends msg 1st) sends msg thru sendChannel.
  -+-+-+     
  +   Else, sendChannel NOT open, use .send method to send msgData thru receiveChannel
       + The receiver sends their reply thru receiveChannel.
  +-+-+
  -   sendData() is called when Send button is clicked. 
  */
  function sendData() {
    const msgData = msgInput.value;
    chatTextArea.innerHTML +=
      "<div style='margin-top:2px; margin-bottom:2px;'><b style='color: rgba(5, 126, 37, 1);'>You: </b>" +
      msgData +
      "</div>";
    if (sendChannel) {
      // new - ensure that sendChannel is open before sending a msg thru it. it may pass the first if clause if 'connecting' state.
      onSendChannelStateChange();
      if (sendChannel.readyState === "open") {
        sendChannel.send(msgData);
        msgInput.value = "";
      }
    } else {
      receiveChannel.send(msgData);
      msgInput.value = "";
    }
  }

  /**
   * 
   +-+-+onReceiveChannelMessageCallback(): Displays the received msg to chatwindow with prefix 'Stranger: '.
      + Receives the .onmessage event as arg from the function: receiveChannelCallback().
   *
   */
  function onReceiveChannelMessageCallback(event) {
    // console.log(
    //   "onReceiveChannelMessageCallback fired, disp received msg to chatwindow."
    // );
    chatTextArea.innerHTML +=
      "<div style='margin-top:2px; margin-bottom:2px;'><b style='color: rgba(198, 0, 198, 1);'>Friend: </b>" +
      event.data +
      "</div>";
  }

  /**
    -+-+-
    -    onReceiveChannelStateChange() - monitor and report the state of the data channel.
    +   'readyState' property represents current state of data channel. Can have states such as "connecting", "open", "closing", or "closed".
    +-+-+
   */ function onReceiveChannelStateChange() {
    const readystate = receiveChannel.readyState;
    console.log("receiveChannel readyState is: " + readystate);
    if (readystate === "open") {
      // console.log(
      //   "receiveChannel readyState is open - onReceiveChannelStateChange"
      // );
    } else {
      // console.log(
      //   "receiveChannel readyState is NOT open - onReceiveChannelStateChange"
      // );
    }
  }
  /**
    -+-+-
    -    onSendChannelStateChange() - monitor and report the state of the data channel.
    +   'readyState' property represents current state of data channel. Can have states such as "connecting", "open", "closing", or "closed".
    +-+-+
   */
  function onSendChannelStateChange() {
    const readystate = sendChannel.readyState;
    console.log("sendChannel readyState is: " + readystate);
    if (readystate === "open") {
      //console.log("sendChannel readyState is open - onSendChannelStateChange");
    } else {
      // console.log(
      //   "sendChannel readyState is NOT open - onSendChannelStateChange"
      // );
    }
  }

  /**
   * 
   * 
   +-+-+ createOffer() +-+-+
   - - - Accepts remoteUser's ID as an arg. Called when Socket.IO matchmaking assigns this browser a remote user.
   + + + Calls createPeerConnection() which exchanges media, icecandidate and creates a data channel.
   - - - Creates an offer using .createOffer method of the peerConnection obj.  (write the letter)
   + + + Set the offer to localdescription.                                    (seal the envelope)
   - - - Emit 'offerSenToRemote' event                                          (send the envelope)
         - Includes 3 things in emission: 1. local ID; 2. remote IDs; 3. offer
   */
  let createOffer = async (remoteU) => {
    createPeerConnection();
    let offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    console.log(
      "From createOffer, offer set to localdescr",
      peerConnection.localDescription
    );
    socket.emit("offerSentToRemote", {
      username: username,
      remoteUser: remoteU,
      offer: peerConnection.localDescription,
    });
  };

  /**
   * 
   * 
    +-+-+ createAnswer(): This function is only for remoteUser, it creates an answer to  user-1's offer and it should be interpreted
                          from the remoteUser's perspective. offer set to remotedescription; answer set to localdescription.
    + Called on 'receiveOffer' event.
    - Exracts remoteUser's ID using '.username' property. username (user-1) will be the remoteUser from user-2's perspective.
    + Calls createPeerConnection() which exchanges media, icecandidate and creates a data channel.
    - remoteUser sets the offer to their remotedescription.
    + remoteUser creates their answer using .createAnswer method of peerConnection obj.
    - remoteUser sets their own "description", i.e., their localdescription with their answer. 
    + Emit 'answerSentToUser1' event. 
      + This sends answer to the offerer. 
      + Includes 3 things in emission: 1. answer; 2. remoteUser ID; 3. offerer's ID.

    - Gives pointer functionality to Next buton.
    + Request 'update-on-engagement'
      + changes 'status' to '1' for one user at a time to indicate they are in a session.
   */
  let createAnswer = async (data) => {
    remoteUser = data.username;
    createPeerConnection();
    if (data.offer) {
    }
    await peerConnection.setRemoteDescription(data.offer);
    let answer = await peerConnection.createAnswer();
    // BUG: After clicking next, attempts to set localdescr fail because readystate is not open.
    await peerConnection.setLocalDescription(answer);

    console.log(
      "From createAnswer: set offer to remotedescr ",
      peerConnection.remoteDescription
    );
    console.log(
      "From createAnswer: set answer to localdescr ",
      peerConnection.localDescription
    );

    socket.emit("answerSentToUser1", {
      answer: answer,
      sender: data.remoteUser, // user-2
      receiver: data.username, // user-1
    });
    // Give pointer functionality to the 'Next' button.
    document.querySelector(".next-chat").style.pointerEvents = "auto";

    // console.log(
    //   "createAnswer() > ... 'update-on-engagement' with the username: ",
    //   username
    // );

    // update mongoDB 'status' to '1'.
    $.ajax({
      url: "/update-on-engagement/" + username, // + "" ?
      type: "PUT",
      success: function (response) {
        console.log(
          "update on engagement, updated status to 1 for " + username
        );
        // console.log(response, " from ajax update-on-engagement");
      },
    });
  };

  /**
   *
   * If user-2 receives the offer from user-1, a "ReceiveOffer" event is fired.
   *
   */
  socket.on("ReceiveOffer", function (data) {
    createAnswer(data);
  });

  /** 
   * 
    addAnswer():   
    + user-1 check is remotedescription is already set.
    + if not, set user-2's answer to remotedescription.
    + Give Next button pointer functionality.
    
    + Request 'update-on-engagement', meaning both users are occupied in active 1:1 session.
    + Update both users' DB 'status' to '1'.
    + Updates document for one user at a time (accepts one username). 
   *
   */
  let addAnswer = async (data) => {
    if (!peerConnection.currentRemoteDescription) {
      peerConnection.setRemoteDescription(data.answer);
    }
    // Give the 'Next' button pointer functionality
    document.querySelector(".next-chat").style.pointerEvents = "auto";

    console.log(
      "From addAnswer, set answer to remotedescr ",
      peerConnection.remoteDescription
    );

    $.ajax({
      url: "/update-on-engagement/" + username, // + "" ?
      type: "PUT",
      success: function (response) {},
    });
  };

  /**
   *
     In response to user-1's offer, user-1 receives an answer from user-2.
   *
   */
  socket.on("ReceiveAnswer", function (data) {
    addAnswer(data);
  });

  socket.on("candidateReceiver", function (data) {
    if (peerConnection && peerConnection.signalingState !== "closed") {
      peerConnection.addIceCandidate(data.iceCandidateData).catch((error) => {
        console.warn("Could not add ICE candidate:", error);
      });
    }
  });

  /**
   * Stage 2 WebRTC cleanup used by both sides of a Next/disconnect.
   * The local camera/microphone stream stays alive; only the old peer session
   * and remote media/data channels are torn down.
   */
  function resetPeerSession() {
    document.querySelector(".chat-text-area").innerHTML = "";

    if (sendChannel) {
      try { sendChannel.close(); } catch (error) {}
      sendChannel = null;
    }
    if (receiveChannel) {
      try { receiveChannel.close(); } catch (error) {}
      receiveChannel = null;
    }

    if (peerConnection) {
      try {
        peerConnection.ontrack = null;
        peerConnection.onicecandidate = null;
        peerConnection.ondatachannel = null;
        peerConnection.close();
      } catch (error) {
        console.warn("Could not close old peer connection:", error);
      }
      peerConnection = null;
    }

    if (remoteStream) {
      remoteStream.getTracks().forEach((track) => track.stop());
      remoteStream = null;
    }

    const remoteVid = document.getElementById("user-2");
    if (remoteVid) remoteVid.srcObject = null;

    remoteUser = null;
    document.querySelector(".next-chat").style.pointerEvents = "none";
  }

  // The current partner clicked Next. The server has already returned this
  // browser to matchmaking, so the browser only needs to clean up old WebRTC.
  socket.on("partnerRequestedNext", function () {
    console.log("[NEXT] Partner requested a new chat. Waiting for a new match...");
    resetPeerSession();
    $.ajax({ url: "/update-on-next/" + username, type: "PUT" });
  });

  // The current partner closed/reloaded their browser. The server automatically
  // requeues this browser after sending this event.
  socket.on("partnerDisconnected", function () {
    console.log("[MATCH] Partner disconnected. Waiting for a new match...");
    resetPeerSession();
    $.ajax({ url: "/update-on-next/" + username, type: "PUT" });
  });

  /**
   +-+-+-+ 'unload' window event +-+-+-+
   +  When user exist app (close window or tab), 'unload' event is triggered.

  OBSOLETE (pre-Stage-2) disconnect/rematch path -- COMMENT ONLY:
      - The browser used to emit 'remoteUserClosed'.
      - server.js used to locate the other user and emit 'closedRemoteUser'.
      - The other browser then used MongoDB update-on-next + fetchNextUser to rematch.

  CURRENT behavior:
      - Socket.IO's disconnect handler detects the lost socket, notifies the partner,
        cleans server matchmaking state, and requeues the remaining connected user.
      - MongoDB status requests below are retained only as legacy/persistent bookkeeping;
        they are no longer the authority for real-time video matchmaking.

   -  Requests 'leaving-user-update'  with 'username' as url param.
        - Checks if browser is Chrome or Firefox - falsifies async if FF.
        - This event updates the leaving user's satus to 0 and active to no.
  
   +  Requests 'update-on-otheruser-closing' with 'remoteUser' as url param.
        + Updates active to yes and status to 0 for remoteUser
   
   +-+-+-+ 'unload' window event +-+-+-+
   * 
   *  */
  window.addEventListener("unload", async function (event) {
    // Socket.IO's server-side disconnect handler now owns partner cleanup and
    // rematching. MongoDB updates below are retained for legacy user status data.
    // Find if username user has status 1 or 0. If 1, request 'update-on-other..., if 0, skip 'update-on-other...
    let is1 = await isStatus1(username);

    if (navigator.userAgent.indexOf("Chrome") != -1) {
      $.ajax({
        url: "/leaving-user-update/" + username,
        type: "PUT",
        success: function (response) {},
      });
      if (is1) {
        $.ajax({
          url: "/update-on-otheruser-closing/" + remoteUser,
          type: "PUT",
          success: function (response) {},
        });
      }
    } else if (navigator.userAgent.indexOf("Firefox") != -1) {
      $.ajax({
        url: "/leaving-user-update/" + username,
        type: "PUT",
        async: false,
        success: function (response) {},
      });
      if (is1) {
        $.ajax({
          url: "/update-on-otheruser-closing/" + remoteUser,
          type: "PUT",
          async: false,
          success: function (response) {},
        });
      }
    } else {
      // new
      $.ajax({
        url: "/leaving-user-update/" + username,
        type: "PUT",
        success: function (response) {},
      });
      if (is1) {
        $.ajax({
          url: "/update-on-otheruser-closing/" + remoteUser,
          type: "PUT",
          success: function (response) {},
        });
      }
    }
  });

  /**
   * Stage 2 Next button flow:
   * 1. Tear down only the old WebRTC peer session.
   * 2. Tell the Socket.IO server this user wants another partner.
   * 3. The server breaks the pair, requeues both users, prevents an immediate
   *    rematch with the same partner, and emits matchedWithUser when ready.
   */
  function closeConnectionAndFindNext() {
    console.log("[NEXT] Requesting a new chat partner");
    resetPeerSession();

    // MongoDB no longer chooses the next user. Keep its legacy status field
    // consistent for now while Socket.IO owns the real-time matchmaking.
    $.ajax({
      url: "/update-on-next/" + username,
      type: "PUT",
    });

    socket.emit("nextChat");
  }

  $(document).on("click", ".next-chat", function () {
    // Disable immediately so a double-click cannot send duplicate Next events.
    document.querySelector(".next-chat").style.pointerEvents = "none";
    closeConnectionAndFindNext();
  });

  msgSendBtn.addEventListener("click", function (event) {
    sendData();
  });

  // deleteAllDocuments();
}

function isStatus1(usernameId) {
  let isStatus1;
  $.ajax({
    url: "/isStatus1/" + usernameId,
    type: "GET",
    success: function (response) {
      isStatus1 = response;
    },
  });
  return isStatus1;
}

async function getUserMediaPermissions() {
  document.getElementById("mediaModal").style.display = "block";
  // console.log("from get user media permissions");
  const userElement = document.getElementById("user-1");

  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });

    // Assign the localStream to the video element
    userElement.srcObject = localStream;

    // Check if the srcObject is assigned successfully
    if (userElement.srcObject === localStream) {
      //console.log("Local stream assigned successfully to user-1 element");
      // Check if both audio and video tracks are present
      if (
        //localStream.getAudioTracks().length > 0 &&
        localStream.getVideoTracks().length > 0
      ) {
        //console.log("Local stream contains both audio and video tracks");

        document.getElementById("overlay").style.display = "none";
      } else {
        // console.error(
        //   "Local stream does not contain both audio and video tracks"
        // );
      }
    } else {
      //console.error("Failed to assign local stream to user-1 element");
    }
  } catch (error) {
    //console.error("Error getting media permissions:", error);
  }
}

// Event listener for changes in media permissions
async function changedMediaPermissions() {
  try {
    const cameraPermission = await navigator.permissions.query({
      name: "camera",
    });
    const microphonePermission = await navigator.permissions.query({
      name: "microphone",
    });
    if (
      cameraPermission.state === "granted" &&
      microphonePermission.state === "granted"
    ) {
      // console.log(
      //   "THE USER HAS GRANTED ACCESS TO THEIR CAMERA AND MICROPHONE."
      // );
      document.getElementById("overlay").style.display = "none";
      getUserMediaPermissions();
    } else {
      // console.log(
      //   "THE USER HAS NOT GRANTED ACCESS TO THEIR CAMERA AND MICROPHONE."
      // );
    }
  } catch (error) {
    // console.error("Error checking media permissions:", error);
    showPermissionError();
  }
}

// Event listener for changes in media permissions
navigator.permissions.query({ name: "camera" }).then((cameraPermission) => {
  cameraPermission.onchange = changedMediaPermissions;
});

navigator.permissions
  .query({ name: "microphone" })
  .then((microphonePermission) => {
    microphonePermission.onchange = changedMediaPermissions;
  });

const muteUnmute = () => {
  const enabled = localStream.getAudioTracks()[0].enabled;
  if (enabled) {
    localStream.getAudioTracks()[0].enabled = false;
    setUnmuteButton();
  } else {
    setMuteButton();
    localStream.getAudioTracks()[0].enabled = true;
  }
};

const playStop = () => {
  let enabled = localStream.getVideoTracks()[0].enabled;
  if (enabled) {
    localStream.getVideoTracks()[0].enabled = false;
    setPlayVideo();
  } else {
    setStopVideo();
    localStream.getVideoTracks()[0].enabled = true;
  }
};

const setMuteButton = () => {
  var button = document.getElementById("muteButton");
  button.innerText = "Mute";
};

const setUnmuteButton = () => {
  var button = document.getElementById("muteButton");
  button.innerText = "Unmute";
};

const setStopVideo = () => {
  var button = document.getElementById("stopButton");
  button.innerText = "Stop";
};

const setPlayVideo = () => {
  var button = document.getElementById("stopButton");
  button.innerText = "Play";
};

//Delete all documents in DB
// function deleteAllDocuments() {
//   $.ajax({
//     url: "/deleteAllRecords",
//     type: "DELETE",
//     success: function (response) {
//       console.log("Deleted all DB documents.");
//     },
//   });
// }
