# Celia analysis template: investment-platform 1.0.0
#
# What it is: the fixed set of tests Celia runs on an investment platform (the Ponzi pattern), written as notebook cells. A run reads
# the platform's addresses and the window from the approved brief, reads the chain, and writes ONE findings file that Celia reads back.
# The contract for that file is `apps/web/src/validations/FindingsValidation.ts`; `get_analysis_contract` returns it as JSON schema.
#
# How to use it:
#   - In Sandworm: make each "# %%" section a Python cell, in this order. Replace the PARAMETERS section with input cells that define
#     the same variable names (CASE_NUMBER, RUN, CHAIN, ADDRESSES, WINDOW_FROM, WINDOW_TO). Only the parameter cells ever change.
#   - Locally, as a reference:  python3 investment_platform.py params.json ./out
#     where params.json holds those names, for example docs/integrators/template/params.forsage-smartway.json
#
# What each test answers (the verdict is a plain rule from the numbers, fixed here and never decided afterwards):
#   inflow-outflow      "Does the contract hold the funds it receives?"        proven >= 50% kept, partly >= 10%, else not proven
#   withdrawals-by-day  "Were payouts made whenever payments came in?"        proven if every period with payments in had payouts
#   concentration       "Do payouts depend on a few wallets?"                  proven if the top 5 got < 50%, partly < 80%, else not proven
#   payout-source       not built in this version                              not checkable
# A statement whose claim is the OPPOSITE of what a test asks (for example "the balance is always zero") is entered as "something
# else" in Celia and is not checked by this version.
#
# Limits of version 1.0.0: native coin only (ETH on Ethereum); token transfers are not read. Each run reads at most MAX_PAGES pages
# per address and kind; if the window is bigger, the run says so and every verdict becomes "not checkable" rather than guessing.
# Wallet addresses of the people who paid in or were paid out never go into the findings: only counts and shares.

# %% PARAMETERS (input cells in Sandworm; the defaults here are only for a local run)
import collections
import datetime
import json
import os
import sys
import time
import urllib.parse
import urllib.request
from decimal import Decimal

TEMPLATE_ID = 'investment-platform'
TEMPLATE_VERSION = '1.0.0'

PARAMETERS = {
    'CASE_NUMBER': 'cb-0000',  # lower case, as in the brief
    'RUN': 1,
    'CHAIN': 'ethereum',
    'ADDRESSES': '',  # the platform's addresses, separated by commas
    'WINDOW_FROM': '2020-01-01',  # a day, UTC
    'WINDOW_TO': '2020-01-31',  # a day, UTC, included
    'SOURCE': 'blockscout',  # or 'etherscan' (needs ETHERSCAN_API_KEY)
    'ETHERSCAN_API_KEY': '',
    'NOTEBOOK_URL': '',
    'MAX_PAGES': 50,
    'PAGE_SIZE': 1000,
}

# Arguments only exist when this is run as a script. In a notebook, sys.argv holds the kernel's own files, so it must be left alone.
AS_SCRIPT = sys.argv[0].endswith('investment_platform.py')
if AS_SCRIPT and len(sys.argv) > 1 and sys.argv[1].endswith('.json'):
    with open(sys.argv[1], encoding='utf-8') as handle:
        PARAMETERS.update(json.load(handle))

# Variables defined by the notebook's input cells win over the defaults.
for _name in list(PARAMETERS):
    if _name in globals():
        PARAMETERS[_name] = globals()[_name]

OUT_DIR = sys.argv[2] if AS_SCRIPT and len(sys.argv) > 2 else f"./data/{PARAMETERS['CASE_NUMBER']}/run-{PARAMETERS['RUN']}"
ADDRESSES = [a.strip().lower() for a in str(PARAMETERS['ADDRESSES']).split(',') if a.strip()]
if not ADDRESSES:
    raise SystemExit('No addresses: set ADDRESSES to the platform addresses in the approved brief.')

# %% DATA SOURCE
BLOCKSCOUT = {
    'ethereum': 'https://eth.blockscout.com/api',
    'base': 'https://base.blockscout.com/api',
    'arbitrum': 'https://arbitrum.blockscout.com/api',
    'optimism': 'https://optimism.blockscout.com/api',
}
ETHERSCAN_CHAIN_IDS = {'ethereum': 1, 'base': 8453, 'arbitrum': 42161, 'optimism': 10, 'avalanche': 43114}


def endpoint():
    chain = PARAMETERS['CHAIN']
    if PARAMETERS['SOURCE'] == 'etherscan':
        return 'https://api.etherscan.io/v2/api', {'chainid': ETHERSCAN_CHAIN_IDS[chain], 'apikey': PARAMETERS['ETHERSCAN_API_KEY']}
    return BLOCKSCOUT[chain], {}


