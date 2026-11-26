from harness import *
import time
res = []
def check(name, cond, detail=''):
    res.append((bool(cond), name, detail))
import os; os.makedirs('shots', exist_ok=True)
with sync_playwright() as pw:
    b, pg, errs = open_page(pw, 1300, 820)
    ev = lambda js: pg.evaluate(js)
    # aircraft choice persists
    pg.click('button[data-ac=f22]'); time.sleep(0.5)
    check('choosing F-22 updates the numbers panel', 'Supercruise' in ev("document.getElementById('ac-numbers').textContent"))
    pg.reload(); pg.wait_for_function('window.__fs', timeout=60000); time.sleep(1)
    check('aircraft choice persists across reloads', ev("window.__fs.AC.id") == 'f22' and 'active' in ev("document.querySelector('[data-ac=f22]').className"))
    pg.click('#btn-start'); time.sleep(1.5)
    check('F-22 spawns on 36L with parking brake set', abs(ev("window.__fs.s.pos.x") + 160) < 1 and ev("window.__fs.s.parkBrake") and 'PARKED' in ev("document.querySelector('#btn-brake small').textContent"))
    z0 = ev("window.__fs.s.pos.z"); time.sleep(2)
    check('stays put on the parking brake', abs(ev("window.__fs.s.pos.z") - z0) < 0.01)
    pg.keyboard.down('r'); time.sleep(1.5)
    for _ in range(40):                      # the sim can run slower than real time under software rendering
        if ev("window.__fs.s.pos.z") < z0 - 1: break
        time.sleep(0.25)
    pg.keyboard.up('r')
    check('throttle up releases the parking brake and the jet rolls', not ev("window.__fs.s.parkBrake") and ev("window.__fs.s.pos.z") < z0 - 1, f"throttle {ev('window.__fs.s.throttle'):.2f}")
    pg.keyboard.down('r'); 
    for _ in range(60):
        if ev("window.__fs.s.ias") > 130: break
        time.sleep(0.5)
    pg.keyboard.down('s'); 
    for _ in range(60):
        if not ev("window.__fs.s.grounded"): break
        time.sleep(0.3)
    time.sleep(1.5); pg.keyboard.up('s'); pg.keyboard.up('r')
    check('takes off under keyboard control in the real game loop', not ev("window.__fs.s.grounded") and not ev("window.__fs.s.crashed"), f"{ev('window.__fs.s.ias'):.0f} kt, {ev('window.__fs.s.pos.y'):.0f} m")
    check('afterburner flag lit at full throttle', 'on' in ev("document.getElementById('f-ab').className"))
    pg.locator('#stage').screenshot(path='shots/e2e_f22_climb.png')
    pg.keyboard.press('p'); time.sleep(0.5); p1 = ev("window.__fs.s.pos.y"); time.sleep(1)
    check('pause freezes the simulation', ev("window.__fs.phase") == 'paused' and ev("window.__fs.s.pos.y") == p1)
    pg.click('#btn-resume'); time.sleep(0.5)
    check('resume continues', ev("window.__fs.phase") == 'flying')
    # force a crash into the sea, then retry
    ev("(() => { const s = window.__fs.s; s.pos.set(0, 30, 6000); s.vel.set(0, -60, -100); })()"); time.sleep(3)
    check('crash screen shows a reason', ev("window.__fs.phase") == 'crashed' and len(ev("document.getElementById('crash-reason').textContent")) > 5, ev("document.getElementById('crash-reason').textContent"))
    time.sleep(1); pg.click('#btn-retry'); time.sleep(1)
    check('retry respawns the F-22 on 36L, parked', ev("window.__fs.phase") == 'flying' and abs(ev("window.__fs.s.pos.x") + 160) < 1 and ev("window.__fs.s.parkBrake"))
    pg.keyboard.press('Escape'); time.sleep(0.3); pg.click('#btn-menu-p'); time.sleep(0.5)
    pg.click('button[data-ac=c172]'); time.sleep(0.5)
    check('switching back to the Cessna puts it on 36R', abs(ev("window.__fs.s.pos.x")) < 1 and ev("window.__fs.AC.id") == 'c172' and ev("window.__fs.plane.group.visible"))
    pg.click('#btn-start'); time.sleep(1)
    pg.hover('#btn-brake'); pg.mouse.down(); time.sleep(0.4); held = ev("window.__fs.s.brake"); pg.mouse.up(); time.sleep(0.3)
    pg.keyboard.press('r'); time.sleep(0.3)
    check('brake button: hold to brake, release to let go', held and not ev("window.__fs.touch.brake"))
    pg.keyboard.down('Space'); time.sleep(0.3); sp = ev("window.__fs.s.brake"); pg.keyboard.up('Space')
    check('Space bar brakes', sp)
    pg.locator('#stage').screenshot(path='shots/e2e_c172.png')
    errors = [e for e in errs if '404' not in e]
    check('no JavaScript errors in the whole session', not errors, str(errors[:3]))
    b.close()
    # mobile
    b, pg, errs = open_page(pw, 390, 844, touch=True)
    pg.click('#btn-start'); time.sleep(1.5)
    vis = pg.evaluate("[getComputedStyle(document.getElementById('t-brk')).display, getComputedStyle(document.getElementById('btn-brake')).display]")
    check('phone: touch BRAKE shown, desktop button hidden', vis[1] == 'none' and vis[0] != 'none', str(vis))
    box = pg.locator('#t-brk').bounding_box(); pg.touchscreen.tap(box['x'] + 10, box['y'] + 10)
    pg.locator('#stage').screenshot(path='shots/e2e_mobile.png')
    b.close()
for ok_, n, d in res: print(('PASS ' if ok_ else 'FAIL ') + n + (('  —  ' + d) if d else ''))
print(f"{sum(r[0] for r in res)}/{len(res)}")
