export default {
  name: "generated-auth-client-false-positive",
  build(repo) {
    repo.write("src/generated/auth-client.ts", "export const authClientVersion = 1;\n");
    repo.write("src/generated/session-api.ts", "export const sessionApiVersion = 1;\n");
    repo.commit("base");

    repo.write("src/generated/auth-client.ts", "export const authClientVersion = 2;\n");
    repo.write("src/generated/session-api.ts", "export const sessionApiVersion = 2;\n");
    repo.commit("generated auth client update");
  },
};
