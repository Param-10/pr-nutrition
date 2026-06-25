export default {
  name: "auth-false-positive",
  build(repo) {
    repo.write("docs/author-guide.md", "# Author guide\n");
    repo.write("src/authority-formatting.test.ts", "export const label = 'Authority';\n");
    repo.commit("base");

    repo.write("docs/author-guide.md", "# Author guide\n\nUpdated writing guidance.\n");
    repo.write("src/authority-formatting.test.ts", "export const label = 'Authority formatting';\n");
    repo.commit("auth-looking non-auth update");
  },
};
