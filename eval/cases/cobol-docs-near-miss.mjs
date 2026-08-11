export default {
  name: "cobol-docs-near-miss",
  build(repo) {
    repo.write("README.md", "# COBOL app\n");
    repo.commit("base");

    repo.write("docs/example.cob", "       IDENTIFICATION DIVISION.\n");
    repo.commit("cobol documentation");
  },
};
