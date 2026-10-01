const { execSync } = require('child_process');
const fs = require('fs');

const dir = 'public/assets/modal/Furniture';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.svg')).map(f => dir + '/' + f);

let restoredCount = 0;

for (let file of files) {
    const currentContent = fs.readFileSync(file, 'utf8');
    if (currentContent.includes('auto-fill') || currentContent.includes('fillable') || currentContent.includes('data-auto-fill')) {
        continue;
    }

    try {
        const logOutput = execSync('git log --format="%H" -- "' + file + '"', {stdio: 'pipe'}).toString();
        const allCommits = logOutput.split('\n').filter(x => x.trim());
        
        let foundContent = null;
        let foundCommit = null;
        
        for (const commit of allCommits) {
            try {
                const content = execSync('git show ' + commit + ':"' + file + '"', {stdio: 'pipe'}).toString();
                if (content.includes('id="auto-fill"') || content.includes('id="fillable"') || content.includes('data-auto-fill="true"')) {
                    foundContent = content;
                    foundCommit = commit;
                    break;
                }
            } catch(e) {
                // Ignore git show errors (file didn't exist in this commit)
            }
        }
        
        if (foundContent) {
            fs.writeFileSync(file, foundContent);
            console.log('Restored: ' + file + ' from commit ' + foundCommit);
            restoredCount++;
        }
    } catch(e) {
        console.log('Error processing ' + file + ': ' + e.message);
    }
}
console.log('Restored ' + restoredCount + ' more files.');
