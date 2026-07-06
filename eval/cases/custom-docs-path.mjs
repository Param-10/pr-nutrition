export default {
  name: "custom-docs-path",
  build(repo) {
    repo.write(
      ".pr-nutrition.json",
      `${JSON.stringify({ schemaVersion: 1, paths: { docs: ["handbook/**"] } }, null, 2)}\n`,
    );
    repo.write("handbook/onboarding.adoc", "= Onboarding\n");
    repo.commit("base");

    repo.write("handbook/onboarding.adoc", "= Onboarding\n\nUpdated steps.\n");
    repo.commit("update onboarding handbook");
  },
};
