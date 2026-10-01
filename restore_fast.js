const { execSync } = require('child_process');
const fs = require('fs');

const commitsToCheck = ['815a1af', '920029c', '7cf86db', 'aeb883c', 'c7a37d3', '48869be', '8f578e3', 'fe3dfff', '150918f'];

const output = execSync('git ls-tree -r -z --name-only HEAD public/assets/modal').toString();
const files = output.split('\0').filter(f => f.endsWith('.svg'));

let count = 0;
for (const file of files) {
    const currentContent = fs.readFileSync(file, 'utf8');
    if (currentContent.includes('auto-fill')) continue; 
    
    let found = false;
    for (const commit of commitsToCheck) {
        try {
            const content = execSync('git show ' + commit + ':"' + file + '"', {stdio: 'pipe'}).toString();
            if (content.includes('auto-fill') || content.includes('bgGradient')) {
                fs.writeFileSync(file, content);
                console.log('Restored ' + file + ' from ' + commit);
                count++;
                found = true;
                break;
            }
        } catch(e) {}
    }
}
console.log('Finished restoring ' + count + ' files.');
