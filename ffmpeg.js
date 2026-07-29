const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");
const { exec } = require("child_process");

// ======================================
// DOWNLOAD IMAGES
// ======================================

// ======================================
// DOWNLOAD IMAGES
// ======================================

const { v4: uuid } = require("uuid");

async function downloadImages(images) {

    // Create unique folder for this video job
    const jobFolder = path.join(
        __dirname,
        "uploads",
        uuid()
    );

    await fs.ensureDir(jobFolder);

    const files = [];

    for (let i = 0; i < images.length; i++) {

        const filename = path.join(
            jobFolder,
            `scene${i}.jpg`
        );

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

    const uploadDir = path.join(__dirname, "uploads");
    const listFile = path.join(uploadDir, "list.txt");
    const subtitleFile = path.join(uploadDir, "captions.srt");

let srt = "";

captions.forEach((caption, index) => {

    const start = index * 5;
    const end = (index + 1) * 5;

    const formatTime = (seconds) => {

        const hh = String(Math.floor(seconds / 3600)).padStart(2, "0");
        const mm = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
        const ss = String(seconds % 60).padStart(2, "0");

        return `${hh}:${mm}:${ss},000`;

    };

    srt += `${index + 1}\n`;
    srt += `${formatTime(start)} --> ${formatTime(end)}\n`;
    srt += `${caption}\n\n`;

});

await fs.writeFile(subtitleFile, srt);
// =========================
// DEBUG CAPTIONS
// =========================

console.log("================================");
console.log("CAPTIONS RECEIVED");
console.log("================================");

captions.forEach((caption, index) => {
    console.log(`Scene ${index + 1}: ${caption}`);
});

console.log("================================");
    const subtitleText = captions
    .map((c, i) => `${i + 1}. ${c}`)
    .join("\n");

console.log(subtitleText);

    let text = "";

    images.forEach((img) => {
        text += `file '${img}'\n`;
        text += "duration 5\n";
    });

    text += `file '${images[images.length - 1]}'\n`;

    await fs.writeFile(listFile, text);

    return new Promise((resolve, reject) => {

        const cmd = [
            "ffmpeg",
            "-y",

            "-f","concat",
            "-safe","0",
            "-i", `"${listFile}"`,

            "-vf",
`"scale=720:1280:force_original_aspect_ratio=increase,
crop=720:1280,
zoompan=
z='min(zoom+0.00010,1.03)':
x='iw/2-(iw/zoom/2)':
y='ih/2-(ih/zoom/2)':
d=96:
s=720x1280:
fps=24,
subtitles='${subtitleFile.replace(/\\/g, "/")}'"`,

            "-c:v","libx264",
            "-preset","veryfast",
            "-crf","22",
            "-pix_fmt","yuv420p",
            "-movflags","+faststart",

            `"${outputFile}"`

        ].join(" ");

        console.log(cmd);

        const child = exec(cmd);

        child.stdout.on("data", data => console.log(data.toString()));
        child.stderr.on("data", data => console.log(data.toString()));

        child.on("close", code => {

            if(code===0){
                resolve(outputFile);
            }else{
                reject(new Error("FFmpeg exited with code "+code));
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
