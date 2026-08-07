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
