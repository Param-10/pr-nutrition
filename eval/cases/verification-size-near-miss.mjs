export default {
  name: "verification-size-near-miss",
  build(repo) {
    repo.write("README.md", "# Demo\n");
    repo.commit("base");

    repo.write("docs/review.md", "documentation\n".repeat(300));
    repo.write("ExampleAppTests/LargeFeatureTests.swift", "let assertion = true\n".repeat(900));
    repo.commit("large verification change");
  },
};