def call(**params):
    base, fixed = endpoint()
    url = base + '?' + urllib.parse.urlencode({**fixed, **params})
    for attempt in range(6):
        try:
            request = urllib.request.Request(url, headers={'User-Agent': 'celia-analysis/1.0'})
            with urllib.request.urlopen(request, timeout=45) as response:
                body = json.load(response)
            message = str(body.get('message', ''))
            # Etherscan-style APIs answer a rate limit with a message, not an HTTP error.
            if 'rate limit' in message.lower() or 'max calls' in str(body.get('result', '')).lower():
                raise RuntimeError('rate limited')
            time.sleep(0.35)
            return body
        except Exception:
            time.sleep(1.5 * (attempt + 1))
    raise SystemExit('The data source did not answer: ' + base)


def block_at(timestamp, closest):
    body = call(module='block', action='getblocknobytime', timestamp=timestamp, closest=closest)
    result = body.get('result')
    return int(result['blockNumber'] if isinstance(result, dict) else result)


def day_start(day):
    return int(datetime.datetime.strptime(day, '%Y-%m-%d').replace(tzinfo=datetime.timezone.utc).timestamp())


START_TS = day_start(PARAMETERS['WINDOW_FROM'])
END_TS = day_start(PARAMETERS['WINDOW_TO']) + 86400 - 1
START_BLOCK = block_at(START_TS, 'after')
END_BLOCK = block_at(END_TS, 'before')


def read_all(action, address):
    """Reads every record of one kind for one address in the window, oldest first. Stops at MAX_PAGES and says so."""
    rows, seen, truncated = [], set(), False
    start = START_BLOCK
    for _ in range(int(PARAMETERS['MAX_PAGES'])):
        body = call(module='account', action=action, address=address, startblock=start, endblock=END_BLOCK,
                    page=1, offset=int(PARAMETERS['PAGE_SIZE']), sort='asc')
        page = body.get('result')
        if not isinstance(page, list) or not page:
            return rows, False
        for row in page:
            key = (row.get('hash') or row.get('transactionHash'), row.get('index') or row.get('traceId') or '', row.get('blockNumber'))
            if key not in seen:
                seen.add(key)
                rows.append(row)
        if len(page) < int(PARAMETERS['PAGE_SIZE']):
            return rows, False
        # A full page: continue from the last block read. Records of that block already seen are skipped by `seen`.
        next_start = int(page[-1]['blockNumber'])
        if next_start == start:
            next_start += 1
        start = next_start
    return rows, True


# %% READ THE CHAIN
inflows, payouts, truncated = [], [], False
own = set(ADDRESSES)
for address in ADDRESSES:
    transactions, cut_a = read_all('txlist', address)
    internal, cut_b = read_all('txlistinternal', address)
    truncated = truncated or cut_a or cut_b
    for row in transactions:
        if (row['to'] or '').lower() == address and row.get('isError', '0') == '0' and int(row['value']) > 0 \
                and row['from'].lower() not in own and START_TS <= int(row['timeStamp']) <= END_TS:
            inflows.append(row)
    for row in internal:
        if row['from'].lower() == address and row.get('isError', '0') == '0' and int(row['value']) > 0 \
                and (row['to'] or '').lower() not in own and START_TS <= int(row['timeStamp']) <= END_TS:
            payouts.append(row)

WEI = Decimal(10) ** 18


def eth(wei):
    value = (Decimal(wei) / WEI).quantize(Decimal('0.0001'))
    return f'{value.normalize():f}' if value else '0'


def pct(part, whole):
    return f'{(Decimal(part) * 100 / Decimal(whole)).quantize(Decimal("0.1"))}%' if whole else '0%'


def stamp(row):
    return datetime.datetime.fromtimestamp(int(row['timeStamp']), datetime.timezone.utc)


paid_in = sum(int(r['value']) for r in inflows)
paid_out = sum(int(r['value']) for r in payouts)
payers = collections.Counter()
recipients = collections.Counter()
for r in inflows:
    payers[r['from'].lower()] += int(r['value'])
for r in payouts:
    recipients[r['to'].lower()] += int(r['value'])

# %% TEST 1: inflow-outflow
def test_inflow_outflow():
    kept = max(paid_in - paid_out, 0)
    ratio = Decimal(kept) / Decimal(paid_in) if paid_in else Decimal(0)
    if truncated or paid_in == 0:
        verdict = 'not_checkable'
    elif ratio >= Decimal('0.5'):
        verdict = 'proven'
    elif ratio >= Decimal('0.1'):
        verdict = 'partly_proven'
    else:
        verdict = 'not_proven'
    firsts = [stamp(r) for r in inflows]
    rows = [
        ['Wallets that paid in', str(len(payers))],
        ['Payments in', str(len(inflows))],
        ['Paid in (ETH)', eth(paid_in)],
        ['Wallets paid out to', str(len(recipients))],
        ['Payouts', str(len(payouts))],
        ['Paid out (ETH)', eth(paid_out)],
        ['Share kept by the contract', pct(kept, paid_in)],
        ['First payment in', min(firsts).strftime('%Y-%m-%d') if firsts else 'none'],
        ['Last payment in', max(firsts).strftime('%Y-%m-%d') if firsts else 'none'],
    ]
    summary = (f'{len(inflows)} payments from {len(payers)} wallets brought in {eth(paid_in)} ETH. {len(payouts)} payouts to '
               f'{len(recipients)} wallets sent out {eth(paid_out)} ETH, so the contract kept {pct(kept, paid_in)} of what it received.')
    return {'id': 'inflow-outflow', 'title': 'Money in and out', 'summary': summary, 'verdict': verdict,
            'columns': ['Measure', 'Value'], 'rows': rows}


