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
    if (currentContent.includes('auto-fill')) continue; 

    const allCommits = execSync('git log --format="%H" -- "' + file + '"').toString().split('\n').filter(x => x.trim());
    
    let foundContent = null;
    let foundCommit = null;
    for (const commit of allCommits) {
        try {
            const content = execSync('git show ' + commit + ':"' + file + '"').toString();
            if (content.includes('auto-fill') || content.includes('bgGradient')) {
                foundContent = content;
                foundCommit = commit;
                break;
            }
        } catch(e) {}
    }
    
    if (foundContent) {
        fs.writeFileSync(file, foundContent);
        console.log('Restored auto-fill for: ' + file + ' from commit ' + foundCommit);
        restoredCount++;
    }
}
console.log('Restored ' + restoredCount + ' files.');
