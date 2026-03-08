const fs = require('fs');
const files = [
    'src/app/features/accounts/accounts.component.spec.ts',
    'src/app/features/accounts/components/account-form-drawer/account-form-drawer.component.spec.ts',
    'src/app/features/accounts/components/reconcile-dialog/reconcile-dialog.component.spec.ts'
];

files.forEach(f => {
    let content = fs.readFileSync(f, 'utf8');
    content = content.replace(/\.and\.returnValue\(/g, '.mockReturnValue(');
    content = content.replace(/\.and\.callFake\(/g, '.mockImplementation(');
    fs.writeFileSync(f, content);
});
