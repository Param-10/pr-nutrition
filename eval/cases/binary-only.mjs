import { Buffer } from "node:buffer";

export default {
  name: "binary-only",
  build(repo) {
    repo.write("assets/logo.png", Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x01]));
    repo.commit("base");

    repo.write("assets/logo.png", Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x02]));
    repo.commit("binary asset update");
  },
};
