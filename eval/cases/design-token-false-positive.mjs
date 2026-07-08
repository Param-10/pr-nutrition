export default {
  name: "design-token-false-positive",
  build(repo) {
    repo.write("src/styles/design-tokens.ts", "export const spacing = '4px';\n");
    repo.write("src/theme/tokens.ts", "export const color = '#000';\n");
    repo.commit("base");

    repo.write("src/styles/design-tokens.ts", "export const spacing = '8px';\n");
    repo.write("src/theme/tokens.ts", "export const color = '#111';\n");
    repo.commit("design token update");
  },
};
