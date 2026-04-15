import { registerDateFunctions } from "./date";
import { registerLogicFunctions } from "./logic";
import { registerMathFunctions } from "./math";
import { registerTextFunctions } from "./text";

export {
  executeFunctionOp,
  getRegisteredFunctionNames,
  type CellValueGetter,
  type FunctionContext,
} from "./registry";

let registered = false;

export function initializeFunctionsRegistry() {
  if (registered) return;
  registerMathFunctions();
  registerDateFunctions();
  registerTextFunctions();
  registerLogicFunctions();
  registered = true;
}
