export default {
  name: "xcode-tests",
  build(repo) {
    repo.write("ExampleApp/Feature.swift", "let feature = 1\n");
    repo.write("ExampleAppTests/FeatureTests.swift", "let assertion = 1\n");
    repo.commit("base");

    repo.write("ExampleApp/Feature.swift", "let feature = 2\n");
    repo.write("ExampleAppTests/FeatureTests.swift", "let assertion = 2\n");
    repo.write("ExampleAppUITests/FeatureUITests.swift", "let smokeTest = true\n");
    repo.commit("feature with Xcode tests");
  },
};
