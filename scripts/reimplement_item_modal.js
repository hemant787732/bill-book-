const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf-8');

// 1. Rewrite ItemEditor to be a Modal as per Screenshot 003050.png
const newItemEditor = `
function ItemEditor({
  autoRoundFigure,
  index,
  item,
  itemNameOptions,
  language,
  onChange,
  onCreateItemName,
  onRemove,
  onDone,
  rates,
  rateInputValue,
  removable,
}: {
  autoRoundFigure: boolean;
  index: number;
  item: BillItemDraft;
  itemNameOptions: ItemNameOption[];
  language: Language;
  onChange: (index: number, key: keyof BillItemDraft, value: string) => void;
  onCreateItemName: (name: string, material: MetalType) => Promise<boolean>;
  onRemove: (index: number) => void;
  onDone: () => void;
  rates: MetalRates;
  rateInputValue: string;
  removable: boolean;
}) {
  const rate = getMetalRatePerGram(item.material, rates);
  const [showItemNames, setShowItemNames] = useState(false);
  const [itemSearch, setItemSearch] = useState('');
  const [suggestionsDismissed, setSuggestionsDismissed] = useState(false);
  const suggestionQuery = itemSearch.trim() || item.itemName.trim();
  const visibleItemNames = useMemo(
    () =>
      itemNameOptions.filter(
        (option) =>
          (option.material === item.material || !item.material) &&
          includesSearch([option.name, option.material], suggestionQuery),
      ),
    [item.material, itemNameOptions, suggestionQuery],
  );
  const typedItemExists = useMemo(
    () =>
      !item.itemName.trim() ||
      itemNameOptions.some(
        (option) =>
          option.material === item.material &&
          option.name.trim().toLowerCase() === item.itemName.trim().toLowerCase(),
      ),
    [item.itemName, item.material, itemNameOptions],
  );
  const showSuggestionBar = !suggestionsDismissed && (showItemNames || !!item.itemName.trim() || !!itemSearch.trim());

  return (
    <Modal visible animationType="slide">
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
        <View style={styles.header}>
           <Text style={styles.headerTitle}>Item {index + 1}</Text>
           <Pressable onPress={onDone} style={{ padding: 8, borderWidth: 1, borderColor: '#ffc107', borderRadius: 6 }}>
              <Text style={{ color: '#007a66', fontWeight: '700' }}>Close</Text>
           </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
          <View style={styles.itemCard}>
            <Text style={styles.sectionTitle}>Item {index + 1}</Text>
            
            <View style={styles.formGrid}>
               <View style={styles.fieldWide}>
                  <Field
                    label="Item"
                    value={item.itemName}
                    onChangeText={(value) => {
                      onChange(index, 'itemName', value);
                      setItemSearch(value);
                      setShowItemNames(true);
                      setSuggestionsDismissed(false);
                    }}
                  />
               </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
               <Pressable 
                  onPress={() => setShowItemNames(!showItemNames)}
                  style={{ flex: 1, backgroundColor: '#007a66', padding: 12, borderRadius: 8, alignItems: 'center' }}
               >
                  <Text style={{ color: '#fff', fontWeight: '700' }}>Item list</Text>
               </Pressable>
               <Pressable 
                  onPress={onDone}
                  style={{ flex: 1, backgroundColor: '#007a66', padding: 12, borderRadius: 8, alignItems: 'center' }}
               >
                  <Text style={{ color: '#fff', fontWeight: '700' }}>Save</Text>
               </Pressable>
            </View>

            {showSuggestionBar ? (
              <View style={[styles.itemNameSlidePanel, { marginBottom: 20 }]}>
                 <ScrollView nestedScrollEnabled style={{ maxHeight: 200 }}>
                    {visibleItemNames.map(opt => (
                       <Pressable 
                          key={opt.id} 
                          onPress={() => {
                             onChange(index, 'itemName', opt.name);
                             setShowItemNames(false);
                          }}
                          style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: '#eee' }}
                       >
                          <Text>{opt.name}</Text>
                       </Pressable>
                    ))}
                 </ScrollView>
              </View>
            ) : null}

            <View style={styles.formGrid}>
               <Field
                  keyboardType="decimal-pad"
                  label="Weight gross (gm)"
                  value={item.weight}
                  onChangeText={(value) => onChange(index, 'weight', value)}
                />
                <Field
                  keyboardType="decimal-pad"
                  label="Packet/box less (gm)"
                  value={item.packetLess}
                  onChangeText={(value) => onChange(index, 'packetLess', value)}
                />
                <Field
                  keyboardType="decimal-pad"
                  label="Touch %"
                  value={item.touch}
                  onChangeText={(value) => onChange(index, 'touch', value)}
                />
                <Field
                  keyboardType="number-pad"
                  label="Pcs"
                  value={item.pcs}
                  onChangeText={(value) => onChange(index, 'pcs', value)}
                />
                <Field
                  keyboardType="decimal-pad"
                  label="Rate/gm"
                  value={rateInputValue}
                  onChangeText={(value) => onChange(index, 'rate', value)}
                />
                <Field
                  keyboardType="decimal-pad"
                  label="Labour"
                  value={item.labour}
                  onChangeText={(value) => onChange(index, 'labour', value)}
                />
            </View>

            <View style={styles.calcRow}>
              <CalcPill label="Rate/gm" value={formatMoney(parseAmount(item.rate) || rate)} />
              <CalcPill label="Net wt" value={formatCalcValue(Math.max(parseAmount(item.weight) - parseAmount(item.packetLess), 0), 3)} />
              <CalcPill label="Fine" value={formatCalcValue(parseAmount(item.fine), 3)} />
              <CalcPill label="Labour" value={formatBillMoney(calculateLabourCharge(item), autoRoundFigure)} />
            </View>

            {removable && (
               <Pressable onPress={() => { onRemove(index); onDone(); }} style={{ marginTop: 24, alignItems: 'center' }}>
                  <Text style={{ color: '#e53e3e', fontWeight: '700' }}>Remove item</Text>
               </Pressable>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
`;

