export default {
  name: "custom-generated",
  build(repo) {
    repo.write(
      ".pr-nutrition.json",
      `${JSON.stringify({ schemaVersion: 1, paths: { generated: ["sdk/**"] } }, null, 2)}\n`,
    );
    repo.write("sdk/client.ts", "export const clientVersion = 1;\n");
    repo.commit("base");

    repo.write("sdk/client.ts", "export const clientVersion = 2;\n");
    repo.commit("regenerate sdk client");
  },
};
