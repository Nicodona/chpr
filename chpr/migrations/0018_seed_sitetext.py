from django.db import migrations

# key, value, label, group, order  — the initial editable strings.
# `value` seeds the current wording; the frontend also carries the same string
# as a hardcoded fallback, so a missing row never leaves the page blank.
SEED = [
    ("home.hero_title", "", "Home: hero title", "Home", 10),
    (
        "home.search_placeholder",
        "Search resources, protocols, materials…",
        "Home: search box placeholder",
        "Home",
        20,
    ),
]


def seed(apps, schema_editor):
    SiteText = apps.get_model("chpr", "SiteText")
    for key, value, label, group, order in SEED:
        # get_or_create so a re-run never clobbers an admin's edited value.
        SiteText.objects.get_or_create(
            key=key,
            defaults={"value": value, "label": label, "group": group, "order": order},
        )


def unseed(apps, schema_editor):
    SiteText = apps.get_model("chpr", "SiteText")
    SiteText.objects.filter(key__in=[row[0] for row in SEED]).delete()


class Migration(migrations.Migration):

    dependencies = [("chpr", "0017_sitetext")]

    operations = [migrations.RunPython(seed, unseed)]
