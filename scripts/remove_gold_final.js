const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf-8');

// 1. Change default material to silver
code = code.replace(/material: MetalType = 'gold'/g, "material: MetalType = 'silver'");
code = code.replace(/material: 'gold' as MetalType/g, "material: 'silver' as MetalType");
code = code.replace(/useState<MetalType>\('gold'\)/g, "useState<MetalType>('silver')");
code = code.replace(/emptyItem\('gold'\)/g, "emptyItem('silver')");
code = code.replace(/setReceiptMaterial\('gold'\)/g, "setReceiptMaterial('silver')");
code = code.replace(/receiptMaterial: 'gold'/g, "receiptMaterial: 'silver'");

// 2. Remove Gold labels/options
code = code.replace(/\{ label: 'Gold', value: 'gold' \},/g, "");
code = code.replace(/Gold \/ 10 gm/g, "Silver / 1 kg");
code = code.replace(/Gold/g, "Silver");

// 3. Remove Gold specific inputs
code = code.replace(/<Field keyboardType="numeric" label="Gold 10g"[\s\S]*?\/>/g, "");
code = code.replace(/<SummaryTile label="Gold taken"[\s\S]*?\/>/g, "");
code = code.replace(/<SummaryTile label="Gold sold"[\s\S]*?\/>/g, "");
code = code.replace(/<SummaryTile label="Gold balance"[\s\S]*?\/>/g, "");

// 4. Remove RateHero and RateTile for Gold
code = code.replace(/<RateTile label="Gold"[\s\S]*?\/>/g, "");

fs.writeFileSync('App.tsx', code);
