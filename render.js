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

    // Ensure output folder exists
    const outputFolder = path.join(__dirname, "output");
    await fs.ensureDir(outputFolder);

    // Download all images
    console.log("Downloading images...");
    const downloadedImages = await downloadImages(images);

    console.log(downloadedImages);

    // Output MP4 path
    const videoFile = path.join(outputFolder, `${id}.mp4`);

    // Create slideshow video
    console.log("Rendering video...");
    await createVideo(downloadedImages, videoFile);

    console.log("Video created:", videoFile);

    return {
        success: true,
        jobId: id,
        video: `/output/${id}.mp4`,
        captions: captions.length,
        music: music,
        voice: voice
    };

}

module.exports = {
    downloadImages,
    createVideo
};
