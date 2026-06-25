export default {
  name: "monorepo-package",
  build(repo) {
    repo.write("packages/api/package.json", "{\"name\":\"api\",\"dependencies\":{\"zod\":\"1.0.0\"}}\n");
    repo.write("packages/web/package.json", "{\"name\":\"web\",\"dependencies\":{\"react\":\"1.0.0\"}}\n");
    repo.commit("base");

    repo.write("packages/api/package.json", "{\"name\":\"api\",\"dependencies\":{\"zod\":\"1.1.0\"}}\n");
    repo.write("packages/web/package.json", "{\"name\":\"web\",\"dependencies\":{\"react\":\"1.1.0\"}}\n");
    repo.commit("nested package update");
  },
};
