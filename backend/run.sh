#!/bin/bash
sudo .venv/bin/uvicorn main:app --host 0.0.0.0 --port 443 \
    --ssl-certfile /etc/letsencrypt/live/doodledeluxebackend.duckdns.org/fullchain.pem \
    --ssl-keyfile /etc/letsencrypt/live/doodledeluxebackend.duckdns.org/privkey.pem
