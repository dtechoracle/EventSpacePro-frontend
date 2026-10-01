import re

with open('pages/dashboard/editor/[slug]/[id].tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add onLock to ElementRowProps
content = content.replace(
    'onHide: (id: string, hidden: boolean, type: string) => void;',
    'onHide: (id: string, hidden: boolean, type: string) => void;\n    onLock: (id: string, locked: boolean, type: string) => void;'
)

# 2. Add handleToggleLock
lock_func = '''
  const handleToggleLock = React.useCallback((id: string, currentlyLocked: boolean, type: string) => {
    const store = useProjectStore.getState();
    const updates = { locked: !currentlyLocked };

    if (type === "Wall") store.updateWall(id, updates);
    else if (type === "Shape") store.updateShape(id, updates);
    else if (type === "Asset") store.updateAsset(id, updates);
    else if (type === "Text") store.updateTextAnnotation(id, updates);
    else if (type === "Dimension") store.updateDimension(id, updates);
    else if (type === "Label") store.updateLabelArrow(id, updates);
    else if (type === "Group") store.updateGroup(id, updates);
  }, []);
'''
content = content.replace(
    'const handleToggleHide = React.useCallback((id: string, currentlyHidden: boolean, type: string) => {',
    lock_func + '\n  const handleToggleHide = React.useCallback((id: string, currentlyHidden: boolean, type: string) => {'
)

# 3. Add onLock to rowProps
content = content.replace(
    'onHide: handleToggleHide,',
    'onHide: handleToggleHide,\n        onLock: handleToggleLock,'
)

# 4. Extract onLock and handle lock icon in ElementRow
row_props_replace = '''
    onHide,
    onLock,
'''
content = content.replace('onHide,\n    onStartRename,', row_props_replace + '    onStartRename,')

is_locked_var = '''
    const isHidden = Boolean(item.hidden);
    const isLocked = Boolean(item.locked);
'''
content = content.replace('const isHidden = Boolean(item.hidden);', is_locked_var)

# 5. Insert Lock icon beside Eye icon
eye_button_regex = r'(<button[^>]*?title=\{isHidden \? "Show element" : "Hide element"\}.*?</button>)'
eye_button_match = re.search(eye_button_regex, content, re.DOTALL)
if eye_button_match:
    eye_button = eye_button_match.group(1)
    # adjust right spacing for eye button
    new_eye_button = eye_button.replace('right-1.5', 'right-8')
    
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
    content = content.replace(eye_button, new_eye_button + '\n' + lock_button)
else:
    print("Could not find eye button!")

with open('pages/dashboard/editor/[slug]/[id].tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated [id].tsx")
