const axios = require("axios");

// Export functions responsible for rendering views.
exports.homeRoutes = (req, res) => {
    res.render("include/index");
};
exports.video_chat = (req, res) => {
    res.render("include/video-chat");
};
exports.text_chat = (req, res) => {
    res.render("include/text-chat");
};
