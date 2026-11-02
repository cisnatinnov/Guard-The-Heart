"""Build the native Fight the Dragon card system in both application themes."""
from pathlib import Path
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parents[1] / 'public' / 'cards' / 'branded'
ICONS = {
    'heal': '<path d="M-55-15h35v-35h40v35h35v40H20v35h-40V25h-35z"/>',
    'shield': '<path d="M0-75l65 25v50c0 42-42 65-65 80C-23 65-65 42-65 0v-50z"/><path d="M-30 0l22 25 42-48" fill="none" stroke="var(--ink)" stroke-width="12"/>',
    'thief': '<path d="M-85-25Q0-65 85-25L65 40 15 25 0 50-15 25-65 40z"/><path d="M-60-5l35 10M25 5l35-10" stroke="var(--ink)" stroke-width="12"/>',
    'reverse': '<path d="M-60-20a65 65 0 01110-25M60 20A65 65 0 01-50 45" fill="none" stroke="currentColor" stroke-width="18"/><path d="M30-75l45 50H15zM-30 75l-45-50h60z"/>',
    'swallow': '<path d="M-85-45L-35-70 0-40 40-65 85-35 40-10 70 35 15 75-45 50-75 10-35 0z"/><path d="M-35 5h70M-15-25l10 8M35-25l-10 8" stroke="var(--ink)" stroke-width="10"/>',
    'unity': '<path d="M-55-60l40 15v35c0 25-25 42-40 50-15-8-40-25-40-50v-35zM55-60l40 15v35c0 25-25 42-40 50-15-8-40-25-40-50v-35z"/><path d="M0-5l45 15v35c0 28-27 45-45 55-18-10-45-27-45-55V10z"/>',
    'spark': '<path d="M0-85L23-25 85 0 23 25 0 85-23 25-85 0-23-25zM65-90l8 20 20 8-20 8-8 20-8-20-20-8 20-8z"/>',
    'fortune': '<rect x="-65" y="-55" width="80" height="115" rx="8" transform="rotate(-20)"/><rect x="-5" y="-55" width="80" height="115" rx="8" transform="rotate(20)"/><path d="M-10-15h40v40h-40z" fill="var(--ink)"/>',
    'firewall': '<path d="M-75-45H75V70H-75z"/><path d="M-75-5H75M-75 35H75M-25-45v40M25-5v40M-25 35v35" stroke="var(--ink)" stroke-width="9"/><path d="M10-95q65 35 15 65-55-5-15-65"/>',
    'lock': '<rect x="-60" y="-10" width="120" height="90" rx="12"/><path d="M-35-10v-35a35 35 0 0170 0v35" fill="none" stroke="currentColor" stroke-width="18"/><circle cy="28" r="12" fill="var(--ink)"/><path d="M-5 30H5v25H-5z" fill="var(--ink)"/>',
    'warning': '<path d="M0-80L90 75H-90z"/><path d="M-8-25H8v45H-8zM-8 35H8v16H-8z" fill="var(--ink)"/>',
    'payment': '<rect x="-85" y="-55" width="170" height="115" rx="14"/><path d="M-85-20H85M-60 30h40" stroke="var(--ink)" stroke-width="15"/>',
    'law': '<path d="M-70 50H55v20H-70zM-15-30l20-20 65 65-20 20zM-65-45l45-45 55 55-45 45z"/>',
    'report': '<path d="M-60-80h85l40 40V80H-60z"/><path d="M-35-10h70M-35 20h70M-35 50H5" stroke="var(--ink)" stroke-width="10"/>',
    'banker': '<circle cy="-48" r="30"/><path d="M-75 80V35Q-75-10-30-10L0 15 30-10Q75-10 75 35V80z"/><path d="M-12 15H12L6 35 17 65 0 80-17 65-6 35z" fill="var(--ink)"/>',
    'phishing': '<path d="M-60 0Q0-80 60 0 0 80-60 0L-95-35V35z"/><circle cx="30" cy="-5" r="10" fill="var(--ink)"/><path d="M40-80v30q0 30 30 20" fill="none" stroke="currentColor" stroke-width="12"/>',
    'password': '<rect x="-95" y="-40" width="190" height="85" rx="12" fill="none" stroke="currentColor" stroke-width="12"/><path d="M-55-15v35m-15-27l30 19m0-19l-30 19M0-15v35m-15-27l30 19m0-19l-30 19M55-15v35m-15-27l30 19m0-19l-30 19" fill="none" stroke="currentColor" stroke-width="8"/>',
}
CREST = '<path d="M-65-75l30 24L0-90 35-51 65-75 55-20 90 5 47 35 25 75H-25L-47 35-90 5-55-20z" fill="currentColor"/><path d="M-45-12l30 12-12 15-23-8M45-12L15 0l12 15 23-8" fill="var(--ink)"/><path d="M-25 45L0 28l25 17L0 65z" fill="var(--ink)"/>'
DESIGNS = [
    ('Normal', 'Heal Card', 'heal'), ('Normal', 'Shield Card', 'shield'), ('Normal', 'Thief Card', 'thief'),
    ('Rare', 'Heal Card', 'heal'), ('Rare', 'Protect Card', 'shield'), ('Rare', 'Thief Card', 'thief'),
    ('Rare', 'Fortune Draw Card', 'fortune'), ('Epic', 'Reverse Card', 'reverse'), ('Epic', 'Swallow Card', 'swallow'),
    ('Epic', 'Thief Card', 'thief'), ('Legendary', 'Gardian Unity', 'unity'), ('Legendary', 'Second Chance Card', 'spark'),
]
PAIRS = [('SYARIAH', 'shield'), ('BANKER', 'banker'), ('FIREWALL', 'firewall'), ('SECURE', 'lock'), ('FRAUD', 'warning'), ('PAYMENT', 'payment'), ('LAW', 'law'), ('REPORT', 'report'), ('PHISHING', 'phishing'), ('PASSWORD', 'password')]
ACCENTS = {'Normal': '#68d8ef', 'Rare': '#90b5ff', 'Epic': '#c7a0ff', 'Legendary': '#efd089'}

