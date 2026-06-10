const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf-8');

const target = `<CalcPill label="Labour amount" value={formatBillMoney(item.amount, autoRoundFigure)} />

      <Pressable`;

const replacement = `<CalcPill label="Labour amount" value={formatBillMoney(item.amount, autoRoundFigure)} />
      </View>

      <Pressable`;

if (code.includes(target)) {
    code = code.replace(target, replacement);
    fs.writeFileSync('App.tsx', code);
    console.log('Fixed missing closing View brace!');
} else {
    console.log('Target string not found, checking exact whitespace...');
    // Fallback search with more flexible spacing
    const regex = /<CalcPill label=\"Labour amount\" value=\{formatBillMoney\(item\.amount, autoRoundFigure\)\} \/>\s+<Pressable/;
    if (regex.test(code)) {
        code = code.replace(regex, `<CalcPill label="Labour amount" value={formatBillMoney(item.amount, autoRoundFigure)} />\n      </View>\n\n      <Pressable`);
        fs.writeFileSync('App.tsx', code);
        console.log('Fixed using regex!');
    } else {
        console.log('Could not find pattern to fix.');
    }
}
