# Filament ear — Vosk, offline

Door **4850**. Own house. Not Whole House. Not the Bench.

```bash
pip install vosk
mkdir -p models
curl -L -o /tmp/vosk.zip https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip
unzip /tmp/vosk.zip -d models
export VOSK_MODEL_PATH="$PWD/models/vosk-model-small-en-us-0.15"
python3 ear/vosk_ear.py
```

Health: `GET http://127.0.0.1:4850/health`  
Catch: `POST http://127.0.0.1:4850/stt` with the tape as `file`.

Empty ear stays empty. Whisper is not in this body.
Porch hears the words after this nerve. The cochlea does not copy into Porch.
