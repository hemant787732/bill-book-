const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf-8');

code = code.replace(/searchBox: \{[\s\S]*?\},/m, "searchBox: {\n    backgroundColor: '#fff',\n    borderRadius: 8,\n    padding: 12,\n    borderWidth: 1,\n    borderColor: '#edf2f7',\n    marginBottom: 12,\n  },");
code = code.replace(/searchInput: \{[\s\S]*?\},/m, "searchInput: {\n    backgroundColor: '#f7fafc',\n    borderColor: '#e2e8f0',\n    borderRadius: 8,\n    borderWidth: 1,\n    color: '#1a202c',\n    fontSize: 14,\n    minHeight: 44,\n    paddingHorizontal: 12,\n  },");

fs.writeFileSync('App.tsx', code);
