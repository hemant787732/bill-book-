const fs = require('fs');
const path = require('path');

const historyPath = path.join(process.env.USERPROFILE, 'AppData', 'Roaming', 'Code', 'User', 'History');
console.log("Checking VS Code history at:", historyPath);

if (!fs.existsSync(historyPath)) {
  console.log('No VS Code history found.');
  process.exit(0);
}

const dirs = fs.readdirSync(historyPath);
let found = false;

for (const dir of dirs) {
  const entriesFile = path.join(historyPath, dir, 'entries.json');
  if (fs.existsSync(entriesFile)) {
    try {
      const content = fs.readFileSync(entriesFile, 'utf-8');
      if (content.includes('.tsx') || content.includes('.ts')) {
        const data = JSON.parse(content);
        let latest = data.entries[data.entries.length - 1];
        let sourceFile = path.join(historyPath, dir, latest.id);
        if (fs.existsSync(sourceFile)) {
            const fileContent = fs.readFileSync(sourceFile, 'utf-8');
            // Check if this file looks like one of our screens
            if (fileContent.includes('function BillScreen') || 
                fileContent.includes('export function BillScreen') ||
                fileContent.includes('function PartiesScreen') ||
                fileContent.includes('MarketStockScreen')) {
                
                console.log('Found potential file match for:', data.resource);
                // Attempt to restore it based on its original path name
                const res = decodeURIComponent(data.resource);
                const match = res.match(/src[\/\\]screens[\/\\](.*\.tsx?)$/i) || res.match(/src[\/\\](.*\.tsx?)$/i);
                if (match) {
                    const targetDest = path.join(process.cwd(), 'src', match[1]);
                    if (!fs.existsSync(targetDest)) {
                        fs.mkdirSync(path.dirname(targetDest), { recursive: true });
                        fs.copyFileSync(sourceFile, targetDest);
                        console.log(' -> Restored to:', targetDest);
                        found = true;
                    } else {
                        console.log(' -> File already exists:', targetDest);
                    }
                }
            }
        }
      }
    } catch(e) {}
  }
}

if (!found) console.log("Did not find the specific screens.");
