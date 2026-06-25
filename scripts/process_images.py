#!/usr/bin/env python3
"""Dummy image processor for Storytime phase 1.

Copies all images from original/ to processed/.
Replace PYTHON_SCRIPT_PATH in .env with your friend's real script later.
"""
import shutil
import sys
from pathlib import Path

IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif', '.webp', '.tif', '.tiff'}


def main() -> int:
    if len(sys.argv) < 2:
        print('Usage: process_images.py <project_folder>', file=sys.stderr)
        return 1

    project_dir = Path(sys.argv[1])
    original_dir = project_dir / 'original'
    processed_dir = project_dir / 'processed'

    if not original_dir.is_dir():
        print(f'original/ not found in {project_dir}', file=sys.stderr)
        return 1

    processed_dir.mkdir(parents=True, exist_ok=True)

    copied = 0
    for path in sorted(original_dir.iterdir()):
        if not path.is_file():
            continue
        if path.suffix.lower() not in IMAGE_EXTENSIONS:
            continue
        dest = processed_dir / path.name
        shutil.copy2(path, dest)
        copied += 1

    if copied == 0:
        print('No image files found in original/', file=sys.stderr)
        return 1

    print(f'Copied {copied} image(s) to processed/')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
