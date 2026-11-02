"""Build the personal portfolio PDF from repository facts and demo screenshots."""
from pathlib import Path
from shutil import copyfile
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output' / 'pdf' / 'Cendikia-Hairy-Portfolio.pdf'
PUBLIC = ROOT / 'public' / 'portfolio' / OUT.name
OUT.parent.mkdir(parents=True, exist_ok=True)
PUBLIC.parent.mkdir(parents=True, exist_ok=True)
pdfmetrics.registerFont(TTFont('Portfolio', 'C:/Windows/Fonts/segoeui.ttf'))
pdfmetrics.registerFont(TTFont('PortfolioBold', 'C:/Windows/Fonts/segoeuib.ttf'))
W, H = 595.276, 841.89
BG, SURFACE, BORDER = '#0D1423', '#182339', '#43536F'
TEXT, MUTED, CYAN = '#F1F5FF', '#B7C5DC', '#8BDDEA'
c = canvas.Canvas(str(OUT), pagesize=(W, H))
c.setTitle('Cendikia Hairy | Portfolio - Fight the Dragon')
c.setAuthor('Cendikia Hairy')
c.setSubject('Personal portfolio and Fight the Dragon project case study')

def rect(x, top, width, height, fill=SURFACE, stroke=None, radius=0):
    c.setFillColor(HexColor(fill))
    c.setStrokeColor(HexColor(stroke or fill))
    if radius:
        c.roundRect(x, H-top-height, width, height, radius, stroke=bool(stroke), fill=1)
    else:
        c.rect(x, H-top-height, width, height, stroke=bool(stroke), fill=1)

def line(top):
    c.setStrokeColor(HexColor(BORDER)); c.setLineWidth(.5)
    c.line(44, H-top, W-44, H-top)

def text(value, x, top, size=11, color=TEXT, bold=False):
    c.setFillColor(HexColor(color)); c.setFont('PortfolioBold' if bold else 'Portfolio', size)
    c.drawString(x, H-top-size, value)

def para(value, x, top, width, size=10, color=MUTED, leading=None, bold=False):
    style = ParagraphStyle('body', fontName='PortfolioBold' if bold else 'Portfolio',
                           fontSize=size, leading=leading or size*1.55, textColor=HexColor(color))
    p = Paragraph(value, style)
    _, height = p.wrap(width, H)
    p.drawOn(c, x, H-top-height)
    return height

def image(path, x, top, width, height):
    c.drawImage(ImageReader(str(ROOT / path)), x, H-top-height, width, height,
                preserveAspectRatio=True, anchor='c', mask='auto')

def page(number, label):
    rect(0, 0, W, H, BG)
    text('CH.', 44, 27, 18, CYAN, True)
    text('CENDIKIA HAIRY', 89, 32, 9, TEXT, True)
    text(label.upper(), 366, 33, 8, MUTED)
    line(65)
    line(785)
    text('Cendikia Hairy  /  Selected work', 44, 799, 8, MUTED)
    text(f'{number:02d} / 03', W-82, 799, 8, MUTED)
    c.linkURL('https://www.linkedin.com/in/cendikia-hairy/', (44, 22, 225, 42), relative=0)

def screenshot(path, top, title, caption):
    text(title.upper(), 44, top, 8, CYAN, True)
    rect(44, top+22, W-88, 352, BG, BORDER, 5)
    image(path, 45, top+23, W-90, 350)
    para(caption, 44, top+384, W-88, 9)

page(1, 'Personal portfolio')
text('INTERFACES, INTERACTIONS & A LITTLE ADVENTURE', 44, 94, 8, CYAN, True)
text('Thoughtful interfaces.', 44, 123, 32, TEXT, True)
text('Playful experiences.', 44, 165, 32, CYAN, True)
para('I am Cendikia Hairy. This portfolio explores my work through Fight the Dragon: '
     'a browser-based experience that brings team challenges, live scores, and a fantasy world together.',
     44, 224, 490, 11)
