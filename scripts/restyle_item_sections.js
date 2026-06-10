const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf-8');

// 1. Update the loop in BillScreen to look more like "Section headers" for collapsed items
const loopRegex = /\{billPayload\.items\.map\(\(item, index\) => \(\s+collapsedItemIds\.includes\(item\.id\) \? \([\s\S]*?\) : \([\s\S]*?\)\s+\)\)\}/;
const modernLoop = `{billPayload.items.map((item, index) => (
        collapsedItemIds.includes(item.id) ? (
          <Pressable
            key={item.id}
            onPress={() => setCollapsedItemIds((current) => current.filter((id) => id !== item.id))}
            style={styles.collapsedItemRow}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="chevron-down-circle-outline" size={18} color="#007a66" style={{ marginRight: 8 }} />
              <Text style={styles.collapsedItemTitle}>Item {index + 1}: {item.itemName || 'New item'}</Text>
            </View>
            <Text style={styles.collapsedItemMeta}>
               ₹ {formatBillMoney(item.amount, autoRoundFigure)}
            </Text>
          </Pressable>
        ) : (
          <ItemEditor
            index={index}
            item={item}
            itemNameOptions={itemNameOptions}
            key={item.id}
            language={language}
            rateInputValue={draftItems[index]?.rate ?? item.rate}
            autoRoundFigure={autoRoundFigure}
            onChange={onItemChange}
            onCreateItemName={onCreateItemName}
            onRemove={onRemoveItem}
            onDone={(id) => setCollapsedItemIds(prev => [...new Set([...prev, id])])}
            rates={rates}
            removable={billPayload.items.length > 1}
          />
        )
      ))}`;

code = code.replace(loopRegex, modernLoop);

// 2. Update the "Add Item" button style to match Dashboard actions
code = code.replace(
    /style=\{\[styles\.button, styles\.secondaryButton, styles\.addItemButton\]\}/,
    'style={styles.addItemAction}'
);

// 3. Update styles for collapsed rows and Add Item button
code = code.replace(/collapsedItemRow: \{[\s\S]*?\},/m, `collapsedItemRow: {
    backgroundColor: '#fff',
    borderColor: '#edf2f7',
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },`);

// Add addItemAction style
if (!code.includes('addItemAction:')) {
    code = code.replace(/addItemButton: \{[\s\S]*?\},/m, `addItemAction: {
    backgroundColor: '#fff',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#edf2f7',
    borderStyle: 'dashed',
  },`);
}

fs.writeFileSync('App.tsx', code);