def svg(width, height, body, bg, panel, text, accent):
    # Keep every ornament inside the frame and the rules area unobstructed.
    corners = ''.join(f'<path d="M{x} {y+sy*40}V{y}h{sx*40}"/>' for x, y, sx, sy in [(26,26,1,1),(width-26,26,-1,1),(26,height-26,1,-1),(width-26,height-26,-1,-1)])
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" role="img" aria-label="Fight the Dragon card" style="--ink:{bg};color:{accent}">
<defs>
 <linearGradient id="stock" x2="1" y2="1"><stop stop-color="{panel}"/><stop offset=".48" stop-color="{bg}"/><stop offset="1" stop-color="{panel}"/></linearGradient>
 <linearGradient id="foil" x2="1" y2="1"><stop stop-color="{accent}"/><stop offset=".45" stop-color="{text}"/><stop offset="1" stop-color="{accent}"/></linearGradient>
 <radialGradient id="aura"><stop stop-color="{accent}" stop-opacity=".28"/><stop offset="1" stop-color="{accent}" stop-opacity="0"/></radialGradient>
 <pattern id="scales" width="40" height="32" patternUnits="userSpaceOnUse"><path d="M0 0Q20 32 40 0M-20 16Q0 48 20 16M20 16Q40 48 60 16" fill="none" stroke="{accent}" stroke-opacity=".07"/></pattern>
