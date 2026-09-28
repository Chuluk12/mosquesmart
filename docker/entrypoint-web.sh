#!/bin/sh
set -eu

envsubst '$VITE_API_URL $VITE_SOCKET_URL' \
  < /usr/share/nginx/html/runtime-config.template.js \
  > /usr/share/nginx/html/runtime-config.js

rm /usr/share/nginx/html/runtime-config.template.js
