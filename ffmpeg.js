const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");
const { exec } = require("child_process");

async function downloadImages(images) {

    const uploadDir = path.join(__dirname, "uploads");
    await fs.ensureDir(uploadDir);

    const files = [];

    for (let i = 0; i < images.length; i++) {

        const file = path.join(uploadDir, `scene${i}.jpg`);

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

async function createVideo(images, outputFile) {

    const listFile = path.join(__dirname, "uploads", "list.txt");

    let text = "";

    images.forEach(img => {

        text += `file '${img}'\n`;
        text += "duration 5\n";

    });

    text += `file '${images[images.length - 1]}'\n`;

    await fs.writeFile(listFile, text);

    return new Promise((resolve, reject) => {

        const cmd =
`ffmpeg -y \
-f concat \
-safe 0 \
-i "${listFile}" \
-vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920" \
-r 30 \
-pix_fmt yuv420p \
"${outputFile}"`;

        console.log(cmd);

        exec(cmd, (err, stdout, stderr) => {

    if (err) {

        console.error(stderr);

        reject(
            new Error(
                stderr.split("\n").slice(-20).join("\n")
            )
        );

        return;
    }

    resolve(outputFile);

});

    });

}

module.exports = {

    downloadImages,
    createVideo

};
