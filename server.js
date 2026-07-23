const express = require("express");
const cors = require("cors");
const fs = require("fs-extra");
const path = require("path");

const renderVideo = require("./render");

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: "50mb" }));

// Ensure folders exist
fs.ensureDirSync(path.join(__dirname, "uploads"));
fs.ensureDirSync(path.join(__dirname, "output"));
fs.ensureDirSync(path.join(__dirname, "assets"));

// Serve rendered videos
app.use(
    "/output",
    express.static(path.join(__dirname, "output"))
);

// Home endpoint
app.get("/", (req, res) => {
    res.json({
        success: true,
        service: "AI Social Renderer",
        version: "1.0.0",
        status: "online"
    });
});

// Render endpoint
app.post("/render", async (req, res) => {

    try {

        const result = await renderVideo(req.body);

        res.json(result);

    } catch (err) {

        console.error(err);

        res.status(500).json({
            success: false,
            error: err.message
        });

    }

});

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {

    console.log("==================================");
    console.log("AI SOCIAL RENDERER");
    console.log("Listening on port", PORT);
    console.log("==================================");

});
