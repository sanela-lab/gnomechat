const express = require("express");
const route = express.Router();
// Imports a module named "render" from the "../services" subdir to render views.
const services = require("../services/render");
// Import the controller for database.
const controller = require("../controller/controller");

//When a GET request is made to the root path, it calls the homeRoutes function from the "services" module. This function is
//responsible for rendering the home page.
route.get("/", services.homeRoutes);
route.get("/video-chat", services.video_chat);
route.get("/text-chat", services.text_chat);

// For adding new user to database, call create().
route.post("/api/users", controller.create);

// When a user leaves the application by closing the browser window, call leavingUserUpdate().
route.put("/leaving-user-update/:id", controller.leavingUserUpdate);

// Update the remaining user after their partner disconnects
route.put(
  "/update-on-otheruser-closing/:id",
  controller.updateOnOtherUserClosing
);

route.put("/new-user-update/:id", controller.newUserUpdate);

route.post("/get-remote-users", controller.remoteUserFind);

route.put("/update-on-engagement/:id", controller.updateOnEngagement);

route.post("/fetch-next-user", controller.fetchNextUser);

route.put("/update-on-next/:id", controller.updateOnNext);

route.delete("/deleteAllRecords", controller.deleteAllRecords);

route.get("/isStatus1/:id", controller.isStatus1);

module.exports = route;
