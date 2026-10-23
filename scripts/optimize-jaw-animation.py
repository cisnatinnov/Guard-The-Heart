"""Create the smaller browser animation from the supplied GIF without changing timing."""
from pathlib import Path
from PIL import Image, ImageSequence

root = Path(__file__).resolve().parents[1] / 'public' / 'ui' / 'jaw-of-risk'
with Image.open(root / 'GIF-Gigarisk Gigit.gif') as source:
    frames = []
    durations = []
    for frame in ImageSequence.Iterator(source):
        frames.append(frame.convert('RGB'))
        durations.append(frame.info.get('duration', 40))
    frames[0].save(root / 'gigarisk-bite.webp', save_all=True,
                   append_images=frames[1:], duration=durations,
                   loop=0, quality=80, method=4)
print(f'{len(frames)} frames, {sum(durations)} ms, {(root / "gigarisk-bite.webp").stat().st_size:,} bytes')