rect(44, 307, W-88, 276, SURFACE, BORDER, 7)
text('FEATURED PROJECT', 64, 330, 8, CYAN, True)
text('Fight', 64, 358, 36, TEXT, True)
text('the Dragon.', 64, 400, 36, TEXT, True)
para('An offline-first command center for the host running the room and the audience following every turn.',
     64, 462, 212, 11)
image('public/characters/dragon-warden.png', 290, 312, 236, 261)
text('EXPERIENCE', 44, 611, 8, CYAN, True)
para('Host console + public display<br/>Installable web application', 44, 631, 235, 10, TEXT)
text('FOUNDATION', 310, 611, 8, CYAN, True)
para('React, TypeScript, Vite<br/>SQLite in the browser', 310, 631, 235, 10, TEXT)
line(692)
text('LET\'S CONNECT', 44, 715, 8, CYAN, True)
text('linkedin.com/in/cendikia-hairy', 44, 737, 12, TEXT, True)
c.linkURL('https://www.linkedin.com/in/cendikia-hairy/', (44, H-760, 330, H-731), relative=0)
c.showPage()

page(2, 'Featured project / Case study')
text('ONE EVENT. TWO PERSPECTIVES.', 44, 93, 8, CYAN, True)
text('Keep the event moving.', 44, 120, 29, TEXT, True)
text('Keep the room engaged.', 44, 158, 29, CYAN, True)
para('Team events need precise controls for the host and a clear view for everyone playing. '
     'Fight the Dragon connects both through shared local state and dedicated presentation screens.',
     44, 212, W-88, 11)
screenshot('public/portfolio/event-console.jpg', 284, 'The host workspace',
           'Demo state with the five default teams. Navigation groups event setup, results, and game management.')
for x, title, body in [
    (44, 'Prepare', 'Set up teams and turn order.'),
    (219, 'Play', 'Decode clues, match cards, and face the dragon.'),
    (394, 'Celebrate', 'Show rankings, rewards, and the final podium.'),
]:
    text(title, x, 711, 12, TEXT, True)
    para(body, x, 735, 147, 9)
c.showPage()

page(3, 'Engineering / Experience')
text('THE DETAILS ARE PART OF THE EXPERIENCE.', 44, 93, 8, CYAN, True)
text('Built for the whole room.', 44, 121, 29, TEXT, True)
para('A shared navy, cobalt, silver, and cyan visual system connects host tools, '
     'public displays, and the cast. Light and dark appearances keep controls and reading panels consistent.',
     44, 169, W-88, 11)
rect(44, 244, 246, 173, BG, BORDER, 4)
rect(305, 244, 246, 173, BG, BORDER, 4)
image('public/portfolio/public-display.jpg', 45, 245, 244, 171)
image('public/portfolio/scoreboard.jpg', 306, 245, 244, 171)
text('Audience presentation', 44, 429, 10, TEXT, True)
text('Live scoreboard', 305, 429, 10, TEXT, True)
text('Demo screenshots / default event state', 44, 451, 8, MUTED)
for top, title, body in [
    (491, '01  Interface engineering', 'Responsive React views, typed components, shared appearance tokens, '
     'visible keyboard focus, and reduced-motion support.'),
    (562, '02  Dependable local state', 'Sequelize models and sql.js run SQLite in the browser. Local persistence '
     'and same-origin, same-profile tab synchronization keep the host and audience connected.'),
    (645, '03  Traceable game behavior', 'Persisted scoring, card effects, and duplicate-submission protection '
     'support the event loop. A GP ledger records balance changes; Vitest and Playwright verify rules and interactions.'),
]:
    text(title, 44, top, 12, TEXT, True)
    para(body, 44, top+24, W-88, 10)
text('REACT  /  TYPESCRIPT  /  VITE  /  SEQUELIZE  /  SQL.JS  /  VITEST  /  PLAYWRIGHT', 44, 755, 7, CYAN, True)
c.showPage()
c.save()
copyfile(OUT, PUBLIC)
print(OUT)
