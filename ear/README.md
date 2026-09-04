# Filament ear — Vosk, offline

Door **4850**. Own house. Not Whole House. Not the Bench.

Model: **vosk-model-en-us-0.22-lgraph**  
Accurate universal English (callcenter + wideband). Appen Kaldi. Dynamic graph.  
Not the small 0.15. Whisper is not in this body.

On Everett's machine the model already lives unpacked:

```
/Users/EverettN/Downloads/vosk-model-en-us-0.22-lgraph
```

The ear looks there first, then `./models/…`, then `VOSK_MODEL_PATH`.

```bash
pip install vosk
python3 ear/vosk_ear.py
```

The full 1.8 GB `vosk-model-en-us-0.22` also sits if you point `VOSK_MODEL_PATH` at it. Same law.

Health: `GET http://127.0.0.1:4850/health`  
Catch: `POST http://127.0.0.1:4850/stt` with the tape as `file`.

Empty ear stays empty. Porch hears the words after this nerve.
