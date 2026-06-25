export default {
  name: "docs-only",
  build(repo) {
    repo.write("README.md", "# Demo\n");
    repo.commit("base");

    repo.write("README.md", "# Demo\n\nUpdated usage notes.\n");
    repo.write("docs/usage.md", "# Usage\n\nRun the tool locally.\n");
    repo.commit("docs update");
  },
};
