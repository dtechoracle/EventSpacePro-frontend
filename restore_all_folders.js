const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = dir + '/' + file;
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walk(file));
        } else { 
            if (file.endsWith('.svg')) results.push(file);
        }
    });
    return results;
}

const files = walk('public/assets/modal');
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
            } catch(e) {}
        }
        
        if (foundContent) {
            fs.writeFileSync(file, foundContent);
            console.log('Restored: ' + file + ' from commit ' + foundCommit);
            restoredCount++;
        }
    } catch(e) {}
}
console.log('Restored ' + restoredCount + ' more files across ALL folders.');
