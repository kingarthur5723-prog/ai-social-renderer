const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

async function downloadImages(images) {

    const folder = path.join(__dirname, "uploads");

    await fs.ensureDir(folder);

    const files = [];

    for (let i = 0; i < images.length; i++) {

        const filename = path.join(folder, `scene${i}.jpg`);

        const response = await axios({

            url: images[i],
            method: "GET",
            responseType: "stream"

        });

        const writer = fs.createWriteStream(filename);

        response.data.pipe(writer);

        await new Promise((resolve, reject) => {

            writer.on("finish", resolve);
            writer.on("error", reject);

        });

        files.push(filename);

    }

    return files;

}

module.exports = {

    downloadImages

};
