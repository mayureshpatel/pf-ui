const fs = require('fs');

function rewriteJasmineToVitest(content) {
    let result = content;
    result = result.replace(/jasmine\.SpyObj<([^>]+)>/g, 'any');
    result = result.replace(/jasmine\.createSpyObj\([^,]+,\s*\[([^\]]+)\]\)/g, (match, methodsStr) => {
        const methods = methodsStr.split(',').map(s => s.trim().replace(/['"]/g, ''));
        const objStr = methods.map(m => `${m}: vi.fn()`).join(', ');
        return `{ ${objStr} }`;
    });
    result = result.replace(/spyOn\(([^,]+),\s*'([^']+)'\)/g, 'vi.spyOn($1, \'$2\')');
    result = result.replace(/\.toBeTrue\(\)/g, '.toBe(true)');
    result = result.replace(/\.toBeFalse\(\)/g, '.toBe(false)');
    result = result.replace(/jasmine\.objectContaining/g, 'expect.objectContaining');
    
    if (result.includes('vi.fn') || result.includes('vi.spyOn')) {
        if (!result.includes("import { vi } from 'vitest'")) {
            result = "import { vi } from 'vitest';\n" + result;
        }
    }
    return result;
}

const files = [
    'src/app/features/accounts/accounts.component.spec.ts',
    'src/app/features/accounts/components/account-form-drawer/account-form-drawer.component.spec.ts',
    'src/app/features/accounts/components/reconcile-dialog/reconcile-dialog.component.spec.ts'
];

files.forEach(f => {
    const content = fs.readFileSync(f, 'utf8');
    const updated = rewriteJasmineToVitest(content);
    fs.writeFileSync(f, updated);
});
