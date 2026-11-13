#!/usr/bin/env python3
"""Creates the two accounts used for design review (impeccable runs), through the real API.

  <prefix>_empty  a registered user with nothing in it: every first-use empty state
  <prefix>_full   made-up data covering the states a real account may not show: budgets under,
                  near and over their limit, tracked recurring items (one with a price change, one
                  paused), tags, possible transfers, a hand-entered account with balance history,
                  uncategorized rows and activity in the current month

Everything is invented; no real bank data is read. Usernames and a generated password are kept in
e2e/.auth/design-accounts.json (gitignored) and are never printed. Re-running is safe: a user that
already has accounts is left alone.

    python3 e2e/seed-design-accounts.py            # create whatever is missing
    python3 e2e/seed-design-accounts.py --status   # counts only, no writes

The backend it talks to is E2E_API_URL (default http://localhost:8080/api/v1). Users created here
are not removed by the e2e cleanup; delete them from the `users` table by hand when done.
"""
import base64
import datetime as dt
import json
import os
import random
import secrets
import sys
import urllib.error
import urllib.request

API = os.environ.get('E2E_API_URL', 'http://localhost:8080/api/v1')
AUTH_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.auth', 'design-accounts.json')
PREFIX = 'pf_design'
TODAY = dt.date.today()
rng = random.Random(20261113)


class ApiError(Exception):
    pass


def call(method, path, token=None, body=None, ok_statuses=()):
    data = json.dumps(body).encode() if body is not None else None
    request = urllib.request.Request(API + path, data=data, method=method)
    request.add_header('Content-Type', 'application/json')
    if token:
        request.add_header('Authorization', 'Bearer ' + token)
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            raw = response.read().decode()
    except urllib.error.HTTPError as error:
        if error.code in ok_statuses:
            return None
        raise ApiError(f'{method} {path} -> {error.code} {error.read().decode()[:300]}') from None
    return json.loads(raw) if raw else None


def new_id(result):
    return result if isinstance(result, int) else result['id']


def items(result):
    return result.get('content', result) if isinstance(result, dict) else result


def user_id(token):
    payload = token.split('.')[1]
    payload += '=' * (-len(payload) % 4)
    return json.loads(base64.urlsafe_b64decode(payload))['userId']


def load_credentials():
    if os.path.exists(AUTH_FILE):
        with open(AUTH_FILE) as handle:
            return json.load(handle)
    alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    password = ''.join(secrets.choice(alphabet) for _ in range(20)) + 'aA1!'
    suffix = secrets.token_hex(2)
    credentials = {
        'empty': {'username': f'{PREFIX}_empty_{suffix}', 'password': password},
        'full': {'username': f'{PREFIX}_full_{suffix}', 'password': password},
    }
    os.makedirs(os.path.dirname(AUTH_FILE), exist_ok=True)
    with open(AUTH_FILE, 'w') as handle:
        json.dump(credentials, handle, indent=2)
    os.chmod(AUTH_FILE, 0o600)
    return credentials


def sign_in(credential, register):
    body = {'username': credential['username'], 'password': credential['password']}
    try:
        return call('POST', '/auth/authenticate', body=body)['token']
    except ApiError:
        if not register:
            return None
    call('POST', '/auth/register', body={**body, 'email': credential['username'] + '@example.com'})
    return call('POST', '/auth/authenticate', body=body)['token']


def month_start(months_back):
    year, month = TODAY.year, TODAY.month - months_back
    while month < 1:
        year, month = year - 1, month + 12
    return dt.date(year, month, 1)


def stamp(day):
    return day.isoformat() + 'T12:00:00Z'


