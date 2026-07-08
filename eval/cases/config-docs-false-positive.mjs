export default {
  name: "config-docs-false-positive",
  build(repo) {
    repo.write("docs/configuration.md", "# Configuration\n");
    repo.write("docs/config-examples.md", "# Config examples\n");
    repo.commit("base");

    repo.write("docs/configuration.md", "# Configuration\n\nUpdated option notes.\n");
    repo.write("docs/config-examples.md", "# Config examples\n\nUpdated sample.\n");
    repo.commit("config docs update");
  },
};
