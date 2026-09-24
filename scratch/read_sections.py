import re

with open('scratch/teampulse_reference.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()

headers = []
for i, line in enumerate(lines):
    if line.startswith('# ===') and i+1 < len(lines) and lines[i+1].startswith('# '):
        headers.append((i+1, lines[i+1].strip('# \n')))

for line_num, h in headers:
    print(f"Line {line_num}: {h}")
