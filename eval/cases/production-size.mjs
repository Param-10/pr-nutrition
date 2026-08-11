export default {
  name: "production-size",
  build(repo) {
    repo.write("src/feature.ts", "export const before = true;\n");
    repo.commit("base");

    repo.write(
      "src/feature.ts",
      Array.from({ length: 800 }, (_, index) => `export const line${index} = ${index};`).join("\n") + "\n",
    );
    repo.commit("large production change");
  },
};
