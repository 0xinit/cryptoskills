# L1-L2 Messaging Examples

StarkNet supports bidirectional messaging between Ethereum (L1) and StarkNet (L2). Messages are secured by the validity proof — no trust assumptions beyond the ZK proof.

## Architecture

```
L1 (Ethereum)                    L2 (StarkNet)
┌──────────────┐                 ┌──────────────┐
│  Your L1     │  sendMessageToL2│  Your L2     │
│  Contract    │────────────────>│  Contract    │
│              │                 │  #[l1_handler]│
│              │ consumeMessage  │              │
│              │<────────────────│  send_message │
│              │  FromL2         │  _to_l1      │
└──────┬───────┘                 └──────────────┘
       │
  StarkNet Core
  (Ethereum L1)
```

## L2 to L1: Send Message from Cairo

```cairo
#[starknet::interface]
pub trait IL2Bridge<TContractState> {
    fn withdraw(ref self: TContractState, l1_recipient: felt252, amount: u256);
}

#[starknet::contract]
pub mod L2Bridge {
    use starknet::syscalls::send_message_to_l1_syscall;
    use starknet::{get_caller_address, ContractAddress};
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess, Map};

    #[storage]
    struct Storage {
        balances: Map<ContractAddress, u256>,
        l1_bridge_address: felt252,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        WithdrawalInitiated: WithdrawalInitiated,
    }

    #[derive(Drop, starknet::Event)]
    pub struct WithdrawalInitiated {
        #[key]
        pub user: ContractAddress,
        pub l1_recipient: felt252,
        pub amount: u256,
    }

    #[abi(embed_v0)]
    impl L2BridgeImpl of super::IL2Bridge<ContractState> {
        fn withdraw(ref self: ContractState, l1_recipient: felt252, amount: u256) {
            let caller = get_caller_address();
            let balance = self.balances.read(caller);
            assert(balance >= amount, 'Insufficient balance');

            self.balances.write(caller, balance - amount);

            // Payload: [l1_recipient, amount_low, amount_high]
            let mut payload: Array<felt252> = array![];
            payload.append(l1_recipient);
            payload.append(amount.low.into());
            payload.append(amount.high.into());

            // Send to L1 bridge contract
            send_message_to_l1_syscall(self.l1_bridge_address.read(), payload.span())
                .unwrap();

            self.emit(WithdrawalInitiated { user: caller, l1_recipient, amount });
        }
    }
}
```

## L1 to L2: Send Message from Solidity

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IStarknetCore {
    /// @notice Sends a message to an L2 contract.
    /// @param toAddress The L2 contract address (felt252 as uint256)
    /// @param selector The L2 function selector: sn_keccak("function_name")
    /// @param payload The message payload
    /// @return msgHash The message hash
    /// @return nonce The message nonce
    function sendMessageToL2(
        uint256 toAddress,
        uint256 selector,
        uint256[] calldata payload
    ) external payable returns (bytes32 msgHash, uint256 nonce);

    /// @notice Consumes a message sent from L2.
    /// @param fromAddress The L2 sender contract address
    /// @param payload The message payload
    /// @return msgHash The consumed message hash
    function consumeMessageFromL2(
        uint256 fromAddress,
        uint256[] calldata payload
    ) external returns (bytes32);
}

contract L1Bridge {
    IStarknetCore public immutable starknetCore;
    uint256 public immutable l2BridgeAddress;

    // sn_keccak("handle_deposit") — precomputed selector
    uint256 constant HANDLE_DEPOSIT_SELECTOR =
        0x02d757788a8d8d6f21d1cd40bce38a8222d70654214e96ff95d8086e684fbee5;

    constructor(address starknetCore_, uint256 l2BridgeAddress_) {
        starknetCore = IStarknetCore(starknetCore_);
        l2BridgeAddress = l2BridgeAddress_;
    }

    /// @notice Deposit ETH and send message to L2 bridge
    function deposit(uint256 l2Recipient) external payable {
        require(msg.value > 0, "Zero deposit");

        uint256[] memory payload = new uint256[](3);
        payload[0] = l2Recipient;
        // u256 on StarkNet = (low: u128, high: u128)
        payload[1] = msg.value;    // amount low
        payload[2] = 0;            // amount high

        // Fee for L1->L2 message processing (paid in ETH)
        starknetCore.sendMessageToL2{value: 0}(
            l2BridgeAddress,
            HANDLE_DEPOSIT_SELECTOR,
            payload
        );
    }

    /// @notice Complete a withdrawal initiated on L2
    function completeWithdrawal(
        uint256 l2SenderAddress,
        address recipient,
        uint256 amount
    ) external {
        uint256[] memory payload = new uint256[](3);
        payload[0] = uint256(uint160(recipient));
        payload[1] = amount;  // amount low
        payload[2] = 0;       // amount high

        // Consumes the L2->L1 message (reverts if message doesn't exist)
        starknetCore.consumeMessageFromL2(l2SenderAddress, payload);

        // Process the withdrawal
        (bool success, ) = recipient.call{value: amount}("");
        require(success, "ETH transfer failed");
    }
}
```

## L1 Handler in Cairo (Receiving L1 Messages)

```cairo
/// The #[l1_handler] attribute marks a function as an L1 message receiver.
/// The sequencer automatically invokes this when an L1->L2 message arrives.
/// The first parameter (from_address) is the L1 sender — ALWAYS validate it.
#[l1_handler]
fn handle_deposit(
    ref self: ContractState,
    from_address: felt252,
    user: ContractAddress,
    amount_low: u128,
    amount_high: u128,
) {
    // Security: validate the L1 sender is the authorized bridge
    assert(from_address == self.l1_bridge_address.read(), 'Unauthorized L1 sender');

    let amount: u256 = u256 { low: amount_low, high: amount_high };
    self.balances.write(user, self.balances.read(user) + amount);
    self.emit(DepositReceived { user, amount });
}
```

## Message Format and Hashing

Messages are hashed for verification:

**L2->L1 message hash** (computed on L1):
```
keccak256(
    abi.encodePacked(
        fromL2Address,   // L2 sender contract
        toL1Address,     // L1 recipient contract
        payload.length,
        payload
    )
)
```

**L1->L2 message hash** (computed by StarkNet):
```
hash(
    fromL1Address,       // L1 sender contract
    toL2Address,         // L2 recipient contract
    nonce,
    selector,            // L2 function selector
    payload.length,
    payload
)
```

## StarkNet Core Contract (Ethereum L1)

| Network | Address |
|---------|---------|
| Mainnet | `0xc662c410C0ECf747543f5bA90660f6ABeBD9C8c4` |
| Sepolia | `0xE2Bb56ee936fd6433DC0F6e7e3b8365C906AA057` |

Last verified: 2025-03

## Message Lifecycle Timing

| Direction | Steps | Typical Time |
|-----------|-------|-------------|
| L2->L1 | L2 tx included -> state update proven on L1 -> consumable | Hours (depends on proof submission) |
| L1->L2 | L1 tx confirmed -> sequencer processes | Minutes to hours |

Messages are not instant. L2->L1 messages require a state update to be proven and posted to L1, which can take several hours. L1->L2 messages are processed by the sequencer after L1 finality.
