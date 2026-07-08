export default {
  name: "author-component-false-positive",
  build(repo) {
    repo.write("src/components/AuthorCard.tsx", "export const AuthorCard = () => 'Author';\n");
    repo.write("src/components/AuthorProfile.tsx", "export const AuthorProfile = () => 'Profile';\n");
    repo.commit("base");

    repo.write("src/components/AuthorCard.tsx", "export const AuthorCard = () => 'Author card';\n");
    repo.write("src/components/AuthorProfile.tsx", "export const AuthorProfile = () => 'Author profile';\n");
    repo.commit("author component update");
  },
};
