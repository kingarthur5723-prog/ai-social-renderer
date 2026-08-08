const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");
const { spawn } = require("child_process");

// ======================================
// DOWNLOAD IMAGES
// ======================================

async function downloadImages(images, jobId) {

    const uploadDir = path.join(
        __dirname,
        "uploads",
        jobId
    );

    await fs.ensureDir(uploadDir);

    const files = [];

    for (let i = 0; i < images.length; i++) {

        console.log(
            `Downloading image ${i + 1}/${images.length}`
        );

        const filename = path.join(
            uploadDir,
            `image_${i}.jpg`
        );

        const response = await axios({
            url: images[i],
            method: "GET",
            responseType: "stream",
            timeout: 60000
        });

        await new Promise((resolve, reject) => {

            const writer =
                fs.createWriteStream(filename);

            response.data.pipe(writer);

            writer.on("finish", resolve);
            writer.on("error", reject);

        });

        files.push(filename);
    }

    console.log(
        "Images downloaded:",
        files.length
    );

    return files;
}


// ======================================
// FORMAT SRT TIME
// ======================================

function formatTime(seconds) {

    const hrs =
        String(Math.floor(seconds / 3600))
            .padStart(2, "0");

    const mins =
        String(Math.floor((seconds % 3600) / 60))
            .padStart(2, "0");

    const secs =
        String(Math.floor(seconds % 60))
            .padStart(2, "0");

    const millis =
        String(
            Math.floor((seconds % 1) * 1000)
        ).padStart(3, "0");

    return `${hrs}:${mins}:${secs},${millis}`;
}


// ======================================
// CREATE SUBTITLES
// ======================================

async function createSubtitleFile(
    captions,
    duration,
    subtitleFile
) {

    let srt = "";

    captions.forEach((caption, index) => {

        const start =
            index * duration;

        const end =
            (index + 1) * duration;

        srt += `${index + 1}\n`;
        srt += `${formatTime(start)} --> ${formatTime(end)}\n`;
        srt += `${caption || ""}\n\n`;

    });

    await fs.writeFile(
        subtitleFile,
        srt,
        "utf8"
    );
}


// ======================================
// CREATE CONCAT LIST
// ======================================

