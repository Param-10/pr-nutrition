export default {
  name: "auth-real",
  build(repo) {
    repo.write("src/auth/session.ts", "export function createSession() { return 'v1'; }\n");
    repo.write("src/auth/session.test.ts", "import './session.js';\n");
    repo.commit("base");

    repo.write("src/auth/session.ts", "export function createSession() { return 'v2'; }\n");
    repo.write("src/auth/session.test.ts", "import './session.js';\n// updated auth coverage\n");
    repo.commit("auth session update");
  },
};
