with open('middleware.ts', 'r', encoding='utf-8') as f:
    c = f.read()

old = """                // Next.js middleware doesn't support atob directly, need to use Buffer
                const decodedStr = Buffer.from(padded, 'base64').toString('utf-8');
                const decoded = JSON.parse(decodedStr);"""

new = """                // Next.js middleware supports atob in Edge runtime
                const decoded = JSON.parse(atob(padded));"""

if old in c:
    c = c.replace(old, new)
    with open('middleware.ts', 'w', encoding='utf-8') as f:
        f.write(c)
    print('Fixed middleware Buffer issue')
else:
    print('Not found')
