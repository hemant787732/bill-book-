const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf-8');

// 1. Add LabourTypeSelector to ItemEditor before Rate/gm field
const labourToggleCode = `
                <View style={[styles.segmentBlock, { marginBottom: 12 }]}>
                  <Text style={styles.fieldLabel}>Labour type</Text>
                  <LabourTypeSelector
                    value={item.labourType || 'gw'}
                    onChange={(value) => onChange(index, 'labourType', value)}
                  />
                </View>
                <Field
                  keyboardType="decimal-pad"
                  label="Rate/gm"`;

code = code.replace(/<Field\s+keyboardType=\"decimal-pad\"\s+label=\"Rate\/gm\"/, labourToggleCode);

// 2. Fix the "na na na" issue in Bill Preview
// Ensure formatBillMoney handles NaN or undefined
code = code.replace(
    /function formatBillMoney\(amount, round\)\s+\{/,
    `function formatBillMoney(amount, round) {
  const val = parseAmount(amount);
  if (isNaN(val)) return '0';`
);

fs.writeFileSync('App.tsx', code);
console.log('Added Labour Type Toggle and fixed na na na issue.');
