const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");
const { exec } = require("child_process");
const { v4: uuid } = require("uuid");

// ======================================
// DOWNLOAD IMAGES
// ======================================

async function downloadImages(images) {

    const jobId = uuid();

    const uploadDir = path.join(
        __dirname,
        "uploads",
        jobId
    );

    await fs.ensureDir(uploadDir);

    const files = [];

    for (let i = 0; i < images.length; i++) {

        const file = path.join(
            uploadDir,
            `image_${i}.jpg`
        );

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

    console.log("Downloaded:", files);

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

    // ======================================
    // JOB FILES
    // ======================================

    const uploadDir = path.dirname(images[0]);

    const listFile = path.join(
        uploadDir,
        "list.txt"
    );

    const subtitleFile = path.join(
        uploadDir,
        "captions.ass"
    );

    // ======================================
    // CREATE ASS SUBTITLES
    // ======================================

    let ass = `[Script Info]
ScriptType: v4.00+

[V4+ Styles]
Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding
Style: Default,Arial,18,&H00FFFFFF,&H00FFFFFF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,3,0,2,50,50,120,1

[Events]
Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text
`;

    // ======================================
    // ASS TIME FORMAT
    // ======================================

    function assTime(sec) {

        const h = String(
            Math.floor(sec / 3600)
        ).padStart(1, "0");

        const m = String(
            Math.floor((sec % 3600) / 60)
        ).padStart(2, "0");

        const s = (
            sec % 60
        ).toFixed(2).padStart(5, "0");

        return `${h}:${m}:${s}`;
    }

    // ======================================
    // ADD CAPTIONS
    // ======================================

    captions.forEach((caption, i) => {

        const start = i * duration;

        const end = (i + 1) * duration;

        // Protect ASS special characters
        const safeCaption = String(caption)
            .replace(/\\/g, "\\\\")
            .replace(/\{/g, "\\{")
            .replace(/\}/g, "\\}");

        ass +=
            `Dialogue: 0,${assTime(start)},${assTime(end)},Default,,0,0,0,,{\\fad(250,250)}${safeCaption}\n`;

    });

    // ======================================
    // SAVE SUBTITLE FILE
    // ======================================

    await fs.writeFile(
        subtitleFile,
        ass,
        "utf8"
    );

    console.log(
        "Subtitle file created:",
        subtitleFile
    );

    // ======================================
    // CHECK AUDIO
    // ======================================

    const hasVoice =
        Boolean(narration) &&
        await fs.pathExists(narration);

    const hasMusic =
        Boolean(music) &&
        await fs.pathExists(music);

    console.log(
        "Voice:",
        hasVoice
    );

    console.log(
        "Music:",
        hasMusic
    );
    
    // ======================================
    // CREATE IMAGE LIST
    // ======================================

    let list = "";

    let sceneDurations = [];

    // ======================================
    // GET VOICE DURATION
    // ======================================

    if (hasVoice) {

        const ffprobe =
            process.env.FFPROBE_PATH || "ffprobe";

        console.log(
            "Getting voice duration..."
        );

        const voiceLength =
            await new Promise((resolve, reject) => {

                exec(
                    `${ffprobe} -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${narration}"`,
                    (err, stdout, stderr) => {

                        if (err) {

                            console.error(
                                "FFprobe error:",
                                stderr
                            );

                            return reject(err);
                        }

                        const durationValue =
                            parseFloat(stdout);

                        if (
                            !Number.isFinite(
                                durationValue
                            )
                        ) {

                            return reject(
                                new Error(
                                    "Could not determine voice duration"
                                )
                            );

                        }

                        resolve(
                            durationValue
                        );

                    }
                );

            });

        console.log(
            "Voice duration:",
            voiceLength,
            "seconds"
        );

        // ======================================
        // DIVIDE VOICE ACROSS IMAGES
        // ======================================

        const each =
            voiceLength / images.length;

        sceneDurations =
            Array(images.length).fill(each);

    } else {

        // ======================================
        // NO VOICE
        // USE DEFAULT DURATION
        // ======================================

        sceneDurations =
            Array(images.length).fill(
                duration
            );

    }

    console.log(
        "Scene durations:",
        sceneDurations
    );

    // ======================================
    // BUILD CONCAT LIST
    // ======================================

    images.forEach((image, i) => {

        list +=
            `file '${image}'\n`;

        list +=
            `duration ${sceneDurations[i]}\n`;

    });

    // ======================================
    // REPEAT LAST IMAGE
    // REQUIRED BY CONCAT DEMUXER
    // ======================================

    list +=
        `file '${images[images.length - 1]}'\n`;

    // ======================================
    // SAVE LIST FILE
    // ======================================

    await fs.writeFile(
        listFile,
        list,
        "utf8"
    );

    console.log(
        "FFmpeg image list created:",
        listFile
    );

    // ======================================
    // BUILD FFMPEG COMMAND
    // ======================================

    const ffmpeg =
        process.env.FFMPEG_PATH || "ffmpeg";

    let command = [
        ffmpeg,
        "-y",

        "-f",
        "concat",

        "-safe",
        "0",

        "-i",
        `"${listFile}"`
    ];

    // ======================================
    // ADD VOICE INPUT
    // ======================================

    if (hasVoice) {

        command.push(
            "-i",
            `"${narration}"`
        );

    }

    // ======================================
    // ADD MUSIC INPUT
    // ======================================

    if (hasMusic) {

        command.push(
            "-stream_loop",
            "-1",

            "-i",
            `"${music}"`
        );

    }

    // ======================================
    // CINEMATIC MOTIONS
    // ======================================

    const motions = [

        {
            zoom: "min(zoom+0.00060,1.18)",
            x: "iw/2-(iw/zoom/2)",
            y: "ih/2-(ih/zoom/2)"
        },

        {
            zoom: "min(zoom+0.00045,1.15)",
            x: "iw/2-(iw/zoom/2)-120+on*2",
            y: "ih/2-(ih/zoom/2)"
        },

        {
            zoom: "min(zoom+0.00045,1.15)",
            x: "iw/2-(iw/zoom/2)+120-on*2",
            y: "ih/2-(ih/zoom/2)"
        },

        {
            zoom: "min(zoom+0.00050,1.20)",
            x: "iw/2-(iw/zoom/2)",
            y: "ih/2-(ih/zoom/2)-100+on*1.8"
        },

        {
            zoom: "min(zoom+0.00050,1.20)",
            x: "iw/2-(iw/zoom/2)",
            y: "ih/2-(ih/zoom/2)+100-on*1.8"
        }

    ];

    const motion =
        motions[
            Math.floor(
                Math.random() * motions.length
            )
        ];

    console.log(
        "Selected motion:",
        motion
    );

    // ======================================
    // SUBTITLE PATH
    // ======================================

    const subtitlePath =
        subtitleFile
            .replace(/\\/g, "/")
            .replace(/:/g, "\\:");

    // ======================================
    // VIDEO FILTER
    // ======================================

    const videoFilter =
        [
            "scale=1350:2400:force_original_aspect_ratio=increase",

            "crop=1080:1920",

            `zoompan=z='${motion.zoom}':x='${motion.x}':y='${motion.y}':d=120:s=1080x1920:fps=30`,

            "eq=contrast=1.08:brightness=0.03:saturation=1.18:gamma=1.05",

            "unsharp=5:5:1.2:5:5:0",

            `ass='${subtitlePath}'`
        ].join(",");

    // ======================================
    // ADD VIDEO FILTER
    // ======================================

    command.push(
        "-vf",
        `"${videoFilter}"`
    );

    // ======================================
    // AUDIO MIXING
    // ======================================

    if (hasVoice && hasMusic) {

        const audioFilter =
            "[1:a]volume=1[narration];" +
            "[2:a]volume=0.08[music];" +
            "[narration][music]" +
            "amix=inputs=2:" +
            "duration=first:" +
            "dropout_transition=2" +
            "[audio]";

        command.push(
            "-filter_complex",
            `"${audioFilter}"`,

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

    else {

        command.push(
            "-map",
            "0:v"
        );

    }
    
    // ======================================
    // OUTPUT / QUALITY SETTINGS
    // ======================================

    command.push(

        "-c:v",
        "libx264",

        "-preset",
        "faster",

        "-crf",
        "17",

        "-profile:v",
        "high",

        "-level",
        "4.2",

        "-g",
        "60",

        "-bf",
        "2",

        "-maxrate",
        "8M",

        "-bufsize",
        "16M",

        "-pix_fmt",
        "yuv420p",

        "-c:a",
        "aac",

        "-af",
        "loudnorm",

        "-b:a",
        "320k",

        "-shortest",

        "-movflags",
        "+faststart",

        "-threads",
        "0",

        `"${outputFile}"`
    );

    // ======================================
    // CREATE FINAL COMMAND
    // ======================================

    const cmd =
        command.join(" ");

    console.log(
        "===================================="
    );

    console.log(
        "FINAL FFMPEG COMMAND:"
    );

    console.log(cmd);

    console.log(
        "===================================="
    );
