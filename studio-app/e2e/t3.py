import json,urllib.request
from playwright.sync_api import sync_playwright
KEY="studio-password"
with sync_playwright() as p:
    b=p.chromium.launch(executable_path="/usr/bin/google-chrome",args=["--no-sandbox"]); pg=b.new_page(viewport={"width":1300,"height":1800})
    pg.add_init_script("sessionStorage.setItem('%s','test')"%KEY)
    pg.goto("http://localhost:8888/studio/"); pg.wait_for_timeout(1200)
    pg.get_by_text("Lanternside Test").first.click(); pg.locator("nav button").nth(1).click(); pg.wait_for_timeout(700)
    scope=pg.locator("details",has_text="Lanternside series art").first
    n0=scope.get_by_text("Ignore / Dismiss").count(); print("dismiss buttons visible:",n0)
    scope.get_by_text("Ignore / Dismiss").first.click(); pg.wait_for_timeout(900)
    n1=scope.get_by_text("Ignore / Dismiss").count(); print("after dismiss:",n1, "| dismissed note:", scope.get_by_text("Dismissed:").count()>0)
    scope.get_by_text("Show them again").first.click(); pg.wait_for_timeout(900)
    print("after show again:",scope.get_by_text("Ignore / Dismiss").count())
    b.close()