// Replace ItemEditor definition
const editorRegex = /function ItemEditor\(\{[\s\S]*?^}$/m;
code = code.replace(editorRegex, newItemEditor);

// 2. Update BillScreen to handle the modal workflow
const billScreenStart = code.indexOf('function BillScreen');
const returnIndex = code.indexOf('return (', billScreenStart);
const stateIndex = code.indexOf('const [hiddenPartySuggestionIds', billScreenStart);

// Inject editingItemIndex state
code = code.splice(stateIndex, 0, `  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);\n`);

// Replace the item mapping loop in BillScreen
const itemsLoopRegex = /\{billPayload\.items\.map\(\(item, index\) => \([\s\S]*?\) : \([\s\S]*?\)\s+\)\)\}/;
const newItemsLoop = `{billPayload.items.map((item, index) => (
          <Pressable
            key={item.id}
            onPress={() => setEditingItemIndex(index)}
            style={styles.collapsedItemRow}
          >
            <View>
              <Text style={styles.collapsedItemTitle}>{index + 1}. {item.itemName || 'Blank item'}</Text>
              <Text style={styles.collapsedItemMeta}>
                {formatCalcValue(parseAmount(item.fine), 3) || '0'} gm fine | ₹ {formatBillMoney(item.amount, autoRoundFigure)}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#cbd5e0" />
          </Pressable>
      ))}

      {editingItemIndex !== null && (
          <ItemEditor
            index={editingItemIndex}
            item={billPayload.items[editingItemIndex]}
            itemNameOptions={itemNameOptions}
            language={language}
            rateInputValue={draftItems[editingItemIndex]?.rate ?? billPayload.items[editingItemIndex].rate}
            autoRoundFigure={autoRoundFigure}
            onChange={onItemChange}
            onCreateItemName={onCreateItemName}
            onRemove={onRemoveItem}
            onDone={() => setEditingItemIndex(null)}
            rates={rates}
            removable={billPayload.items.length > 1}
          />
      )}`;

code = code.replace(itemsLoopRegex, newItemsLoop);

// Helper for splice
if (!String.prototype.splice) {
    code = code.replace("const [editingItemIndex", "  const [editingItemIndex"); // Just a hack to not need splice
}

fs.writeFileSync('App.tsx', code);
console.log('Re-implemented Item Add Screen as Modal');
