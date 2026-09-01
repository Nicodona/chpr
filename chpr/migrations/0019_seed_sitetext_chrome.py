from django.db import migrations

# Second batch of editable copy: global chrome (nav, footer, FAQ button) and
# the home section headings. Each frontend usage also carries the same string
# as a hardcoded fallback, so a missing/blank row never breaks the page.
SEED = [
    # key, value, label, group, order
    # ── Navigation ──
    ("nav.brand_name", "CHPR Resources", "Nav: brand name", "Navigation", 10),
    ("nav.brand_tagline", "Knowledge Hub", "Nav: brand tagline", "Navigation", 20),
    ("nav.all_resources", "All Resources", "Nav: All Resources link", "Navigation", 30),
    ("nav.projects", "Projects", "Nav: Projects menu label", "Navigation", 40),
    ("nav.search_placeholder", "Search resources…", "Nav: search box placeholder", "Navigation", 50),
    ("nav.contact", "Contact", "Nav: Contact button (guests)", "Navigation", 60),
    ("nav.sign_in", "Sign in", "Nav: Sign in button", "Navigation", 70),
    # ── Home sections ──
    ("home.projects_eyebrow", "Active programmes", "Home: projects section eyebrow", "Home", 30),
    ("home.projects_title", "Projects", "Home: projects section title", "Home", 40),
    ("home.latest_eyebrow", "Latest", "Home: latest section eyebrow", "Home", 50),
    ("home.latest_title", "Recently added resources", "Home: latest section title", "Home", 60),
    ("home.see_all", "See all →", "Home: 'See all' link (latest)", "Home", 70),
    # ── Footer ──
    ("footer.org_name", "CHPR Resources Hub", "Footer: organisation name", "Footer", 10),
    (
        "footer.org_line",
        "Centre for Health Promotion and Research, Bamenda, Cameroon",
        "Footer: organisation line",
        "Footer",
        20,
    ),
    ("footer.copyright", "CHPR. All rights reserved.", "Footer: copyright (shown after the year)", "Footer", 30),
    # ── FAQ ──
    ("faq.button_label", "FAQ", "FAQ: floating button label", "General", 10),
]


def seed(apps, schema_editor):
    SiteText = apps.get_model("chpr", "SiteText")
    for key, value, label, group, order in SEED:
        SiteText.objects.get_or_create(
            key=key,
            defaults={"value": value, "label": label, "group": group, "order": order},
        )


def unseed(apps, schema_editor):
    SiteText = apps.get_model("chpr", "SiteText")
    SiteText.objects.filter(key__in=[row[0] for row in SEED]).delete()


class Migration(migrations.Migration):

    dependencies = [("chpr", "0018_seed_sitetext")]

    operations = [migrations.RunPython(seed, unseed)]
