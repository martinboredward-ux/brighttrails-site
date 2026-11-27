import re
from playwright.sync_api import sync_playwright
KEY=open('/home/claude/brighttrails-site/studio-app/src/api.ts').read().split('const KEY = "')[1].split('"')[0]
with sync_playwright() as p:
    b=p.chromium.launch(executable_path="/usr/bin/google-chrome",args=["--no-sandbox"])
    ctx=b.new_context(accept_downloads=True); pg=ctx.new_page()
    pg.add_init_script("sessionStorage.setItem('%s','test')"%KEY)
    pg.on("dialog",lambda d:d.accept())
    pg.goto("http://localhost:8888/studio/"); pg.wait_for_timeout(1500)
    pg.get_by_text("Lanternside Test").first.click(); pg.locator("nav button").nth(1).click(); pg.wait_for_timeout(800)
    with pg.expect_download() as d: pg.get_by_text("Export Printable Book (.HTML)").click()
    path=d.value.path(); html=open(path).read()
    print("size",len(html))
    print("puzzle frame present:", 'alt="Puzzle"' in html)
    print("page picture frames:", html.count('class="frame pic'), "| img tags:", html.count("<img "))
    # section 1 has page upload + 2 puzzles: page picture must be the upload not the puzzle
    open('/tmp/e2e/printable.html','w').write(html)
    b.close()
