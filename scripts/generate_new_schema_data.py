"""
generate_new_schema_data.py

Rebuilds public/ai_usage_data.csv under the new 30-column monthly schema
(Cost USD added alongside Credits/Cost (in $), per real-data clarification),
reusing the existing 442-user roster's identity fields (email, name, country,
CT/Non-CT, engagement code) from the CURRENT ai_usage_data.csv, while
regenerating the org-hierarchy dimension values and Product names to match
the real source system's actual vocabulary, and restructuring activity into
the Usage/License row-pair-per-month shape. Year is written as a fiscal-year
label ("FY26") and Month as a full D/M/YYYY date-time ("1/6/2026 12:00:00
AM"), matching the real source's actual column formats.

Usage:
    python scripts/generate_new_schema_data.py
"""
import csv
import random
from collections import defaultdict

random.seed(42)

SRC = 'public/ai_usage_data.csv'
OUT = 'public/ai_usage_data.csv'  # overwrite in place (old file backed up by caller)

MONTHS = [3, 4, 5, 6, 7, 8]  # March - August 2026
YEAR = 2026

# Per-tool economics: flat monthly license fee ($), $-per-unit gross usage
# rate, and a fixed monthly free-dollar limit (0 = no free tier). Confirmed
# against real data: Credits is dollar-denominated and, each month, equals
# -min(Cost USD, free_limit) — i.e. it fully covers gross cost while under
# the cap, then pins at the cap once gross cost exceeds it, leaving
# Cost (in $) = max(0, Cost USD - free_limit) as the actual overage billed.
TOOL_CONFIG = {
    'Github':  {'license': 35.00, 'rate': 0.00101, 'free_limit': 2.50},
    'ChatGPT': {'license': 25.00, 'rate': 0.00153, 'free_limit': 3.00},
    'Claude':  {'license': 40.00, 'rate': 0.00150, 'free_limit': 0.00},
    'Replit':  {'license': 50.00, 'rate': 0.00120, 'free_limit': 0.00},
    'Factory': {'license': 10.00, 'rate': 0.00090, 'free_limit': 0.00},
    'Cursor':  {'license': 60.00, 'rate': 0.00110, 'free_limit': 2.00},
}

GDS_LOCATIONS = ['India', 'Hungary', 'Argentina', 'Mexico', 'Poland', 'Philippines', 'Spain', 'Sri Lanka', 'UK']
SUPER_REGIONS = ['GDS', 'Europe', 'Canada', 'UK', 'USLI']
SERVICE_LINES = ['CBS', 'Assurance', 'Consulting', 'ES', 'Parthenon', 'Tax']
SUB_SERVICE_LINE_1 = ['Audit', 'AWS', 'Business Consulting', 'Risk Consulting', 'Technology Consulting']
SUB_SERVICE_LINE_2 = ['Allocations', 'AWS', 'Brand', 'CNS', 'Client Experience', 'Digital', 'Customer', 'Finance']
ENGAGEMENT_SUPER_REGIONS = ['Canada', 'Global', 'Europe West', 'Asia East', 'Africa India', 'MENA', 'UK', 'USLI']
ENGAGEMENT_SERVICE_LINES = ['Assurance', 'Consulting', 'SaT', 'Tax', 'CBS']
ENGAGEMENT_SUB_SERVICE_LINES = ['Audit', 'CBS', 'Business Consulting', 'Core Tax', 'People Consulting']
ENGAGEMENT_COMPETENCIES = ['Risk Management', 'Operations', 'People Advisory', 'Technology', 'Client Advisory']

PRODUCT_FAMILIES = ['Digital Core', 'Client Experience', 'Risk & Trust', 'Data Platform']
PRODUCTS_BY_FAMILY = {
    'Digital Core': ['Core Ledger', 'Workflow Hub'],
    'Client Experience': ['Advisory Portal', 'Engagement Suite'],
    'Risk & Trust': ['Controls Monitor', 'Assurance Toolkit'],
    'Data Platform': ['Insights Warehouse', 'Analytics Studio'],
}
ENTITIES = ['EY Global LLP', 'EY Americas LLP', 'EY EMEIA Ltd', 'EY Asia-Pacific Pte Ltd']
INVEST_TYPES = ['Sustain', 'Growth', 'Innovation', 'Efficiency']
SL_SF_CODES = ['SLSF-01', 'SLSF-02', 'SLSF-03', 'SLSF-04']
RS_CODES = ['RS-A', 'RS-B', 'RS-C']
GDS_FLAGS = ['Y', 'N']


