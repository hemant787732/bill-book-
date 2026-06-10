const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf-8');

// 1. Rewrite ItemEditor to match screenshot exactly and fix UI layout
const finalItemEditor = `
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
  
  const showSuggestionBar = !suggestionsDismissed && (showItemNames || !!itemSearch.trim());

  return (
    <Modal visible animationType="slide">
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
        {/* Fixed Header Layout matching screenshot */}
        <View style={{ 
          height: 56, 
          flexDirection: 'row', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          paddingHorizontal: 16, 
          borderBottomWidth: 1, 
          borderBottomColor: '#edf2f7' 
        }}>
           <Text style={{ fontSize: 18, fontWeight: '700', color: '#263238' }}>Item {index + 1}</Text>
           <Pressable 
              onPress={onDone} 
              style={{ 
                paddingVertical: 6, 
                paddingHorizontal: 16, 
                borderWidth: 1, 
                borderColor: '#ffc107', 
                borderRadius: 6 
              }}
           >
              <Text style={{ color: '#007a66', fontWeight: '700', fontSize: 14 }}>Close</Text>
           </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
          <View style={styles.itemCard}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#2d3748', marginBottom: 12 }}>Item {index + 1}</Text>
            
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

            {/* Buttons matching screenshot colors and layout */}
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
               <Pressable 
                  onPress={() => {
                    setShowItemNames(!showItemNames);
                    setSuggestionsDismissed(false);
                  }}
                  style={{ flex: 1, backgroundColor: '#007a66', paddingVertical: 12, borderRadius: 8, alignItems: 'center' }}
               >
                  <Text style={{ color: '#fff', fontWeight: '700' }}>Item list</Text>
               </Pressable>
               <Pressable 
                  onPress={async () => {
                     if (item.itemName.trim()) {
                        await onCreateItemName(item.itemName, item.material);
                     }
                     onDone();
                  }}
                  style={{ flex: 1, backgroundColor: '#007a66', paddingVertical: 12, borderRadius: 8, alignItems: 'center' }}
               >
                  <Text style={{ color: '#fff', fontWeight: '700' }}>Save</Text>
               </Pressable>
            </View>

            {showSuggestionBar ? (
              <View style={{ 
                backgroundColor: '#f7fafc', 
                borderRadius: 8, 
                borderWidth: 1, 
                borderColor: '#edf2f7', 
                marginBottom: 16,
                maxHeight: 200,
                overflow: 'hidden'
              }}>
                 <ScrollView nestedScrollEnabled>
                    {visibleItemNames.map(opt => (
                       <Pressable 
                          key={opt.id} 
                          onPress={() => {
                             onChange(index, 'itemName', opt.name);
                             setShowItemNames(false);
                             setItemSearch('');
                          }}
                          style={{ 
                            padding: 14, 
                            borderBottomWidth: 1, 
                            borderBottomColor: '#edf2f7',
                            backgroundColor: item.itemName === opt.name ? '#ebf8ff' : 'transparent'
                          }}
                       >
                          <Text style={{ color: '#2d3748', fontWeight: item.itemName === opt.name ? '700' : '400' }}>{opt.name}</Text>
                       </Pressable>
                    ))}
                    {visibleItemNames.length === 0 && (
                      <View style={{ padding: 16, alignItems: 'center' }}>
                        <Text style={{ color: '#718096', fontSize: 13 }}>No items found in list.</Text>
                      </View>
                    )}
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
               <Pressable onPress={() => { onRemove(index); onDone(); }} style={{ marginTop: 32, padding: 12, alignItems: 'center' }}>
                  <Text style={{ color: '#e53e3e', fontWeight: '700', fontSize: 14 }}>Remove this item</Text>
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
code = code.replace(editorRegex, finalItemEditor);

fs.writeFileSync('App.tsx', code);
console.log('Final Polish: Item Modal UI Layout fixed and Item List Save integrated.');
