export default {
  name: "risky-word-fixtures-false-positive",
  build(repo) {
    repo.write("tests/fixtures/auth-response.json", "{\"status\":\"ok\"}\n");
    repo.write("tests/fixtures/api-token.json", "{\"token\":\"example\"}\n");
    repo.write("tests/fixtures/migration-plan.json", "{\"steps\":[]}\n");
    repo.commit("base");

    repo.write("tests/fixtures/auth-response.json", "{\"status\":\"updated\"}\n");
    repo.write("tests/fixtures/api-token.json", "{\"token\":\"sample\"}\n");
    repo.write("tests/fixtures/migration-plan.json", "{\"steps\":[\"noop\"]}\n");
    repo.commit("risky word fixture update");
  },
};
