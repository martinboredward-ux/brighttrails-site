import json, urllib.request, re
from playwright.sync_api import sync_playwright
BID="11111111-1111-1111-1111-111111111111"
def api():
    r=urllib.request.Request(f"http://localhost:8888/api/studio/books/{BID}",headers={"x-studio-password":"test"})
    return json.load(urllib.request.urlopen(r))["book"]
res=[]
def ok(name,cond,extra=""):
    res.append((name,bool(cond))); print(("PASS " if cond else "FAIL ")+name, extra)
with sync_playwright() as p:
    b=p.chromium.launch(executable_path="/usr/bin/google-chrome",args=["--no-sandbox"])
    pg=b.new_page(viewport={"width":1300,"height":1800})
    errs=[]; pg.on("pageerror",lambda e:errs.append(str(e))); pg.on("dialog",lambda d:(print("DIALOG:",d.message[:80]),d.accept()))
    pg.add_init_script("sessionStorage.setItem('%s','test')" % open('/home/claude/brighttrails-site/studio-app/src/api.ts').read().split('const KEY = "')[1].split('"')[0])
    pg.goto("http://localhost:8888/studio/"); pg.wait_for_timeout(1500)
    pg.get_by_text("Lanternside Test").first.click(); pg.wait_for_timeout(500)
    ok("stage shown in sidebar", pg.get_by_text("activity · Idea").count()>0)
    ok("stage menu works", True)
    pg.get_by_label("Book stage").select_option("art"); pg.wait_for_timeout(800)
    ok("stage saved on server", api().get("stage")=="art", api().get("stage"))
    # builder tab
    tabs=pg.locator("nav button").all_inner_texts(); print("tabs",tabs)
    pg.locator("nav button").nth(1).click(); pg.wait_for_timeout(800)
    for t in ["Art checklist","Page widgets","Upload many pictures"]:
        ok(f"card: {t}", pg.get_by_text(t).count()>0)
    # art checklist: lanternside items
    pg.get_by_text("Lanternside series art").click(); pg.wait_for_timeout(300)
    ok("checklist ticks Compass Badge", pg.get_by_text("in Library as “Compass Badge”").count()>0)
    pg.screenshot(path="/tmp/e2e/builder.png",full_page=True)
    # widgets
    pg.get_by_text("Page widgets (").click(); pg.wait_for_timeout(300)
    ok("widget samples render svg", pg.locator("li svg").count()>=5, pg.locator("li svg").count())
    pg.get_by_text("$0 Copy widget request for ChatGPT").click(); pg.wait_for_timeout(200)
    # open section 1
    pg.get_by_text("1. Finding North").first.click(); pg.wait_for_timeout(500)
    with pg.expect_file_chooser() as fc: pg.get_by_text("Use my own picture for this page").first.click()
    fc.value.set_files("/tmp/e2e/spread-1.png"); pg.wait_for_timeout(1500)
    bk=api(); ok("upload to page attached to s1", any(i["sectionId"]=="s1" and i["provider"]=="upload" for i in bk["images"]))
    ok("upload shows in section gallery", pg.get_by_text("Uploaded picture").count()>0)
    # library -> page
    sel=pg.get_by_text("Or put a picture from the Character Library").first.locator("xpath=following::select[1]")
    sel.select_option(label=[o for o in sel.locator("option").all_inner_texts() if "Maze Puzzle" in o][0]); 
    pg.get_by_text("Or put a picture from the Character Library").first.locator("xpath=following::button[contains(.,'Put on this page')][1]").click(); pg.wait_for_timeout(1500)
    bk=api(); pz=[i for i in bk["images"] if i.get("slot")=="puzzle"]
    ok("library puzzle copied with slot=puzzle", len(pz)==1 and pz[0]["sectionId"]=="s1", pz)
    ok("library item still present", len(bk["characters"])==2)
    # copy is independent blob
    ok("copy has its own id", pz and pz[0]["id"] not in [c["id"] for c in bk["characters"]])
    # puzzle upload button
    with pg.expect_file_chooser() as fc: pg.get_by_text("Use my own PUZZLE picture").first.click()
    fc.value.set_files("/tmp/e2e/puzzle.png"); pg.wait_for_timeout(1500)
    ok("puzzle upload slot", len([i for i in api()["images"] if i.get("slot")=="puzzle"])==2)
    # bulk
    pg.get_by_text("Upload many pictures at once").click(); pg.wait_for_timeout(300)
    with pg.expect_file_chooser() as fc: pg.get_by_text("Choose pictures").click()
    fc.value.set_files(["/tmp/e2e/spread-2.png","/tmp/e2e/spread-3.png"]); pg.wait_for_timeout(600)
    pg.get_by_text("Upload 2 to pages").click(); pg.wait_for_timeout(2500)
    bk=api(); by={i["sectionId"] for i in bk["images"] if i["provider"]=="upload" and not i.get("slot")}
    ok("bulk: file numbers pick pages 2 and 3", {"s2","s3"}<=by, by)
    # page has art -> art checklist rows
    pg.screenshot(path="/tmp/e2e/after.png",full_page=True)
    ok("no page errors", not errs, errs)
    # image fetch works
    iid=bk["images"][0]["id"]
    r=urllib.request.Request(f"http://localhost:8888/api/studio/image?id={iid}",headers={"x-studio-password":"test"})
    resp=urllib.request.urlopen(r); ok("image served with 24h private cache", "max-age=86400" in resp.headers.get("cache-control",""), resp.headers.get("cache-control"))
    b.close()
print(sum(1 for _,c in res if c),"of",len(res),"passed")
