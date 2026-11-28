import json
from playwright.sync_api import sync_playwright
MOCK={"concepts":[{"name":"Kite Over Mindanao","why":"Bold kite pops at thumbnail size.","scene":"Jadon holds a big red kite on a green hill, vinta boats below.","layout":{"titlePlacement":"bottom","topSky":"30","scrim":"pill","textColor":"#112233","textEffect":"outline"}},{"name":"B","why":"w","scene":"s2","layout":{"titlePlacement":"top","topSky":"off","scrim":"none","textColor":"#ffffff","textEffect":"none"}},{"name":"C","why":"w","scene":"s3","layout":{"titlePlacement":"split","topSky":"20","scrim":"softDark","textColor":"#ffffff","textEffect":"shadow"}}],"tips":["Keep one hero.","Bright colors.","Test at 1 inch."],"at":"2026-11-27T10:00:00Z"}
with sync_playwright() as p:
    b=p.chromium.launch(executable_path="/usr/bin/google-chrome",args=["--no-sandbox"]); pg=b.new_page(viewport={"width":1300,"height":1700})
    pg.add_init_script("sessionStorage.setItem('studio-password','test')")
    calls=[]
    def h(r):
        calls.append(r.request.post_data); r.fulfill(status=200,content_type="application/json",body=json.dumps(MOCK))
    pg.route("**/api/studio/cover-ideas",h)
    pg.goto("http://localhost:8888/studio/"); pg.wait_for_timeout(1200)
    pg.get_by_text("Lanternside Test").first.click(); pg.locator("nav button").nth(2).click(); pg.wait_for_timeout(800)
    pg.context.grant_permissions(["clipboard-read","clipboard-write"])
    pg.get_by_role("button",name="Copy a basic prompt (free)").click(); pg.wait_for_timeout(300)
    clip=pg.evaluate("navigator.clipboard.readText()"); assert "LOWER 60%" in clip and "NO lettering" in clip, clip[:200]
    pg.locator("label:has-text('Upload a cover') input[type=file]").set_input_files("/tmp/e2e/badge.png"); pg.wait_for_timeout(1500)
    assert pg.get_by_text("Added as a reference cover").count()==1
    pg.get_by_role("button",name="Suggest 3 covers").click(); pg.wait_for_timeout(2500); pg.screenshot(path="/tmp/e2e/dbg.png")
    d=json.loads(calls[0]); assert len(d["refs"])==1 and len(d["refs"][0])>100, "ref not sent"
    assert pg.get_by_text("Kite Over Mindanao").count()==1
    pg.get_by_role("button",name="Copy picture prompt").first.click(); pg.wait_for_timeout(300)
    clip=pg.evaluate("navigator.clipboard.readText()"); assert "vinta boats" in clip and "TOP 35%" in clip
    pg.locator("label:has-text('Upload my finished picture') input[type=file]").first.set_input_files("/tmp/e2e/badge.png"); pg.wait_for_timeout(1500)
    assert pg.get_by_text("In use").count()==1
    pg.get_by_role("button",name="Use this layout").first.click(); pg.wait_for_timeout(500)
    assert pg.get_by_text("Applied the").count()==1
    pg.reload(); pg.wait_for_timeout(1200)
    pg.get_by_text("Lanternside Test").first.click(); pg.locator("nav button").nth(2).click(); pg.wait_for_timeout(800)
    assert pg.get_by_text("Kite Over Mindanao").count()==1, "ideas not saved"
    assert pg.get_by_role("button",name="Get new ideas").count()==1
    assert pg.get_by_text("In use").count()==1 and pg.get_by_role("button",name="Remove").count()>=1
    pg.screenshot(path="/tmp/e2e/t5.png",full_page=False,clip={"x":0,"y":0,"width":1300,"height":1500})
    print("PASS")
    b.close()
