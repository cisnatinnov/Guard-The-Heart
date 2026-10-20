"""Import Q&A and original layout artwork from the supplied reference decks.

Run: python scripts/import-reference-questions.py
Slides alternate questions and answers. Option letters are mapped by their
positions, and the red outline on each answer slide identifies the answer.
"""
import json
import posixpath
import re
from pathlib import Path
from xml.etree import ElementTree as ET
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]
NS = {
    'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
    'p': 'http://schemas.openxmlformats.org/presentationml/2006/main',
    'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
}


def text(shape):
    # Formatting runs split words, so join them without introducing spaces.
    value = ' '.join(''.join(t.text or '' for t in p.findall('.//a:t', NS))
                     for p in shape.findall('.//a:p', NS))
    return re.sub(r'\s+', ' ', value).strip()


def bounds(shape, placeholders):
    transform = shape.find('./p:spPr/a:xfrm', NS)
    if transform is None:
        ph = shape.find('./p:nvSpPr/p:nvPr/p:ph', NS)
        if ph is not None:
            transform = placeholders.get(ph.get('idx', '0'))
    if transform is None:
        raise ValueError('Missing shape coordinates')
    offset, extent = transform.find('a:off', NS), transform.find('a:ext', NS)
    return tuple(int(value) for value in
                 (offset.get('x'), offset.get('y'), extent.get('cx'), extent.get('cy')))


def import_deck(filename, last_slide):
    questions = []
    with ZipFile(ROOT / 'public/ui' / filename) as deck:
        # Resolve the layout used by the first question, rather than assuming a number.
        relationships = ET.fromstring(deck.read('ppt/slides/_rels/slide3.xml.rels'))
        target = next(r.get('Target') for r in relationships if r.get('Type').endswith('/slideLayout'))
        layout_path = posixpath.normpath(posixpath.join('ppt/slides', target))
        layout = ET.fromstring(deck.read(layout_path))
        placeholders = {}
        for shape in layout.findall('.//p:sp', NS):
            ph = shape.find('./p:nvSpPr/p:nvPr/p:ph', NS)
            if ph is not None:
                placeholders[ph.get('idx', '0')] = shape.find('./p:spPr/a:xfrm', NS)

        for question_slide in range(3, last_slide + 1, 2):
            slide = ET.fromstring(deck.read(f'ppt/slides/slide{question_slide}.xml'))
            shapes = [(text(s), bounds(s, placeholders)) for s in slide.findall('.//p:sp', NS) if text(s)]
            letters = {value: box for value, box in shapes if value in 'ABCD' and len(value) == 1}
            assert len(letters) == 4
            prompt = next(value for value, box in shapes if box[1] < 4500000 and value not in letters)
            options = {}
            for value, box in shapes:
                if value == prompt or value in letters:
                    continue
                # Text sits to the right of its letter on the same row.
                letter = min(letters, key=lambda key:
                             abs(box[1] - letters[key][1]) + abs(box[0] - letters[key][0] - 650000))
                assert letter not in options, (question_slide, letter)
                options[letter] = value
            assert len(options) == 4
            answer_slide = ET.fromstring(deck.read(f'ppt/slides/slide{question_slide + 1}.xml'))
            highlight = next(s for s in answer_slide.findall('.//p:sp', NS)
                             if s.find('./p:spPr/a:ln/a:solidFill/a:srgbClr[@val="FF0000"]', NS) is not None)
            x, y, width, height = bounds(highlight, placeholders)
            answer_letter = next(key for key, (lx, ly, lw, lh) in letters.items()
                                 if x <= lx + lw / 2 <= x + width and y <= ly + lh / 2 <= y + height)
            questions.append({
                'number': len(questions) + 1, 'prompt': prompt,
                'answer': options[answer_letter], 'options': [options[key] for key in 'ABCD'],
                'kind': 'choice', 'hint': 'Choose the best answer.',
                'sourceDeck': filename, 'sourceSlide': question_slide,
                'answerSlide': question_slide + 1, 'answerLetter': answer_letter,
            })

        # Verify that the shared assets are the deck's own original artwork.
        rel_path = posixpath.join(posixpath.dirname(layout_path), '_rels', posixpath.basename(layout_path) + '.rels')
        rels = {r.get('Id'): posixpath.normpath(posixpath.join(posixpath.dirname(layout_path), r.get('Target')))
                for r in ET.fromstring(deck.read(rel_path))}
        background = layout.find('./p:cSld/p:bg//a:blip', NS)
        assert (ROOT / 'public/ui/match-card/arena.png').read_bytes() == deck.read(rels[background.get('{%s}embed' % NS['r'])])
        for destination, picture in zip(['public/ui/match-card/frame.png', 'public/Logo_Game-5.png'], layout.findall('.//p:pic', NS)):
            blip = picture.find('.//a:blip', NS)
            assert (ROOT / destination).read_bytes() == deck.read(rels[blip.get('{%s}embed' % NS['r'])]), f'Update shared artwork: {destination}'
    return questions


def import_image_decode():
    questions = []
    with ZipFile(ROOT / 'public/ui/Image_Decode.pptx') as deck:
        for slide_number in range(3, 25, 2):
            slide = ET.fromstring(deck.read(f'ppt/slides/slide{slide_number}.xml'))
            values = [text(s) for s in slide.findall('.//p:sp', NS) if text(s)]
            answer_slide = ET.fromstring(deck.read(f'ppt/slides/slide{slide_number + 1}.xml'))
            answer = next(text(s) for s in answer_slide.findall('.//p:sp', NS)
                          if s.find('./p:nvSpPr/p:nvPr/p:ph[@idx="10"]', NS) is not None)
            questions.append({
                'number': len(questions) + 1, 'prompt': values[1],
                'answer': answer, 'options': [], 'kind': 'decode',
                'hint': re.sub(r'^(\d)\s*', r'\1 ', values[0]),
                'sourceDeck': 'Image_Decode.pptx', 'sourceSlide': slide_number,
                'answerSlide': slide_number + 1,
            })
        # Image Decode shares the arena/frame but has clue banners in its header.
        for media, destination in [('image1.png', 'arena.png'), ('image4.png', 'frame.png')]:
            assert deck.read('ppt/media/' + media) == (ROOT / 'public/ui/match-card' / destination).read_bytes()
        output = ROOT / 'public/ui/image-decode'
        output.mkdir(exist_ok=True)
        for media, filename in [('image2.png', 'clue-banner.png'), ('image3.png', 'hint-banner.png')]:
            (output / filename).write_bytes(deck.read('ppt/media/' + media))
    return questions


if __name__ == '__main__':
    bank_path = ROOT / 'src/data/reference-question-bank.json'
    bank = json.loads(bank_path.read_text(encoding='utf-8'))
    bank['imageDecode'] = import_image_decode()
    bank['jawsOfRisk'] = import_deck('Jaw-of-risk.pptx', 42)
    bank['matchCard'] = import_deck('Match-Card.pptx', 44)
    bank_path.write_text(json.dumps(bank, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f"Imported {len(bank['imageDecode'])} Image Decode, {len(bank['jawsOfRisk'])} Jaw of Risk and {len(bank['matchCard'])} Flipping Card questions.")
