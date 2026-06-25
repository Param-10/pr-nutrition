export default {
  name: "ci-only",
  build(repo) {
    repo.write(".github/workflows/ci.yml", "name: CI\non: [pull_request]\n");
    repo.commit("base");

    repo.write(".github/workflows/ci.yml", "name: CI\non: [pull_request, push]\n");
    repo.commit("workflow update");
  },
};
