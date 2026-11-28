import sys
from playwright.sync_api import sync_playwright
LONG="Whoosh! Hop on the kite and fly across Mindanao!\nJoin little Jadon and his humming saranggola as they soar across sunny skies, misty waterfalls, leaping dolphins, and colorful vinta boats.\n\nPacked with playful sounds, counting moments, and interactive Point, Count & Play prompts, this vibrant read-aloud celebrates the wonders of the Philippines before drifting into a peaceful, starry-night bedtime."
SHORT="Whoosh! Hop on the kite and fly across Mindanao!\nJoin little Jadon and his humming saranggola as they soar over sunny skies, misty waterfalls, leaping dolphins and colorful vinta boats.\nPlayful sounds, counting moments and Point, Count & Play prompts make this read-aloud a cozy bedtime adventure."
which=sys.argv[1]; out=sys.argv[2]
with sync_playwright() as p:
    b=p.chromium.launch(executable_path="/usr/bin/google-chrome",args=["--no-sandbox"]); pg=b.new_page(viewport={"width":1300,"height":1700})
    pg.add_init_script("sessionStorage.setItem('studio-password','test')")
    pg.goto("http://localhost:8888/studio/"); pg.wait_for_timeout(1200)
    pg.get_by_text("Lanternside Test").first.click(); pg.locator("nav button").nth(2).click(); pg.wait_for_timeout(800)
    tsel=pg.locator("label:has-text('Trim size')").locator("xpath=following-sibling::*[1]")
    opts=pg.locator("label:has-text('Trim size') ~ select option, select:below(label:has-text('Trim size')) option").all_inner_texts()
    sel=pg.locator("select").filter(has=pg.locator("option", has_text="8.5 × 8.5")).first
    sel.select_option(index=[i for i,t in enumerate(sel.locator("option").all_inner_texts()) if "8.5 × 8.5" in t][0])
    ta=pg.locator("textarea").filter(has_text="").nth(0)
    pg.get_by_label("Back cover blurb").fill(LONG if which=="long" else SHORT) if pg.get_by_label("Back cover blurb").count() else pg.locator("textarea[placeholder*='KDP description']").fill(LONG if which=="long" else SHORT)
    pg.locator("input[type=number]").first.fill("28"); pg.wait_for_timeout(1200)
    pg.locator("canvas[aria-label='Paperback wrap preview']").screenshot(path=out)
    b.close()
