from pathlib import Path

p = Path('Index.html')
s = p.read_text(encoding='utf-8')
replacements = [
    ('<meta name="viewport" content="width=device-width, initial-scale=1">', '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">'),
    ('*{box-sizing:border-box}html{scroll-behavior:smooth;width:100%;max-width:100%;overflow-x:hidden}body{margin:0;width:100%;max-width:100%;overflow-x:hidden;-webkit-text-size-adjust:100%;', '*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;'),
    ('.app{width:100%;max-width:820px;', '.app{max-width:820px;'),
    ('.nav{position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:100%;max-width:820px;', '.nav{position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:min(820px,100%);'),
    ('.quiz-dock{position:fixed;left:50%;bottom:0;transform:translateX(-50%);width:100%;max-width:820px;', '.quiz-dock{position:fixed;left:50%;bottom:0;transform:translateX(-50%);width:min(820px,100%);'),
    ("try{app.bootstrap=await server('getAppBootstrap');loading(false);showView('home')}", "try{app.bootstrap=await server('getAppBootstrap');loading(false)}"),
]
for old, new in replacements:
    s = s.replace(old, new)
p.write_text(s, encoding='utf-8')
