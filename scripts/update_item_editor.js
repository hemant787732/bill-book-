const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf-8');

// 1. Update ItemEditor styles to match white card/modern look
code = code.replace(/itemCard: \{[\s\S]*?\},/m, `itemCard: {
    backgroundColor: '#fff',
    borderColor: '#edf2f7',
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },`);

code = code.replace(/itemNameToggle: \{[\s\S]*?backgroundColor: '#8e5360',/m, `itemNameToggle: {
    alignItems: 'center',
    backgroundColor: '#007a66',`);

code = code.replace(/calcPill: \{[\s\S]*?backgroundColor: '#f4ece3',/m, `calcPill: {
    backgroundColor: '#f7fafc',
    borderRadius: 8,
    minWidth: 96,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#edf2f7',`);

// 2. Remove "Silver / Silver" label and MetalSelector from ItemEditor
const itemEditorStart = code.indexOf('function ItemEditor');
if (itemEditorStart !== -1) {
    const returnStart = code.indexOf('return (', itemEditorStart);
    if (returnStart !== -1) {
        const segmentBlockRegex = /<View style=\{styles\.segmentBlock\}>\s*<Text style=\{styles\.fieldLabel\}>Silver \/ Silver<\/Text>\s*<MetalSelector[\s\S]*?\/>\s*<\/View>/;
        code = code.replace(segmentBlockRegex, '');
    }
}

// 3. Fix Field labels to match screenshot (modern font-weight and colors)
code = code.replace(/fieldLabel: \{[\s\S]*?\},/m, `fieldLabel: {
    color: '#718096',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 6,
    textTransform: 'uppercase',
  },`);

fs.writeFileSync('App.tsx', code);
