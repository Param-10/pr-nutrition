import * as core from "@actions/core";
import { formatActionError, runAction } from "./run.js";

runAction({
  getInput: (name) => core.getInput(name),
  setOutput: (name, value) => core.setOutput(name, value),
  warning: (message) => core.warning(message),
}).catch((error: unknown) => {
  core.setFailed(formatActionError(error));
});
