const { EdgeTTS } = require("edge-tts");
const path = require("path");
const fs = require("fs-extra");


async function generateVoice(text, jobId) {


    const voiceDir =
        path.join(__dirname,"voices");


    await fs.ensureDir(voiceDir);


    const output =
        path.join(
            voiceDir,
            `${jobId}.mp3`
        );


    const tts =
        new EdgeTTS();


    await tts.synthesize(
        text,
        "en-US-GuyNeural",
        output
    );


    console.log(
        "Voice created:",
        output
    );


    return output;

}


module.exports = generateVoice;
