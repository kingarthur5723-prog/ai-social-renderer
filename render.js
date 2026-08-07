const fs = require("fs-extra");
const path = require("path");
const { v4: uuid } = require("uuid");
const generateVoice = require("./voice");

const {
    downloadImages,
    createVideo
} = require("./ffmpeg");


const outputDir = path.join(__dirname, "output");


// ======================================
// RENDER VIDEO
// ======================================

async function renderVideo(data) {

    try {

        const images = data.images || [];
        const captions = data.captions || [];
        const tracks = [
    "upbeat.mp3",
    "relaxing.mp3",
    "cinematic.mp3",
    "corporate.mp3",
    "motivational.mp3"
];

const randomTrack =
    tracks[Math.floor(Math.random() * tracks.length)];

const music = path.join(
    __dirname,
    "assets",
    randomTrack
);

console.log("Selected music:", music);

const durationPerScene = data.duration || 4.5;

// Create unique job ID
const id = uuid();

// Generate AI voice if text was supplied
let voice = "";

console.log("Voice text received:");
console.log(data.voice);
        
if (data.voice && data.voice.trim() !== "") {
    console.log("Generating AI voice...");
    voice = await generateVoice(data.voice, id);
    console.log("Generated voice file:");
    console.log(voice);
}


        if (!Array.isArray(images) || images.length === 0) {

            throw new Error("No images supplied.");

        }


        // Create unique job ID


        // Ensure output exists

        await fs.ensureDir(outputDir);



        console.log("Downloading images...");

        const downloadedImages =
            await downloadImages(images);


        console.log(
            "Downloaded:",
            downloadedImages
        );


        const outputVideo =
            path.join(
                outputDir,
                `${id}.mp4`
            );



        console.log("Rendering video...");


        await createVideo({

            images: downloadedImages,

            captions,

            music,

            narration: voice,

            outputFile: outputVideo,

            duration: durationPerScene

        });



        // Remove temporary files

        for (const file of downloadedImages) {

            await fs.remove(file);

        }


        console.log(
            "Temporary images cleaned."
        );



        const totalDuration =
            images.length * durationPerScene;



        console.log(
            "Render completed."
        );


        return {

            success:true,

            jobId:id,

            video:`/output/${id}.mp4`,

            captions,

            music,

            voice,

            duration:`${totalDuration} seconds`,

            platforms:[

                "facebook",
                "instagram",
                "tiktok"

            ],

            status:"ready"

        };


    } catch(error) {


        console.error(
            "Render failed:",
            error
        );


        return {

            success:false,

            error:error.message

        };

    }

}



// ======================================
// DELETE OLD VIDEOS
// Runs every hour
// ======================================

setInterval(async()=>{


    try {


        await fs.ensureDir(outputDir);


        const files =
            await fs.readdir(outputDir);



        for(const file of files){


            const full =
                path.join(
                    outputDir,
                    file
                );


            const stats =
                await fs.stat(full);



            const age =
                Date.now()
                -
                stats.mtimeMs;



            // Delete videos older than 24 hours

            if(age > 86400000){

                await fs.remove(full);

                console.log(
                    "Deleted old video:",
                    file
                );

            }

        }


    } catch(error){


        console.error(
            "Cleanup error:",
            error.message
        );


    }


},3600000);



module.exports = renderVideo;
