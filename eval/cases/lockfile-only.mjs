export default {
  name: "lockfile-only",
  build(repo) {
    repo.write("package.json", "{\"scripts\":{\"test\":\"vitest\"}}\n");
    repo.write("pnpm-lock.yaml", "lockfileVersion: '9.0'\n\npackages: {}\n");
    repo.commit("base");

    repo.write("pnpm-lock.yaml", "lockfileVersion: '9.0'\n\npackages:\n  left-pad: 1.3.0\n");
    repo.commit("lockfile update");
  },
};
