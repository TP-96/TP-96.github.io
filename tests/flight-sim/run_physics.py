"""Runs physics-suite.js inside the page and prints PASS/FAIL per check. Exit code 1 on any failure."""
import sys
from harness import *
code = (HERE / 'physics-suite.js').read_text()
with sync_playwright() as pw:
    b, pg, errs = open_page(pw, 900, 600)
    res = pg.evaluate(code); b.close()
for r in res: print(('PASS ' if r['pass'] else 'FAIL ') + r['name'] + '  —  ' + str(r['detail']))
n = sum(r['pass'] for r in res); print(f'\n{n}/{len(res)} passed')
sys.exit(0 if n == len(res) else 1)
