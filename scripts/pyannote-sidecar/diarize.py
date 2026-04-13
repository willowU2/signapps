#!/usr/bin/env python3
"""Pyannote speaker diarization sidecar.

Reads JSON from stdin: {"audio_path": "/tmp/recording.wav"}
Writes JSON to stdout: {"speakers": [{"id": "speaker_0", "label": "Speaker 1", "segments": [{"start_ms": 0, "end_ms": 5000}]}]}
"""

import json
import sys
import os

def main():
    request = json.loads(sys.stdin.readline())
    audio_path = request["audio_path"]

    if not os.path.exists(audio_path):
        json.dump({"error": f"file not found: {audio_path}"}, sys.stdout)
        return

    try:
        from pyannote.audio import Pipeline

        token = os.environ.get("HF_TOKEN", "")
        pipeline = Pipeline.from_pretrained(
            "pyannote/speaker-diarization-3.1",
            use_auth_token=token if token else None,
        )

        diarization = pipeline(audio_path)

        speakers = {}
        for turn, _, speaker in diarization.itertracks(yield_label=True):
            if speaker not in speakers:
                idx = len(speakers)
                speakers[speaker] = {
                    "id": f"speaker_{idx}",
                    "label": f"Speaker {idx + 1}",
                    "segments": [],
                }
            speakers[speaker]["segments"].append({
                "start_ms": int(turn.start * 1000),
                "end_ms": int(turn.end * 1000),
            })

        json.dump({"speakers": list(speakers.values())}, sys.stdout)

    except ImportError:
        json.dump({"error": "pyannote.audio not installed"}, sys.stdout)
    except Exception as e:
        json.dump({"error": str(e)}, sys.stdout)

if __name__ == "__main__":
    main()
