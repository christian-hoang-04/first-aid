#!/usr/bin/env python3
"""Tạo giọng đọc cho các mô hình 3D bằng VieNeu-TTS, chạy trên máy của bạn.

Cài đặt (một lần):
    pip install vieneu          # cần Python 3.10 trở lên; chạy bằng CPU, không cần GPU
    + cài ffmpeg (Windows: winget install ffmpeg | macOS: brew install ffmpeg | Ubuntu: sudo apt install ffmpeg)

Cách dùng (đặt file này cạnh kich-ban-giong-doc.csv và replace_voice.py):
    python tao_giong_doc.py --list-voices                      # xem các giọng có sẵn
    python tao_giong_doc.py --voice "Thùy Dung"                 # tạo đủ 24 đoạn cho cả 3 kịch bản
    python tao_giong_doc.py --voice "Thùy Dung" --scenario ep-bung --takes 3
    python tao_giong_doc.py --voice "Thùy Dung" --pages ./tai-ve # tạo xong thì gắn luôn vào các trang offline

Lần chạy đầu tiên sẽ tải model từ Hugging Face (cần mạng), các lần sau chạy offline.
"""
import argparse
import csv
import pathlib
import shutil
import subprocess
import sys
import time

HERE = pathlib.Path(__file__).resolve().parent
CLEANUP = ("silenceremove=start_periods=1:start_threshold=-45dB,areverse,"
           "silenceremove=start_periods=1:start_threshold=-45dB,areverse,"
           "apad=pad_dur=0.25,loudnorm=I=-16:TP=-1.5")
PAGE_NAMES = {'xuc-thia': 'xuc-thia-3d-offline.html',
              'ep-bung': 'ep-bung-3d-offline.html',
              'gay-xuong-dui': 'gay-xuong-dui-3d-offline.html'}

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass


def load_scripts(csv_path, only=None):
    rows = list(csv.DictReader(open(csv_path, encoding='utf-8-sig')))
    if only:
        rows = [r for r in rows if r['scenario'] in only]
    if not rows:
        sys.exit(f'Không tìm thấy kịch bản nào trong {csv_path}' + (f' cho {", ".join(only)}' if only else ''))
    return rows


def to_mp3(wav, mp3):
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(wav), '-af', CLEANUP,
                    '-ac', '1', '-ar', '44100', '-b:a', '64k', str(mp3)], check=True)


def main():
    ap = argparse.ArgumentParser(description='Tạo giọng đọc cho các mô hình 3D bằng VieNeu-TTS.')
    ap.add_argument('--voice', default='Thùy Dung', help='tên giọng (xem --list-voices). Mặc định: Thùy Dung')
    ap.add_argument('--ref-audio', help='hoặc: đoạn ghi âm 3–8 giây để nhân bản giọng (thay cho --voice)')
    ap.add_argument('--scenario', nargs='*', help='chỉ tạo cho các kịch bản này, vd: xuc-thia ep-bung gay-xuong-dui')
    ap.add_argument('--csv', default=str(HERE / 'kich-ban-giong-doc.csv'))
    ap.add_argument('--out', default=str(HERE / 'giong-doc-vieneu'), help='thư mục lưu kết quả')
    ap.add_argument('--takes', type=int, default=1, help='số bản tạo cho mỗi đoạn để chọn bản hay nhất (mặc định 1)')
    ap.add_argument('--temperature', type=float, default=None, help='thấp hơn = đều giọng hơn (mặc định của model: 0.8)')
    ap.add_argument('--precision', choices=['fp32', 'int8'], default='fp32',
                    help='int8 nhanh hơn nhưng chỉ dùng khi CPU hỗ trợ VNNI, nếu không tiếng sẽ bị méo')
    ap.add_argument('--pages', help='thư mục chứa các trang *-3d-offline.html: tạo xong sẽ gắn giọng vào bản sao *-vieneu.html')
    ap.add_argument('--list-voices', action='store_true', help='in danh sách giọng rồi thoát')
    a = ap.parse_args()

    try:
        from vieneu import Vieneu
    except ImportError:
        sys.exit('Chưa cài VieNeu-TTS. Chạy: pip install vieneu')

    print('Đang tải model VieNeu-TTS (lần đầu sẽ lâu hơn vì phải tải về)...')
    tts = Vieneu(precision=a.precision)

    if a.list_voices:
        for label, vid in tts.list_preset_voices():
            print(f'  {label}   →  --voice "{vid}"')
        return

    has_ffmpeg = shutil.which('ffmpeg') is not None
    if not has_ffmpeg:
        print('Lưu ý: chưa có ffmpeg, nên chỉ lưu file WAV (chưa cắt khoảng lặng / chuẩn âm lượng / đổi sang MP3).')

    voice_kw = {'ref_audio': a.ref_audio} if a.ref_audio else {'voice': a.voice}
    gen_kw = {} if a.temperature is None else {'temperature': a.temperature}
    rows = load_scripts(a.csv, a.scenario)
    out = pathlib.Path(a.out)
    print(f'Giọng: {a.ref_audio or a.voice} | {len(rows)} đoạn | lưu vào {out}')

    done = {}
    t0 = time.time()
    for r in rows:
        slug, name = r['scenario'], pathlib.Path(r['file']).stem
        raw = out / slug / 'raw'
        raw.mkdir(parents=True, exist_ok=True)
        for k in range(1, a.takes + 1):
            audio = tts.infer(r['script'], **voice_kw, **gen_kw)
            wav = raw / (f'{name}.wav' if k == 1 else f'{name}_take{k}.wav')
            tts.save(audio, str(wav))
        final = out / slug / f'{name}.mp3'
        if has_ffmpeg:
            to_mp3(raw / f'{name}.wav', final)
        else:
            final = out / slug / f'{name}.wav'
            shutil.copy(raw / f'{name}.wav', final)
        done.setdefault(slug, []).append(final)
        print(f'  ✓ {slug}/{final.name}  ({len(audio) / tts.sample_rate:.1f} s)  {r["script"][:60]}…')
    print(f'Xong {len(rows)} đoạn trong {time.time() - t0:.0f} s.')
    if a.takes > 1:
        print(f'Các bản thay thế nằm trong {out}/<kịch bản>/raw/*_takeN.wav. Muốn dùng bản nào thì đổi tên nó '
              f'thành buoc-N.wav rồi chạy lại ffmpeg (xem tài liệu quy chuẩn).')

    if a.pages:
        rv = HERE / 'replace_voice.py'
        for slug, files in done.items():
            page = pathlib.Path(a.pages) / PAGE_NAMES.get(slug, f'{slug}-3d-offline.html')
            if not page.exists():
                print(f'  Bỏ qua {slug}: không thấy {page}')
                continue
            new_page = page.with_name(page.stem + '-vieneu.html')
            subprocess.run([sys.executable, str(rv), str(page), str(out / slug), '-o', str(new_page)], check=True)
    else:
        print('Để gắn vào trang: python replace_voice.py <trang>-3d-offline.html ' + str(out / '<kịch bản>') + ' -o <trang mới>.html')


if __name__ == '__main__':
    main()
