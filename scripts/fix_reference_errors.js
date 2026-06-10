const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf-8');

// 1. Add Ionicons import if missing
if (!code.includes("import { Ionicons } from '@expo/vector-icons'")) {
    code = code.replace(/import \{[^}]+\} from 'react-native';/m, (match) => {
        return match + "\nimport { Ionicons } from '@expo/vector-icons';";
    });
}

// 2. Fix ItemEditor props to include onDone
// Add to destructuring
code = code.replace(/onRemove,\s+rates,/, 'onRemove,\n  onDone,\n  rates,');
// Add to interface
code = code.replace(/onRemove: \(index: number\) => void;\s+rates:/, 'onRemove: (index: number) => void;\n  onDone: (id: string) => void;\n  rates:');

// 3. Ensure Ionicons usage has capital I
code = code.replace(/<ionicons/g, '<Ionicons');

fs.writeFileSync('App.tsx', code);
console.log('Fixed ReferenceErrors in App.tsx');
