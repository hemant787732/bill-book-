const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf-8');

// 1. Update ItemEditor to include a "Done" button at the bottom
const doneButton = `
      <Pressable 
        onPress={() => onDone(item.id)} 
        style={[styles.button, styles.secondaryButton, { marginTop: 12, backgroundColor: '#007a66' }]}
      >
        <Text style={[styles.secondaryButtonText, { color: '#fff' }]}>Done</Text>
      </Pressable>
    </View>
  );`;

code = code.replace(/<\/View>\s*\{language !== 'en' && item\.itemName\.trim\(\) \? \([\s\S]*?\) : null\}\s*<\/View>\s*\);\s*}/m, doneButton + '\n}');

// 2. Add onDone to ItemEditor props
code = code.replace(/onRemove: \(index: number\) => void;\n/g, 'onRemove: (index: number) => void;\n  onDone: (id: string) => void;\n');
code = code.replace(/onRemove,\n/g, 'onRemove,\n  onDone,\n');

// 3. Update BillScreen to pass onDone and use modern collapsed styles
code = code.replace(/onRemove=\{onRemoveItem\}/g, 'onRemove={onRemoveItem}\n            onDone={(id) => setCollapsedItemIds(prev => [...new Set([...prev, id])])}');

// 4. Update styles
code = code.replace(/collapsedItemRow: \{[\s\S]*?\},/m, `collapsedItemRow: {
    backgroundColor: '#fff',
    borderColor: '#edf2f7',
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 1,
  },`);

code = code.replace(/collapsedItemTitle: \{[\s\S]*?\},/m, `collapsedItemTitle: {
    color: '#2d3748',
    fontSize: 14,
    fontWeight: '700',
  },`);

code = code.replace(/collapsedItemMeta: \{[\s\S]*?\},/m, `collapsedItemMeta: {
    color: '#718096',
    fontSize: 12,
    fontWeight: '600',
  },`);

fs.writeFileSync('App.tsx', code);
