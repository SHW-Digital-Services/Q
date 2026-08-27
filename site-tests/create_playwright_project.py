from pathlib import Path

PROJECT_STRUCTURE = [
    "package.json",
    "package-lock.json",
    "playwright.config.ts",
    "tsconfig.json",
    ".gitignore",
    ".env",
    ".env.example",
    "README.md",

    "test-data/users.json",
    "test-data/subscriptions.json",
    "test-data/journals.json",
    "test-data/moods.json",
    "test-data/memory.json",

    "fixtures/auth.fixture.ts",
    "fixtures/admin.fixture.ts",
    "fixtures/subscription.fixture.ts",
    "fixtures/journal.fixture.ts",
    "fixtures/mood.fixture.ts",

    "helpers/auth.helper.ts",
    "helpers/supabase.helper.ts",
    "helpers/paypal.helper.ts",
    "helpers/api.helper.ts",
    "helpers/journal.helper.ts",
    "helpers/mood.helper.ts",
    "helpers/memory.helper.ts",
    "helpers/admin.helper.ts",
    "helpers/screenshot.helper.ts",
    "helpers/cleanup.helper.ts",

    "pages/LoginPage.ts",
    "pages/RegisterPage.ts",
    "pages/DashboardPage.ts",
    "pages/ChatPage.ts",
    "pages/MemoryPage.ts",
    "pages/JournalPage.ts",
    "pages/MoodTrackerPage.ts",
    "pages/SubscriptionPage.ts",
    "pages/PricingPage.ts",
    "pages/ProfilePage.ts",
    "pages/SettingsPage.ts",
    "pages/GuidesPage.ts",
    "pages/ExperiencesPage.ts",
    "pages/AdminPage.ts",
    "pages/UsersPage.ts",
    "pages/BillingPage.ts",
    "pages/SecurityPage.ts",

    "tests/smoke/home.spec.ts",
    "tests/smoke/login.spec.ts",
    "tests/smoke/register.spec.ts",
    "tests/smoke/dashboard.spec.ts",
    "tests/smoke/navigation.spec.ts",

    "tests/auth/login.spec.ts",
    "tests/auth/logout.spec.ts",
    "tests/auth/registration.spec.ts",
    "tests/auth/password-reset.spec.ts",
    "tests/auth/email-verification.spec.ts",
    "tests/auth/session.spec.ts",

    "tests/ai/chat.spec.ts",
    "tests/ai/conversation-history.spec.ts",
    "tests/ai/ai-responses.spec.ts",
    "tests/ai/context-memory.spec.ts",
    "tests/ai/long-conversations.spec.ts",
    "tests/ai/rate-limits.spec.ts",

    "tests/memory/create-memory.spec.ts",
    "tests/memory/update-memory.spec.ts",
    "tests/memory/delete-memory.spec.ts",
    "tests/memory/persistence.spec.ts",
    "tests/memory/privacy.spec.ts",

    "tests/mood/create-mood.spec.ts",
    "tests/mood/edit-mood.spec.ts",
    "tests/mood/delete-mood.spec.ts",
    "tests/mood/history.spec.ts",
    "tests/mood/analytics.spec.ts",

    "tests/journals/create.spec.ts",
    "tests/journals/edit.spec.ts",
    "tests/journals/delete.spec.ts",
    "tests/journals/export.spec.ts",
    "tests/journals/search.spec.ts",

    "tests/guides/guides.spec.ts",
    "tests/guides/categories.spec.ts",
    "tests/guides/search.spec.ts",
    "tests/guides/bookmarks.spec.ts",

    "tests/subscriptions/plans.spec.ts",
    "tests/subscriptions/upgrade.spec.ts",
    "tests/subscriptions/downgrade.spec.ts",
    "tests/subscriptions/cancellation.spec.ts",
    "tests/subscriptions/renewal.spec.ts",
    "tests/subscriptions/entitlements.spec.ts",

    "tests/paypal/checkout.spec.ts",
    "tests/paypal/monthly-plan.spec.ts",
    "tests/paypal/annual-plan.spec.ts",
    "tests/paypal/failed-payment.spec.ts",
    "tests/paypal/cancelled-payment.spec.ts",
    "tests/paypal/duplicate-payment.spec.ts",
    "tests/paypal/webhook.spec.ts",

    "tests/admin/dashboard.spec.ts",
    "tests/admin/users.spec.ts",
    "tests/admin/subscriptions.spec.ts",
    "tests/admin/support.spec.ts",
    "tests/admin/logs.spec.ts",
    "tests/admin/permissions.spec.ts",

    "tests/security/csrf.spec.ts",
    "tests/security/xss.spec.ts",
    "tests/security/sql-injection.spec.ts",
    "tests/security/auth-bypass.spec.ts",
    "tests/security/role-escalation.spec.ts",
    "tests/security/session-timeout.spec.ts",
    "tests/security/direct-url-access.spec.ts",

    "tests/api/auth-api.spec.ts",
    "tests/api/chat-api.spec.ts",
    "tests/api/mood-api.spec.ts",
    "tests/api/journal-api.spec.ts",
    "tests/api/subscription-api.spec.ts",
    "tests/api/admin-api.spec.ts",

    "tests/mobile/iphone.spec.ts",
    "tests/mobile/android.spec.ts",
    "tests/mobile/tablet.spec.ts",
    "tests/mobile/responsive-layout.spec.ts",

    ".github/workflows/e2e.yml",
    ".github/workflows/nightly.yml",
    ".github/workflows/smoke.yml",
]


def create_project(root_folder="q-playwright-tests"):
    root = Path(root_folder)

    for item in PROJECT_STRUCTURE:
        path = root / item

        path.parent.mkdir(parents=True, exist_ok=True)

        if "." in path.name:
            if not path.exists():
                path.touch()
                print(f"[FILE] {path}")
        else:
            path.mkdir(parents=True, exist_ok=True)
            print(f"[DIR ] {path}")

    # Create report directories
    report_dirs = [
        "reports/screenshots",
        "reports/traces",
        "reports/videos",
    ]

    for directory in report_dirs:
        dir_path = root / directory
        dir_path.mkdir(parents=True, exist_ok=True)
        print(f"[DIR ] {dir_path}")

    print()
    print("=" * 60)
    print("Project structure created successfully")
    print(f"Location: {root.resolve()}")
    print("=" * 60)


if __name__ == "__main__":
    create_project()