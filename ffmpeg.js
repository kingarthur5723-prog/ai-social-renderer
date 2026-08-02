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

        const file = path.join(uploadDir, `image_${i}.jpg`);

        console.log("Downloading:", images[i]);

        const response = await axios({
            url: images[i],
            method: "GET",
            responseType: "stream"
        });

        await new Promise((resolve, reject) => {

            const writer = fs.createWriteStream(file);

            response.data.pipe(writer);

            writer.on("finish", resolve);
            writer.on("error", reject);

        });

        files.push(file);

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

    const listFile = path.join(uploadDir, "list.txt");
    const subtitleFile = path.join(uploadDir, "captions.srt");

    // ----------------------------
    // CREATE SRT SUBTITLES
    // ----------------------------

    let srt = "";

    function formatTime(seconds) {

        const hh = String(Math.floor(seconds / 3600)).padStart(2, "0");
        const mm = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
        const ss = String(Math.floor(seconds % 60)).padStart(2, "0");

        return `${hh}:${mm}:${ss},000`;

    }

    captions.forEach((caption, i) => {

        const start = i * duration;
        const end = (i + 1) * duration;

        srt += `${i + 1}\n`;
        srt += `${formatTime(start)} --> ${formatTime(end)}\n`;
        srt += `${caption}\n\n`;

    });

    await fs.writeFile(subtitleFile, srt);

    // ----------------------------
    // CREATE IMAGE LIST
    // ----------------------------

    let list = "";

    images.forEach(image => {

        list += `file '${image}'\n`;
        list += `duration ${duration}\n`;

    });

    list += `file '${images[images.length - 1]}'\n`;

    await fs.writeFile(listFile, list);

    // ----------------------------
    // CHECK AUDIO
    // ----------------------------

    const hasVoice =
        narration &&
        await fs.pathExists(narration);

    const hasMusic =
        music &&
        await fs.pathExists(music);

    console.log("Voice:", hasVoice);
    console.log("Music:", hasMusic);

    // ----------------------------
    // BUILD FFMPEG COMMAND
    // ----------------------------

    let command = [

        process.env.FFMPEG_PATH || "ffmpeg",
        "-y",

        "-f",
        "concat",

        "-safe",
        "0",

        "-i",
        `"${listFile}"`

    ];

    if (hasVoice) {

        command.push(
            "-i",
            `"${narration}"`
        );

    }

    if (hasMusic) {

        command.push(
            "-stream_loop",
            "-1",
            "-i",
            `"${music}"`
        );

    }

    const subtitlePath =
        subtitleFile
            .replace(/\\/g, "/")
            .replace(/:/g, "\\:");

    command.push(

        "-vf",

        `"scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,zoompan=z='min(zoom+0.00010,1.03)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=96:s=720x1280:fps=24,subtitles='${subtitlePath}'"`

    );

    if (hasVoice && hasMusic) {

        command.push(

            "-filter_complex",

            `"[1:a]volume=1[narration];[2:a]volume=0.15[music];[narration][music]amix=inputs=2:duration=first:dropout_transition=2[audio]"`,

            "-map",
            "0:v",

            "-map",
            "[audio]"

        );

    }
    else if (hasVoice) {

        command.push(

            "-map",
            "0:v",

            "-map",
            "1:a"

        );

    }
    else if (hasMusic) {

        command.push(

            "-map",
            "0:v",

            "-map",
            "1:a"

        );

    }
    
    // ----------------------------
    // OUTPUT SETTINGS
    // ----------------------------

    command.push(

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

        "-shortest",

        "-movflags",
        "+faststart",

        `"${outputFile}"`

    );

    const cmd = command.join(" ");

    console.log("====================================");
    console.log(cmd);
    console.log("====================================");

    return new Promise((resolve, reject) => {

        const child = exec(cmd);

        child.stdout.on("data", data => {
            console.log(data.toString());
        });

        child.stderr.on("data", data => {
            console.log(data.toString());
        });

        child.on("close", code => {

            if (code === 0) {

                resolve(outputFile);

            } else {

                reject(new Error("FFmpeg failed with exit code " + code));

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
