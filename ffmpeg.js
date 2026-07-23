async function createVideo(images, outputFile) {

    const listFile = path.join(__dirname, "uploads", "list.txt");

    let text = "";

    images.forEach((img) => {
        text += `file '${img}'\n`;
        text += "duration 3\n";
    });

    // Repeat the last image once
    text += `file '${images[images.length - 1]}'\n`;

    await fs.writeFile(listFile, text);

    return new Promise((resolve, reject) => {

        const cmd = [
            "ffmpeg",
            "-y",
            "-f", "concat",
            "-safe", "0",
            "-i", `"${listFile}"`,
            "-vf", `"scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280"`,
            "-c:v", "libx264",
            "-preset", "ultrafast",
            "-crf", "30",
            "-pix_fmt", "yuv420p",
            "-r", "24",
            `"${outputFile}"`
        ].join(" ");

        console.log(cmd);

        const child = exec(cmd);

        child.stdout.on("data", (data) => {
            console.log(data.toString());
        });

        child.stderr.on("data", (data) => {
            console.log(data.toString());
        });

        child.on("close", (code) => {

            if (code === 0) {
                resolve(outputFile);
            } else {
                reject(new Error("FFmpeg exited with code " + code));
            }

        });

    });

}
