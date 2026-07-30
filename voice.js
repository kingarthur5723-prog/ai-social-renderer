const { ttsSave } = require("edge-tts");
const path = require("path");
const fs = require("fs-extra");

async function generateVoice(text, jobId) {
    const voiceDir = path.join(__dirname, "voices");

    await fs.ensureDir(voiceDir);

    const output = path.join(voiceDir, `${jobId}.mp3`);

    await ttsSave(text, output, {
        voice: "en-US-GuyNeural",
        rate: "+0%",
        pitch: "+0Hz",
        volume: "+0%"
    });

    console.log("Voice created:", output);

    return output;
}

module.exports = generateVoice;
