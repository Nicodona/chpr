"""Generate (or regenerate) document-grounded quizzes for resources.

Usage:
    python manage.py generate_quizzes            # only resources with no quiz
    python manage.py generate_quizzes --force    # replace auto-generated questions
"""
from django.core.management.base import BaseCommand

from chpr import quiz_gen
from chpr.models import Resource


class Command(BaseCommand):
    help = "Auto-generate quiz questions from each resource's converted document."

    def add_arguments(self, parser):
        parser.add_argument("--force", action="store_true",
                            help="Replace auto-generated questions (hand-written ones are kept).")

    def handle(self, *args, **options):
        force = options["force"]
        made_total = skipped = 0
        for resource in Resource.objects.all():
            if not force and resource.quiz_questions.exists():
                skipped += 1
                continue
            made = quiz_gen.generate_for_resource(resource, replace_auto=force)
            if made:
                made_total += made
                self.stdout.write(f"  {resource.name}: {made} question(s)")
            else:
                skipped += 1
        self.stdout.write(self.style.SUCCESS(
            f"Done — {made_total} question(s) generated, {skipped} resource(s) skipped "
            "(no document or quiz already present)."
        ))
