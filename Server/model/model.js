/**
 * In an MVC (Model-View-Controller) architecture, the "model" component represents the 
 * data and business logic of the application. Models are responsible for defining data 
 * structures, interacting with databases, and providing a clean and abstracted interface
 *  for data operations. 
 * 
 * KEY: 
 * - 'active' - The user is online if set to 'yes'; offline if set to 'no'.
 * - 'status' - The user is unpaired if set to '0'; paired if set to '1'.
 */

const mongoose = require("mongoose");
var schema = new mongoose.Schema(
    {
        active: {
            type: String,
        },
        status: {
            type: String,
        }
    },
    // Adds the createdAt and updatedAt timestamps.
    {timestamps: true}
)

// Create a Mongoose model and store it in the 'userDB' variable.
// A Mongoose model acts as an interface for interacting with a MongoDB collection, providing methods for CRUD operations.
const UserDB = mongoose.model("gnome", schema);
// Export the model.
module.exports = UserDB;