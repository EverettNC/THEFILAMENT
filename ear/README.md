# Filament ear — Vosk, offline

Door **4850**. Own house. Not Whole House. Not the Bench.

Model: **vosk-model-en-us-0.22-lgraph**  
Accurate universal English (callcenter + wideband). Appen Kaldi. Dynamic graph.  
Not the small 0.15. Whisper is not in this body.

On Everett's machine the model already lives unpacked:

```
/Users/EverettN/models/vosk-model-en-us-0.22-lgraph
```

The ear looks there first (`VOSK_MODEL_PATH`, then Downloads, then that path, then `./models/…`). Whisper is not a fallback. If 4850 dies, it restarts. It does not hand the ear to something else.

LaunchAgent: `~/Library/LaunchAgents/com.thechristmanai.filament.plist`  
KeepAlive. Local Vosk only. Door 4850.

```bash
pip install vosk
python3 ear/vosk_ear.py
```

The full 1.8 GB `vosk-model-en-us-0.22` also sits if you point `VOSK_MODEL_PATH` at it. Same law.

Health: `GET http://127.0.0.1:4850/health`  
Catch: `POST http://127.0.0.1:4850/stt` with the tape as `file`.

Empty ear stays empty. Porch hears the words after this nerve.