def load_user_profiles():
    with open(SRC, encoding='utf-8') as f:
        rows = list(csv.DictReader(f))

    profiles = {}
    tool_usage = defaultdict(lambda: defaultdict(lambda: {'tokens': 0.0}))
    for r in rows:
        email = r['User Email']
        if email not in profiles:
            profiles[email] = {
                'name': r['User Name'],
                'ctNonCt': r['CT/Non-CT'],
                'country': r['Country'],
                'projectCode': r['Engagement Code'],
                'costCenter': r['Cost Center'],
            }
        tools_held_old = r['Product']
        tool_usage[email][tools_held_old]['tokens'] += float(r['GenAI Tool Consumption'] or 0)

    return profiles, tool_usage


def pick_hierarchy_fields(rng):
    """Fresh per-user draw from the real source system's dimension vocabulary
    (independent random picks — this is placeholder filler, not a modeled
    interdependent hierarchy)."""
    family = rng.choice(PRODUCT_FAMILIES)
    return {
        'superRegion': rng.choice(SUPER_REGIONS),
        'orgServiceLine': rng.choice(SERVICE_LINES),
        'subServiceLine1': rng.choice(SUB_SERVICE_LINE_1),
        'subServiceLine2': rng.choice(SUB_SERVICE_LINE_2),
        'engagementSuperRegion': rng.choice(ENGAGEMENT_SUPER_REGIONS),
        'engagementServiceLine': rng.choice(ENGAGEMENT_SERVICE_LINES),
        'engagementSubServiceLine': rng.choice(ENGAGEMENT_SUB_SERVICE_LINES),
        'engagementCompetency': rng.choice(ENGAGEMENT_COMPETENCIES),
        'portfolioCtProductFamily': family,
        'portfolioCtProduct': rng.choice(PRODUCTS_BY_FAMILY[family]),
        'entity': rng.choice(ENTITIES),
        'slSf': rng.choice(SL_SF_CODES),
        'rs': rng.choice(RS_CODES),
        'gds': rng.choice(GDS_FLAGS),
        'engagementInvestType': rng.choice(INVEST_TYPES),
    }


