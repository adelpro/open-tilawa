import re, shutil

src = open('index.html').read()
s = src

# 1. data
s = s.replace('<script src="src/peaks-film.js"></script>', '<script src="src/peaks-32.js"></script>')

# 2. CSS for the new panels
css_anchor = "  .cursor{position:absolute;"
css_new = """  /* surah list */
  .srow{display:flex;align-items:center;gap:12px;min-height:64px;padding:8px 16px}
  .srow .num{flex:none;width:32px;font-size:12px;color:var(--muted);font-variant-numeric:tabular-nums}
  .srow .txt{flex:1;min-width:0}
  .srow .nm{display:block;font-size:16px;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .srow.cur .nm{font-weight:600}
  .srow .meta{display:block;margin-top:4px;font-size:12px;color:var(--muted)}
  .srow .size{flex:none;font-size:12px;color:var(--muted);font-variant-numeric:tabular-nums}

  /* account */
  .acct{padding:16px;display:flex;flex-direction:column;gap:12px}
  .pcard{border:1px solid var(--line);border-radius:12px;padding:12px}
  .pct{margin:0;font-size:14px;font-weight:500;color:var(--ink)}
  .pcn{margin:4px 0 0;font-size:12px;line-height:1.75;color:var(--muted)}
  .pfl{display:block;margin:12px 0 6px;font-size:12px;color:var(--muted)}
  .pinput{height:40px;border:1px solid var(--line);border-radius:8px;display:flex;align-items:center;gap:1px;padding:0 10px;font-size:14px;color:var(--ink)}
  .caret{display:inline-block;width:1px;height:17px;background:#111;margin-inline-start:1px}
  .psolid{margin-top:12px;width:100%;height:44px;border-radius:8px;background:var(--ink);color:#fff;font-size:14px;font-weight:500;display:flex;align-items:center;justify-content:center}
  .prow{display:flex;gap:8px;margin-top:12px}
  .prow span{border:1px solid var(--line);border-radius:8px;height:40px;flex:1;display:flex;align-items:center;justify-content:center;font-size:13px;color:var(--ink)}

  /* stream */
  .stream{padding:16px;display:flex;flex-direction:column;gap:13px}
  .srow2{display:flex;align-items:center;justify-content:space-between;gap:24px}
  .sl{display:flex;align-items:center;gap:8px;font-size:14px;color:var(--muted)}
  .sv{font-size:14px;color:var(--ink);font-variant-numeric:tabular-nums}
  .snote{margin:0;font-size:12px;line-height:1.7;color:var(--muted)}

  .cursor{position:absolute;"""
s = s.replace(css_anchor, css_new, 1)

# 3. the three panels, right after the roster panel
roster_end = s.index('      </aside>') + len('      </aside>')
panels = """

      <aside class="panel" id="panel-surahs" style="display:none">
        <div class="head"><h2>السور</h2><div class="acts"><span id="i-pin2"></span><span id="i-close2"></span></div></div>
        <div class="search"><span style="flex:1">ابحث باسم السورة أو رقمها</span><span id="i-search2"></span></div>
        <ul id="surahRows"></ul>
      </aside>

      <aside class="panel" id="panel-account" style="display:none">
        <div class="head"><h2>الحساب</h2><div class="acts"><span id="i-close3"></span></div></div>
        <div class="acct">
          <div class="pcard">
            <p class="pct">حلقة جديدة</p>
            <p class="pcn">الحلقة مفتاح يُولَّد هنا ويُحفظ في هذا المتصفح — لا اسم مستخدم ولا كلمة مرور. أضف جهازاً آخر إليها الآن إن أردت أن تبقى الحلقة ومفضّلاتها بعد فقد هذا الجهاز.</p>
            <span class="pfl">اسم الحلقة</span>
            <div class="pinput"><span id="ringName"></span><span class="caret" id="ringCaret" style="visibility:hidden"></span></div>
            <div class="psolid">إنشاء حلقة</div>
          </div>
          <div class="pcard">
            <p class="pct">الانضمام إلى حلقة</p>
            <p class="pcn">امسح رمزاً من جهاز داخل الحلقة، فينسخ جهازك المفتاح نفسه.</p>
            <div class="prow"><span>المسح بالكاميرا</span><span>إدخال الرمز يدوياً</span></div>
          </div>
        </div>
      </aside>

      <aside class="panel" id="panel-stream" style="display:none">
        <div class="head"><h2>تفاصيل البث</h2><div class="acts"><span id="i-close4"></span></div></div>
        <div class="stream" id="streamRows"></div>
      </aside>"""
s = s[:roster_end] + panels + s[roster_end:]

open('index32.html', 'w').write(s)
print('index32.html written', len(s))
