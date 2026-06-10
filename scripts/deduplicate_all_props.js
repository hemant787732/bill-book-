const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf-8');
const lines = code.split('\n');
const result = [];

let inDestructure = false;
let seenProps = new Set();
let inInterface = false;
let seenInterfaceProps = new Set();

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check for start of function destructuring
    if (line.match(/function\s+[A-Z][a-zA-Z0-9_]*\s*\(\{/)) {
        inDestructure = true;
        seenProps = new Set();
        result.push(line);
        continue;
    }

    if (inDestructure) {
        if (line.includes('}: {')) {
            inDestructure = false;
            inInterface = true;
            seenInterfaceProps = new Set();
            result.push(line);
            continue;
        }
        const match = line.match(/^\s*([a-zA-Z0-9_]+),?$/);
        if (match) {
            const prop = match[1];
            if (seenProps.has(prop)) {
                console.log('Skipping duplicate prop in destructure:', prop);
                continue;
            }
            seenProps.add(prop);
        }
    }

    if (inInterface) {
        if (line.includes('}) {') || line.trim() === '})') {
            inInterface = false;
            result.push(line);
            continue;
        }
        const match = line.match(/^\s*([a-zA-Z0-9_]+):/);
        if (match) {
            const prop = match[1];
            if (seenInterfaceProps.has(prop)) {
                console.log('Skipping duplicate prop in interface:', prop);
                continue;
            }
            seenInterfaceProps.add(prop);
        }
    }

    result.push(line);
}

fs.writeFileSync('App.tsx', result.join('\n'));
