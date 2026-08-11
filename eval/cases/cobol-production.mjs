export default {
  name: "cobol-production",
  build(repo) {
    repo.write("README.md", "# COBOL app\n");
    repo.commit("base");

    repo.write("src/InCollege.cob", "       IDENTIFICATION DIVISION.\n");
    repo.commit("cobol feature");
  },
};
