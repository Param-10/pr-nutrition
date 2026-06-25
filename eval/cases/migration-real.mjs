export default {
  name: "migration-real",
  build(repo) {
    repo.write("db/migrate/001_create_users.sql", "create table users (id integer primary key);\n");
    repo.commit("base");

    repo.write(
      "db/migrate/001_create_users.sql",
      "create table users (id integer primary key, email text not null);\n",
    );
    repo.commit("migration update");
  },
};
