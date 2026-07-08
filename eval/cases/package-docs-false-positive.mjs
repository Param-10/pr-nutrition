export default {
  name: "package-docs-false-positive",
  build(repo) {
    repo.write("docs/package-manager.md", "# Package manager\n");
    repo.write("docs/npm-publishing.md", "# npm publishing\n");
    repo.commit("base");

    repo.write("docs/package-manager.md", "# Package manager\n\nUpdated pnpm notes.\n");
    repo.write("docs/npm-publishing.md", "# npm publishing\n\nUpdated release notes.\n");
    repo.commit("package docs update");
  },
};
