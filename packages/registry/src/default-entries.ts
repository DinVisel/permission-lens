import metamaskAllowedMethodsEnforcer from "../data/metamask-allowed-methods-enforcer-v1.3.0.json";
import metamaskAllowedTargetsEnforcer from "../data/metamask-allowed-targets-enforcer-v1.3.0.json";
import metamaskDelegationManager from "../data/metamask-delegation-manager-v1.3.0.json";
import metamaskErc20TransferAmountEnforcer from "../data/metamask-erc20-transfer-amount-enforcer-v1.3.0.json";
import metamaskLimitedCallsEnforcer from "../data/metamask-limited-calls-enforcer-v1.3.0.json";
import metamaskLogicalOrWrapperEnforcer from "../data/metamask-logical-or-wrapper-enforcer-v1.3.0.json";
import metamaskNativeTokenTransferAmountEnforcer from "../data/metamask-native-token-transfer-amount-enforcer-v1.3.0.json";
import metamaskRedeemerEnforcer from "../data/metamask-redeemer-enforcer-v1.3.0.json";
import metamaskTimestampEnforcer from "../data/metamask-timestamp-enforcer-v1.3.0.json";
import metamaskValueLteEnforcer from "../data/metamask-value-lte-enforcer-v1.3.0.json";
import type { RawEntry } from "./index.js";

/**
 * Every real (non-`example-*`) entry in `data/`, statically imported so
 * bundlers (Next.js, tsup, a Snap build) can inline them without a
 * filesystem read — `loadRegistryFromPackage()` in the CLI does that read
 * instead, since Node is fine there. Keep this list in sync with `data/`;
 * `packages/registry/test` catches a drift between the two.
 */
export const defaultEntries: RawEntry[] = [
  metamaskAllowedMethodsEnforcer,
  metamaskAllowedTargetsEnforcer,
  metamaskDelegationManager,
  metamaskErc20TransferAmountEnforcer,
  metamaskLimitedCallsEnforcer,
  metamaskLogicalOrWrapperEnforcer,
  metamaskNativeTokenTransferAmountEnforcer,
  metamaskRedeemerEnforcer,
  metamaskTimestampEnforcer,
  metamaskValueLteEnforcer,
] as RawEntry[];
