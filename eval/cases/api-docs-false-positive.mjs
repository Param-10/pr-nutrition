export default {
  name: "api-docs-false-positive",
  build(repo) {
    repo.write("docs/api/reference.md", "# API reference\n");
    repo.write("docs/api/examples.md", "# API examples\n");
    repo.commit("base");

    repo.write("docs/api/reference.md", "# API reference\n\nUpdated parameter notes.\n");
    repo.write("docs/api/examples.md", "# API examples\n\nUpdated example request.\n");
    repo.commit("api docs update");
  },
};
