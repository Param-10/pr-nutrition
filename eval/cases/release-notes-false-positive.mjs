export default {
  name: "release-notes-false-positive",
  build(repo) {
    repo.write("CHANGELOG.md", "# Changelog\n");
    repo.write("docs/release-process.md", "# Release process\n");
    repo.commit("base");

    repo.write("CHANGELOG.md", "# Changelog\n\n## Unreleased\n");
    repo.write("docs/release-process.md", "# Release process\n\nUpdated checklist.\n");
    repo.commit("release notes update");
  },
};
