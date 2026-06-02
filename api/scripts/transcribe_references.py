"""One-time transcription of meditation reference sources.

Reads every .mp3 in api/reference-sources/, sends it to ElevenLabs Scribe
(via the existing provider class — same env vars as the running API),
saves the resulting transcript next to the audio as <basename>.txt.

Run from the api/ directory after `uv sync`:

    uv run python scripts/transcribe_references.py

Optional CLI overrides:
    --source-dir api/reference-sources
    --locale ru | en   (default: en)
    --force            (overwrite existing .txt files)

The output .txt files are git-ignored by default. After running, copy
the relevant transcript text into the matching template JSON's
`transcript` field manually so the pipeline picks it up.
"""

from __future__ import annotations

import argparse
import asyncio
import sys
import time
from pathlib import Path
from typing import Literal

import httpx

from kokoro_api.config import load_config


async def transcribe_file(
    *,
    client: httpx.AsyncClient,
    api_key: str,
    base_url: str,
    model: str,
    locale: Literal["en", "ru"],
    audio_path: Path,
) -> str:
    t0 = time.monotonic()
    with audio_path.open("rb") as fh:
        files = {"file": (audio_path.name, fh.read(), "audio/mpeg")}

    data = {
        "model_id": model,
        "language_code": locale,
        "tag_audio_events": "false",
        "diarize": "false",
        "timestamps_granularity": "none",
    }
    if model == "scribe_v2":
        data["no_verbatim"] = "true"

    response = await client.post(
        f"{base_url.rstrip('/')}/v1/speech-to-text",
        headers={"xi-api-key": api_key},
        files=files,
        data=data,
    )
    response.raise_for_status()
    payload = response.json()
    text = str(payload.get("text") or "").strip()
    elapsed_ms = int((time.monotonic() - t0) * 1000)
    print(f"  ↳ {len(text)} chars in {elapsed_ms} ms")
    return text


async def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--source-dir",
        default="reference-sources",
        help="Directory containing source audio files (relative to api/)",
    )
    parser.add_argument("--locale", default="en", choices=("en", "ru"))
    parser.add_argument("--force", action="store_true", help="overwrite existing .txt files")
    args = parser.parse_args()

    config = load_config()
    if not config.elevenlabs_api_key:
        print("ELEVENLABS_API_KEY is not set in api/.env — cannot transcribe.", file=sys.stderr)
        return 1

    source_dir = Path(args.source_dir)
    if not source_dir.is_absolute():
        source_dir = Path.cwd() / source_dir
    if not source_dir.is_dir():
        print(f"Source directory not found: {source_dir}", file=sys.stderr)
        return 1

    audio_files = sorted(source_dir.glob("*.mp3"))
    if not audio_files:
        print(f"No .mp3 files in {source_dir}", file=sys.stderr)
        return 1

    print(f"Found {len(audio_files)} files in {source_dir}")
    print(f"Locale: {args.locale}")
    print(f"Model:  {config.elevenlabs_model}")
    print()

    async with httpx.AsyncClient(timeout=300.0) as client:
        for audio_path in audio_files:
            output_path = audio_path.with_suffix(".txt")
            if output_path.exists() and not args.force:
                print(f"[skip] {audio_path.name} → {output_path.name} (use --force to overwrite)")
                continue

            print(f"[work] {audio_path.name} ...")
            try:
                text = await transcribe_file(
                    client=client,
                    api_key=config.elevenlabs_api_key,
                    base_url=str(config.elevenlabs_base_url),
                    model=config.elevenlabs_model,
                    locale=args.locale,
                    audio_path=audio_path,
                )
            except httpx.HTTPStatusError as exc:
                print(f"  ! HTTP {exc.response.status_code}: {exc.response.text[:200]}",
                      file=sys.stderr)
                continue
            except Exception as exc:
                print(f"  ! error: {exc}", file=sys.stderr)
                continue

            output_path.write_text(text + "\n", encoding="utf-8")
            print(f"  ✓ wrote {output_path}")

    print()
    print("Done. Copy each <basename>.txt into the matching template JSON's "
          "`transcript` field manually.")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
