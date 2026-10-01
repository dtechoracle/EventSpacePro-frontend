import re

with open('pages/dashboard/editor/[slug]/[id].tsx', 'r', encoding='utf-8') as f:
    content = f.read()

eye_button = '''      {/* Eye Icon (Hide / Show Toggle) */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onHide(item.id, isHidden, item.type);
        }}
        title={isHidden ? "Show element" : "Hide element"}
        className={bsolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-slate-200/60 transition-all }
      >
        {isHidden ? (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </svg>
        ) : (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>'''

if eye_button not in content:
    # try slightly different indentation
    eye_button = eye_button.replace('      {/*', '        {/*').replace('      <button', '        <button')
    print("Trying alternative indentation")

if eye_button in content:
    new_eye = eye_button.replace('right-1.5', 'right-8')
    lock_button = '''
        {/* Lock Icon */}
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
        </button>
'''
    content = content.replace(eye_button, new_eye + lock_button)
    with open('pages/dashboard/editor/[slug]/[id].tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Success")
else:
    print("Still failed to find eye button literal")