# %% TEST 2: withdrawals-by-day
def bucket(row):
    day = stamp(row).date()
    span = (datetime.date.fromtimestamp(END_TS) - datetime.date.fromtimestamp(START_TS)).days + 1
    if span <= 50:
        return day.isoformat(), 'Day', 'days'
    if span <= 350:
        monday = day - datetime.timedelta(days=day.weekday())
        return monday.isoformat(), 'Week starting', 'weeks'
    return day.strftime('%Y-%m'), 'Month', 'months'


def test_withdrawals_by_day():
    counts = collections.defaultdict(lambda: [0, 0])
    label, unit = 'Day', 'days'
    for r in inflows:
        key, label, unit = bucket(r)
        counts[key][0] += 1
    for r in payouts:
        key, label, unit = bucket(r)
        counts[key][1] += 1
    with_payments = [k for k, v in counts.items() if v[0] > 0]
    covered = [k for k in with_payments if counts[k][1] > 0]
    if truncated or not with_payments:
        verdict = 'not_checkable'
    elif len(covered) == len(with_payments):
        verdict = 'proven'
    elif covered:
        verdict = 'partly_proven'
    else:
        verdict = 'not_proven'
    rows = [[k, str(counts[k][0]), str(counts[k][1])] for k in sorted(counts)][:50]
    summary = f'Payouts were made in {len(covered)} of the {len(with_payments)} {unit} that had payments in.'
    return {'id': 'withdrawals-by-day', 'title': 'Withdrawals by day', 'summary': summary, 'verdict': verdict,
            'columns': [label, 'Payments in', 'Payouts'], 'rows': rows or [['none', '0', '0']]}


# %% TEST 3: concentration
def share_of_top(counter, total, n):
    return sum(v for _, v in counter.most_common(n)), total


def test_concentration():
    top1_out, _ = share_of_top(recipients, paid_out, 1)
    top5_out, _ = share_of_top(recipients, paid_out, 5)
    top1_in, _ = share_of_top(payers, paid_in, 1)
    top5_in, _ = share_of_top(payers, paid_in, 5)
    if truncated or not paid_out:
        verdict = 'not_checkable'
    else:
        ratio = Decimal(top5_out) / Decimal(paid_out)
        verdict = 'proven' if ratio < Decimal('0.5') else 'partly_proven' if ratio < Decimal('0.8') else 'not_proven'
    rows = [
        ['Largest recipient, share of payouts', pct(top1_out, paid_out)],
        ['Five largest recipients, share of payouts', pct(top5_out, paid_out)],
        ['Largest payer, share of payments in', pct(top1_in, paid_in)],
        ['Five largest payers, share of payments in', pct(top5_in, paid_in)],
    ]
    summary = (f'The five largest recipients received {pct(top5_out, paid_out)} of payouts, and the five largest payers supplied '
               f'{pct(top5_in, paid_in)} of payments in.')
    return {'id': 'concentration', 'title': 'Who the money depends on', 'summary': summary, 'verdict': verdict,
            'columns': ['Measure', 'Share'], 'rows': rows}


# %% TEST 4: payout-source (not built in this version)
def test_payout_source():
    return {'id': 'payout-source', 'title': 'Where payouts came from',
            'summary': 'This version does not test where payouts came from, so it makes no finding on it.',
            'verdict': 'not_checkable', 'columns': ['Measure', 'Value'], 'rows': [['Status', 'Not built in this version']]}


# %% WRITE THE FINDINGS FILE
if truncated:
    print(f'WARNING: the window holds more than MAX_PAGES x PAGE_SIZE records, so every verdict is not checkable.')

findings = {
    'celia': 1,
    'run': {
        'templateId': TEMPLATE_ID,
        'templateVersion': TEMPLATE_VERSION,
        'dataAsOf': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
    },
    'tests': [test_inflow_outflow(), test_withdrawals_by_day(), test_concentration(), test_payout_source()],
}
if PARAMETERS['NOTEBOOK_URL']:
    findings['run']['notebookUrl'] = PARAMETERS['NOTEBOOK_URL']

os.makedirs(OUT_DIR, exist_ok=True)
path = os.path.join(OUT_DIR, 'findings.json')
with open(path, 'w', encoding='utf-8') as handle:
    json.dump(findings, handle, indent=2)

print('window', PARAMETERS['WINDOW_FROM'], 'to', PARAMETERS['WINDOW_TO'], '| blocks', START_BLOCK, 'to', END_BLOCK, '| truncated', truncated)
print('wrote', path)
for t in findings['tests']:
    print(f"  {t['id']:20} {t['verdict']:14} {t['summary']}")
