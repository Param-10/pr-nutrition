import type { PackageManager } from "./types.js";

export const DEPENDENCY_MANIFEST_FILE_NAMES = [
  "build.gradle",
  "build.gradle.kts",
  "Cargo.toml",
  "composer.json",
  "Gemfile",
  "go.mod",
  "package.json",
  "Pipfile",
  "pom.xml",
  "pyproject.toml",
  "requirements.txt",
] as const;

export const DEPENDENCY_LOCK_FILE_NAMES = [
  "bun.lock",
  "bun.lockb",
  "Cargo.lock",
  "composer.lock",
  "Gemfile.lock",
  "go.sum",
  "package-lock.json",
  "Pipfile.lock",
  "pnpm-lock.yaml",
  "poetry.lock",
  "uv.lock",
  "yarn.lock",
] as const;

export const DEPENDENCY_FILE_NAMES = new Set(
  [...DEPENDENCY_MANIFEST_FILE_NAMES, ...DEPENDENCY_LOCK_FILE_NAMES].map((name) => name.toLowerCase()),
);

export const LOW_VALUE_DEPENDENCY_FILE_NAMES = new Set(
  DEPENDENCY_LOCK_FILE_NAMES.map((name) => name.toLowerCase()),
);

export const PACKAGE_MANAGER_FILE_CANDIDATES: ReadonlyArray<readonly [string, PackageManager]> = [
  ["pnpm-lock.yaml", "pnpm"],
  ["yarn.lock", "yarn"],
  ["package-lock.json", "npm"],
  ["uv.lock", "uv"],
  ["poetry.lock", "poetry"],
  ["Pipfile.lock", "pipenv"],
  ["Gemfile.lock", "bundler"],
  ["composer.lock", "composer"],
  ["Cargo.lock", "cargo"],
  ["go.sum", "go"],
  ["requirements.txt", "pip"],
  ["Pipfile", "pipenv"],
  ["Gemfile", "bundler"],
  ["pom.xml", "maven"],
  ["build.gradle", "gradle"],
  ["build.gradle.kts", "gradle"],
  ["composer.json", "composer"],
  ["Cargo.toml", "cargo"],
  ["go.mod", "go"],
];
