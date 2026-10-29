"""Import the three current question sheets without modifying the workbook."""
import json, re, sys
from pathlib import Path
import openpyxl

workbook = openpyxl.load_workbook(sys.argv[1], data_only=True)
bank = {}
for sheet, key, header in [('Emoji Decode New (yang dipake)', 'imageDecode', 2), ('Quiz Flip Card (New)', 'matchCard', 3), ('Rahang Risiko (New)', 'jawsOfRisk', 2)]:
    rows = list(workbook[sheet].values)
    columns = {str(value): i for i, value in enumerate(rows[header-1]) if value}
    def value(row, name):
        return str(row[columns[name]] or '').strip() if name in columns else ''
    questions = []
    for row in rows[header:]:
        title = value(row, 'Title')
        if not re.fullmatch(r'Q-\d+', title):
            continue
        decode = key == 'imageDecode'
        options = re.split(r'\s*\n\s*(?=[A-D][.)])', value(row, 'Option')) if not decode else []
        options = [re.sub(r'^[A-D][.)]\s*', '', option).strip() for option in options if option]
        raw_answer = value(row, 'CorrectOption')
        questions.append(dict(number=int(title[2:]), prompt=value(row, 'QuestionImage' if decode else 'QuestionText'), answer=re.sub(r'^[A-D][.)]\s*', '', raw_answer), options=options, kind='decode' if decode else 'choice', hint=value(row, 'Clue' if decode else 'Context'), explanation=value(row, 'Kalimat Edukasi' if decode else 'Penjelasan Jawaban/Kalimat Edukasi'), sourceWorkbook=Path(sys.argv[1]).name, sourceSheet=sheet, sourceRow=rows.index(row)+1, location=value(row, 'Lokasi'), division=value(row, 'Divisi')))
    bank[key] = questions
Path('src/data/reference-question-bank.json').write_text(json.dumps(bank, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
print({key: len(rows) for key, rows in bank.items()})
