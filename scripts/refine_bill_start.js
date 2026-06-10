const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf-8');

// 1. In start functions, set items to EMPTY initially so "Add item" is the only thing shown in start
code = code.replace(/setItems\(\[emptyItem\('silver'\)\]\);/g, "setItems([]);");

// 2. Add emptyItem to onAddItem call to ensure we add a new item correctly
// Finding the call to onAddItem in the return of JewelleryBillBook
code = code.replace(/onAddItem=\{onAddItem\}/g, "onAddItem={() => setItems(prev => [...prev, emptyItem('silver')])}");

// 3. Update BillScreen to handle empty items list and show simple "Add item" button as per Screenshot 2026-06-08 002846.png
// The loop already handles empty items. 
// Let's refine the addItem button style in App.tsx styles.

code = code.replace(/addItemAction: \{[\s\S]*?\},/m, `addItemAction: {
    backgroundColor: '#fff',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#007a66',
  },`);

code = code.replace(/addItemButtonText: \{[\s\S]*?\},/m, `addItemButtonText: {
    color: '#007a66',
    fontSize: 16,
    fontWeight: '700',
  },`);

// 4. Update the actual "Add item" button text and icon in BillScreen
code = code.replace(/<Text style=\{styles\.secondaryButtonText\}>\{t\(language, 'addItem'\)\}<\/Text>/, `
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={styles.addItemButtonText}>{t(language, 'addItem')}</Text>
        </View>`);

// 5. Item Add Screen Style Update (Screenshot 2026-06-08 003050.png)
// Ensure ItemEditor has Gold/Silver selector removed (already done in previous step)
// and it looks clean as a modern form.

fs.writeFileSync('App.tsx', code);
console.log('Updated Bill Screen start and item add style');
