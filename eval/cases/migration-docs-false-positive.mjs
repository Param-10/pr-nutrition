export default {
  name: "migration-docs-false-positive",
  build(repo) {
    repo.write("docs/migrations/guide.md", "# Migration guide\n");
    repo.write("docs/database-migrations.md", "# Database migrations\n");
    repo.commit("base");

    repo.write("docs/migrations/guide.md", "# Migration guide\n\nUpdated checklist.\n");
    repo.write("docs/database-migrations.md", "# Database migrations\n\nUpdated rollback notes.\n");
    repo.commit("migration docs update");
  },
};
