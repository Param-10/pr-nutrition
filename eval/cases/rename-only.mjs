export default {
  name: "rename-only",
  build(repo) {
    repo.write("src/old-name.ts", "export const value = 1;\n");
    repo.commit("base");

    repo.rename("src/old-name.ts", "src/new-name.ts");
    repo.commit("rename file");
  },
};
