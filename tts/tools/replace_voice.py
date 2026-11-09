#!/usr/bin/env python3
"""Put your own voice clips into a 3D scenario page.

Usage:
    python3 replace_voice.py PAGE.html CLIPS_FOLDER [-o NEW_PAGE.html]

CLIPS_FOLDER holds one clip per step: buoc-1.mp3, buoc-2.mp3, ... (.mp3, .m4a, .ogg or .wav).
Only the page's two voice lines change (VOICE = the clips, VOICE_DUR = their lengths in seconds);
everything else stays as it is. Works on the online and the offline (.html) versions alike.
Needs ffprobe, which comes with ffmpeg, to measure each clip.
"""
import argparse
import base64
import json
import pathlib
import re
import subprocess
import sys

MIME = {'.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg', '.wav': 'audio/wav'}


def clip_length(path):
    out = subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
                                   '-of', 'csv=p=0', str(path)])
    return round(float(out.decode().strip()), 2)


def find_clips(folder):
    clips, i = [], 1
    while True:
        hits = [folder / f'buoc-{i}{ext}' for ext in MIME if (folder / f'buoc-{i}{ext}').exists()]
        if not hits:
            return clips
        clips.append(hits[0])
        i += 1


def main():
    ap = argparse.ArgumentParser(description='Replace the voice clips in a 3D scenario page.')
    ap.add_argument('page', help='the scenario page, e.g. xuc-thia-3d-offline.html')
    ap.add_argument('clips', help='folder with buoc-1.mp3, buoc-2.mp3, ...')
    ap.add_argument('-o', '--output', help='where to save the new page (default: overwrite PAGE)')
    a = ap.parse_args()

    page = pathlib.Path(a.page)
    html = page.read_text(encoding='utf-8')

    steps = re.search(r'const STEPS = \[(.*?)\n\];', html, re.S)
    n_steps = len(re.findall(r'\{ title:', steps.group(1))) if steps else None
    clips = find_clips(pathlib.Path(a.clips))
    if not clips:
        sys.exit('No clips found. Name them buoc-1.mp3, buoc-2.mp3, ... (one per step).')
    if n_steps and len(clips) != n_steps:
        sys.exit(f'The page has {n_steps} steps but {len(clips)} clips were found (buoc-1 to buoc-{len(clips)}).')

    uris, lengths = [], []
    for c in clips:
        uris.append(f'data:{MIME[c.suffix.lower()]};base64,' + base64.b64encode(c.read_bytes()).decode())
        lengths.append(clip_length(c))

    html, n1 = re.subn(r'const VOICE = \[.*?\];', lambda _: 'const VOICE = ' + json.dumps(uris) + ';', html, count=1, flags=re.S)
    html, n2 = re.subn(r'const VOICE_DUR = \[.*?\];', lambda _: 'const VOICE_DUR = ' + json.dumps(lengths) + ';', html, count=1, flags=re.S)
    if n1 != 1 or n2 != 1:
        sys.exit('This page has no VOICE / VOICE_DUR lines to replace. Is it one of the 3D scenario pages?')

    out = pathlib.Path(a.output) if a.output else page
    out.write_text(html, encoding='utf-8')
    size_mb = out.stat().st_size / 1e6
    print(f'Saved {out} ({size_mb:.1f} MB)')
    for i, (c, s) in enumerate(zip(clips, lengths), 1):
        print(f'  Bước {i}: {c.name:<14} {s:5.2f} s')
    if size_mb > 15:
        print('Warning: the page is over 15 MB. Use a lower MP3 bitrate (64 kbps mono is plenty for speech).')


if __name__ == '__main__':
    main()
