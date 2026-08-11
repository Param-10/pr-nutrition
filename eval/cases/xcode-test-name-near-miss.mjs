export default {
  name: "xcode-test-name-near-miss",
  build(repo) {
    repo.write("README.md", "# Demo\n");
    repo.commit("base");

    repo.write("src/ContestSupport/Results.swift", "let result = true\n");
    repo.write("src/Latest/Version.swift", "let version = 1\n");
    repo.commit("production feature");
  },
};
