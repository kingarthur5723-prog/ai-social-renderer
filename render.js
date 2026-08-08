const fs = require("fs-extra");
const path = require("path");
const { v4: uuid } = require("uuid");

const generateVoice = require("./voice");

const {
    downloadImages,
    createVideo
} = require("./ffmpeg");

const outputDir = path.join(__dirname, "output");


// ======================================
// RENDER VIDEO
// ======================================

async function renderVideo(data) {

    let downloadedImages = [];

    try {

        const images = data.images || [];
        const captions = data.captions || [];

        // ======================================
        // VALIDATE IMAGES
        // ======================================

        if (!Array.isArray(images) || images.length === 0) {

            throw new Error("No images supplied.");

        }

        console.log("================================");
        console.log("AI SOCIAL RENDERER");
        console.log("================================");

        console.log(
            "Images received:",
            images.length
        );

        console.log(
            "Captions received:",
            captions.length
        );

        // ======================================
        // DURATION
        // ======================================

        const durationPerScene =
            Number(data.duration) || 5;

        console.log(
            "Duration per scene:",
            durationPerScene
        );

        // ======================================
        // UNIQUE JOB ID
        // ======================================

        const id = uuid();

        console.log(
            "Job ID:",
            id
        );

        // ======================================
        // OUTPUT DIRECTORY
        // ======================================

        await fs.ensureDir(outputDir);

        // ======================================
        // MUSIC
        // ======================================

        let music = "";

        const tracks = [
            "upbeat.mp3",
            "relaxing.mp3",
            "cinematic.mp3",
            "corporate.mp3",
            "motivational.mp3"
        ];

        const requestedMusic =
            data.music || "";

        if (
            requestedMusic &&
            typeof requestedMusic === "string"
        ) {

            const requestedPath =
                path.join(
                    __dirname,
                    "assets",
                    requestedMusic
                );

            if (
                await fs.pathExists(requestedPath)
            ) {

                music = requestedPath;

            }

        }

        // If no music was supplied,
        // choose a random built-in track.

        if (!music) {

            const randomTrack =
                tracks[
                    Math.floor(
                        Math.random() *
                        tracks.length
                    )
                ];

            const randomMusicPath =
                path.join(
                    __dirname,
                    "assets",
                    randomTrack
                );

            if (
                await fs.pathExists(
                    randomMusicPath
                )
            ) {

                music = randomMusicPath;

            }

        }

        console.log(
            "Selected music:",
            music || "NONE"
        );

        // ======================================
        // VOICE
        // ======================================

        let voice = "";

        console.log(
            "Voice text received:"
        );

        console.log(
            data.voice || ""
        );

        if (
            data.voice &&
            typeof data.voice === "string" &&
            data.voice.trim() !== ""
        ) {

            console.log(
                "Generating AI voice..."
            );

            voice =
                await generateVoice(
                    data.voice,
                    id
                );

            console.log(
                "Generated voice file:",
                voice
            );

        }

        // ======================================
        // DOWNLOAD IMAGES
        // ======================================

        console.log(
            "Downloading images..."
        );

        downloadedImages =
            await downloadImages(images);

        console.log(
            "Downloaded images:",
            downloadedImages
        );

        // ======================================
        // OUTPUT VIDEO
        // ======================================

        const outputVideo =
            path.join(
                outputDir,
                `${id}.mp4`
            );

        console.log(
            "Output:",
            outputVideo
        );

        // ======================================
        // RENDER
        // ======================================

        console.log(
            "================================"
        );

        console.log(
            "Starting FFmpeg..."
        );

        console.log(
            "================================"
        );

        await createVideo({

            images: downloadedImages,

            captions,

            music,

            narration: voice,

            outputFile: outputVideo,

            duration: durationPerScene

        });

        // ======================================
        // CLEAN TEMP IMAGES
        // ======================================

        for (
            const file of downloadedImages
        ) {

            await fs.remove(file);

        }

        downloadedImages = [];

        console.log(
            "Temporary images cleaned."
        );

        // ======================================
        // TOTAL DURATION
        // ======================================

        const totalDuration =
            images.length *
            durationPerScene;

        console.log(
            "Total duration:",
            totalDuration,
            "seconds"
        );

        console.log(
            "================================"
        );

        console.log(
            "RENDER COMPLETED"
        );

        console.log(
            "================================"
        );

        // ======================================
        // RESPONSE
        // ======================================

        return {

            success: true,

            jobId: id,

            video:
                `/output/${id}.mp4`,

            captions,

            music,

            voice,

            duration:
                `${totalDuration} seconds`,

            platforms: [

                "facebook",
                "instagram",
                "tiktok"

            ],

            status: "ready"

        };

    }

    catch (error) {

        console.error(
            "================================"
        );

        console.error(
            "RENDER FAILED"
        );

        console.error(
            error
        );

        console.error(
            "================================"
        );

        // Clean temporary images
        // if something failed.

        for (
            const file of downloadedImages
        ) {

            try {

                await fs.remove(file);

            }

            catch (cleanupError) {

                console.error(
                    "Cleanup error:",
                    cleanupError.message
                );

            }

        }

        return {

            success: false,

            error: error.message

        };

    }

}


// ======================================
// DELETE OLD VIDEOS
// Runs every hour
// ======================================

setInterval(
    async () => {

        try {

            await fs.ensureDir(
                outputDir
            );

            const files =
                await fs.readdir(
                    outputDir
                );

            for (
                const file of files
            ) {

                const full =
                    path.join(
                        outputDir,
                        file
                    );

                const stats =
                    await fs.stat(
                        full
                    );

                const age =
                    Date.now() -
                    stats.mtimeMs;

                // Delete videos older
                // than 24 hours.

                if (
                    age > 86400000
                ) {

                    await fs.remove(
                        full
                    );

                    console.log(
                        "Deleted old video:",
                        file
                    );

                }

            }

        }

        catch (error) {

            console.error(
                "Cleanup error:",
                error.message
            );

        }

    },
    3600000
);


// ======================================
// EXPORT
// ======================================

module.exports = renderVideo;
