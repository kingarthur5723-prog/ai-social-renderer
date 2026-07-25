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

    if (!Array.isArray(images) || images.length === 0) {
        throw new Error("No images supplied.");
    }

    // Create unique job ID
    const id = uuid();

    // Ensure output directory exists
    const outputDir = path.join(__dirname, "output");
    await fs.ensureDir(outputDir);

    // Download images
    console.log("Downloading images...");
    const downloadedImages = await downloadImages(images);

    console.log("Downloaded:", downloadedImages);

    // Output video path
    const outputVideo = path.join(outputDir, `${id}.mp4`);

    // Build slideshow
    console.log("Rendering video...");
    await createVideo(downloadedImages, outputVideo);

    console.log("Render completed.");

    return {
        success: true,
        jobId: id,
        video: `/output/${id}.mp4`,
        captions,
        music,
        voice
    };

}

module.exports = renderVideo;
