const { EdgeTTS } = require("node-edge-tts");
const path = require("path");
const fs = require("fs-extra");

async function generateVoice(text, jobId) {
    const voiceDir = path.join(__dirname, "voices");
    await fs.ensureDir(voiceDir);

    const output = path.join(voiceDir, `${jobId}.mp3`);

    const tts = new EdgeTTS({
        voice: "en-US-GuyNeural",
        lang: "en-US",
        outputFormat: "audio-24khz-48kbitrate-mono-mp3",
        pitch: "default",
        rate: "default",
        volume: "default",
        timeout: 10000,
    });

    await tts.ttsPromise(text, output);
    const stats = await fs.stat(output);

console.log("Voice created:", output);
console.log("Voice size:", stats.size, "bytes");

    console.log("Voice created:", output);

    return output;
}

module.exports = generateVoice;
