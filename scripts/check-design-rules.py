#!/usr/bin/env python3
"""Checks the template rules the design system states but nothing else enforces (PF-942).

  1. Paired dark: a bare bg-/border-/text-surface-N class needs a dark: partner on the same element.
  2. Money and error color: emerald and rose text is 700 on light with a 400 dark partner, never 500/600.
  3. Radii: rounded-md (controls), rounded-lg (rows, nav), rounded-xl (cards, panels), rounded-full.
  4. Headings: an h1 uses `heading-page`; no heading is heavier than bold.
  5. Icons: one glyph per meaning (see DESIGN.md, Iconography).
  6. Figures: money and counts use `stat-figure`, `stat-figure-lg` or `row-amount`, not a loose
     weight plus `tabular-nums`.

Run from pf-ui:  python3 scripts/check-design-rules.py     (exit 1 when anything is found)
"""
import glob
import os
import re
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src', 'app')
CLASS_ATTR = re.compile(r'(?:class|\[class\]|\[ngClass\])="([^"]*)"', re.S)
TOKEN = re.compile(r"[\w:/\[\].\-]+")
SURFACE = re.compile(r'((?:[\w-]+:)*)(bg|border(?:-[btlrxy])?|text|divide|ring)-surface-\d+(?:/\d+)?')
BANNED_ICONS = {
    'pi-plus-circle': 'use pi-plus for an add action (a transaction-type glyph in a .ts file is fine)',
    'pi-exclamation-circle': 'use pi-exclamation-triangle for caution, pi-times-circle for an error',
}

findings = []


def report(path, text, offset, message):
    line = text.count('\n', 0, offset) + 1
    findings.append(f'{os.path.relpath(path, os.path.join(ROOT, "..", ".."))}:{line}: {message}')


for path in sorted(glob.glob(os.path.join(ROOT, '**', '*.html'), recursive=True)):
    with open(path) as handle:
        text = handle.read()

    for match in CLASS_ATTR.finditer(text):
        tokens = TOKEN.findall(match.group(1))
        for token in tokens:
            surface = SURFACE.fullmatch(token)
            if surface and 'dark:' not in surface.group(1):
                prop = re.escape(surface.group(2))
                if not any(re.fullmatch(r'(?:[\w-]+:)*dark:(?:[\w-]+:)*' + prop + r'-[\w/\-]+', other) for other in tokens):
                    report(path, text, match.start(), f'{token} has no dark: partner')
            if re.fullmatch(r'text-(emerald|rose)-(500|600)', token):
                report(path, text, match.start(), f'{token}: use the 700 shade with a dark: 400 partner')
            if re.fullmatch(r'(?:[\w-]+:)*rounded(-2xl|-3xl|-sm|-xs)?', token):
                report(path, text, match.start(), f'{token}: use rounded-md, rounded-lg, rounded-xl or rounded-full')

        if 'tabular-nums' in tokens and ('font-semibold' in tokens or 'font-bold' in tokens):
            report(path, text, match.start(), 'figure: use stat-figure, stat-figure-lg or row-amount')

    for match in re.finditer(r'<(h[1-6])\b[^>]*?class="([^"]*)"', text, re.S):
        tokens = match.group(2).split()
        if match.group(1) == 'h1' and 'heading-page' not in tokens:
            report(path, text, match.start(), 'an h1 uses heading-page')
        if 'font-black' in tokens or 'font-extrabold' in tokens:
            report(path, text, match.start(), f'{match.group(1)}: no heading is heavier than bold')

    for icon, advice in BANNED_ICONS.items():
        for match in re.finditer(re.escape(icon) + r'(?![\w-])', text):
            report(path, text, match.start(), f'{icon}: {advice}')

if findings:
    print('\n'.join(findings))
    print(f'\n{len(findings)} design rule finding(s).')
    sys.exit(1)
print('Design rules: no findings.')
