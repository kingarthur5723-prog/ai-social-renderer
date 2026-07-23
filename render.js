const fs = require("fs-extra");
const path = require("path");
const { v4: uuid } = require("uuid");

const {
    downloadImages,
    createVideo
} = require("./ffmpeg");

async function renderVideo(data) {

    const images = data.images || [];
    const captions = data.captions || [];
    const music = data.music || "";
    const voice = data.voice || "";

    if (images.length === 0) {
        throw new Error("No images supplied.");
    }

    const id = uuid();

const downloadedImages = await downloadImages(images);
const outputFolder = path.join(__dirname, "output");

await fs.ensureDir(outputFolder);

const videoFile = path.join(
    outputFolder,
    `${id}.mp4`
);

await createVideo(
    downloadedImages,
    videoFile
);
console.log(downloadedImages);

    // Placeholder until FFmpeg is connected
    const outputFile = path.join(__dirname, "output", `${id}.json`);

    await fs.writeJson(outputFile, {
        id,
        images,
        captions,
        music,
        voice,
        created: new Date().toISOString()
    }, { spaces: 2 });

    return {
        success: true,
        message: "Render request received.",
        jobId: id,
        next: "FFmpeg rendering will be added next.",
        debugFile: `/videos/${id}.json`
    };
}

module.exports = renderVideo;
