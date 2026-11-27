import json,urllib.request,re
from playwright.sync_api import sync_playwright
BID="11111111-1111-1111-1111-111111111111"
def api():
    return json.load(urllib.request.urlopen(urllib.request.Request(f"http://localhost:8888/api/studio/books/{BID}",headers={"x-studio-password":"test"})))["book"]
res=[]
def ok(n,c,x=""): res.append(c); print(("PASS " if c else "FAIL ")+n,x)
with sync_playwright() as p:
    b=p.chromium.launch(executable_path="/usr/bin/google-chrome",args=["--no-sandbox"]); ctx=b.new_context(accept_downloads=True,viewport={"width":1300,"height":1800}); pg=ctx.new_page()
    errs=[]; pg.on("pageerror",lambda e:errs.append(str(e))); pg.on("dialog",lambda d:d.accept())
    pg.add_init_script("sessionStorage.setItem('studio-password','test')")
    pg.goto("http://localhost:8888/studio/"); pg.wait_for_timeout(1200)
    pg.get_by_text("Lanternside Test").first.click(); pg.locator("nav button").nth(1).click(); pg.wait_for_timeout(700)
    # section 3 -> coloring page
    pg.get_by_text("3. Compass Badge Award").first.click(); pg.wait_for_timeout(400)
    pg.get_by_text("Coloring page: picture only").first.check(); pg.wait_for_timeout(300)
    ok("Draft button disabled on coloring section", pg.locator("li", has_text="3. Compass Badge Award").get_by_role("button",name="Draft").first.is_disabled())
    pg.get_by_role("button",name="Save").click(); pg.wait_for_timeout(1000)
    ok("kind saved on server", api()["sections"][2].get("kind")=="coloring", api()["sections"][2].get("kind"))
    def export():
        with pg.expect_download() as d: pg.get_by_text("Export Printable Book (.HTML)").click()
        return open(d.value.path()).read()
    h=export()
    n=len(re.findall(r'<section class="page',h))
    ok("copyright page present", "All rights reserved" in h and "Bright Trails Publishing" in h)
    ok("even page count", n%2==0, n)
    ok("page counter shown", pg.get_by_text(f"has {n} pages").count()>0)
    ok("ligatures off in CSS", "font-variant-ligatures: none" in h)
    ok("coloring page: picture, no text", 'coloring page"' in h and "Blank back of coloring page" in h)
    ok("coloring section has no worksheet", "Compass Badge Award: Explorer Worksheet" not in h)
    # turn copyright off
    pg.get_by_text("Add a copyright page after the title page").click()
    h2=export(); ok("copyright option off", "All rights reserved" not in h2)
    ok("no page errors", not errs, errs)
    open("/tmp/e2e/printable2.html","w").write(h)
    b.close()
print(sum(res),"of",len(res))
