#!/bin/bash
Xvfb :1 -screen 0 1920x1080x24 &
sleep 2

DISPLAY=:1 openbox &

x11vnc -display :1 \
    -passwd "${VNC_PASSWORD:-changeme}" \
    -listen 0.0.0.0 \
    -port 5900 \
    -forever \
    -shared \
    -quiet &

websockify --web /usr/share/novnc 6080 localhost:5900 &

sleep 1

DISPLAY=:1 google-chrome \
    --no-sandbox \
    --disable-dev-shm-usage \
    --disable-gpu \
    --load-extension=/ext/dist \
    --user-data-dir=/chrome-profile \
    https://apex.prosperousuniverse.com &

tail -f /dev/null
