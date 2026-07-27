const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");
const { exec } = require("child_process");

// ======================================
// DOWNLOAD IMAGES
// ======================================

async function downloadImages(images) {

    const uploadDir = path.join(__dirname, "uploads");
    await fs.ensureDir(uploadDir);

    const files = [];

    for (let i = 0; i < images.length; i++) {

        const filename = path.join(uploadDir, `scene${i}.jpg`);

        const response = await axios({
            url: images[i],
            method: "GET",
            responseType: "stream"
        });

        await new Promise((resolve, reject) => {

            const writer = fs.createWriteStream(filename);

            response.data.pipe(writer);

            writer.on("finish", resolve);
            writer.on("error", reject);

        });

        files.push(filename);

    }

    return files;

}

// ======================================
// CREATE VIDEO
// ======================================

async function createVideo({
    images,
    captions,
    music,
    narration,
    outputFile
}) {

    const listFile = path.join(__dirname, "uploads", "list.txt");

    let text = "";

    images.forEach((img) => {
        text += `file '${img}'\n`;
        text += "duration 5\n";
    });

    // Repeat last image
    text += `file '${images[images.length - 1]}'\n`;

    await fs.writeFile(listFile, text);

    return new Promise((resolve, reject) => {

        const cmd = [
    "ffmpeg",
    "-y",

    "-f", "concat",
    "-safe", "0",
    "-i", `"${listFile}"`,

    "-vf",
`"scale=1080:1920:force_original_aspect_ratio=increase,
crop=1080:1920,
zoompan=
z='min(zoom+0.00035,1.08)':
x='iw/2-(iw/zoom/2)':
y='ih/2-(ih/zoom/2)':
d=150:
s=1080x1920:
fps=30"`,

    "-c:v","libx264",

    "-preset","medium",

    "-crf","20",

    "-profile:v","high",

    "-level","4.1",

    "-pix_fmt","yuv420p",

    "-movflags","+faststart",

    `"${outputFile}"`
].join(" ");

        console.log(cmd);

        const child = exec(cmd);

        child.stdout.on("data", data => console.log(data.toString()));
        child.stderr.on("data", data => console.log(data.toString()));

        child.on("close", code => {

            if (code === 0) {
                resolve(outputFile);
            } else {
                reject(new Error("FFmpeg exited with code " + code));
            }

        });

    });

}

// ======================================
// EXPORTS
// ======================================

module.exports = {
    downloadImages,
    createVideo
};