def main():
    profiles, tool_usage = load_user_profiles()
    rng = random.Random(42)
    tool_names = list(TOOL_CONFIG.keys())

    header = [
        'User Email', 'User Name', 'Year', 'Month', 'Product', 'Calculation Method',
        'GenAI Tool Consumption', 'Credits', 'Cost USD', 'Cost (in $)',
        'CT/Non-CT', 'Country', 'Super Region', 'Service Line',
        'Sub-Service Line 1', 'Sub-Service Line 2', 'Engagement Code',
        'Engagement - Super Region', 'Engagement Service Line', 'Engagement Sub-Service Line',
        'Engagement Competency', 'Engagement Invest Type', 'GDS Location', 'Cost Center',
        'Portfolio - CT Product Family', 'Portfolio - CT Product', 'Entity', 'SL/SF', 'RS', 'GDS',
    ]

    out_rows = [header]
    active_user_count = 0
    dormant_user_count = 0

    for email, profile in profiles.items():
        hierarchy = pick_hierarchy_fields(rng)

        old_tools_used = {t: v for t, v in tool_usage[email].items() if v['tokens'] > 0}
        if not old_tools_used:
            tools_held = [rng.choice(tool_names)]
            dormant_user_count += 1
        else:
            # Re-key however many distinct tools the user historically used onto
            # the new Product name set (count preserved, identity re-rolled).
            tools_held = rng.sample(tool_names, min(len(old_tools_used), len(tool_names)))
            active_user_count += 1

        historical_totals = list(old_tools_used.values())

        for i, tool in enumerate(tools_held):
            cfg = TOOL_CONFIG[tool]
            hist = historical_totals[i] if i < len(historical_totals) else None
            if hist and hist['tokens'] > 0:
                active_month_count = rng.randint(2, len(MONTHS))
                active_months = set(rng.sample(MONTHS, active_month_count))
                total_consumption = hist['tokens']  # source file's consumption is already in the target unit
            else:
                active_months = set()
                total_consumption = 0

            sorted_active_months = sorted(active_months)
            weights = [rng.uniform(0.6, 1.4) for _ in sorted_active_months]
            weight_sum = sum(weights) or 1.0
            consumption_by_month = {
                m: round(total_consumption * (w / weight_sum), 2)
                for m, w in zip(sorted_active_months, weights)
            }

            for month in MONTHS:
                gds_location = rng.choice(GDS_LOCATIONS)
                base_row = {
                    'User Email': email,
                    'User Name': profile['name'],
                    # Year is a fiscal-year label (e.g. "FY26"), not the plain
                    # calendar year — confirmed against real data. Month is a
                    # full date-time in D/M/YYYY order (e.g. "1/6/2026 12:00:00
                    # AM" = June 2026); the time-of-day is always midnight and
                    # the calendar year/month used everywhere downstream is
                    # parsed from this field, not from Year.
                    'Year': f'FY{str(YEAR)[-2:]}',
                    'Month': f'1/{month}/{YEAR} 12:00:00 AM',
                    'Product': tool,
                    'CT/Non-CT': profile['ctNonCt'],
                    'Country': profile['country'],
                    'Super Region': hierarchy['superRegion'],
                    'Service Line': hierarchy['orgServiceLine'],
                    'Sub-Service Line 1': hierarchy['subServiceLine1'],
                    'Sub-Service Line 2': hierarchy['subServiceLine2'],
                    'Engagement Code': profile['projectCode'],
                    'Engagement - Super Region': hierarchy['engagementSuperRegion'],
                    'Engagement Service Line': hierarchy['engagementServiceLine'],
                    'Engagement Sub-Service Line': hierarchy['engagementSubServiceLine'],
                    'Engagement Competency': hierarchy['engagementCompetency'],
                    'Engagement Invest Type': hierarchy['engagementInvestType'],
                    'GDS Location': gds_location,
                    'Cost Center': profile['costCenter'],
                    'Portfolio - CT Product Family': hierarchy['portfolioCtProductFamily'],
                    'Portfolio - CT Product': hierarchy['portfolioCtProduct'],
                    'Entity': hierarchy['entity'],
                    'SL/SF': hierarchy['slSf'],
                    'RS': hierarchy['rs'],
                    'GDS': hierarchy['gds'],
                }

                # License row: always present every month a seat is held. No
                # usage occurred, so no free-tier credit adjustment applies —
                # Credits is 0 and Cost (in $) is just the flat license fee.
                license_row = dict(base_row)
                license_row['Calculation Method'] = 'License'
                license_row['GenAI Tool Consumption'] = 0
                license_row['Credits'] = 0
                license_row['Cost USD'] = round(cfg['license'], 2)
                license_row['Cost (in $)'] = round(cfg['license'], 2)
                out_rows.append([license_row[h] for h in header])

                # Usage row: only present for months this user was actually
                # active. Cost USD is the gross metered cost; Credits fully
                # covers it while under the tool's free_limit (Credits =
                # -Cost USD, net cost 0), then pins at -free_limit once gross
                # cost exceeds it, leaving Cost (in $) = Cost USD - free_limit
                # as the overage. ~10% of eligible rows get a null Credits to
                # simulate real missing-data gaps.
                if month in active_months:
                    consumption = consumption_by_month[month]
                    cost_usd = round(consumption * cfg['rate'], 6)
                    free_limit = cfg['free_limit']

                    if free_limit <= 0:
                        credits = None if rng.random() < 0.5 else 0.0
                    elif rng.random() < 0.10:
                        credits = None
                    else:
                        credits = round(-min(cost_usd, free_limit), 6)

                    applied_credit = -credits if isinstance(credits, float) and credits < 0 else 0.0
                    net_cost = round(max(0.0, cost_usd - applied_credit), 6)

                    usage_row = dict(base_row)
                    usage_row['Calculation Method'] = 'Usage'
                    usage_row['GenAI Tool Consumption'] = consumption
                    usage_row['Credits'] = '' if credits is None else credits
                    usage_row['Cost USD'] = cost_usd
                    usage_row['Cost (in $)'] = net_cost
                    out_rows.append([usage_row[h] for h in header])

    with open(OUT, 'w', encoding='utf-8', newline='') as f:
        writer = csv.writer(f)
        writer.writerows(out_rows)

    print(f'Users: {len(profiles)} total, {active_user_count} with historical usage, {dormant_user_count} fully dormant')
    print(f'Rows written: {len(out_rows) - 1} (+ header)')


if __name__ == '__main__':
    main()
