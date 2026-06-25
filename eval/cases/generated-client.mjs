export default {
  name: "generated-client",
  build(repo) {
    repo.write("src/generated/client.ts", "export const clientVersion = 1;\n");
    repo.commit("base");

    repo.write("src/generated/client.ts", "export const clientVersion = 2;\n");
    repo.commit("generated client update");
  },
};
