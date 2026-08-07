const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");
const { exec } = require("child_process");

// ======================================
// DOWNLOAD IMAGES
// ======================================

async function downloadImages(images) {

    const { v4: uuid } = require("uuid");

const jobId = uuid();

const uploadDir = path.join(__dirname, "uploads", jobId);

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
    const subtitleFile = path.join(uploadDir, "captions.ass");

    // ----------------------------
    // CREATE SRT SUBTITLES
    // ----------------------------

    let ass = `[Script Info]
ScriptType: v4.00+

[V4+ Styles]
Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding
Style: Default,Arial,18,&H00FFFFFF,&H00FFFFFF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,3,0,2,50,50,120,1

[Events]
Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text
`;

function assTime(sec){

const h=String(Math.floor(sec/3600)).padStart(1,"0");
const m=String(Math.floor((sec%3600)/60)).padStart(2,"0");
const s=(sec%60).toFixed(2).padStart(5,"0");

return `${h}:${m}:${s}`;

}

captions.forEach((caption,i)=>{

const start=i*duration;
const end=(i+1)*duration;

ass +=
`Dialogue: 0,${assTime(start)},${assTime(end)},Default,,0,0,0,,{\\fad(250,250)}${caption}\n`;

});

await fs.writeFile(subtitleFile, ass);

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
// CREATE IMAGE LIST
// (uses individual scene durations)
// ----------------------------

let list = "";

let sceneDurations = [];

if (hasVoice) {

    // Get voice duration
    const ffprobe = process.env.FFPROBE_PATH || "ffprobe";

    const voiceLength = await new Promise((resolve, reject) => {

        exec(
            `${ffprobe} -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${narration}"`,
            (err, stdout) => {

                if (err) return reject(err);

                resolve(parseFloat(stdout));

            }
        );

    });

    const each = voiceLength / images.length;

    sceneDurations = Array(images.length).fill(each);

} else {

    sceneDurations = Array(images.length).fill(duration);

}

images.forEach((image, i) => {

    list += `file '${image}'\n`;
    list += `duration ${sceneDurations[i]}\n`;

});

list += `file '${images[images.length - 1]}'\n`;

await fs.writeFile(listFile, list);

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

    const motions = [

{
zoom:"min(zoom+0.00060,1.18)",
x:"iw/2-(iw/zoom/2)",
y:"ih/2-(ih/zoom/2)"
},

{
zoom:"min(zoom+0.00045,1.15)",
x:"iw/2-(iw/zoom/2)-120+on*2",
y:"ih/2-(ih/zoom/2)"
},

{
zoom:"min(zoom+0.00045,1.15)",
x:"iw/2-(iw/zoom/2)+120-on*2",
y:"ih/2-(ih/zoom/2)"
},

{
zoom:"min(zoom+0.00050,1.20)",
x:"iw/2-(iw/zoom/2)",
y:"ih/2-(ih/zoom/2)-100+on*1.8"
},

{
zoom:"min(zoom+0.00050,1.20)",
x:"iw/2-(iw/zoom/2)",
y:"ih/2-(ih/zoom/2)+100-on*1.8"
}

];

const motion =
motions[Math.floor(Math.random()*motions.length)];

    const subtitlePath = subtitleFile
  .replace(/\\/g, "/")
  .replace(/:/g, "\\:");

    command.push(

"-vf",

`"scale=1350:2400:force_original_aspect_ratio=increase,
crop=1080:1920,
zoompan=
z='${motion.zoom}':
x='${motion.x}':
y='${motion.y}':
d=120:
s=1080x1920:
fps=30,
eq=contrast=1.08:brightness=0.03:saturation=1.18:gamma=1.05,
unsharp=5:5:1.2:5:5:0,
ass=${subtitlePath}

);

    if (hasVoice && hasMusic) {

        command.push(

    "-filter_complex",

    "[1:a]volume=1[narration];[2:a]volume=0.08[music];[narration][music]amix=inputs=2:duration=first:dropout_transition=2[audio]",

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
