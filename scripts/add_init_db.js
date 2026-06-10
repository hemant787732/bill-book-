const fs = require('fs');
let code = fs.readFileSync('src/data/database.ts', 'utf-8');

if (!code.includes('export async function initDatabase')) {
  code += `

export async function initDatabase(): Promise<LocalDatabase> {
  return {
    exec: async (queries) => {
      console.log("Mock DB Exec:", queries);
      return [];
    },
    runAsync: async (sql, args) => {
      console.log("Mock DB Run:", sql, args);
      return { lastInsertRowId: 0, changes: 0 };
    },
    getAllAsync: async (sql, args) => {
      console.log("Mock DB GetAll:", sql, args);
      return [];
    },
    getFirstAsync: async (sql, args) => {
      console.log("Mock DB GetFirst:", sql, args);
      return null;
    }
  } as any;
}
`;
  fs.writeFileSync('src/data/database.ts', code);
}
