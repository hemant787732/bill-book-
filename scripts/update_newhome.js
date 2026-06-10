const fs = require('fs');

let code = fs.readFileSync('src/screens/NewHome.tsx', 'utf-8');

// 1. Remove rate props from signature
code = code.replace(/goldRate,\n/g, '');
code = code.replace(/silverRate,\n/g, '');
code = code.replace(/onRateEdit,\n/g, '  onJangadBook,\n');

code = code.replace(/goldRate: string;\n/g, '');
code = code.replace(/silverRate: string;\n/g, '');
code = code.replace(/onRateEdit: \(\) => void;\n/g, '  onJangadBook: () => void;\n');

// 2. Remove Hero Rate section completely
const heroRegex = /<View style=\{styles\.hero\}>[\s\S]*?<\/View>\s*<\/View>\s*<View style=\{styles\.summaryRow\}>/m;
code = code.replace(heroRegex, '<View style={styles.summaryRow}>');

// 3. Replace 'Edit rates' button with 'Jangad book'
const editRatesRegex = /<Pressable style=\{styles\.action\} onPress=\{onRateEdit\}>\s*<Text style=\{styles\.actionText\}>Edit rates<\/Text>\s*<\/Pressable>/m;
code = code.replace(editRatesRegex, '<Pressable style={styles.action} onPress={onJangadBook}>\n              <Text style={styles.actionText}>Jangad book</Text>\n            </Pressable>');

// 4. Clean up unused styles
code = code.replace(/hero: \{[\s\S]*?\},/g, '');
code = code.replace(/heroInfo: \{[\s\S]*?\},/g, '');
code = code.replace(/heroTitle: \{[\s\S]*?\},/g, '');
code = code.replace(/heroSubtitle: \{[\s\S]*?\},/g, '');
code = code.replace(/rateTiles: \{[\s\S]*?\},/g, '');
code = code.replace(/rateTile: \{[\s\S]*?\},/g, '');
code = code.replace(/silverRateTile: \{[\s\S]*?\},/g, '');
code = code.replace(/rateLabel: \{[\s\S]*?\},/g, '');
code = code.replace(/rateValue: \{[\s\S]*?\},/g, '');
code = code.replace(/rateMeta: \{[\s\S]*?\},/g, '');

fs.writeFileSync('src/screens/NewHome.tsx', code);
