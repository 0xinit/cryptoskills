# Minimal AVS Registration and Operator Validation

Working examples for building an AVS (Actively Validated Service) on EigenLayer. Covers the ServiceManager pattern for registering operators and validating their registration status.

## Architecture

An AVS needs at minimum:

1. **ServiceManager contract** -- calls `AVSDirectory.registerOperatorToAVS()` to register operators
2. **Task management logic** -- assigns tasks to operators and validates responses
3. **Slashing conditions** -- defines what constitutes operator misbehavior

## Solidity: Minimal ServiceManager

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IAVSDirectory {
    struct SignatureWithSaltAndExpiry {
        bytes signature;
        bytes32 salt;
        uint256 expiry;
    }

    function registerOperatorToAVS(
        address operator,
        SignatureWithSaltAndExpiry memory operatorSignature
    ) external;

    function deregisterOperatorFromAVS(address operator) external;
}

interface IDelegationManager {
    function isOperator(address operator) external view returns (bool);
    function operatorShares(address operator, address strategy) external view returns (uint256);
}

/// @notice Minimal AVS ServiceManager with operator registration and task validation
contract MinimalAVSServiceManager {
    IAVSDirectory public constant AVS_DIRECTORY =
        IAVSDirectory(0x135DDa560e946695d6f155dACaFC6f1F25C1F5AF);
    IDelegationManager public constant DELEGATION_MANAGER =
        IDelegationManager(0x39053D51B77DC0d36036Fc1fCc8Cb819df8Ef37A);

    address public owner;
    uint256 public minimumStake;

    mapping(address => bool) public registeredOperators;
    mapping(uint32 => Task) public tasks;
    uint32 public nextTaskId;

    struct Task {
        bytes32 taskHash;
        uint32 createdBlock;
        bool completed;
        address assignedOperator;
    }

    event OperatorRegistered(address indexed operator);
    event OperatorDeregistered(address indexed operator);
    event TaskCreated(uint32 indexed taskId, bytes32 taskHash, address indexed operator);
    event TaskCompleted(uint32 indexed taskId, address indexed operator);

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyRegisteredOperator() {
        if (!registeredOperators[msg.sender]) revert NotRegistered();
        _;
    }

    constructor(uint256 _minimumStake) {
        owner = msg.sender;
        minimumStake = _minimumStake;
    }

    /// @notice Register an operator to this AVS
    /// @dev Operator must be registered in DelegationManager and meet minimum stake
    /// @param operator The operator address
    /// @param operatorSignature EIP-712 signature from the operator authorizing registration
    function registerOperator(
        address operator,
        IAVSDirectory.SignatureWithSaltAndExpiry memory operatorSignature
    ) external onlyOwner {
        if (registeredOperators[operator]) revert AlreadyRegistered();
        if (!DELEGATION_MANAGER.isOperator(operator)) revert NotEigenLayerOperator();

        AVS_DIRECTORY.registerOperatorToAVS(operator, operatorSignature);
        registeredOperators[operator] = true;

        emit OperatorRegistered(operator);
    }

    /// @notice Deregister an operator from this AVS
    function deregisterOperator(address operator) external onlyOwner {
        if (!registeredOperators[operator]) revert NotRegistered();

        AVS_DIRECTORY.deregisterOperatorFromAVS(operator);
        registeredOperators[operator] = false;

        emit OperatorDeregistered(operator);
    }

    /// @notice Create a task and assign it to a registered operator
    /// @param taskData Arbitrary task data to hash
    /// @param operator The operator assigned to complete this task
    function createTask(
        bytes calldata taskData,
        address operator
    ) external onlyOwner returns (uint32 taskId) {
        if (!registeredOperators[operator]) revert NotRegistered();

        taskId = nextTaskId++;
        tasks[taskId] = Task({
            taskHash: keccak256(taskData),
            createdBlock: uint32(block.number),
            completed: false,
            assignedOperator: operator
        });

        emit TaskCreated(taskId, tasks[taskId].taskHash, operator);
    }

    /// @notice Operator submits a response to complete a task
    /// @param taskId The task to complete
    /// @param response The operator's response data
    function completeTask(
        uint32 taskId,
        bytes calldata response
    ) external onlyRegisteredOperator {
        Task storage task = tasks[taskId];
        if (task.completed) revert TaskAlreadyCompleted();
        if (task.assignedOperator != msg.sender) revert NotAssignedOperator();
        if (task.taskHash == bytes32(0)) revert TaskDoesNotExist();

        task.completed = true;
        emit TaskCompleted(taskId, msg.sender);
    }

    /// @notice Check if an operator meets the minimum stake requirement
    /// @param operator The operator address
    /// @param strategy The strategy to check stake in
    function meetsMinimumStake(
        address operator,
        address strategy
    ) external view returns (bool) {
        uint256 operatorStake = DELEGATION_MANAGER.operatorShares(operator, strategy);
        return operatorStake >= minimumStake;
    }

    error NotOwner();
    error AlreadyRegistered();
    error NotRegistered();
    error NotEigenLayerOperator();
    error TaskAlreadyCompleted();
    error NotAssignedOperator();
    error TaskDoesNotExist();
}
```

## TypeScript: Interact with AVS ServiceManager

```typescript
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";

