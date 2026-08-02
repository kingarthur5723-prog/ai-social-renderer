const generateVoice = require("./voice");

generateVoice(
    "Hello, this is a test from AI Social Renderer.",
    "test"
)
.then(file => {
    console.log("SUCCESS:", file);
})
.catch(err => {
    console.error(err);
});
