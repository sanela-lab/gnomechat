(function () {
  const express = require("express");
  const path = require("path");
  const bodyparser = require("body-parser");
  const app = express();

  // Database connection
  const dotenv = require("dotenv");
  const connectDB = require("./Server/database/connection");
  dotenv.config({ path: "config.env" });
  const PORT = process.env.PORT || 8080;
  connectDB();

  app.use(bodyparser.urlencoded({ extended: true }));

  app.use(bodyparser.json());

  app.set("view engine", "ejs");

  app.use("/css", express.static(path.resolve(__dirname, "Assets/css")));
  app.use("/img", express.static(path.resolve(__dirname, "Assets/img")));
  app.use("/js", express.static(path.resolve(__dirname, "Assets/js")));

  app.use("/", require("./Server/routes/router"));

  var server = app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });

  // bind socket.io to existing server
  const io = require("socket.io")(server, {
    allowEIO3: true, // false by default
  });

  // userConnection stores users currently registered with the signaling server.
  var userConnection = [];

  // Socket.IO is the source of truth for real-time matchmaking.
  var waitingUsers = [];

  // After someone clicks Next, the previous pair is temporarily prevented
  // from matching each other again. If nobody else is available, they become
  // eligible to rematch after this cooldown.
  const PREVIOUS_PARTNER_COOLDOWN_MS = 15000;
  const rematchCooldownTimers = new Map();

  // Maps a socket id to the socket id of its current chat partner.
  // This lets the server cleanly end a pair when either user clicks Next.
  var currentPartners = new Map();

  function clearRematchTimer(socketId) {
    const timer = rematchCooldownTimers.get(socketId);
    if (timer) clearTimeout(timer);
    rematchCooldownTimers.delete(socketId);
  }

  function removeFromWaitingQueue(socketId) {
    waitingUsers = waitingUsers.filter(
      (user) => user.connectionId !== socketId
    );
    clearRematchTimer(socketId);
  }

  function getConnectedUser(socketId) {
    return userConnection.find((user) => user.connectionId === socketId);
  }

  function enqueueForMatch(user, avoidUserId = null) {
    if (!user || !io.sockets.sockets.get(user.connectionId)) return;

    removeFromWaitingQueue(user.connectionId);

    // Remove stale sockets before looking for a compatible partner.
    waitingUsers = waitingUsers.filter((waitingUser) =>
      io.sockets.sockets.get(waitingUser.connectionId)
    );

    const now = Date.now();

    // Do not immediately rematch the two people who just clicked/received Next.
    // The restriction automatically expires after 15 seconds.
    const partnerIndex = waitingUsers.findIndex((waitingUser) => {
      const waitingUserStillAvoidsThisUser =
        waitingUser.avoidUserId === user.user_id &&
        waitingUser.avoidUntil > now;
      const thisUserStillAvoidsWaitingUser =
        avoidUserId === waitingUser.user_id;

      return (
        !waitingUserStillAvoidsThisUser &&
        !thisUserStillAvoidsWaitingUser &&
        waitingUser.connectionId !== user.connectionId &&
        waitingUser.chatMode === user.chatMode
      );
    });

    if (partnerIndex === -1) {
      const avoidUntil = avoidUserId
        ? now + PREVIOUS_PARTNER_COOLDOWN_MS
        : 0;

      waitingUsers.push({ ...user, avoidUserId, avoidUntil });
      console.log(`[MATCH] ${user.user_id} entered the waiting queue`);
      io.to(user.connectionId).emit("waitingForUser");

      if (avoidUserId) {
        const timer = setTimeout(() => {
          rematchCooldownTimers.delete(user.connectionId);

          // Only retry if this browser is still connected and still waiting.
          const stillWaiting = waitingUsers.some(
            (waitingUser) => waitingUser.connectionId === user.connectionId
          );
          const connectedUser = getConnectedUser(user.connectionId);

          if (stillWaiting && connectedUser) {
            console.log(
              `[MATCH] ${user.user_id}'s previous-partner cooldown expired`
            );
            enqueueForMatch(connectedUser);
          }
        }, PREVIOUS_PARTNER_COOLDOWN_MS);

        rematchCooldownTimers.set(user.connectionId, timer);
      }

      return;
    }

    const partner = waitingUsers.splice(partnerIndex, 1)[0];
    clearRematchTimer(partner.connectionId);
    currentPartners.set(user.connectionId, partner.connectionId);
    currentPartners.set(partner.connectionId, user.connectionId);

    console.log(`[MATCH] ${user.user_id} matched with ${partner.user_id}`);

    // Exactly one side creates the WebRTC offer.
    io.to(user.connectionId).emit("matchedWithUser", {
      remoteUser: partner.user_id,
    });
  }

  // io represents the room and socket represents the individual person.
  io.on("connection", (socket) => {
    console.log("Socket id is: ", socket.id);

    socket.on("userconnect", (data) => {
      console.log(
        "Logged in username from server on 'userconnect': ",
        data.displayName
      );

      userConnection = userConnection.filter(
        (user) => user.connectionId !== socket.id
      );

      const currentUser = {
        connectionId: socket.id,
        user_id: data.displayName,
        // Keep Video Chat and Text Chat in completely separate matchmaking pools.
        chatMode: data.chatMode === "text" ? "text" : "video",
      };
      userConnection.push(currentUser);

      enqueueForMatch(currentUser);

      console.log(`[MATCH] ${currentUser.user_id} registered for ${currentUser.chatMode} chat`);
      console.log("UserCount", userConnection.length);
      userConnection.forEach((user) => {
        console.log("Username is: ", user.user_id);
      });
    });

    // Stage 2: Next is handled entirely by Socket.IO matchmaking.
    socket.on("nextChat", () => {
      const currentUser = getConnectedUser(socket.id);
      if (!currentUser) return;

      removeFromWaitingQueue(socket.id);

      const partnerSocketId = currentPartners.get(socket.id);
      const partnerUser = partnerSocketId
        ? getConnectedUser(partnerSocketId)
        : null;

      currentPartners.delete(socket.id);
      if (partnerSocketId) currentPartners.delete(partnerSocketId);

      console.log(
        `[NEXT] ${currentUser.user_id} requested a new partner` +
          (partnerUser ? `; ending chat with ${partnerUser.user_id}` : "")
      );

      if (partnerUser) {
        // Tell the other browser to tear down its old WebRTC state.
        io.to(partnerUser.connectionId).emit("partnerRequestedNext");

        // Requeue the other user too, but prevent an immediate A<->B rematch.
        enqueueForMatch(partnerUser, currentUser.user_id);
      }

      enqueueForMatch(
        currentUser,
        partnerUser ? partnerUser.user_id : null
      );
    });
    /**
     *
     * local user sends offer to remote user. Search for the remote user within the userConnection arr.
     *
     *  */
    socket.on("offerSentToRemote", (data) => {
      var offerReceiver = userConnection.find(
        (o) => o.user_id === data.remoteUser
      );
      // If the intended recipient (remote user) found, send them the offer.
      if (offerReceiver) {
        console.log("offerSentToRemote by " + data.username);
        // console.log("OfferReceiver user is: ", offerReceiver.connectionId);
        // receiveOffer event simply calls 'createAnswer.
        socket.to(offerReceiver.connectionId).emit("ReceiveOffer", data);
      }
    });
    /**
     *
     * Find local user and send them the answer.
     *
     */
    socket.on("answerSentToUser1", (data) => {
      var answerReceiver = userConnection.find(
        (o) => o.user_id === data.receiver
      );
      if (answerReceiver) {
        // console.log("answerReceiver user is: ", answerReceiver.connectionId);
        socket.to(answerReceiver.connectionId).emit("ReceiveAnswer", data);
      }
    });
    //
    socket.on("candidateSentToUser", (data) => {
      var candidateReceiver = userConnection.find(
        (o) => o.user_id === data.remoteUser
      );
      if (candidateReceiver) {
        // console.log(
        //   "candidateReceiver user is: ",
        //   candidateReceiver.connectionId
        // );
        socket
          .to(candidateReceiver.connectionId)
          .emit("candidateReceiver", data);
      }
    });

    // If a browser actually disconnects, remove it and return its partner to matchmaking.
    socket.on("disconnect", () => {
      console.log("User disconnected");

      const disconnectedUser = getConnectedUser(socket.id);
      const partnerSocketId = currentPartners.get(socket.id);
      const partnerUser = partnerSocketId
        ? getConnectedUser(partnerSocketId)
        : null;

      removeFromWaitingQueue(socket.id);
      currentPartners.delete(socket.id);
      if (partnerSocketId) currentPartners.delete(partnerSocketId);

      userConnection = userConnection.filter(
        (user) => user.connectionId !== socket.id
      );

      if (partnerUser) {
        io.to(partnerUser.connectionId).emit("partnerDisconnected");
        enqueueForMatch(
          partnerUser,
          disconnectedUser ? disconnectedUser.user_id : null
        );
      }
    });
  });
})();
