const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf-8');

// Renaming gold related variables to silver equivalents to avoid conflicts and remove gold
code = code.replace(/goldRate/g, 'silverRate');
code = code.replace(/gold10gRate/g, 'silver1kgRate');
code = code.replace(/gold_10g_rate/g, 'silver_1kg_rate');
code = code.replace(/goldWeight/g, 'silverWeight');
code = code.replace(/goldSold/g, 'silverSold');
code = code.replace(/goldRemaining/g, 'silverRemaining');

// Change literals
code = code.replace(/'gold'/g, "'silver'");
code = code.replace(/"gold"/g, '"silver"');

// Fix redundant ternary
code = code.replace(/transaction\.material === 'silver' \? 'Silver \/ 1 kg' : 'Silver \/ 1 kg'/g, "'Silver / 1 kg'");

fs.writeFileSync('App.tsx', code);
