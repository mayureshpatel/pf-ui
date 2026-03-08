const fs = require('fs');

const file = 'src/app/features/transactions/components/csv-import-dialog/csv-import-dialog.component.spec.ts';
let content = fs.readFileSync(file, 'utf8');

// Replace mockAccounts entirely
const newMockAccounts = `
  const mockAccounts = [
    {
      id: 1,
      name: 'Discover Card',
      type: { code: 'CREDIT_CARD' },
      currentBalance: 0,
      bank: BankName.DISCOVER,
      user: { id: 1 },
      currency: { code: 'USD' },
      version: 1
    } as any,
    {
      id: 2,
      name: 'Checking',
      type: { code: 'CHECKING' },
      currentBalance: 1000,
      bank: BankName.CAPITAL_ONE,
      user: { id: 1 },
      currency: { code: 'USD' },
      version: 1
    } as any,
    {
      id: 3,
      name: 'Savings',
      type: { code: 'SAVINGS' },
      currentBalance: 5000,
      bank: BankName.CAPITAL_ONE,
      user: { id: 1 },
      currency: { code: 'USD' },
      version: 1
    } as any,
    {
      id: 4,
      name: 'Cash',
      type: { code: 'CASH' },
      currentBalance: 200,
      bank: BankName.STANDARD,
      user: { id: 1 },
      currency: { code: 'USD' },
      version: 1
    } as any
  ];
`;

content = content.replace(/const mockAccounts: Account\[\] = \[[\s\S]*?\];/m, newMockAccounts.trim());
content = content.replace(/accountId: null,/g, 'accountId: 0 as any,'); // bypass type error

fs.writeFileSync(file, content);
