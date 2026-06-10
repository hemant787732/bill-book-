const fs = require('fs');

function extractFunction(content, funcName) {
  const lines = content.split('\n');
  let start = -1;
  let braceCount = 0;
  let result = [];

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(`function ${funcName}`)) {
      start = i;
    }
    if (start !== -1) {
      result.push(lines[i]);
      if (lines[i].includes('{')) braceCount += (lines[i].match(/{/g) || []).length;
      if (lines[i].includes('}')) braceCount -= (lines[i].match(/}/g) || []).length;
      if (braceCount === 0 && i > start) {
        return result.join('\n');
      }
    }
  }
  return null;
}

const backupContent = fs.readFileSync('App_backup.tsx', 'utf-8');
const currentContent = fs.readFileSync('App.tsx', 'utf-8');

const billScreen = extractFunction(backupContent, 'BillScreen');
const marketStockScreen = extractFunction(backupContent, 'MarketStockScreen');
const partyReceiptVouchersScreen = extractFunction(backupContent, 'PartyReceiptVouchersScreen');

let updatedContent = currentContent;

if (billScreen && !currentContent.includes('function BillScreen')) {
    console.log('Restoring BillScreen');
    updatedContent += '\n\n' + billScreen;
}
if (marketStockScreen && !currentContent.includes('function MarketStockScreen')) {
    console.log('Restoring MarketStockScreen');
    updatedContent += '\n\n' + marketStockScreen;
}
if (partyReceiptVouchersScreen && !currentContent.includes('function PartyReceiptVouchersScreen')) {
    console.log('Restoring PartyReceiptVouchersScreen');
    updatedContent += '\n\n' + partyReceiptVouchersScreen;
}

fs.writeFileSync('App.tsx', updatedContent);
