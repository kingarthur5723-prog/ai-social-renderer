const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");
const { execFile } = require("child_process");

// ======================================
// DOWNLOAD IMAGES
// ======================================

async function downloadImages(images) {

    const uploadDir = path.join(__dirname, "uploads");

    await fs.ensureDir(uploadDir);

    const files = [];

    for (let i = 0; i < images.length; i++) {

        console.log(`Downloading image ${i + 1}/${images.length}`);

        const filename = path.join(
            uploadDir,
            `image_${i}.jpg`
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
    captions = [],
    music = "",
    narration = "",
    outputFile,
    duration = 5
}) {

    const uploadDir = path.join(__dirname, "uploads");

    await fs.ensureDir(uploadDir);

    const listFile = path.join(
        uploadDir,
        "list.txt"
    );

    const subtitleFile = path.join(
        uploadDir,
        "captions.srt"
    );

    // ======================================
    // VALIDATE IMAGES
    // ======================================

    if (!images || images.length === 0) {
        throw new Error("No images supplied.");
    }

    console.log("Images:", images.length);

    // ======================================
    // CREATE SUBTITLE FILE
    // ======================================

    let srt = "";

    function formatTime(seconds) {

        const hrs = String(
            Math.floor(seconds / 3600)
        ).padStart(2, "0");

        const mins = String(
            Math.floor((seconds % 3600) / 60)
        ).padStart(2, "0");

        const secs = String(
            Math.floor(seconds % 60)
        ).padStart(2, "0");

        return `${hrs}:${mins}:${secs},000`;
    }

    captions.forEach((caption, index) => {

        const start = index * duration;
        const end = (index + 1) * duration;

        srt += `${index + 1}\n`;
        srt += `${formatTime(start)} --> ${formatTime(end)}\n`;
        srt += `${caption}\n\n`;

    });

    await fs.writeFile(
        subtitleFile,
        srt,
        "utf8"
    );

    // ======================================
    // CREATE IMAGE LIST
    // ======================================

    let list = "";

    images.forEach(image => {

        const safeImage = image
            .replace(/\\/g, "/")
            .replace(/'/g, "'\\''");

        list += `file '${safeImage}'\n`;
        list += `duration ${duration}\n`;

    });

    // Repeat final image so concat honors
    // the final duration.
    const lastImage = images[images.length - 1]
        .replace(/\\/g, "/")
        .replace(/'/g, "'\\''");

    list += `file '${lastImage}'\n`;

    await fs.writeFile(
        listFile,
        list,
        "utf8"
    );

    // ======================================
    // CHECK AUDIO
    // ======================================

    const hasVoice =
        narration &&
        await fs.pathExists(narration);

    const hasMusic =
        music &&
        await fs.pathExists(music);

    console.log("Voice:", hasVoice);
    console.log("Music:", hasMusic);

    // ======================================
    // SUBTITLE PATH
    // ======================================

    let subtitlePath = subtitleFile
        .replace(/\\/g, "/");

    // Escape characters required by FFmpeg
    subtitlePath = subtitlePath
        .replace(/:/g, "\\:")
        .replace(/'/g, "\\'");

    // ======================================
    // VIDEO FILTER
    // ======================================

    const videoFilter =
        "scale=1080:1920:force_original_aspect_ratio=increase," +
        "crop=1080:1920," +
        "zoompan=" +
        "z='min(zoom+0.00010,1.03)':" +
        "x='iw/2-(iw/zoom/2)':" +
        "y='ih/2-(ih/zoom/2)':" +
        "d=120:" +
        "s=1080x1920:" +
        "fps=24," +
        "eq=contrast=1.08:brightness=0.03:saturation=1.18:gamma=1.05," +
        "unsharp=5:5:1.2:5:5:0," +
        `subtitles='${subtitlePath}'`;

    console.log("Video filter:");
    console.log(videoFilter);

    // ======================================
    // BUILD FFMPEG ARGUMENTS
    // ======================================

    const args = [
        "-y",

        "-f",
        "concat",

        "-safe",
        "0",

        "-i",
        listFile
    ];

    // ======================================
    // VOICE INPUT
    // ======================================

    if (hasVoice) {

        args.push(
            "-i",
            narration
        );

    }

    // ======================================
    // MUSIC INPUT
    // ======================================

    if (hasMusic) {

        args.push(
            "-i",
            music
        );

    }

    // ======================================
    // VIDEO FILTER
    // ======================================

    args.push(
        "-vf",
        videoFilter
    );

    // ======================================
    // AUDIO MIXING
    // ======================================

    if (hasVoice && hasMusic) {

        args.push(

            "-filter_complex",

            "[1:a]volume=1[narration];" +
            "[2:a]volume=0.15[music];" +
            "[narration][music]" +
            "amix=inputs=2:duration=longest:dropout_transition=2[audio]",

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

    // ======================================
    // OUTPUT SETTINGS
    // ======================================

    args.push(

        "-c:v",
        "libx264",

        "-preset",
        "medium",

        "-crf",
        "20",

        "-pix_fmt",
        "yuv420p",

        "-c:a",
        "aac",

        "-b:a",
        "192k",

        "-movflags",
        "+faststart",

        outputFile

    );

    // ======================================
    // LOG COMMAND
    // ======================================

    console.log("================================");
    console.log("FFMPEG STARTING");
    console.log("================================");

    console.log(
        "ffmpeg " +
        args
            .map(arg => `"${arg}"`)
            .join(" ")
    );

    console.log("================================");

    // ======================================
    // RUN FFMPEG
    // ======================================

    return new Promise((resolve, reject) => {

        const child = execFile(
            "ffmpeg",
            args,
            {
                windowsHide: true,
                maxBuffer: 20 * 1024 * 1024
            }
        );

        let stderr = "";
        let stdout = "";

        child.stdout.on(
            "data",
            data => {

                const text = data.toString();

                stdout += text;

                console.log(text);

            }
        );

        child.stderr.on(
            "data",
            data => {

                const text = data.toString();

                stderr += text;

                console.log(text);

            }
        );

        child.on(
            "error",
            err => {

                console.error(
                    "Failed to start FFmpeg:",
                    err
                );

                reject(err);

            }
        );

        child.on(
            "close",
            code => {

                console.log(
                    "FFmpeg exit code:",
                    code
                );

                if (code === 0) {

                    resolve(outputFile);

                }

                else {

                    console.error(
                        "================================"
                    );

                    console.error(
                        "FFMPEG FAILED"
                    );

                    console.error(
                        stderr
                    );

                    console.error(
                        "================================"
                    );

                    reject(
                        new Error(
                            `FFmpeg exited with code ${code}`
                        )
                    );

                }

            }
        );

    });

}


// ======================================
// EXPORTS
// ======================================

module.exports = {

    downloadImages,

    createVideo

};
