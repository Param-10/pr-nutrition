export default {
  name: "github-issue-template-false-positive",
  build(repo) {
    repo.write(".github/ISSUE_TEMPLATE/bug_report.yml", "name: Bug report\n");
    repo.write(".github/ISSUE_TEMPLATE/config.yml", "blank_issues_enabled: true\n");
    repo.commit("base");

    repo.write(".github/ISSUE_TEMPLATE/bug_report.yml", "name: Bug report\nlabels: bug\n");
    repo.write(".github/ISSUE_TEMPLATE/config.yml", "blank_issues_enabled: false\n");
    repo.commit("issue template update");
  },
};
