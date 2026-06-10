const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf-8');

// 1. Update Segment active color to teal
code = code.replace(/segmentActive: \{[\s\S]*?backgroundColor: '#9b2339',/m, "segmentActive: {\n    backgroundColor: '#007a66',");

// 2. Update summaryGrid and summaryTile styles to match white cards in screenshot
code = code.replace(/summaryGrid: \{[\s\S]*?\},/m, "summaryGrid: {\n    flexDirection: 'row',\n    gap: 12,\n    marginBottom: 16,\n  },");
code = code.replace(/summaryTile: \{[\s\S]*?\},/m, "summaryTile: {\n    flex: 1,\n    backgroundColor: '#fff',\n    borderRadius: 8,\n    padding: 12,\n    borderWidth: 1,\n    borderColor: '#edf2f7',\n    minHeight: 64,\n    justifyContent: 'center',\n  },");
code = code.replace(/summaryLabel: \{[\s\S]*?\},/m, "summaryLabel: {\n    color: '#718096',\n    fontSize: 10,\n    fontWeight: '700',\n    textTransform: 'uppercase',\n    marginBottom: 4,\n  },");
code = code.replace(/summaryValue: \{[\s\S]*?\},/m, "summaryValue: {\n    color: '#1a202c',\n    fontSize: 18,\n    fontWeight: '800',\n  },");

// 3. Update panel style to be a white card (used by filter and search)
code = code.replace(/panel: \{[\s\S]*?\},/m, "panel: {\n    backgroundColor: '#fff',\n    borderRadius: 8,\n    padding: 12,\n    borderWidth: 1,\n    borderColor: '#edf2f7',\n    marginBottom: 12,\n  },");

// 4. Update sectionTitle style
code = code.replace(/sectionTitle: \{[\s\S]*?\},/m, "sectionTitle: {\n    fontSize: 18,\n    fontWeight: '800', \n    color: '#1a202c',\n    marginBottom: 8,\n    marginTop: 4,\n  },");

// 5. Update root page background
code = code.replace(/page: \{[\s\S]*?backgroundColor: '#[^']+',/m, "page: {\n    flexGrow: 1,\n    padding: 12,\n    backgroundColor: '#f8f9fa',");

fs.writeFileSync('App.tsx', code);
