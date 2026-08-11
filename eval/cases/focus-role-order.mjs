export default {
  name: "focus-role-order",
  build(repo) {
    repo.write("src/feature.swift", "let before = true\n");
    repo.write("ExampleAppTests/FeatureTests.swift", "let before = true\n");
    repo.write("docs/feature.md", "before\n");
    repo.commit("base");

    repo.write("src/feature.swift", "let feature = true\n".repeat(300));
    repo.write("ExampleAppTests/FeatureTests.swift", "let assertion = true\n".repeat(400));
    repo.write("docs/feature.md", "documentation\n".repeat(500));
    repo.commit("feature with verification");
  },
};
