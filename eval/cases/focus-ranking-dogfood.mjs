export default {
  name: "focus-ranking-dogfood",
  build(repo) {
    repo.write("packages/cli/package.json", '{"version":"0.2.1"}\n');
    repo.write("packages/cli/tsup.config.ts", "export const target = 'node22';\n");
    repo.write("packages/cli/src/run.ts", "export const before = true;\n");
    repo.commit("v0.2.1 shape");

    repo.write("packages/cli/package.json", '{"version":"0.3.0"}\n');
    repo.write("packages/cli/tsup.config.ts", "export const target = 'node24';\n");
    repo.write(
      "packages/cli/src/run.ts",
      Array.from({ length: 90 }, (_, index) => `export const line${index} = ${index};`).join("\n") + "\n",
    );
    repo.commit("v0.3.0 trust work");
  },
};
