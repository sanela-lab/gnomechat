# GnomeChat

**Anonymous, real-time video and text conversations with randomly matched strangers.**

GnomeChat is a web application designed to make spontaneous human connection easier. Visitors can join a video chat with an integrated message box or choose a separate text-only experience, without creating a traditional user profile. The project is intended for adults aged 18 and older.

> **Project status:** Active development / prototype. The core matching flows have been manually tested with multiple browser sessions. This is not a claim of production readiness or comprehensive security testing.

## Features

- **Random one-to-one matching** through Socket.IO waiting queues.
- **Video chat:** WebRTC-based camera and microphone communication, with text messaging alongside the video feeds.
- **Text-only chat:** A separate experience that does not require camera or microphone access.
- **Mode isolation:** Video users are matched only with video users; text users only with text users.
- **Next / Skip:** End a conversation and return to matchmaking.
- **15-second rematch cooldown:** Avoid immediately reconnecting recently skipped partners, but permit a rematch after the cooldown if no alternative is available.
- **Disconnect handling:** Remove disconnected users from matchmaking and handle partner departures.
- **Anonymous sessions:** No traditional account registration is required for the core chat experience.

## Technology stack

| Layer | Technologies |
| --- | --- |
| Frontend | HTML, CSS, vanilla JavaScript, EJS templates |
| Backend | Node.js, Express |
| Real-time coordination | Socket.IO |
| Peer-to-peer media and chat | WebRTC, RTCDataChannel |
| Database | MongoDB Atlas, Mongoose |

## How matchmaking works

1. A visitor selects **Video Chat** or **Text Chat**.
2. The browser registers with the Socket.IO server and identifies its chat mode.
3. The server searches the waiting queue for an eligible partner **in the same mode**.
4. When a match is found, Socket.IO coordinates the initial connection; WebRTC establishes the peer-to-peer session.
5. If someone selects **Next**, both users return to matchmaking, with a temporary restriction against an immediate repeat pairing.
6. After **15 seconds**, the previous pair may match again if no other eligible partner is available.

**Design decision:** MongoDB stores application data, while Socket.IO manages the short-lived, real-time matchmaking state. This avoids relying on one-off database lookups to determine who is available *right now*.

## Engineering challenges addressed

**Reliable multi-user matching.** An earlier implementation queried MongoDB for an available stranger only once. When more than two people joined, users could remain unmatched or be selected during an ongoing connection negotiation. Moving matching to a server-managed waiting queue provides an explicit waiting state and pairs available users more predictably.

**Safe session transitions.** The Next workflow closes the previous peer connection and data channels before establishing a new session, while retaining local media permissions for video users.

**Avoiding immediate repeat matches.** A time-limited previous-partner restriction prioritizes new partners without leaving the only two online users waiting indefinitely.

**Separating chat modes.** Independent Socket.IO matching pools prevent video and text-only visitors from being paired together.

## Project structure

```text
Assets/
  css/               # Stylesheets
  js/
    videopage.js     # Video-chat client and WebRTC signaling
    textpage.js      # Text-only chat client
Server/
  controller/        # Express route handlers
  database/          # MongoDB connection
  model/             # Mongoose models
  routes/            # HTTP routes
  services/          # View rendering
views/include/       # EJS page templates
server.js            # Express and Socket.IO server
package.json         # Dependencies and npm scripts
config.env.example   # Example environment configuration (no real secrets)
```

## Running locally

**Prerequisites:** Node.js and npm, and access to a MongoDB database.

1. Clone this repository and open its folder in a terminal.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Copy `config.env.example` to `config.env` and replace the placeholder values with your own configuration:

   ```dotenv
   PORT=3000
   MONGO_URI=mongodb+srv://YOUR_USERNAME:YOUR_PASSWORD@YOUR_CLUSTER.mongodb.net/YOUR_DATABASE?retryWrites=true&w=majority
   ```

   **Never commit `config.env`.** It is excluded by `.gitignore`.

4. Start the application:

   ```bash
   npm start
   ```

5. Visit `http://localhost:3000` (or the port you configured). To test matching, open the site in **separate browser profiles or private windows** so each visitor has an independent session.

**Note:** The current `npm start` script uses `nodemon` for local development. A production deployment requires additional configuration, operational safeguards, and review.

## Testing performed

Manual browser-session testing has covered:

- Two-user matching in both chat modes.
- Four-user matching with independent conversations.
- Next / Skip and the 15-second rematch fallback.
- Video/text queue isolation and independent session behavior.

Automated test coverage and broader production-scale testing are future work.

## Roadmap

- Improve moderation, reporting, and abuse prevention.
- Strengthen age assurance beyond a basic 18+ confirmation.
- Expand automated tests for disconnects, reconnection, and simultaneous Next actions.
- Refine responsive design, accessibility, and deployment readiness.
- Explore optional interactive games and accounts if the project gains traction.

## Security and privacy

This repository does **not** include live database credentials or environment secrets. Use `config.env.example` to create your own local configuration. Because the app connects strangers in real time, abuse prevention, privacy protections, and appropriate age-assurance controls are important requirements before a broad public launch.

## Screenshots

Screenshots of the welcome page, video chat, and text-only interface can be added here once suitable images are prepared.

---

**Portfolio focus:** Real-time systems, WebRTC signaling, asynchronous state management, queue-based matchmaking, and iterative debugging of multi-user behavior.