async function createImageList(
    images,
    duration,
    listFile
) {

    let list = "";

    for (const image of images) {

        const safePath =
            image
                .replace(/\\/g, "/")
                .replace(/'/g, "'\\''");

        list += `file '${safePath}'\n`;
        list += `duration ${duration}\n`;
    }

    // Required by concat demuxer
    const lastImage =
        images[images.length - 1]
            .replace(/\\/g, "/")
            .replace(/'/g, "'\\''");

    list += `file '${lastImage}'\n`;

    await fs.writeFile(
        listFile,
        list,
        "utf8"
    );
}


// ======================================
// RUN FFMPEG
// ======================================

function runFFmpeg(args) {

    return new Promise((resolve, reject) => {

        console.log("");
        console.log("================================");
        console.log("STARTING FFMPEG");
        console.log("================================");

        console.log(
            "ffmpeg",
            args.join(" ")
        );

        const child = spawn(
            "ffmpeg",
            args,
            {
                stdio: [
                    "ignore",
                    "pipe",
                    "pipe"
                ]
            }
        );

        let stderr = "";

        child.stdout.on(
            "data",
            data => {

                process.stdout.write(
                    data.toString()
                );

            }
        );

        child.stderr.on(
            "data",
            data => {

                const text =
                    data.toString();

                stderr += text;

                process.stdout.write(text);

            }
        );

        child.on(
            "error",
            error => {

                console.error(
                    "FFmpeg process error:",
                    error
                );

                reject(error);

            }
        );

        child.on(
            "close",
            (code, signal) => {

                console.log("");
                console.log(
                    "FFmpeg closed.",
                    "code:",
                    code,
                    "signal:",
                    signal
                );

                if (code === 0) {

                    resolve();

                    return;
                }

                const message =
                    signal
                        ? `FFmpeg was terminated by signal ${signal}`
                        : `FFmpeg exited with code ${code}`;

                const error =
                    new Error(message);

                error.stderr = stderr;

                reject(error);
            }
        );

    });
}


// ======================================
// CREATE VIDEO
// ======================================

async function createVideo({

    images,
    captions = [],
    music = "",
    narration = "",
    outputFile,
    duration = 5,
    jobId

}) {

    if (
        !Array.isArray(images) ||
        images.length === 0
    ) {

        throw new Error(
            "No images supplied to createVideo."
        );

    }

    const tempDir =
        path.join(
            __dirname,
            "temp",
            jobId || "render"
        );

    await fs.ensureDir(tempDir);

    const listFile =
        path.join(
            tempDir,
            "images.txt"
        );

    const subtitleFile =
        path.join(
            tempDir,
            "captions.srt"
        );

    // ==================================
    // CREATE FILES
    // ==================================

    await createImageList(
        images,
        duration,
        listFile
    );

    if (captions.length > 0) {

        await createSubtitleFile(
            captions,
            duration,
            subtitleFile
        );

    }

    // ==================================
    // CHECK AUDIO
    // ==================================

    const hasVoice =
        narration &&
        await fs.pathExists(narration);

    const hasMusic =
        music &&
        await fs.pathExists(music);

    console.log(
        "Voice:",
        hasVoice
    );

    console.log(
        "Music:",
        hasMusic
    );

    // ==================================
    // FFMPEG INPUTS
    // ==================================

    const args = [

        "-y",

        "-hide_banner",

        "-loglevel",
        "warning",

        "-f",
        "concat",

        "-safe",
        "0",

        "-i",
        listFile
    ];

    // Voice
    if (hasVoice) {

        args.push(
            "-i",
            narration
        );

    }

    // Music
    if (hasMusic) {

        args.push(
            "-stream_loop",
            "-1",
            "-i",
            music
        );

    }

    // ==================================
    // VIDEO FILTER
    // ==================================

    let videoFilter =

        "scale=720:1280:force_original_aspect_ratio=increase," +
        "crop=720:1280";

    // Add subtitles only if captions exist

    if (
        captions.length > 0 &&
        await fs.pathExists(subtitleFile)
    ) {

        const subtitlePath =
            subtitleFile
                .replace(/\\/g, "/")
                .replace(/:/g, "\\:");

        videoFilter +=
            `,subtitles='${subtitlePath}'`;

    }

    args.push(
        "-vf",
        videoFilter
    );

    // ==================================
    // AUDIO
    // ==================================

    if (hasVoice && hasMusic) {

        /*
         * Input 0 = images
         * Input 1 = voice
         * Input 2 = music
         */

        args.push(

            "-filter_complex",

            "[1:a]volume=1[narration];" +
            "[2:a]volume=0.15[music];" +
            "[narration][music]" +
            "amix=inputs=2:" +
            "duration=first:" +
            "dropout_transition=2[audio]",

            "-map",
            "0:v",

            "-map",
            "[audio]"

        );

    }

    else if (hasVoice) {

        args.push(

            "-map",
            "0:v",

            "-map",
            "1:a"

        );

    }

    else if (hasMusic) {

        args.push(

            "-map",
            "0:v",

            "-map",
            "1:a"

        );

    }

    else {

        args.push(
            "-map",
            "0:v"
        );

    }

    // ==================================
    // VIDEO OUTPUT
    // ==================================

    args.push(

        "-c:v",
        "libx264",

        "-preset",
        "veryfast",

        "-crf",
        "21",

        "-pix_fmt",
        "yuv420p",

        "-r",
        "24"

    );

    // ==================================
    // AUDIO OUTPUT
    // ==================================

    if (
        hasVoice ||
        hasMusic
    ) {

        args.push(

            "-c:a",
            "aac",

            "-b:a",
            "128k"

        );

    }

    // ==================================
    // MP4
    // ==================================

    args.push(

        "-movflags",
        "+faststart",

        "-shortest",

        outputFile

    );

    // ==================================
    // RUN
    // ==================================

    try {

        await runFFmpeg(args);

        console.log("");
        console.log(
            "================================"
        );
        console.log(
            "VIDEO RENDER COMPLETE"
        );
        console.log(
            "================================"
        );

        return outputFile;

    }

    catch (error) {

        console.error("");
        console.error(
            "================================"
        );
        console.error(
            "FFMPEG FAILED"
        );
        console.error(
            "================================"
        );

        console.error(
            error.message
        );

        if (error.stderr) {

            console.error(
                error.stderr.slice(-5000)
            );

        }

        throw error;

    }

}


// ======================================
// EXPORTS
// ======================================

module.exports = {

    downloadImages,
    createVideo

};
