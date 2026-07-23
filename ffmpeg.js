const cmd = `ffmpeg -y \
-f concat \
-safe 0 \
-i "${listFile}" \
-vf "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280" \
-c:v libx264 \
-preset ultrafast \
-crf 28 \
-r 24 \
-pix_fmt yuv420p \
"${outputFile}"`;