def seed_full(token):
    uid = user_id(token)

    def post(path, body):
        return new_id(call('POST', path, token, body))

    # accounts
    def account(name, type_code, starting, bank='STANDARD', mode=None):
        body = {'name': name, 'type': type_code, 'startingBalance': starting, 'currencyCode': 'USD', 'bankName': bank}
        if mode:
            body['balanceMode'] = mode
        return post('/accounts', body)

    checking = account('Everyday Checking', 'CHECKING', 2500)
    savings = account('Rainy Day Savings', 'SAVINGS', 8000)
    card = account('Rewards Card', 'CREDIT_CARD', 0)
    type_codes = {t['code'] for t in items(call('GET', '/account-types', token))}
    manual_type = 'INVESTMENT' if 'INVESTMENT' in type_codes else 'SAVINGS'
    brokerage = account('Index Fund (hand-entered)', manual_type, 12000, mode='MANUAL')

    # categories: parents with children
    tree = {
        'Housing': ('EXPENSE', ['Rent', 'Electric']),
        'Food': ('EXPENSE', ['Groceries', 'Restaurants']),
        'Transportation': ('EXPENSE', ['Gas']),
        'Subscriptions': ('EXPENSE', ['Streaming', 'Gym']),
        'Shopping': ('EXPENSE', ['General', 'Hobbies']),
        'Income': ('INCOME', ['Salary']),
    }
    category = {}
    for parent, (kind, children) in tree.items():
        parent_id = post('/categories', {'userId': uid, 'name': parent, 'type': kind})
        for child in children:
            category[child] = post('/categories', {'userId': uid, 'name': child, 'type': kind, 'parentId': parent_id})

    merchant = {name: post('/merchants', {'userId': uid, 'name': name}) for name in [
        'Maple Street Rentals', 'Fresh Market', 'Corner Bistro', 'Noodle House', 'Fuel Stop', 'Streamly',
        'Musicbox', 'Gymhouse', 'City Power', 'Megamart', 'Acme Payroll', 'Hostwise',
    ]}

    spent = {}  # (year, month, category name) -> total
    created = []

    def txn(day, account_id, amount, description, kind='EXPENSE', cat=None, shop=None):
        if day > TODAY:
            return None
        body = {'accountId': account_id, 'amount': amount, 'transactionDate': stamp(day),
                'description': description, 'type': kind}
        if cat:
            body['categoryId'] = category[cat]
        if shop:
            body['merchantId'] = merchant[shop]
        tid = post('/transactions', body)
        created.append(tid)
        if kind == 'EXPENSE' and cat:
            key = (day.year, day.month, cat)
            spent[key] = round(spent.get(key, 0) + amount, 2)
        return tid

    def on(first, day_number):
        return first + dt.timedelta(days=day_number - 1)

    months = 7
    for back in range(months - 1, -1, -1):
        first = month_start(back)
        recent = back <= 1
        txn(on(first, 1), checking, 3200, 'ACME PAYROLL DIRECT DEP', 'INCOME', 'Salary', 'Acme Payroll')
        txn(on(first, 15), checking, 3200, 'ACME PAYROLL DIRECT DEP', 'INCOME', 'Salary', 'Acme Payroll')
        txn(on(first, 1), checking, 1450, 'MAPLE STREET RENTALS ACH', cat='Rent', shop='Maple Street Rentals')
        txn(on(first, 9), checking, round(rng.uniform(70, 130), 2), 'CITY POWER AUTOPAY', cat='Electric', shop='City Power')
        txn(on(first, 5), card, 17.99 if recent else 15.99, 'STREAMLY SUBSCRIPTION', cat='Streaming', shop='Streamly')
        txn(on(first, 7), card, 10.99, 'MUSICBOX PREMIUM', cat='Streaming', shop='Musicbox')
        txn(on(first, 3), card, 35, 'GYMHOUSE MEMBERSHIP', cat='Gym', shop='Gymhouse')
        for day_number in (2, 8, 12, 19, 26):
            txn(on(first, day_number), card, round(rng.uniform(55, 120), 2), 'FRESH MARKET #204', cat='Groceries', shop='Fresh Market')
        for day_number in (4, 10, 17, 24):
            name = rng.choice([('CORNER BISTRO', 'Corner Bistro'), ('NOODLE HOUSE DOWNTOWN', 'Noodle House')])
            txn(on(first, day_number), card, round(rng.uniform(18, 62), 2), name[0], cat='Restaurants', shop=name[1])
        for day_number in (6, 11, 21):
            txn(on(first, day_number), card, round(rng.uniform(32, 54), 2), 'FUEL STOP 0457', cat='Gas', shop='Fuel Stop')
        for day_number in (9, 22):
            txn(on(first, day_number), card, round(rng.uniform(20, 160), 2), 'MEGAMART STORE 88',
                cat=rng.choice(['General', 'Hobbies']), shop='Megamart')
        if recent:
            # left without a category or merchant: the "Needs a category" tab and the review banner
            for day_number, text in ((3, 'SQ *PEACH TREE POTTERY'), (8, 'TST* THE GREEN DOOR'), (12, 'PAYPAL *RIVERSIDE CO')):
                txn(on(first, day_number), card, round(rng.uniform(12, 90), 2), text)
            # both sides of a move between own accounts, left unmarked: possible transfers
            txn(on(first, 2), checking, 300, 'TRANSFER TO SAVINGS')
            txn(on(first, 2), savings, 300, 'TRANSFER FROM CHECKING', 'INCOME')
            card_payment = 640 + back * 35
            txn(on(first, 10), checking, card_payment, 'REWARDS CARD PAYMENT')
            txn(on(first, 12), card, card_payment, 'PAYMENT THANK YOU', 'INCOME')
    txn(month_start(4) + dt.timedelta(days=13), card, 18, 'HOSTWISE DOMAIN RENEWAL', cat='General', shop='Hostwise')

    # budgets: this month under, near and over; last month has two more, and one that differs
    def month_spent(first, name):
        return spent.get((first.year, first.month, name), 0) or 50

    this_month, last_month = month_start(0), month_start(1)

    def budget(first, name, amount):
        post('/budgets', {'userId': uid, 'categoryId': category[name], 'amount': round(amount),
                          'month': first.month, 'year': first.year})

    budget(this_month, 'Rent', 1450)
    budget(this_month, 'Groceries', month_spent(this_month, 'Groceries') * 2.4)
    budget(this_month, 'Restaurants', month_spent(this_month, 'Restaurants') / 0.92)
    budget(this_month, 'Gas', month_spent(this_month, 'Gas') * 0.8)
    budget(this_month, 'Streaming', 30)
    budget(last_month, 'Rent', 1450)
    budget(last_month, 'Groceries', 500)
    budget(last_month, 'Restaurants', 220)
    budget(last_month, 'Gas', 120)
    budget(last_month, 'Streaming', 30)
    budget(last_month, 'General', 200)
    budget(last_month, 'Electric', 120)

    # tags, some attached
    tags = [post('/tags', {'userId': uid, 'name': name, 'color': color}) for name, color in [
        ('Vacation', '#0ea5e9'), ('Reimbursable', '#f59e0b'), ('Tax deductible', '#10b981'), ('Shared with roommate', '#8b5cf6'),
    ]]
    for index, tid in enumerate(rng.sample(created, 14)):
        call('POST', f'/tags/{tags[index % 3]}/transactions/{tid}', token)

    # tracked recurring items
    def recurring(shop, account_id, amount, frequency, next_date, active=True):
        post('/recurring', {'userId': uid, 'accountId': account_id, 'amount': amount, 'frequency': frequency,
                            'nextDate': next_date.isoformat(), 'active': active, 'merchantId': merchant[shop]})

    next_month = (this_month + dt.timedelta(days=32)).replace(day=1)
    recurring('Maple Street Rentals', checking, 1450, 'MONTHLY', next_month)
    recurring('Streamly', card, 15.99, 'MONTHLY', on(next_month, 5))  # charges are now 17.99: a price change
    recurring('Musicbox', card, 10.99, 'MONTHLY', on(next_month, 7))
    recurring('Gymhouse', card, 35, 'MONTHLY', on(next_month, 3), active=False)  # paused
    recurring('Hostwise', card, 18, 'YEARLY', month_start(4).replace(year=month_start(4).year + 1) + dt.timedelta(days=13))

    # rules
    post('/category-rules', {'userId': uid, 'categoryId': category['Groceries'], 'keywords': ['fresh market'],
                             'matchType': 'OR', 'priority': 0})
    post('/category-rules', {'userId': uid, 'categoryId': category['Streaming'], 'keywords': ['streamly', 'musicbox'],
                             'matchType': 'OR', 'priority': 1})
    post('/category-rules', {'userId': uid, 'categoryId': category['General'], 'keywords': ['megamart'],
                             'matchType': 'OR', 'priority': 2, 'minAmount': 100})
    post('/merchant-rules', {'merchantId': merchant['Fuel Stop'], 'keywords': ['fuel stop'], 'matchType': 'OR', 'priority': 0})
    post('/merchant-rules', {'merchantId': merchant['Fresh Market'], 'keywords': ['fresh market'], 'matchType': 'OR', 'priority': 1})

    # balance history for the hand-entered account
    balance = 12000
    for back in range(4, -1, -1):
        balance = round(balance * rng.uniform(0.99, 1.04), 2)
        version = next(a for a in items(call('GET', '/accounts', token)) if a['id'] == brokerage).get('version', 0)
        call('POST', '/accounts/balance', token,
             {'accountId': brokerage, 'balance': balance, 'asOfDate': month_start(back).isoformat(), 'version': version})

    return len(created)


def status(token):
    def count(path):
        try:
            result = call('GET', path, token)
        except ApiError as error:
            return f'? ({str(error)[:40]})'
        if isinstance(result, dict) and 'totalElements' in result:
            return result['totalElements']
        return len(items(result))

    paths = {'accounts': '/accounts', 'categories': '/categories', 'merchants': '/merchants', 'tags': '/tags',
             'recurring': '/recurring', 'category rules': '/category-rules', 'merchant rules': '/merchant-rules',
             'possible transfers': '/transactions/suggestions/transfers', 'patterns': '/recurring/suggestions'}
    return ', '.join(f'{name} {count(path)}' for name, path in paths.items())


def main():
    status_only = '--status' in sys.argv
    credentials = load_credentials()
    for kind in ('empty', 'full'):
        token = sign_in(credentials[kind], register=not status_only)
        if token is None:
            print(f'{kind}: not created yet')
            continue
        if kind == 'full' and not status_only:
            if items(call('GET', '/accounts', token)):
                print('full: already has accounts, left alone')
            else:
                print(f'full: seeded {seed_full(token)} transactions')
        print(f'{kind}: {status(token)}')


if __name__ == '__main__':
    main()
