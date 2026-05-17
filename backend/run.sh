#!/bin/bash
sudo .venv/bin/uvicorn main:app --host 0.0.0.0 --port 443 \
    --ssl-certfile /etc/letsencrypt/live/spirit-wolf.duckdns.org/fullchain.pem \
    --ssl-keyfile /etc/letsencrypt/live/spirit-wolf.duckdns.org/privkey.pem
    --ws websockets
