const fs = require("fs-extra");
const path = require("path");
const { v4: uuid } = require("uuid");
const { exec } = require("child_process");

const generateVoice = require("./voice");

const {
    downloadImages,
    createVideo
} = require("./ffmpeg");

const outputDir = path.join(__dirname, "output");
const voiceDir = path.join(__dirname, "voices");

// ======================================
// RUN COMMAND
// ======================================

function runCommand(command) {

    console.log("================================");
    console.log("Running command:");
    console.log(command);
    console.log("================================");

    return new Promise((resolve, reject) => {

        const child = exec(
            command,
            {
                shell: true,
                maxBuffer: 10 * 1024 * 1024
            }
        );

        child.stdout.on("data", data => {
            console.log(data.toString());
        });

        child.stderr.on("data", data => {
            console.log(data.toString());
        });

        child.on("error", error => {
            reject(error);
        });

        child.on("close", code => {

            if (code === 0) {
                resolve();
            } else {
                reject(
                    new Error(
                        `Command failed with code ${code}`
                    )
                );
            }

        });

    });

}

// ======================================
// CREATE SYNCHRONIZED VOICE
// ======================================

async function createSynchronizedVoice({
    captions,
    duration,
    jobId
}) {

    if (
        !Array.isArray(captions) ||
        captions.length === 0
    ) {

        return "";

    }

    await fs.ensureDir(voiceDir);

    const jobVoiceDir =
        path.join(
            voiceDir,
            jobId
        );

    await fs.ensureDir(jobVoiceDir);

    const sceneFiles = [];

    // ======================================
    // GENERATE ONE VOICE FILE PER SCENE
    // ======================================

    for (
        let i = 0;
        i < captions.length;
        i++
    ) {

        const text =
            String(captions[i] || "").trim();

        if (!text) {
            continue;
        }

        console.log(
            `Generating voice ${i + 1}/${captions.length}...`
        );

        const sceneId =
            `${jobId}_scene_${i + 1}`;

        const voiceFile =
            await generateVoice(
                text,
                sceneId
            );

        console.log(
            "Scene voice:",
            voiceFile
        );

        sceneFiles.push({
            file: voiceFile,
            index: i
        });

    }

    if (sceneFiles.length === 0) {

        return "";

    }

    // ======================================
    // CREATE PADDED SCENE AUDIO FILES
    // ======================================

    const paddedFiles = [];

    for (
        const scene of sceneFiles
    ) {

        const paddedFile =
            path.join(
                jobVoiceDir,
                `scene_${scene.index + 1}_padded.mp3`
            );

        const input =
            scene.file
                .replace(/\\/g, "/")
                .replace(/:/g, "\\:");

        const output =
            paddedFile
                .replace(/\\/g, "/")
                .replace(/:/g, "\\:");

        // Keep each voice clip exactly
        // the duration of its scene.
        //
        // If voice is shorter:
        // silence is added.
        //
        // If voice is longer:
        // it is trimmed.

        const command =
            `ffmpeg -y -i "${input}" ` +
            `-af "apad=pad_dur=${duration},atrim=duration=${duration}" ` +
            `-ar 44100 ` +
            `-ac 2 ` +
            `-c:a libmp3lame ` +
            `-b:a 192k ` +
            `"${output}"`;

        await runCommand(command);

        paddedFiles.push(paddedFile);

    }

    // ======================================
    // CREATE CONCAT LIST
    // ======================================

    const concatFile =
        path.join(
            jobVoiceDir,
            "voice_list.txt"
        );

    let list = "";

    for (
        const file of paddedFiles
    ) {

        const safePath =
            file.replace(/\\/g, "/");

        list +=
            `file '${safePath}'\n`;

    }

    await fs.writeFile(
        concatFile,
        list
    );

    // ======================================
    // FINAL SYNCHRONIZED VOICE
    // ======================================

    const finalVoice =
        path.join(
            voiceDir,
            `${jobId}_synchronized.mp3`
        );

    const safeConcat =
        concatFile.replace(/\\/g, "/");

    const safeFinal =
        finalVoice.replace(/\\/g, "/");

    const concatCommand =
        `ffmpeg -y ` +
        `-f concat ` +
        `-safe 0 ` +
        `-i "${safeConcat}" ` +
        `-c:a libmp3lame ` +
        `-b:a 192k ` +
        `"${safeFinal}"`;

    await runCommand(concatCommand);

    console.log(
        "Synchronized voice created:",
        finalVoice
    );

    return finalVoice;

}

// ======================================
// RENDER VIDEO
// ======================================

async function renderVideo(data) {

    let downloadedImages = [];

    let synchronizedVoice = "";

    try {

        const images =
            data.images || [];

        const captions =
            data.captions || [];

        // ======================================
        // VALIDATE IMAGES
        // ======================================

        if (
            !Array.isArray(images) ||
            images.length === 0
        ) {

            throw new Error(
                "No images supplied."
            );

        }

        console.log(
            "================================"
        );

        console.log(
            "AI SOCIAL RENDERER"
        );

        console.log(
            "================================"
        );

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

        await fs.ensureDir(
            outputDir
        );

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
                await fs.pathExists(
                    requestedPath
                )
            ) {

                music =
                    requestedPath;

            }

        }

        // ======================================
        // RANDOM MUSIC
        // ======================================

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

                music =
                    randomMusicPath;

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
                "Generating synchronized AI voice..."
            );

            synchronizedVoice =
                await createSynchronizedVoice({

                    captions,

                    duration:
                        durationPerScene,

                    jobId: id

                });

            voice =
                synchronizedVoice;

            console.log(
                "Synchronized voice:",
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
            await downloadImages(
                images,
                id
            );

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

            images:
                downloadedImages,

            captions,

            music,

            narration:
                voice,

            outputFile:
                outputVideo,

            duration:
                durationPerScene,

            jobId:
                id

        });

        // ======================================
        // CLEAN TEMP IMAGES
        // ======================================

        for (
            const file of downloadedImages
        ) {

            await fs.remove(
                file
            );

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

            status:
                "ready"

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

        // ======================================
        // CLEAN TEMP IMAGES
        // ======================================

        for (
            const file of downloadedImages
        ) {

            try {

                await fs.remove(
                    file
                );

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

            error:
                error.message

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

module.exports =
    renderVideo;