const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(process.env.RPC_URL),
});

const account = privateKeyToAccount(
  process.env.PRIVATE_KEY as `0x${string}`
);

const walletClient = createWalletClient({
  account,
  chain: mainnet,
  transport: http(process.env.RPC_URL),
});

const serviceManagerAbi = parseAbi([
  "function registerOperator(address operator, (bytes signature, bytes32 salt, uint256 expiry) operatorSignature) external",
  "function deregisterOperator(address operator) external",
  "function createTask(bytes taskData, address operator) external returns (uint32)",
  "function completeTask(uint32 taskId, bytes response) external",
  "function registeredOperators(address operator) external view returns (bool)",
  "function tasks(uint32 taskId) external view returns (bytes32 taskHash, uint32 createdBlock, bool completed, address assignedOperator)",
  "function meetsMinimumStake(address operator, address strategy) external view returns (bool)",
]);

async function registerOperatorToAvs(
  serviceManager: Address,
  operatorAddress: Address,
  signature: `0x${string}`,
  salt: `0x${string}`,
  expiry: bigint
): Promise<`0x${string}`> {
  const { request } = await publicClient.simulateContract({
    address: serviceManager,
    abi: serviceManagerAbi,
    functionName: "registerOperator",
    args: [operatorAddress, { signature, salt, expiry }],
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Registration reverted");

  return hash;
}

async function createTask(
  serviceManager: Address,
  taskData: `0x${string}`,
  operatorAddress: Address
): Promise<{ hash: `0x${string}` }> {
  const { request } = await publicClient.simulateContract({
    address: serviceManager,
    abi: serviceManagerAbi,
    functionName: "createTask",
    args: [taskData, operatorAddress],
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Task creation reverted");

  return { hash };
}

async function checkOperatorStatus(
  serviceManager: Address,
  operatorAddress: Address
): Promise<boolean> {
  return publicClient.readContract({
    address: serviceManager,
    abi: serviceManagerAbi,
    functionName: "registeredOperators",
    args: [operatorAddress],
  });
}
```

## Deployment Checklist

1. Deploy the ServiceManager contract with your desired `minimumStake`
2. Register the ServiceManager as an AVS in the EigenLayer ecosystem
3. Operators generate registration signatures (see `register-operator` example)
4. Call `registerOperator()` with each operator's signature
5. Create tasks and assign them to registered operators
6. Operators run off-chain software to complete tasks and submit responses

## Notes

- The ServiceManager address IS the AVS identity in `AVSDirectory`. When `registerOperatorToAVS` is called, `msg.sender` (the ServiceManager) is recorded as the AVS.
- Operator signatures are EIP-712 typed data signatures. The digest is computed by `AVSDirectory.calculateOperatorAVSRegistrationDigestHash()`.
- For production AVSs, add proper access control, quorum logic, and slashing conditions. This example is intentionally minimal.
- Consider using the `eigenlayer-middleware` library from Layr-Labs for production deployments -- it provides BLS signature aggregation, quorum management, and stake tracking out of the box.
- Slashing integration requires the AllocationManager. Operators must allocate magnitude to your AVS's operator set before they can be slashed.
