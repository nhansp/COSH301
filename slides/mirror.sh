#!/bin/bash
# Stream the phone's screen into /dev/video10 (v4l2loopback); serve.py turns it into /mirror.mjpg.
# Optional: the deck works without it and shows a "waiting for phone" panel.
#
# Setup once: sudo modprobe v4l2loopback video_nr=10 card_label=phone exclusive_caps=1
# Env: MIRROR_ADB (default 10.0.0.18:38421), MIRROR_USB (adb serial over USB, preferred when present),
#      MIRROR_DEV (default /dev/video10)
USB=${MIRROR_USB:-}
NET=${MIRROR_ADB:-10.0.0.18:38421}
DEV=${MIRROR_DEV:-/dev/video10}
SERIAL_FILE="$(dirname "$0")/.mirror-serial"   # serve.py polls rotation over the same adb path

pick() {
    if [ -n "$USB" ] && [ "$(adb -s "$USB" get-state 2>/dev/null)" = device ]; then echo "$USB"; return; fi
    timeout 5 adb connect "$NET" >/dev/null 2>&1
    echo "$NET"
}

while true; do
    SERIAL=$(pick)
    echo "$SERIAL" > "$SERIAL_FILE"
    echo "mirroring $SERIAL -> $DEV"
    # portrait capture; the deck rotates the frame itself
    scrcpy -s "$SERIAL" --v4l2-sink="$DEV" --no-video-playback --no-audio --no-control \
        --capture-orientation=@0 --video-codec=h265 --max-size=1080 --video-bit-rate=4M --max-fps=60
    sleep 2
done
