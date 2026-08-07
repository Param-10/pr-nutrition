export default {
  name: "custom-auth-path",
  build(repo) {
    repo.write(
      ".pr-nutrition.json",
      `${JSON.stringify(
        { schemaVersion: 1, paths: { risk: { authentication: ["modules/identity/**"] } } },
        null,
        2,
      )}\n`,
    );
    repo.write("modules/identity/tenant-lookup.rb", "class TenantLookup\nend\n");
    repo.commit("base");

    repo.write("modules/identity/tenant-lookup.rb", "class TenantLookup\n  def rotate; end\nend\n");
    repo.commit("rotate identity tenant lookups");
  },
};
