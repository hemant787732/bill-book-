const fs = require('fs');
const path = require('path');

const appData = path.join(process.env.USERPROFILE, 'AppData', 'Roaming');
const historyPath = path.join(appData, 'Code', 'User', 'History');
const targetProject = 'jewellery-bill-book';

console.log("Checking VS Code local history at:", historyPath);

if (!fs.existsSync(historyPath)) {
  console.log('No VS Code history found.');
  process.exit(0);
}

const dirs = fs.readdirSync(historyPath);
let restored = 0;

for (const dir of dirs) {
  const entriesFile = path.join(historyPath, dir, 'entries.json');
  if (fs.existsSync(entriesFile)) {
    try {
      const content = fs.readFileSync(entriesFile, 'utf-8');
      if (content.includes(targetProject)) {
        const data = JSON.parse(content);
        const res = decodeURIComponent(data.resource);
        
        // Only care about files in the target project
        if (!res.includes(targetProject)) continue;
        
        const relPathStart = res.indexOf(targetProject) + targetProject.length + 1;
        const relPath = res.substring(relPathStart);
        
        const targetDest = path.join(process.cwd(), relPath);
        
        // If file doesn't exist currently, it was deleted
        if (!fs.existsSync(targetDest)) {
            // Find latest entry
            let latest = data.entries[data.entries.length - 1];
            let sourceFile = path.join(historyPath, dir, latest.id);
            
            if (fs.existsSync(sourceFile)) {
               fs.mkdirSync(path.dirname(targetDest), { recursive: true });
               fs.copyFileSync(sourceFile, targetDest);
               console.log('Restored:', relPath);
               restored++;
            }
        }
      }
    } catch(e) { }
  }
}
console.log("Total files restored:", restored);
