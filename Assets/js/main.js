// This code is for closing the landing page (index.ejs). This will fire a
// function in the controller.js file that will change 'status' to 0
// and 'active' to no.
window.addEventListener("unload", function (event) {
  $.ajax({
    url: "/leaving-user-update/" + username,
    type: "PUT",
    success: function (response) {
      alert(response);
    },
  });
});
// Even when the user just clicks back to go from the video-chat page
// back to the homepage, we must also change 'status' to 0 and 'active' to no.
$.ajax({
  url: "/leaving-user-update/" + username,
  type: "PUT",
  success: function (response) {
    alert(response);
  },
});

// async function videoBtnEnforcement(event) {
//   event.preventDefault();
//   try {
//     // Request media permissions
//     const stream = await navigator.mediaDevices.getUserMedia({
//       video: true,
//       audio: true,
//     });
//     // Media permissions granted, you can proceed to navigate to /video-chat
//     window.location.href = "/video-chat";
//   } catch (error) {
//     // Media permissions not granted
//     console.error("Media permissions not granted", error);
//     // Provide feedback to the user or take other actions as needed
//     alert("Please grant media permissions to proceed with video chat.");
//   }
// }
