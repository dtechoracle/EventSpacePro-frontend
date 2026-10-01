import re

with open('pages/dashboard/editor/[slug]/[id].tsx', 'r', encoding='utf-8') as f:
    content = f.read()

pattern = re.compile(r'(\s*)\{\/\* Eye Icon \(Hide \/ Show Toggle\) \*\/\}.*?<\/button>', re.DOTALL)
match = pattern.search(content)

if match:
    indent = match.group(1)
    eye_button = match.group(0)
    new_eye = eye_button.replace('right-1.5', 'right-8')
    lock_button = indent + '''{/* Lock Icon */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onLock(item.id, isLocked, item.type);
          }}
          title={isLocked ? "Unlock element" : "Lock element"}
          className={bsolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-slate-200/60 transition-all }
        >
          {isLocked ? (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          ) : (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 9.9-1" />
            </svg>
          )}
        </button>'''
    content = content.replace(eye_button, new_eye + lock_button)
    with open('pages/dashboard/editor/[slug]/[id].tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Success")
else:
    print("Failed")
