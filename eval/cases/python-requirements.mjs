export default {
  name: "python-requirements",
  build(repo) {
    repo.write("requirements.txt", "requests==2.31.0\n");
    repo.commit("base");

    repo.write("requirements.txt", "requests==2.32.0\n");
    repo.commit("bump requests");
  },
};
