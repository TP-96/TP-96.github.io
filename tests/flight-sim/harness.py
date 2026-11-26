"""Loads ../../flight-sim.html in headless Chromium with three.js served locally.
Setup:  pip install playwright && playwright install chromium && npm i three@0.160.0   (run here)"""
import pathlib
from playwright.sync_api import sync_playwright
HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent.parent
THREE = (HERE / 'node_modules/three/build/three.module.js').read_bytes()
def open_page(pw, w=1400, h=900, touch=False):
    b = pw.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    ctx = b.new_context(viewport={'width': w, 'height': h}, has_touch=touch, is_mobile=touch)
    pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append('console:' + m.text) if m.type == 'error' else None)
    def route(r):
        u = r.request.url
        if 'three.module.js' in u: return r.fulfill(body=THREE, content_type='application/javascript')
        if u.startswith('http://site/'):
            f = ROOT / u[len('http://site/'):].split('?')[0]
            if f.exists(): return r.fulfill(body=f.read_bytes(), content_type='text/html' if f.suffix == '.html' else 'application/octet-stream')
        return r.fulfill(status=404, body='')
    pg.route('**/*', route)
    pg.goto('http://site/flight-sim.html?debug')
    pg.wait_for_function('window.__fs', timeout=60000)
    return b, pg, errs
