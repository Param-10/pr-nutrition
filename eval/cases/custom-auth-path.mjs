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
    repo.write("modules/identity/session.rb", "class Session\nend\n");
    repo.commit("base");

    repo.write("modules/identity/session.rb", "class Session\n  def rotate; end\nend\n");
    repo.commit("rotate identity sessions");
  },
};
