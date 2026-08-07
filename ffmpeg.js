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