</defs>
<rect width="{width}" height="{height}" rx="32" fill="url(#stock)"/>
<rect x="14" y="14" width="{width-28}" height="{height-28}" rx="22" fill="url(#scales)" stroke="url(#foil)" stroke-width="3"/>
<rect x="23" y="23" width="{width-46}" height="{height-46}" rx="16" fill="none" stroke="{accent}" stroke-opacity=".3"/>
<ellipse cx="{width/2}" cy="{height*.44}" rx="{width*.48}" ry="{height*.38}" fill="url(#aura)"/>
<g fill="none" stroke="url(#foil)" stroke-width="5">{corners}</g>
<g font-family="Arial,sans-serif" text-anchor="middle" fill="{text}">{body}</g></svg>'''

for theme in ['dark', 'light']:
    folder = ROOT / theme
    folder.mkdir(parents=True, exist_ok=True)
    bg, panel, text = ('#101a2c', '#202e46', '#f2f6ff') if theme == 'dark' else ('#f5f7fd', '#e5ebf7', '#17263f')
    for number, (rarity, title, icon) in enumerate(DESIGNS, 1):
        accent = ACCENTS[rarity] if theme == 'dark' else {'Normal': '#186d87', 'Rare': '#365da4', 'Epic': '#7750a7', 'Legendary': '#8c6828'}[rarity]
        title_lines = title.replace('Gardian', 'Guardian').replace(' Card', '').upper().split(' ')
        title_lines = [' '.join(title_lines)] if len(' '.join(title_lines)) < 14 else [' '.join(title_lines[:1]), ' '.join(title_lines[1:])]
        rank = ['Normal', 'Rare', 'Epic', 'Legendary'].index(rarity) + 1
        gems = ''.join(f'<path d="M{x} 162l7 9-7 9-7-9z" fill="{accent}"/>' for x in range(320-(rank-1)*14, 321+(rank-1)*14, 28))
        body = f'<text x="320" y="62" font-size="24" font-weight="700" letter-spacing="4">FIGHT THE DRAGON</text><path d="M70 90H570" stroke="url(#foil)"/><rect x="196" y="112" width="248" height="40" rx="20" fill="{accent}" fill-opacity=".13"/><text x="320" y="140" fill="{accent}" font-size="25" font-weight="700" letter-spacing="5">{rarity.upper()}</text>{gems}<path d="M320 202L524 320V500L320 602 116 500V320z" fill="{bg}" fill-opacity=".65" stroke="url(#foil)" stroke-width="3"/><circle cx="320" cy="400" r="150" fill="url(#aura)" stroke="{accent}" stroke-opacity=".35"/><circle cx="320" cy="400" r="134" fill="none" stroke="{accent}" stroke-opacity=".25" stroke-dasharray="2 12" stroke-width="4"/><g transform="translate(320 400) scale(1.3)" fill="currentColor">{ICONS[icon]}</g><path d="M180 570H270l50 18 50-18h90" fill="none" stroke="url(#foil)" stroke-width="2"/>'
        body += ''.join(f'<text x="320" y="{630+i*48}" font-size="43" font-weight="800" letter-spacing="2">{escape(line)}</text>' for i, line in enumerate(title_lines))
        body += f'<rect x="46" y="710" width="548" height="150" rx="16" fill="{bg}" fill-opacity=".8" stroke="{accent}" stroke-opacity=".3"/><text x="64" y="892" text-anchor="start" font-size="16" letter-spacing="2" fill="{accent}">FTD / {number:02}</text><text x="576" y="892" text-anchor="end" font-size="16" letter-spacing="3" fill="{accent}">TACTICAL COLLECTION</text>'
        (folder / f'{rarity}_{title.replace(" ", "_")}.svg').write_text(svg(640, 920, body, bg, panel, text, accent), encoding='utf-8')
    accent = '#b99bf4' if theme == 'dark' else '#7550ab'
    back = f'<text x="320" y="105" font-size="28" font-weight="700" letter-spacing="5">FIGHT THE DRAGON</text><path d="M320 210L550 350V600L320 740 90 600V350z" fill="{panel}" stroke="{accent}" stroke-width="4"/><g transform="translate(320 475) scale(2)" color="{accent}">{CREST}</g><text x="320" y="815" font-size="23" letter-spacing="7">CHOOSE YOUR POWER</text>'
    (folder / 'back.svg').write_text(svg(640, 920, back, bg, panel, text, accent), encoding='utf-8')
    false_hope = f'<text x="320" y="100" font-size="28" font-weight="700">FIGHT THE DRAGON</text><g transform="translate(320 420) scale(1.8)" fill="currentColor">{ICONS["fortune"]}</g><text x="320" y="680" font-size="48" font-weight="800">FALSE HOPE</text><text x="320" y="755" font-size="28">NO BONUS CARD</text>'
    (folder / 'false-hope.svg').write_text(svg(640, 920, false_hope, bg, panel, text, accent), encoding='utf-8')

    for index, (label, icon) in enumerate(PAIRS, 1):
        accent = '#68d8ef' if theme == 'dark' else '#186d87'
        body = f'<text x="300" y="48" font-size="20" letter-spacing="4" font-weight="700">FIGHT THE DRAGON</text><circle cx="300" cy="202" r="115" fill="{panel}" stroke="{accent}" stroke-width="2"/><g transform="translate(300 205)" fill="currentColor">{ICONS[icon]}</g><text x="300" y="365" font-size="36" font-weight="800" letter-spacing="3">{label}</text>'
        (folder / f'matching-{index}.svg').write_text(svg(600, 420, body, bg, panel, text, accent), encoding='utf-8')
    body = f'<text x="300" y="52" font-size="22" font-weight="700" letter-spacing="4">FIGHT THE DRAGON</text><g transform="translate(300 220) scale(1.25)" color="{accent}">{CREST}</g><text x="300" y="375" font-size="20" letter-spacing="6">MATCHING CARDS</text>'
    (folder / 'matching-back.svg').write_text(svg(600, 420, body, bg, panel, text, accent), encoding='utf-8')

print(f'Generated {sum(1 for _ in ROOT.rglob("*.svg"))} branded SVG card assets.')
